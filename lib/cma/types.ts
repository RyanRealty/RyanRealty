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
  /**
   * Who holds the subject's newest listing cycle. Read for the compliance
   * carve-out (CmaSubjectStatus): a document may not solicit a listing that is
   * live with another brokerage. Optional so existing fixtures keep compiling.
   */
  listAgentName?: string | null
  listAgentEmail?: string | null
  listOfficeName?: string | null
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
  /**
   * The seller concession as the grid prints it: a dollar amount when one was
   * reported, 0 when the sale reported none, null when nothing was recorded.
   * Resolved by `resolveConcessions`, the same function the seller-net caption
   * reads, so the line and the caption cannot disagree (research brief
   * 2026-09-07, item 8; D14).
   */
  concessions?: number | null
  /** ClosePrice minus resolved seller concessions. Null when concessions are unknown. */
  sellerNet?: number | null
  closeDate: string
  daysToOffer: number | null
  domTotal: number | null
  /** MLS OriginalListPrice when present — feeds listing history, never invents cuts. */
  originalListPrice?: number | null
  /** Broker one-liner: list/price changes + DOM. */
  listingHistoryLine?: string | null
  /** On-market date when known (comp list cycle). */
  onMarketDate?: string | null
  selectionTier: string
  /** "1.75 miles NW" — Fannie Mae B4-1.3-08 requires distance + direction be reported. */
  proximity?: string | null
  /** Set when the comp came from a competing market area; the render must disclose it. */
  competingArea?: string | null
  /** MLS photo count on the sold listing — feeds the presentation bench. */
  photosCount?: number | null
  /**
   * Room counts that differ from the subject on a sale the selector admitted
   * on the subject's own ground (lib/pricing/room-counts.ts). Present means
   * "used and disclosed", not "mismatched" — the accuracy contract reads it so
   * it does not re-apply the wall the selector deliberately opened.
   */
  roomDifference?: Array<'beds' | 'baths'> | null
}

export type CmaCompKeepTier = 'strong' | 'weak'

export interface CmaAdjustedComp extends CmaComp {
  monthsSinceClose: number
  timeAdjustment: number
  timeAdjustedPrice: number
  ppsfTimeAdjusted: number
  sizeAdjustment: number
  /**
   * One-story vs two-story premium (±13.5% of the time-adjusted price,
   * measured — lib/pricing/classes.ts). It was folded into adjustedPrice but
   * never printed, so on two Tumalo comps the itemized Time + Size failed to
   * reproduce the printed total by exactly 13.50% and the document read as
   * broken arithmetic (adversarial verify 2026-08-27). Every adjustment that
   * moves the number gets its own printed line.
   */
  storyAdjustment?: number
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
   * What `trend` MEASURES, in the document's own words (round four, class E).
   * The month line and the date-adjustment basis are two different city
   * trends — a median sale price over single-family sales here, a median price
   * a square foot over every product class there — and a document that prints
   * both unlabelled reads as one number disagreeing with itself. Defined once,
   * beside the query, at CMA_MARKET_TREND_MEASURE.
   */
  trendMeasure?: string | null
  /**
   * Calendar-year volume from analytics_mart_market_annual.
   * City grain when the city cell exists, else the region row labeled as region.
   * Absent when the mart row is missing. Never a zero fill.
   */
  yearMart?: CmaMartYearFigure | null
  /**
   * Chapter 2 of the seller document ("Priced right sells. Priced high sits"),
   * computed at BUILD in lib/pricing/local-outcomes.ts and stored on
   * `render_args`. Never derived in a renderer. Each carries its own `source`.
   * Optional: absent on rows built before 2026-09-07.
   */
  offerTiming?: import('@/lib/pricing/local-outcomes').CmaOfferTiming | null
  askOutcome?: import('@/lib/pricing/local-outcomes').CmaAskOutcome | null
  /**
   * Chapter 2b's centrepiece: the median share of the ORIGINAL asking price
   * that sales realized, by how many weeks they took to find a buyer. Ours,
   * over the city's own closed rows — it replaces the unsourceable industry
   * table (research brief 2026-09-07 §4).
   */
  originalAskRealization?: import('@/lib/pricing/local-outcomes').CmaOriginalAskRealization | null
  /**
   * The city's own failed-then-sold pairs over 24 months. When `n` is under
   * the minimum the block still ships with its reason, and the chapter falls
   * back to the regional FAILED_ASK_BACKTEST figure, named as regional.
   */
  localFailedThenSold?: import('@/lib/pricing/failed-then-sold').CmaLocalFailedThenSold | null
}

/** A printed list tier the failed-ask ceiling can move. */
export type CmaPricingClampTier = 'conservative' | 'recommended' | 'highEnd'

/** One tier the clamp moved, and how far. */
export interface CmaPricingClampApplication {
  tier: CmaPricingClampTier
  /** What the evidence supported before ANY application of this ceiling. */
  before: number
  after: number
  /** The share of the failed ask this tier was held to. */
  ratio: number
}

