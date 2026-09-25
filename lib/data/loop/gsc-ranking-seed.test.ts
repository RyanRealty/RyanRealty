import { describe, expect, it } from 'vitest'

import {
  alreadySeeded,
  buildClassSlipDrafts,
  buildGscGapDrafts,
  RESEED_AFTER_DAYS,
  type SiteRow,
} from './gsc-ranking-seed'
import { diffRollups } from './gsc-trend'

const now = new Date('2026-09-23T12:00:00Z')
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000).toISOString()

describe('buildGscGapDrafts (the seeder, moved to lib for the cron, PROCESS-1)', () => {
  it('mints numbered SITE drafts for real queries and drops rank-tracker probes', () => {
    const { drafts } = buildGscGapDrafts({
      queries: [
        { q: '"tetherow homes for sale"', impressions: 400, clicks: 0, position: 22 },
        { q: 'sunriver homes for sale', impressions: 300, clicks: 0, position: 40 },
      ],
      queryPages: [],
      landings: null,
      targetQueries: [],
      existing: [{ version_gap: 'SITE-192', title: 'x', state: 'done', updated_at: daysAgo(1) }],
      now,
    })
    expect(drafts.map((d) => d.versionGap)).toEqual(['SITE-193'])
    expect(drafts[0]?.title).toBe('GSC gap [zero-click] sunriver homes for sale → /communities/sunriver (pos 40.0, 300 impr, CTR 0.00%)')
    expect(drafts.some((d) => d.title.includes('tetherow'))).toBe(false)
  })

  it('finds a split landing from query x page rows', () => {
    const { drafts } = buildGscGapDrafts({
      queries: [],
      queryPages: [
        { q: 'brasada ranch homes for sale', path: '/communities/brasada-ranch', impressions: 100, clicks: 0, position: 12 },
        { q: 'brasada ranch homes for sale', path: '/homes-for-sale/powell-butte/brasada-ranch', impressions: 300, clicks: 0, position: 11 },
      ],
      landings: null,
      targetQueries: [],
      existing: [],
      now,
    })
    expect(drafts[0]?.title).toMatch(/^GSC gap \[cannibal\] brasada ranch homes for sale → \/communities\/brasada-ranch /)
  })

  it('a variant that asks for another page class is not a split landing (SITE-196)', () => {
    // The 2026-08-26..09-22 rows behind SITE-196, as GSC returned them: the
    // exact query sat on /cities/bend alone; the report and the broker pages
    // held the market / agent / companies variants that are theirs.
    const { drafts } = buildGscGapDrafts({
      queries: [],
      queryPages: [
        { q: 'bend oregon real estate market', path: '/housing-market/bend', impressions: 11, clicks: 0, position: 32.7 },
        { q: 'bend oregon real estate statistics', path: '/housing-market/bend', impressions: 7, clicks: 0, position: 22.7 },
        { q: 'bend oregon real estate trends', path: '/housing-market/bend', impressions: 3, clicks: 0, position: 21 },
        { q: 'bend oregon real estate', path: '/cities/bend', impressions: 2, clicks: 0, position: 37 },
        { q: 'bend oregon real estate statistics', path: '/housing-market', impressions: 2, clicks: 0, position: 66.5 },
        { q: 'bend oregon real estate agent', path: '/rebecca-ryser-peterson/', impressions: 1, clicks: 0, position: 41 },
        { q: 'bend oregon real estate companies', path: '/', impressions: 1, clicks: 0, position: 21 },
      ],
      landings: null,
      targetQueries: [],
      existing: [],
      now,
    })
    expect(drafts.filter((d) => d.title.includes('[cannibal]'))).toEqual([])
  })

  it('a same-class variant on another URL still splits the landing', () => {
    const { drafts } = buildGscGapDrafts({
      queries: [],
      queryPages: [
        { q: 'caldera springs homes for sale', path: '/communities/caldera-springs', impressions: 2, clicks: 0, position: 34 },
        { q: 'caldera springs homes for sale', path: '/blog/caldera-springs-buyers-guide', impressions: 1, clicks: 0, position: 8 },
        { q: 'caldera springs real estate', path: '/housing-market/sunriver/caldera-springs', impressions: 2, clicks: 0, position: 8.5 },
        { q: 'caldera springs prices', path: '/blog/caldera-springs-buyers-guide', impressions: 12, clicks: 0, position: 8.3 },
      ],
      landings: null,
      targetQueries: [],
      existing: [],
      now,
    })
    const cannibal = drafts.find((d) => d.title.includes('[cannibal]'))
    expect(cannibal?.title).toMatch(/caldera springs homes for sale → \/communities\/caldera-springs \(pos 34\.0, 5 impr/)
    expect(cannibal?.title).not.toMatch(/17 impr/)
  })
})

describe('alreadySeeded: dedupe against the graph', () => {
  const title = 'GSC gap [cannibal] tetherow homes for sale → /communities/tetherow (pos 27.1, 421 impr, CTR 0.00%)'

  it('a live node blocks the same kind + winner', () => {
    expect(alreadySeeded([{ version_gap: 'SITE-182', title, state: 'open', updated_at: daysAgo(90) }], 'cannibal', '/communities/tetherow', now)).toBe(true)
  })

  it('a node closed within the accept window still blocks; after it, the gap can return', () => {
    const recent: SiteRow = { version_gap: 'SITE-182', title, state: 'done', updated_at: daysAgo(RESEED_AFTER_DAYS - 1) }
    const old: SiteRow = { version_gap: 'SITE-182', title, state: 'done', updated_at: daysAgo(RESEED_AFTER_DAYS + 1) }
    expect(alreadySeeded([recent], 'cannibal', '/communities/tetherow', now)).toBe(true)
    expect(alreadySeeded([old], 'cannibal', '/communities/tetherow', now)).toBe(false)
  })

  it('a killed node blocks for good: a kill is a recorded decision, not a failed fix', () => {
    const killed: SiteRow = { version_gap: 'SITE-182', title, state: 'killed', updated_at: daysAgo(RESEED_AFTER_DAYS * 4) }
    expect(alreadySeeded([killed], 'cannibal', '/communities/tetherow', now)).toBe(true)
  })

  it('a row read without state always counts as seeded, and a longer winner is not a match', () => {
    expect(alreadySeeded([{ version_gap: 'SITE-182', title }], 'cannibal', '/communities/tetherow', now)).toBe(true)
    expect(alreadySeeded([{ version_gap: 'SITE-182', title }], 'cannibal', '/communities/tether', now)).toBe(false)
  })

  describe('the 2026-09-24 trap: a live node on a winner blocks every kind on that winner', () => {
    it('a live cannibal node blocks a zero-click seed on the same winner', () => {
      const live: SiteRow = { version_gap: 'SITE-183', title, state: 'blocked', updated_at: daysAgo(1) }
      expect(alreadySeeded([live], 'zero-click', '/communities/tetherow', now)).toBe(true)
    })

    it('a blocked node blocks (blocked is live, not closed)', () => {
      const blocked: SiteRow = { version_gap: 'SITE-183', title, state: 'blocked', updated_at: daysAgo(1) }
      expect(alreadySeeded([blocked], 'depth', '/communities/tetherow', now)).toBe(true)
    })

    it('a killed node of another kind does NOT block — a kill is a decision about that one kind', () => {
      const killed: SiteRow = { version_gap: 'SITE-182', title, state: 'killed', updated_at: daysAgo(RESEED_AFTER_DAYS * 4) }
      expect(alreadySeeded([killed], 'zero-click', '/communities/tetherow', now)).toBe(false)
      // same kind still blocks for good (unchanged behavior)
      expect(alreadySeeded([killed], 'cannibal', '/communities/tetherow', now)).toBe(true)
    })

    it('a done node older than RESEED_AFTER_DAYS does not block, even for another kind', () => {
      const old: SiteRow = { version_gap: 'SITE-182', title, state: 'done', updated_at: daysAgo(RESEED_AFTER_DAYS + 1) }
      expect(alreadySeeded([old], 'zero-click', '/communities/tetherow', now)).toBe(false)
      expect(alreadySeeded([old], 'cannibal', '/communities/tetherow', now)).toBe(false)
    })

    it('a different winner with the same prefix does not block', () => {
      const live: SiteRow = { version_gap: 'SITE-183', title, state: 'open', updated_at: daysAgo(1) }
      expect(alreadySeeded([live], 'zero-click', '/communities/tetherow-annex', now)).toBe(false)
      expect(alreadySeeded([live], 'zero-click', '/communities/tether', now)).toBe(false)
    })
  })
})

describe('buildClassSlipDrafts: a degraded money class becomes one node', () => {
  const degraded = diffRollups(
    [{ pageClass: 'community', market: 'central-oregon', pages: 20, clicks: 3, impressions: 700, position: 30.2 }],
    [{ pageClass: 'community', market: 'central-oregon', pages: 22, clicks: 9, impressions: 1200, position: 22.1 }],
  )

  it('titles the class, the route and the slip, and numbers after the query gaps', () => {
    const { drafts, nextSiteNumber } = buildClassSlipDrafts({ degraded, anchor: '2026-09-20', existing: [], firstSiteNumber: 200, now })
    expect(drafts).toHaveLength(1)
    expect(drafts[0]?.versionGap).toBe('SITE-200')
    expect(drafts[0]?.title).toBe('GSC gap [class-slip] community → /communities/[slug] (central-oregon) (impr -41.7%, pos +8.1)')
    expect(drafts[0]?.accept).toMatch(/within 15% of 1200/)
    expect(nextSiteNumber).toBe(201)
  })

  it('does not seed the same class twice while its node is live', () => {
    const first = buildClassSlipDrafts({ degraded, anchor: '2026-09-20', existing: [], firstSiteNumber: 200, now })
    const again = buildClassSlipDrafts({
      degraded,
      anchor: '2026-09-27',
      existing: [{ version_gap: 'SITE-200', title: first.drafts[0]!.title, state: 'open', updated_at: daysAgo(1) }],
      firstSiteNumber: 201,
      now,
    })
    expect(again.drafts).toEqual([])
  })
})
