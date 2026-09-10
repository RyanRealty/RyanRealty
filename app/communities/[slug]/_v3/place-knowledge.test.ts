import { describe, expect, it } from 'vitest'
import type { ResortCommunityContent } from '@/lib/resort-community-content'
import { matchGeoLinksForPost } from '@/lib/blog-geo-links'
import { buildPlaceKnowledge, communityGuides } from './place-knowledge'

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
    // The HOA is a FACT row now, not a sentence: the community configs hold it
    // as a number and it was being written out as prose (2026-09-02).
    const first = items[0]
    expect(first && first.kind === 'fact' ? first.term : null).toBe('Master HOA')
    expect(first && first.kind === 'fact' ? first.value : null).toBe('$1,464 a year')
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
    expect(first && first.kind === 'fact' ? first.term : null).toBe('HOA from homes here')
    expect(first && first.kind === 'fact' ? first.value : null).toBe('$2,052 a year')
    expect(first && first.kind === 'fact' ? first.detail : null).toMatch(
      /median of the 6 current listings that report dues/,
    )
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

  // The authored story is LAST and folded (2026-09-02). It used to open the
  // section, which is how #belonging became a 2,974px essay above every figure.
  // Folding is not cutting: the paragraphs are in the item and in the DOM.
  it('puts the about paragraphs in one fold at the end, with every paragraph kept', () => {
    const items = buildPlaceKnowledge({
      name: 'Tetherow',
      city: 'Bend',
      aboutParagraphs: ['One about Tetherow.', 'Two about Tetherow.'],
      content: null,
      registry: null,
      schoolDistrictName: null,
      schoolDistrictSlug: null,
      isResort: false,
      countIsAliasAware: false,
      contactHref: '/contact',
      amenityPosts: {},
    })
    const folds = items.filter((item) => item.kind === 'fold')
    expect(folds).toHaveLength(1)
    const fold = folds[0]
    expect(fold && fold.kind === 'fold' ? fold.term : null).toBe('More about Tetherow')
    expect(fold && fold.kind === 'fold' ? fold.body : null).toEqual([
      'One about Tetherow.',
      'Two about Tetherow.',
    ])
    // Last, so the figures above it are what the section leads with.
    expect(items.at(-1)).toBe(fold)
    // And nowhere else: the paragraphs are not also printed above.
    const prose = items.filter((item) => item.kind === 'prose')
    for (const item of prose) {
      const body = item.kind === 'prose' ? item.body : ''
      expect(String(body)).not.toContain('One about Tetherow.')
    }
  })

  it('puts second-home copy behind a disclosure, not an open paragraph', () => {
    const items = buildPlaceKnowledge({
      name: 'Tetherow',
      city: 'Bend',
      aboutParagraphs: [],
      content: null,
      registry: null,
      schoolDistrictName: null,
      schoolDistrictSlug: null,
      isResort: true,
      countIsAliasAware: false,
      contactHref: '/contact',
      amenityPosts: {},
    })
    const second = items.find((item) => item.kind === 'fold' && item.term === 'Second homes')
    expect(second && second.kind === 'fold' ? second.body : null).toBe(
      'Short-term rental potential in Tetherow varies by HOA rules, community covenants, and Oregon regulations. Ask for the current rental guidelines before you assume what is permitted or what it could earn.',
    )
    expect(items.some((item) => item.kind === 'prose' && 'term' in item && item.term === 'Second homes')).toBe(
      false,
    )
  })
})

describe('communityGuides — the place→blog direction', () => {
  const matcher = matchGeoLinksForPost

  type Post = { slug: string; title: string; excerpt: string | null; publishedAt: string; tags: string[] }
  const post = (over: Partial<Post> = {}): Post => ({
    slug: 'tetherow-resort-living-real-estate',
    title: 'Tetherow resort living',
    excerpt: null,
    publishedAt: '2026-09-08T09:00:00+00:00',
    tags: [],
    ...over,
  })

  it('keeps a post the shared matcher would link to this community', () => {
    const guides = communityGuides('tetherow', [post()], matcher)
    expect(guides.map((g) => g.slug)).toEqual(['tetherow-resort-living-real-estate'])
  })

  it('does not hand a community somebody else’s post', () => {
    expect(communityGuides('brasada-ranch', [post()], matcher)).toEqual([])
  })

  it('matches on tags as well as the slug, exactly as the blog direction does', () => {
    const guides = communityGuides(
      'sunriver',
      [post({ slug: 'second-home-vs-investment-property', title: 'Second home or investment', tags: ['sunriver'] })],
      matcher,
    )
    expect(guides).toHaveLength(1)
  })

  it('is newest first and capped', () => {
    const guides = communityGuides(
      'sunriver',
      [
        post({ slug: 'sunriver-a', title: 'Sunriver A', publishedAt: '2025-01-01T00:00:00+00:00' }),
        post({ slug: 'sunriver-b', title: 'Sunriver B', publishedAt: '2026-05-01T00:00:00+00:00' }),
        post({ slug: 'sunriver-c', title: 'Sunriver C', publishedAt: '2026-09-01T00:00:00+00:00' }),
      ],
      matcher,
      2,
    )
    expect(guides.map((g) => g.slug)).toEqual(['sunriver-c', 'sunriver-b'])
  })

  it('answers empty for a blank slug without consulting the matcher', () => {
    let calls = 0
    const spy = (p: { slug: string; title?: string | null; tags?: string[] | null }) => {
      calls += 1
      return matcher(p)
    }
    expect(communityGuides('   ', [post()], spy)).toEqual([])
    expect(calls).toBe(0)
  })

  it('carries the excerpt through so a row can print a sentence', () => {
    const guides = communityGuides('tetherow', [post({ excerpt: 'What living here costs.' })], matcher)
    expect(guides[0]?.excerpt).toBe('What living here costs.')
  })
})
