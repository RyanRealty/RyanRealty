import { describe, expect, it } from 'vitest'
import {
  CMA_DOCUMENT_TERMS,
  CMA_DOCUMENT_TERMS_VERSION,
  highlightsFromSiteFacts,
  isPublishable,
} from '@/lib/data/cma/getPublishedCma'

/**
 * The publish guard.
 *
 * `isPublishable` is the single gate every surface runs through: the ungated
 * listing-page summary, the registration that mints a delivery token, and the
 * token exchange that serves the document. If it says no, none of the three
 * produce anything. These tests are the proof of the two hard constraints:
 * nothing publishes without the per-document flag, and the ungated payload has
 * no route to per-comp sold detail.
 */

function publishableRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'cma-1',
    slug: 'cma-test',
    doc_type: 'cma',
    status: 'finalized',
    archived_at: null,
    value_low: 955000,
    value_high: 1060000,
    published_to_listing: true,
    build_summary: { pricing: { needs_review: false } },
    ...overrides,
  }
}

describe('isPublishable — the per-document opt-in', () => {
  it('accepts a finalized CMA that a human explicitly published', () => {
    expect(isPublishable(publishableRow())).toBe(true)
  })

  it('REFUSES when the publish flag is false — the whole point of the feature', () => {
    expect(isPublishable(publishableRow({ published_to_listing: false }))).toBe(false)
  })

  it('refuses when the publish flag is missing entirely (default state of every existing row)', () => {
    const row = publishableRow()
    delete (row as Record<string, unknown>).published_to_listing
    expect(isPublishable(row)).toBe(false)
  })

  it('refuses a null or undefined row', () => {
    expect(isPublishable(null)).toBe(false)
    expect(isPublishable(undefined)).toBe(false)
  })

  it('refuses anything that is not a plain CMA even when the flag is on', () => {
    // expired-audit documents analyse ANOTHER participant's failed listing.
    // ODS §7-3 withholds the right to name such properties in public
    // representations, and §5-4 W.1 bars expired and withdrawn listings from
    // display. 4 of the 7 candidate rows on 2026-07-30 were exactly this shape.
    expect(isPublishable(publishableRow({ doc_type: 'expired-audit' }))).toBe(false)
    expect(isPublishable(publishableRow({ doc_type: 'bpo' }))).toBe(false)
  })

  it('refuses a document that is not finished', () => {
    expect(isPublishable(publishableRow({ status: 'draft' }))).toBe(false)
    expect(isPublishable(publishableRow({ status: 'building' }))).toBe(false)
    expect(isPublishable(publishableRow({ status: 'archived' }))).toBe(false)
  })

  it('accepts both finished states', () => {
    expect(isPublishable(publishableRow({ status: 'finalized' }))).toBe(true)
    expect(isPublishable(publishableRow({ status: 'delivered' }))).toBe(true)
  })

  it('refuses an archived document even if the flag was left on', () => {
    expect(isPublishable(publishableRow({ archived_at: '2026-07-01T00:00:00Z' }))).toBe(false)
  })

  it('refuses when the CMA’s own audit flagged it for review', () => {
    // CLAUDE.md §0: a human ticking a box does not outrank the document's own
    // adversarial audit. On 2026-07-30 the single CMA attached to an active
    // Ryan Realty listing carried needs_review: true and a verdict of "fail".
    expect(isPublishable(publishableRow({ build_summary: { pricing: { needs_review: true } } }))).toBe(false)
  })

  it('refuses a document with no usable value range', () => {
    expect(isPublishable(publishableRow({ value_low: null, value_high: null }))).toBe(false)
    expect(isPublishable(publishableRow({ value_low: 0, value_high: 0 }))).toBe(false)
    // Inverted range means the numbers are wrong, so nothing renders.
    expect(isPublishable(publishableRow({ value_low: 1060000, value_high: 955000 }))).toBe(false)
  })
})

describe('highlightsFromSiteFacts — ungated capability facts', () => {
  // The live `build_summary.site` payload for cma-19496-tumalo-reservoir,
  // read from Supabase on 2026-07-30.
  const site = {
    zone: 'MUA10',
    septic: 'installed',
    acreage: 2.28,
    in_sfha: false,
    flood_zone: 'X',
    permit_count: 9,
    water_source: 'municipal',
    water_rights_count: 0,
    irrigation_district: 'Tumalo Irrigation District',
    wildfire_hazard: true,
  }

  it('turns county and FEMA facts into highlights, each carrying its basis', () => {
    const highlights = highlightsFromSiteFacts(site)
    expect(highlights.length).toBeGreaterThan(0)
    for (const h of highlights) {
      expect(h.headline.trim().length).toBeGreaterThan(0)
      expect(h.basis.trim().length).toBeGreaterThan(0)
    }
    expect(highlights.map((h) => h.headline)).toContain('2.28 acres')
    expect(highlights.map((h) => h.headline)).toContain('Zoned MUA10')
  })

  it('never emits a hazard as a marketing highlight', () => {
    const text = JSON.stringify(highlightsFromSiteFacts(site)).toLowerCase()
    expect(text).not.toContain('wildfire')
  })

  it('never sources a highlight from MLS or sold data', () => {
    // Capability facts come from the county and FEMA. If a basis string ever
    // starts citing the MLS, the ungated/gated boundary has moved and this
    // test is the tripwire.
    for (const h of highlightsFromSiteFacts(site)) {
      expect(h.basis.toLowerCase()).not.toContain('mls')
      expect(h.basis.toLowerCase()).not.toContain('oregon data share')
      expect(h.basis.toLowerCase()).not.toContain('sold')
      expect(h.basis.toLowerCase()).not.toContain('comparable')
    }
  })

  it('returns nothing rather than guessing when there are no site facts', () => {
    expect(highlightsFromSiteFacts(null)).toEqual([])
    expect(highlightsFromSiteFacts(undefined)).toEqual([])
    expect(highlightsFromSiteFacts({})).toEqual([])
  })
})

describe('registration terms', () => {
  it('carries every clause ODS §5-4 F requires an agreeing registrant to see', () => {
    const all = CMA_DOCUMENT_TERMS.join(' ').toLowerCase()
    // F.1 consumer-broker relationship
    expect(all).toContain('broker')
    // F.2 personal, non-commercial use
    expect(all).toContain('non-commercial')
    // F.3 bona fide interest
    expect(all).toMatch(/buying, selling, or leasing|real interest/)
    // F.4 no copying or redistribution
    expect(all).toContain('redistribute')
    // F.5 MLS copyright acknowledgment
    expect(all).toContain('copyright')
    // §5-4 H MLS access for compliance verification
    expect(all).toContain('verify that we are following mls rules')
  })

  it('imposes no financial obligation and creates no representation agreement (ODS §5-4 G)', () => {
    const all = CMA_DOCUMENT_TERMS.join(' ').toLowerCase()
    for (const banned of ['fee', 'payment', 'commission', 'you agree to pay', 'exclusive']) {
      expect(all).not.toContain(banned)
    }
  })

  it('pins a version so a later revision cannot rewrite what a past registrant accepted', () => {
    expect(CMA_DOCUMENT_TERMS_VERSION).toMatch(/^cma-doc-terms-\d{4}-\d{2}-\d{2}$/)
  })
})
