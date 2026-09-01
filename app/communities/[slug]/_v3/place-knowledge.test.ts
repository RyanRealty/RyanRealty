import { describe, expect, it } from 'vitest'
import type { ResortCommunityContent } from '@/lib/resort-community-content'
import { buildPlaceKnowledge } from './place-knowledge'

describe('master-plan belonging Quiet', () => {
  it('opens with the membership number when HOA exists', () => {
    const items = buildPlaceKnowledge({
      name: 'Tetherow',
      city: 'Bend',
      aboutParagraphs: ['Tetherow sits west of Bend.'],
      content: {
        hoaMasterAnnual: 1464,
        membershipTiers: [{ name: 'Golf membership' }],
        amenities: [],
        aboutProse: [],
        driveTimes: [],
        courseRankings: [],
        courseSpecs: null,
        signatureHole: null,
        builders: [],
        slug: 'tetherow',
        name: 'Tetherow',
      } as ResortCommunityContent,
      registry: {
        subdivision_aliases: ['Tetherow', 'Sunrise Village', 'Roald West'],
      },
      schoolDistrictName: null,
      schoolDistrictSlug: null,
      isResort: true,
      countIsAliasAware: true,
      contactHref: '/contact',
      amenityPosts: {},
    })
    const first = items[0]
    expect(first && 'term' in first && first.kind === 'prose' ? first.term : null).toBe('Master HOA')
    expect(first && 'body' in first ? first.body : null).toMatch(/\$1,464 a year/)
  })

  // D103 (2026-08-27): a measured HOA median (live member listings) outranks
  // both the master assessment and the registry estimate, and the row states
  // its basis rather than printing an unexplained number beside the
  // character block's own measurement.
  it('prefers the measured HOA median over master, and states its basis', () => {
    const items = buildPlaceKnowledge({
      name: 'Tetherow',
      city: 'Bend',
      aboutParagraphs: [],
      content: {
        hoaMasterAnnual: 1464,
        membershipTiers: [],
        amenities: [],
        aboutProse: [],
        driveTimes: [],
        courseRankings: [],
        courseSpecs: null,
        signatureHole: null,
        builders: [],
        slug: 'tetherow',
        name: 'Tetherow',
      } as ResortCommunityContent,
      registry: { subdivision_aliases: [] },
      schoolDistrictName: null,
      schoolDistrictSlug: null,
      isResort: true,
      countIsAliasAware: true,
      contactHref: '/contact',
      amenityPosts: {},
      character: {
        subType: 'Single Family Residence',
        noun: 'detached homes',
        homeCount: 40,
        yearBuilt: null,
        dues: { medianMonthly: 171, reported: 6, windowFrom: '2023-08-01' },
        hoaPresence: null,
      },
    })
    const first = items[0]
    expect(first && 'term' in first && first.kind === 'prose' ? first.term : null).toBe('HOA (measured)')
    expect(first && 'body' in first ? first.body : null).toMatch(/\$2,052 a year/)
    expect(first && 'body' in first ? first.body : null).toMatch(/median of the 6 current listings that report dues/)
  })

  it('explains multi-name filing as prose and carries no subdivision doors', () => {
    // The doors moved to the page's "Subdivisions" Ledger (2026-09-01), which
    // counts and names each child through the publish layer. The Quiet keeps
    // only the knowledge row; duplicated navigation is how one page grows two
    // disagreeing subdivision lists.
    const items = buildPlaceKnowledge({
      name: 'Tetherow',
      city: 'Bend',
      aboutParagraphs: [],
      content: null,
      registry: {
        subdivision_aliases: ['Tetherow', 'Sunrise Village', 'Roald West'],
      },
      schoolDistrictName: null,
      schoolDistrictSlug: null,
      isResort: true,
      countIsAliasAware: true,
      contactHref: '/contact',
      amenityPosts: {},
    })
    const terms = items.flatMap((item) => ('term' in item ? [item.term] : []))
    expect(terms).toContain('Subdivisions in Tetherow')
    const hrefs = items.flatMap((item) => ('href' in item ? [item.href] : []))
    expect(hrefs.filter((h) => typeof h === 'string' && h.startsWith('/subdivisions/'))).toEqual([])
  })
})
