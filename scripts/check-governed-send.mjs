#!/usr/bin/env node
/**
 * check-governed-send.mjs — G56, the send-chokepoint gate (admin rebuild §A4).
 *
 * Every outbound message must route through the governed layer at lib/comms/
 * (sendGovernedSms / sendGovernedEmail), which enforces hard-stop tags →
 * channel suppression (fail closed) → quiet hours (SMS) → idempotency →
 * provider → timeline, in that order. Nothing should reach a provider rail
 * (Twilio / Gmail DWD / Resend) directly.
 *
 * This gate scans app/ + lib/ for DIRECT provider-rail call sites:
 *
 *   sendSms( / sendSmsViaMessagingService(   — lib/crm/twilio rails
 *   sendGroupMms(                            — lib/crm/twilio-conversations rail
 *   .messages.create(                        — a raw Twilio client
 *   sendCrmEmail(                            — lib/crm/gmail rail
 *   sendEmail( / sendBatchEmails(            — lib/resend rails
 *
 * ALLOWLISTED (never call sites): lib/comms/** (the chokepoint itself) and the
 * rail-defining modules (lib/crm/twilio.ts, lib/crm/twilio-conversations.ts,
 * lib/crm/gmail.ts, lib/resend.ts).
 *
 * It is a RATCHET over scripts/governed-send-baseline.json (per-file counts —
 * line-drift-proof). The count for a file may only SHRINK; a NEW file with a
 * direct send, or a count increase in an existing file, fails the build. The
 * fix is always the same: call sendGovernedSms / sendGovernedEmail instead.
 *
 * Usage:
 *   node scripts/check-governed-send.mjs                    # check against baseline
 *   node scripts/check-governed-send.mjs --report           # list every site with lines
 *   node scripts/check-governed-send.mjs --write-baseline   # regenerate the baseline
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = process.cwd()
const SCAN_DIRS = ['app', 'lib']
const BASELINE_PATH = join(ROOT, 'scripts', 'governed-send-baseline.json')

/** Named provider-rail functions whose direct invocation is gated. */
const SEND_FNS = [
  'sendSms',
  'sendSmsViaMessagingService',
  'sendGroupMms',
  'sendCrmEmail',
  'sendEmail',
  'sendBatchEmails',
]

/**
 * The chokepoint and the rail-defining modules — the only places allowed to
 * touch a provider. Everything else must call lib/comms.
 */
const ALLOWED = [
  /^lib\/comms\//,
  /^lib\/crm\/twilio\.ts$/,
  /^lib\/crm\/twilio-conversations\.ts$/,
  /^lib\/crm\/gmail\.ts$/,
  /^lib\/resend\.ts$/,
]

const isSourceFile = (p) => /\.(ts|tsx)$/.test(p) && !/\.test\.(ts|tsx)$/.test(p) && !/\.d\.ts$/.test(p)
const isAllowed = (rel) => ALLOWED.some((re) => re.test(rel))

/**
 * Senders that can only ever reach an INTERNAL BROKER, never a lead.
 *
 * WHY THIS EXISTS (2026-08-02): the chokepoint is keyed on a CRM person.
 * `sendGovernedSms` calls `getSendTarget(req.personId)` and resolves the number
 * from `crm_people`; `checkSendGuards` applies hard-stop tags, channel
 * suppression and quiet hours. Every one of those is a CONSUMER protection. A
 * broker's own cell is not a `crm_people` row and has no opt-out state, so the
 * chokepoint cannot serve these sends — routing them through it would fail at
 * the recipient stage, not merely be redundant.
 *
 * The gate previously said "the fix is always the same: call sendGovernedSms",
 * which is true for lead-facing sends and has no answer for internal ones. That
 * was the actual gap. Entries here need PROOF the recipient cannot be a lead,
 * not an assertion, and both current entries have it. Same mechanism and same
 * bar as EXEMPT in scripts/check-sms-link-tracking.mjs.
 */
