#!/usr/bin/env node
/**
 * G68 — Activity event label coverage.
 *
 * `public.activity_events.event_type` is a free-text column whose value set is
 * OPEN-ENDED by construction: the sole writer, `lib/sync/deltaSync.ts`, builds
 * one of its values as `` `status_${slug}` `` from the raw MLS StandardStatus.
 * Four public consumers each kept a partial hand-written map with a fallback
 * that printed the column value verbatim, so `/activity` shipped rows reading
 * "status_canceled · Bend · Stonegate" to visitors, and the city /
 * neighborhood / community activity ledgers did the same. Live at 2026-08-18:
 * status_canceled 1,067 · status_withdrawn 546 · price_increase 369 ·
 * status_active 230 — 2,212 rows with no label anywhere.
 *
 * Unit tests cannot catch this class: they assert a map against itself. This
 * gate asserts the map against THE WRITER, and asserts that no public surface
 * builds its own.
 *
 * RULES
 *   A  canonical module — lib/activity/event-label.ts exports the resolver,
 *      branches on the `status_` prefix, and carries a terminal fallback.
 *   B  writer coverage — every `event_type: '<literal>'` in deltaSync.ts is a
 *      key in ACTIVITY_EVENT_DISPLAY, and every interpolated form starts with
 *      a prefix the resolver branches on.
 *   C  founding surfaces — /activity rows and the KB place ledger resolve
 *      through the canonical module.
 *   D  no second vocabulary — a public label-producing function that takes an
 *      activity event_type must call the resolver.
 *   E  no raw passthrough — no public surface renders `.event_type` directly
 *      or falls back to it.
 *
 *   node scripts/check-activity-event-labels.mjs [--report] [--json]
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = process.cwd()
const REPORT = process.argv.includes('--report')
const JSON_OUT = process.argv.includes('--json')

const CANON = 'lib/activity/event-label.ts'
const WRITER = 'lib/sync/deltaSync.ts'
const CANON_IMPORT = /from ['"]@\/lib\/activity\/event-label['"]/
const RESOLVER_CALL = /activityEvent(?:Label|Display)\s*\(/

const checks = []
function check(rule, label, ok, detail) {
  checks.push({ rule, label, ok: Boolean(ok), detail: detail ?? null })
}

function src(path) {
  return readFileSync(join(ROOT, path), 'utf8')
}

function exists(path) {
  try {
    statSync(join(ROOT, path))
    return true
  } catch {
    return false
  }
}

// ── A. canonical module ──────────────────────────────────────────────────────
let canonText = ''
if (!exists(CANON)) {
  check('A', `${CANON} exists`, false, 'missing')
} else {
  canonText = src(CANON)
  check('A', 'canonical module exports activityEventDisplay', /export function activityEventDisplay/.test(canonText))
  check('A', 'canonical module exports activityEventLabel', /export function activityEventLabel/.test(canonText))
  check(
    'A',
    'canonical module exports the ACTIVITY_EVENT_DISPLAY map',
    /export const ACTIVITY_EVENT_DISPLAY/.test(canonText),
  )
  check(
    'A',
    'canonical module branches on the open-ended status_ prefix',
    /startsWith\(['"]status_['"]\)/.test(canonText),
    'the writer interpolates status_${StandardStatus}; a literal map alone cannot cover it',
  )
  // The resolver must be TOTAL: no branch may hand the raw column value back.
  // Checked over the resolver's own returns, so a passthrough dressed as an
  // object (`return { kind: 'update', label: String(eventType) }`) is caught
  // just like a bare `return key`.
  const resolverStart = canonText.indexOf('export function activityEventDisplay')
  const resolverEnd = resolverStart < 0 ? -1 : canonText.indexOf('\n}', resolverStart)
  const resolverBody = resolverStart < 0 ? '' : canonText.slice(resolverStart, resolverEnd + 2)
  const passthrough = [...resolverBody.matchAll(/return\s+([^\n;]+)/g)]
    .map((m) => m[1])
    .filter((expr) => /\b(eventType|key)\b/.test(expr))
  check(
    'A',
    'no resolver branch returns the raw event_type',
    resolverBody.length > 0 && passthrough.length === 0,
    passthrough.length ? `return ${passthrough[0]}` : null,
  )
  check(
    'A',
    'canonical module has a named terminal fallback',
    /LISTING_UPDATE/.test(canonText),
  )
}

// ── B. writer coverage ───────────────────────────────────────────────────────
const mapKeys = new Set(
  [...canonText.matchAll(/^\s{2}([a-z][a-z0-9_]*)\s*:\s*\{\s*kind:/gm)].map((m) => m[1]),
)
check('B', 'canonical map is non-empty', mapKeys.size > 0, `${mapKeys.size} literal(s)`)

if (exists(WRITER)) {
  const writer = src(WRITER)
  const literals = [...writer.matchAll(/event_type:\s*['"]([a-z0-9_]+)['"]/g)].map((m) => m[1])
  const ternaryLiterals = [...writer.matchAll(/event_type:\s*[^,\n]*\?\s*['"]([a-z0-9_]+)['"]\s*:\s*['"]([a-z0-9_]+)['"]/g)]
    .flatMap((m) => [m[1], m[2]])
  const written = [...new Set([...literals, ...ternaryLiterals])]
  check('B', `${WRITER} emits at least one event_type literal`, written.length > 0, written.join(', '))
  for (const type of written) {
    check('B', `writer literal "${type}" has a canonical label`, mapKeys.has(type))
  }
  const interpolated = [...writer.matchAll(/event_type:\s*`([a-z0-9_]*)\$\{/g)].map((m) => m[1])
  for (const prefix of interpolated) {
    check(
      'B',
      `writer interpolation \`${prefix}\${…}\` is covered by a resolver prefix branch`,
      prefix.length > 0 && canonText.includes(`startsWith('${prefix}')`),
      'an interpolated event_type needs a prefix branch, not a literal map entry',
    )
  }
} else {
  check('B', `${WRITER} exists`, false, 'missing')
}

// ── C. founding surfaces ─────────────────────────────────────────────────────
const FOUNDING = [
  { path: 'app/activity/_v3/activity-rows.ts', label: '/activity rows resolve through the canonical module' },
  { path: 'lib/kb/place-sections.ts', label: 'KB place activity ledger resolves through the canonical module' },
]
for (const surface of FOUNDING) {
  if (!exists(surface.path)) {
    check('C', surface.label, false, 'file missing')
    continue
  }
  const text = src(surface.path)
  check('C', surface.label, CANON_IMPORT.test(text) && RESOLVER_CALL.test(text))
}

// ── scope for D + E: public surfaces only ────────────────────────────────────
// Admin / CRM / visitor code has its OWN unrelated `event_type` columns
// (visitor_events, crm_activity). This gate is about what a visitor reads.
const SCAN_DIRS = ['app', 'components', 'lib/kb']
const EXCLUDE = [
  'app/admin',
  'app/api',
  'components/admin',
  CANON,
  'lib/activity/event-label.test.ts',
]

function walk(dir, out = []) {
  let entries
  try {
    entries = readdirSync(join(ROOT, dir), { withFileTypes: true })
  } catch {
    return out
  }
  for (const entry of entries) {
    const rel = `${dir}/${entry.name}`
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue
    if (EXCLUDE.some((ex) => rel === ex || rel.startsWith(`${ex}/`))) continue
    if (entry.isDirectory()) walk(rel, out)
    else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) out.push(rel)
  }
  return out
}

const files = SCAN_DIRS.flatMap((d) => walk(d))
const activityFiles = files.filter((f) => {
  const text = src(f)
  return /activity-feed-shared/.test(text) || /ACTIVITY_EVENT_DISPLAY/.test(text)
})

// ── D. no second label vocabulary ────────────────────────────────────────────
// A function whose NAME reads like a label producer, whose signature touches an
// activity event_type, and which yields a display string, must delegate.
const LABELY_NAME = /(label|badge|kind|lead|tag|caption)/i
const DECL = /(?:export\s+)?(?:function\s+([A-Za-z_$][\w$]*)\s*\(|const\s+([A-Za-z_$][\w$]*)\s*=\s*\()/g

/**
 * Body of a TOP-LEVEL declaration: from the declaration to the next line that
 * closes at column 0. Brace matching from the first `{` after the parameter
 * list is wrong here — an inline return-type annotation
 * (`): { label: string; className: string } {`) opens a brace of its own and
 * would yield the annotation instead of the body.
 */
