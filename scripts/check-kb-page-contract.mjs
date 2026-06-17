#!/usr/bin/env node
/**
 * G52 — KB page contract guard (Matt directive 2026-06-17: "must be hardcoded").
 *
 * Every KB page (a page.tsx that renders the kinetic-brutalist shell — detected by
 * importing the KB nav) MUST ship the page contract from docs/KB_CONVERGENCE_ROADMAP.md:
 *   1. SEO for Google + LLMs — a `metadata` export OR `generateMetadata` (title /
 *      description / canonical via pageMetadata), so the page is never un-titled.
 *   2. Tracking — <KbSectionTracker> so every section view + scroll depth is recorded
 *      (GA4/Pixel + our internal store). The page-level view tracker is page-specific
 *      (CityPageTracker, homepage_view, ...), but the section tracker is universal.
 *
 * This makes the contract self-enforcing: a new KB page cannot ship without SEO and
 * tracking baked in. Prose is not enough.
 *
 * Usage: node scripts/check-kb-page-contract.mjs
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join } from 'node:path'

function walk(dir, out = []) {
  if (!existsSync(dir)) return out
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next') continue
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (name === 'page.tsx') out.push(p)
  }
  return out
}

const kbPages = walk('app').filter((p) => readFileSync(p, 'utf8').includes('components/site/kb/KbNav'))

const fails = []
for (const p of kbPages) {
  const s = readFileSync(p, 'utf8')
  const hasSeo =
    /export\s+const\s+metadata\b/.test(s) || /export\s+(?:async\s+)?function\s+generateMetadata\b/.test(s)
  const hasTracker = /KbSectionTracker/.test(s)
  if (!hasSeo) fails.push(`${p}: missing SEO metadata (export const metadata OR generateMetadata)`)
  if (!hasTracker) fails.push(`${p}: missing <KbSectionTracker> (page contract: every section view is tracked)`)
}

console.log('KB page-contract gate (G52)')
console.log('===========================')
console.log(`${kbPages.length} KB page(s) checked.\n`)
if (fails.length) {
  console.error('✗ KB pages missing a page-contract element (SEO and/or tracking):\n')
  for (const f of fails) console.error('  • ' + f)
  console.error(
    '\n  Every KB page hardcodes SEO (pageMetadata/generateMetadata) + tracking (<KbSectionTracker>).\n' +
      '  See docs/KB_CONVERGENCE_ROADMAP.md "THE PAGE CONTRACT".',
  )
  process.exit(1)
}
console.log('All KB pages carry SEO metadata + section tracking.')
process.exit(0)
