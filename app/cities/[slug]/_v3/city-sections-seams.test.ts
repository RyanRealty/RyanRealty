import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { communityRows, type CityCommunityItem } from './city-sections'

const PAGE = readFileSync(resolve('app/cities/[slug]/page.tsx'), 'utf8')

const tetherow: CityCommunityItem = {
  name: 'Tetherow',
  href: '/communities/tetherow',
  activeCount: 25,
  medianPrice: null,
  img: 'https://cdn.example/tetherow.jpg',
  town: 'Bend',
  video: { url: 'https://cdn.example/tetherow.mp4', embedType: 'video-tag' },
}

describe('SITE-128 seams — name-only community cards + grain split', () => {
  it('does not stamp AREA GUIDE on a community rail card that has a clip', () => {
    const rows = communityRows([tetherow])
    expect(rows).toHaveLength(1)
    expect(rows[0]).not.toHaveProperty('when')
    expect(JSON.stringify(rows)).not.toMatch(/Area guide/i)
    expect(String(rows[0]?.what)).toMatch(/Tetherow/)
  })

  it('splits the city Communities rail by grain', () => {
    expect(PAGE).toMatch(/cityPlaceGrain/)
    expect(PAGE).toMatch(/grain === 'community'/)
    expect(PAGE).toMatch(/grain === 'plat'/)
    expect(PAGE).toMatch(/atlasPlatEntries/)
  })

  it('pairs rail name and href through communityPublicPair so they cannot diverge', () => {
    expect(PAGE).toMatch(/communityPublicPairForPlace/)
    expect(PAGE).toMatch(/pair\?\.displayName/)
    expect(PAGE).toMatch(/pair\?\.href/)
    expect(PAGE).toMatch(/communityPublicPair\(c\)/)
  })
})
