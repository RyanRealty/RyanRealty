// Data contracts for the kinetic-brutalist (KB) homepage section islands.
// The server page fetches live DAL data and passes these props down; islands
// render markup + motion only (no client data fetch). Expanded as sections land.

export interface KbHeroData {
  activeCount: number | null
  medianListPrice: number | null
  medianDaysToPending: number | null
}

export interface KbTownItem {
  name: string
  activeCount: number
  medianPrice: number | null
  href: string
  img: string
}

export interface KbCommunityItem {
  name: string
  activeCount: number
  town: string
  href: string
  img: string
}

/** Formats a price to the nearest thousand: 740123 -> "$740,000". */
export function kbMoney(n: number | null | undefined): string | null {
  if (n == null || !Number.isFinite(n)) return null
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  return `$${Math.round(n / 1000)}K`
}

/** Full currency to the nearest thousand: 740123 -> "$740,000". */
export function kbMoneyFull(n: number | null | undefined): string | null {
  if (n == null || !Number.isFinite(n)) return null
  return `$${(Math.round(n / 1000) * 1000).toLocaleString('en-US')}`
}
