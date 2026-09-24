/**
 * PDF I/O for the document reader: per-page text + annotation contents, and
 * JPEG renders of the pages the reader will look at. pdfjs + @napi-rs/canvas,
 * the same stack lib/tc/oref-fill-pdf.ts already runs on Vercel.
 */
import { configurePdfjsWorker, pdfjsFontOptions } from '@/lib/pdf/pdfjs-node'
import type { PageText } from './anatomy'

type PdfjsModule = typeof import('pdfjs-dist/legacy/build/pdf.mjs')
type PdfDoc = Awaited<ReturnType<PdfjsModule['getDocument']>['promise']>

/**
 * 1.5 × 72 dpi = 108 dpi: a letter page is 918 × 1188 px. Signature strokes,
 * e-sign stamps and checkboxes read cleanly at this size (checked by eye on
 * DocuSign, DigiSign and scanned wet-ink pages, 2026-09-23); larger renders
 * cost image tokens without changing what the reader sees.
 */
export const RENDER_SCALE = 1.5
const JPEG_QUALITY = 82

/**
 * One render may not exceed this many pixels. A letter page at RENDER_SCALE is
 * 1.1 MP; a poster-size page (plats, site plans, surveys) at 1.5 is hundreds of
 * MP. On 2026-09-24 one single-page "17130 Mayfield Dr" plan took the process
 * to 4.2 GB, and the reader cron was killed for running out of memory on every
 * run for hours, so nothing behind that page in the queue was ever read.
 */
export const MAX_RENDER_PIXELS = 4_000_000
export const MAX_RENDER_SIDE = 3000

/** The scale to render a page of this size (PDF points at scale 1). Pure. */
export function renderScaleFor(width: number, height: number): number {
  if (!(width > 0) || !(height > 0)) return RENDER_SCALE
  return Math.min(RENDER_SCALE, MAX_RENDER_SIDE / Math.max(width, height), Math.sqrt(MAX_RENDER_PIXELS / (width * height)))
}

export type OpenPdf = {
  pageCount: number
  texts: () => Promise<PageText[]>
  render: (page: number) => Promise<Buffer>
  close: () => Promise<void>
}

export async function openPdf(bytes: Uint8Array | ArrayBuffer): Promise<OpenPdf> {
  const pdfjs: PdfjsModule = await import('pdfjs-dist/legacy/build/pdf.mjs')
  configurePdfjsWorker(pdfjs)
  // A plain copy: pdfjs rejects a Node Buffer and may detach what it is given.
  const data = new Uint8Array(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes))
  // Standard font data, or every typed value (names, dates, the Sale
  // Agreement #) renders blank: see pdfjsFontOptions.
  const doc: PdfDoc = await pdfjs.getDocument({ data, isEvalSupported: false, useSystemFonts: false, verbosity: 0, ...pdfjsFontOptions() }).promise

  async function texts(): Promise<PageText[]> {
    const out: PageText[] = []
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n)
      const tc = await page.getTextContent()
      const parts: string[] = []
      for (const item of tc.items) if ('str' in item && item.str) parts.push(item.str)
      const annots = await page.getAnnotations().catch(() => [] as Array<Record<string, unknown>>)
      const annotations: string[] = []
      for (const a of annots as Array<{ contentsObj?: { str?: string }; fieldName?: string }>) {
        if (a.contentsObj?.str) annotations.push(a.contentsObj.str)
        if (a.fieldName) annotations.push(a.fieldName)
      }
      out.push({ page: n, text: parts.join(' '), annotations })
      page.cleanup()
    }
    return out
  }

  async function render(n: number): Promise<Buffer> {
    const { createCanvas } = await import('@napi-rs/canvas')
    const page = await doc.getPage(n)
    const base = page.getViewport({ scale: 1 })
    const viewport = page.getViewport({ scale: renderScaleFor(base.width, base.height) })
    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height))
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    await page.render({ canvasContext: ctx as unknown as CanvasRenderingContext2D, viewport }).promise
    page.cleanup()
    return canvas.toBuffer('image/jpeg', JPEG_QUALITY)
  }

  return { pageCount: doc.numPages, texts, render, close: () => doc.destroy() }
}
