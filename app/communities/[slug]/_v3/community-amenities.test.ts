import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { ResortAmenity } from '@/lib/resort-community-content'
import {
  amenityItemListItems,
  buildCommunityAmenityBoard,
  joinEnglish,
} from './community-amenities'

const VISITOR_META =
  /authored amenity list|\bon file\b|records\s+\d+\s+[\w\s]*amenities on file|records one .+ amenity on file|amenity list is/i

function visitorCopy(board: NonNullable<ReturnType<typeof buildCommunityAmenityBoard>>): string[] {
  return [
    board.claim,
    board.heading,
    ...board.groups.flatMap((group) =>
      group.places.flatMap((place) => [place.name, place.description, place.access].filter(Boolean) as string[]),
    ),
  ]
}

const amenities: ResortAmenity[] = [
  { category: 'Dining', name: 'Coorie', access: 'Open to public', description: 'Course-facing dining.' },
  { category: 'Dining', name: 'The Row', access: 'Walk-in' },
  { category: 'Wellness', name: 'Tetherow Spa', blog_slug: 'tetherow-spa-guide', description: 'Massage and recovery.' },
]

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

  it('groups places and keeps each description', () => {
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
    expect(board?.heading).toBe('Dining and wellness')
    expect(board?.groups.map((group) => group.label)).toEqual(['Dining', 'Wellness'])
    expect(board?.groups[0]?.places.map((place) => place.name)).toEqual(['Coorie', 'The Row'])
    expect(board?.groups[0]?.places[0]?.description).toBe('Course-facing dining.')
    expect(board?.groups[0]?.places[0]?.access).toBe('Open to public')
    expect(board?.groups[1]?.places[0]?.href).toBe('/blog/tetherow-spa-guide')
    expect(board?.groups.flatMap((group) => group.places).map((place) => place.name).join(' ')).not.toMatch(
      /\b(DINI|RECR|WELL|OTHE)\b/,
    )
    expect(board?.source).toMatch(/Tetherow community guide/i)
    for (const line of visitorCopy(board!)) {
      expect(line).not.toMatch(VISITOR_META)
    }
  })

  it('drops a one-word access code and keeps a sentence', () => {
    const board = buildCommunityAmenityBoard({
      placeName: 'Caldera',
      amenities: [
        { category: 'Dining', name: 'Lake House', access: 'Public', description: 'On the lake.' },
        { category: 'Dining', name: 'The Row', access: 'Open to public · walk-in' },
      ],
      browseHref: '/homes-for-sale/bend/tetherow',
    })
    expect(board?.groups[0]?.places[0]?.access).toBeUndefined()
    expect(board?.groups[0]?.places[1]?.access).toBe('Open to public · walk-in')
  })

  it('writes Caldera Springs from the guide, with descriptions and no share', () => {
    const caldera = JSON.parse(
      readFileSync(join(process.cwd(), 'data/resort-community-caldera-springs.json'), 'utf8'),
    ) as { name: string; amenities: ResortAmenity[] }
    const board = buildCommunityAmenityBoard({
      placeName: caldera.name,
      amenities: caldera.amenities,
      browseHref: '/homes-for-sale/sunriver/caldera-springs',
    })
    const places = board!.groups.flatMap((group) => group.places)
    expect(board?.claim).toContain('Lake House')
    expect(board?.claim).toContain('Forest House')
    expect(board?.claim).not.toMatch(/\d+\s+amenities/)
    expect(places[0]?.name).toBe('Lake House')
    expect(places[0]?.description).toMatch(/Obsidian Lake/)
    expect(places[0]?.access).toBeUndefined()
    expect(places.map((place) => place.name)).toEqual(
      expect.arrayContaining(['Lake House', 'Forest House', 'The Quarry', 'Caldera Links Golf Course', 'Lakes and Trails']),
    )
    expect(JSON.stringify(board)).not.toMatch(/"pct"/)
    for (const line of visitorCopy(board!)) {
      expect(line).not.toMatch(VISITOR_META)
      expect(line).not.toMatch(/\b(DINI|RECR|WELL|OTHE)\b/)
    }
  })
})

describe('visitor chrome', () => {
  it('mounts the place list and does not mount a share bar', () => {
    const client = readFileSync(join(process.cwd(), 'app/communities/[slug]/_v3/CommunityAmenities.client.tsx'), 'utf8')
    const page = readFileSync(join(process.cwd(), 'app/communities/[slug]/page.tsx'), 'utf8')
    expect(client).toMatch(/place\.description/)
    expect(client).not.toMatch(/AllocationCard/)
    expect(client).not.toMatch(/has on the ground/)
    expect(page).toMatch(/<V3Amenities/)
    expect(page).toMatch(/id="amenities"/)
    expect(page).not.toMatch(/has on the ground/)
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
    const items = amenityItemListItems(board!, '/communities/tetherow')
    expect(items[0]?.url).toBe('https://www.bendparksandrec.org/park/shevlin-park/')
    expect(items.find((item) => item.name === 'Tetherow Spa')?.url).toBe('/blog/tetherow-spa-guide')
    expect(items.find((item) => item.name === 'Coorie')?.url).toBe('/communities/tetherow#amenities')
  })
})
