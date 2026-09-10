import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  earnsDisplayFigure,
  joinClaimParts,
  joinNames,
  newestFirstHref,
  PLACE_ALERTS_FIGURE_MIN,
  placeAlertsClaim,
  placeAlertsCopy,
  placeAlertsScope,
  placeAlertsScopeLine,
  placeAlertsSource,
  placeAlertsStickyClaim,
  placeAlertsStickyNote,
  publishableNewCount,
  readableMatchNames,
} from './place-alerts'

/** The three capture surfaces that bind the strip. The disclosure literal lives in each (ci:alert-capture-disclosure). */
const BINDERS = [
  'app/cities/[slug]/_v3/CityAlertSheet.client.tsx',
  'app/cities/[slug]/[neighborhoodSlug]/_v3/NeighborhoodAlertsSheet.client.tsx',
  'app/communities/[slug]/_v3/CommunityAlertSheet.client.tsx',
]

const PROMISE_LITERAL =
  "promise={`Every new listing${copy.promiseScope ? ` in ${copy.promiseScope}` : ''}, by email. Price changes on those homes come in the same email. Unsubscribe any time.`}"

/**
 * The strip's cadence sentence. It stays a LITERAL in each binder — the file
 * that calls the capture action — because ci:alert-capture-disclosure reads
 * that file for a frequency sentence and an unsubscribe sentence. What wraps it
 * (placeAlertsStickyNote, which folds the scope in front of it) may move; the
 * sentence may not leave the binder.
 */
const STICKY_NOTE_LITERAL = "'Every new listing by email. Unsubscribe any time.'"

describe('publishableNewCount', () => {
  it('publishes only a real positive count', () => {
    expect(publishableNewCount(148)).toBe(148)
    expect(publishableNewCount(0)).toBeNull()
    expect(publishableNewCount(null)).toBeNull()
    expect(publishableNewCount(Number.NaN)).toBeNull()
    expect(publishableNewCount(2.4)).toBe(2)
  })
})

describe('the display numeral threshold', () => {
  it('is ten, and the numeral is reserved for counts at or above it', () => {
    expect(PLACE_ALERTS_FIGURE_MIN).toBe(10)
    expect(earnsDisplayFigure(10)).toBe(true)
    expect(earnsDisplayFigure(148)).toBe(true)
    expect(earnsDisplayFigure(9)).toBe(false)
    expect(earnsDisplayFigure(2)).toBe(false)
    expect(earnsDisplayFigure(null)).toBe(false)
  })

  it('below it the sentence leads and carries the digit (Tetherow, 2026-09-08: 2)', () => {
    const copy = placeAlertsCopy({ placeName: 'Tetherow', scopeName: 'Tetherow', newCount30d: 2, geoType: 'neighborhood', geoSlug: 'tetherow' })
    expect(copy.count).toBeNull()
    expect(copy.claim).toBe('2 houses came on the market in Tetherow in the last 30 days.')
    expect(copy.stickyClaim).toEqual({
      before: '2 houses came on the market in',
      place: 'Tetherow',
      after: 'in the last 30 days.',
    })
    // The trace still carries the figure: the count is real, only its form changed.
    expect(copy.source).toMatch(/^2 houses: /)
  })

  it('at or above it the numeral is the claim (Bend, 2026-09-08: 148)', () => {
    const copy = placeAlertsCopy({ placeName: 'Bend', scopeName: 'Bend', newCount30d: 148, geoType: 'city', geoSlug: 'bend' })
    expect(copy.count).toBe('148')
    expect(copy.claim).toBe('houses came on the market in Bend in the last 30 days.')
    expect(copy.stickyClaim).toEqual({
      before: 'houses came on the market in',
      place: 'Bend',
      after: 'in the last 30 days.',
    })
    expect(copy.eyebrow).toBe('New listings · Bend')
    // No scope line on a same-scope city, so the promise names the city itself.
    expect(copy.scopeLine).toBeNull()
    expect(copy.promiseScope).toBe('Bend')
    expect(copy.source).toContain('148 houses')
    expect(copy.source).toContain('new_listings_30d')
    expect(copy.source).toContain('city:bend')
    expect(copy.browseLabel).toBe('See the newest Bend listings')
  })

  it('singular at one, inline', () => {
    expect(placeAlertsClaim('Tetherow', 'Tetherow', 1)).toBe('1 house came on the market in Tetherow in the last 30 days.')
    expect(placeAlertsStickyClaim('Tetherow', 'Tetherow', 1)).toEqual({
      before: '1 house came on the market in',
      place: 'Tetherow',
      after: 'in the last 30 days.',
    })
  })
})

/**
 * ONE FACT, ONE SENTENCE. The callout and the sticky repeat carry the same
 * count; when they carried it in two wordings ("came on the market in" and
 * "listed in") a reader had to check whether they were two figures.
 */
