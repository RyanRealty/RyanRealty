#!/usr/bin/env node
/**
 * check-pdf-trace-guard.mjs (ci:pdf-trace-guard)
 *
 * Keeps the PDF render stack (puppeteer-core + @sparticuz/chromium-min) in the
 * Vercel function of every route that can send a CMA email.
 *
 * Why: lib/cma/send.ts imports the PDF renderer before the email is built. Both
 * packages are serverExternalPackages, so they are loaded from node_modules at
 * runtime and MUST be in the function's file trace. On 2026-09-16 they were put
 * on the global outputFileTracingExcludes['*'] list, which strips them from
 * every function (excludes apply after includes). From then on every CMA send
 * in prod died with "Failed to load external module puppeteer-core-...:
 * ERR_MODULE_NOT_FOUND" before any mail was built.
 *
 * This gate fails if:
 *   1. puppeteer-core or @sparticuz/chromium-min appear in the global '*'
 *      exclude list (directly or through REPO_DUMP_TRACE_EXCLUDES).
 *   2. A page or route whose import graph reaches sendCmaToLead or
 *      sendProspectingEmailIntro is missing from PDF_SEND_TRACE_ROUTES in
 *      next.config.ts (the list that gets the explicit puppeteer includes).
 *   3. A PDF_SEND_TRACE_ROUTES key would not match its route under Turbopack.
 *      Turbopack matches keys as globs against "app" + the entry's original
 *      name (e.g. "app/admin/(protected)/cmas/[slug]/page"), so a raw "[slug]"
 *      is a one-character class and silently matches nothing. Dynamic segments
 *      must be escaped: "app/admin/(protected)/cmas/\\[slug\\]/page".
 *   4. A listed key points at a route file that no longer exists.
 *   5. PDF_SEND_TRACE_ROUTES is not actually applied to outputFileTracingIncludes.
 *
 * Usage: node scripts/check-pdf-trace-guard.mjs [--list]
 */
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { join, dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CONFIG_PATH = join(ROOT, 'next.config.ts')
const PDF_PACKAGES = ['puppeteer-core', '@sparticuz/chromium-min']
const SEND_TARGETS = [
  { file: 'lib/cma/send.ts', symbol: 'sendCmaToLead' },
  { file: 'app/actions/prospecting.ts', symbol: 'sendProspectingEmailIntro' },
]
// Entries that reach a send but deliberately drop the PDF stack through a
// per-route exclude. Each must still carry that exclude, or it must be listed.
const KNOWN_EXCEPTIONS = new Map([
  [
    'app/admin/(protected)/bpo/page',
    {
      excludeKey: "'app/admin/(protected)/bpo/page': [...BPO_LAMBDA_TRACE_EXCLUDES]",
      why: 'BPO list lambda drops the PDF stack for the 250 MB cap; a CMA sent from its deliverable dialog cannot render the PDF there',
    },
  ],
])
const EXTS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']
const ENTRY_RE = /^(page|route)\.(tsx?|jsx?)$/
const SEGMENT_FILE_RE = /^(layout|template|default|error|loading|not-found|global-error)\.(tsx?|jsx?)$/

const failures = []
const fail = (msg) => failures.push(msg)

// ---------------------------------------------------------------------------
// next.config.ts parsing (source text; the config is TS and Node 20 cannot
// import it directly). The blocks are delimited so the parse stays simple.
// ---------------------------------------------------------------------------
const config = readFileSync(CONFIG_PATH, 'utf8')

function arrayBlock(startToken, label) {
  const at = config.indexOf(startToken)
  if (at === -1) {
    fail(`next.config.ts: could not find ${label} (${startToken})`)
    return ''
  }
  const open = config.indexOf('[', at + startToken.length - 1)
  let depth = 0
  for (let i = open; i < config.length; i++) {
    if (config[i] === '[') depth++
    else if (config[i] === ']') {
      depth--
      if (depth === 0) return config.slice(open + 1, i)
    }
  }
  fail(`next.config.ts: unterminated ${label}`)
  return ''
}

function stripComments(s) {
  return s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"])\/\/.*$/gm, '$1')
}

function stringLiterals(block) {
  const out = []
  const re = /'((?:\\.|[^'\\])*)'/g
  let m
  while ((m = re.exec(stripComments(block)))) out.push(m[1].replace(/\\\\/g, '\\'))
  return out
}

const excludesAt = config.indexOf('outputFileTracingExcludes:')
if (excludesAt === -1) fail('next.config.ts: outputFileTracingExcludes not found')
const starAt = config.indexOf("'*': [", excludesAt)
const starBlock = starAt === -1 ? '' : (() => {
  const saved = config
  return arrayBlockFrom(saved, starAt + "'*': ".length)
})()

