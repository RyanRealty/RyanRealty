import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  placeAlertsClaim,
  placeAlertsCopy,
  placeAlertsScope,
  placeAlertsSource,
  placeAlertsStickyClaim,
  publishableNewCount,
} from './place-alerts'

/** The three capture surfaces that bind the strip. The disclosure literal lives in each (ci:alert-capture-disclosure). */
const BINDERS = [
  'app/cities/[slug]/_v3/CityAlertSheet.client.tsx',
  'app/cities/[slug]/[neighborhoodSlug]/_v3/NeighborhoodAlertsSheet.client.tsx',
  'app/communities/[slug]/_v3/CommunityAlertSheet.client.tsx',
]

const PROMISE_LITERAL =
  'promise={`Every new listing in ${copy.scopePhrase}, by email. Price changes on those homes come in the same email. Unsubscribe any time.`}'

describe('publishableNewCount', () => {
  it('publishes only a real positive count', () => {
    expect(publishableNewCount(148)).toBe(148)
    expect(publishableNewCount(0)).toBeNull()
    expect(publishableNewCount(null)).toBeNull()
    expect(publishableNewCount(Number.NaN)).toBeNull()
    expect(publishableNewCount(2.4)).toBe(2)
  })
})

describe('placeAlertsCopy', () => {
  it('states the real figure as the claim on a city page (Bend, 2026-09-08: 148)', () => {
    const copy = placeAlertsCopy({ placeName: 'Bend', scopeName: 'Bend', newCount30d: 148, geoType: 'city', geoSlug: 'bend' })
    expect(copy.count).toBe('148')
    expect(copy.claim).toBe('houses came on the market in Bend in the last 30 days.')
    expect(copy.stickyClaim).toBe('houses listed in Bend in the last 30 days')
    expect(copy.eyebrow).toBe('New listings · Bend')
    expect(copy.source).toContain('148 houses')
    expect(copy.source).toContain('new_listings_30d')
    expect(copy.source).toContain('city:bend')
  })

  it('groups a large count the way every other figure is grouped', () => {
    const copy = placeAlertsCopy({ placeName: 'Bend', scopeName: 'Bend', newCount30d: 3655, geoType: 'city', geoSlug: 'bend' })
    expect(copy.count).toBe('3,655')
  })

  it('singular at one', () => {
    expect(placeAlertsClaim('Tetherow', 'Tetherow', 1)).toBe('house came on the market in Tetherow in the last 30 days.')
    expect(placeAlertsStickyClaim('Tetherow', 'Tetherow', 1)).toBe('house listed in Tetherow in the last 30 days')
  })

  it('drops the figure and the trace when the count is withheld, and still asks', () => {
    const copy = placeAlertsCopy({ placeName: 'Crosswater', scopeName: 'Crosswater', newCount30d: null, geoType: 'neighborhood', geoSlug: 'crosswater' })
    expect(copy.count).toBeNull()
    expect(copy.source).toBeUndefined()
    expect(copy.claim).toBe('New Crosswater listings, by email, as they come on the market.')
    expect(copy.stickyClaim).toBe('New Crosswater listings by email')
    expect(copy.submitLabel).toBe('Email me each one')
  })

  it('names the scope the alert really sends when it is wider than the place', () => {
    const copy = placeAlertsCopy({ placeName: 'Awbrey Butte', scopeName: 'Bend', newCount30d: 15, geoType: 'neighborhood', geoSlug: 'bend-awbrey-butte' })
    expect(copy.claim).toBe('houses came on the market in Awbrey Butte in the last 30 days.')
    expect(copy.scopePhrase).toBe('Bend, Awbrey Butte included')
    expect(placeAlertsScope('Bend', 'Bend')).toBe('Bend')
    expect(copy.sent.heading).toBe('Set. New Bend listings land by email when they hit the market.')
    expect(copy.stickyLabel).toBe('Bend listing alerts')
  })

  it('every binder carries the one promise literal, and it never says one email per listing (the cron batches per hourly run)', () => {
    for (const rel of BINDERS) {
      const src = readFileSync(resolve(rel), 'utf8')
      expect(src, rel).toContain(PROMISE_LITERAL)
      const code = src.replace(/\/\*[\s\S]*?\*\//g, '')
      expect(code, rel).not.toMatch(/one email per/i)
      // Both directions are sent under "Price changes"; the copy says so.
      expect(code, rel).not.toMatch(/price drops too/i)
    }
    expect(PROMISE_LITERAL).toMatch(/every new listing/i)
    expect(PROMISE_LITERAL).toMatch(/unsubscribe/i)
    expect(PROMISE_LITERAL).toMatch(/price changes/i)
  })

  it('the trace names the metric, the row, and the population', () => {
    const source = placeAlertsSource({ count: 2, geoType: 'neighborhood', geoSlug: 'tetherow' })
    expect(source).toMatch(/^2 houses: /)
    expect(source).toContain('neighborhood:tetherow')
    expect(source).toContain('Coming Soon excluded')
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
})
