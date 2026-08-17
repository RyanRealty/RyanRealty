/**
 * The backstop for THE PAGE CONTRACT: read the produced PDF and refuse to
 * release it if any text sits where a reader would lose it.
 *
 * This runs on the bytes, not on the source. That is the whole point. A CSS
 * refactor, a new renderer, a template someone writes next year, an LLM-authored
 * narrative three paragraphs longer than the fixture — none of it can route
 * around a check that measures the finished document.
 *
 * Three rules, each one a defect we actually shipped:
 *
 *   EDGE      No text within EDGE_SAFE_PT of the paper edge. Caught the flowing
 *             `.page` div that printed body copy 1.5pt from the sheet edge on
 *             every interior sheet.
 *   STRADDLE  No text run crosses the content-box boundary. A run belongs
 *             wholly to the body, wholly to the header strip, or wholly to the
 *             footer strip. Crossing means content has grown into a reserved
 *             band — the CMA-into-footer bleed.
 *   SIDE      No text in the left/right margins at all. There is no legitimate
 *             side strip; ink there is always overflow.
 *
 * Geometry is PDF user space: origin bottom-left, points, 72pt = 1in.
 */

import {
  BLEED_TOLERANCE_PT,
  EDGE_SAFE_PT,
  MARGIN_IN,
  PT_PER_IN,
  marginsToPt,
  type Margins,
} from '@/lib/pdf/page-contract'
import { configurePdfjsWorker, pdfjsGetDocumentOptions } from '@/lib/pdf/pdfjs-node'

export type PageSafetyViolation = {
  /** 1-indexed physical sheet. */
  page: number
  rule: 'EDGE' | 'STRADDLE' | 'SIDE'
  /** How far past the boundary, in points. */
  overflowPt: number
  /** Which boundary was crossed. */
  edge: 'top' | 'bottom' | 'left' | 'right'
  /** The offending text, trimmed for the error message. */
  text: string
  box: { x0: number; y0: number; x1: number; y1: number }
}

export type PageSafetyReport = {
  ok: boolean
  pageCount: number
  violations: PageSafetyViolation[]
}

export class PdfPageSafetyError extends Error {
  readonly report: PageSafetyReport
  constructor(label: string, report: PageSafetyReport) {
    super(
      `${label}: ${report.violations.length} page-safety violation(s) across ${report.pageCount} sheet(s). ` +
        formatViolations(report.violations),
    )
    this.name = 'PdfPageSafetyError'
    this.report = report
  }
}

export function formatViolations(violations: PageSafetyViolation[], limit = 8): string {
  const shown = violations.slice(0, limit).map((v) => {
    const inches = (v.overflowPt / PT_PER_IN).toFixed(2)
    return `[p${v.page} ${v.rule} ${v.edge} +${v.overflowPt.toFixed(1)}pt (${inches}in)] "${v.text}"`
  })
  const more = violations.length > limit ? ` …and ${violations.length - limit} more` : ''
  return shown.join(' ') + more
}

type TextRun = { x0: number; y0: number; x1: number; y1: number; text: string }

/**
 * Glyph boxes from the text matrix. `transform` is [a,b,c,d,e,f] where (e,f) is
 * the baseline origin; the vertical scale gives the em size. Ascenders sit
 * above the baseline and descenders below it, and neither is in the matrix, so
 * the box is padded by the standard fractions rather than assumed to be the
 * baseline itself — a run whose descender clips is still a clipped run.
 */
const DESCENDER_FRACTION = 0.25

async function extractRuns(data: Uint8Array): Promise<{ pages: TextRun[][]; sizes: { w: number; h: number }[] }> {
  // Dynamic import: pdfjs is only needed when a PDF is actually produced, and
  // this keeps it out of cold-start on every other route.
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  configurePdfjsWorker(pdfjs)
  const doc = await pdfjs.getDocument(pdfjsGetDocumentOptions(data)).promise

  const pages: TextRun[][] = []
  const sizes: { w: number; h: number }[] = []
  try {
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i)
      const vp = page.getViewport({ scale: 1 })
      sizes.push({ w: vp.width, h: vp.height })
      const content = await page.getTextContent()
      const runs: TextRun[] = []
      for (const item of content.items as Array<Record<string, unknown>>) {
        const str = typeof item.str === 'string' ? item.str : ''
        if (!str.trim()) continue
        const t = item.transform as number[] | undefined
        if (!t || t.length < 6) continue
        const [, b, , d, e, f] = t
        const em = Math.hypot(b, d) || (typeof item.height === 'number' ? item.height : 0)
        const width = typeof item.width === 'number' ? item.width : 0
        if (em <= 0 || width <= 0) continue
        runs.push({
          x0: e,
          x1: e + width,
          y0: f - em * DESCENDER_FRACTION,
          y1: f + em,
          text: str.trim(),
        })
      }
      pages.push(runs)
      page.cleanup()
    }
  } finally {
    await doc.destroy()
  }
  return { pages, sizes }
}

