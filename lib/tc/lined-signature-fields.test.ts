import { describe, expect, it } from 'vitest'
import {
  demoteImplausibleSignatureFields,
  fillStackedUnderlineRun,
  promoteLinedFormFields,
  stackedUnderlineRuns,
  wrapTextToWidth,
} from './lined-signature-fields'
import type { MappedField } from './skyslope-field-map'

function field(partial: Partial<MappedField> & Pick<MappedField, 'label' | 'x' | 'y' | 'w' | 'h'>): MappedField {
  return {
    type: 'text',
    page: 1,
    dataRef: partial.label,
    signerRole: null,
    optional: false,
    ...partial,
  }
}

describe('promoteLinedFormFields', () => {
  it('sits the overlay on the printed Delivering/Receiving lines, not a dumped stack', () => {
    const map = [
      field({ label: 'Delivering Party', x: 0.184, y: 0.537, w: 0.451, h: 0.022 }),
      field({ label: 'DateTime', x: 0.702, y: 0.543, w: 0.188, h: 0.016 }),
      field({ label: 'Print', x: 0.184, y: 0.558, w: 0.45, h: 0.016 }),
      field({ label: 'Receiving Party', x: 0.183, y: 0.708, w: 0.451, h: 0.022 }),
      field({ label: 'DateTime_5', x: 0.701, y: 0.713, w: 0.188, h: 0.016 }),
      field({ label: 'Print_5', x: 0.184, y: 0.728, w: 0.45, h: 0.016 }),
      field({ label: 'Buyers', x: 0.141, y: 0.126, w: 0.799, h: 0.016 }),
    ]
    const out = promoteLinedFormFields(map)
    const delivering = out.find((f) => f.label === 'Delivering Party')
    const receiving = out.find((f) => f.label === 'Receiving Party')
    expect(delivering).toMatchObject({ type: 'signature', signerRole: 'seller', x: 0.184, y: 0.537, w: 0.451 })
    expect(receiving).toMatchObject({ type: 'signature', signerRole: 'buyer', x: 0.183, y: 0.708 })
    expect(out.find((f) => f.label === 'DateTime')).toMatchObject({ type: 'date_signed', signerRole: 'seller' })
    expect(out.find((f) => f.label === 'Print')).toMatchObject({ type: 'full_name', signerRole: 'seller' })
    expect(out.find((f) => f.label === 'DateTime_5')).toMatchObject({ type: 'date_signed', signerRole: 'buyer' })
    expect(out.find((f) => f.label === 'Print_5')).toMatchObject({ type: 'full_name', signerRole: 'buyer' })
    expect(out.find((f) => f.label === 'Buyers')?.type).toBe('text')
  })

  it('keeps extra Delivering/Receiving lines optional so one party is not asked to sign four times', () => {
    const map = [
      field({ label: 'Delivering Party', x: 0.184, y: 0.537, w: 0.451, h: 0.022 }),
      field({ label: 'Delivering Party_2', x: 0.184, y: 0.575, w: 0.451, h: 0.022 }),
      field({ label: 'Receiving Party', x: 0.183, y: 0.708, w: 0.451, h: 0.022 }),
      field({ label: 'Receiving Party_2', x: 0.183, y: 0.746, w: 0.451, h: 0.022 }),
    ]
    const out = promoteLinedFormFields(map)
    expect(out.find((f) => f.label === 'Delivering Party')).toMatchObject({ type: 'signature', optional: false })
    expect(out.find((f) => f.label === 'Delivering Party_2')).toMatchObject({ type: 'signature', optional: true })
    expect(out.find((f) => f.label === 'Receiving Party')).toMatchObject({ type: 'signature', optional: false })
    expect(out.find((f) => f.label === 'Receiving Party_2')).toMatchObject({ type: 'signature', optional: true })
  })

  it('leaves the 059 document-list underlines as text, not signatures', () => {
    const map = [8, 9, 10, 11].map((n, i) =>
      field({ label: String(n), x: 0.088, y: 0.251 + i * 0.015, w: 0.763, h: 0.016 }),
    )
    const out = promoteLinedFormFields(map)
    expect(out.every((f) => f.type === 'text')).toBe(true)
  })

  it('keeps 001 buyer and seller blocks on their printed lines', () => {
    const map = [
      field({ label: 'Buyer_4', page: 15, x: 0.126, y: 0.309, w: 0.509, h: 0.022 }),
      field({ label: 'Date_27', page: 15, x: 0.702, y: 0.314, w: 0.188, h: 0.016 }),
      field({ label: 'Print_5', page: 15, x: 0.126, y: 0.329, w: 0.509, h: 0.016 }),
      field({ label: 'Seller_5', page: 15, x: 0.126, y: 0.737, w: 0.509, h: 0.022 }),
      field({ label: 'Date_33', page: 15, x: 0.702, y: 0.742, w: 0.188, h: 0.016 }),
      field({ label: 'Print_9', page: 15, x: 0.126, y: 0.757, w: 0.509, h: 0.016 }),
    ]
    const out = promoteLinedFormFields(map)
    expect(out.find((f) => f.label === 'Buyer_4')).toMatchObject({ type: 'signature', signerRole: 'buyer', y: 0.309 })
    expect(out.find((f) => f.label === 'Seller_5')).toMatchObject({ type: 'signature', signerRole: 'seller', y: 0.737 })
  })
})

