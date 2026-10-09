/**
 * Shared types for the deterministic Broker Price Opinion builder (lib/bpo/**).
 *
 * The BPO reuses the CMA engine's subject / comp / market / broker shapes and
 * pricing math (lib/cma/**). What it adds is the listing-history analysis and
 * the reconciliation of comps + history + market into a single, defensible
 * opinion of value. Every figure is computed in the same build from live
 * Supabase data and traced in citations (CLAUDE.md section 0).
 */

import type { ListingEventDates } from '@/lib/cma/listing-status'
import type {
  CmaSubject,
  CmaAdjustedComp,
  CmaMarketContext,
  CmaBroker,
} from '@/lib/cma/types'

export type { CmaSubject, CmaAdjustedComp, CmaMarketContext, CmaBroker }

/** The outcome of one MLS listing attempt (one ListingKey) at the property. */
export interface BpoListingCycle {
  listingKey: string | null
  mlsNumber: string | null
  status: string | null
  listAgentName: string | null
  listOfficeName: string | null
  listDate: string | null
  offMarketDate: string | null
  originalListPrice: number | null
  finalListPrice: number | null
  closePrice: number | null
  daysOnMarket: number | null
  priceCutCount: number | null
  totalPriceChangeAmt: number | null
  wasRelisted: boolean
  /** sold | canceled | expired | withdrawn | active | pending | other */
  outcome: string
  /**
   * Set by lib/cma/expired-audit.ts cycleOnTheMarket from the MLS status log:
   * the status the listing left Active for, when it differs from `status`
   * (withdrawn, then expired months later).
   */
  leftActiveAs?: string | null
  /** The Pacific day `status` took effect, when that is after the day it left Active. */
  statusDate?: string | null
  /**
   * The first day the listing was ever on the market (original_on_market_timestamp:
   * Active, never Coming Soon). Earlier than `listDate` when it came back.
   */
  firstOnMarketAt?: string | null
  /**
   * Set by cycleOnTheMarket: the exact moment the last stretch on the market
   * began (the status change's timestamp, else the row's list timestamp). The
   * first ask printed is the ask in effect at that moment (Matt 2026-10-08).
   */
  listedAt?: string | null
  /** Set by cycleOnTheMarket: true when that stretch is not the listing's first. */
  restarted?: boolean
  /**
   * The MLS row's own dated fields for the events that end a stretch
   * (WithdrawDate, CancellationDate, ExpirationDate, OffMarketDate,
   * PurchaseContractDate, CloseDate). cycleOnTheMarket dates the day the
   * listing left Active by these, not by the day the change was keyed in
   * (reader review 2026-10-09, 1355 Jacksonville).
   */
  eventDates?: ListingEventDates | null
}

export interface BpoHistorySignal {
  code:
    | 'repeated_failed_attempts'
    | 'chronic_overpricing'
    | 'stale_current_listing'
    | 'meaningful_cut'
    | 'fresh_to_market'
    | 'priced_to_comps'
    | 'no_mls_history'
    | 'last_sale'
  severity: 'info' | 'caution' | 'strong'
  text: string
}

export interface BpoListingHistory {
  cycles: BpoListingCycle[]
  attemptsCount: number
  failedAttemptsCount: number
  /** The active or most-recent cycle, when present. */
  currentCycle: BpoListingCycle | null
  currentIsActive: boolean
  currentDaysOnMarket: number | null
  currentListPrice: number | null
  currentOriginalListPrice: number | null
  currentCutFromOriginalPct: number | null
  /** Cumulative $ chased-down across all attempts vs the highest original ask. */
  peakAskingPrice: number | null
  totalDeclineFromPeakPct: number | null
  lastSalePrice: number | null
  lastSaleDate: string | null
  signals: BpoHistorySignal[]
  /** Bounded [-0.06, 0] downward hint the opinion engine may apply to the comp
   *  reconciliation when the active listing's own market evidence is strong.
   *  History can only pull the opinion toward or below the comps, never inflate. */
  listingPressureAdjustmentPct: number
  trace: string[]
}

export interface BpoOpinion {
  /** Single-point broker opinion of value. */
  opinionValue: number
  valueLow: number
  valueHigh: number
  confidence: 'High' | 'Moderate' | 'Supportable'
  confidenceReason: string
  /** How the opinion relates to the current list price, when active. */
  vsCurrentListPct: number | null
  /** The comp reconciliation anchor before history adjustment. */
  compAnchor: number
  priceOverride: number | null
  reasoning: string[]
}

export interface BpoOfferStrategy {
  /** buyer = how to acquire a live listing; seller = how to price + what to expect. */
  mode: 'buyer' | 'seller'
  posture: 'buyer-favored' | 'balanced' | 'seller-favored'
  leverageScore: number
  headline: string
  // Buyer mode (subject actively listed).
  openingOffer: number | null
  targetOffer: number | null
  ceiling: number | null
  // Seller mode (subject not on market).
  recommendedList: number | null
  expectedOfferLow: number | null
  expectedOfferHigh: number | null
  /** Why the posture is what it is. */
  leverage: string[]
  /** Tactical terms + contingency guidance. */
  terms: string[]
}

export interface BpoClientLink {
  personId: number | null
  clientName: string | null
  clientEmail: string | null
}

export interface BpoBuildInput {
  slug: string
  mlsNumber?: string | null
  rawAddress?: string | null
  city?: string | null
  postalCode?: string | null
  brokerSlug?: string | null
  brokerEmail?: string | null
  purpose?: string | null
  requestedBy?: string | null
  requestSource?: string | null
  /** Broker-adjusted opinion of value (rebuild path). */
  priceOverride?: number | null
  client?: BpoClientLink
}

export interface BpoBuildResult {
  ok: boolean
  error?: string
  slug: string
  bpoId?: string
  subject?: CmaSubject
  comps?: CmaAdjustedComp[]
  market?: CmaMarketContext | null
  history?: BpoListingHistory
  opinion?: BpoOpinion
  offer?: BpoOfferStrategy
  html?: string
  citations?: Record<string, unknown>
}
