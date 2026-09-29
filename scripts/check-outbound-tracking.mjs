#!/usr/bin/env node
/**
 * check-outbound-tracking.mjs (ci:outbound-tracking)
 *
 * Purpose. Matt's standing order: every outbound email (CMA first-contact,
 * CMA letters, market reports, drips and sequences, newsletters, and any
 * other email to a lead, client or homeowner) gets the same link wrap and
 * the same open pixel. This gate checks the link and the pixel. It does not
 * change copy and it does not change runtime behavior. Delivered-timeline
 * rows, the link id inside the click token, and visit stitching are owned
 * by other work and are not asserted here.
 *
 * Registry. scripts/outbound-tracking-registry.json names every outbound
 * template and every internal send this scanner is allowed to ignore. Each
 * template has an id, a file, the builder or send function, a kind, and
 * check: "render" or "static".
 *
 * Render vs static.
 *   Render is the default. The gate calls the same builder the production
 *   send uses, then the same wrap that send applies (attributeOutbound,
 *   instrumentEmailHtml, or prepareDeliverableEmail in the production
 *   order). Fixture data only. Env is pinned before those modules load
 *   (NEXT_PUBLIC_SITE_URL, EMAIL_TRACKING_SECRET, NODE_ENV=test) so tokens
 *   are deterministic and nothing is signed with the insecure prod fallback.
 *   No network and no database. scripts/outbound-tracking-loader.mjs loads
 *   the builders as ESM via esbuild (tsx treats .ts as CommonJS in this repo
 *   and Node then require()s the file in a cycle). Imports of the data layer
 *   and of app/ server actions are stubbed so the module can finish loading.
 *   The function the gate calls is still the production builder, and the wrap
 *   is still attributeOutbound / instrumentEmailHtml / prepareDeliverableEmail.
 *   Static is only where the builder is not callable without the database
 *   or a PDF (BPO: buildBody is not exported and sendBpoToLead renders a
 *   PDF). The static scan asserts the send function calls the click-wrap
 *   helper. The registry entry says why.
 *
 * Exceptions. An http(s) href must point at {site}/api/track/e/click with a
 * non-empty t token. The only hrefs that may stay raw are tel:, mailto:, and
 * the Oregon Initial Agency Disclosure Pamphlet URL (the constant in
 * lib/crm/email-signature.ts, also matched by the pamphlet path). Image
 * src values are not click links. Unsubscribe, /sign, and other compliance
 * or private links that the instrumenter leaves raw are failures, not
 * exceptions.
 *
 * Baseline ratchet. scripts/outbound-tracking-baseline.json lists templates
 * that fail today, each with the exact reason set (which hrefs are
 * untracked, pixel missing, wrap helper missing). A new reason fails the
 * gate. A baselined reason that no longer reproduces fails the gate too, so
 * the file can only shrink. A render throw, a missing registry function, and
 * an unregistered sender are hard failures and are not baseline-able.
 * There is no --write that adds baseline rows.
 *
 * Unregistered senders. app/ and lib/ are scanned for sendEmail,
 * sendBatchEmails, sendGmailMessage, sendCrmEmail, and Resend .emails.send.
 * The enclosing function must be a registry template or a named exclusion.
 *
 * Usage:
 *   node scripts/check-outbound-tracking.mjs
 *   node scripts/check-outbound-tracking.mjs --report
 *   node scripts/check-outbound-tracking.mjs --json
 *   node scripts/check-outbound-tracking.mjs --report --json
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = process.cwd()
const REGISTRY_PATH = join(ROOT, 'scripts', 'outbound-tracking-registry.json')
const BASELINE_PATH = join(ROOT, 'scripts', 'outbound-tracking-baseline.json')
const SITE_ORIGIN = 'https://ryan-realty.com'
const PERSON_ID = 4242
const PAMPHLET_PATH = '/docs/oregon-initial-agency-disclosure-pamphlet.pdf'

export const SENDER_FNS = ['sendEmail', 'sendBatchEmails', 'sendGmailMessage', 'sendCrmEmail']

const REGEX_WORDS = new Set([
  'return', 'typeof', 'case', 'void', 'delete', 'throw', 'await', 'yield',
  'else', 'in', 'of', 'do', 'instanceof', 'new',
])
const CONTROL_WORDS = new Set(['if', 'for', 'while', 'switch', 'catch', 'else', 'do', 'try', 'finally', 'with'])

function prevSig(out) {
  let j = out.length - 1
  while (j >= 0 && (out[j] === ' ' || out[j] === '\n')) j--
  if (j < 0) return ''
  if (/[A-Za-z0-9_$]/.test(out[j])) {
    let k = j
    while (k >= 0 && /[A-Za-z0-9_$]/.test(out[k])) k--
    return out.slice(k + 1, j + 1)
  }
  return out[j]
}

function isRegexStart(prev) {
  if (!prev) return true
  if (REGEX_WORDS.has(prev)) return true
  if (prev.length !== 1) return false
  return '([{:;,=!?&|~^%)]'.includes(prev)
}

/**
 * Blank comments, strings, template text, and regex literals so a brace walk
 * and a call scan see only code. Template interpolations stay as code.
 * Length is preserved (newlines kept) so indexes still address the source.
 */
