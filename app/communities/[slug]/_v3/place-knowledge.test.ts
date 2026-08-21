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
        subdivision_aliases: ['Tetherow', 'Tetherow Cascades Vista Phase 1', 'North Forty At Tetherow'],
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

  it('lists child plats as subdivision doors', () => {
    const items = buildPlaceKnowledge({
      name: 'Tetherow',
      city: 'Bend',
      aboutParagraphs: [],
      content: null,
      registry: {
        subdivision_aliases: ['Tetherow', 'Tetherow Cascades Vista Phase 1', 'North Forty At Tetherow'],
      },
      schoolDistrictName: null,
      schoolDistrictSlug: null,
      isResort: true,
      countIsAliasAware: true,
      contactHref: '/contact',
      amenityPosts: {},
    })
    const hrefs = items.flatMap((item) => ('href' in item ? [item.href] : []))
    expect(hrefs).toContain('/subdivisions/tetherow-cascades-vista-phase-1')
    expect(hrefs).toContain('/subdivisions/north-forty-at-tetherow')
    expect(hrefs).not.toContain('/subdivisions/tetherow')
  })
})
