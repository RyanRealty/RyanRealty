/**
 * Checked-in OREF 001 overlay used when live `tc_form_versions.field_map`
 * is empty (the registered sample is a flat PDF, no AcroForm).
 *
 * Geometry was measured from the 15-page sample blank footer
 * "OREF 001 | Released 01/2026" (US Letter). Coordinates are PDF
 * user-space points, origin bottom-left; converted to the sealer's
 * top-left fractions at export.
 *
 * Do not apply this overlay to a different page count — a revised
 * blank must get its own measured map. Missing deal facts stay blank.
 */

import type { FillableField } from './oref-fill'

export const OREF_001_OVERLAY_FORM_NUMBER = '001'
export const OREF_001_OVERLAY_RELEASE = '01/2026'
export const OREF_001_OVERLAY_PAGE_COUNT = 15
export const OREF_001_PAGE_WIDTH = 612
export const OREF_001_PAGE_HEIGHT = 792

const BOX_H = 12

/** PDF user-space (bottom-left points) → top-left fractional field. */
export function oref001FieldFromPdfPoints(
  page: number,
  x: number,
  yBottom: number,
  w: number,
  binding: string,
  label: string,
  h = BOX_H,
): FillableField {
  const yPdf = yBottom - 2
  return {
    type: 'text',
    key: binding,
    binding,
    dataRef: binding,
    label,
    page,
    x: x / OREF_001_PAGE_WIDTH,
    y: (OREF_001_PAGE_HEIGHT - yPdf - h) / OREF_001_PAGE_HEIGHT,
    w: w / OREF_001_PAGE_WIDTH,
    h: h / OREF_001_PAGE_HEIGHT,
  }
}

/**
 * Measured blanks on the 01/2026 15-page sample.
 * Page 2: parties / street / purchase price / deposit.
 * Page 9: escrow company. Page 10: closing deadline.
 */
const OREF_001_MEASURED: ReadonlyArray<{
  page: number
  x: number
  yBottom: number
  w: number
  binding: string
  label: string
}> = [
  { page: 2, x: 320, yBottom: 603, w: 250, binding: 'Buyer1Name', label: 'Buyers' },
  { page: 2, x: 222, yBottom: 579, w: 340, binding: 'Seller1Name', label: 'Sellers' },
  { page: 2, x: 175, yBottom: 525, w: 390, binding: 'PropertyAddress', label: 'Property address' },
  { page: 2, x: 78, yBottom: 513, w: 400, binding: 'PropertyCity', label: 'City' },
  { page: 2, x: 505, yBottom: 405, w: 68, binding: 'SalePrice', label: 'Sale price' },
  { page: 2, x: 430, yBottom: 381, w: 70, binding: 'EarnestMoney', label: 'Earnest money' },
  { page: 9, x: 264, yBottom: 339, w: 220, binding: 'EscrowCompany', label: 'Escrow company' },
  { page: 10, x: 472, yBottom: 252, w: 95, binding: 'EscrowClosingDate', label: 'Escrow closing date' },
]

export function isOref001OverlayApplicable(
  formNumber: string | null | undefined,
  pageCount: number | null | undefined,
): boolean {
  const num = (formNumber ?? '').replace(/^0+/, '') === '1' || formNumber === '001'
  if (!num) return false
  if (pageCount == null) return true
  return pageCount === OREF_001_OVERLAY_PAGE_COUNT
}

export function oref001OverlayFieldMap(): FillableField[] {
  return OREF_001_MEASURED.map((m) =>
    oref001FieldFromPdfPoints(m.page, m.x, m.yBottom, m.w, m.binding, m.label),
  )
}
