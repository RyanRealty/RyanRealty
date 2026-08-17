/**
 * One published monthly HOA for a listing.
 *
 * Facts used `<Price>` (nearest thousand). True cost used exact dollars.
 * $22 / $45 / $70 / $42 / $160 printed as $0 next to the exact line.
 * $1,529 printed as $2,000. Fleet listing-detail punch 2026-08-17.
 *
 * Prefer the ingest monthly (`hoa_monthly`). Else normalize AssociationFee
 * by frequency. Display is exact whole dollars, never nearest-thousand.
 */

export type PublishedListingHoa = {
  monthly: number
}

function asPositive(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value) || value <= 0) return null
  return value
}

export function normalizeHoaMonthly(
  fee: number | null | undefined,
  frequency: string | null | undefined,
): number | null {
  const amount = asPositive(fee)
  if (amount == null) return null
  if (!frequency?.trim()) return amount
  const lower = frequency.toLowerCase()
  if (lower.includes('month')) return amount
  if (lower.includes('quarter')) return Math.round((amount / 3) * 100) / 100
  if (lower.includes('semi')) return Math.round((amount / 6) * 100) / 100
  if (lower.includes('annual') || lower.includes('year')) return Math.round((amount / 12) * 100) / 100
  if (lower.includes('bi-month')) return Math.round((amount / 2) * 100) / 100
  return amount
}

export function publishListingHoa(input: {
  hoaMonthly?: number | null
  associationFee?: number | null
  associationFeeFrequency?: string | null
}): PublishedListingHoa | null {
  const monthly =
    asPositive(input.hoaMonthly) ??
    normalizeHoaMonthly(input.associationFee, input.associationFeeFrequency)
  if (monthly == null) return null
  return { monthly }
}

export function formatListingHoa(hoa: PublishedListingHoa): string {
  return `$${Math.round(hoa.monthly).toLocaleString('en-US')} per month`
}