describe('the callout and the strip render one sentence', () => {
  const cases: Array<[string, string, number | null]> = [
    ['Bend', 'Bend', 148],
    ['Tetherow', 'Tetherow', 2],
    ['Awbrey Butte', 'Bend', 15],
    ['Tetherow', 'Tetherow', 1],
    ['Crosswater', 'Crosswater', null],
  ]

  it.each(cases)('%s / %s / %s: the joined parts ARE the claim', (place, scope, n) => {
    const copy = placeAlertsCopy({ placeName: place, scopeName: scope, newCount30d: n, geoType: 'neighborhood', geoSlug: 'x' })
    expect(joinClaimParts(copy.stickyClaim)).toBe(copy.claim)
  })

  it('and the sentence ends, so neither mount trails off', () => {
    expect(placeAlertsStickyClaim('Bend', 'Bend', 148).after.endsWith('.')).toBe(true)
  })
})

describe('placeAlertsCopy', () => {
  it('names condos as condos when that type is selected', () => {
    const copy = placeAlertsCopy({
      placeName: 'Bend',
      scopeName: 'Bend',
      newCount30d: 12,
      geoType: 'city',
      geoSlug: 'bend',
      noun: { one: 'condo', many: 'condos' },
    })
    expect(copy.count).toBe('12')
    expect(copy.claim).toBe('condos came on the market in Bend in the last 30 days.')
  })

  it('groups a large count the way every other figure is grouped', () => {
    const copy = placeAlertsCopy({ placeName: 'Bend', scopeName: 'Bend', newCount30d: 3655, geoType: 'city', geoSlug: 'bend' })
    expect(copy.count).toBe('3,655')
  })

  it('drops the figure and the trace when the count is withheld, and still asks', () => {
    const copy = placeAlertsCopy({ placeName: 'Crosswater', scopeName: 'Crosswater', newCount30d: null, geoType: 'neighborhood', geoSlug: 'crosswater' })
    expect(copy.count).toBeNull()
    expect(copy.source).toBeUndefined()
    expect(copy.claim).toBe('New Crosswater listings, by email, as they come on the market.')
    expect(copy.stickyClaim).toEqual({
      before: 'New',
      place: 'Crosswater',
      after: 'listings, by email, as they come on the market.',
    })
    expect(copy.scopeLine).toBeNull()
    expect(copy.submitLabel).toBe('Email me each one')
  })

  it('names the scope the alert really sends when it is wider than the place, under the claim too', () => {
    const copy = placeAlertsCopy({ placeName: 'Awbrey Butte', scopeName: 'Bend', newCount30d: 15, geoType: 'neighborhood', geoSlug: 'bend-awbrey-butte' })
    expect(copy.claim).toBe('houses came on the market in Awbrey Butte in the last 30 days.')
    expect(copy.scopePhrase).toBe('Bend, Awbrey Butte included')
    expect(copy.scopeLine).toBe('The alert covers all of Bend, Awbrey Butte included.')
    // The scope line says it; the promise does not say it again 200px away.
    expect(copy.promiseScope).toBeNull()
    expect(placeAlertsScope('Bend', 'Bend')).toBe('Bend')
    expect(copy.sent.heading).toBe('Set. New Bend listings land by email when they hit the market.')
    expect(copy.stickyLabel).toBe('Bend listing alerts')
  })

  it('names the MLS names a community alert matches, and never a plat fragment (Tetherow files "Triple")', () => {
    const copy = placeAlertsCopy({
      placeName: 'Tetherow',
      scopeName: 'Tetherow',
      newCount30d: 2,
      geoType: 'neighborhood',
      geoSlug: 'tetherow',
      matchNames: ['Tetherow', 'Triple', 'Tetherow Resort'],
    })
    expect(copy.scopeLine).toBe('The alert covers every listing the MLS files under Tetherow or Tetherow Resort.')
    expect(copy.scopeLine).not.toContain('Triple')
    expect(copy.promiseScope).toBeNull()
    expect(placeAlertsScopeLine({ placeName: 'Bend', scopeName: 'Bend', matchNames: ['Bend'] })).toBeNull()
    expect(placeAlertsScopeLine({ placeName: 'Bend', scopeName: 'Bend' })).toBeNull()
    expect(joinNames(['A'])).toBe('A')
    expect(joinNames(['A', 'B'])).toBe('A or B')
  })

  it('every binder carries the one promise literal and the strip note, and never says one email per listing (the cron batches per hourly run)', () => {
    for (const rel of BINDERS) {
      const src = readFileSync(resolve(rel), 'utf8')
      expect(src, rel).toContain(PROMISE_LITERAL)
      expect(src, rel).toContain(STICKY_NOTE_LITERAL)
      const code = src.replace(/\/\*[\s\S]*?\*\//g, '')
      expect(code, rel).not.toMatch(/one email per/i)
      // Both directions are sent under "Price changes"; the copy says so.
      expect(code, rel).not.toMatch(/price drops too/i)
    }
    expect(PROMISE_LITERAL).toMatch(/every new listing/i)
    expect(PROMISE_LITERAL).toMatch(/unsubscribe/i)
    expect(PROMISE_LITERAL).toMatch(/price changes/i)
    expect(STICKY_NOTE_LITERAL).toMatch(/every new listing/i)
    expect(STICKY_NOTE_LITERAL).toMatch(/unsubscribe/i)
  })

  it('the trace names the metric, the row, and the population', () => {
    const source = placeAlertsSource({ count: 2, geoType: 'neighborhood', geoSlug: 'tetherow' })
    expect(source).toMatch(/^2 houses: /)
    expect(source).toContain('neighborhood:tetherow')
    expect(source).toContain('Coming Soon excluded')
  })
})

/**
 * The rendered list drops what a visitor cannot read as this place. The QUERY
 * is untouched: the binder still hands the capture action the whole match set,
 * and this function never touches it.
 */
describe('readableMatchNames', () => {
  it('drops a plat fragment and keeps every name that reads as the place', () => {
    expect(readableMatchNames('Tetherow', ['Tetherow', 'Triple', 'Tetherow Resort'])).toEqual([
      'Tetherow',
      'Tetherow Resort',
    ])
    expect(readableMatchNames('Pronghorn', ['Pronghorn', 'Pronghorn Resort', 'Pronghorn Golf Club'])).toHaveLength(3)
  })

  it('keeps a shorter name the place contains ("Black Butte" under "Black Butte Ranch")', () => {
    expect(readableMatchNames('Black Butte Ranch', ['Black Butte Ranch', 'Black Butte'])).toEqual([
      'Black Butte Ranch',
      'Black Butte',
    ])
  })

  it('says one name once, whatever the punctuation', () => {
    expect(readableMatchNames('Mt Bachelor Village', ['Mt Bachelor Village', 'Mt. Bachelor Village'])).toEqual([
      'Mt Bachelor Village',
    ])
  })

  it('is empty for an empty place, and skips blanks', () => {
    expect(readableMatchNames('', ['Tetherow'])).toEqual([])
    expect(readableMatchNames('Tetherow', ['  ', 'Tetherow'])).toEqual(['Tetherow'])
  })
})

/** The strip's one line: the scope where there is one, then the cadence. */
describe('placeAlertsStickyNote', () => {
  const cadence = 'Every new listing by email. Unsubscribe any time.'

  it('leads with the scope where the alert sends wider than the count', () => {
    expect(placeAlertsStickyNote('The alert covers all of Bend, Awbrey Butte included.', cadence)).toBe(
      `The alert covers all of Bend, Awbrey Butte included. ${cadence}`,
    )
  })

  it('is the cadence alone where the scope is the place (the city class)', () => {
    expect(placeAlertsStickyNote(null, cadence)).toBe(cadence)
    expect(placeAlertsStickyNote('   ', cadence)).toBe(cadence)
  })

  it('always states the frequency and the way out', () => {
    const note = placeAlertsStickyNote('The alert covers all of Bend, Awbrey Butte included.', cadence)
    expect(note).toMatch(/every new listing/i)
    expect(note).toMatch(/unsubscribe/i)
  })
})

describe('newestFirstHref', () => {
  it('adds the newest sort the search surfaces read, once', () => {
    expect(newestFirstHref('/homes-for-sale/bend')).toBe('/homes-for-sale/bend?sort=newest')
    expect(newestFirstHref('/homes-for-sale/bend?beds=3')).toBe('/homes-for-sale/bend?beds=3&sort=newest')
    expect(newestFirstHref('/homes-for-sale/bend?sort=price_asc')).toBe('/homes-for-sale/bend?sort=price_asc')
    expect(newestFirstHref('')).toBe('')
  })
})

describe('the sentence matches the SQL it is built on', () => {
  const sql = readFileSync(resolve('scripts/sql/compute_market_metrics_hud_windows_shadow.sql'), 'utf8')

  it('new_listings_30d is a distinct count of single-family houses by on-market date, Coming Soon excluded', () => {
    expect(sql).toMatch(/new_listings_30d/)
    expect(sql).toMatch(/property_sub_type = 'Single Family Residence'/)
    expect(sql).toMatch(/IS DISTINCT FROM 'Coming Soon'/)
    expect(sql).toMatch(/on_market_date > v_30/)
  })

  it('the alert cron is hourly, which is why the promise says every listing rather than one email each', () => {
    const vercel = JSON.parse(readFileSync(resolve('vercel.json'), 'utf8')) as { crons: Array<{ path: string; schedule: string }> }
    const cron = vercel.crons.find((c) => c.path === '/api/cron/saved-search-alerts')
    expect(cron?.schedule).toBe('0 * * * *')
  })

  it('a community alert matches the registry alias set exactly, case-insensitively', () => {
    const search = readFileSync(resolve('app/actions/search.ts'), 'utf8')
    const dal = readFileSync(resolve('lib/data/listings/searchListingsAll.ts'), 'utf8')
    expect(search).toMatch(/getSubdivisionMatchNames\(name\)/)
    expect(dal).toMatch(/\.in\(\s*'subdivision_lower'/)
    expect(dal).toMatch(/\.eq\('subdivision_lower'/)
  })
})
