#!/usr/bin/env node
/**
 * check-poison-null.mjs — CI gate: a DAL resolver wrapped in `unstable_cache`
 * must NOT return an empty/degraded value (`[]` / `null` / `{}` / an EMPTY-like
 * default) on a branch that tested a Supabase `error` — it must THROW instead,
 * so the error result is never cached.
 *
 * THE BUG (poison-null caching): a resolver returns []/null/{} on BOTH a genuine
 * empty success AND a transient Supabase error, then is wrapped in
 * `unstable_cache`. A single pooler/timeout blip caches that empty/error result
 * and pins the page to a broken state ("0 homes", "Not available", blank hero)
 * for the whole revalidate window.
 *
 * THE FIX: the fetch fn THROWS on a DB error (unstable_cache never caches a
 * rejected promise) and returns empty ONLY on a genuine empty success; the
 * public fn is wrapped with `makeResilientCached(...)` from
 * lib/data/cache/resilient.ts, which retries once uncached then falls back —
 * never caching the error. See lib/data/media/getSurfaceImages.ts for the clean
 * example. `makeResilientCached(...)` is the SANCTIONED escape (its whole point
 * is the safe non-throwing fallback), so its fallback arg is NEVER flagged.
 *
 * DETECTION RULE (conservative — only the clear poison-null shape):
 *   A function in lib/data/**.ts is flagged when ALL of:
 *     1. It is a CACHED fetch fn — i.e. its name is passed to `unstable_cache(`
 *        as the first arg, OR it is an inline `unstable_cache(async () => {...})`
 *        / `unstable_cache(async function () {...})` body. (makeResilientCached
 *        fetch fns are NOT cached-with-poison: that wrapper never caches a throw,
 *        so a `return []` fallback inside it is fine — they are excluded.)
 *     2. Inside that cached body there is a Supabase error-swallow shape:
 *          a) `if (error ...) { ... return []/null/{}/<EMPTY const> ... }`  OR
 *          b) `if (error ...) return []/null/{}/<EMPTY const>`               OR
 *          c) it destructures ONLY `{ data }` (dropping `error`) from a query
 *             AND the cached body returns an empty/degraded value somewhere.
 *   A line carrying `// poison-null-ok` is exempt (a deliberate genuine-miss
 *   return on the error path — rare; document why inline).
 *
 *   NOT flagged: a `throw` on the error branch (the fix), a `makeResilientCached`
 *   fallback arg, a non-error genuine-empty `return []` (e.g. `if (!sb) return []`),
 *   or a low-level helper that is NOT itself wrapped in unstable_cache.
 *
 * Baselined: scripts/poison-null-baseline.json grandfathers the offenders that
 * exist at gate-creation time so the gate ships GREEN while the Fix phase pays
 * them down. NEW offenders fail CI. The baseline only shrinks.
 *
 * Usage:
 *   node scripts/check-poison-null.mjs               # CI (wired into ci:gates)
 *   node scripts/check-poison-null.mjs --json
 *   node scripts/check-poison-null.mjs --write-baseline
 */
import { readFileSync, readdirSync, writeFileSync, existsSync, statSync } from 'node:fs'
import { join, resolve, relative } from 'node:path'

const ROOT = resolve(new URL('.', import.meta.url).pathname, '..')
const DAL_DIR = join(ROOT, 'lib/data')
const BASELINE_PATH = join(ROOT, 'scripts/poison-null-baseline.json')

const args = new Set(process.argv.slice(2))
const JSON_OUT = args.has('--json')
const WRITE_BASELINE = args.has('--write-baseline')

const EXEMPT = '// poison-null-ok'

/** Recursively collect every .ts file under lib/data. */
function walk(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) out.push(...walk(p))
    else if (name.endsWith('.ts') && !name.endsWith('.d.ts')) out.push(p)
  }
  return out
}

/**
 * Find the matching close brace for an open brace at `openIdx` (the index of the
 * `{`). Returns the index of the matching `}` (or src.length-1 if unbalanced).
 * Brace-counting is good enough for our well-formed DAL source; string/comment
 * braces are rare in these bodies and only widen the scanned region (a flagged
 * line still has to carry the error-swallow shape).
 */
function matchBrace(src, openIdx) {
  let depth = 0
  for (let i = openIdx; i < src.length; i++) {
    const c = src[i]
    if (c === '{') depth++
    else if (c === '}') {
      depth--
      if (depth === 0) return i
    }
  }
  return src.length - 1
}

/** Line number (1-based) for a char offset. */
function lineAt(src, offset) {
  let line = 1
  for (let i = 0; i < offset && i < src.length; i++) if (src[i] === '\n') line++
  return line
}

/**
 * Collect the [start,end] char ranges of every CACHED fetch body in a file:
 *   - named fns passed to unstable_cache(NAME, ...): the body of `function NAME`
 *     or `const NAME = async (...) => {...}` / `async function NAME`.
 *   - inline unstable_cache(async () => {...}) / unstable_cache(async function...).
 * makeResilientCached(...) bodies are intentionally NOT collected.
 */
