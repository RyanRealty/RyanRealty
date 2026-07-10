#!/usr/bin/env node
/**
 * check-prerender-db-safety.mjs — CI gate: "A hard-prerendered page never lets
 * a DB error escape."
 *
 * The class of failure this locks out (found 2026-07-10 on /schools/[slug]):
 * a page exports `dynamicParams = false`, so `next build` eagerly pre-renders
 * every generateStaticParams entry. If the page (or its generateMetadata)
 * awaits a DAL function that throws on a transient Supabase error (57014
 * statement timeout, pooler blip), ONE slow query fails the ENTIRE build and
 * the deploy dies. The repo-wide pattern (parks, events, golf, trails, venues)
 * is: wrap every awaited @/lib/data call in `.catch()` and fall back to the
 * static registry — a transient timeout renders a degraded page and ISR
 * retries; a real 404 still 404s. Schools was the one page missing it, and it
 * failed two deploys before this gate existed.
 *
 * Rule: in any app/x/page.tsx that contains `dynamicParams = false`, every
 * awaited call to an identifier imported from '@/lib/data' (or a subpath) must
 * carry `.catch(` somewhere in its trailing method chain. `await Promise.all/
 * allSettled(...)` expressions containing a DAL identifier are held to the
 * same rule (allSettled never rejects, so it passes by construction). A DAL
 * call passed to `withTimeoutFallback(...)` is safe by construction — that
 * helper resolves rejections to its fallback (lib/with-timeout-fallback.ts).
 *
 * Opt-out: `// @prerender-db-ok` on the line directly above the await, for a
 * call that is deliberately allowed to throw at build time.
 *
 * Usage:
 *   node scripts/check-prerender-db-safety.mjs            # CI mode
 *   node scripts/check-prerender-db-safety.mjs --report   # never exits 1
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve, relative } from 'node:path'

const ROOT = resolve(new URL('.', import.meta.url).pathname, '..')
const APP_DIR = join(ROOT, 'app')
const REPORT = process.argv.includes('--report')

function walkPages(dir, acc = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      walkPages(full, acc)
    } else if (entry === 'page.tsx' || entry === 'page.ts') {
      acc.push(full)
    }
  }
  return acc
}

/** Identifiers value-imported from '@/lib/data' or any '@/lib/data/...' subpath. */
function dalImports(src) {
  const names = new Set()
  const importRe = /import\s*(?:type\s*)?\{([^}]*)\}\s*from\s*['"]@\/lib\/data(?:\/[^'"]*)?['"]/g
  for (const m of src.matchAll(importRe)) {
    // A `import type {...}` block is types-only — skip entirely.
    if (/^import\s*type/.test(m[0])) continue
    for (const spec of m[1].split(',')) {
      const s = spec.trim()
      if (!s || s.startsWith('type ')) continue
      // `orig as alias` — the local name is the alias.
      const local = s.includes(' as ') ? s.split(' as ').pop().trim() : s
      if (local) names.add(local)
    }
  }
  return names
}

/** Index of the char after the matching `)` for the `(` at src[openIdx]. */
function skipBalanced(src, openIdx) {
  let depth = 0
  for (let i = openIdx; i < src.length; i += 1) {
    const ch = src[i]
    if (ch === '(') depth += 1
    else if (ch === ')') {
      depth -= 1
      if (depth === 0) return i + 1
    } else if (ch === '"' || ch === "'" || ch === '`') {
      // Skip string/template contents so parens inside strings don't count.
      const quote = ch
      i += 1
      while (i < src.length && src[i] !== quote) {
        if (src[i] === '\\') i += 1
        i += 1
      }
    }
  }
  return src.length
}

/**
 * From the end of a call, walk the trailing method chain (`.name(...)` links)
 * and report whether any link is `.catch(`.
 */
function chainHasCatch(src, pos) {
  let i = pos
  for (;;) {
    while (i < src.length && /\s/.test(src[i])) i += 1
    if (src[i] !== '.') return false
    const m = /^\.\s*([A-Za-z_$][\w$]*)\s*\(/.exec(src.slice(i))
    if (!m) return false
    if (m[1] === 'catch') return true
    i = skipBalanced(src, i + m[0].length - 1)
  }
}

function lineOf(src, idx) {
  return src.slice(0, idx).split('\n').length
}

function checkFile(pagePath) {
  const src = readFileSync(pagePath, 'utf8')
  if (!/\bdynamicParams\s*=\s*false\b/.test(src)) return []

  const dal = dalImports(src)
  if (dal.size === 0) return []

  const violations = []
  const lines = src.split('\n')
  const awaitRe = /\bawait\s+(Promise\s*\.\s*(?:all|allSettled)|[A-Za-z_$][\w$]*)\s*\(/g

  for (const m of src.matchAll(awaitRe)) {
    const callee = m[1].replace(/\s+/g, '')
    const openIdx = m.index + m[0].length - 1
    const callEnd = skipBalanced(src, openIdx)

    let risky = false
    if (callee === 'Promise.all') {
      // A DAL call inside the Promise.all is only risky when it can reject —
      // one wrapped in withTimeoutFallback(...) resolves to its fallback on
      // rejection, so blank out those spans before scanning for DAL names.
      let inner = src.slice(openIdx, callEnd)
      const safeRe = /\bwithTimeoutFallback\s*\(/g
      for (const w of inner.matchAll(safeRe)) {
        const wEnd = skipBalanced(inner, w.index + w[0].length - 1)
        inner = inner.slice(0, w.index) + ' '.repeat(wEnd - w.index) + inner.slice(wEnd)
      }
      risky = [...dal].some((name) => new RegExp(`\\b${name}\\s*\\(`).test(inner))
    } else if (callee === 'Promise.allSettled') {
      risky = false // never rejects
    } else {
      risky = dal.has(callee)
    }
    if (!risky) continue
    if (chainHasCatch(src, callEnd)) continue

    const line = lineOf(src, m.index)
    const prev = (lines[line - 2] ?? '').trim()
    if (prev.includes('@prerender-db-ok')) continue

    violations.push({ file: relative(ROOT, pagePath), line, callee })
  }
  return violations
}

function main() {
  const pages = walkPages(APP_DIR)
  const scanned = []
  const violations = []
  for (const p of pages) {
    const v = checkFile(p)
    if (readFileSync(p, 'utf8').includes('dynamicParams = false')) scanned.push(relative(ROOT, p))
    violations.push(...v)
  }

  console.log('Prerender DB-safety check (dynamicParams = false pages)')
  console.log('========================================================')
  console.log(`Hard-prerendered pages scanned: ${scanned.length}`)
  console.log(`Unguarded awaited DAL calls:    ${violations.length}`)
  if (violations.length > 0) {
    console.log()
    for (const v of violations) console.log(`  ${v.file}:${v.line}  await ${v.callee}(...) has no .catch()`)
    console.log()
    console.log('Fix: wrap the call in `.catch()` with a static-registry fallback (see')
    console.log('app/parks/[slug]/page.tsx:96 for the canonical pattern), or add')
    console.log('`// @prerender-db-ok` on the line above if a build-time throw is intended.')
  }
  process.exit(REPORT || violations.length === 0 ? 0 : 1)
}

main()
