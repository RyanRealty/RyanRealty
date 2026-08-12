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
import { join, sep } from 'node:path'

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

/**
 * Line comments are stripped BEFORE block comments, and the order is the whole
 * point. A glob like `@/app/actions/*` written inside a `//` comment contains the
 * literal `/*`; stripping block comments first opens a phantom comment there that
 * runs to the next block-comment close in the file and swallows everything
 * between. That is what happened to the three flagship market pages: the phantom
 * ate lines 136 to 330 of app/housing-market/page.tsx, `kb-root` sat inside it,
 * and this gate skipped the highest-traffic market URL on the site for as long as
 * that one line of prose existed (found 2026-08-12,
 * docs/plans/PUBLIC_PRODUCT/gate-contracts.md section 2.1).
 */
function stripComments(src) {
  return src.replace(/(^|[^:])\/\/.*$/gm, '$1').replace(/\/\*[\s\S]*?\*\//g, '')
}

// KB page = renders the .kb-root shell, or the v3 barrel's token scope (the
// public-product destination register). Nav is global PublicNav; do not require
// a page-level KbNav import — dual-chrome kill 2026-08-10.
// Search is an app-frame surface (filters/map), not an editorial KB page.
const kbPages = walk('app').filter((p) => {
  if (p.includes(`${join('app', 'search')}`) || p.includes('app/search/')) return false
  // Dev prototypes are noindex, unlinked, and carry their own chrome. Every other
  // public-surface gate (public-ui, breadcrumb, default-chrome-footer) excludes
  // app/dev for the same reason; the page contract is about indexed pages.
  if (p.includes(`${join('app', 'dev')}${sep}`) || p.includes('app/dev/')) return false
  const s = readFileSync(p, 'utf8')
  const code = stripComments(s)
  // The v3 barrel (components/site/v3) opens its token scope with V3_ROOT_CLASS
  // instead of kb-root. Without this arm a page silently leaves the contract the
  // day it migrates: no metadata export, no rendered tracker, no emitted JSON-LD,
  // and a green gate. See docs/plans/PUBLIC_PRODUCT/gate-contracts.md section 3.4.
  return /kb-root/.test(code) || /\bV3_ROOT_CLASS\b/.test(code) || /className=["'`]v3\b/.test(code)
})

const fails = []
for (const p of kbPages) {
  const s = readFileSync(p, 'utf8')
  const hasSeo =
    /export\s+const\s+metadata\b/.test(s) || /export\s+(?:async\s+)?function\s+generateMetadata\b/.test(s)
  // Tracker must be RENDERED, not merely imported — an unused import tracks nothing.
  // Either register's tracker satisfies the contract: section tracking is analytics
  // wiring, not visual language. The v3 barrel ships no tracker today, so a migrated
  // page keeps rendering <KbSectionTracker> (recorded in
  // docs/plans/PUBLIC_PRODUCT/decisions.md, 2026-08-12).
  const hasTrackerRendered =
    /<KbSectionTracker[\s/>]/.test(s) || /<V3SectionTracker[\s/>]/.test(s)
  if (!hasSeo) fails.push(`${p}: missing SEO metadata (export const metadata OR generateMetadata)`)
  if (!hasTrackerRendered)
    fails.push(`${p}: <KbSectionTracker> is not rendered (page contract: every section view is tracked)`)

  // Data pages (those that compute verified market stats via buildMarketFaq) carry
  // the AI-citability lever: Dataset/FAQPage JSON-LD. The structured data must be
  // EMITTED (MetadataBlock) — computing FAQ/dataset variables and forgetting to
  // render them is the silent-SEO-loss regression the gate exists to stop. And the
  // emit must survive a market-pulse timeout (snapshot fallback), or the JSON-LD
  // vanishes on a slow query. The homepage uses global org/website JSON-LD and does
  // not import buildMarketFaq, so it is correctly exempt from these two checks.
  if (s.includes('buildMarketFaq')) {
    if (!/<MetadataBlock[\s/>]/.test(s))
      fails.push(`${p}: computes market FAQ/Dataset but does not render <MetadataBlock> (JSON-LD never emitted)`)
    const resilient =
      /buildMarketFaq\([^)]*\bpulse\s*\?\?/.test(s) || /pulse\s*\?\?\s*\{[\s\S]*?\}/.test(s)
    if (!resilient)
      fails.push(
        `${p}: market structured data has no pulse-timeout fallback (pulse ?? snapshot) — JSON-LD vanishes on a slow/missing market row`,
      )
  }
}

console.log('KB page-contract gate (G52)')
console.log('===========================')
console.log(`${kbPages.length} KB page(s) checked.\n`)
if (fails.length) {
  console.error('✗ KB pages missing a page-contract element (SEO and/or tracking):\n')
  for (const f of fails) console.error('  • ' + f)
  console.error(
    '\n  Every KB page hardcodes SEO (pageMetadata/generateMetadata) + a RENDERED <KbSectionTracker>.\n' +
      '  Data pages also EMIT their market JSON-LD (<MetadataBlock>) with a pulse-timeout fallback.\n' +
      '  See docs/KB_CONVERGENCE_ROADMAP.md "THE PAGE CONTRACT".',
  )
  process.exit(1)
}
console.log('All KB pages carry SEO metadata + a rendered section tracker;')
console.log('data pages emit resilient market JSON-LD.')
process.exit(0)
