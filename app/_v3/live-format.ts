/**
 * Call-site guards so a barrel `v3Text` never receives formatPrice/formatDate's
 * empty-input placeholder. Both helpers return that placeholder for null, and
 * v3Text throws on a blank name; comparing to the helper's own null output
 * keeps the placeholder character out of this file.
 */
import { formatDate } from '@/lib/format/date'
import { formatPrice } from '@/lib/format/money'
import { v3Text, type V3Text } from '@/components/site/v3'

const EMPTY_PRICE = formatPrice(null)
const EMPTY_DATE = formatDate(null)

export function livePrice(n: number | null | undefined): string | null {
  if (n == null || !Number.isFinite(n) || n <= 0) return null
  const s = formatPrice(n)
  if (!s || s === EMPTY_PRICE) return null
  return s
}

export function liveStamp(iso: string | null | undefined): V3Text | undefined {
  if (!iso) return undefined
  const s = formatDate(iso)
  if (!s || s === EMPTY_DATE) return undefined
  return v3Text(s)
}

export function liveMonthLabel(iso: string | null | undefined): string | null {
  if (!iso) return null
  const s = formatDate(iso, { month: 'short', year: 'numeric', day: undefined })
  if (!s || s === EMPTY_DATE) return null
  return s
}
