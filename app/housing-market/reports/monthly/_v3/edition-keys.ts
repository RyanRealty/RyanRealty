/**
 * The monthly report's URLs and keys, with no UI imports, so the PDF route
 * handler can use them without pulling the v3 barrel (and its stylesheets)
 * into a route module. report-view.ts re-exports everything here.
 */
import type { EditionListItem } from '@/lib/data/market-report/editions'

export const MONTHLY_REPORT_PATH = '/housing-market/reports/monthly'

/**
 * The month a route segment names, or null. `2026-08` passes; `2026-8`,
 * `2026-13`, `2026-08-01` and anything padded do not, so a malformed URL is a
 * 404 rather than a lookup.
 */
export function parseEditionMonth(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') return null
  const match = /^(\d{4})-(\d{2})$/.exec(raw)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  if (year < 1990 || year > 2100 || month < 1 || month > 12) return null
  return raw
}

/** 'YYYY-MM' of a list row's `edition_month` ('YYYY-MM-01'). */
export function editionKey(item: Pick<EditionListItem, 'edition_month'>): string {
  return item.edition_month.slice(0, 7)
}

export function editionPath(key: string): string {
  return `${MONTHLY_REPORT_PATH}/${key}`
}

/** Our own download URL. The route redirects to the stored file. */
export function editionPdfHref(key: string): string {
  return `${editionPath(key)}/pdf`
}

/** The file name a reader's download is saved under. */
export function editionPdfFilename(key: string): string {
  return `ryan-realty-central-oregon-market-report-${key}.pdf`
}

/** An edition with no stored file has a page and no download. */
export function hasPdf(item: Pick<EditionListItem, 'pdf_path'>): boolean {
  return typeof item.pdf_path === 'string' && item.pdf_path.trim().length > 0
}