describe('wrapTextToWidth', () => {
  const measure = (s: string) => s.length
  it('keeps a short line intact', () => {
    expect(wrapTextToWidth('Inspection waived', 40, measure)).toEqual(['Inspection waived'])
  })
  it('wraps contingency language onto the next line instead of running past the box', () => {
    const lines = wrapTextToWidth('Buyer removes the inspection contingency in section 8 of the sale agreement.', 24, measure)
    expect(lines.length).toBeGreaterThan(1)
    expect(lines.every((l) => l.length <= 24)).toBe(true)
    expect(lines.join(' ')).toBe('Buyer removes the inspection contingency in section 8 of the sale agreement.')
  })
  it('is empty for blank input', () => {
    expect(wrapTextToWidth('   ', 10, measure)).toEqual([])
  })
})

describe('stacked underlines', () => {
  it('wraps a long delivery clause onto consecutive printed lines', () => {
    const run = [8, 9, 10, 11].map((n, i) =>
      field({ label: String(n), x: 0.088, y: 0.251 + i * 0.015, w: 0.763, h: 0.016 }),
    )
    const filled = fillStackedUnderlineRun(
      run,
      "Seller delivers to Buyer the following documents previously executed on this file: OREF 020 Seller's Property Disclosure Statement; OREF 043 Electronic Funds Transfer Advisory; OREF 015 Exclusive Right to Sell Listing Agreement; and OREF 042 Initial Agency Disclosure Pamphlet.",
      (s) => s.length,
      72,
    )
    expect(filled.filter((r) => r.text).length).toBeGreaterThan(1)
    expect(filled.every((r) => r.text.length <= 72)).toBe(true)
    expect(filled.map((r) => r.field.y)).toEqual(run.map((f) => f.y))
    expect(stackedUnderlineRuns(run)).toHaveLength(1)
  })
})

describe('demoteImplausibleSignatureFields', () => {
  it('turns a tiny “signing below” pages-column widget back into text', () => {
    const map = [
      field({
        type: 'signature',
        label:
          'DELIVERY AND RECEIPT By signing below the delivering Party represents that the abovelisted items are being delivered to the receiving Party',
        x: 0.865,
        y: 0.463,
        w: 0.073,
        h: 0.016,
      }),
    ]
    const out = demoteImplausibleSignatureFields(map)
    expect(out[0]?.type).toBe('text')
  })
})
