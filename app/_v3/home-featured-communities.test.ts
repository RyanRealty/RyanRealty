/**
 * Home featured community slides — no invented figures; photo required.
 */
import { describe, expect, it } from 'vitest'
import {
  HOME_FEATURED_COMMUNITY_SLUGS,
  HOME_FEATURED_COMMUNITY_SOURCE,
  buildHomeFeaturedCommunitySlide,
  buildHomeFeaturedCommunitySlides,
  buildHomeFeaturedCommunitySlidesFromRegistry,
  homeFeaturedBlurb,
  homeFeaturedSalesFigures,
} from './home-featured-communities'
import { communityPublicPair } from '@/lib/communities/community-public-pair'
import type { ResortCommunityEntry } from '@/lib/data/communities/registry'
import type { ResortCommunityContent } from '@/lib/resort-community-content'

const entry = (slug: string, label: string, city = 'Bend'): ResortCommunityEntry =>
  ({
    slug,
    label,
    city,
    city_slug: city.toLowerCase(),
    is_resort: true,
    broad_radius_km: 4,
    center_lon_lat: [-121.3, 44.0],
    subdivision_aliases: [label],
    sub_neighborhoods: [],
    child_count: 0,
  }) as ResortCommunityEntry

const content = (about: string[]): ResortCommunityContent =>
  ({
    slug: 'tetherow',
    name: 'Tetherow',
    aboutProse: about,
    amenities: [],
    driveTimes: [],
    courseRankings: [],
    courseSpecs: null,
    signatureHole: null,
    membershipTiers: [],
    builders: [],
  }) as ResortCommunityContent

describe('homeFeaturedSalesFigures', () => {
  it('publishes alias-aware active + median and new-this-week; withholds alias-attributed closes (DATA-7)', () => {
    const figures = homeFeaturedSalesFigures({
      figures: { activeCount: 35, medianListPrice: 1_250_000 },
      pulse: {
        geoType: 'community',
        geoSlug: 'tetherow',
        activeCount: 12,
        medianListPrice: 900_000,
        newThisWeek: 2,
        priceDropsThisWeek: 0,
        closedLast30Days: 4,
        monthsOfSupply: null,
        medianDaysToPending: 39.5,
        refreshedAt: '2026-09-01T00:00:00.000Z',
      },
    })
    // The community pulse row's sold count and days to pending come from a
    // subdivision-name join (lib/market/geo-grain-trust.ts): never printed.
    expect(figures.map((f) => f.label)).toEqual([
      'homes for sale',
      'median list price',
      'new this week',
    ])
    expect(figures[0]?.value).toBe('35')
    expect(figures[0]?.n).toBe(35)
    expect(figures[1]?.value).toContain('1,250,000')
    expect(figures[1]?.n).toBe(1_250_000)
  })

  it('keeps closed-side figures at a grain whose closes share the actives predicate', () => {
    const figures = homeFeaturedSalesFigures({
      figures: null,
      pulse: {
        geoType: 'city',
        geoSlug: 'sisters',
        activeCount: null,
        medianListPrice: null,
        newThisWeek: 0,
        priceDropsThisWeek: 0,
        closedLast30Days: 4,
        monthsOfSupply: null,
        medianDaysToPending: 39.5,
        refreshedAt: '2026-09-01T00:00:00.000Z',
      },
    })
    expect(figures.map((f) => f.label)).toEqual(['homes sold, last 30 days', 'days to an offer'])
  })

  it('never prints the neighborhood pulse closes the loader reads', () => {
    const figures = homeFeaturedSalesFigures({
      figures: null,
      pulse: {
        geoType: 'neighborhood',
        geoSlug: 'tetherow',
        activeCount: null,
        medianListPrice: null,
        newThisWeek: 0,
        priceDropsThisWeek: 0,
        closedLast30Days: 3,
        monthsOfSupply: null,
        medianDaysToPending: 21,
        refreshedAt: '2026-09-01T00:00:00.000Z',
      },
    })
    expect(figures).toEqual([])
  })

  it('withholds zeros and missing overlay figures', () => {
    expect(
      homeFeaturedSalesFigures({
        figures: { activeCount: 0, medianListPrice: null },
        pulse: {
          geoType: 'community',
          geoSlug: 'x',
          activeCount: null,
          medianListPrice: null,
          newThisWeek: 0,
          priceDropsThisWeek: 0,
          closedLast30Days: 0,
          monthsOfSupply: null,
          medianDaysToPending: null,
          refreshedAt: '2026-09-01T00:00:00.000Z',
        },
      }),
    ).toEqual([])
  })
})