export function maskCode(source) {
  let out = ''
  let i = 0
  const n = source.length
  const stack = [{ kind: 'code', depth: 0 }]
  const top = () => stack[stack.length - 1]
  while (i < n) {
    const ch = source[i]
    const next = i + 1 < n ? source[i + 1] : ''
    const kind = top().kind
    if (kind === 'line') {
      if (ch === '\n') {
        stack.pop()
        out += '\n'
      } else out += ' '
      i++
      continue
    }
    if (kind === 'block') {
      if (ch === '*' && next === '/') {
        stack.pop()
        out += '  '
        i += 2
        continue
      }
      out += ch === '\n' ? '\n' : ' '
      i++
      continue
    }
    if (kind === 'sq' || kind === 'dq') {
      const q = kind === 'sq' ? "'" : '"'
      if (ch === '\\') {
        out += '  '
        i += 2
        continue
      }
      if (ch === q) {
        stack.pop()
        out += ' '
        i++
        continue
      }
      out += ch === '\n' ? '\n' : ' '
      i++
      continue
    }
    if (kind === 'tmpl') {
      if (ch === '\\') {
        out += '  '
        i += 2
        continue
      }
      if (ch === '`') {
        stack.pop()
        out += ' '
        i++
        continue
      }
      if (ch === '$' && next === '{') {
        stack.push({ kind: 'interp', depth: 0 })
        out += '  '
        i += 2
        continue
      }
      out += ch === '\n' ? '\n' : ' '
      i++
      continue
    }
    if (kind === 'regex') {
      if (ch === '\\') {
        out += '  '
        i += 2
        continue
      }
      if (ch === '\n') {
        stack.pop()
        out += '\n'
        i++
        continue
      }
      if (ch === '[') {
        out += ' '
        i++
        while (i < n && source[i] !== '\n') {
          const c = source[i]
          if (c === '\\') {
            out += '  '
            i += 2
            continue
          }
          out += ' '
          i++
          if (c === ']') break
        }
        continue
      }
      if (ch === '/') {
        stack.pop()
        out += ' '
        i++
        while (i < n && /[a-z]/i.test(source[i])) {
          out += ' '
          i++
        }
        continue
      }
      out += ' '
      i++
      continue
    }
    if (kind === 'interp' && ch === '}') {
      if (top().depth === 0) {
        stack.pop()
        out += ' '
        i++
        continue
      }
      top().depth--
      out += '}'
      i++
      continue
    }
    if ((kind === 'code' || kind === 'interp') && ch === '{') {
      if (kind === 'interp') top().depth++
      out += '{'
      i++
      continue
    }
    if (ch === '/' && next === '/') {
      stack.push({ kind: 'line', depth: 0 })
      out += '  '
      i += 2
      continue
    }
    if (ch === '/' && next === '*') {
      stack.push({ kind: 'block', depth: 0 })
      out += '  '
      i += 2
      continue
    }
    if (ch === "'") {
      stack.push({ kind: 'sq', depth: 0 })
      out += ' '
      i++
      continue
    }
    if (ch === '"') {
      stack.push({ kind: 'dq', depth: 0 })
      out += ' '
      i++
      continue
    }
    if (ch === '`') {
      stack.push({ kind: 'tmpl', depth: 0 })
      out += ' '
      i++
      continue
    }
    if (ch === '/' && isRegexStart(prevSig(out))) {
      stack.push({ kind: 'regex', depth: 0 })
      out += ' '
      i++
      continue
    }
    out += ch
    i++
  }
  return out
}

function openingBraceBefore(mask, from) {
  let depth = 0
  for (let i = from; i >= 0; i--) {
    const ch = mask[i]
    if (ch === '}') depth++
    else if (ch === '{') {
      if (depth === 0) return i
      depth--
    }
  }
  return -1
}

function skipWsBack(mask, i) {
  while (i >= 0 && (mask[i] === ' ' || mask[i] === '\n' || mask[i] === '\t' || mask[i] === '\r')) i--
  return i
}

function matchingOpen(mask, closeIndex, openCh, closeCh) {
  let depth = 0
  for (let i = closeIndex; i >= 0; i--) {
    const ch = mask[i]
    if (ch === closeCh) depth++
    else if (ch === openCh) {
      depth--
      if (depth === 0) return i
    }
  }
  return -1
}

function matchingClose(mask, openIndex) {
  let depth = 0
  for (let i = openIndex; i < mask.length; i++) {
    const ch = mask[i]
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) return i
    }
  }
  return -1
}

/**
 * Walk back from the last character of a return type (or from a ')')
 * to the ')' that closes the parameter list. A '{' / '}' inside
 * `Promise<{ ... }>` is part of the type, not a function body.
 * `=>` is an arrow, not a generic close.
 */
function walkToParamClose(mask, start) {
  let paren = 0
  let braceD = 0
  let bracket = 0
  let angle = 0
  for (let i = start, guard = 0; i >= 0 && guard < 8000; i--, guard++) {
    const ch = mask[i]
    if (ch === '>' && i >= 1 && mask[i - 1] === '=') {
      i--
      continue
    }
    if (ch === ')') {
      if (paren === 0 && braceD === 0 && bracket === 0 && angle === 0) return { kind: 'paren', close: i }
      paren++
      continue
    }
    if (ch === '(') {
      if (paren === 0 && braceD === 0 && bracket === 0 && angle === 0) return null
      if (paren > 0) paren--
      continue
    }
    if (ch === '}') {
      braceD++
      continue
    }
    if (ch === '{') {
      if (braceD === 0 && paren === 0 && bracket === 0 && angle === 0) return null
      if (braceD > 0) braceD--
      continue
    }
    if (ch === ']') {
      bracket++
      continue
    }
    if (ch === '[') {
      if (bracket === 0 && paren === 0 && braceD === 0 && angle === 0) return null
      if (bracket > 0) bracket--
      continue
    }
    if (ch === '>') {
      angle++
      continue
    }
    if (ch === '<') {
      if (angle > 0) angle--
      continue
    }
    if (paren === 0 && braceD === 0 && bracket === 0 && angle === 0) {
      if (ch === '=' || ch === ';' || ch === '`') return null
    }
  }
  return null
}

function paramsBeforeArrow(mask, start) {
  const i = start
  if (i < 0) return null
  if (mask[i] === ')' || mask[i] === '>' || mask[i] === ']' || /[A-Za-z0-9_$]/.test(mask[i])) {
    const closed = walkToParamClose(mask, i)
    if (closed) return closed
  }
  if (/[A-Za-z0-9_$]/.test(mask[i])) {
    let j = i
    while (j >= 0 && /[A-Za-z0-9_$]/.test(mask[j])) j--
    return { kind: 'ident', start: j + 1 }
  }
  return walkToParamClose(mask, i)
}

