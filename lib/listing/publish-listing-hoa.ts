/**
 * One published monthly HOA for a listing.
 *
 * Facts used `<Price>` (nearest thousand). True cost used exact dollars.
 * $22 / $45 / $70 / $42 / $160 printed as $0 next to the exact line.
 * $1,529 printed as $2,000. Fleet listing-detail punch 2026-08-17.
 *
 * Prefer the ingest monthly (`hoa_monthly`). Else normalize AssociationFee
 * by frequency. Display is exact whole dollars, never nearest-thousand.
 * Facts, True cost, and the listing rental-analysis HOA field share that
 * monthly. A missing fee withholds on Facts/True cost and seeds $0 in the
 * investor calculator (no listing on the standalone tool).
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

/**
 * Seed for the listing rental-analysis HOA field. Same monthly Facts and
 * True cost publish. Missing HOA stays 0 so the standalone calculator is
 * unchanged. Foley 220221409: hoa_monthly 21.67 printed $22, investor
 * input stayed 0 (fleet:investor listing-detail 2026-08-19).
 */
export function publishRentalHoaMonthly(
  input: Parameters<typeof publishListingHoa>[0],
): number {
  const hoa = publishListingHoa(input)
  return hoa ? Math.round(hoa.monthly) : 0
}
