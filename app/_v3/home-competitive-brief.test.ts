import { describe, expect, it } from 'vitest'
import { HOME_COMPETITIVE_BRIEF, homeBriefText } from './home-competitive-brief'

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
})
