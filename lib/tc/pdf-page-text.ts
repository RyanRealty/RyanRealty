/**
 * Extract PDF text (pdfjs, no canvas) so a form can be identified AND read for
 * signature evidence before it is filed.
 *
 * Read every page. Signature blocks on OREF forms sit on the LAST pages — a
 * 001 sale agreement is 15 pages and signs on 13-15 — so a partial read cannot
 * tell "nobody signed" from "we stopped reading before the signatures". The
 * cap below is a runaway guard for a pathological scan, not a working limit;
 * when it bites, `complete` is false and the caller must refuse to award an
 * execution state (see classifyFromFormAndText).
 */
import { configurePdfjsWorker } from '@/lib/pdf/pdfjs-node'
import type { TextRun } from './area-reference'

/** Far past any real Oregon form or packet. Only a runaway file reaches it. */
export const PDF_TEXT_PAGE_CEILING = 200

export type PdfTextRead = {
  text: string
  /** Pages in the document. */
  pageCount: number
  /** Pages actually read. */
  pagesRead: number
  /** Every page was read. False means the text is partial evidence. */
  complete: boolean
}

export async function readPdfPagesText(
  buf: ArrayBuffer | Uint8Array,
  maxPages: number = PDF_TEXT_PAGE_CEILING,
): Promise<PdfTextRead> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  configurePdfjsWorker(pdfjs)
  // Always a plain Uint8Array copy: pdfjs rejects a Node Buffer (a Uint8Array
  // subclass, so an instanceof check lets it through) and may detach what it is
  // given, while callers still upload these same bytes afterwards.
  const data = new Uint8Array(buf instanceof Uint8Array ? buf : new Uint8Array(buf))
  const doc = await pdfjs.getDocument({ data, isEvalSupported: false, useSystemFonts: true }).promise
  const pageCount = doc.numPages
  const pagesRead = Math.min(pageCount, Math.max(1, maxPages))
  const chunks: string[] = []
  try {
    for (let p = 1; p <= pagesRead; p++) {
      const page = await doc.getPage(p)
      const tc = await page.getTextContent()
      const parts: string[] = []
      for (const item of tc.items) {
        if ('str' in item && typeof item.str === 'string' && item.str.trim()) parts.push(item.str)
      }
      chunks.push(`<<< Page ${p} >>>\n${parts.join(' ')}`)
    }
  } finally {
    await doc.destroy()
  }
  return { text: chunks.join('\n'), pageCount, pagesRead, complete: pagesRead >= pageCount }
}

/** Text only, whole document by default. Prefer readPdfPagesText when the caller decides execution state. */
export async function extractPdfPagesText(
  buf: ArrayBuffer | Uint8Array,
  maxPages: number = PDF_TEXT_PAGE_CEILING,
): Promise<string> {
  return (await readPdfPagesText(buf, maxPages)).text
}

/**
 * Every page's text runs with their positions, as fractions of the page, y at
 * the baseline from the top (lib/tc/area-reference.ts reads a form's printed
 * headings and line numbers from these).
 */
export async function readPdfTextRuns(
  buf: ArrayBuffer | Uint8Array,
  maxPages: number = PDF_TEXT_PAGE_CEILING,
): Promise<TextRun[][]> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  configurePdfjsWorker(pdfjs)
  const data = new Uint8Array(buf instanceof Uint8Array ? buf : new Uint8Array(buf))
  const doc = await pdfjs.getDocument({ data, isEvalSupported: false, useSystemFonts: true }).promise
  const pages: TextRun[][] = []
  try {
    for (let p = 1; p <= Math.min(doc.numPages, Math.max(1, maxPages)); p++) {
      const page = await doc.getPage(p)
      const vp = page.getViewport({ scale: 1 })
      const tc = await page.getTextContent()
      const runs: TextRun[] = []
      for (const item of tc.items) {
        if (!('str' in item) || !item.str) continue
        const [, , , , e, f] = item.transform as number[]
        const [x, y] = vp.convertToViewportPoint(e, f) as [number, number]
        runs.push({ str: item.str, x: x / vp.width, y: y / vp.height, w: item.width / vp.width })
      }
      pages.push(runs)
      page.cleanup()
    }
  } finally {
    await doc.destroy()
  }
  return pages
}
