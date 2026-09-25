/**
 * Print fragments for CMA tables. Chrome will split a tall table wherever
 * the remaining box ends, and font metrics move that cut. These sizes are
 * metric-independent: never leave fewer than three body rows on either
 * side of a break, and keep a short or two-column matrix whole.
 */

/** A page may not inherit fewer body rows than this on either side of a break. */
export const MIN_TABLE_FRAGMENT_ROWS = 3

/** About twelve body rows, or a two-home matrix, stay on one sheet. */
export const SHORT_MATRIX_MAX_ROWS = 12
export const SHORT_MATRIX_MAX_HOME_COLS = 2

/**
 * A table of about twelve body rows stays whole. A taller two-column
 * matrix (the active set is 19 rows) is not forced whole: that parks a
 * chapter header alone when the leftover box is short. Those tables
 * split between row-packs of at least three, each continuation reprinting
 * the photo/address head.
 */
export function keepMatrixWhole(_homeCols: number, bodyRows: number): boolean {
  return bodyRows <= SHORT_MATRIX_MAX_ROWS
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
 * How to cut a long matrix into whole tables, each with its own photo head.
 * Chrome does not reprint thead across a break, so each piece is a complete
 * table of at most 12 body rows and at least 3.
 */
export function matrixChunkSizes(
  rowCount: number,
  max = SHORT_MATRIX_MAX_ROWS,
  min = MIN_TABLE_FRAGMENT_ROWS,
): number[] {
  if (rowCount <= 0) return []
  if (rowCount <= max) return [rowCount]
  const sizes: number[] = []
  let remaining = rowCount
  while (remaining > 0) {
    if (remaining <= max) {
      if (remaining < min && sizes.length > 0) {
        const need = min - remaining
        sizes[sizes.length - 1] -= need
        sizes.push(remaining + need)
      } else {
        sizes.push(remaining)
      }
      break
    }
    sizes.push(max)
    remaining -= max
  }
  return sizes
}