function cachedBodies(src) {
  const ranges = []

  // 1. Inline unstable_cache(async () => { ... }) or async function () { ... }.
  const inlineRe = /unstable_cache\s*\(\s*async\s+(?:function\s*\w*\s*)?\([^)]*\)\s*(?:=>\s*)?\{/g
  let m
  while ((m = inlineRe.exec(src))) {
    const openIdx = src.indexOf('{', m.index + m[0].length - 1)
    if (openIdx === -1) continue
    const close = matchBrace(src, openIdx)
    ranges.push([openIdx, close])
  }

  // 2. Named fns supplied to unstable_cache(...) as the thing that does the
  //    fetch. Two real-world shapes in this DAL:
  //      a) DIRECT identifier: unstable_cache(_getXUncached, [...], opts)
  //      b) ARROW-WRAPPED call: unstable_cache(() => fetchX(args), [...], opts)
  //    Both resolve to the SAME named fn body we must scan.
  const cachedNames = new Set()
  const directRe = /unstable_cache\s*\(\s*([A-Za-z_$][\w$]*)\s*,/g
  while ((m = directRe.exec(src))) cachedNames.add(m[1])
  const arrowCallRe = /unstable_cache\s*\(\s*(?:async\s*)?\([^)]*\)\s*=>\s*([A-Za-z_$][\w$]*)\s*\(/g
  while ((m = arrowCallRe.exec(src))) cachedNames.add(m[1])

  for (const name of cachedNames) {
    // Definitions — allow an optional `: ReturnType` annotation between the
    // param list `)` and the body `{` (e.g. `function f(): Promise<X> {`).
    //   const NAME = async (...): T => {   |  const NAME = (...): T => {
    //   async function NAME(...): T {      |  function NAME(...): T {
    const ret = '(?::\\s*[^={;]+)?'
    const defRes = [
      new RegExp(`(?:const|let|var)\\s+${name}\\s*=\\s*async\\s*(?:function\\s*\\w*\\s*)?\\([^)]*\\)\\s*${ret}\\s*(?:=>\\s*)?\\{`),
      new RegExp(`(?:const|let|var)\\s+${name}\\s*=\\s*\\([^)]*\\)\\s*${ret}\\s*=>\\s*\\{`),
      new RegExp(`(?:async\\s+)?function\\s+${name}\\s*\\([^)]*\\)\\s*${ret}\\s*\\{`),
    ]
    for (const re of defRes) {
      const dm = re.exec(src)
      if (!dm) continue
      const openIdx = src.indexOf('{', dm.index + dm[0].length - 1)
      if (openIdx === -1) continue
      const close = matchBrace(src, openIdx)
      ranges.push([openIdx, close])
      break
    }
  }

  return ranges
}

/** True when a single line returns an empty/degraded value (not a throw). */
const RETURNS_EMPTY = /\breturn\s+(\[\s*\]|null|\{\s*\}|EMPTY\b|[A-Z_][A-Z0-9_]*\b)/

/**
 * Scan one file for poison-null offenders. Returns an array of
 * { file, line, fn, snippet } violations.
 */
function classifyFile(file) {
  const src = readFileSync(file, 'utf8')
  const rel = relative(ROOT, file).split('\\').join('/')
  const ranges = cachedBodies(src)
  if (ranges.length === 0) return []

  const lines = src.split('\n')
  const violations = []
  const seenLines = new Set()

  for (const [start, end] of ranges) {
    const body = src.slice(start, end + 1)
    const bodyStartLine = lineAt(src, start)

    // Does this cached body drop `error` by destructuring only { data }?
    // (Used for shape (c); only matters alongside an empty return.)
    const dropsError = /const\s*\{\s*data\s*\}\s*=\s*await\b/.test(body)

    const bodyLines = body.split('\n')
    for (let i = 0; i < bodyLines.length; i++) {
      const absLine = bodyStartLine + i // 1-based line in the file
      const rawLine = lines[absLine - 1] ?? bodyLines[i]
      if (rawLine.includes(EXEMPT)) continue

      // Shape (a)+(b): a line that tested `error` AND returns empty on the same
      // line, e.g. `if (error || !data) return []`.
      const testsErrorInline =
        /\bif\s*\(([^)]*\b)?error\b/.test(rawLine) && RETURNS_EMPTY.test(rawLine)

      // Shape (a) spread across lines: `if (error...) {` opens a block whose
      // body returns empty. Find the nearest following return-empty before the
      // block closes.
      let testsErrorBlock = false
      if (!testsErrorInline && /\bif\s*\(([^)]*\b)?error\b[^)]*\)\s*\{/.test(rawLine)) {
        // Walk forward up to the block close (brace match within the body).
        const lineStartOffset =
          start +
          bodyLines.slice(0, i).reduce((acc, l) => acc + l.length + 1, 0)
        const braceIdx = src.indexOf('{', lineStartOffset)
        if (braceIdx !== -1 && braceIdx <= end) {
          const blockClose = matchBrace(src, braceIdx)
          const block = src.slice(braceIdx, blockClose + 1)
          if (RETURNS_EMPTY.test(block) && !/\bthrow\b/.test(block)) {
            testsErrorBlock = true
          }
        }
      }

      if (testsErrorInline || testsErrorBlock) {
        if (seenLines.has(absLine)) continue
        seenLines.add(absLine)
        violations.push({
          file: rel,
          line: absLine,
          snippet: rawLine.trim(),
        })
      }
    }

    // Shape (c): the body drops `error` (only { data }) AND returns empty
    // somewhere — but ONLY flag if there's no explicit error test at all (i.e.
    // the error is silently dropped). If the body already has an `if (error`
    // test, shapes (a)/(b) cover it.
    if (dropsError && !/\bif\s*\(([^)]*\b)?error\b/.test(body)) {
      for (let i = 0; i < bodyLines.length; i++) {
        const absLine = bodyStartLine + i
        const rawLine = lines[absLine - 1] ?? bodyLines[i]
        if (rawLine.includes(EXEMPT)) continue
        // Only the destructure line itself, reported as the dropped-error site.
        if (/const\s*\{\s*data\s*\}\s*=\s*await\b/.test(rawLine)) {
          if (seenLines.has(absLine)) continue
          // Require an empty return present in the cached body so we don't flag a
          // body that always returns the mapped data.
          if (!RETURNS_EMPTY.test(body)) continue
          seenLines.add(absLine)
          violations.push({
            file: rel,
            line: absLine,
            snippet: rawLine.trim() + '  (drops { error }; cached body returns empty on the implicit error path)',
          })
        }
      }
    }
  }

  return violations
}

function scan() {
  let files = []
  try {
    files = walk(DAL_DIR)
  } catch {
    /* no dir */
  }
  return files.flatMap(classifyFile).sort((a, b) =>
    a.file === b.file ? a.line - b.line : a.file.localeCompare(b.file),
  )
}

/** Stable identity for baselining: "file:line". */
const idOf = (v) => `${v.file}:${v.line}`

function loadBaseline() {
  if (!existsSync(BASELINE_PATH)) return new Set()
  return new Set(JSON.parse(readFileSync(BASELINE_PATH, 'utf8')).violators ?? [])
}

function main() {
  const violations = scan()

  if (WRITE_BASELINE) {
    writeFileSync(
      BASELINE_PATH,
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          reason:
            'Known poison-null offenders at gate-creation time: a resolver wrapped in unstable_cache that returns []/null/{}/a default on a Supabase error branch (or drops { error }) instead of throwing. These are grandfathered so ci:poison-null ships green; the Fix phase converts each to throw-on-error + makeResilientCached and removes it from this list. NEW offenders fail CI. This list only shrinks.',
          total: violations.length,
          violators: violations.map(idOf),
          detail: violations,
        },
        null,
        2,
      ) + '\n',
    )
    console.log(
      `Wrote baseline: ${violations.length} known poison-null offenders at ${relative(ROOT, BASELINE_PATH)}`,
    )
    process.exit(0)
  }

  const baseline = loadBaseline()
  const newViolations = violations.filter((v) => !baseline.has(idOf(v)))
  const fixed = [...baseline].filter((id) => !violations.some((v) => idOf(v) === id))

  if (JSON_OUT) {
    console.log(
      JSON.stringify(
        {
          total: violations.length,
          baselineSize: baseline.size,
          newViolations,
          fixed,
        },
        null,
        2,
      ),
    )
    process.exit(newViolations.length === 0 ? 0 : 1)
  }

  console.log('Poison-null caching check (ratcheted)')
  console.log('=====================================\n')
  console.log(`unstable_cache + error-branch-returns-empty offenders: ${violations.length}`)
  console.log(`  Baseline (known debt, paid down by the Fix phase):   ${baseline.size}`)
  console.log(`  NEW offenders (CI BLOCKER):                           ${newViolations.length}`)
  console.log(`  Fixed since baseline:                                ${fixed.length}\n`)

  if (newViolations.length > 0) {
    console.log('NEW poison-null offenders (these fail CI):')
    for (const v of newViolations) console.log(`  ${idOf(v)}  ${v.snippet}`)
    console.log('\nFix: THROW on the Supabase error branch (do NOT return []/null/{}),')
    console.log('and wrap the public fn with makeResilientCached(fetchFn, [\'key-vN\'], opts, fallback)')
    console.log('from lib/data/cache/resilient.ts. See lib/data/media/getSurfaceImages.ts.')
    console.log('For a DELIBERATE genuine-miss return on the error path, add `// poison-null-ok`.')
  }

  if (fixed.length > 0) {
    console.log('\nPaid-down baseline entries (remove these from scripts/poison-null-baseline.json):')
    for (const id of fixed) console.log(`  ${id}`)
  }

  process.exit(newViolations.length === 0 ? 0 : 1)
}

main()