const INTERNAL_SENDERS = new Map([
  [
    'lib/agent/send.ts',
    'broker SMS agent sender — the recipient is checked against a whitelist built from ' +
      'brokers.forward_to_cell UNION the TWILIO_FORWARD_* env vars, and ' +
      'scripts/check-broker-agent-send-safety.mjs AST-verifies both that this file applies that ' +
      'whitelist and that no other module in the agent tree calls a raw sender',
  ],
  [
    'app/api/cron/broker-agent-digest/route.ts',
    'principal-broker supervision digest — fromMailbox and to are both the broker mailbox from ' +
      'CRM_MAILBOXES (Matt to Matt). No lead recipient is reachable from this route',
  ],
])

/**
 * Blank out comments while preserving line count + column positions, so a
 * `sendEmail(` mentioned in a doc comment is never mistaken for a call site.
 * Same implementation as scripts/check-email-send-gated.mjs (house style).
 */
function stripComments(source) {
  let out = ''
  let i = 0
  const n = source.length
  let inLine = false
  let inBlock = false
  let inStr = null
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

// A call: the rail function as a whole word immediately followed by `(`, NOT
// preceded by `.` (a method on something else) or a word char (part of a longer
// name like sendCrmEmailAction). Definitions live in allowlisted files only.
const CALL_RE = new RegExp(`(^|[^.\\w$])(${SEND_FNS.join('|')})\\s*\\(`)
// A raw Twilio REST client bypassing even the lib/crm/twilio helpers. The
// receiver is captured so an identically-named method on a DIFFERENT client can
// be told apart — see anthropicReceivers below.
const RAW_TWILIO_RE = /(?:^|[^.\w$])([A-Za-z_$][\w$]*)\s*\.messages\s*\.create\s*\(/

/**
 * Identifiers in this source that hold an ANTHROPIC client.
 *
 * WHY (2026-08-02): `anthropic.messages.create()` and `twilioClient.messages
 * .create()` are spelled identically. This gate matched the bare method and
 * reported five Anthropic Messages API calls as un-governed SMS sends — the
 * broker agent's runtime, its law and asset tools, and the marketing-brain
 * producer runtime, none of which import twilio at all. As the codebase uses
 * more of the Messages API this misfires more often, and a gate that cries wolf
 * on the AI call path is a gate people start ignoring.
 *
 * Two signals, both conservative: a binding created from the Anthropic SDK, and
 * (for receivers passed in as parameters) a file that imports the Anthropic SDK
 * and never imports twilio. A file doing BOTH still has its twilio call flagged,
 * because the binding set only excuses the receivers it can actually prove.
 */
function anthropicReceivers(source) {
  const names = new Set()
  const bind =
    /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:await\s+)?(?:new\s+Anthropic\b|createAnthropic\s*\()/g
  let m
  while ((m = bind.exec(source))) names.add(m[1])

  const importsAnthropic = /from\s+['"]@anthropic-ai\/sdk['"]|from\s+['"]@\/lib\/ai\/anthropic['"]/.test(source)
  const importsTwilio = /from\s+['"]twilio['"]|from\s+['"]@\/lib\/crm\/twilio['"]/.test(source)
  return { names, anthropicOnlyFile: importsAnthropic && !importsTwilio }
}

/** Find every direct-send call site in one (comment-stripped) source. */
export function findSendSites(source) {
  const lines = source.split('\n')
  const { names, anthropicOnlyFile } = anthropicReceivers(source)
  const sites = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const m = CALL_RE.exec(line)
    if (m) {
      sites.push({ line: i + 1, fn: m[2] })
      continue
    }
    const raw = RAW_TWILIO_RE.exec(line)
    if (raw) {
      const receiver = raw[1]
      if (names.has(receiver) || anthropicOnlyFile) continue
      sites.push({ line: i + 1, fn: '.messages.create' })
    }
  }
  return sites
}

function scanRepo() {
  /** @type {Record<string, {line:number, fn:string}[]>} */
  const byFile = {}
  for (const d of SCAN_DIRS) {
    const dir = join(ROOT, d)
    if (!existsSync(dir) || !statSync(dir).isDirectory()) continue
    for (const abs of walk(dir)) {
      const rel = relative(ROOT, abs).split('\\').join('/')
      if (isAllowed(rel)) continue
      const sites = findSendSites(stripComments(readFileSync(abs, 'utf8')))
      if (sites.length) byFile[rel] = sites
    }
  }
  return byFile
}

function loadBaseline() {
  if (!existsSync(BASELINE_PATH)) return { files: {} }
  try {
    return JSON.parse(readFileSync(BASELINE_PATH, 'utf8'))
  } catch (e) {
    console.error(`✗ governed-send: cannot parse ${relative(ROOT, BASELINE_PATH)}: ${e.message}`)
    process.exit(1)
  }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (isMain) {
  const write = process.argv.includes('--write-baseline') || process.argv.includes('--write')
  const report = process.argv.includes('--report')
  const byFile = scanRepo()
  const counts = Object.fromEntries(
    Object.entries(byFile)
      .map(([f, sites]) => [f, sites.length])
      .sort(([a], [b]) => (a < b ? -1 : 1)),
  )

  if (report) {
    for (const [f, sites] of Object.entries(byFile).sort(([a], [b]) => (a < b ? -1 : 1))) {
      for (const s of sites) console.log(`${f}:${s.line}  ${s.fn}()`)
    }
    console.log(`\n${Object.values(counts).reduce((a, b) => a + b, 0)} direct-send site(s) in ${Object.keys(counts).length} file(s).`)
    process.exit(0)
  }

  if (write) {
    const out = {
      $comment:
        'Ratchet baseline for check-governed-send.mjs (G56, admin rebuild §A4). Each key is a ' +
        'file with DIRECT provider-rail call sites (sendSms / sendSmsViaMessagingService / ' +
        'sendGroupMms / sendCrmEmail / sendEmail / sendBatchEmails / raw .messages.create) and the ' +
        'value is the call-site count. Counts may only SHRINK. Route a send through ' +
        'lib/comms/sendGovernedSms or sendGovernedEmail and regenerate with: ' +
        'node scripts/check-governed-send.mjs --write-baseline. NEVER hand-add an entry or bump a count.',
      files: counts,
    }
    writeFileSync(BASELINE_PATH, JSON.stringify(out, null, 2) + '\n')
    console.log(
      `✓ governed-send: wrote ${Object.keys(counts).length} file(s) / ` +
        `${Object.values(counts).reduce((a, b) => a + b, 0)} site(s) to ${relative(ROOT, BASELINE_PATH)}`,
    )
    process.exit(0)
  }

  const baseline = loadBaseline().files ?? {}
  const failures = []
  for (const [f, count] of Object.entries(counts)) {
    if (INTERNAL_SENDERS.has(f)) continue
    const allowed = baseline[f]
    if (allowed === undefined) {
      failures.push(
        `${f}: ${count} NEW direct-send call site(s) — this file is not in the baseline.\n` +
          `    ${byFile[f].map((s) => `line ${s.line} ${s.fn}()`).join(', ')}`,
      )
    } else if (count > allowed) {
      failures.push(
        `${f}: direct-send call sites grew ${allowed} → ${count} (ratchet may only shrink).\n` +
          `    ${byFile[f].map((s) => `line ${s.line} ${s.fn}()`).join(', ')}`,
      )
    }
  }

  if (failures.length) {
    console.error(`\n✗ governed-send (G56): ${failures.length} violation(s):\n`)
    for (const f of failures) console.error(`  • ${f}\n`)
    console.error(
      '  Every outbound send must route through the governed chokepoint:\n' +
        "    lib/comms/sendGovernedSms  — hard-stop → suppression → quiet hours → idempotency → Twilio\n" +
        "    lib/comms/sendGovernedEmail — hard-stop → suppression → idempotency → Gmail/Resend\n" +
        '  Do NOT call a provider rail directly and do NOT edit the baseline by hand.',
    )
    process.exit(1)
  }

  const shrunk = Object.entries(baseline).filter(([f, c]) => (counts[f] ?? 0) < c)
  if (shrunk.length) {
    console.log('✓ governed-send: these files now have FEWER direct sends than the baseline — lock the win:')
    for (const [f, c] of shrunk) console.log(`    - ${f}: ${c} → ${counts[f] ?? 0}`)
    console.log('  Regenerate: node scripts/check-governed-send.mjs --write-baseline')
  }
  console.log(
    `✓ governed-send (G56): ${Object.values(counts).reduce((a, b) => a + b, 0)} direct-send site(s) ` +
      `across ${Object.keys(counts).length} file(s), all within the ratchet baseline. No new direct provider calls.`,
  )
}
