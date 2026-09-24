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
    const viewport = page.getViewport({ scale: RENDER_SCALE })
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
