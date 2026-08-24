import { describe, expect, it } from 'vitest'
import { PDFDocument, StandardFonts } from 'pdf-lib'
import { fieldMapFromAcroFormPdf } from './acroform-field-map'

describe('fieldMapFromAcroFormPdf', () => {
  it('reads a text widget as a mapped field', async () => {
    const pdf = await PDFDocument.create()
    const page = pdf.addPage([612, 792])
    await pdf.embedFont(StandardFonts.Helvetica)
    const form = pdf.getForm()
    const tf = form.createTextField('Buyer1Name')
    tf.addToPage(page, { x: 100, y: 700, width: 200, height: 16 })
    const bytes = await pdf.save()
    const map = await fieldMapFromAcroFormPdf(bytes)
    expect(map.length).toBe(1)
    expect(map[0].dataRef).toBe('Buyer1Name')
    expect(map[0].signerRole).toBe('buyer')
    expect(map[0].page).toBe(1)
  })

  it('returns empty for a blank page with no widgets', async () => {
    const pdf = await PDFDocument.create()
    pdf.addPage([612, 792])
    const map = await fieldMapFromAcroFormPdf(await pdf.save())
    expect(map).toEqual([])
  })
})