function nameFromArrow(source, mask, gtIndex) {
  let i = skipWsBack(mask, gtIndex - 2)
  const landed = paramsBeforeArrow(mask, i)
  if (!landed) return null
  if (landed.kind === 'ident') i = skipWsBack(mask, landed.start - 1)
  else {
    const open = matchingOpen(mask, landed.close, '(', ')')
    if (open < 0) return null
    i = skipWsBack(mask, open - 1)
    if (i >= 0 && mask[i] === '>') {
      let angle = 0
      for (; i >= 0; i--) {
        if (mask[i] === '>') angle++
        else if (mask[i] === '<') {
          angle--
          if (angle === 0) {
            i = skipWsBack(mask, i - 1)
            break
          }
        }
      }
    }
  }
  if (i >= 0 && /[A-Za-z0-9_$]/.test(mask[i])) {
    let k = i
    while (k >= 0 && /[A-Za-z0-9_$]/.test(mask[k])) k--
    if (mask.slice(k + 1, i + 1) === 'async') i = skipWsBack(mask, k)
  }
  if (i < 0 || mask[i] !== '=') return null
  const window = source.slice(Math.max(0, i - 200), i)
  const named = window.match(/(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*$/)
  return named ? named[1] : null
}

function nameFromDeclarator(header) {
  const h = header.replace(/\s+/g, ' ').trim()
  if (!h) return null
  const tail = h.split(' ').pop() || ''
  if (CONTROL_WORDS.has(tail)) return null
  let m = h.match(/(?:export\s+(?:default\s+)?)?(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)\s*(?:<[\s\S]*?>)?\s*$/)
  if (m) return m[1]
  m = h.match(/(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s+)?(?:function\s*\*?\s*(?:[A-Za-z_$][\w$]*)?)?\s*$/)
  if (m) return m[1]
  m = h.match(/(?:async\s+)?(?:get\s+|set\s+)?([A-Za-z_$][\w$]*)\s*(?:<[\s\S]*?>)?\s*$/)
  if (m && !CONTROL_WORDS.has(m[1]) && m[1] !== 'function' && m[1] !== 'return' && m[1] !== 'async') return m[1]
  return null
}

/** The '{' of a function body, not a '{' inside a TypeScript return type. */
function isBodyBrace(mask, brace, closeParen) {
  let paren = 0
  let braceD = 0
  let bracket = 0
  let angle = 0
  for (let i = closeParen + 1; i < brace; i++) {
    const ch = mask[i]
    if (ch === '(') paren++
    else if (ch === ')') { if (paren > 0) paren-- }
    else if (ch === '{') braceD++
    else if (ch === '}') { if (braceD > 0) braceD-- }
    else if (ch === '[') bracket++
    else if (ch === ']') { if (bracket > 0) bracket-- }
    else if (ch === '<') angle++
    else if (ch === '>') { if (angle > 0) angle-- }
  }
  return paren === 0 && braceD === 0 && bracket === 0 && angle === 0
}

export function keywordBefore(mask, brace) {
  let i = skipWsBack(mask, brace - 1)
  if (i < 0 || !/[A-Za-z0-9_$]/.test(mask[i])) return ''
  let k = i
  while (k >= 0 && /[A-Za-z0-9_$]/.test(mask[k])) k--
  return mask.slice(k + 1, i + 1)
}

function nameOwningBrace(source, mask, brace) {
  // `try {` / `else {` sit after an unrelated call. Do not steal that call's name.
  if (CONTROL_WORDS.has(keywordBefore(mask, brace))) return null
  let i = skipWsBack(mask, brace - 1)
  if (i < 0) return null
  if (mask[i] === '>' && i >= 1 && mask[i - 1] === '=') return nameFromArrow(source, mask, i)
  const found = walkToParamClose(mask, i)
  if (!found) return null
  if (!isBodyBrace(mask, brace, found.close)) return null
  const open = matchingOpen(mask, found.close, '(', ')')
  if (open < 0) return null
  let start = Math.max(0, open - 500)
  let paren = 0
  for (let k = open - 1; k >= start; k--) {
    const ch = mask[k]
    if (ch === ')') paren++
    else if (ch === '(') { if (paren > 0) paren-- }
    else if (paren === 0 && (ch === '{' || ch === '}' || ch === ';')) {
      start = k + 1
      break
    }
  }
  return nameFromDeclarator(source.slice(start, open))
}

/** Name of the function that contains `index`, skipping if/for/while and anonymous arrows. */
export function enclosingFunctionName(source, index) {
  const mask = maskCode(source)
  let from = index
  for (let guard = 0; guard < 80; guard++) {
    const brace = openingBraceBefore(mask, from)
    if (brace < 0) return '(top)'
    const named = nameOwningBrace(source, mask, brace)
    if (named) return named
    from = brace - 1
  }
  return '(top)'
}

function isFnDefinition(mask, nameIndex) {
  const before = mask.slice(Math.max(0, nameIndex - 40), nameIndex)
  return /\bfunction\s*$/.test(before)
}

/**
 * Call sites of the shared send functions. Definitions are skipped.
 * `.emails.send` is reported even when it sits inside `sendEmail`.
 * One record per call. Callers dedupe by enclosing function.
 */
export function findSendCalls(source) {
  const mask = maskCode(source)
  const calls = []
  const named = /(?:^|[^\w$])(sendEmail|sendBatchEmails|sendGmailMessage|sendCrmEmail)\s*\(/g
  let m
  while ((m = named.exec(mask))) {
    const name = m[1]
    const nameIndex = m.index + m[0].lastIndexOf(name)
    if (isFnDefinition(mask, nameIndex)) continue
    calls.push({
      fn: name,
      index: nameIndex,
      line: source.slice(0, nameIndex).split('\n').length,
      enclosing: enclosingFunctionName(source, nameIndex),
    })
  }
  const resend = /\.emails\s*\.\s*send\s*\(/g
  while ((m = resend.exec(mask))) {
    const nameIndex = m.index + m[0].lastIndexOf('send')
    calls.push({
      fn: '.emails.send',
      index: nameIndex,
      line: source.slice(0, nameIndex).split('\n').length,
      enclosing: enclosingFunctionName(source, nameIndex),
    })
  }
  return calls
}

export function decodeHtmlHref(href) {
  return String(href)
    .replace(/&(?:quot|#34|#x22);/gi, '"')
    .replace(/&(?:apos|#39|#x27);/gi, "'")
    .replace(/&(?:lt|#60|#x3c);/gi, '<')
    .replace(/&(?:gt|#62|#x3e);/gi, '>')
    .replace(/&(?:amp|#38|#x26);/gi, '&')
    .trim()
}

function pamphletUrls(extra) {
  const list = Array.isArray(extra) ? extra : []
  return list.filter(Boolean)
}

/**
 * tracked | tel | mailto | pamphlet | untracked | skip
 * `siteOrigin` is the production origin the click tracker must use.
 * A pamphlet href that has already been wrapped counts as tracked.
 */
export function classifyHref(raw, ctx) {
  const href = decodeHtmlHref(raw)
  if (!href || href.startsWith('#')) return 'skip'
  const lower = href.toLowerCase()
  if (lower.startsWith('tel:')) return 'tel'
  if (lower.startsWith('mailto:')) return 'mailto'
  let url
  try {
    url = new URL(href, ctx.siteOrigin)
  } catch {
    return 'untracked'
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return 'untracked'
  const site = new URL(ctx.siteOrigin)
  if (url.origin === site.origin && url.pathname === '/api/track/e/click' && (url.searchParams.get('t') || '').length > 0) {
    return 'tracked'
  }
  const pamphlets = pamphletUrls(ctx.pamphletUrls)
  if (pamphlets.some((p) => href === p || href.startsWith(p + '?') || href.startsWith(p + '#'))) return 'pamphlet'
  if (url.pathname === PAMPHLET_PATH || url.pathname.endsWith(PAMPHLET_PATH)) return 'pamphlet'
  return 'untracked'
}

export function extractHrefs(html) {
  const out = []
  const re = /\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi
  let m
  while ((m = re.exec(String(html)))) out.push(m[1] ?? m[2] ?? m[3] ?? '')
  return out
}

export function hasOpenPixel(html, siteOrigin) {
  const site = new URL(siteOrigin)
  const re = /<img\b[^>]*>/gi
  let m
  while ((m = re.exec(String(html)))) {
    const tag = m[0]
    const srcm = /\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(tag)
    const src = decodeHtmlHref(srcm?.[1] ?? srcm?.[2] ?? srcm?.[3] ?? '')
    if (!src) continue
    let url
    try {
      url = new URL(src, siteOrigin)
    } catch {
      continue
    }
    if (url.origin === site.origin && url.pathname === '/api/track/e/open' && (url.searchParams.get('t') || '').length > 0) {
      return true
    }
  }
  return false
}

/** Sorted unique failure reasons for one rendered HTML document. */
export function evaluateHtml(html, ctx) {
  const reasons = []
  const seen = new Set()
  for (const raw of extractHrefs(html)) {
    if (classifyHref(raw, ctx) !== 'untracked') continue
    const reason = `untracked href: ${decodeHtmlHref(raw)}`
    if (seen.has(reason)) continue
    seen.add(reason)
    reasons.push(reason)
  }
  if (!hasOpenPixel(html, ctx.siteOrigin)) {
    reasons.push('open pixel missing: no img src at /api/track/e/open with a t token')
  }
  return reasons.sort()
}

/**
 * Compare one template's current reasons to its baseline list.
 * baseline null means the id is not listed.
 *   pass      no reasons, not listed
 *   baselined reason set matches exactly
 *   novel     reasons, and the id is not listed
 *   extra     a reason the baseline does not have (may also have cleared some)
 *   stale     the current set is a proper subset, including empty (shrink it)
 */
export function judgeReasons(current, baseline) {
  const cur = [...new Set(current)].sort()
  if (baseline == null) {
    if (cur.length === 0) return { status: 'pass', problems: [] }
    return { status: 'novel', problems: cur.map((r) => `new failure: ${r}`) }
  }
  const base = [...new Set(baseline)].sort()
  const extra = cur.filter((r) => !base.includes(r))
  const missing = base.filter((r) => !cur.includes(r))
  if (extra.length === 0 && missing.length === 0) return { status: 'baselined', problems: [] }
  const problems = []
  for (const r of extra) problems.push(`new failure: ${r}`)
  if (cur.length === 0) problems.push('baseline entry now passes and must be removed')
  else for (const r of missing) problems.push(`baseline reason cleared and must be removed: ${r}`)
  return { status: extra.length ? 'extra' : 'stale', problems }
}

function identRe(name) {
  return String(name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function functionBody(source, name) {
  const mask = maskCode(source)
  const re = new RegExp(`(?:function\\s+${identRe(name)}\\b|(?:const|let|var)\\s+${identRe(name)}\\s*=)`)
  const m = re.exec(mask)
  if (!m) return null
  let best = -1
  let bestEnd = -1
  for (let i = m.index; i < mask.length; i++) {
    if (mask[i] !== '{') continue
    if (nameOwningBrace(source, mask, i) !== name) continue
    const end = matchingClose(mask, i)
    if (end > bestEnd) {
      best = i
      bestEnd = end
    }
  }
  if (best < 0 || bestEnd < 0) return null
  return source.slice(best, bestEnd + 1)
}

export function sourceHasFunction(source, name) {
  const re = new RegExp(`(?:function\\s+${identRe(name)}\\b|(?:const|let|var)\\s+${identRe(name)}\\s*=)`)
  return re.test(maskCode(source))
}

function isSourceFile(name) {
  return /\.(ts|tsx)$/.test(name) && !/\.(test|spec)\.(ts|tsx)$/.test(name) && !name.endsWith('.d.ts')
}

export function listSourceFiles(root) {
  const out = []
  const walk = (dir) => {
    let entries
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const ent of entries) {
      if (ent.name === 'node_modules' || ent.name === '.next' || ent.name.startsWith('.')) continue
      if (ent.name === '__tests__' || ent.name === '__mocks__') continue
      const p = join(dir, ent.name)
      if (ent.isDirectory()) walk(p)
      else if (ent.isFile() && isSourceFile(ent.name)) out.push(p)
    }
  }
  walk(join(root, 'app'))
  walk(join(root, 'lib'))
  return out
}

export function scanSenders(root) {
  const map = new Map()
  for (const abs of listSourceFiles(root)) {
    const file = relative(root, abs).split('\\').join('/')
    let source
    try {
      source = readFileSync(abs, 'utf8')
    } catch {
      continue
    }
    for (const call of findSendCalls(source)) {
      const key = `${file}::${call.enclosing}`
      if (!map.has(key)) map.set(key, { file, fn: call.enclosing, lines: [], callees: [] })
      const row = map.get(key)
      row.lines.push(call.line)
      if (!row.callees.includes(call.fn)) row.callees.push(call.fn)
    }
  }
  return [...map.values()].sort((a, b) => (a.file + a.fn).localeCompare(b.file + b.fn))
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function coverageKey(file, fn) {
  return `${file}::${fn}`
}

const MATT_BROKER = {
  slug: 'matthew-ryan',
  fullName: 'Matt Ryan',
  title: 'Owner & Principal Broker',
  email: 'matt@ryan-realty.com',
  phoneDirect: '541.703.3095',
  phoneFub: null,
  headshotPng: '/images/brokers/ryan-matt.png',
  headshotJpg: '/images/brokers/ryan-matt.jpg',
  licenseNumber: null,
  bio: null,
  isPrincipal: true,
  emailSignature: null,
  gmailSignatureHtml: null,
}

function trackOpts(emailKey, broker = 'matt') {
  return {
    brokerSlug: broker,
    personId: PERSON_ID,
    emailKey,
    label: 'Outbound tracking gate',
    broker,
  }
}

function areaBlock() {
  return {
    twelveMonthSource: 'market-truth',
    slug: 'bend',
    areaLabel: 'Bend',
    geoType: 'city',
    medianPrice: 750000,
    activeListings: 420,
    soldLast12mo: 1200,
    monthsOfSupply: 4.2,
    marketVerdict: 'balanced',
    domMedian: 38,
    yoyPct: 2.1,
    marketHealthLabel: 'Warm',
    refreshedAt: '2026-06-24T00:00:00.000Z',
    source: 'market_pulse_live',
    href: '/cities/bend',
    trend: {
      points: [
        { medianSalePrice: 700000, endOfPeriodInventory: 400 },
        { medianSalePrice: 720000, endOfPeriodInventory: 410 },
        { medianSalePrice: 750000, endOfPeriodInventory: 420 },
      ],
      latestMonthLabel: 'June',
      prevMonthLabel: 'May',
      latestMedianPrice: 750000,
      prevMedianPrice: 720000,
      momPricePct: 4.2,
      latestInventory: 420,
      momInventoryDelta: 10,
      latestDom: 38,
      momDomDelta: -2,
    },
  }
}

function cmaFacts(origin) {
  const place = origin === 'place-page'
    ? {
        subdivision: {
          label: 'Northwest Crossing',
          href: '/subdivisions/northwest-crossing',
          closed12mo: 12,
          unsold12mo: 0,
          active: 3,
          pending: 1,
          history: null,
        },
        wider: { label: 'Bend', href: '/cities/bend' },
      }
    : { subdivision: null, wider: { label: 'Bend', href: '/cities/bend' } }
  return {
    address: '123 NW Oregon Ave, Bend, OR',
    firstName: 'Casey',
    valueLow: 700000,
    valueHigh: 760000,
    recommendedList: 735000,
    lastListPrice: 749000,
    brokerName: 'Matt Ryan',
    city: 'Bend',
    cmaSlug: 'cma-gate-fixture',
    brokerSlug: 'matt',
    personId: PERSON_ID,
    place,
  }
}

function cmaContext(origin) {
  return {
    slug: 'cma-gate-fixture',
    subjectAddress: '123 NW Oregon Ave, Bend, OR',
    subjectListingKey: null,
    clientName: 'Casey Example',
    clientEmail: 'casey@example.com',
    brokerRow: {
      slug: 'matthew-ryan',
      displayName: 'Matt Ryan',
      title: 'Owner & Principal Broker',
      email: 'matt@ryan-realty.com',
      phone: '541.703.3095',
      photoUrl: null,
    },
    valueLow: 700000,
    valueHigh: 760000,
    recommendedList: 735000,
    lastListPrice: 749000,
    origin,
    facts: cmaFacts(origin),
  }
}

function signingShell(opts) {
  const button = opts.cta
    ? `<a href="${opts.cta.url}">${opts.cta.label}</a>`
    : ''
  return `<!doctype html><html><body><p>Ryan Realty</p>${opts.bodyHtml || ''}${button}<p>Ryan Realty, Bend, Oregon<br/>541.703.3095, ryan-realty.com</p></body></html>`
}

async function loadApi() {
  const { register: registerHook } = await import('node:module')
  // esbuild ESM loader, not tsx. tsx treats .ts as CommonJS here (package.json
  // has no "type": "module") and Node then require()s the file while the ESM
  // import is still evaluating (ERR_REQUIRE_CYCLE_MODULE). The loader returns
  // format "module" and stubs server-only / next/* so the real builders load
  // without a network or a database.
  registerHook(pathToFileURL(join(ROOT, 'scripts', 'outbound-tracking-loader.mjs')).href, {
    parentURL: import.meta.url,
  })
  const load = async (rel) => {
    try {
      return await import(pathToFileURL(join(ROOT, rel)).href)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      throw new Error(`failed to load ${rel}: ${msg}`)
    }
  }
  // Sequential on purpose. A parallel import of these TS modules trips
  // Node's ERR_REQUIRE_CYCLE_MODULE under tsx (CJS require of an ESM file
  // that is still evaluating). One at a time stays on the real builders.
  const links = await load('lib/crm/attributed-links.ts')
  const prepare = await load('lib/email/prepare.ts')
  const unsub = await load('lib/email/unsubscribe-token.ts')
  const market = await load('lib/crm/market-report-email.ts')
  const brokers = await load('lib/email/broker-identity.ts')
  const signature = await load('lib/crm/email-signature.ts')
  const emailBody = await load('lib/crm/email-body.ts')
  const listing = await load('lib/crm/listing-alert-email.ts')
  const newsletter = await load('lib/email-templates/newsletter-shell.ts')
  const tracking = await load('lib/email-tracking.ts')
  const cmaSend = await load('lib/cma/send.ts')
  const fsbo = await load('lib/cma/fsbo-cma-templates.ts')
  const produce = await load('lib/newsletter/produce-draft.ts')
  const queue = await load('lib/newsletter/send-queue.ts')
  return {
    attributeOutbound: links.attributeOutbound,
    prepareDeliverableEmail: prepare.prepareDeliverableEmail,
    buildUnsubscribeUrl: unsub.buildUnsubscribeUrl,
    renderMarketReportEmail: market.renderMarketReportEmail,
    shellBrokerFor: brokers.shellBrokerFor,
    buildSignature: signature.buildSignature,
    pamphletUrl: signature.AGENCY_PAMPHLET_URL,
    composeOutboundHtml: emailBody.composeOutboundHtml,
    buildListingAlertEmail: listing.buildListingAlertEmail,
    wrapNewsletterHtml: newsletter.wrapNewsletterHtml,
    instrumentEmailHtml: tracking.instrumentEmailHtml,
    buildLeadBody: cmaSend.buildLeadBody,
    composeFsbo: fsbo.composeFsboCmaFirstTouchEmail,
    emptyFsbo: fsbo.emptyFsboCmaMergeFacts,
    fsboSeed: fsbo.FSBO_CMA_FIRST_TOUCH_EMAIL_SEED,
    marketSection: produce.marketSection,
    renderForRecipient: queue.renderForRecipient,
  }
}

function gmailHtml(api, body) {
  const sig = api.buildSignature(MATT_BROKER).html
  const composed = api.composeOutboundHtml(body, sig, 'auto')
  return api.attributeOutbound(composed, trackOpts('gate:gmail'))
}

function newsletterWrap(api, bodyHtml) {
  const unsubscribeUrl = `${SITE_ORIGIN}/newsletter/unsubscribe?token=gate-fixture`
  const brokers = new Map([
    ['matt', {
      slug: 'matt',
      name: 'Matt Ryan',
      email: 'matt@ryan-realty.com',
      phone: '5417033095',
      title: 'Owner & Principal Broker',
    }],
  ])
  const rendered = api.renderForRecipient(
    {
      body_html: bodyHtml,
      body_text: 'Gate fixture',
      preview_text: 'Gate fixture',
      subject: 'Gate fixture',
      id: 'gate-issue',
    },
    { email: 'casey@example.com', broker: 'matt', subscriber_id: 'sub' },
    brokers,
    'gate-fixture',
    PERSON_ID,
  )
  return rendered.html
}

function listingHtml(api) {
  const senderBroker = api.shellBrokerFor('matt')
  return api.buildListingAlertEmail({
    searchName: 'Bend under 800k',
    filtersSummary: 'Bend',
    listings: [{
      address: '2201 NW Crossing Dr',
      city: 'Bend',
      price: 749900,
      beds: 3,
      baths: 2,
      sqft: 1800,
      photoUrl: 'https://ryan-realty.com/images/brokers/ryan-matt.jpg',
      detailUrl: 'https://ryan-realty.com/listing/2201',
    }],
    totalNewCount: 2,
    browseAllUrl: 'https://ryan-realty.com/search?city=bend',
    unsubscribeUrl: `${SITE_ORIGIN}/alerts/unsubscribe?token=gate-fixture`,
    manageUrl: null,
    senderBroker,
  })
}

function renderById(id, api) {
  if (id === 'market-report-cadence') {
    const unsubscribeUrl = api.buildUnsubscribeUrl(PERSON_ID)
    const rendered = api.renderMarketReportEmail({
      contactName: 'Casey Example',
      brokerSlug: 'matt',
      areas: [areaBlock()],
      unsubscribeUrl,
      senderBroker: api.shellBrokerFor('matt'),
    })
    const prepared = api.prepareDeliverableEmail({
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      personId: PERSON_ID,
      unsubscribeUrl,
    })
    // Production sendOneSubscriber calls attributeOutbound without `broker`.
    return api.attributeOutbound(prepared.html, {
      brokerSlug: 'matt',
      personId: PERSON_ID,
      emailKey: `market-report:gate:${PERSON_ID}`,
      label: rendered.subject,
    })
  }
  if (id === 'newsletter-drain') {
    return newsletterWrap(api, '<p>The June note. <a href="https://ryan-realty.com/search">Browse homes</a>.</p>')
  }
  if (id === 'newsletter-market-report-bulk') {
    const section = api.marketSection(
      [{ slug: 'bend', areaLabel: 'Bend', monthsOfSupply: 4.2, verdict: 'balanced', medianPrice: 750000 }],
      'Bend has 4.2 months of supply.',
    )
    return newsletterWrap(api, section)
  }
  if (id === 'newsletter-one-click') {
    const unsubscribeUrl = `${SITE_ORIGIN}/newsletter/unsubscribe?token=gate-fixture`
    const body = '<p><a href="https://ryan-realty.com/search">Browse homes</a></p>'
    const wrapped = api.wrapNewsletterHtml({
      bodyHtml: body,
      previewText: 'Gate fixture',
      unsubscribeUrl,
      senderBroker: api.shellBrokerFor('matt'),
    })
    return api.instrumentEmailHtml(wrapped, {
      personId: PERSON_ID,
      emailKey: `newsletter:gate:p${PERSON_ID}`,
      label: 'Gate fixture',
      broker: 'matt',
      ttlSeconds: 180 * 24 * 60 * 60,
    })
  }
  if (id === 'listing-alert-cron') {
    const built = listingHtml(api)
    return api.attributeOutbound(built.html, {
      ...trackOpts('listing-alert:gate'),
      fubPersonId: null,
    })
  }
  if (id === 'listing-alert-send-now') {
    const built = listingHtml(api)
    const unsubscribeUrl = `${SITE_ORIGIN}/alerts/unsubscribe?token=gate-fixture`
    const tracked = api.attributeOutbound(built.html, trackOpts('listing-alert:sendnow:gate'))
    const prepared = api.prepareDeliverableEmail({
      subject: built.subject,
      html: tracked,
      text: built.text,
      personId: PERSON_ID,
      unsubscribeUrl,
    })
    return prepared.html
  }
  if (id === 'email-cohort') {
    const body = 'Here is the search: https://ryan-realty.com/search'
    const sig = api.buildSignature(MATT_BROKER).html
    const renderedBody = api.composeOutboundHtml(body, sig, 'auto')
    const attributed = api.attributeOutbound(renderedBody, {
      brokerSlug: 'matt',
      personId: PERSON_ID,
      emailKey: 'cohort:gate',
      label: 'Gate fixture',
    })
    return api.prepareDeliverableEmail({
      subject: 'Gate fixture',
      html: attributed,
      personId: PERSON_ID,
    }).html
  }
  if (id.startsWith('cma-letter-')) {
    const origin = id.slice('cma-letter-'.length)
    const sig = api.buildSignature(MATT_BROKER)
    const body = api.buildLeadBody(cmaContext(origin), undefined, sig)
    return api.attributeOutbound(body.html, trackOpts(`cma:${origin}`))
  }
  if (id === 'fsbo-first-touch') {
    const facts = api.emptyFsbo()
    facts.ownerFirstName = 'Casey'
    facts.ownerFullName = 'Casey Example'
    facts.propertyAddress = '123 NW Oregon Ave, Bend, OR'
    facts.propertyStreet = '123 NW Oregon Ave'
    facts.propertyCity = 'Bend'
    facts.priceRangeLow = '$700,000'
    facts.priceRangeHigh = '$760,000'
    facts.suggestedListPrice = '$735,000'
    facts.calendarLink = 'https://ryan-realty.com/book?agent=matt'
    facts.agentName = 'Matt Ryan'
    facts.leadType = 'fsbo'
    return gmailHtml(api, api.composeFsbo(facts).body)
  }
  if (id === 'fsbo-first-touch-seed') {
    const body = api.fsboSeed.body
      .replaceAll('%calendar_link%', 'https://ryan-realty.com/book?agent=matt')
      .replaceAll('%contact_first_name%', 'Casey')
      .replaceAll('%agent_name%', 'Matt Ryan')
      .replaceAll('%address%', '123 NW Oregon Ave')
      .replaceAll('%customPriceRangeLow%', '$700,000')
      .replaceAll('%customPriceRangeHigh%', '$760,000')
      .replaceAll('%customSuggestedListPrice%', '$735,000')
    return gmailHtml(api, body)
  }
  if (id === 'admin-one-off') {
    // sendAdminEmail stores the admin's HTML and sendEmail wraps it through
    // instrumentLeadHtml, which calls attributeOutbound when a person is known.
    const html = '<p>Hi Casey, here is <a href="https://ryan-realty.com/search">the search</a>.</p>'
    return api.attributeOutbound(html, trackOpts('admin-one-off:gate'))
  }
  if (id === 'cma-request-confirmation') {
    const bookHref = 'https://ryan-realty.com/book?agent=matt'
    const html = `<div><p>Hi there,</p><p>Thanks for requesting a Comparative Market Analysis.</p><p><a href="${bookHref}">pick a time here</a></p><p><a href="tel:+15417033095">541.703.3095</a><br/><a href="https://ryan-realty.com">ryan-realty.com</a></p></div>`
    return api.attributeOutbound(html, trackOpts('cma-request:gate', 'matt'))
  }
  if (id === 'place-value-confirmation') {
    return gmailHtml(api, [
      'Hi there,',
      '',
      'You asked what 123 NW Oregon Ave would sell for.',
      '',
      'Want to talk it through sooner? Book a time: https://ryan-realty.com/book?agent=matt',
    ].join('\n'))
  }
  if (id === 'site-confirmation-contact' || id === 'site-confirmation-expired') {
    return gmailHtml(api, 'If you would rather just talk, pick a time that works: https://ryan-realty.com/book?agent=matt')
  }
  if (id === 'site-confirmation-alert') {
    return gmailHtml(api, [
      'The home: https://ryan-realty.com/listing/2201',
      'Pick a time whenever you want one: https://ryan-realty.com/book?agent=matt',
    ].join('\n'))
  }
  if (id === 'site-confirmation-payment') {
    return gmailHtml(api, [
      'The home: https://ryan-realty.com/listing/2201',
      'Pick a time: https://ryan-realty.com/book?agent=matt',
    ].join('\n'))
  }
  if (id === 'sequence-step' || id === 'sequence-sms-fallback' || id === 'crm-composer' || id === 'governed-gmail') {
    return gmailHtml(api, 'See the search: https://ryan-realty.com/search')
  }
  if (id === 'appointment-invite') {
    return gmailHtml(api, [
      'Hi Casey,',
      '',
      'You have an appointment scheduled: Pricing conversation',
      'Where: https://maps.example.com/pin',
    ].join('\n'))
  }
  if (id === 'governed-resend') {
    const prepared = api.prepareDeliverableEmail({
      subject: 'Gate fixture',
      html: '<p><a href="https://ryan-realty.com/search">Search</a></p>',
      personId: PERSON_ID,
    })
    return api.attributeOutbound(prepared.html, trackOpts('gov:resend:gate'))
  }
  if (id === 'cma-legacy-contact') {
    const letter = '<p><a href="https://ryan-realty.com/cma/cma-gate-fixture">Read the report</a></p>'
    const tracked = api.attributeOutbound(letter, trackOpts('cma:legacy'))
    return api.prepareDeliverableEmail({
      subject: 'Your report',
      html: tracked,
      personId: PERSON_ID,
    }).html
  }
  if (id === 'cma-draft-send') {
    const letter = '<p><a href="https://ryan-realty.com/cma/cma-gate-fixture">Read the report</a></p>'
    return api.attributeOutbound(letter, {
      brokerSlug: 'matt',
      personId: PERSON_ID,
      emailKey: 'cma:draft:gate',
      label: 'Your report',
    })
  }
  if (id === 'signing-invite') {
    return api.attributeOutbound(
      signingShell({
        bodyHtml: '<p>Hi Casey, tap the button to review and sign.</p>',
        cta: { label: 'Review and sign', url: `${SITE_ORIGIN}/sign/gate-fixture` },
      }),
      trackOpts('tc-sign:gate'),
    )
  }
  if (id === 'signing-completion') {
    return api.attributeOutbound(
      signingShell({ bodyHtml: '<p>Hi Casey, every party has signed. A completed copy is attached.</p>' }),
      trackOpts('tc-complete:gate'),
    )
  }
  if (id === 'home-valuation') {
    const cma = '<p>Hi Casey,</p><p>Attached is your Comparative Market Analysis for 123 NW Oregon Ave.</p><p>Best,<br/>Ryan Realty<br/><a href="https://ryan-realty.com">ryan-realty.com</a></p>'
    const ack = '<p>Hi Casey,</p><p>Thank you for requesting a value estimate on your home.</p><p>Thanks again,<br/>Matt Ryan<br/>Ryan Realty<br/>541.703.3095<br/><a href="https://ryan-realty.com">ryan-realty.com</a></p>'
    return [
      api.attributeOutbound(cma, trackOpts('home-valuation:gate')),
      api.attributeOutbound(ack, trackOpts('home-valuation-ack:gate')),
    ]
  }
  throw new Error(`no renderer for ${id}`)
}

function staticReasons(entry, source) {
  const reasons = []
  const asserts = Array.isArray(entry.staticAssert) ? entry.staticAssert : []
  // Render entries are judged on the HTML. A static body scan runs only for
  // the static fallback, or when the entry names snippets that must stay in
  // the send function (so removing the wrap helper is a new failure).
  const wantBody = entry.check === 'static' || asserts.length > 0
  if (wantBody) {
    if (asserts.length === 0 && entry.check === 'static') {
      reasons.push('wrap helper missing: static entry has no staticAssert')
    }
    const body = functionBody(source, entry.fn)
    const hay = body ?? ''
    if (!body) reasons.push(`wrap helper missing: function ${entry.fn} not found`)
    for (const snippet of asserts) {
      if (!hay.includes(snippet)) reasons.push(`wrap helper missing: ${snippet}`)
    }
  }
  if (entry.id === 'signing-invite') {
    const shell = functionBody(source, 'shell')
    const count = shell ? (shell.match(/href\s*=/g) || []).length : 0
    if (!shell || count !== 1) reasons.push(`static: signing shell href count is ${count}, expected 1`)
  }
  return reasons
}

function readSource(file) {
  return readFileSync(join(ROOT, file), 'utf8')
}

async function evaluateTemplates(registry) {
  const needsRender = registry.templates.some((t) => t.check === 'render')
  const api = needsRender ? await loadApi() : null
  const ctx = {
    siteOrigin: SITE_ORIGIN,
    pamphletUrls: api ? [api.pamphletUrl] : [`${SITE_ORIGIN}${PAMPHLET_PATH}`],
  }
  const results = []
  for (const entry of registry.templates) {
    const hard = []
    let reasons = []
    let source = ''
    try {
      source = readSource(entry.file)
    } catch (e) {
      hard.push(`cannot read ${entry.file}: ${e instanceof Error ? e.message : String(e)}`)
      results.push({ id: entry.id, reasons, hard, status: 'hard' })
      continue
    }
    if (!sourceHasFunction(source, entry.fn)) {
      hard.push(`registry function not found: ${entry.file} ${entry.fn}`)
    }
    if (entry.check === 'static') {
      reasons = staticReasons(entry, source)
    } else if (entry.check === 'render') {
      try {
        const html = renderById(entry.id, api)
        const docs = Array.isArray(html) ? html : [html]
        const bag = []
        for (const doc of docs) {
          if (typeof doc !== 'string' || doc.length === 0) {
            hard.push('render returned empty html')
            continue
          }
          bag.push(...evaluateHtml(doc, ctx))
        }
        const extra = staticReasons({ ...entry, check: 'render' }, source)
        reasons = [...new Set([...bag, ...extra])].sort()
      } catch (e) {
        hard.push(`render threw: ${e instanceof Error ? e.message : String(e)}`)
      }
    } else {
      hard.push(`unknown check mode ${entry.check}`)
    }
    results.push({ id: entry.id, reasons, hard, status: hard.length ? 'hard' : 'checked' })
  }
  return results
}

function gateProblems(registry, baseline, senders, templateResults) {
  const problems = []
  const templateOut = []
  const ids = new Set()
  for (const entry of registry.templates) {
    if (ids.has(entry.id)) problems.push(`duplicate registry id ${entry.id}`)
    ids.add(entry.id)
  }
  const covered = new Set()
  for (const entry of registry.templates) covered.add(coverageKey(entry.file, entry.fn))
  for (const ex of registry.exclusions || []) covered.add(coverageKey(ex.file, ex.fn))
  const unregistered = []
  for (const sender of senders) {
    if (!covered.has(coverageKey(sender.file, sender.fn))) {
      const line = `${sender.file} ${sender.fn} (${sender.callees.join(', ')} at ${sender.lines.join(', ')})`
      unregistered.push(line)
      problems.push(`unregistered sender: ${line}`)
    }
  }
  const baseEntries = baseline.entries && typeof baseline.entries === 'object' ? baseline.entries : {}
  for (const id of Object.keys(baseEntries)) {
    if (!ids.has(id)) problems.push(`baseline id ${id} is not in the registry and must be removed`)
  }
  for (const row of templateResults) {
    if (row.hard.length) {
      for (const h of row.hard) problems.push(`${row.id}: ${h}`)
      templateOut.push({ id: row.id, status: 'hard', reasons: row.reasons, problems: row.hard })
      continue
    }
    const listed = Object.prototype.hasOwnProperty.call(baseEntries, row.id) ? baseEntries[row.id].reasons : null
    const judged = judgeReasons(row.reasons, listed)
    if (judged.status !== 'pass' && judged.status !== 'baselined') {
      for (const p of judged.problems) problems.push(`${row.id}: ${p}`)
    }
    templateOut.push({ id: row.id, status: judged.status, reasons: [...new Set(row.reasons)].sort(), problems: judged.problems })
  }
  return { problems, templateOut, unregistered }
}

function printHuman(payload) {
  console.log('Outbound tracking gate (ci:outbound-tracking)')
  console.log('=============================================')
  const renderN = payload.templates.filter((t) => t.check === 'render').length
  const staticN = payload.templates.filter((t) => t.check === 'static').length
  console.log(`templates: ${payload.templates.length} (${renderN} render, ${staticN} static)`)
  console.log(`senders scanned: ${payload.senderCount}`)
  console.log(`unregistered: ${payload.unregistered.length}`)
  const failing = payload.results.filter((r) => r.status !== 'pass')
  console.log(`templates not clean: ${failing.length}`)
  for (const row of payload.results) {
    if (row.status === 'pass') continue
    console.log(`  ${row.id}: ${row.status}`)
    for (const r of row.reasons || []) console.log(`    ${r}`)
    for (const p of row.problems || []) console.log(`    ${p}`)
    const note = payload.notes[row.id]
    if (note) console.log(`    note: ${note}`)
  }
  if (payload.unregistered.length) {
    console.log('unregistered senders:')
    for (const u of payload.unregistered) console.log(`  ${u}`)
  }
  if (payload.ok) console.log('\nOK ci:outbound-tracking')
  else {
    console.log(`\nFAIL ci:outbound-tracking (${payload.problems.length})`)
    for (const p of payload.problems) console.log(`  - ${p}`)
  }
}

async function main() {
  const report = process.argv.includes('--report')
  const asJson = process.argv.includes('--json')
  process.env.EMAIL_TRACKING_SECRET = 'outbound-tracking-gate-dummy-secret'
  process.env.NEXT_PUBLIC_SITE_URL = SITE_ORIGIN
  process.env.NODE_ENV = 'test'
  // Some builders import the data layer at module scope. Dummy values let
  // those clients construct. The render path never calls them.
  process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'https://example.supabase.co'
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= 'outbound-tracking-gate-anon'
  process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'outbound-tracking-gate-service'

  const registry = readJson(REGISTRY_PATH)
  const baseline = readJson(BASELINE_PATH)
  const senders = scanSenders(ROOT)
  const templateResults = await evaluateTemplates(registry)
  const judged = gateProblems(registry, baseline, senders, templateResults)
  const notes = {}
  for (const [id, entry] of Object.entries(baseline.entries || {})) {
    if (entry && entry.note) notes[id] = entry.note
  }
  const payload = {
    ok: judged.problems.length === 0,
    templates: registry.templates.map((t) => ({ id: t.id, check: t.check, kind: t.kind, file: t.file, fn: t.fn })),
    results: judged.templateOut,
    unregistered: judged.unregistered,
    senderCount: senders.length,
    problems: judged.problems,
    notes,
  }
  if (asJson) console.log(JSON.stringify(payload, null, 2))
  else printHuman(payload)
  if (!report && !payload.ok) process.exit(1)
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === join(process.cwd(), relative(process.cwd(), process.argv[1]))
if (isMain) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.stack || e.message : String(e))
    if (e && typeof e === 'object' && 'cause' in e) console.error('cause:', e.cause)
    process.exit(1)
  })
}
