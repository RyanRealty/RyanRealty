/**
 * THE PAGE CONTRACT — one geometry for every Ryan Realty PDF.
 *
 * Every document we send a human (CMA, BPO, market report, net sheet, flyer)
 * obeys the same page box. The contract exists because two page models were in
 * use and both bled:
 *
 *   1. Fixed-height sheets (`.page { height: 11in; overflow: hidden }`) — when
 *      content ran long it crossed into the footer band and was then silently
 *      clipped. Real client CMAs lost real content that way.
 *   2. A single flowing `.page` div with CSS padding — padding applies once at
 *      the top of the box and once at the bottom, so every INTERIOR sheet
 *      printed with no margin at all. Measured: body text 1.5pt from the paper
 *      edge on sheets 3+.
 *
 * The contract fixes both by moving the reserved bands out of the document and
 * into the page box itself:
 *
 *   - `@page { margin }` reserves the bands on EVERY sheet, interior included.
 *     The browser's own pagination then makes overflow impossible — content
 *     that does not fit becomes a new sheet, it does not become a bleed.
 *   - The running header/footer are drawn by Chrome INTO the reserved margin
 *     strips, so body content physically cannot collide with them. They are not
 *     document elements competing for the same space.
 *
 * Nothing here is advisory. `assertPdfPageSafety()` re-derives these numbers
 * from the produced PDF bytes and throws before the file can be sent.
 *
 * Geometry is stated in PostScript points (72pt = 1in) because that is the unit
 * a PDF is measured in.
 */

/** 72pt = 1 inch. */
export const PT_PER_IN = 72

const inches = (n: number) => Math.round(n * PT_PER_IN * 100) / 100

/** US Letter, the only paper we print. Portrait. */
export const PAPER = {
  format: 'Letter' as const,
  widthPt: inches(8.5),
  heightPt: inches(11),
}

/**
 * Reserved bands, in inches. `top`/`bottom` hold the running header/footer;
 * `left`/`right` are the side margins. Body content lives strictly inside.
 */
export const MARGIN_IN = {
  top: 0.75,
  right: 0.6,
  bottom: 0.7,
  left: 0.6,
} as const

export const MARGIN_PT = {
  top: inches(MARGIN_IN.top),
  right: inches(MARGIN_IN.right),
  bottom: inches(MARGIN_IN.bottom),
  left: inches(MARGIN_IN.left),
} as const

/**
 * Absolute no-ink zone measured from the paper edge. NOTHING may enter it —
 * not body copy, not the running header, not the page number. A printer that
 * trims or a reader that photocopies loses anything inside this band, so it
 * stays empty. 0.25in is the tightest margin a consumer printer reproduces
 * reliably.
 */
export const EDGE_SAFE_IN = 0.25
export const EDGE_SAFE_PT = inches(EDGE_SAFE_IN)

/** The box body content must stay inside, in PDF points from the bottom-left. */
export const CONTENT_BOX_PT = {
  x0: MARGIN_PT.left,
  y0: MARGIN_PT.bottom,
  x1: PAPER.widthPt - MARGIN_PT.right,
  y1: PAPER.heightPt - MARGIN_PT.top,
} as const

/**
 * How far a text run may sit outside the content box before it counts as a
 * bleed. Glyph bounding boxes include ascender/descender slack that the visible
 * ink never reaches, and hinting shifts a run by a fraction of a point, so a
 * hairline tolerance produces false alarms. 2pt is under a third of a line at
 * our smallest body size, well below anything a reader perceives as a collision.
 */
export const BLEED_TOLERANCE_PT = 2

/**
 * The stylesheet every paged HTML document must include, before its own styles.
 *
 * `@page` is what makes the guarantee hold across sheets. Do not restate
 * margins as padding on a wrapper div — that is the bug this replaces.
 */
export function pageContractCss(): string {
  return `
  @page {
    size: ${PAPER.format};
    margin: ${MARGIN_IN.top}in ${MARGIN_IN.right}in ${MARGIN_IN.bottom}in ${MARGIN_IN.left}in;
  }

  /* The reserved bands belong to @page. A document that also pads its own
     wrapper double-counts them and loses a band on interior sheets. */
  html, body { margin: 0; padding: 0; }

  /* Deliberate sheet break. Replaces fixed-height sheets: a section starts on
     fresh paper, then flows for as many sheets as its content needs. */
  .sheet-break { break-before: page; page-break-before: always; }
  .sheet-break:first-child { break-before: auto; page-break-before: auto; }

  /* Keep-together rules. A block that cannot be split never straddles a sheet
     boundary, which is what produces a half-row orphaned under a header. */
  h1, h2, h3, h4 { break-after: avoid; page-break-after: avoid; }
  p, li { orphans: 3; widows: 3; }
  table, figure, img { break-inside: avoid; page-break-inside: avoid; }
  tr { break-inside: avoid; page-break-inside: avoid; }
  thead { display: table-header-group; }

  /* An element taller than the content box cannot be paginated and WILL clip.
     Capping it at the content height turns a silent truncation into a visible
     scale-down. */
  img, svg, canvas { max-width: 100%; max-height: ${(CONTENT_BOX_PT.y1 - CONTENT_BOX_PT.y0) / PT_PER_IN}in; }

  /* overflow:hidden on a paged container destroys content instead of moving it
     to the next sheet. It is banned by ci:pdf-page-safety; this is the backstop
     for any stylesheet that slips one through. */
  @media print {
    .page, .sheet, .doc { overflow: visible !important; height: auto !important; }
  }
`
}

