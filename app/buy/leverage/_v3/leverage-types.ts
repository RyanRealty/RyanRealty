import type { LeverageAreaSlug } from './leverage-constants'

export type LeverageAreaRow = {
  slug: LeverageAreaSlug
  name: string
  href: string
  monthsSupply: number | null
  monthsSupplyLabel: string | null
  priceCutShareLabel: string | null
  daysToOffer90: number | null
  daysToOffer90Label: string | null
  note: string
}

export type LeverageBendStats = {
  asOfLabel: string | null
  asOfIso: string | null
  monthsSupply: number | null
  monthsSupplyLabel: string | null
  priceCutShareLabel: string | null
  medianPriceCutLabel: string | null
  saleToFirstAskLabel: string | null
  saleToFinalListLabel: string | null
  daysToOffer90: number | null
  daysToOffer12mo: number | null
  daysToClose12mo: number | null
  medianAgeActive: number | null
}

export type LeverageRegionStats = {
  monthsSupplyLabel: string | null
  priceCutShareLabel: string | null
  daysToOffer90: number | null
  asOfLabel: string | null
}

export type LeverageWeekDrops = {
  count: number
  medianDropLabel: string | null
  asOfLabel: string | null
  degraded: boolean
}

export type LeverageSnapshot = {
  bend: LeverageBendStats
  region: LeverageRegionStats
  areas: LeverageAreaRow[]
  weekDrops: LeverageWeekDrops | null
  methodLine: string
}