function arrayBlockFrom(text, open) {
  let depth = 0
  for (let i = open; i < text.length; i++) {
    if (text[i] === '[') depth++
    else if (text[i] === ']') {
      depth--
      if (depth === 0) return text.slice(open + 1, i)
    }
  }
  return ''
}

if (starAt === -1) fail("next.config.ts: outputFileTracingExcludes['*'] not found")
const starEntries = stringLiterals(starBlock)
const starCode = stripComments(starBlock)
const spreads = [...starCode.matchAll(/\.\.\.([A-Z_][A-Z0-9_]*)/g)].map((m) => m[1])
const globalExcludes = [...starEntries]
for (const name of spreads) {
  globalExcludes.push(...stringLiterals(arrayBlock(`const ${name} = [`, name)))
}
for (const pkg of PDF_PACKAGES) {
  const hit = globalExcludes.find((g) => g.includes(`node_modules/${pkg}`) || g.includes(`node_modules/${pkg.split('/')[0]}/**`))
  if (hit) {
    fail(
      `outputFileTracingExcludes['*'] contains "${hit}". ${pkg} is a serverExternalPackage used by the CMA send path; ` +
        'a global exclude strips it from every function and every CMA send fails with ERR_MODULE_NOT_FOUND. ' +
        'Exclude it per-route (static keys only) if a lambda truly must drop it.',
    )
  }
}

