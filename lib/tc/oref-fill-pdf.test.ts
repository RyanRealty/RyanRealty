import { describe, expect, it } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import { buildFilledOrefPdf } from './oref-fill-pdf'

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
})
