/**
 * Render PDF pages to ink masks (scale 1: 1 px = 1 pt) and read their text
 * items with positions. pdfjs + @napi-rs/canvas, the stack the reader and
 * lib/tc/oref-fill-pdf.ts already run on Vercel.
 */
import { configurePdfjsWorker, pdfjsFontOptions } from '@/lib/pdf/pdfjs-node'
import { maskFromGray, type Mask } from './raster'
import type { TextItem } from './layout'

type PdfjsModule = typeof import('pdfjs-dist/legacy/build/pdf.mjs')

export type RasterPdf = {
  pageCount: number
  size: (page: number) => Promise<{ w: number; h: number }>
  mask: (page: number) => Promise<Mask>
  items: (page: number) => Promise<TextItem[]>
  close: () => Promise<void>
}

/** A letter page at scale 1 is 0.48 MP; tabloid is 1 MP. */
const MAX_MASK_PIXELS = 4_000_000

export async function openRaster(bytes: Uint8Array | ArrayBuffer): Promise<RasterPdf> {
  const pdfjs: PdfjsModule = await import('pdfjs-dist/legacy/build/pdf.mjs')
  configurePdfjsWorker(pdfjs)
  const data = new Uint8Array(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes))
  const doc = await pdfjs.getDocument({ data, isEvalSupported: false, useSystemFonts: false, verbosity: 0, ...pdfjsFontOptions() }).promise
  const { createCanvas } = await import('@napi-rs/canvas')

  async function size(n: number) {
    const page = await doc.getPage(n)
    const vp = page.getViewport({ scale: 1 })
    return { w: Math.ceil(vp.width), h: Math.ceil(vp.height) }
  }

  async function mask(n: number): Promise<Mask> {
    const page = await doc.getPage(n)
    // A poster-size page (a plat, a site plan) is never a printed form page;
    // rasterize it small so it cannot exhaust the function's memory.
    const full = page.getViewport({ scale: 1 })
    const vp = full.width * full.height > MAX_MASK_PIXELS ? page.getViewport({ scale: Math.sqrt(MAX_MASK_PIXELS / (full.width * full.height)) }) : full
    const w = Math.ceil(vp.width)
    const h = Math.ceil(vp.height)
    const canvas = createCanvas(w, h)
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, w, h)
    await page.render({ canvasContext: ctx as unknown as CanvasRenderingContext2D, viewport: vp }).promise
    const rgba = ctx.getImageData(0, 0, w, h).data
    const gray = new Uint8Array(w * h)
    for (let i = 0; i < gray.length; i++) gray[i] = (rgba[i * 4] * 299 + rgba[i * 4 + 1] * 587 + rgba[i * 4 + 2] * 114) / 1000
    page.cleanup()
    return maskFromGray(gray, w, h)
  }

  async function items(n: number): Promise<TextItem[]> {
    const page = await doc.getPage(n)
    const vp = page.getViewport({ scale: 1 })
    const tc = await page.getTextContent()
    const out: TextItem[] = []
    for (const it of tc.items) {
      if (!('str' in it)) continue
      const [a, b, , d, e, f] = it.transform as number[]
      const [x, y] = vp.convertToViewportPoint(e, f) as [number, number]
      out.push({ str: it.str, x, y, w: it.width, h: Math.hypot(b, d) || Math.abs(a) || 9, font: it.fontName })
    }
    page.cleanup()
    return out
  }

  return { pageCount: doc.numPages, size, mask, items, close: () => doc.destroy() }
}
