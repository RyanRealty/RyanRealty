/**
 * Build the filled OREF packet PDF: a deal-facts cover (only present facts)
 * plus the licensed/sample blank. When a field_map has geometry, overlay
 * those text values using the same sealer geometry as seal-pdf.
 *
 * The live OREF 001 sample is an encrypted flat PDF that pdf-lib cannot
 * copy. In that case pages are rasterized (pdfjs + @napi-rs/canvas — the
 * same stack as TC thumbnails) so overlays still land on the real blank.
 */
import { createCanvas } from '@napi-rs/canvas'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { PDFDocument, StandardFonts, rgb, type PDFFont } from 'pdf-lib'
import { fieldRectToPdf } from './seal-pdf'
import type { FillValue } from './oref-fill'

const NAVY = rgb(16 / 255, 39 / 255, 66 / 255)
const INK = rgb(0.1, 0.1, 0.1)
const MUTED = rgb(0.4, 0.4, 0.4)
const RASTER_SCALE = 1.5

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

function drawOverlays(
  out: PDFDocument,
  firstBlank: number,
  overlays: FillValue[] | undefined,
  font: PDFFont,
): void {
  for (const overlay of overlays ?? []) {
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
      font,
      color: INK,
    })
  }
}

function pdfLooksEncrypted(bytes: Uint8Array): boolean {
  const slices = [
    bytes.subarray(0, Math.min(bytes.length, 64_000)),
    bytes.subarray(Math.max(0, bytes.length - 256_000)),
  ]
  return slices.some((slice) => /\/Encrypt\b/.test(Buffer.from(slice).toString('latin1')))
}

async function copyBlankWithPdfLib(out: PDFDocument, blankBytes: Uint8Array): Promise<number> {
  if (pdfLooksEncrypted(blankBytes)) {
    throw new Error('encrypted blank')
  }
  const src = await PDFDocument.load(blankBytes)
  const pages = await out.copyPages(src, src.getPageIndices())
  for (const p of pages) out.addPage(p)
  return pages.length
}

async function rasterizeBlankPages(out: PDFDocument, blankBytes: Uint8Array): Promise<number> {
  const data = new Uint8Array(blankBytes)
  const doc = await getDocument({
    data,
    useSystemFonts: true,
    verbosity: 0,
    isEvalSupported: false,
  }).promise
  let added = 0
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n)
    const native = page.getViewport({ scale: 1 })
    const viewport = page.getViewport({ scale: RASTER_SCALE })
    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height))
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    await page.render({ canvasContext: ctx, viewport }).promise
    const jpg = canvas.toBuffer('image/jpeg', 82)
    const img = await out.embedJpg(jpg)
    const pdfPage = out.addPage([native.width, native.height])
    pdfPage.drawImage(img, { x: 0, y: 0, width: native.width, height: native.height })
    added += 1
  }
  return added
}

/** Copy the blank when pdf-lib can; otherwise rasterize so overlays still bind. */
export async function appendOrefBlankPages(out: PDFDocument, blankBytes: Uint8Array): Promise<number> {
  try {
    const copied = await copyBlankWithPdfLib(out, blankBytes)
    if (copied > 0) return copied
  } catch {
    // Encrypted / broken xref samples fall through to rasterize.
  }
  try {
    return await rasterizeBlankPages(out, blankBytes)
  } catch {
    return 0
  }
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

  const firstBlank = out.getPageCount()
  const added = await appendOrefBlankPages(out, input.blankBytes)
  if (added > 0) drawOverlays(out, firstBlank, input.overlays, helv)

  return out.save()
}
