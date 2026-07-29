/**
 * Shared types for the deterministic CMA builder (lib/cma/**).
 *
 * The builder replaces the dead LLM producer-runtime for `content:cma` rows:
 * every figure is computed in the same build from live Supabase data and
 * traced in the citations blob (CLAUDE.md §0). Methodology follows
 * marketing_brain_skills/producers/cma/SKILL.md steps 3, 4, 4.5, and 9.
 */

export interface CmaSubject {
  listingKey: string | null
  mlsNumber: string | null
  streetAddress: string
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
}

export interface CmaComp {
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
  yearBuilt: number | null
  photoUrl: string | null
  publicRemarks: string | null
  viewDescription: string | null
  taxAnnual: number | null
  listPrice: number | null
  closePrice: number
  closeDate: string
  daysToOffer: number | null
  domTotal: number | null
  selectionTier: string
  /** "1.75 miles NW" — Fannie Mae B4-1.3-08 requires distance + direction be reported. */
  proximity?: string | null
  /** Set when the comp came from a competing market area; the render must disclose it. */
  competingArea?: string | null
}

export interface CmaAdjustedComp extends CmaComp {
  monthsSinceClose: number
  timeAdjustment: number
  timeAdjustedPrice: number
  ppsfTimeAdjusted: number
  sizeAdjustment: number
  adjustedPrice: number
  weight: number
}

export interface CmaMarketContext {
  geoSlug: string
  geoLabel: string
  periodStart: string
  periodEnd: string
  soldCount365: number
  medianSalePrice: number | null
  medianDom: number | null
  medianPpsf: number | null
  saleToListRatio: number | null
  yoyMedianPriceDeltaPct: number | null
  activeCount: number | null
  pendingCount: number | null
  monthsOfSupply: number | null
  /** Which formula/source produced monthsOfSupply (canonical pulse vs 365d fallback). */
  mosFormula: string | null
  marketVerdict: 'seller' | 'balanced' | 'buyer' | null
  methodologyVersion: string | null
  computedAt: string | null
  pulseUpdatedAt: string | null
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
