#!/usr/bin/env node
/**
 * G37 — hydration-safety gate (the React #418 regression class).
 *
 * A "use client" component that reads the wall clock (Date.now() / new Date())
 * or formats a date with an unpinned locale formatter (toLocaleDateString /
 * toLocaleTimeString / toLocaleString-with-date-keys without a fixed timeZone)
 * IN ITS RENDER BODY produces different output on the server vs the client. On
 * an ISR-cached page the server HTML was generated earlier, so it disagrees with
 * the first client render → React abandons hydration (Minified React error #418)
 * and the whole client tree dies (menus, sliders, links stop working). This exact
 * bug bricked ListingTile site-wide; the fix was to move the clock read into a
 * useEffect and pin every formatter to America/Los_Angeles.
 *
 * This gate bans those calls in the RENDER BODY of client components. It is safe
 * inside useEffect / useLayoutEffect — those are client-only. useMemo and
 * useCallback RUN DURING RENDER (they may be called server-side) so their bodies
 * are NOT stripped; they are scanned along with the rest of the render body. A
 * locale formatter that passes timeZone is allowed. A line with the comment
 * `// hydration-safe` is exempted.
 *
 * RULE SET (ruleId used in per-line baseline entries):
 *
 *   clock-now      Date.now() in render body (including useMemo/useCallback)
 *   clock-new-date new Date() in render body (including useMemo/useCallback)
 *   locale-date    .toLocaleDateString / .toLocaleTimeString without a pinned timeZone
 *   locale-ts      .toLocaleString() with date-formatting keys (dateStyle, timeStyle,
 *                  weekday, year, month, day, hour, minute) but without timeZone.
 *                  Pure number/currency .toLocaleString() without any date key is safe
 *                  and is intentionally NOT flagged.
 *   impure-helper  A client-component render body calls an exported lib/*.ts helper
 *                  whose body reads new Date() / Date.now() / Math.random() /
 *                  localStorage / navigator. / window. — those reads happen during
 *                  SSR and differ from the client's first render (#418 risk).
 *
 * TWO-GUARD RATCHET (same pattern as check-heading-display.mjs):
 *   1. No NEW violation entry (file:line:ruleId) beyond the baseline set.
 *   2. The total live count may never exceed the baseline `total` (count ceiling).
 *      Even if a new violation reuses a baselined file, adding lines raises the
 *      count and fails the ceiling check.
 *   Both can only shrink. Re-baseline with --write-baseline after fixes land.
 *
 * Run: node scripts/check-hydration-safety.mjs            # check
 *      node scripts/check-hydration-safety.mjs --write-baseline
 *      node scripts/check-hydration-safety.mjs --json
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const BASELINE_FILE = path.join(ROOT, 'scripts', '.hydration-safety-baseline.json')
const WRITE = process.argv.includes('--write-baseline')
const JSON_OUT = process.argv.includes('--json')

// ---------------------------------------------------------------------------
// File walkers
// ---------------------------------------------------------------------------

function walkTsx(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) {
      if (!/node_modules|\.next|\.git|__tests__/.test(p)) walkTsx(p, out)
    } else if (/\.tsx$/.test(e.name)) {
      out.push(p)
    }
  }
  return out
}

function walkTs(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) {
      if (!/node_modules|\.next|\.git|__tests__/.test(p)) walkTs(p, out)
    } else if (/\.ts$/.test(e.name)) {
      out.push(p)
    }
  }
  return out
}

const rel = (f) => path.relative(ROOT, f).split(path.sep).join('/')
const isClientComponent = (src) =>
  /^\s*['"]use client['"]\s*;?\s*$/m.test(src.split('\n').slice(0, 8).join('\n'))

// ---------------------------------------------------------------------------
// Strip only truly deferred hooks (useEffect / useLayoutEffect).
// useMemo and useCallback run during render (including SSR) and MUST be scanned.
// Event-handler bodies (onClick = () => { ... }) are intentionally NOT stripped:
// they never run during render so they could safely be excluded, but the cost of
// stripping them is complexity and false-negative risk; the current scan correctly
// ignores them because they don't execute during render anyway — any clock read
// inside an event handler doesn't cause #418. We leave them in the source so the
// scanner is conservative (may produce false positives in handler bodies) but we
// accept that: the // hydration-safe escape hatch handles confirmed false positives.
// ---------------------------------------------------------------------------

/** Remove the full call expression of useEffect / useLayoutEffect (balanced parens). */
function stripDeferredHookBodies(src) {
  // Only strip useEffect and useLayoutEffect — these are client-only and post-hydrate.
  // Do NOT strip useMemo or useCallback: those run during render (server + client)
  // and can produce #418 if they read the wall clock or locale without pinning.
  const hookRe = /\b(useEffect|useLayoutEffect)\s*\(/g
  let result = ''
  let lastIndex = 0
  let m
  while ((m = hookRe.exec(src)) !== null) {
    const start = m.index
    let i = hookRe.lastIndex - 1
    let depth = 0
    for (; i < src.length; i++) {
      const c = src[i]
      if (c === '(') depth++
      else if (c === ')') {
        depth--
        if (depth === 0) { i++; break }
      }
    }
    result += src.slice(lastIndex, start)
    // Replace stripped span with blank lines to keep line numbers stable.
    result += src.slice(start, i).replace(/[^\n]/g, ' ')
    lastIndex = i
    hookRe.lastIndex = i
  }
  result += src.slice(lastIndex)
  return result
}

// ---------------------------------------------------------------------------
// STAGE 1 — Build the "impure helpers" map from lib/**/*.ts
//
// Scan each exported function/arrow in lib/*.ts for impure reads:
//   - new Date() with no args (wall clock, not parsing)
//   - Date.now()
//   - Math.random()
//   - localStorage. / sessionStorage.
//   - navigator.
//   - window.  (raw global; typeof window checks are guard patterns, not reads)
//
// We extract the function body via balanced-brace scanning from the first `{`
// after the function keyword/arrow. Name-based matching is intentional: precision
// over recall is the goal (document false-negative limit below).
//
// KNOWN LIMITS:
//   - Does not resolve re-exports or transitive impurity (helper A calls helper B
//     which calls Date.now() — only B is flagged, not A). This is a pragmatic
//     trade-off; transitive impurity is rare and harder to detect without a full
//     call-graph.
//   - Alias imports (import { reportsExploreYtdPath as ytd } from ...) will be
//     missed if the alias name doesn't match the known-impure set. This is
//     acceptable given the low occurrence rate in this codebase.
// ---------------------------------------------------------------------------

const IMPURE_BODY_RE = /(?<!\btypeof\s+)\bnew\s+Date\s*\(\s*\)|\bDate\.now\s*\(\s*\)|\bMath\.random\s*\(\s*\)|\blocalStorage\.|\bsessionStorage\.|\bnavigator\.|\bwindow\./

/** Extract exported function names whose bodies contain impure reads from a .ts file. */
function extractImpureExports(src) {
  const impure = new Set()
  // Match: export function NAME(...) or export const NAME = (...) =>
  // Then scan from the opening { to the matching } to get the body.
  const exportRe = /\bexport\s+(?:async\s+)?function\s+(\w+)\s*[(<]|export\s+const\s+(\w+)\s*=\s*(?:async\s+)?\(?[^)]*\)?\s*=>/g
  let m
  while ((m = exportRe.exec(src)) !== null) {
    const name = m[1] || m[2]
    if (!name) continue
    // Find the first { after the match position
    let bodyStart = src.indexOf('{', m.index + m[0].length)
    if (bodyStart === -1) continue
    // Scan to matching }
    let depth = 0
    let i = bodyStart
    for (; i < src.length; i++) {
      if (src[i] === '{') depth++
      else if (src[i] === '}') {
        depth--
        if (depth === 0) { i++; break }
      }
    }
    const body = src.slice(bodyStart, i)
    if (IMPURE_BODY_RE.test(body)) {
      impure.add(name)
    }
  }
  return impure
}

/** Build map: importPath (relative, normalized) → Set<impureFunctionName> */
function buildImpureHelpersMap() {
  const libDir = path.join(ROOT, 'lib')
  if (!fs.existsSync(libDir)) return new Map()
  const files = walkTs(libDir)
  const map = new Map() // relPath → Set<name>
  for (const f of files) {
    const src = fs.readFileSync(f, 'utf8')
    const names = extractImpureExports(src)
    if (names.size > 0) {
      map.set(rel(f), names)
    }
  }
  return map
}

// ---------------------------------------------------------------------------
// STAGE 2 — Violation rules for client components
// ---------------------------------------------------------------------------

// clock-now / clock-new-date: direct calls in render body
const BANNED_CLOCK = [
  { re: /\bDate\.now\s*\(\s*\)/, ruleId: 'clock-now', label: 'Date.now() in render body (includes useMemo/useCallback) — move to useEffect (#418)' },
  { re: /\bnew\s+Date\s*\(\s*\)/, ruleId: 'clock-new-date', label: 'new Date() in render body (includes useMemo/useCallback) — move to useEffect (#418)' },
]

// locale-date: .toLocaleDateString / .toLocaleTimeString without timeZone
const LOCALE_DATE_RE = /\.toLocale(DateString|TimeString)\s*\(/g

// locale-ts: .toLocaleString( with date-option keys, no timeZone.
// DATE_KEY_RE matches any of the date/time keys that make it date-formatting.
// Number formatting keys (style:'currency', minimumFractionDigits, etc.) do NOT
// appear here, so pure-number .toLocaleString() calls are not flagged.
const DATE_OPTION_KEYS_RE = /\b(dateStyle|timeStyle|weekday|year|month|day|hour|minute|second|timeZoneName)\s*:/
const LOCALE_TS_RE = /\.toLocaleString\s*\(/g

/**
 * Check a single .toLocaleString( call's argument list for:
 *   - At least one date-option key (otherwise it's pure number formatting → safe)
 *   - No timeZone option (pinned timezone makes it safe)
 *
 * We extract only the balanced parentheses of the .toLocaleString(...) call to
 * avoid false positives from nearby unrelated code (e.g. a `year:` property in a
 * data-mapping object two lines below would incorrectly look like a date option).
 *
 * @param {string[]} lines - all source lines
 * @param {number} lineIdx - 0-based index of the line containing .toLocaleString(
 * @param {number} matchOffset - character offset of the `(` within that line
 */
function localeStringIsDateFormatWithoutTz(lines, lineIdx, matchOffset) {
  // Build a multi-line string starting from the opening `(` of the call,
  // spanning at most 6 more lines (enough for a compact options object).
  const chunk = lines.slice(lineIdx, lineIdx + 6).join('\n')
  // Find the opening paren at the right position
  const parenStart = matchOffset != null ? matchOffset : chunk.indexOf('(')
  if (parenStart === -1) return false

  // Extract the balanced content inside the outer parentheses
  let depth = 0
  let i = parenStart
  let inner = ''
  for (; i < chunk.length; i++) {
    const c = chunk[i]
    if (c === '(') { depth++; if (depth === 1) continue }
    else if (c === ')') { depth--; if (depth === 0) break }
    if (depth > 0) inner += c
  }
  // inner is the raw arguments to .toLocaleString(...) — e.g. `'en-US', { month: 'short' }`
  const hasDateKey = DATE_OPTION_KEYS_RE.test(inner)
  const hasTz = /timeZone/.test(inner)
  return hasDateKey && !hasTz
}

// ---------------------------------------------------------------------------
// Stage 2b — Detect impure-helper calls in render body
//
// For each client component, extract its import map (local alias → lib relpath),
// then scan the (stripped) source for calls to known-impure exported names.
//
// "Render body" = all lines after stripping useEffect/useLayoutEffect bodies.
// useMemo/useCallback bodies ARE included (they run during render).
// ---------------------------------------------------------------------------

/** Parse `import { A, B as C } from '@/lib/foo'` → map localAlias → libRelPath */
function parseImports(src, fileRelPath) {
  const imports = new Map() // localName → lib/**/*.ts relPath
  const importRe = /^import\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/gm
  let m
  while ((m = importRe.exec(src)) !== null) {
    const specifiers = m[1]
    const rawPath = m[2]
    // Only care about lib imports
    if (!rawPath.startsWith('@/lib/') && !rawPath.startsWith('../') && !rawPath.startsWith('./')) continue
    // Resolve to a lib/**/*.ts relPath
    let resolved = null
    if (rawPath.startsWith('@/lib/')) {
      resolved = rawPath.replace('@/', '') + '.ts'  // e.g. lib/slug.ts
    } else {
      // relative import — resolve from the file's directory
      const fileDir = path.dirname(path.join(ROOT, fileRelPath))
      const absPath = path.resolve(fileDir, rawPath)
      const relResolved = rel(absPath)
      if (relResolved.startsWith('lib/')) resolved = relResolved + '.ts'
    }
    if (!resolved) continue
    // parse specifiers: "A, B as C" → A→resolved, C→resolved
    for (const spec of specifiers.split(',')) {
      const trimmed = spec.trim()
      if (!trimmed) continue
      const asParts = trimmed.split(/\s+as\s+/)
      const localName = (asParts[1] ?? asParts[0]).trim()
      imports.set(localName, resolved)
    }
  }
  return imports
}

// ---------------------------------------------------------------------------
// Main violation checker for a single file
// ---------------------------------------------------------------------------

function violationsIn(file, impureHelpersMap) {
  const raw = fs.readFileSync(file, 'utf8')
  if (!isClientComponent(raw)) return []

  const fileRelPath = rel(file)
  // Parse imports before stripping (stripping doesn't touch top-level imports)
  const importMap = parseImports(raw, fileRelPath)

  // Strip only useEffect/useLayoutEffect bodies; useMemo/useCallback stay.
  const src = stripDeferredHookBodies(raw)
  const lines = src.split('\n')

  const hits = [] // { line: 1-based, ruleId, label }

  lines.forEach((line, idx) => {
    if (line.includes('hydration-safe')) return // opt-out

    // clock-now / clock-new-date
    for (const b of BANNED_CLOCK) {
      if (b.re.test(line)) hits.push({ line: idx + 1, ruleId: b.ruleId, label: b.label })
    }

    // locale-date: .toLocaleDateString / .toLocaleTimeString
    LOCALE_DATE_RE.lastIndex = 0
    let mm
    while ((mm = LOCALE_DATE_RE.exec(line)) !== null) {
      // For locale-date we do a simple 4-line lookahead for timeZone (these
      // methods almost always have a short options object on the same call line).
      const window = lines.slice(idx, idx + 4).join(' ')
      if (!/timeZone/.test(window)) {
        hits.push({
          line: idx + 1,
          ruleId: 'locale-date',
          label: `${mm[0]} without a pinned timeZone — pass timeZone:'America/Los_Angeles' (#418)`,
        })
      }
    }

    // locale-ts: .toLocaleString( with date keys, no timeZone.
    // Pass the character position of the opening `(` so the detector only
    // inspects the call's actual argument list — not unrelated code nearby.
    LOCALE_TS_RE.lastIndex = 0
    while ((mm = LOCALE_TS_RE.exec(line)) !== null) {
      // mm.index is start of ".toLocaleString("; the `(` is the last char of mm[0]
      const parenPos = mm.index + mm[0].length - 1
      if (localeStringIsDateFormatWithoutTz(lines, idx, parenPos)) {
        hits.push({
          line: idx + 1,
          ruleId: 'locale-ts',
          label: `.toLocaleString( with date-formatting keys but no timeZone — pin to timeZone:'America/Los_Angeles' (#418)`,
        })
      }
    }

    // impure-helper: a render-body call to an imported lib function that is impure
    for (const [localName, libPath] of importMap) {
      const impureNames = impureHelpersMap.get(libPath)
      if (!impureNames || !impureNames.has(localName)) continue
      // Check if localName is called on this line (as a function call)
      const callRe = new RegExp(`\\b${localName}\\s*\\(`)
      if (callRe.test(line)) {
        hits.push({
          line: idx + 1,
          ruleId: 'impure-helper',
          label: `${localName}() (from ${libPath}) reads Date/random/storage in its body — called in render (includes useMemo/useCallback); move to useEffect or pass a pre-computed value from the server (#418)`,
        })
      }
    }
  })

  return hits
}

// ---------------------------------------------------------------------------
// Violation key format: "file:line:ruleId"
// Using line number rather than a content hash because:
//   - Line numbers are stable in practice within a session
//   - Content hashes would require reading the stripped source at baseline-write
//     and re-hashing at check-time, adding fragility
//   - The orchestrator re-runs --write-baseline at integration anyway, so
//     any line-drift from concurrent edits is corrected automatically
// ---------------------------------------------------------------------------

function makeKey(fileRelPath, line, ruleId) {
  return `${fileRelPath}:${line}:${ruleId}`
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const impureHelpersMap = buildImpureHelpersMap()

const tsxFiles = ['app', 'components'].flatMap((d) =>
  fs.existsSync(path.join(ROOT, d)) ? walkTsx(path.join(ROOT, d)) : [],
)

const allViolations = [] // { key, fileRelPath, line, ruleId, label }
for (const f of tsxFiles) {
  const fileRelPath = rel(f)
  for (const hit of violationsIn(f, impureHelpersMap)) {
    allViolations.push({
      key: makeKey(fileRelPath, hit.line, hit.ruleId),
      fileRelPath,
      line: hit.line,
      ruleId: hit.ruleId,
      label: hit.label,
    })
  }
}

allViolations.sort((a, b) => a.key.localeCompare(b.key))

// ---------------------------------------------------------------------------
// --write-baseline: snapshot current state as the new per-line baseline
// ---------------------------------------------------------------------------

if (WRITE) {
  const baseline = {
    generatedAt: new Date().toISOString(),
    format: 'file:line:ruleId — each entry is one violation; both the set (no new entries) and total (count ceiling) must not grow.',
    total: allViolations.length,
    violations: allViolations.map((v) => v.key).sort(),
  }
  fs.writeFileSync(BASELINE_FILE, JSON.stringify(baseline, null, 2) + '\n')
  console.log(`Wrote hydration-safety baseline: ${allViolations.length} violation(s) across ${new Set(allViolations.map((v) => v.fileRelPath)).size} file(s).`)
  process.exit(0)
}

// ---------------------------------------------------------------------------
// Load baseline and apply two-guard ratchet
// ---------------------------------------------------------------------------

function loadBaseline() {
  if (!fs.existsSync(BASELINE_FILE)) return { set: new Set(), total: 0 }
  const data = JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8'))
  // Support both old format (allowed: string[]) and new format (violations: string[])
  const entries = data.violations ?? data.allowed ?? []
  const total = data.total ?? entries.length
  return { set: new Set(entries), total }
}

const { set: baselineSet, total: ceiling } = loadBaseline()
const liveKeys = allViolations.map((v) => v.key)

const newViolations = allViolations.filter((v) => !baselineSet.has(v.key))
const fixedSinceBaseline = [...baselineSet].filter((k) => !liveKeys.includes(k))
// Count-ceiling ratchet: the live total may never exceed the baseline total.
const overCeiling = Math.max(0, allViolations.length - ceiling)
const failed = newViolations.length > 0 || overCeiling > 0

if (JSON_OUT) {
  console.log(JSON.stringify({
    total: allViolations.length,
    ceiling,
    overCeiling,
    newViolations: newViolations.map((v) => v.key),
    fixedSinceBaseline,
  }, null, 2))
  process.exit(failed ? 1 : 0)
}

// ---------------------------------------------------------------------------
// Human-readable output
// ---------------------------------------------------------------------------

// Group by rule for reporting
const byRule = {}
for (const v of allViolations) {
  byRule[v.ruleId] = (byRule[v.ruleId] ?? 0) + 1
}

console.log('Hydration-safety gate (ratcheted, per-line baseline)')
console.log('=====================================================')
console.log()
console.log(`Total violations (live):          ${allViolations.length}`)
console.log(`  Baseline ceiling (≤ required):  ${ceiling}`)
console.log(`  NEW violations (CI BLOCKER):     ${newViolations.length}`)
console.log(`  Over count ceiling (CI BLOCKER): ${overCeiling}`)
console.log(`  Fixed since baseline:            ${fixedSinceBaseline.length}`)
console.log()
console.log('Breakdown by rule:')
for (const [rule, count] of Object.entries(byRule).sort()) {
  console.log(`  ${rule.padEnd(20)} ${count}`)
}
console.log()

if (newViolations.length > 0) {
  console.error('NEW violations (these fail CI):')
  for (const v of newViolations) {
    console.error(`  ${v.key}`)
    console.error(`    ${v.label}`)
  }
  console.error()
}
if (overCeiling > 0) {
  console.error(`Count rose above the baseline ceiling by ${overCeiling}. Fix or re-baseline after fixing.`)
  console.error()
}
if (!failed) {
  console.log(`Gate PASSED (${allViolations.length} baselined violation(s), 0 new, count ≤ ceiling).`)
  console.log('Tip: run with --write-baseline after each fix to shrink the debt.')
}

process.exit(failed ? 1 : 0)
