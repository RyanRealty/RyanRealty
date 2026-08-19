import { describe, expect, it } from 'vitest'
import { publishStreetLine, publishStreetNumber, publishUnparsedStreetLine } from './publish-street-line'

describe('publishStreetNumber', () => {
  it('withholds a placeholder zero', () => {
    expect(publishStreetNumber('0')).toBeNull()
    expect(publishStreetNumber(0)).toBeNull()
    expect(publishStreetNumber('00')).toBeNull()
    expect(publishStreetNumber(' 0 ')).toBeNull()
  })

  it('keeps a real house number', () => {
    expect(publishStreetNumber('19496')).toBe('19496')
    expect(publishStreetNumber('1')).toBe('1')
  })
})

describe('publishStreetLine', () => {
  it('prints Moonshadow Court without a leading 0', () => {
    expect(
      publishStreetLine({
        streetNumber: '0',
        streetName: 'Moonshadow',
        streetSuffix: 'Court',
      }),
    ).toBe('Moonshadow Court')
  })

  it('keeps a real numbered street', () => {
    expect(
      publishStreetLine({
        streetNumber: '19496',
        streetName: 'Tumalo Reservoir',
        streetSuffix: 'Rd',
      }),
    ).toBe('19496 Tumalo Reservoir Rd')
  })

  it('returns null when nothing publishable remains', () => {
    expect(publishStreetLine({ streetNumber: '0', streetName: null, streetSuffix: null })).toBeNull()
  })

  it('drops a suffix already on the street name', () => {
    expect(
      publishStreetLine({
        streetNumber: '0',
        streetName: 'Kouns Drive',
        streetSuffix: 'Drive',
      }),
    ).toBe('Kouns Drive')
  })
})

describe('publishUnparsedStreetLine', () => {
  it('strips a leading placeholder 0 from an assembled line', () => {
    expect(publishUnparsedStreetLine('0 Moonshadow Court')).toBe('Moonshadow Court')
  })
})
