import { describe, expect, it } from 'vitest'
import {
  pinLegendHtml,
  pinRevealLine,
  renderCompPinMapHtml,
  renderCompPinMapScript,
  type CmaPinFact,
} from '@/lib/cma/comp-pin-map'

const subject = { streetAddress: '850 Quince', latitude: 44.272, longitude: -121.174 }

const facts: CmaPinFact[] = [
  {
    key: '1',
    family: 'closed',
    address: '12 Pine',
    outcome: 'sold $457K · offer in 25 days',
    domDays: 31,
    priceChanges: 1,
    latitude: 44.273,
    longitude: -121.175,
  },
  {
    key: 'A',
    family: 'active',
    address: '34 Oak',
    outcome: 'asking $417K · 13 days',
    domDays: 13,
    priceChanges: 0,
    latitude: 44.271,
    longitude: -121.173,
  },
  {
    key: 'i',
    family: 'unsold',
    address: '56 Fir',
    outcome: 'came off after 36 days',
    domDays: 36,
    priceChanges: 2,
    latitude: 44.2705,
    longitude: -121.1765,
  },
]

describe('renderCompPinMapHtml', () => {
  it('draws one pin per family, keyed the way the matrices key them', () => {
    const html = renderCompPinMapHtml({ subject, facts })
    expect(html).toContain('data-pin="1"')
    expect(html).toContain('data-pin="A"')
    expect(html).toContain('data-pin="i"')
    expect(html).toContain('data-pin="subject"')
    expect(html).toContain('is-closed')
    expect(html).toContain('is-active')
    expect(html).toContain('is-unsold')
  })

  it('states days on market, price changes and the outcome on every pin', () => {
    const html = renderCompPinMapHtml({ subject, facts })
    expect(html).toContain('sold $457K · offer in 25 days')
    expect(html).toContain('36 days on market · 2 price changes')
    expect(html).toContain('13 days on market · no price changes')
  })

  it('uses the street map when a static image is already built', () => {
    const html = renderCompPinMapHtml({
      subject,
      facts: [facts[0]!],
      mapDataUri: 'data:image/png;base64,aaa',
    })
    expect(html).toContain('class="pin-map"')
    expect(html).toContain('data:image/png;base64,aaa')
    expect(html).not.toContain('<svg')
  })

  it('ships nothing when a map cannot be drawn', () => {
    expect(
      renderCompPinMapHtml({
        subject: { streetAddress: '850 Quince', latitude: null, longitude: null },
        facts: [{ ...facts[0]!, latitude: null, longitude: null }],
      }),
    ).toBe('')
  })
})

describe('pinLegendHtml', () => {
  it('names only the families this document actually drew', () => {
    const legend = pinLegendHtml([facts[0]!])
    expect(legend).toContain('Closed sales')
    expect(legend).not.toContain('Came off the market unsold')
    expect(legend).not.toContain('For sale or under contract')
  })

  it('names all three when all three are on the map', () => {
    const legend = pinLegendHtml(facts)
    expect(legend).toContain('Closed sales')
    expect(legend).toContain('For sale or under contract')
    expect(legend).toContain('Came off the market unsold')
    expect(legend).toContain('Your home')
  })
})

describe('pinRevealLine', () => {
  it('says no price changes rather than dropping the fact', () => {
    expect(pinRevealLine({ ...facts[0]!, priceChanges: 0 })).toContain('no price changes')
  })

  it('omits a measure the record does not carry', () => {
    expect(pinRevealLine({ ...facts[0]!, domDays: null, priceChanges: null })).toBe('')
  })
})

describe('renderCompPinMapScript', () => {
  it('wires tap on data-comp and data-pin', () => {
    const js = renderCompPinMapScript()
    expect(js).toContain('data-comp')
    expect(js).toContain('data-pin')
    expect(js).toContain('is-on')
  })
})
