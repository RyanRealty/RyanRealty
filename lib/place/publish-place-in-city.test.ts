import { describe, expect, it } from 'vitest'
import { publishPlaceInCity, publishPlaceWithCity } from './publish-place-in-city'

describe('publishPlaceInCity', () => {
  it('does not print Bend in Sunriver for the music festival venue', () => {
    expect(
      publishPlaceInCity('Sunriver Resort Great Hall and Tower Theatre, Bend', 'Sunriver'),
    ).toBe('Sunriver Resort Great Hall and Tower Theatre, Bend')
  })

  it('keeps a simple venue in its city', () => {
    expect(publishPlaceInCity('Drake Park', 'Bend')).toBe('Drake Park in Bend')
  })

  it('does not repeat a city already on the venue', () => {
    expect(publishPlaceInCity('Tower Theatre, Bend', 'Bend')).toBe('Tower Theatre, Bend')
  })
})

describe('publishPlaceWithCity', () => {
  it('leaves a venue that already names its city', () => {
    expect(publishPlaceWithCity('Tower Theatre, Bend', 'Bend')).toBe('Tower Theatre, Bend')
    expect(
      publishPlaceWithCity('Sunriver Resort Great Hall and Tower Theatre, Bend', 'Sunriver'),
    ).toBe('Sunriver Resort Great Hall and Tower Theatre, Bend')
  })

  it('adds the city when the venue does not name one', () => {
    expect(publishPlaceWithCity('Drake Park', 'Bend')).toBe('Drake Park, Bend')
  })
})