/**
 * Running header/footer drawn by Chrome into the reserved margin strips.
 *
 * Chrome renders these in an isolated frame with no access to the document's
 * styles or fonts, so every rule is inline and the type is a system stack.
 * `.pageNumber` / `.totalPages` are Chrome-substituted spans.
 *
 * Padding keeps the strip clear of EDGE_SAFE_PT on both axes.
 */
const STRIP_SIDE_PAD_IN = MARGIN_IN.left

function strip(inner: string, extra: string): string {
  return (
    `<div style="-webkit-print-color-adjust:exact;print-color-adjust:exact;` +
    `width:100%;box-sizing:border-box;padding:0 ${STRIP_SIDE_PAD_IN}in;${extra}` +
    `font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;` +
    `font-size:8px;color:#102742;display:flex;justify-content:space-between;` +
    `align-items:center;letter-spacing:0.04em;">${inner}</div>`
  )
}

export type RunningMarks = {
  /** Upper-left of every sheet. Usually the brand. */
  headerLeft?: string
  /** Upper-right. Usually the document type. */
  headerRight?: string
  /** Lower-left. Usually brokerage + the public phone. */
  footerLeft?: string
  /**
   * Lower-right. Defaults to `Page N of M`. Chrome substitutes the counts, so
   * the numbers are always the real sheet count — never a value the renderer
   * guessed before pagination.
   */
  footerRight?: string
}

export function headerTemplate(m: RunningMarks): string {
  const l = m.headerLeft ?? ''
  const r = m.headerRight ?? ''
  if (!l && !r) return '<div></div>'
  // Sits just below the no-ink zone, at the top of its reserved band.
  return strip(`<span>${l}</span><span>${r}</span>`, `padding-top:${EDGE_SAFE_IN}in;`)
}

export function footerTemplate(m: RunningMarks): string {
  const l = m.footerLeft ?? ''
  const r = m.footerRight ?? 'Page <span class="pageNumber"></span> of <span class="totalPages"></span>'
  return strip(`<span>${l}</span><span>${r}</span>`, `padding-bottom:${EDGE_SAFE_IN}in;`)
}

/**
 * The ONLY puppeteer `page.pdf()` options a Ryan Realty document may use.
 *
 * `preferCSSPageSize: true` hands the page box to `@page`. Passing an explicit
 * `margin` here instead is what produced zero-margin interior sheets: puppeteer
 * margins are applied per sheet correctly, but a document that then re-pads its
 * own wrapper double-counts, and one that does not pad at all gets whatever
 * puppeteer was told — historically `0`.
 */
export function pdfRenderOptions(marks: RunningMarks) {
  const hasHeader = Boolean(marks.headerLeft || marks.headerRight)
  return {
    format: PAPER.format,
    printBackground: true,
    preferCSSPageSize: true,
    displayHeaderFooter: true,
    headerTemplate: hasHeader ? headerTemplate(marks) : '<div></div>',
    footerTemplate: footerTemplate(marks),
  }
}

/**
 * Page style for the @react-pdf/renderer surfaces (market report, listing,
 * rental, comparison). react-pdf paginates flow content correctly on its own,
 * but it does NOT reserve space for a `fixed` absolutely-positioned footer —
 * content flows under it. The bottom padding here is the reservation.
 */
export const REACT_PDF_PAGE_STYLE = {
  paddingTop: MARGIN_PT.top,
  paddingRight: MARGIN_PT.right,
  paddingBottom: MARGIN_PT.bottom,
  paddingLeft: MARGIN_PT.left,
} as const

/** Footer band for react-pdf `fixed` footers — inside the reserved strip. */
export const REACT_PDF_FOOTER_STYLE = {
  position: 'absolute' as const,
  bottom: EDGE_SAFE_PT + 6,
  left: MARGIN_PT.left,
  right: MARGIN_PT.right,
}
