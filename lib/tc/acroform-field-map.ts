/**
 * Pull widget geometry from a fillable PDF when SkySlope field_map is empty.
 * Flattened sample blanks return []. Do not invent boxes.
 */
import { PDFCheckBox, PDFDocument, PDFSignature, PDFTextField } from 'pdf-lib'
import { deriveSignerRole, type MappedField } from './skyslope-field-map'

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0
  return n < 0 ? 0 : n > 1 ? 1 : n
}

export async function fieldMapFromAcroFormPdf(bytes: Uint8Array): Promise<MappedField[]> {
  const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true })
  const form = pdf.getForm()
  const pages = pdf.getPages()
  const out: MappedField[] = []
  for (const field of form.getFields()) {
    const name = field.getName()
    let type: MappedField['type'] = 'text'
    if (field instanceof PDFCheckBox) type = 'checkbox'
    else if (field instanceof PDFSignature) type = 'signature'
    else if (field instanceof PDFTextField) type = 'text'
    const widgets = field.acroField.getWidgets()
    for (const w of widgets) {
      const rect = w.getRectangle()
      const pageRef = w.P()
      let pageIndex = 0
      if (pageRef) {
        const idx = pages.findIndex((p) => p.ref === pageRef)
        if (idx >= 0) pageIndex = idx
      }
      const page = pages[pageIndex]
      const { width: W, height: H } = page.getSize()
      const x = rect.x
      const yBottom = rect.y
      const wdt = rect.width
      const hgt = rect.height
      out.push({
        type,
        page: pageIndex + 1,
        x: clamp01(x / W),
        y: clamp01((H - yBottom - hgt) / H),
        w: clamp01(wdt / W),
        h: clamp01(hgt / H),
        dataRef: name,
        signerRole: deriveSignerRole(name, name),
        optional: false,
        label: name,
      })
    }
  }
  return out
}
