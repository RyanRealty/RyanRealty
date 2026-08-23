/**
 * Extract PDF text (pdfjs, no canvas) so a form can be identified before send.
 */
import { configurePdfjsWorker } from '@/lib/pdf/pdfjs-node'

export async function extractPdfPagesText(
  buf: ArrayBuffer | Uint8Array,
  maxPages = 8,
): Promise<string> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  configurePdfjsWorker(pdfjs)
  const data = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  const doc = await pdfjs.getDocument({ data, isEvalSupported: false, useSystemFonts: true }).promise
  const pages = Math.min(doc.numPages, Math.max(1, maxPages))
  const chunks: string[] = []
  try {
    for (let p = 1; p <= pages; p++) {
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
  return chunks.join('\n')
}
