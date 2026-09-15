import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { HOME_COMPETITIVE_BRIEF, homeBriefText } from './home-competitive-brief'

const PUBLIC_HOME = [
  'app/_v3/HomeHeroSearch.client.tsx',
  'app/_v3/HomeHomesRails.tsx',
  'app/_v3/HomeBrowsePlaces.tsx',
  'app/_v3/HomeFeaturedCommunity.client.tsx',
] as const

describe('HOME_COMPETITIVE_BRIEF', () => {
  it('ships eight Researchy beats with verbatim claim text', () => {
    expect(HOME_COMPETITIVE_BRIEF.id).toBe('homepage-v6-researchy-1-8')
    expect(HOME_COMPETITIVE_BRIEF.beats).toHaveLength(8)
    expect(HOME_COMPETITIVE_BRIEF.beats.map((b) => b.id)).toEqual(['1', '2', '3', '4', '5', '6', '7', '8'])
    for (const beat of HOME_COMPETITIVE_BRIEF.beats) {
      expect(beat.text.length).toBeGreaterThanOrEqual(20)
    }
    expect(homeBriefText('1')).toBe('The homepage opens with live inventory in the first viewport.')
    expect(homeBriefText('8')).toBe('Browse places with live town counts, not identical empty chips.')
  })

  it('does not render homeBriefText or beat copy on public Home', () => {
    for (const rel of PUBLIC_HOME) {
      const src = readFileSync(resolve(rel), 'utf8')
      expect(src).not.toContain('homeBriefText')
      expect(src).not.toContain('home-hero-search__brief')
      expect(src).not.toContain('home-rails__brief')
      expect(src).not.toContain('home-browse-places__brief')
      expect(src).not.toContain('home-featured-community__brief')
      expect(src).not.toContain('Search field that morphs into results')
      expect(src).not.toContain('The homepage opens with live inventory in the first viewport')
    }
  })
})
