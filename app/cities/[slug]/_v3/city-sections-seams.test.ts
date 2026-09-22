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

  it('keeps a community-grain door without a photo so V3Ledger can glyph it', () => {
    expect(PAGE).not.toMatch(/if \(!img\) return null/)
    const bald: CityCommunityItem = { ...tetherow, img: '', video: null }
    const rows = communityRows([tetherow, bald])
    expect(rows).toHaveLength(2)
    expect(rows[0]?.media?.src).toBe(tetherow.img)
    expect(rows[1]?.media).toBeUndefined()
  })

  it('pairs rail name and href through communityPublicPair so they cannot diverge', () => {
    expect(PAGE).toMatch(/communityPublicPairForPlace/)
    expect(PAGE).toMatch(/pair\?\.displayName/)
    expect(PAGE).toMatch(/pair\?\.href/)
    expect(PAGE).toMatch(/communityPublicPair\(c\)/)
  })

  it('does not put an em dash in the city fold or atlas claim (Matt lock 2026-09-20)', () => {
    const claims = [...PAGE.matchAll(/(?:claim|claimText)=\{`([^`]*)`\}/g)].map((m) => m[1])
    expect(claims.length).toBeGreaterThan(0)
    for (const copy of claims) {
      expect(copy).not.toContain('\u2014')
    }
  })
})
