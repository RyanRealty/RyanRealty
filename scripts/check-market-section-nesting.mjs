#!/usr/bin/env node
/**
 * check-market-section-nesting.mjs — ONE market section per page (G: ci:market-section-nesting).
 *
 * Matt, 2026-07-29: "one 'market' section per page instead of two stacked,
 * separately-headed sections." `KbMarketHud` was given a `children` prop for
 * exactly that, and `app/communities/[slug]/page.tsx` adopted it the same day.
 * `app/cities/[slug]/page.tsx` kept stacking `<MarketCoreCharts>` as a SIBLING
 * for another eight days — nobody noticed, because nothing checked (C-17).
 *
 * THE RULE (decidable, no semantics): in any file that renders BOTH
 * `<KbMarketHud` and `<MarketCoreCharts`, the MarketCoreCharts tag must appear
 * before the `</KbMarketHud>` close tag. A self-closing `<KbMarketHud ... />`
 * cannot contain children at all, so its presence alongside MarketCoreCharts is
 * an automatic fail.
 *
 * Deliberately NOT checked: whether the charts *should* be on the page, or
 * whether their heading duplicates the HUD's. A gate cannot decide that; the
 * prose rule lives in docs/MECHANICAL_GATES.md.
 *
 * Usage:
 *   node scripts/check-market-section-nesting.mjs
 *   node scripts/check-market-section-nesting.mjs --report   # never fails
 */

import { readFileSync } from 'node:fs'
import { relative } from 'node:path'
import { walkFiles } from './lib/walk.mjs'

const REPORT = process.argv.includes('--report')
const HUD_OPEN = '<KbMarketHud'
const HUD_CLOSE = '</KbMarketHud>'
const CHARTS = '<MarketCoreCharts'

const files = walkFiles('app').sort()
const fails = []
let pagesWithBoth = 0

for (const file of files) {
  const src = readFileSync(file, 'utf8')
  const hudAt = src.indexOf(HUD_OPEN)
  const chartsAt = src.indexOf(CHARTS)
  // Only pages rendering both are in scope. An import line alone is not a render:
  // the JSX open tag "<KbMarketHud" / "<MarketCoreCharts" is what we match.
  if (hudAt === -1 || chartsAt === -1) continue
  pagesWithBoth++

  const rel = relative(process.cwd(), file)
  const closeAt = src.indexOf(HUD_CLOSE, hudAt)

  if (closeAt === -1) {
    fails.push(
      `${rel}: <KbMarketHud> is self-closing but the page also renders <MarketCoreCharts>. ` +
        `The charts must be its children, not a sibling section.`,
    )
    continue
  }
  if (chartsAt > closeAt) {
    const line = src.slice(0, chartsAt).split('\n').length
    fails.push(
      `${rel}:${line}: <MarketCoreCharts> renders AFTER </KbMarketHud> — that is a second stacked, ` +
        `separately-headed market section. Pass it as KbMarketHud children (see app/communities/[slug]/page.tsx).`,
    )
  }
}

console.log('market-section nesting gate (ci:market-section-nesting)')
console.log('======================================================')
console.log(`Pages rendering both KbMarketHud and MarketCoreCharts: ${pagesWithBoth}`)

if (fails.length === 0) {
  console.log(`\n✓ OK — every one nests the charts inside the HUD. One market section per page.`)
  process.exit(0)
}

console.log(`\n✗ ${fails.length} stacked market section(s):`)
for (const f of fails) console.log(`  ${f}`)
console.log('\nMatt 2026-07-29: one market section per page. KbMarketHud takes `children` for this.')
process.exit(REPORT ? 0 : 1)
