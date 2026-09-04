import { describe, expect, it } from 'vitest'
import { shortPlaceLabel } from './short-place-label'

describe('shortPlaceLabel', () => {
  it('drops plat file numbers and phases', () => {
    expect(shortPlaceLabel('Sisters Woodlands Phase 1 Sub-21-01')).toBe('Sisters Woodlands')
    expect(shortPlaceLabel('Sunset Meadows Phases 1 And 2 Sub 22-01')).toBe('Sunset Meadows')
  })

  it('keeps the addition, drops the city tacked on', () => {
    expect(shortPlaceLabel('Davidson Addition To Sisters')).toBe('Davidson Addition')
  })

  it('leaves a short name alone', () => {
    expect(shortPlaceLabel('Pines At Sisters')).toBe('Pines At Sisters')
    expect(shortPlaceLabel('Section 5 Subdivision')).toBe('Section 5 Subdivision')
  })
})