export type PageSafetyOptions = {
  /**
   * Documents that draw their own running marks inside the body instead of
   * using the Chrome margin templates have no reserved strips to classify
   * against, so STRADDLE cannot apply. EDGE and SIDE still do.
   */
  runningMarksInBody?: boolean
  /**
   * The bands this document actually declared to `pageContractCss`. Must match,
   * or the check polices a box the document never used. Defaults to MARGIN_IN.
   */
  margins?: Margins
}

/** Inspect a PDF and report every place text left the contract. */
export async function inspectPdfPageSafety(
  pdf: Buffer | Uint8Array,
  options: PageSafetyOptions = {},
): Promise<PageSafetyReport> {
  const bytes = pdf instanceof Uint8Array ? pdf : new Uint8Array(pdf)
  // pdfjs takes ownership of the buffer it is handed, so give it a copy —
  // otherwise the caller's Buffer is detached and the PDF it is about to send
  // becomes zero-length.
  const { pages, sizes } = await extractRuns(new Uint8Array(bytes))

  const violations: PageSafetyViolation[] = []
  const tol = BLEED_TOLERANCE_PT
  const MARGIN_PT = marginsToPt(options.margins ?? MARGIN_IN)

  pages.forEach((runs, idx) => {
    const { w, h } = sizes[idx]
    const pageNo = idx + 1

    // Content box for this sheet, derived from the sheet's real dimensions so a
    // page that is not Letter is still measured against its own edges.
    const cx0 = MARGIN_PT.left
    const cx1 = w - MARGIN_PT.right
    const cy0 = MARGIN_PT.bottom
    const cy1 = h - MARGIN_PT.top

    for (const r of runs) {
      const text = r.text.slice(0, 60)

      // ── EDGE: nothing may enter the no-ink zone, header/footer included.
      const edges: Array<[PageSafetyViolation['edge'], number]> = [
        ['left', EDGE_SAFE_PT - r.x0],
        ['right', r.x1 - (w - EDGE_SAFE_PT)],
        ['bottom', EDGE_SAFE_PT - r.y0],
        ['top', r.y1 - (h - EDGE_SAFE_PT)],
      ]
      let flaggedEdge = false
      for (const [edge, over] of edges) {
        if (over > tol) {
          violations.push({ page: pageNo, rule: 'EDGE', edge, overflowPt: over, text, box: r })
          flaggedEdge = true
        }
      }
      if (flaggedEdge) continue

      // ── SIDE: the side margins hold nothing, ever.
      if (r.x0 < cx0 - tol) {
        violations.push({ page: pageNo, rule: 'SIDE', edge: 'left', overflowPt: cx0 - r.x0, text, box: r })
        continue
      }
      if (r.x1 > cx1 + tol) {
        violations.push({ page: pageNo, rule: 'SIDE', edge: 'right', overflowPt: r.x1 - cx1, text, box: r })
        continue
      }

      if (options.runningMarksInBody) continue

      // ── STRADDLE: a run lives wholly in the body, wholly in the header strip,
      // or wholly in the footer strip. Crossing a boundary is the bleed.
      const inBody = r.y0 >= cy0 - tol && r.y1 <= cy1 + tol
      const inHeaderStrip = r.y0 >= cy1 - tol
      const inFooterStrip = r.y1 <= cy0 + tol
      if (inBody || inHeaderStrip || inFooterStrip) continue

      const crossesFooter = cy0 - r.y0
      const crossesHeader = r.y1 - cy1
      if (crossesFooter >= crossesHeader) {
        violations.push({ page: pageNo, rule: 'STRADDLE', edge: 'bottom', overflowPt: crossesFooter, text, box: r })
      } else {
        violations.push({ page: pageNo, rule: 'STRADDLE', edge: 'top', overflowPt: crossesHeader, text, box: r })
      }
    }
  })

  violations.sort((a, b) => b.overflowPt - a.overflowPt)
  return { ok: violations.length === 0, pageCount: pages.length, violations }
}

/**
 * Inspect and throw. This is what the send paths call — a document that fails
 * the contract must not reach a client, and a loud failure is recoverable in a
 * way that a quietly clipped price opinion is not.
 *
 * `PDF_PAGE_SAFETY=warn` downgrades to a logged warning. It exists for local
 * iteration on a redesign; it is never set in production.
 */
export async function assertPdfPageSafety(
  pdf: Buffer,
  label: string,
  options: PageSafetyOptions = {},
): Promise<PageSafetyReport> {
  const mode = process.env.PDF_PAGE_SAFETY
  if (mode === 'off') return { ok: true, pageCount: 0, violations: [] }

  let report: PageSafetyReport
  try {
    report = await inspectPdfPageSafety(pdf, options)
  } catch (err) {
    // An inspector that cannot read the document proves nothing. Treat that as
    // a failure rather than as a pass, or the guarantee is only as good as the
    // parser's worst day.
    throw new Error(
      `${label}: page-safety inspection failed to run — ${err instanceof Error ? err.message : String(err)}`,
    )
  }

  if (!report.ok) {
    if (mode === 'warn') {
      console.warn(`[pdf-page-safety] ${label}`, formatViolations(report.violations))
      return report
    }
    throw new PdfPageSafetyError(label, report)
  }
  return report
}
