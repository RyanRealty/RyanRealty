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
  const data = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
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
