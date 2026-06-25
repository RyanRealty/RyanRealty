#!/usr/bin/env node
/**
 * check-email-send-gated.mjs — the suppression-send CI gate.
 *
 * EVERY outbound email send to a lead / homeowner / client must pass through the
 * suppression chokepoint (lib/crm/suppressions.ts isSuppressed, fail-closed)
 * before it reaches the wire. A send that skips the chokepoint can mail an
 * unsubscribed, complained, bounced, or compliance:hard-stop contact — a CAN-SPAM
 * / reputational hazard and a direct violation of the consent record a person
 * set when they opted out.
 *
 * This gate scans app/ + lib/ for call sites of sendEmail / sendBatchEmails
 * (the Resend wrappers in lib/resend.ts) and asserts each is one of:
 *
 *   (a) GATED — the same enclosing function performs an isSuppressed(...) check
 *       before the send, OR the send routes through a wrapper that is itself a
 *       documented gating wrapper (WRAPPER_NAMES below), OR
 *
 *   (b) ALLOWLISTED — recorded in scripts/email-send-gated-baseline.json as a
 *       genuinely-internal / transactional send (broker alert, admin
 *       notification, the broker's own digest) where there is no lead recipient
 *       to suppress.
 *
 * It is a RATCHET: the baseline is the current set of ungated sites and may only
 * SHRINK. Any NEW ungated send (not gated, not in the baseline) fails the build.
 * Removing an entry from the baseline is allowed (a send got gated); adding one
 * is not (use isSuppressed instead).
 *
 * Mirror of the house style in scripts/check-crm-sms-channel-safety.mjs and
 * scripts/check-tracking-policy.mjs.
 *
 * Usage:
 *   node scripts/check-email-send-gated.mjs            # check against baseline
 *   node scripts/check-email-send-gated.mjs --write    # regenerate the baseline
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = process.cwd()
const SCAN_DIRS = ['app', 'lib']
const BASELINE_PATH = join(ROOT, 'scripts', 'email-send-gated-baseline.json')

/** The Resend send functions every outbound email funnels through. */
export const SEND_FNS = ['sendEmail', 'sendBatchEmails']

/**
 * Wrappers that are themselves suppression-gating: a send made through one of
 * these counts as gated even without an inline isSuppressed in the same
 * function. (Empty today — there is no such wrapper yet; the canonical chokepoint
 * is isSuppressed called inline. Kept as the seam for when Wave 5 introduces a
 * single sendToLead(...) wrapper that does the check internally.)
 */
export const WRAPPER_NAMES = []

const isSourceFile = (p) => /\.(ts|tsx)$/.test(p) && !/\.test\.(ts|tsx)$/.test(p) && !/\.d\.ts$/.test(p)

/**
 * Blank out comments while preserving line count + column positions, so a
 * `sendEmail(` mentioned in a doc comment (lib/digest-email-templates.tsx) is
 * never mistaken for a call site. Replaces line + block comment characters with
 * spaces (newlines kept) so the source stays line-addressable. Pure.
 */
export function stripComments(source) {
  let out = ''
  let i = 0
  const n = source.length
  let inLine = false
  let inBlock = false
  let inStr = null // the quote char when inside a string/template
  while (i < n) {
    const ch = source[i]
    const next = i + 1 < n ? source[i + 1] : ''
    if (inLine) {
      if (ch === '\n') {
        inLine = false
        out += ch
      } else out += ' '
      i++
      continue
    }
    if (inBlock) {
      if (ch === '*' && next === '/') {
        inBlock = false
        out += '  '
        i += 2
      } else {
        out += ch === '\n' ? '\n' : ' '
        i++
      }
      continue
    }
    if (inStr) {
      out += ch
      if (ch === '\\') {
        out += next
        i += 2
        continue
      }
      if (ch === inStr) inStr = null
      i++
      continue
    }
    if (ch === '/' && next === '/') {
      inLine = true
      out += '  '
      i += 2
      continue
    }
    if (ch === '/' && next === '*') {
      inBlock = true
      out += '  '
      i += 2
      continue
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      inStr = ch
      out += ch
      i++
      continue
    }
    out += ch
    i++
  }
  return out
}

/** lib/resend.ts is where the send functions are DEFINED — never a call site. */
const isDefiningFile = (rel) => rel === 'lib/resend.ts'

/**
 * Walk a directory tree, returning absolute paths to source files. Skips
 * node_modules, .next, and any nested worktree / dotfolder so a stale checkout
 * under .claude/worktrees never pollutes the scan.
 */
function walk(dir, out = []) {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const e of entries) {
    const full = join(dir, e.name)
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === '.next' || e.name.startsWith('.')) continue
      walk(full, out)
    } else if (e.isFile() && isSourceFile(e.name)) {
      out.push(full)
    }
  }
  return out
}