export interface CmaPricingClamp {
  /** The only clamp there is today. A second kind gets its own name here. */
  kind: 'failed-ask'
  /**
   * The tier the sentence is written about: the recommended price when the
   * clamp moved it, otherwise the highest tier that did move.
   */
  appliedTo: CmaPricingClampTier
  /** `appliedTo`'s figures. The two numbers the sentence names. */
  before: number
  after: number
  /** The measured share, and the corpus it was measured over. */
  basis: { ratio: number; source: string }
  /** Every tier the ceiling moved, so nothing is changed silently. */
  applications: CmaPricingClampApplication[]
  /** Seller language. Says what the sales supported, and why we do not print it. */
  sentence: string
}

/** The adversarial audit's outcome, as the document carries it. */
export type CmaPricingAuditVerdict = 'pass' | 'review' | 'fail' | 'did-not-run'

/**
 * The review flag, on the document (tasteReview round three, §2 item 1).
 *
 * Two of four exemplars carried `needsReview: true` and rendered as finished
 * opinions, one of them with the word "indefensible" in its own reviewReason
 * and nowhere on the page. This is the block a renderer reads to show the
 * broker a banner; `reasons` are rewritten in lib/pricing/review.ts so nothing
 * a seller must not read can reach a surface a seller sees.
 */
export interface CmaPricingReview {
  needsReview: boolean
  /** Seller-safe. One sentence per cause, never the engine's own wording. */
  reasons: string[]
  /** Null on a build that recorded no audit at all. */
  auditVerdict: CmaPricingAuditVerdict | null
  /**
   * How loud the surface has to be, in one word a renderer can branch on.
   *
   * Round four, class C: `pricing.review` was legible only to the admin route,
   * because reading it meant reading four fields and knowing which
   * combinations matter. A letter and a PDF each re-derived that and got it
   * wrong. 'blocked' is an audit verdict of `fail` — the analysis's own
   * refuter says it does not stand. 'review' is everything else that needs a
   * broker. 'none' is a clean build.
   */
  severity: CmaPricingReviewSeverity
  /**
   * The one sentence a letter or a PDF prints, seller-safe, or null when the
   * build is clean. A renderer must not compose its own: this is the wording
   * that has been through the voice canon.
   */
  rendererNotice: string | null
}

export type CmaPricingReviewSeverity = 'none' | 'review' | 'blocked'

/**
 * A line on the seller-net itemisation. `amount` is a COST, always positive,
 * always subtracted. `source` traces it to the data that produced it.
 */
export interface CmaSellerNetLine {
  label: string
  amount: number
  source: string
}

/**
 * WHAT THE SELLER KEEPS, itemised, from the price we recommend they list at.
 *
 * Round four, class A. The block this replaces carried one figure,
 * `predictedSellerNet`, computed as `predictedClose - expectedConcessions`.
 * `predictedClose` is the ENGINE's close estimate, which on a listed subject
 * is the seller's own ask times 0.98 and on a capped expired is whatever the
 * comps wanted before the ceiling — neither of them the price the chapter
 * prints beside it. So the four exemplars published a net of $1,707,603
 * against a $1,473,000 list, $616,000 against $816,000, $426,575 against
 * $435,000 and $436,008 against $461,000. One of them was a net ABOVE the
 * price, under a chapter headed "What you keep".
 *
 * The replacement is anchored and derivable: it starts at the recommended
 * LIST price, subtracts only costs this row can defend from data, and NAMES
 * every cost it does not include in `unknowns` so no figure implies a
 * completeness it does not have. Commission is in `unknowns` unless a caller
 * supplies it from a signed fact; it is never silently zero.
 */
export interface CmaSellerNet {
  /** Always the list. A close estimate is a different number and is not used here. */
  basis: 'list'
  /** `pricing.recommended` at the moment the block was written. */
  list: number
  /** Costs, in print order. Empty when nothing on the row is defensible. */
  lines: CmaSellerNetLine[]
  /** `list` minus every line. Can never exceed `list`. */
  net: number
  /** Seller-safe, states the arithmetic and stops. */
  sentence: string
  /** What is NOT in `net`. Never empty. */
  unknowns: string[]
  /**
   * The concession summary the lines were derived from, kept as the trace and
   * read by the net sheet and the grid caption.
   */
  expectedConcessions: number | null
  knownCount: number
  givenCount: number
  medianWhenGiven: number | null
  rate: number | null
}

/**
 * Compliance flags read off the SUBJECT listing, so a renderer can suppress a
 * solicitation without re-reading the MLS.
 *
 * Round four, class D: 1617 NW 8th is an ACTIVE listing held by another
 * brokerage and the closing chapter solicited it; 2465 7th is Withdrawn, not
 * Expired, so the owner may still be under a listing agreement. Neither
 * document carried a carve-out because nothing on `render_args` said so.
 */
