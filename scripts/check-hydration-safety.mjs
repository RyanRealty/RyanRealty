#!/usr/bin/env node
/**
 * G37 — hydration-safety gate (the React #418 regression class).
 *
 * A "use client" component that reads the wall clock (Date.now() / new Date())
 * or formats a date with an unpinned locale formatter (toLocaleDateString /
 * toLocaleTimeString without a fixed timeZone) IN ITS RENDER BODY produces
 * different output on the server vs the client. On an ISR-cached page the
 * server HTML was generated earlier, so it disagrees with the first client
 * render → React abandons hydration (Minified React error #418) and the whole
 * client tree dies (menus, sliders, links stop working). This exact bug bricked
 * ListingTile site-wide; the fix was to move the clock read into a useEffect and
 * pin every formatter to America/Los_Angeles.
 *
 * This gate bans those calls in the RENDER BODY of client components. It is safe
 * inside useEffect / useMemo / useCallback (deferred to the client, post-hydrate)
 * — those bodies are stripped before scanning. A locale formatter that passes
 * timeZone is allowed. A line with the comment `// hydration-safe` is exempted.
 *
 * Ratcheted: scripts/.hydration-safety-baseline.json records the files that
 * currently have violations; only NEW offending files fail. The baseline can
 * only shrink. Snapshot with --write-baseline.
 *
 * Run: node scripts/check-hydration-safety.mjs            # check
 *      node scripts/check-hydration-safety.mjs --write-baseline
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const BASELINE_FILE = path.join(ROOT, 'scripts', '.hydration-safety-baseline.json')
const WRITE = process.argv.includes('--write-baseline')

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) {
      if (!/node_modules|\.next|\.git|__tests__/.test(p)) walk(p, out)
    } else if (/\.tsx$/.test(e.name)) {
      out.push(p)
    }
  }
  return out
}

const rel = (f) => path.relative(ROOT, f).split(path.sep).join('/')
const isClientComponent = (src) => /^\s*['"]use client['"]\s*;?\s*$/m.test(src.split('\n').slice(0, 8).join('\n'))

/** Remove the full call expression of each useEffect/useMemo/useCallback (balanced parens). */
function stripDeferredHookBodies(src) {
  const hookRe = /\b(useEffect|useMemo|useCallback)\s*\(/g
  let result = ''
  let lastIndex = 0
  let m
  while ((m = hookRe.exec(src)) !== null) {
    const start = m.index
    // scan from the opening paren to its match
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
    // replace the stripped span with blank lines to keep line numbers stable
    result += src.slice(start, i).replace(/[^\n]/g, ' ')
    lastIndex = i
    hookRe.lastIndex = i
  }
  result += src.slice(lastIndex)
  return result
}

const BANNED = [
  { re: /\bDate\.now\s*\(\s*\)/, label: 'Date.now() in render body — move to useEffect (server/client clock disagree → #418)' },
  { re: /\bnew\s+Date\s*\(\s*\)/, label: 'new Date() (now) in render body — move to useEffect (#418)' },
]
// locale date/time formatters without a pinned timeZone (number .toLocaleString is intentionally NOT flagged)
const LOCALE_RE = /\.toLocale(DateString|TimeString)\s*\(/g

function violationsIn(file) {
  const raw = fs.readFileSync(file, 'utf8')
  if (!isClientComponent(raw)) return []
  const src = stripDeferredHookBodies(raw)
  const lines = src.split('\n')
  const hits = []
  lines.forEach((line, idx) => {
    if (line.includes('hydration-safe')) return // opt-out
    for (const b of BANNED) if (b.re.test(line)) hits.push(`L${idx + 1}: ${b.label}`)
    LOCALE_RE.lastIndex = 0
    let mm
    while ((mm = LOCALE_RE.exec(line)) !== null) {
      // allow if a timeZone option appears on this or the next 3 lines
      const window = lines.slice(idx, idx + 4).join(' ')
      if (!/timeZone/.test(window)) hits.push(`L${idx + 1}: ${mm[0]} without a pinned timeZone — pass timeZone:'America/Los_Angeles' (#418)`)
    }
  })
  return hits
}

const files = ['app', 'components'].flatMap((d) =>
  fs.existsSync(path.join(ROOT, d)) ? walk(path.join(ROOT, d)) : [],
)
const offenders = new Map()
for (const f of files) {
  const v = violationsIn(f)
  if (v.length) offenders.set(rel(f), v)
}

if (WRITE) {
  fs.writeFileSync(BASELINE_FILE, JSON.stringify({ allowed: [...offenders.keys()].sort() }, null, 2) + '\n')
  console.log(`Wrote hydration-safety baseline: ${offenders.size} files with existing violations (allowed to shrink, not grow).`)
  process.exit(0)
}

const baseline = fs.existsSync(BASELINE_FILE)
  ? new Set(JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8')).allowed)
  : new Set()
const newOffenders = [...offenders.keys()].filter((f) => !baseline.has(f)).sort()

if (newOffenders.length) {
  console.error('Hydration-safety gate FAILED — NEW client components with render-body clock reads / unpinned locale formatters (React #418 risk):')
  for (const f of newOffenders) {
    console.error(`  - ${f}`)
    for (const v of offenders.get(f)) console.error(`      ${v}`)
  }
  console.error('\nMove the clock read into a useEffect, or pin the formatter to timeZone:"America/Los_Angeles". Intentional? add // hydration-safe on the line.')
  process.exit(1)
}
console.log(`Hydration-safety gate passed (${offenders.size} baselined, 0 new).`)
