import { describe, expect, it } from 'vitest'
import { placeDoorLabels, placeLabelWithPhase, shortPlaceLabel, stripOwnPrefix } from './short-place-label'

describe('shortPlaceLabel', () => {
  it('drops plat file numbers and phases', () => {
    expect(shortPlaceLabel('Sisters Woodlands Phase 1 Sub-21-01')).toBe('Sisters Woodlands')
    expect(shortPlaceLabel('Sunset Meadows Phases 1 And 2 Sub 22-01')).toBe('Sunset Meadows')
  })

  it('drops a phase written as a word or a numeral, not only a digit', () => {
    expect(shortPlaceLabel('Awbrey Road Phase One')).toBe('Awbrey Road')
    expect(shortPlaceLabel('Awbrey Road Phase Two')).toBe('Awbrey Road')
    expect(shortPlaceLabel('Deschutes Landing Phases One And Two')).toBe('Deschutes Landing')
    expect(shortPlaceLabel('Tetherow Phase IV')).toBe('Tetherow')
    expect(shortPlaceLabel('Awbrey Butte Homesites Phase II')).toBe('Awbrey Butte Homesites')
  })

  it('drops the hyphenated tens the county files, and a comma-led phase', () => {
    expect(shortPlaceLabel('Awbrey Butte Homesites Phase Twenty-two')).toBe('Awbrey Butte Homesites')
    expect(shortPlaceLabel('Awbrey Butte Homesites Phase Thirty-three')).toBe('Awbrey Butte Homesites')
    expect(shortPlaceLabel('Awbrey Butte Homesites Phase Eighteen')).toBe('Awbrey Butte Homesites')
    expect(shortPlaceLabel('Awbrey Glen Homesites, Phase Eight')).toBe('Awbrey Glen Homesites')
    expect(shortPlaceLabel('Awbrey Road Heights Phases I, II & III')).toBe('Awbrey Road Heights')
  })

  it('keeps a word that only begins like a phase ordinal', () => {
    // "Ivy" is not a numeral and "Phase" alone is not a phase.
    expect(shortPlaceLabel('Phase Ivy Estates')).toBe('Phase Ivy Estates')
  })

  it('keeps the addition, drops the city tacked on', () => {
    expect(shortPlaceLabel('Davidson Addition To Sisters')).toBe('Davidson Addition')
  })

  it('leaves a short name alone', () => {
    expect(shortPlaceLabel('Pines At Sisters')).toBe('Pines At Sisters')
    expect(shortPlaceLabel('Section 5 Subdivision')).toBe('Section 5 Subdivision')
  })
})

describe('placeLabelWithPhase', () => {
  it('drops only the file number and keeps the phase as written', () => {
    expect(placeLabelWithPhase('Awbrey Butte Homesites Phase Twenty-two Sub-21-01')).toBe(
      'Awbrey Butte Homesites Phase Twenty-two',
    )
    expect(placeLabelWithPhase('Awbrey Glen Homesites, Phase Eight')).toBe('Awbrey Glen Homesites Phase Eight')
  })
})

describe('stripOwnPrefix', () => {
  it('drops the containing place when it opens the child name', () => {
    expect(stripOwnPrefix('Awbrey Butte Homesite Phase 3', 'Awbrey Butte')).toBe('Homesite Phase 3')
    expect(stripOwnPrefix('Awbrey Butte Homesites Section 5', 'Awbrey Butte')).toBe('Homesites Section 5')
  })

  it('is case-insensitive and drops the separator after the prefix', () => {
    expect(stripOwnPrefix('AWBREY BUTTE - Homesite', 'Awbrey Butte')).toBe('Homesite')
    expect(stripOwnPrefix("Awbrey Butte's Homesite", 'Awbrey Butte')).toBe('Homesite')
    expect(stripOwnPrefix('Tetherow, Phase 3', 'Tetherow')).toBe('Phase 3')
  })

  it('is word-boundary safe', () => {
    expect(stripOwnPrefix('Awbreyton Heights', 'Awbrey')).toBe('Awbreyton Heights')
    expect(stripOwnPrefix('Awbrey Butteview Estates', 'Awbrey Butte')).toBe('Awbrey Butteview Estates')
  })

  it('returns the input when the child is exactly the place, or would strip to nothing', () => {
    expect(stripOwnPrefix('Awbrey Butte', 'Awbrey Butte')).toBe('Awbrey Butte')
    expect(stripOwnPrefix('awbrey butte', 'Awbrey Butte')).toBe('awbrey butte')
    expect(stripOwnPrefix('Awbrey Butte - ', 'Awbrey Butte')).toBe('Awbrey Butte -')
  })

  it('leaves a child that does not open with the place alone', () => {
    expect(stripOwnPrefix('North Rim', 'Awbrey Butte')).toBe('North Rim')
    expect(stripOwnPrefix('North Rim on Awbrey Butte', 'Awbrey Butte')).toBe('North Rim on Awbrey Butte')
  })

  it('never returns an empty string', () => {
    expect(stripOwnPrefix('', 'Awbrey Butte')).toBe('')
    expect(stripOwnPrefix('Homesite', '')).toBe('Homesite')
    expect(stripOwnPrefix('   ', 'Awbrey Butte')).toBe('')
  })

  it('composes with shortPlaceLabel into the door label', () => {
    expect(shortPlaceLabel(stripOwnPrefix('Awbrey Butte Homesite Phase 3', 'Awbrey Butte'))).toBe('Homesite')
    expect(shortPlaceLabel(stripOwnPrefix('Awbrey Butte', 'Awbrey Butte'))).toBe('Awbrey Butte')
  })
})

describe('placeDoorLabels', () => {
  it('strips the containing place and the phase when the short label is unique', () => {
    expect(placeDoorLabels(['Awbrey Butte Homesites Phase Twenty-two', 'North Rim on Awbrey Butte Phase 4'], 'Awbrey Butte')).toEqual([
      'Homesites',
      'North Rim on Awbrey Butte',
    ])
  })

  it('keeps the phase for every sibling that would otherwise print the same label', () => {
    expect(
      placeDoorLabels(
        [
          'Awbrey Butte Homesites Phase Twenty-two',
          'Awbrey Butte Homesites Phase Thirteen Sub-21-01',
          'Awbrey Glen Homesites, Phase Eight',
          'Awbrey Glen Homesites Phase One',
          'Awbrey Park',
        ],
        'Awbrey Butte',
      ),
    ).toEqual([
      'Homesites Phase Twenty-two',
      'Homesites Phase Thirteen',
      'Awbrey Glen Homesites Phase Eight',
      'Awbrey Glen Homesites Phase One',
      'Awbrey Park',
    ])
  })

  it('leaves two names that are identical in full identical', () => {
    expect(placeDoorLabels(['Awbrey Park', 'Awbrey Park'])).toEqual(['Awbrey Park', 'Awbrey Park'])
  })

  it('is positional and works with no containing place', () => {
    expect(placeDoorLabels(['Tetherow Phase IV', 'Sunriver'])).toEqual(['Tetherow', 'Sunriver'])
    expect(placeDoorLabels([], 'Bend')).toEqual([])
  })
})
