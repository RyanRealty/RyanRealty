/**
 * Shared types for the deterministic CMA builder (lib/cma/**).
 *
 * The builder replaces the dead LLM producer-runtime for `content:cma` rows:
 * every figure is computed in the same build from live Supabase data and
 * traced in the citations blob (CLAUDE.md §0). Methodology follows
 * marketing_brain_skills/producers/cma/SKILL.md steps 3, 4, 4.5, and 9.
 */

import type { CmaMartYearFigure } from '@/lib/cma/market-board-mart'

export interface CmaSubject {
  listingKey: string | null
  mlsNumber: string | null
  streetAddress: string
  /** Unit within a shared-address building, when the MLS row carries one. */
  unitNumber?: string | null
  city: string
  state: string
  postalCode: string | null
  subdivision: string | null
  latitude: number | null
  longitude: number | null
  beds: number | null
  baths: number | null
  sqft: number | null
  lotAcres: number | null
  /** MLS property_sub_type — drives product-class comparability. */
  propertySubType: string | null
  yearBuilt: number | null
  garageSpaces: number | null
  photoUrl: string | null
  publicRemarks: string | null
  viewDescription: string | null
  taxAnnual: number | null
  standardStatus: string | null
  lastListPrice: number | null
  lastListDate: string | null
  listingHistoryLine: string | null
  /**
   * MLS association fields. Optional so existing fixtures keep compiling.
   * The MLS reports whether an association EXISTS and what it charges. It does
   * NOT report what the recorded CC&Rs say — see lib/cma/development.ts.
   */
  associationYn?: boolean | null
  associationFee?: number | null
  associationFeeFrequency?: string | null
  hoaMonthly?: number | null
  hoaAnnualCost?: number | null
  /** MLS water / sewer / levels raw values. Water is often null on the typed column. */
  waterRaw?: unknown
  sewerRaw?: unknown
  levelsRaw?: unknown
  /** MLS NewConstructionYN. Null means the feed did not say. */
  newConstructionYn?: boolean | null
}

export interface CmaComp {
  /** Unit within a shared-address building, when the MLS row carries one. */
  unitNumber?: string | null
  listingKey: string
  mlsNumber: string | null
  address: string
  city: string
  subdivision: string | null
  latitude: number | null
  longitude: number | null
  beds: number | null
  baths: number | null
  sqft: number
  lotAcres: number | null
  /** MLS property_sub_type — drives product-class comparability. */
  propertySubType: string | null
  yearBuilt: number | null
  garageSpaces?: number | null
  photoUrl: string | null
  publicRemarks: string | null
  viewDescription: string | null
  taxAnnual: number | null
  listPrice: number | null
  closePrice: number
  /** Spark ConcessionsAmount. Null means not stored, not necessarily zero. */
  concessionsAmount?: number | null
  /** Spark Concessions YN. No + blank amount = $0. Yes + blank amount = unknown. */
  concessionsYn?: string | null
  /** ClosePrice minus resolved seller concessions. Null when concessions are unknown. */
  sellerNet?: number | null
  closeDate: string
  daysToOffer: number | null
  domTotal: number | null
  selectionTier: string
  /** "1.75 miles NW" — Fannie Mae B4-1.3-08 requires distance + direction be reported. */
  proximity?: string | null
  /** Set when the comp came from a competing market area; the render must disclose it. */
  competingArea?: string | null
  /** MLS photo count on the sold listing — feeds the presentation bench. */
  photosCount?: number | null
}

export type CmaCompKeepTier = 'strong' | 'weak'

export interface CmaAdjustedComp extends CmaComp {
  monthsSinceClose: number
  timeAdjustment: number
  timeAdjustedPrice: number
  ppsfTimeAdjusted: number
  sizeAdjustment: number
  adjustedPrice: number
  weight: number
  /** Display-only judge tier. Does not change pricing math. */
  keepTier?: CmaCompKeepTier | null
  /** Display-only judge reason. Does not change pricing math. */
  keepReason?: string | null
}

export interface CmaMarketTrendPoint {
  periodStart: string
  medianSalePrice: number | null
  soldCount: number | null
  endOfPeriodInventory: number | null
}

export interface CmaMarketContext {
  geoSlug: string
  geoLabel: string
  periodStart: string
  periodEnd: string
  /** 12-month closed count. Null when leftover and trusted cache both miss. Never a zero fill. */
  soldCount365: number | null
  medianSalePrice: number | null
  medianDom: number | null
  medianPpsf: number | null
  saleToListRatio: number | null
  yoyMedianPriceDeltaPct: number | null
  activeCount: number | null
  pendingCount: number | null
  /** Live median ask from market_pulse_live. Null when the pulse row has none. */
  medianListPrice?: number | null
  monthsOfSupply: number | null
  /** Which formula/source produced monthsOfSupply (canonical pulse vs 365d fallback). */
  mosFormula: string | null
  marketVerdict: 'seller' | 'balanced' | 'buyer' | null
  methodologyVersion: string | null
  computedAt: string | null
  pulseUpdatedAt: string | null
  /** Completed months only. A chart renders only when six priced months exist. */
  trend?: CmaMarketTrendPoint[]
  /**
   * Calendar-year volume from analytics_mart_market_annual.
   * City grain when the city cell exists, else the region row labeled as region.
   * Absent when the mart row is missing. Never a zero fill.
   */
  yearMart?: CmaMartYearFigure | null
}

