import { describe, expect, it } from 'vitest'
import { PDFDocument, StandardFonts } from 'pdf-lib'
import { readPdfPagesText } from './pdf-page-text'

/** A 15-page form whose signature block sits on the last page, like an OREF 001. */
async function formWithSignaturesAtTheEnd(pages = 15): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  for (let n = 1; n <= pages; n++) {
    const page = doc.addPage([612, 792])
    const text = n === pages ? 'DigiSign Verified Lee Seller Seller' : `Section ${n} of the agreement`
    page.drawText(text, { x: 50, y: 700, size: 12, font })
  }
  return doc.save()
}

describe('readPdfPagesText', () => {
  it('reads every page and says so', async () => {
    const bytes = await formWithSignaturesAtTheEnd()
    const read = await readPdfPagesText(bytes)
    expect(read.pageCount).toBe(15)
    expect(read.pagesRead).toBe(15)
    expect(read.complete).toBe(true)
    expect(read.text).toContain('DigiSign Verified')
  })

  it('a capped read misses the signature page and reports itself incomplete', async () => {
    const bytes = await formWithSignaturesAtTheEnd()
    const read = await readPdfPagesText(bytes, 8)
    expect(read.pagesRead).toBe(8)
    expect(read.complete).toBe(false)
    expect(read.text).not.toContain('DigiSign Verified')
  })

  it('a short document is complete without a cap fight', async () => {
    const read = await readPdfPagesText(await formWithSignaturesAtTheEnd(2))
    expect(read.pageCount).toBe(2)
    expect(read.complete).toBe(true)
  })
})
