/**
 * The half of THE PAGE CONTRACT that has to run before the PDF exists.
 *
 * `assertPdfPageSafety` measures ink in the finished document, which catches
 * anything that bled into a header, a footer, or a margin. It cannot catch the
 * opposite failure: content that was CLIPPED. A clipped row is not drawn at
 * all, so there is nothing in the PDF to measure — the document simply comes
 * out short a comparable, and every geometry check on it passes.
 *
 * That is the failure that shipped. A fixed-height sheet with `overflow:hidden`
 * dropped part of a comp's stat line from a delivered CMA and reported success.
 *
 * So the fit check runs in the browser, against the live layout, where the
 * difference between `scrollHeight` and `clientHeight` still exists. It is the
 * only place the truth is visible.
 */

import type { Page } from 'puppeteer-core'
import { PAPER, PT_PER_IN } from '@/lib/pdf/page-contract'

/** CSS reference pixels per inch. Fixed by spec, independent of screen DPI. */
const CSS_PX_PER_IN = 96

/** One sheet, in CSS pixels — what a `.page` element must fit inside. */
const SHEET_HEIGHT_PX = (PAPER.heightPt / PT_PER_IN) * CSS_PX_PER_IN

export type PageFitOverflow = {
  /** 1-indexed position of the sheet element in the document. */
  index: number
  /** The element's own label, when it has one — page meta, heading, or id. */
  label: string
  /** Vertical overflow in CSS pixels (96px = 1in). */
  overflowPx: number
  /** True when the container would have clipped rather than reflowed. */
  clips: boolean
}

export class PdfPageFitError extends Error {
  readonly overflows: PageFitOverflow[]
  constructor(label: string, overflows: PageFitOverflow[]) {
    const detail = overflows
      .slice(0, 6)
      .map(
        (o) =>
          `[sheet ${o.index}${o.label ? ` "${o.label}"` : ''} +${o.overflowPx}px${o.clips ? ' CLIPPED' : ''}]`,
      )
      .join(' ')
    super(
      `${label}: ${overflows.length} sheet(s) hold more content than fits. ` +
        `Content that does not fit is either clipped away or pushed into a reserved band — ` +
        `neither may reach a client. ${detail}`,
    )
    this.name = 'PdfPageFitError'
    this.overflows = overflows
  }
}

/**
 * Measure every fixed-height sheet container in the page.
 *
 * `selector` targets the elements that model one physical sheet. Documents that
 * flow (the contract model, where the browser paginates) have no such element
 * and are correctly a no-op here — their overflow becomes a new sheet, which is
 * the whole point.
 */
export async function measurePageFit(page: Page, selector = '.page'): Promise<PageFitOverflow[]> {
  return page.evaluate(
    (sel: string, sheetPx: number) => {
      const out: PageFitOverflow[] = []
      const sheets = Array.from(document.querySelectorAll<HTMLElement>(sel))
      sheets.forEach((el, i) => {
        const style = getComputedStyle(el)
        const clips = style.overflowY === 'hidden' || style.overflowY === 'clip'
        const rect = el.getBoundingClientRect()

        // The question is not "is the box big" — it is "did content go past the
        // edge of the box it was given". That edge is the content box: the
        // sheet minus its padding, which is where the footer band begins.
        const padBottom = parseFloat(style.paddingBottom) || 0
        const borderBottom = parseFloat(style.borderBottomWidth) || 0
        const contentBottom = rect.bottom - padBottom - borderBottom

        // Running marks are positioned into the reserved bands deliberately;
        // they are not overflow. Anything else that reaches past the content
        // box is either clipped away or printed over the footer.
        let deepest = contentBottom
        for (const node of Array.from(el.querySelectorAll<HTMLElement>('*'))) {
          if (node.closest('.pg-header, .pg-footer')) continue
          const pos = getComputedStyle(node).position
          if (pos === 'absolute' || pos === 'fixed') continue
          const r = node.getBoundingClientRect()
          if (r.height === 0 || r.width === 0) continue
          if (r.bottom > deepest) deepest = r.bottom
        }

        // A sheet element taller than the paper spans two physical sheets even
        // when nothing left its content box — the tail lands in an unmargined
        // band on the sheet after it.
        const past = deepest - contentBottom
        const grown = rect.height - sheetPx
        const overflow = Math.max(past, grown)
        // Sub-pixel excess is layout rounding, not content that will not fit.
        if (overflow <= 2) return

        const meta = el.querySelector('.pg-meta, h1, h2')
        out.push({
          index: i + 1,
          label: (meta?.textContent ?? '').trim().slice(0, 60),
          overflowPx: Math.round(overflow),
          clips,
        })
      })
      return out
    },
    selector,
    SHEET_HEIGHT_PX,
  )
}

/**
 * Measure and throw. Called from the render paths after layout has settled and
 * before `page.pdf()`.
 *
 * `PDF_PAGE_SAFETY=warn` downgrades to a logged warning, matching the byte-level
 * check, for local iteration only.
 */
export async function assertPageFit(page: Page, label: string, selector = '.page'): Promise<void> {
  const mode = process.env.PDF_PAGE_SAFETY
  if (mode === 'off') return
  const overflows = await measurePageFit(page, selector)
  if (overflows.length === 0) return
  if (mode === 'warn') {
    console.warn(`[pdf-page-fit] ${label}`, JSON.stringify(overflows))
    return
  }
  throw new PdfPageFitError(label, overflows)
}
