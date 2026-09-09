import { describe, expect, it } from 'vitest'
import { buildListingOutOfAreaNotice } from './listing-out-of-area'
import { outOfAreaListingPolicy } from '@/lib/data/listings/service-area'

/**
 * SITE-33 — the honesty block on an out-of-area listing (Matt 2026-09-08).
 *
 * Fixtures are the cities the live 2026-09-08 sitemap measurement named, and
 * the policy comes from the real predicate rather than a hand-built object, so
 * a change to the service-area allowlist shows up here.
 */
describe('buildListingOutOfAreaNotice', () => {
  it('renders nothing for a Bend home', () => {
    expect(buildListingOutOfAreaNotice(outOfAreaListingPolicy('Bend'), true)).toBeNull()
  })

  it('renders nothing for any Central Oregon city', () => {
    for (const city of ['Redmond', 'Sisters', 'Sunriver', 'La Pine', 'Prineville', 'Madras']) {
      expect(buildListingOutOfAreaNotice(outOfAreaListingPolicy(city), true)).toBeNull()
    }
  })

  it('says we do not work there, in the city tier’s own words', () => {
    const notice = buildListingOutOfAreaNotice(outOfAreaListingPolicy('Medford'), true)
    expect(notice).not.toBeNull()
    // The eyebrow is the string app/oregon/[city]/page.tsx already ships.
    expect(notice!.eyebrow).toBe('Outside our home market')
    expect(notice!.heading).toBe("We don't work in Medford")
    expect(notice!.id).toBe('out-of-area')
    const prose = notice!.paragraphs.join(' ')
    expect(prose).toContain('Ryan Realty works Central Oregon')
    expect(prose).toContain('Medford is outside that area')
    expect(prose).toContain('No cost, no obligation')
  })

  it('names the city in every paragraph that makes a claim about it', () => {
    const notice = buildListingOutOfAreaNotice(outOfAreaListingPolicy('Klamath Falls'), true)!
    expect(notice.heading).toContain('Klamath Falls')
    expect(notice.paragraphs.every((p) => p.includes('Klamath Falls'))).toBe(true)
  })

  it('stays inside the two-paragraph prose limit TASTE.md sets', () => {
    // A section with no figure and more than two paragraphs is the banned
    // wall-of-text tell. This block carries no figure by design, so the limit
    // is the whole budget.
    const notice = buildListingOutOfAreaNotice(outOfAreaListingPolicy('Medford'), true)!
    expect(notice.paragraphs.length).toBeLessThanOrEqual(2)
  })

  it('sends the reader to that city’s referral page when it resolves', () => {
    const notice = buildListingOutOfAreaNotice(outOfAreaListingPolicy('Grants Pass'), true)!
    expect(notice.doorHref).toBe('/oregon/grants-pass')
    expect(notice.doorLabel).toContain('Grants Pass')
  })

  it('never links at a 404: /contact when the city has no referral page', () => {
    // /oregon/[city] notFound()s a slug with no live snapshot row.
    const notice = buildListingOutOfAreaNotice(outOfAreaListingPolicy('Chiloquin'), false)!
    expect(notice.doorHref).toBe('/contact')
    expect(notice.doorLabel).toBe('Ask us for a broker introduction')
    // The claim itself does NOT depend on the door resolving.
    expect(notice.heading).toBe("We don't work in Chiloquin")
  })

  it('makes no claim about a row with no city', () => {
    expect(buildListingOutOfAreaNotice(outOfAreaListingPolicy(null), true)).toBeNull()
    expect(buildListingOutOfAreaNotice(outOfAreaListingPolicy(''), true)).toBeNull()
  })
})
