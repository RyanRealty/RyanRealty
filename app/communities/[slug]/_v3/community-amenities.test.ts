import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { ResortAmenity } from '@/lib/resort-community-content'
import {
  AMENITY_INSIGHT_TITLE,
  amenityItemListItems,
  buildCommunityAmenityBoard,
  integerShares,
  joinEnglish,
} from './community-amenities'

const VISITOR_META =
  /authored amenity list|\bon file\b|records\s+\d+\s+[\w\s]*amenities on file|records one .+ amenity on file|amenity list is/i

function visitorCopy(board: NonNullable<ReturnType<typeof buildCommunityAmenityBoard>>): string[] {
  return [board.claim, board.mixNote, ...board.categories.map((category) => category.claim)]
}

const amenities: ResortAmenity[] = [
  { category: 'Dining', name: 'Coorie', access: 'Open to public', description: 'Course-facing dining.' },
  { category: 'Dining', name: 'The Row', access: 'Walk-in' },
  { category: 'Wellness', name: 'Tetherow Spa', blog_slug: 'tetherow-spa-guide' },
]

describe('integerShares', () => {
  it('sums to 100 and prefers the largest remainder', () => {
    expect(integerShares([3, 1])).toEqual([75, 25])
    expect(integerShares([1, 1, 1])).toEqual([34, 33, 33])
    expect(integerShares([0, 0])).toEqual([0, 0])
  })
})

describe('joinEnglish', () => {
  it('joins two and three names without an invented serial comma on a pair', () => {
    expect(joinEnglish(['Coorie'])).toBe('Coorie')
    expect(joinEnglish(['Coorie', 'The Row'])).toBe('Coorie and The Row')
    expect(joinEnglish(['Coorie', 'The Row', 'Tetherow Spa'])).toBe('Coorie, The Row, and Tetherow Spa')
  })
})

describe('buildCommunityAmenityBoard', () => {
  it('returns null when no named amenity is on file', () => {
    expect(
      buildCommunityAmenityBoard({
        placeName: 'Tetherow',
        amenities: [{ category: 'Dining', name: '   ' }],
        browseHref: '/homes-for-sale/bend/tetherow',
      }),
    ).toBeNull()
  })

  it('builds a mix page plus one page per category from the config list', () => {
    const board = buildCommunityAmenityBoard({
      placeName: 'Tetherow',
      amenities,
      amenityPosts: { 'tetherow-spa-guide': { slug: 'tetherow-spa-guide', title: 'The spa at Tetherow' } },
      browseHref: '/homes-for-sale/bend/tetherow',
    })
    expect(board).not.toBeNull()
    expect(board?.total).toBe(3)
    expect(board?.claim).toBe('Tetherow has Coorie, The Row, and Tetherow Spa.')
    expect(board?.claim).not.toMatch(/\d+\s+amenities/)
    expect(board?.mix).toHaveLength(2)
    expect(board?.mix.map((s) => s.label)).toEqual(['Dining', 'Wellness'])
    expect(board?.mix[0]?.amount).toBe('Coorie and The Row')
    expect(board?.mix.reduce((sum, s) => sum + s.pct, 0)).toBe(100)
    expect(board?.categories).toHaveLength(2)
    expect(board?.categories[0]?.claim).toBe('Dining here is Coorie and The Row.')
    expect(board?.categories[1]?.claim).toBe('Tetherow Spa is the wellness here.')
    expect(board?.categories[0]?.pillHref).toBe('/homes-for-sale/bend/tetherow')
    expect(board?.categories[1]?.pillHref).toBe('/blog/tetherow-spa-guide')
    expect(board?.mixNote).toBe('Grouped by kind.')
    expect(board?.source).toMatch(/Tetherow community guide/i)
    for (const line of visitorCopy(board!)) {
      expect(line).not.toMatch(VISITOR_META)
    }
  })

  it('refuses CMS-dump language in claim, category.claim, and mixNote', () => {
    const board = buildCommunityAmenityBoard({
      placeName: 'Tetherow',
      amenities,
      browseHref: '/homes-for-sale/bend/tetherow',
    })
    expect(board).not.toBeNull()
    for (const line of visitorCopy(board!)) {
      expect(line).not.toMatch(/authored/i)
      expect(line).not.toMatch(VISITOR_META)
    }
  })

  it('writes Caldera Springs board copy without authored or inventory lectures', () => {
    const caldera = JSON.parse(
      readFileSync(join(process.cwd(), 'data/resort-community-caldera-springs.json'), 'utf8'),
    ) as { name: string; amenities: ResortAmenity[] }
    const board = buildCommunityAmenityBoard({
      placeName: caldera.name,
      amenities: caldera.amenities,
      browseHref: '/homes-for-sale/sunriver/caldera-springs',
    })
    expect(board).not.toBeNull()
    expect(board?.claim).not.toMatch(/authored/i)
    expect(board?.claim).toContain('Lake House')
    expect(board?.claim).toContain('Forest House')
    expect(board?.claim).not.toMatch(/\d+\s+amenities/)
    expect(AMENITY_INSIGHT_TITLE).toBe("What's here")
    expect(AMENITY_INSIGHT_TITLE).not.toBe('Amenities')
    for (const line of visitorCopy(board!)) {
      expect(line).not.toMatch(VISITOR_META)
    }
    for (const amount of [
      ...board!.mix.map((segment) => segment.amount),
      ...board!.categories.flatMap((category) => category.segments.map((segment) => segment.amount)),
    ]) {
      expect(amount).not.toMatch(/\bon file\b/i)
    }
  })
})

describe('visitor chrome', () => {
  it('does not title the pager Amenities, and does not repeat the claim as a section lede', () => {
    const client = readFileSync(join(process.cwd(), 'app/communities/[slug]/_v3/CommunityAmenities.client.tsx'), 'utf8')
    const page = readFileSync(join(process.cwd(), 'app/communities/[slug]/page.tsx'), 'utf8')
    expect(client).toContain('AMENITY_INSIGHT_TITLE')
    expect(client).not.toMatch(/title:\s*['"]Amenities['"]/)
    expect(page).not.toMatch(/lede=\{amenityBoard\.claim\}/)
  })
})

describe('amenityItemListItems', () => {
  it('uses a recorded URL, then a published blog, then the section anchor', () => {
    const board = buildCommunityAmenityBoard({
      placeName: 'Tetherow',
      amenities: [
        { category: 'Trails', name: 'Shevlin Park', url: 'https://www.bendparksandrec.org/park/shevlin-park/' },
        ...amenities,
      ],
      amenityPosts: { 'tetherow-spa-guide': { slug: 'tetherow-spa-guide', title: 'The spa at Tetherow' } },
      browseHref: '/homes-for-sale/bend/tetherow',
    })
    const items = amenityItemListItems(
      board!,
      '/communities/tetherow',
      [
        { category: 'Trails', name: 'Shevlin Park', url: 'https://www.bendparksandrec.org/park/shevlin-park/' },
        ...amenities,
      ],
      { 'tetherow-spa-guide': { slug: 'tetherow-spa-guide', title: 'The spa at Tetherow' } },
    )
    expect(items[0]?.url).toBe('https://www.bendparksandrec.org/park/shevlin-park/')
    expect(items.find((item) => item.name === 'Tetherow Spa')?.url).toBe('/blog/tetherow-spa-guide')
    expect(items.find((item) => item.name === 'Coorie')?.url).toBe('/communities/tetherow#amenities')
  })
})
