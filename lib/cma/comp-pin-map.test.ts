import { describe, expect, it } from 'vitest'
import { renderCompPinMapHtml, renderCompPinMapScript } from '@/lib/cma/comp-pin-map'

describe('renderCompPinMapHtml', () => {
  it('draws numbered pins and a subject mark when coordinates exist', () => {
    const html = renderCompPinMapHtml(
      { streetAddress: '850 Quince', latitude: 44.272, longitude: -121.174 },
      [
        { address: '12 Pine', latitude: 44.273, longitude: -121.175 },
        { address: '34 Oak', latitude: 44.271, longitude: -121.173 },
      ],
    )
    expect(html).toContain('data-pin="1"')
    expect(html).toContain('data-pin="2"')
    expect(html).toContain('data-pin="subject"')
    expect(html).toContain('12 Pine')
    expect(html).toContain('850 Quince')
  })

  it('uses the street map when a static image is already built', () => {
    const html = renderCompPinMapHtml(
      { streetAddress: '850 Quince', latitude: 44.272, longitude: -121.174 },
      [{ address: '12 Pine', latitude: 44.273, longitude: -121.175 }],
      'data:image/png;base64,aaa',
    )
    expect(html).toContain('class="pin-map"')
    expect(html).toContain('data:image/png;base64,aaa')
    expect(html).toContain('Comparable sales map')
    expect(html).not.toContain('<svg')
  })

  it('ships nothing when a map cannot be drawn', () => {
    expect(
      renderCompPinMapHtml({ streetAddress: '850 Quince', latitude: null, longitude: null }, [
        { address: '12 Pine', latitude: null, longitude: null },
      ]),
    ).toBe('')
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