const listedKeys = stringLiterals(arrayBlock('const PDF_SEND_TRACE_ROUTES = [', 'PDF_SEND_TRACE_ROUTES'))
const includeList = stringLiterals(arrayBlock('const PDF_RENDER_TRACE_INCLUDES = [', 'PDF_RENDER_TRACE_INCLUDES'))
for (const pkg of PDF_PACKAGES) {
  if (!includeList.includes(`./node_modules/${pkg}/**`)) {
    fail(`PDF_RENDER_TRACE_INCLUDES must contain './node_modules/${pkg}/**'`)
  }
}
if (!/outputFileTracingIncludes:\s*withPdfRenderIncludes\(/.test(config)) {
  fail('next.config.ts: outputFileTracingIncludes must be wrapped in withPdfRenderIncludes(...) so PDF_SEND_TRACE_ROUTES applies')
}

/** Turbopack include key for an entry file: "app" + original name, brackets escaped. */
export function traceKeyFor(entryRel) {
  const name = entryRel.replace(/\.(tsx?|jsx?)$/, '')
  return name.replace(/\[/g, '\\[').replace(/\]/g, '\\]')
}

/** Unescape a listed key back to the literal entry name it must match. */
function literalFromKey(key) {
  return key.replace(/\\\[/g, '[').replace(/\\\]/g, ']')
}

for (const key of listedKeys) {
  const unescapedBracket = /(^|[^\\])[[\]]/.test(key)
  if (unescapedBracket) {
    fail(`PDF_SEND_TRACE_ROUTES key "${key}" has an unescaped [ or ]. Turbopack reads it as a character class and it matches no route. Write \\\\[slug\\\\] in the source.`)
  }
  if (/[*?{}]/.test(key)) fail(`PDF_SEND_TRACE_ROUTES key "${key}" must be a literal entry name, not a glob`)
  const lit = literalFromKey(key)
  if (!EXTS.some((e) => existsSync(join(ROOT, lit + e)))) {
    fail(`PDF_SEND_TRACE_ROUTES key "${key}" points at no route file (${lit}.ts/.tsx). Remove it or fix the path.`)
  }
}

// ---------------------------------------------------------------------------
// Import graph: which app entries reach the send targets?
// ---------------------------------------------------------------------------
const importCache = new Map()

function resolveSpec(fromFile, spec) {
  let base
  if (spec.startsWith('@/')) base = join(ROOT, spec.slice(2))
  else if (spec.startsWith('./') || spec.startsWith('../')) base = resolve(dirname(fromFile), spec)
  else return null
  const candidates = [base, ...EXTS.map((e) => base + e), ...EXTS.map((e) => join(base, 'index' + e))]
  // "./foo.js" written for a .ts file
  if (/\.(m|c)?js$/.test(base)) {
    const stem = base.replace(/\.(m|c)?js$/, '')
    candidates.push(stem + '.ts', stem + '.tsx')
  }
  for (const c of candidates) {
    try {
      if (statSync(c).isFile()) return c
    } catch {
      /* next */
    }
  }
  return null
}

function importsOf(file) {
  if (importCache.has(file)) return importCache.get(file)
  let src = ''
  try {
    src = readFileSync(file, 'utf8')
  } catch {
    importCache.set(file, [])
    return []
  }
  const specs = new Set()
  const res = [
    /\b(?:import|export)\s+(?!type\b)[^'"`;]*?\sfrom\s*['"]([^'"]+)['"]/g,
    /\bimport\s*['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ]
  for (const re of res) {
    let m
    while ((m = re.exec(src))) specs.add(m[1])
  }
  const out = []
  for (const s of specs) {
    const r = resolveSpec(file, s)
    if (r && !r.includes(`${ROOT}/node_modules/`)) out.push(r)
  }
  importCache.set(file, out)
  return out
}

const targetAbs = new Set(SEND_TARGETS.map((t) => join(ROOT, t.file)))
for (const t of SEND_TARGETS) {
  const abs = join(ROOT, t.file)
  if (!existsSync(abs) || !new RegExp(`export\\s+async\\s+function\\s+${t.symbol}\\b`).test(readFileSync(abs, 'utf8'))) {
    fail(`${t.symbol} is no longer exported from ${t.file}. Update SEND_TARGETS in scripts/check-pdf-trace-guard.mjs.`)
  }
}

const reachMemo = new Map()
function reaches(file, stack = new Set()) {
  if (targetAbs.has(file)) return true
  if (reachMemo.has(file)) return reachMemo.get(file)
  if (stack.has(file)) return false
  stack.add(file)
  let hit = false
  for (const dep of importsOf(file)) {
    if (reaches(dep, stack)) {
      hit = true
      break
    }
  }
  stack.delete(file)
  // Only memoize positives and results computed outside a cycle's interior;
  // a negative inside a cycle might be premature, so recompute it later.
  if (hit || stack.size === 0) reachMemo.set(file, hit)
  return hit
}

function walk(dir, acc) {
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, ent.name)
    if (ent.isDirectory()) walk(p, acc)
    else acc.push(p)
  }
  return acc
}

const appFiles = walk(join(ROOT, 'app'), [])
const segmentFilesByDir = new Map()
for (const f of appFiles) {
  const base = f.slice(dirname(f).length + 1)
  if (SEGMENT_FILE_RE.test(base)) {
    const d = dirname(f)
    if (!segmentFilesByDir.has(d)) segmentFilesByDir.set(d, [])
    segmentFilesByDir.get(d).push(f)
  }
}

const reaching = []
for (const f of appFiles) {
  const base = f.slice(dirname(f).length + 1)
  if (!ENTRY_RE.test(base)) continue
  // A page's function also carries its ancestor layouts/templates/boundaries.
  const roots = [f]
  if (base.startsWith('page.')) {
    for (let d = dirname(f); d.startsWith(join(ROOT, 'app')); d = dirname(d)) {
      roots.push(...(segmentFilesByDir.get(d) ?? []))
    }
  }
  if (roots.some((r) => reaches(r))) reaching.push(relative(ROOT, f))
}
reaching.sort()

const listedLiteral = new Set(listedKeys.map(literalFromKey))
for (const entry of reaching) {
  const lit = entry.replace(/\.(tsx?|jsx?)$/, '')
  const known = KNOWN_EXCEPTIONS.get(lit)
  if (known && config.includes(known.excludeKey)) {
    console.log(`ci:pdf-trace-guard: known exception ${entry} (${known.why})`)
    continue
  }
  if (!listedLiteral.has(lit)) {
    fail(
      `${entry} reaches ${SEND_TARGETS.map((t) => t.symbol).join('/')} (which loads puppeteer-core) but is not in PDF_SEND_TRACE_ROUTES. ` +
        `Add '${traceKeyFor(entry).replace(/\\/g, '\\\\')}' to PDF_SEND_TRACE_ROUTES in next.config.ts.`,
    )
  }
}

if (process.argv.includes('--list')) {
  console.log('Send-reaching entries:')
  for (const e of reaching) console.log(`  ${e}  ->  '${traceKeyFor(e).replace(/\\/g, '\\\\')}'`)
}

if (failures.length) {
  console.error(`ci:pdf-trace-guard: ${failures.length} problem(s)`)
  for (const f of failures) console.error(`  ✗ ${f}`)
  process.exit(1)
}
console.log(
  `ci:pdf-trace-guard: ok. ${reaching.length} send-reaching entries, all carry the puppeteer-core/chromium-min include; no global exclude of the PDF stack.`,
)
