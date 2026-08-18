#!/usr/bin/env node
/**
 * check-cma-opinion-spine.mjs — G68: seller CMAs are one price-opinion spine.
 *
 * Matt 2026-08-17: the ten items apply across the board. Do not CSS-pass a
 * marketing pitch. Do not invent a Quince-only document. Numbers stay on
 * lib/pricing/. This gate fails a commit that puts marketing, confidence
 * pills, or ZIP lines back on the seller-facing CMA HTML paths.
 *
 * Usage: node scripts/check-cma-opinion-spine.mjs
 */
import { readFileSync, existsSync } from 'node:fs'

const PATHS = [
  'lib/cma/render.ts',
  'lib/cma/immersive.ts',
  'lib/cma/cover-value.ts',
  'lib/cma/inbound-packet.ts',
  'lib/cma/register-gate.ts',
  'lib/cma/opinion-pages.ts',
  'lib/cma/opinion-scenes.ts',
  'lib/cma/market-area-chapters.ts',
  'lib/cma/render-pricing-page.ts',
  'lib/cma/band-rivals.ts',
  'lib/cma/parcel-record.ts',
  'lib/cma/seller-proceeds.ts',
  'lib/cma/mortgage-assumption.ts',
  'lib/cma/market-charts.ts',
]

const BANNED = [
  { re: /how we would market/i, label: 'how we would market' },
  { re: /what we would do/i, label: 'what we would do' },
  { re: /not the (whole )?ZIP/i, label: 'not the ZIP' },
  { re: /High confidence|Moderate confidence|Low confidence|Confidence:/, label: 'confidence pill' },
]

const REQUIRED = [
  { path: 'lib/cma/render.ts', needle: 'assembleOpinionPages' },
  { path: 'lib/cma/immersive.ts', needle: 'assembleOpinionScenes' },
  { path: 'lib/cma/build.ts', needle: "from '@/lib/cma/pricing'" },
  { path: 'lib/cma/build.ts', needle: 'computePricing' },
  { path: 'docs/plans/CMA_PRICE_OPINION_SPINE.md', needle: 'lib/pricing/' },
  { path: 'lib/cma/opinion-pages.ts', needle: 'renderParcelRecordHtml' },
  { path: 'lib/cma/opinion-scenes.ts', needle: 'renderParcelRecordScene' },
  { path: 'lib/cma/market-charts.ts', needle: "from '@/lib/charts/plot'" },
  { path: 'lib/cma/extras.ts', needle: 'resolveParcelRecord' },
  { path: 'lib/cma/market-status.ts', needle: 'similarProductClass' },
  { path: 'lib/cma/product-class.ts', needle: 'bathWindow' },
  { path: 'lib/pricing/match.ts', needle: 'ignoreCloseTiming' },
  { path: 'lib/cma/extras.ts', needle: 'tiersUsed' },
  { path: 'lib/cma/market-area-chapters.ts', needle: 'citywide cache only' },
  { path: 'lib/cma/opinion-pages.ts', needle: 'renderSellerProceedsPrintHtml' },
  { path: 'lib/cma/opinion-scenes.ts', needle: 'renderSellerProceedsSceneHtml' },
  { path: 'lib/cma/extras.ts', needle: 'buildSellerProceeds' },
]

const fails = []

for (const path of PATHS) {
  if (!existsSync(path)) {
    fails.push(`${path}: missing — the spine path must stay on disk`)
    continue
  }
  const src = readFileSync(path, 'utf8')
  for (const ban of BANNED) {
    if (ban.re.test(src)) {
      fails.push(`${path}: seller CMA path contains "${ban.label}"`)
    }
  }
}

for (const req of REQUIRED) {
  if (!existsSync(req.path)) {
    fails.push(`${req.path}: missing required spine file`)
    continue
  }
  const src = readFileSync(req.path, 'utf8')
  if (!src.includes(req.needle)) {
    fails.push(`${req.path}: must keep "${req.needle}" so the graph spine is not a one-off`)
  }
}

if (fails.length > 0) {
  console.error('CMA price-opinion spine gate FAILED:\n')
  for (const f of fails) console.error(`  ✗ ${f}`)
  console.error('\nEvery seller CMA uses docs/plans/CMA_PRICE_OPINION_SPINE.md. Numbers from lib/pricing/.')
  process.exit(1)
}

console.log(`CMA price-opinion spine OK — ${PATHS.length} seller path(s), pricing unit still wired.`)