export interface CmaSubjectStatus {
  /** The MLS StandardStatus of the subject's newest listing cycle. */
  standardStatus: string | null
  /** Active or Pending, and the listing agent is not ours. Do not solicit. */
  isActiveWithOtherBrokerage: boolean
  /** Withdrawn or Canceled rather than Expired: a listing agreement may still run. */
  isWithdrawnNotExpired: boolean
  /** The listing agent on that cycle is Ryan Realty. */
  listingAgentIsUs: boolean
  /** Why the flags read the way they do, or a stale-cycle suppression. Null when there is nothing to say. */
  note: string | null
}

/**
 * A printed sale the range rule set aside: it sat above or below every other
 * adjusted sale, so it is shown as evidence and carries none of the price.
 *
 * "SET ASIDE" MEANS SET ASIDE (tasteReview round three, §2 item 1). Under
 * `trimmed-one-each-end` the two extreme sales carried 38.4 percent of the
 * recommended price on cma-65365-concorde and 22.3 percent on cma-19968 while
 * the prose beside them told the reader they had been removed. They are now
 * out of the weights and out of the printed price, and this is where they go.
 */
export interface CmaSetAsideSale {
  listingKey: string
  address: string
  /** The adjusted price that put it at an end of the spread. */
  adjustedPrice: number
  /** Which end it sat at. */
  end: 'high' | 'low'
  /** The rule that set it aside, in the document's own words. */
  reason: string
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
  /**
   * Failed-listing last ask (Expired / Withdrawn / Canceled). When set, no
   * printed list number may sit above it. Null on live or closed subjects.
   */
  failedAsk?: number | null
  /** True when the printed list band was clipped to failedAsk. */
  failedAskCapped?: boolean
  /**
   * THE PRICE MUST FOLLOW FROM THE PRINTED METHOD, OR THE DOCUMENT MUST PRINT
   * WHAT OVERRODE IT (tasteReview round three, §2 item 1).
   *
   * cma-65365-concorde printed a reconciliation whose own weights carry to
   * $1,972,665 and a recommended list of $1,473,000 — the failed ask
   * $1,500,000 times the failed-then-sold p75, applied by `applyFailedAskCap`
   * and named in `reviewReason`, which no reader sees. Half a million dollars
   * of a $1.5M opinion sat between a stated method and a printed number with
   * nothing on the page connecting them.
   *
   * This is that connection: what the evidence supported, what it was clamped
   * to, the measured basis for the clamp, and one seller sentence saying so.
   * Null whenever the clamp does not bind, so a renderer can print it whenever
   * it is present and never has to decide.
   */
  clamp?: CmaPricingClamp | null
  /**
   * Which sale carried the price, and why — the appraisal reconciliation the
   * document owed the reader (research brief 2026-09-07, item 2). Computed in
   * lib/pricing/reconciliation.ts from the SAME weights the point value is
   * built from, so the sentence and the number cannot disagree.
   */
  reconciliation?: import('@/lib/pricing/reconciliation').CmaReconciliation | null
  /**
   * How `valueLow`/`valueHigh` were produced — the rule over the printed
   * adjusted sale prices, and the share of the original ask they were carried
   * to an asking price by. D10: the range a seller reads must be derivable
   * from the evidence beside it.
   */
  rangeRule?: import('@/lib/pricing/estimate').PricingRangeRule | null
  /**
   * The basis the date adjustment used — the local price path, its window, the
   * sales behind it, and a sentence for the line beside the first adjusted
   * sale. Fannie Mae B4-1.3-09 requires the technique be described; no chapter
   * showed it before (research brief 2026-09-07, item 5).
   */
  timeAdjustment?: import('@/lib/pricing/estimate').PricingTimeAdjustment | null
  /**
   * The sales the range rule set aside — the single highest and the single
   * lowest adjusted price, once there are six of them. They are printed as
   * evidence and carry NONE of the price: not a weight in
   * `reconciliation.weights`, not a dollar in `recommended`. Empty under
   * `min-max`, where nothing is set aside and nothing says it was.
   */
  setAside?: CmaSetAsideSale[] | null
  /**
   * Why a broker has to look before this is sent, in seller-safe language, and
   * what the adversarial audit said. Present on every build; `needsReview` is
   * false and `reasons` empty on a clean one.
   */
  review?: CmaPricingReview | null
  /**
   * Sales considered and not used, capped at eight, each with a reason
   * composed from the sale's own recorded facts. An appraisal shows what it
   * set aside; ours asserted a radius and showed nothing (research brief
   * 2026-09-07, item 10).
   */
  rejected?: import('@/lib/pricing/rejected').RejectedSale[] | null
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
   * What the seller keeps from the RECOMMENDED LIST, itemised, with everything
   * not included named. See CmaSellerNet — this replaced a single unanchored
   * figure that could exceed the price it was printed beside.
   */
  sellerNet?: CmaSellerNet | null
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
}
