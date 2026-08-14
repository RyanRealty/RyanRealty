/**
 * Build the filled OREF packet PDF: a deal-facts cover (only present facts)
 * plus the licensed/sample blank. When a field_map has geometry, overlay
 * those text values using the same sealer geometry as seal-pdf.
 */
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { fieldRectToPdf } from './seal-pdf'
import type { FillValue } from './oref-fill'

const NAVY = rgb(16 / 255, 39 / 255, 66 / 255)
const INK = rgb(0.1, 0.1, 0.1)
const MUTED = rgb(0.4, 0.4, 0.4)

function pdfSafe(s: string): string {
  return s.replace(/[^\x20-\x7E]/g, '?')
}

export type CoverRow = { label: string; value: string }

function asFraction(field: { x?: number; y?: number; w?: number; h?: number }): {
  x: number
  y: number
  w: number
  h: number
} | null {
  const x = field.x
  const y = field.y
  const w = field.w
  const h = field.h
  if (x == null || y == null || w == null || h == null) return null
  if (![x, y, w, h].every((n) => Number.isFinite(n))) return null
  if (x <= 1 && y <= 1 && w <= 1 && h <= 1) return { x, y, w, h }
  return { x: x / 612, y: y / 792, w: w / 612, h: h / 792 }
}

export async function buildFilledOrefPdf(input: {
  blankBytes: Uint8Array
  formNumber: string
  formName: string
  coverRows: CoverRow[]
  overlays?: FillValue[]
}): Promise<Uint8Array> {
  const out = await PDFDocument.create()
  out.setTitle(`OREF ${input.formNumber} filled from deal facts`)
  out.setProducer('Ryan Realty TC')
  const helv = await out.embedFont(StandardFonts.Helvetica)
  const helvBold = await out.embedFont(StandardFonts.HelveticaBold)

  const cover = out.addPage([612, 792])
  let y = 740
  cover.drawText(pdfSafe(`OREF ${input.formNumber}`), { x: 54, y, size: 16, font: helvBold, color: NAVY })
  y -= 22
  const name = pdfSafe(input.formName.replace(/\s+\(SAMPLE.*$/i, '').slice(0, 90))
  cover.drawText(name, { x: 54, y, size: 11, font: helv, color: INK })
  y -= 28
  cover.drawText('Filled from deal facts on this cycle. Missing fields were omitted, not invented.', {
    x: 54,
    y,
    size: 9,
    font: helv,
    color: MUTED,
  })
  y -= 14
  cover.drawText('Brokers do not build forms. Packet is for Matt review only.', {
    x: 54,
    y,
    size: 9,
    font: helv,
    color: MUTED,
  })
  y -= 28

  if (!input.coverRows.length) {
    cover.drawText('No deal facts were present to fill.', { x: 54, y, size: 10, font: helv, color: INK })
  } else {
    for (const row of input.coverRows) {
      if (y < 72) break
      cover.drawText(pdfSafe(row.label), { x: 54, y, size: 9, font: helvBold, color: NAVY })
      cover.drawText(pdfSafe(row.value.slice(0, 90)), { x: 220, y, size: 9, font: helv, color: INK })
      y -= 16
    }
  }

  try {
    const src = await PDFDocument.load(input.blankBytes)
    const pages = await out.copyPages(src, src.getPageIndices())
    const firstBlank = out.getPageCount()
    for (const p of pages) out.addPage(p)

    for (const overlay of input.overlays ?? []) {
      const frac = asFraction(overlay)
      if (!frac || overlay.page == null) continue
      const pageIdx = firstBlank + (overlay.page - 1)
      if (pageIdx < firstBlank || pageIdx >= out.getPageCount()) continue
      const page = out.getPage(pageIdx)
      const box = fieldRectToPdf(frac, page.getWidth(), page.getHeight())
      const size = Math.max(7, Math.min(11, box.h * 0.7))
      page.drawText(pdfSafe(overlay.value.slice(0, 80)), {
        x: box.x + 2,
        y: box.y + (box.h - size) / 2 + 1,
        size,
        font: helv,
        color: INK,
      })
    }
  } catch {
    // Unreadable blank: cover page still ships so Matt sees the facts.
  }

  return out.save()
}
