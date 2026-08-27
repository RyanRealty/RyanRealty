import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import { buildFilledOrefPdf } from './oref-fill-pdf'
import { mapDealFactsToFillValues, resolveOrefFieldMap, type DealFacts } from './oref-fill'

function findOref001Sample(): string | null {
  const names = [
    join(process.cwd(), 'tmp/form-blanks/OREF-samples/OREF-001__Residential_Real_Estate_Sale_Agreement.pdf'),
    join(process.cwd(), '../RyanRealty/tmp/form-blanks/OREF-samples/OREF-001__Residential_Real_Estate_Sale_Agreement.pdf'),
  ]
  return names.find((p) => existsSync(p)) ?? null
}

const FACTS: DealFacts = {
  address: '218 SW 4th St',
  city: 'Redmond',
  state: 'OR',
  zip: '97756',
  buyers: ['Todd Chester'],
  sellers: ['PMA Investments LLC'],
  salePrice: 435000,
  listingPrice: 449000,
  mlsNumber: '220199880',
  escrowNumber: null,
  escrowCompany: 'Western Title',
  contractAcceptanceDate: '2025-04-22',
  escrowClosingDate: '2025-07-31',
  actualClosingDate: null,
  brokerName: 'Matt Ryan',
  earnestMoneyAmount: null,
}

describe('buildFilledOrefPdf', () => {
  it('builds a packet with a facts cover even when the blank has no field map', async () => {
    const blank = await PDFDocument.create()
    blank.addPage([612, 792])
    const blankBytes = await blank.save()
    const bytes = await buildFilledOrefPdf({
      blankBytes,
      formNumber: '001',
      formName: 'Residential Real Estate Sale Agreement (SAMPLE — replace)',
      coverRows: [{ label: 'Sale price', value: '$435,000' }],
    })
    expect(bytes.byteLength).toBeGreaterThan(500)
    const out = await PDFDocument.load(bytes)
    expect(out.getPageCount()).toBe(2)
  })

  it('writes overlay values onto the blank pages when the 001 map is used', async () => {
    const blank = await PDFDocument.create()
    for (let i = 0; i < 15; i++) blank.addPage([612, 792])
    const blankBytes = await blank.save()
    const resolved = resolveOrefFieldMap({ formNumber: '001', pageCount: 15, fieldMap: [] })
    const { filled } = mapDealFactsToFillValues(FACTS, resolved.fields)
    const bytes = await buildFilledOrefPdf({
      blankBytes,
      formNumber: '001',
      formName: 'Residential Real Estate Sale Agreement',
      coverRows: [{ label: 'Sale price', value: '$435,000' }],
      overlays: filled,
    })
    const out = await PDFDocument.load(bytes)
    expect(out.getPageCount()).toBe(16)
    expect(filled.find((f) => f.factKey === 'salePrice')?.value).toBe('$435,000')
    expect(filled.find((f) => f.factKey === 'address')?.value).toBe('218 SW 4th St')
    expect(bytes.byteLength).toBeGreaterThan(blankBytes.byteLength)

    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
    const doc = await pdfjs.getDocument({ data: bytes, useSystemFonts: true }).promise
    const page = await doc.getPage(3)
    const tc = await page.getTextContent()
    const text = tc.items
      .map((i) => ('str' in i && typeof i.str === 'string' ? i.str : ''))
      .join(' ')
    expect(text).toContain('218 SW 4th St')
    expect(text).toContain('Redmond')
    expect(text).toContain('Todd Chester')
    expect(text).toContain('$435,000')
  })

  it.skipIf(!findOref001Sample())(
    'writes deal facts onto the live encrypted 001 sample blank',
    async () => {
      const sample = findOref001Sample()
      if (!sample) return
      const blankBytes = new Uint8Array(readFileSync(sample))
      const resolved = resolveOrefFieldMap({ formNumber: '001', pageCount: 15, fieldMap: [] })
      const { filled } = mapDealFactsToFillValues(FACTS, resolved.fields)
      const bytes = await buildFilledOrefPdf({
        blankBytes,
        formNumber: '001',
        formName: 'Residential Real Estate Sale Agreement',
        coverRows: [{ label: 'Sale price', value: '$435,000' }],
        overlays: filled,
      })
      const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
      const doc = await pdfjs.getDocument({ data: bytes, useSystemFonts: true }).promise
      expect(doc.numPages).toBe(16)
      const page = await doc.getPage(3)
      const tc = await page.getTextContent()
      const text = tc.items
      .map((i) => ('str' in i && typeof i.str === 'string' ? i.str : ''))
      .join(' ')
      expect(text).toContain('218 SW 4th St')
      expect(text).toContain('Todd Chester')
      expect(text).toContain('$435,000')
    },
    // This case decrypts a real OREF blank and fills it, which costs ~3.2s on an
    // idle machine — almost no headroom under vitest's default 5s. With other
    // work on the box it blows the budget and fails as a timeout, which reads
    // like a broken assertion and has blocked unrelated commits more than once.
    // The assertions are untouched; only the clock is realistic now.
    20_000,
  )
})