export interface CmaPricing {
  method1Low: number
  method1Mid: number
  method1High: number
  method2: number | null
  method3: number
  convergenceSpreadPct: number | null
  converged: boolean
  conservative: number
  recommended: number
  highEnd: number
  valueLow: number
  valueHigh: number
  /** Moat close. Live listing = current ask × 0.98. Off-market = comps $/sf × GLA. */
  predictedClose?: number | null
  /**
   * SHOW BOTH, NEVER BLEND (Matt 2026-08-27). When the subject is live-listed,
   * the recommendation stays comp-derived (band midpoint, per the 2026-08-25
   * mid-range rule) and the current ask ships BESIDE it with the gap stated,
   * never averaged in. The gap IS the finding: 828 Florida's comps supported
   * $623–657K against a $1,049,000 ask, and smoothing that away is exactly the
   * failure the rule exists to stop.
   */
  currentAsk?: number | null
  /** What ask×0.98÷sale-to-list implies (the moat's close pick). Admin context. */
  askDerivedList?: number | null
  confidence: 'High' | 'Moderate' | 'Supportable'
  confidenceReason: string
  /** True when the comp set is too heterogeneous to trust without broker review. */
  needsReview: boolean
  /** Human-readable why, when needsReview is true. */
  reviewReason: string | null
  /** Coefficient of variation of the comps' adjusted $/sqft (dispersion metric). */
  compPpsfCv: number
  priceOverride: number | null
  improvementsValueAdd: number | null
  notes: string[]
  /**
   * ClosePrice is the contract price. Seller net from that price subtracts
   * seller concessions only (commission and title are a separate net sheet).
   */
  sellerNet?: {
    expectedConcessions: number | null
    predictedSellerNet: number | null
    knownCount: number
    givenCount: number
    medianWhenGiven: number | null
    rate: number | null
  }
}

export interface CmaBroker {
  id: string | null
  slug: string
  displayName: string
  title: string
  licenseNumber: string | null
  email: string | null
  phone: string | null
  photoUrl: string | null
}

export interface CmaClient {
  name: string | null
  email: string | null
  phone: string | null
  notes: string | null
}

export interface CmaBuildInput {
  /** Canonical slug — from the action row target, or slugifyAddress for manual builds. */
  slug: string
  /** One of these resolves the subject. */
  mlsNumber?: string | null
  rawAddress?: string | null
  city?: string | null
  postalCode?: string | null
  client: CmaClient
  brokerSlug?: string | null
  brokerEmail?: string | null
  /** Seller-reported improvements spend (Method 2 value-add input). */
  sellerImprovementsTotal?: number | null
  sellerImprovementsText?: string | null
  /** Broker-adjusted recommended list price (rebuild path). */
  priceOverride?: number | null
  /**
   * Broker-curated comp set (ListingKeys). When present, these exact closed
   * sales are used instead of the auto-tiered selection; the rest of the
   * pipeline (judge, adjustments, audit, contract, render) is unchanged.
   */
  compKeys?: string[] | null
  /**
   * Broker-confirmed site facts that override the GIS-resolved values. §0 allows
   * a seller/broker-confirmed water source (e.g. a parcel converted off a private
   * well to a community supplier like Avion Water). Applied after resolveCmaSiteData.
   */
  siteOverrides?: {
    water?: { source: 'well' | 'municipal' | 'unknown'; providerName?: string | null }
  } | null
  requestSource?: string | null
  /** cma = standard seller CMA; expired-audit = expired-listing audit (failure
   *  analysis + services + 2.5% net sheet). Same engine, tailored output. */
  docType?: 'cma' | 'expired-audit'
  /** Native crm_people.id. Persisted on upsert so rebuild cannot drop the link. */
  personId?: number | null
  /** Broker-entered facts when MLS is blank or the seller corrected them. */
  subjectFacts?: { beds?: number | null; baths?: number | null; sqft?: number | null } | null
  /** Rent-vs-sell. Stored on client_notes as `Intent: sell|rent|both`. */
  clientIntent?: 'sell' | 'rent' | 'both' | null
}

export interface CmaBuildResult {
  ok: boolean
  error?: string
  slug: string
  cmaId?: string
  subject?: CmaSubject
  comps?: CmaAdjustedComp[]
  market?: CmaMarketContext | null
  pricing?: CmaPricing
  html?: string
  citations?: Record<string, unknown>
  pageCount?: number
  /** Advisory Orwell-rules voice review (W11.3) — never gates the build. Null
   *  when the reviewer call itself failed unexpectedly (belt-and-suspenders;
   *  reviewProse itself never throws). */
  voiceReview?: import('@/lib/voice/reviewer').VoiceReview | null
}
