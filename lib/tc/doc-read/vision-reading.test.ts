import { describe, expect, it } from 'vitest'
import { normalizeReading, readerInstruction } from './vision-reading'

describe('normalizeReading', () => {
  const raw = {
    forms: [
      {
        segment: 1,
        title: 'RESIDENTIAL REAL ESTATE SALE AGREEMENT',
        formNumber: 'OREF 001',
        instanceNumber: null,
        counterBy: null,
        saleAgreementNumber: 'RRP04212025',
        termsExcerpt: null,
        propertyAddress: null,
        buyersNamed: ['Elsa Uchikawa', ''],
        sellersNamed: [],
        blankTemplate: false,
        watermark: null,
        response: 'countered',
        signatureLines: [
          { page: 14, label: 'Buyer', section: '50', party: 'buyer', signed: true, signedName: 'Elsa Uchikawa', printedName: null, date: null, method: 'handwritten' },
          { page: 14, label: 'Seller Initials', section: 'footer', party: 'seller', signed: true, signedName: null, printedName: null, date: null, method: 'handwritten' },
          { page: 15, label: 'Seller', section: '51', party: 'seller', signed: true, signedName: 'X', printedName: null, date: null, method: 'none' },
          { page: 9, label: 'Buyer', section: '?', party: 'buyer', signed: true, signedName: 'Ghost', printedName: null, date: null, method: 'handwritten' },
          { page: 15, label: 'Seller', section: '51', party: 'wizard', signed: false, signedName: null, printedName: null, date: null, method: 'none' },
        ],
      },
    ],
    unreadablePages: [15, 99],
    notes: '',
  }
  const r = normalizeReading(raw, new Set([1, 14, 15]))
  const lines = r.forms[0].signatureLines

  it('drops footer initials and lines on pages the reader never saw', () => {
    expect(lines.map((l) => l.label)).toEqual(['Buyer', 'Seller', 'Seller'])
    expect(lines.some((l) => l.signedName === 'Ghost')).toBe(false)
  })

  it('a line "signed" with method none is not signed', () => {
    expect(lines[1]).toMatchObject({ signed: false, signedName: null, method: 'none' })
  })

  it('coerces unknown enums and blank names', () => {
    expect(lines[2].party).toBe('other')
    expect(r.forms[0].buyersNamed).toEqual(['Elsa Uchikawa'])
    expect(r.unreadablePages).toEqual([15])
  })
})

describe('readerInstruction', () => {
  it('tells the reader which pages of each form it is shown', () => {
    const text = readerInstruction({
      segments: [{ id: 1, pages: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], oref: '001', released: '01/2025', declaredPages: 15 }],
      pages: [{ page: 1, segment: 1 }, { page: 14, segment: 1 }, { page: 15, segment: 1 }],
      pageCount: 15,
    })
    expect(text).toMatch(/Segment 1: pages 1-15, footer stamp OREF 001 \(released 01\/2025\); shown: 1, 14, 15/)
  })
})
