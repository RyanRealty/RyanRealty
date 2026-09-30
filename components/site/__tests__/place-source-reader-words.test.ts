/**
 * THE WHOLE SOURCE LINE IN A READER'S WORDS, ON EVERY PLACE PAGE (SITE-193,
 * 2026-09-24).
 *
 * V3SourceLine.reader-names.test.ts holds the folded NAME a reader sees before
 * opening a trace. The taste pass on /communities/tetherow read the opened
 * trace: "days to pending 42 — market_metric neighborhood:tetherow", and the
 * homes source listed MLS status names. The same served pages also printed
 * "(market_metric median_list_active, detached)", "(market_metric
 * financing_mix)", "(lib/mortgage.ts)", "read from market_history_weekly",
 * "read through the Market Truth metric layer" and "Sold history is leftover"
 * (read from next start, 2026-09-24). This file runs the builders behind those
 * lines, and reads the route files that write theirs inline, and holds the
 * whole trace to the reader's words: no table, column, file or layer name, no
 * MLS status name, no em dash.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn, revalidateTag: () => {} }))

/** Shop words: tables, columns, files, the metric layer, MLS status names, the em dash. */
const SHOP_WORDS =
  /market_metric|_mv\b|\b[a-z]+_[a-z]+_?[a-z]*\b|lib\/|\.ts\b|metric layer|Market Truth|leftover|Active Under Contract|Coming Soon|—/

function expectReaderWords(label: string, text: string) {
  expect(text, `${label}: "${text}"`).not.toMatch(SHOP_WORDS)
  expect(text.trim().length, label).toBeGreaterThan(0)
}

describe('place source lines: the whole trace in a reader’s words', () => {
  it('the city and neighborhood market traces and their stated absences', async () => {
    const { cityMarketTrace, marketAbsenceItems } = await import('@/app/cities/[slug]/_v3/city-sections')
    const { neighborhoodMarketTrace, neighborhoodMarketAbsenceItems } = await import(
      '@/app/cities/[slug]/[neighborhoodSlug]/_v3/neighborhood-sections'
    )
    for (const hasMos of [true, false]) {
      expectReaderWords('city market', cityMarketTrace('Bend', hasMos))
      expectReaderWords('neighborhood market', neighborhoodMarketTrace('Awbrey Butte', hasMos))
    }
    for (const item of [...marketAbsenceItems('Bend', true), ...neighborhoodMarketAbsenceItems('Awbrey Butte', true)]) {
      expectReaderWords('market absence', String((item as { body?: unknown }).body ?? ''))
    }
  }, 60_000)

  it('the place door at every grain', async () => {
    const { placeDoorTrace } = await import('@/lib/market/publish-place-door')
    for (const grain of ['city', 'neighborhood', 'community', 'subdivision'] as const) {
      expectReaderWords(`door ${grain}`, placeDoorTrace({ grain, placeName: 'Bend' }))
    }
  })

  it('the homes under the map and the comparable sales', async () => {
    const { placeInventorySource, placeBoundaryClause } = await import('@/lib/place/place-inventory-source')
    const { compsReaderSource } = await import('@/lib/cma/place-comps')
    expectReaderWords('homes', placeInventorySource(placeBoundaryClause('Tetherow')))
    for (const found of [true, false]) expectReaderWords('comps', compsReaderSource(found))
  })

  it('the affordability median, mix and arithmetic at city and neighborhood', async () => {
    const { publishPlaceAffordability } = await import('@/lib/place/publish-place-affordability')
    const { affordabilityFigures } = await import('@/components/site/v3/V3PlaceAffordability.view')
    for (const grain of ['city', 'neighborhood'] as const) {
      const props = publishPlaceAffordability({
        placeName: 'Bend',
        placeSlug: 'bend',
        grain,
        medianListPrice: 910_000,
        activeCount: 756,
        computedAt: '2026-09-24T12:00:00.000Z',
        browseHref: '/cities/bend#homes',
        rate: {
          ratePct: 6.35,
          rateFraction: 0.0635,
          weekStart: '2026-09-21',
          source: 'fred:MORTGAGE30US',
          capturedAt: '2026-09-21T13:00:00.000+00:00',
        },
        fallbackRatePct: 7,
        mix: {
          financing: [
            { key: 'conventional', share: 0.55, floor: false },
            { key: 'cash', share: 0.39, floor: false },
          ],
          features: [],
          bedrooms: [],
        },
        cashShare: 0.39,
      } as unknown as Parameters<typeof publishPlaceAffordability>[0])!
      expectReaderWords(`${grain} median`, props.medianSource)
      expectReaderWords(`${grain} mix`, props.mixSource)
      const figures = affordabilityFigures({
        placeName: props.placeName,
        mode: 'financed',
        solved: {
          price: 910_000,
          monthly: 5_000,
          ceiling: 910_000,
          ceilingMonthly: 5_000,
          downPayment: 182_000,
          loanAmount: 728_000,
        },
        medianListPrice: props.medianListPrice,
        medianMonthly: 5_000,
        medianSource: props.medianSource,
        medianSourceName: props.medianSourceName,
        termsSource: '20% down, 6.35%, 30 years.',
        mix: props.mix,
        mixSource: props.mixSource,
        mixSourceName: props.mixSourceName,
      })
      for (const f of figures) expectReaderWords(`${grain} figure ${f.key}`, String(f.source ?? ''))
    }
  })

  it('the route files that write a source line inline', () => {
    // Code only: a comment may name the table a figure comes from.
    const code = (path: string) =>
      readFileSync(resolve(path), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '')
    const INLINE =
      /read through the Market Truth|metric layer|Sold history is leftover|\(market_metric|\(lib\/mortgage\.ts\)|read from market_history_weekly|Active and Active Under Contract/
    // The community page and its value ask are held at main's copy until the
    // community class reaches its taste mark (Matt 2026-09-25, "fix first,
    // then ship"); they rejoin this list when that class ships.
    for (const path of [
      'app/cities/[slug]/page.tsx',
      'app/cities/[slug]/[neighborhoodSlug]/page.tsx',
      'app/subdivisions/page.tsx',
      'app/sell/_v3/SellAnswer.tsx',
      'components/site/v3/V3PlaceAffordability.client.tsx',
      'lib/data/places/getPlaceValueAnswer.ts',
    ]) {
      expect(code(path), path).not.toMatch(INLINE)
    }
  })
})
