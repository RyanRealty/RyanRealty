/**
 * Print fragments for CMA tables. Chrome will split a tall table wherever
 * the remaining box ends, and font metrics move that cut. These sizes are
 * metric-independent: never leave fewer than three body rows on either
 * side of a break, keep a matrix whole when it fits one printed page, and
 * never mark a part unbreakable if that would leave the previous sheet
 * more than about 40% empty.
 */

import { CMA_MARGIN_IN, PAPER, PT_PER_IN } from '@/lib/pdf/page-contract'

/** A page may not inherit fewer body rows than this on either side of a break. */
export const MIN_TABLE_FRAGMENT_ROWS = 3

/** About twelve body rows, used only as a short-table hint in tests. */
export const SHORT_MATRIX_MAX_ROWS = 12
export const SHORT_MATRIX_MAX_HOME_COLS = 2

/** US Letter content box the CMA print contract reserves (11in − 0.4 − 0.7). */
export const PAGE_CONTENT_IN =
  PAPER.heightPt / PT_PER_IN - CMA_MARGIN_IN.top - CMA_MARGIN_IN.bottom

export const PAGE_CONTENT_WIDTH_IN =
  PAPER.widthPt / PT_PER_IN - CMA_MARGIN_IN.left - CMA_MARGIN_IN.right

/** Extra room so a borderline estimate still fits under a wider face. */
export const MATRIX_SAFE_MARGIN_IN = 0.55

/**
 * An unbreakable part may take at most this share of the content box.
 * Leftover above ~40% can start the table and split on the 3-row rule.
 */
export const UNBREAKABLE_MAX_PAGE_FRAC = 0.6

/** Matches the label column in `comp-matrix.ts`. */
const LABEL_COL_PCT = 24

/**
 * Printed height of one comparison matrix: photo head (4/3 of a value
 * column) plus address lines plus body rows. Safe over-estimate so a
 * "fits one page" call does not clip under Palatino.
 */
export function estimateMatrixHeightIn(
  homeCols: number,
  bodyRows: number,
  photos = true,
): number {
  const cols = Math.max(1, homeCols)
  const valueShare = (100 - LABEL_COL_PCT) / 100
  const colW = (PAGE_CONTENT_WIDTH_IN * valueShare) / cols
  const photoH = photos ? colW * (3 / 4) : 0
  // Narrower columns wrap the address and the ask-path more.
  const addrH = photos ? Math.min(0.85, 0.38 + 0.08 * Math.max(0, cols - 2)) : 0.28
  const headH = photoH + addrH + 0.12
  const rowH = 0.3 + (cols >= 5 ? 0.04 : 0)
  const wrap = 0.22
  return headH + Math.max(0, bodyRows) * rowH + wrap
}

/** True when the whole matrix, with a safe margin, still fits one sheet. */
export function keepMatrixWhole(homeCols: number, bodyRows: number, photos = true): boolean {
  if (bodyRows <= 0) return true
  return (
    estimateMatrixHeightIn(homeCols, bodyRows, photos) + MATRIX_SAFE_MARGIN_IN <= PAGE_CONTENT_IN
  )
}

/**
 * True when the part is short enough to mark `break-inside: avoid` without
 * jumping a leftover box that is more than about 40% of the sheet.
 */
export function keepMatrixUnbreakable(
  homeCols: number,
  bodyRows: number,
  photos = true,
): boolean {
  if (bodyRows <= 0) return true
  return estimateMatrixHeightIn(homeCols, bodyRows, photos) <= PAGE_CONTENT_IN * UNBREAKABLE_MAX_PAGE_FRAC
}

/**
 * Pack sizes so a break between groups cannot leave 1-2 body rows behind
 * or ahead. 19 rows become 3+3+3+3+3+4. Five rows stay one pack.
 */
export function tableFragmentSizes(
  rowCount: number,
  min = MIN_TABLE_FRAGMENT_ROWS,
): number[] {
  if (rowCount <= 0) return []
  const sizes: number[] = []
  let remaining = rowCount
  while (remaining > 0) {
    if (remaining < min * 2) {
      sizes.push(remaining)
      break
    }
    sizes.push(min)
    remaining -= min
  }
  return sizes
}

export function packRowHtml(rowHtmls: readonly string[]): string {
  if (rowHtmls.length === 0) return '<tbody></tbody>'
  const sizes = tableFragmentSizes(rowHtmls.length)
  let offset = 0
  return sizes
    .map((size) => {
      const slice = rowHtmls.slice(offset, offset + size)
      offset += size
      return `<tbody class="row-pack">${slice.join('')}</tbody>`
    })
    .join('')
}

/**
 * Split `rowCount` into `parts` groups whose sizes differ by at most one
 * (10+9, never 12+7). Each part is at least `min` when the total allows it.
 */
export function evenRowChunks(
  rowCount: number,
  parts: number,
  min = MIN_TABLE_FRAGMENT_ROWS,
): number[] {
  if (rowCount <= 0 || parts <= 0) return []
  const n = Math.min(parts, rowCount)
  const sizes: number[] = []
  let cut = 0
  for (let i = 0; i < n; i++) {
    const size = Math.ceil((rowCount - cut) / (n - i))
    sizes.push(size)
    cut += size
  }
  if (sizes.some((s) => s < min) && rowCount >= min * sizes.length) {
    return tableFragmentSizes(rowCount, min)
  }
  return sizes
}

/**
 * How to cut a long matrix into whole tables, each with its own photo head.
 * Keep one table whenever the estimate fits a page. Otherwise the fewest
 * near-equal parts that each still fit, every part at least three rows.
 */
export function matrixChunkSizes(
  rowCount: number,
  homeCols = 6,
  photos = true,
  min = MIN_TABLE_FRAGMENT_ROWS,
): number[] {
  if (rowCount <= 0) return []
  if (keepMatrixWhole(homeCols, rowCount, photos)) return [rowCount]
  const maxParts = Math.max(2, Math.floor(rowCount / min))
  for (let n = 2; n <= maxParts; n++) {
    const sizes = evenRowChunks(rowCount, n, min)
    if (
      sizes.length === n &&
      sizes.every((s) => s >= min && keepMatrixWhole(homeCols, s, photos))
    ) {
      return sizes
    }
  }
  return tableFragmentSizes(rowCount, min)
}
