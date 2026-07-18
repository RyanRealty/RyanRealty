/**
 * Presentational formatting helpers shared across the CMA worklist's card
 * tree (/admin/cmas), mirrored from components/admin/prospecting/format.ts.
 * Pure functions only — no data access, no server imports.
 */

// Currency uses the canonical helper (nearest-thousand rounding per CLAUDE.md,
// null → em-dash) instead of an inline Intl.NumberFormat (ci:currency-format gate).
export { formatPrice } from '@/lib/format/money'

// Dates use the canonical helper (ci:date-format gate; consistent TZ + null→em-dash).
import { formatDate as formatDateCanonical } from '@/lib/format/date'

export function formatDate(iso: string | null): string {
  return formatDateCanonical(iso)
}