/**
 * Given the full source of a file, find the 1-based line of every send call
 * site. A "call site" is a line where a SEND_FN or a WRAPPER_NAME is invoked
 * (followed by `(`). The defining `export ... function sendEmail(` /
 * `export ... function sendBatchEmails(` lines are NOT call sites — but this
 * matcher is only ever fed non-defining files, so the caller excludes
 * lib/resend.ts.
 */
export function findSendSites(source) {
  const names = [...SEND_FNS, ...WRAPPER_NAMES]
  const lines = source.split('\n')
  const sites = []
  // A call: the function name as a whole word immediately followed by `(`,
  // NOT preceded by `function ` (a definition) or `.` (a method on something
  // else) or `import ` (a named import).
  const callRe = new RegExp(`(^|[^.\\w])(${names.join('|')})\\s*\\(`)
  const defRe = /\bfunction\s+(sendEmail|sendBatchEmails)\b/
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (defRe.test(line)) continue
    const m = callRe.exec(line)
    if (m) sites.push({ line: i + 1, fn: m[2] })
  }
  return sites
}

/**
 * Locate the body span [startLine, endLine] (1-based, inclusive) of the
 * brace-delimited function/arrow/method that encloses `targetLine`. Pure: walks
 * backward to the nearest enclosing `{` whose matching `}` is after the target,
 * using brace depth. Falls back to the whole file if no enclosing block is
 * found. This is deliberately scope-conservative — an isSuppressed in the same
 * function counts; one in a sibling function does not.
 */
export function enclosingScope(source, targetLine) {
  const lines = source.split('\n')
  // Build cumulative brace depth per line end.
  // Find, scanning UP from targetLine, the line where depth dips to the level
  // that opens the enclosing block, then scan DOWN to find its close.
  // Simpler robust approach: compute the depth at the start of targetLine, then
  // expand outward.
  let depthAtTarget = 0
  for (let i = 0; i < targetLine - 1; i++) {
    for (const ch of lines[i]) {
      if (ch === '{') depthAtTarget++
      else if (ch === '}') depthAtTarget--
    }
  }
  if (depthAtTarget <= 0) return { start: 1, end: lines.length }
  // Walk up to find the line that brought depth from (depthAtTarget-1) to
  // depthAtTarget — i.e. the opening brace of the enclosing block.
  let depth = depthAtTarget
  let start = 1
  for (let i = targetLine - 2; i >= 0; i--) {
    for (let k = lines[i].length - 1; k >= 0; k--) {
      const ch = lines[i][k]
      if (ch === '}') depth++
      else if (ch === '{') {
        depth--
        if (depth < depthAtTarget) {
          start = i + 1
          break
        }
      }
    }
    if (start !== 1) break
  }
  // Walk down to find the matching close of that opening brace.
  let d = 0
  let end = lines.length
  let seenOpen = false
  for (let i = start - 1; i < lines.length; i++) {
    for (const ch of lines[i]) {
      if (ch === '{') {
        d++
        seenOpen = true
      } else if (ch === '}') {
        d--
        if (seenOpen && d === 0) {
          end = i + 1
          break
        }
      }
    }
    if (seenOpen && d === 0) break
  }
  return { start, end }
}

/**
 * Decide whether a send site is gated: is there an isSuppressed(...) /
 * isSuppressedByEmail(...) call within the enclosing scope, at or before the
 * send line? (At-or-before lets a guard like
 * `if ((await isSuppressed(id,'email')).suppressed) return` precede the send on
 * a later line, which is the canonical pattern.) isSuppressedByEmail is the
 * person-id-less variant used where only the recipient email is known.
 */
