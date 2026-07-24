#!/usr/bin/env node
/**
 * check-no-explore-route.mjs — ci:no-explore-route (W8.4).
 *
 * The custom-filter market explore tool is RETIRED in favor of the pre-generated
 * /housing-market/[geo] reports (with the timeframe selector). This gate makes
 * the retirement un-reversible-by-accident:
 *
 *   1. NO EXPLORE PAGE. Neither app/reports/explore/ nor app/housing-market/
 *      explore/ may contain a page.tsx — re-adding the route fails here.
 *   2. REDIRECTS EXIST. next.config.ts must redirect both explore routes to a
 *      live destination, so old links + bookmarks resolve.
 *   3. NO NEW LINKS. No source file (app/ components/ lib/, excluding tests +
 *      next.config) may hyperlink /reports/explore or /housing-market/explore —
 *      a new link would 308-bounce and reads as a live feature.
 *
 * Exit 0 = explore is gone, redirected, and unlinked.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = process.cwd()
const problems = []

// 1. no explore page routes
for (const dir of ['app/reports/explore', 'app/housing-market/explore']) {
  if (existsSync(join(ROOT, dir, 'page.tsx'))) {
    problems.push(`${dir}/page.tsx exists — the explore tool is retired (W8.4). Delete it; the canonical /housing-market/[geo] report replaces it.`)
  }
}

// 2. redirects in next.config
const nextConfig = existsSync(join(ROOT, 'next.config.ts')) ? readFileSync(join(ROOT, 'next.config.ts'), 'utf8') : ''
for (const route of ['/reports/explore', '/housing-market/explore']) {
  const re = new RegExp(`source:\\s*['"]${route.replace(/\//g, '\\/')}['"]`)
  if (!re.test(nextConfig)) {
    problems.push(`next.config.ts is missing a redirect for ${route} — retired routes must redirect so old links resolve.`)
  }
}

// 3. no new links to the explore routes (source only; tests + next.config allowed)
const LINK_RE = /['"`](?:\/reports\/explore|\/housing-market\/explore)(?:[?#'"`]|$)/
function walk(dir) {
  for (const name of readdirSync(join(ROOT, dir))) {
    const rel = join(dir, name)
    if (rel.includes('node_modules') || rel.includes('.next')) continue
    const st = statSync(join(ROOT, rel))
    if (st.isDirectory()) {
      walk(rel)
      continue
    }
    if (!/\.(ts|tsx)$/.test(name)) continue
    if (/\.test\.tsx?$|__tests__/.test(rel)) continue // tests may reference the retired path
    const src = readFileSync(join(ROOT, rel), 'utf8')
    if (LINK_RE.test(src)) {
      problems.push(`${relative(ROOT, join(ROOT, rel))}: links to the retired explore route — point to /housing-market or the canonical /housing-market/[geo] report.`)
    }
  }
}
for (const top of ['app', 'components', 'lib']) if (existsSync(join(ROOT, top))) walk(top)

console.log('Explore-route retirement gate (ci:no-explore-route)')
console.log('===================================================')
if (problems.length) {
  for (const p of problems) console.error(`  ✗ ${p}`)
  console.error(`\n\x1b[31m✗ ci:no-explore-route: ${problems.length} problem(s).\x1b[0m`)
  process.exit(1)
}
console.log('✓ Explore tool retired: no page routes, both routes redirect, no source links.')
process.exit(0)