describe('homeFeaturedBlurb', () => {
  it('uses the first authored about sentence', () => {
    expect(
      homeFeaturedBlurb(
        content(['Tetherow sits west of Bend. Second paragraph stays off Home.']),
        entry('tetherow', 'Tetherow'),
      ),
    ).toBe('Tetherow sits west of Bend.')
  })

  it('misses when there is no authored copy', () => {
    expect(homeFeaturedBlurb(null, entry('tetherow', 'Tetherow'))).toBeNull()
  })
})

describe('buildHomeFeaturedCommunitySlide', () => {
  it('requires a dedicated photo and keeps registry href', () => {
    expect(
      buildHomeFeaturedCommunitySlide({
        entry: entry('no-photo-slug', 'Missing Photo'),
        content: null,
        figures: { activeCount: 3, medianListPrice: 500_000 },
        pulse: null,
        photoSrc: null,
      }),
    ).toBeNull()

    const slide = buildHomeFeaturedCommunitySlide({
      entry: entry('tetherow', 'Tetherow'),
      content: content(['Tetherow sits west of Bend.']),
      figures: { activeCount: 35, medianListPrice: 1_250_000 },
      pulse: null,
      photoSrc: '/lp/tetherow/img/tetherow-aerial-course.jpg',
    })
    expect(slide).toMatchObject({
      slug: 'tetherow',
      name: 'Tetherow',
      city: 'Bend',
      href: '/communities/tetherow',
      photoSrc: '/lp/tetherow/img/tetherow-aerial-course.jpg',
      blurb: 'Tetherow sits west of Bend.',
    })
    expect(slide?.figures[0]).toEqual({ value: '35', label: 'homes for sale', n: 35 })
  })

  it('builds only slides that resolve', () => {
    const slides = buildHomeFeaturedCommunitySlides([
      {
        entry: entry('tetherow', 'Tetherow'),
        content: null,
        figures: null,
        pulse: null,
        photoSrc: '/lp/tetherow/img/tetherow-aerial-course.jpg',
      },
      {
        entry: entry('missing', 'Missing'),
        content: null,
        figures: null,
        pulse: null,
        photoSrc: null,
      },
    ])
    expect(slides).toHaveLength(1)
    expect(slides[0]?.slug).toBe('tetherow')
  })
})

describe('HOME_FEATURED_COMMUNITY_SLUGS', () => {
  it('stays a curated registry set with MarketPulse source copy', () => {
    expect(HOME_FEATURED_COMMUNITY_SLUGS.length).toBeGreaterThanOrEqual(4)
    expect(HOME_FEATURED_COMMUNITY_SLUGS).toContain('tetherow')
    expect(HOME_FEATURED_COMMUNITY_SOURCE).toMatch(/Oregon Data Share via MarketPulse/)
    // VOICE-6: the population in the reader's words, not "Alias-aware".
    expect(HOME_FEATURED_COMMUNITY_SOURCE).not.toMatch(/alias/i)
    expect(HOME_FEATURED_COMMUNITY_SOURCE).toMatch(/subdivision names/)
  })
})

describe('buildHomeFeaturedCommunitySlidesFromRegistry', () => {
  it('publishes curated registry+photo slides without enrichment', () => {
    const slides = buildHomeFeaturedCommunitySlidesFromRegistry()
    expect(slides.length).toBeGreaterThanOrEqual(4)
    expect(slides.some((s) => s.slug === 'tetherow')).toBe(true)
    for (const slide of slides) {
      expect(slide.photoSrc.length).toBeGreaterThan(0)
      expect(slide.href).toBe(communityPublicPair({ slug: slide.slug, label: slide.name }).href)
    }
  })
})