const GATE_RE = /\bisSuppressed(?:ByEmail)?\s*\(/

export function isGated(source, sendLine) {
  const { start, end } = enclosingScope(source, sendLine)
  const lines = source.split('\n')
  for (let i = start - 1; i < Math.min(end, sendLine); i++) {
    if (GATE_RE.test(lines[i])) return true
  }
  return false
}

/**
 * Pure: classify every send site in one file. Returns the list of UNGATED site
 * keys (`<rel>:<line>`) — these are the sites that must be either gated or
 * allowlisted.
 */
export function classifyFile(rel, source) {
  // Strip comments first so a `sendEmail(` / `isSuppressed(` mentioned in a doc
  // comment is never counted as a call site or a gate. Line numbers are
  // preserved by stripComments.
  const clean = stripComments(source)
  const ungated = []
  for (const site of findSendSites(clean)) {
    if (!isGated(clean, site.line)) ungated.push(`${rel}:${site.line}`)
  }
  return ungated
}

// ── runner ───────────────────────────────────────────────────────────────────

function scanRepo() {
  const ungated = []
  for (const d of SCAN_DIRS) {
    const dir = join(ROOT, d)
    if (!existsSync(dir) || !statSync(dir).isDirectory()) continue
    for (const abs of walk(dir)) {
      const rel = relative(ROOT, abs).split('\\').join('/')
      if (isDefiningFile(rel)) continue
      const source = readFileSync(abs, 'utf8')
      ungated.push(...classifyFile(rel, source))
    }
  }
  return ungated.sort()
}

function loadBaseline() {
  if (!existsSync(BASELINE_PATH)) return { sites: {} }
  try {
    return JSON.parse(readFileSync(BASELINE_PATH, 'utf8'))
  } catch (e) {
    console.error(`✗ email-send-gated: cannot parse ${relative(ROOT, BASELINE_PATH)}: ${e.message}`)
    process.exit(1)
  }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (isMain) {
  const write = process.argv.includes('--write')
  const found = scanRepo()

  if (write) {
    const prev = loadBaseline()
    const existing = prev.sites ?? {}
    const sites = {}
    for (const key of found) {
      // Preserve the curated kind + reason on existing entries; default a fresh
      // entry to a lead-todo so a human must triage it (gate or reclassify).
      sites[key] = existing[key] ?? {
        kind: 'lead-todo',
        reason: 'TODO: triage this send. Gate it through isSuppressed, or reclassify as kind:internal if it has no lead recipient.',
      }
    }
    const out = {
      // Keep the curated $comment if one already exists; otherwise seed the
      // canonical description.
      $comment:
        prev.$comment ??
        'Ratchet baseline for check-email-send-gated.mjs. Each key is an UNGATED ' +
          'sendEmail/sendBatchEmails call site (<file>:<line>). The list may only ' +
          'SHRINK. Gate a send (add an isSuppressed check) and remove its entry. ' +
          'NEVER add a new entry; gate the send instead. Regenerate after a gating ' +
          'change with: node scripts/check-email-send-gated.mjs --write',
      sites,
    }
    writeFileSync(BASELINE_PATH, JSON.stringify(out, null, 2) + '\n')
    console.log(`✓ email-send-gated: wrote ${found.length} ungated site(s) to ${relative(ROOT, BASELINE_PATH)}`)
    process.exit(0)
  }

  const baseline = loadBaseline()
  const sitesObj = baseline.sites ?? {}
  const allowed = new Set(Object.keys(sitesObj))
  const novel = found.filter((k) => !allowed.has(k))
  const fixed = [...allowed].filter((k) => !found.includes(k))

  // Meta-assertion (Cluster A blocker 7): every lead/client-facing marketing
  // send is now gated through the suppression chokepoint, so NO kind=lead-todo
  // entry may remain in the baseline. Only kind=internal (a genuinely-internal
  // or 1:1 transactional send with no marketable lead recipient) is allowed.
  // A lead-todo entry means a lead send is sitting ungated in the allowlist
  // instead of being gated — fail the build until it is gated or reclassified.
  const leadTodos = Object.entries(sitesObj)
    .filter(([, v]) => (v && v.kind) !== 'internal')
    .map(([k, v]) => `${k} (kind: ${(v && v.kind) ?? 'unset'})`)
  if (leadTodos.length) {
    console.error(
      `\n✗ email-send-gated: ${leadTodos.length} baseline entr${leadTodos.length === 1 ? 'y is' : 'ies are'} not kind=internal:\n`,
    )
    for (const k of leadTodos) console.error(`  • ${k}`)
    console.error(
      '\n  Every lead/client-facing send must be GATED through isSuppressed / isSuppressedByEmail,\n' +
        '  not allowlisted. Gate the send and remove its entry, OR if it has no marketable lead\n' +
        '  recipient (broker/admin alert, 1:1 transactional notice) reclassify it to kind:internal\n' +
        '  with a reason that names the recipient.',
    )
    process.exit(1)
  }

  if (novel.length) {
    console.error(`\n✗ email-send-gated: ${novel.length} NEW ungated email send(s):\n`)
    for (const k of novel) {
      console.error(`  • ${k}`)
      console.error(
        `      This sendEmail/sendBatchEmails call is not preceded by an isSuppressed(...) ` +
          `check in its function. Add the suppression chokepoint (lib/crm/suppressions.ts):\n` +
          `        const gate = await isSuppressed(personId, 'email')\n` +
          `        if (gate.suppressed) return // skip — honors the consent record\n` +
          `      An internal/transactional send (broker alert, admin notice) with no lead ` +
          `recipient may instead be recorded in scripts/email-send-gated-baseline.json.\n`,
      )
    }
    console.error('  The baseline is a ratchet. It may only shrink. Gate the send. Do not add to the baseline.')
    process.exit(1)
  }

  if (fixed.length) {
    console.log('✓ email-send-gated: these baseline sites are now gated. Prune them from the baseline:')
    for (const k of fixed) console.log(`    - ${k}`)
  }
  console.log(
    `✓ email-send-gated: all ${found.length} ungated send site(s) are in the allowlist baseline; ` +
      `no new ungated sends. Every lead-facing send is suppression-checked.`,
  )
}