function blockAt(text, declIndex) {
  const end = text.indexOf('\n}', declIndex)
  return end < 0 ? text.slice(declIndex) : text.slice(declIndex, end + 2)
}

for (const file of activityFiles) {
  const text = src(file)
  DECL.lastIndex = 0
  let match
  while ((match = DECL.exec(text)) !== null) {
    const name = match[1] || match[2]
    if (!name || !LABELY_NAME.test(name)) continue
    const headerEnd = text.indexOf('{', match.index)
    if (headerEnd < 0) continue
    const header = text.slice(match.index, headerEnd)
    if (!/event_type/.test(header)) continue
    const body = blockAt(text, match.index)
    // Only functions that PRODUCE a display string are in scope. A styling
    // variant resolver (returns a union of class tokens) is not a label.
    const yieldsString = /\)\s*:\s*string\s*$/.test(header.trim()) || /\blabel\s*:/.test(body)
    if (!yieldsString) continue
    check(
      'D',
      `${file} → ${name}() delegates to the canonical resolver`,
      CANON_IMPORT.test(text) && RESOLVER_CALL.test(body),
      'a second event_type→label vocabulary drifts and re-opens the leak',
    )
  }
}

// ── E. no raw passthrough ────────────────────────────────────────────────────
const RAW_PATTERNS = [
  { name: 'nullish fallback to the raw event_type', re: /\?\?\s*[A-Za-z_$][\w$]*\.event_type\b/ },
  { name: 'display field assigned the raw event_type', re: /\b(?:label|kind|tag|caption|lead|text)\s*:\s*[A-Za-z_$][\w$]*\.event_type\b/ },
  // `{item.event_type}` as rendered TEXT. `prop={item.event_type}` is a value
  // handed to another component (icon choice, confetti variant) — not a label.
  { name: 'raw event_type rendered in JSX', re: /(?<![=])\{\s*[A-Za-z_$][\w$]*\.event_type\s*\}/ },
]
for (const file of activityFiles) {
  const text = src(file)
  for (const pattern of RAW_PATTERNS) {
    const hit = pattern.re.exec(text)
    check(
      'E',
      `${file} has no ${pattern.name}`,
      !hit,
      hit ? hit[0] : null,
    )
  }
}

check('E', 'at least one activity consumer was scanned', activityFiles.length > 0, `${activityFiles.length} file(s)`)

// ── output ───────────────────────────────────────────────────────────────────
const failed = checks.filter((c) => !c.ok)

if (JSON_OUT) {
  console.log(JSON.stringify({ gate: 'activity-event-labels', total: checks.length, failed: failed.length, checks }, null, 2))
  process.exit(REPORT || failed.length === 0 ? 0 : 1)
}

for (const c of checks) {
  console.log(`${c.ok ? 'ok  ' : 'FAIL'}  [${c.rule}] ${c.label}${c.detail ? ` — ${c.detail}` : ''}`)
}

if (REPORT) {
  console.log(`\nactivity-event-labels: ${checks.length - failed.length}/${checks.length} (report mode)`)
  process.exit(0)
}
if (failed.length) {
  console.error(`\nactivity-event-labels: ${failed.length} check(s) failed`)
  console.error(`Resolve every activity_events.event_type through ${CANON} — never print the column value.`)
  process.exit(1)
}
console.log(`\nactivity-event-labels: ${checks.length}/${checks.length}`)
