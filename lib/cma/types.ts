/**
 * Shared types for the deterministic CMA builder (lib/cma/**).
 *
 * The builder replaces the dead LLM producer-runtime for `content:cma` rows:
 * every figure is computed in the same build from live Supabase data and
 * traced in the citations blob (CLAUDE.md §0). Methodology follows
 * marketing_brain_skills/producers/cma/SKILL.md steps 3, 4, 4.5, and 9.
 */

import type { CmaMartYearFigure } from '@/lib/cma/market-board-mart'
import type { ListingStretch } from '@/lib/cma/listing-status'
import type { LocationMatch } from '@/lib/pricing/closed-comp-weight'
import type { RoomDecision } from '@/lib/pricing/room-ground'
import type { SizeAdjustmentBasis } from '@/lib/pricing/size-adjustment'

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
  /** Recorded plat polygon. Phases of one ordinary subdivision share a family. */
  subdivisionSlug?: string | null
  latitude: number | null
  longitude: number | null
  beds: number | null
  baths: number | null
  /**
   * MLS full and half bath counts (listings.baths_full / baths_half). `baths`
   * is BathroomsTotal, which counts a half bath whole (lib/pricing/bath-count.ts).
   */
  bathsFull?: number | null
  bathsHalf?: number | null
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
  /**
   * MLS OriginalListPrice: the ask the listing opened at, Coming Soon included.
   * The price engine reads it. The letter prints the first ask of the home's
   * last stretch on the market (`stretch`, lib/cma/last-stretch.ts).
   */
  originalListPrice?: number | null
  /**
   * The listing's last stretch on the market (Matt 2026-10-08, "Last stretch,
   * labeled"): the day it began, the ask in effect at that moment, and whether
   * it came back. Stamped at build; absent on rows built before.
   */
  stretch?: ListingStretch | null
  /**
   * The first day this listing was ever on the market (original_on_market_timestamp:
   * Active, never Coming Soon). Earlier than `lastListDate` when it came back.
   */
  firstOnMarketAt?: string | null
  lastListDate: string | null
  listingHistoryLine: string | null
  /**
   * The status the last listing left Active for, from the MLS status log, when
   * it is not the status of record: 3177 Coho was withdrawn Feb 10 and its
   * listing expired Sep 30, so this is 'Withdrawn' beside a standardStatus of
   * 'Expired'. Every sentence about the day it came off reads the two through
   * lib/cma/listing-status.ts cameOffStatus. Absent on rows built before the
   * status log was read.
   */
  cameOffAs?: string | null
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
   * MLS SeniorCommunityYN. True is evidence the home is in an age-restricted
   * community (lib/pricing/age-restricted.ts); false and null are not evidence.
   */
  seniorCommunityYn?: boolean | null
  /**
   * Who holds the subject's newest listing cycle. Read for the compliance
   * carve-out (CmaSubjectStatus): a document may not solicit a listing that is
   * live with another brokerage. Optional so existing fixtures keep compiling.
   */
  listAgentName?: string | null
  listAgentEmail?: string | null
  listOfficeName?: string | null
  /**
   * Community whose boundary contains this address. Set when lat/lng was
   * tested. Not the MLS subdivision name, and not a remark.
   */
  communitySlug?: string | null
  communityLocated?: boolean
}

export interface CmaComp {
  /** Unit within a shared-address building, when the MLS row carries one. */
  unitNumber?: string | null
  listingKey: string
  mlsNumber: string | null
  address: string
  city: string
  subdivision: string | null
  /** Recorded plat the sale sits in. The room rule reads a phase family from this. */
  subdivisionSlug?: string | null
  latitude: number | null
  longitude: number | null
  beds: number | null
  baths: number | null
  /**
   * MLS full and half bath counts (listings.baths_full / baths_half). `baths`
   * is BathroomsTotal, which counts a half bath whole (lib/pricing/bath-count.ts).
   */
  bathsFull?: number | null
  bathsHalf?: number | null
  sqft: number
  lotAcres: number | null
  /** MLS property_sub_type — drives product-class comparability. */
  propertySubType: string | null
  yearBuilt: number | null
  /** MLS NewConstructionYN. True is never-owned new construction. Null means the feed did not say. */
  newConstructionYn?: boolean | null
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
   * Resolved by `resolveConcessions`. The comparison matrix subtracts a
   * recorded amount from the sale before date and size; it does not invent one.
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
  /**
   * The Pacific day the listing period that produced the sale went Active: the
   * day `daysToOffer` counts from (lib/cma/listing-status.ts offerRun). Later
   * than `onMarketDate` when the home was withdrawn or fell out of contract and
   * came back. Absent on rows built before the status log was read.
   */
  offerFrom?: string | null
  /**
   * The listing period that produced the sale, as one clock (Matt 2026-10-08,
   * "Last stretch, labeled"): the day it began (the day `daysToOffer` counts
   * from), the ask in effect at that moment, and whether the home had been on
   * the market before it. Print through lib/cma/last-stretch.ts saleStretch.
   * Absent on rows built before 2026-10-08.
   */
  stretch?: ListingStretch | null
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
  /**
   * The picker's one-room decision for this sale with the counts it compared
   * (lib/pricing/room-ground.ts). Every check after the picker reads it
   * through `carriedRoomDecision`, so the review and the contract call the
   * decision the picker called (rule 4) whatever subset of the bath split
   * reached them. Absent on a sale no picker admitted.
   */
  roomDecision?: RoomDecision | null
  /**
   * The selector's own-plat decision for this sale (onOwnPlat in
   * lib/pricing/plat-ground.ts, the same decision on both ladders: the plat, a
   * phase, an alias sibling, or a recorded addition or phase of its family
   * inside the subject's neighborhood, Matt 2026-10-08; or the street-cluster
   * pocket), stamped by whichever ladder found it. A sale in the subject's own plat is exempt from price-tier grading, so
   * the comparability judge restores one it excluded on price (lib/cma/judge.ts).
   * Absent on a broker-picked comp, which no search admitted.
   */
  ownPlat?: boolean | null
  /**
   * Rule 15's location step from where the sale sits (own plat, touching plat,
   * inside the subject's neighborhood or community, else wider), stamped at
   * admission by either ladder (lib/pricing/closed-comp-weight.ts
   * locationMatchFromFacts). Absent on a broker-picked comp; the weight then
   * reads the rung name.
   */
  locationMatch?: LocationMatch | null
  /**
   * The walk admitted this sale on rule 20 (lib/pricing/price-set.ts) with
   * its fullest inputs, so the weight does not re-grade it (Matt 2026-10-07).
   * Absent on a set no walk graded, such as a broker-picked one, where the
   * weight runs the test itself.
   */
  setsPrice?: boolean | null
  /**
   * MLS SeniorCommunityYN for this sale. True walls it out of an ordinary
   * subject's pricing (lib/pricing/age-restricted.ts); false and null are not
   * evidence either way.
   */
  seniorCommunityYn?: boolean | null
  /** Community whose boundary contains this sale. Not the MLS plat name. */
  communitySlug?: string | null
  communityLocated?: boolean
  /**
   * Whether the sale's MLS row reports an HOA ('hoa' | 'no_hoa' | 'unknown',
   * classifyHoa). A community made up from a plat name walls the search only
   * when the home carries one (lib/cma/community-location.ts
   * searchCommunitySlug, Matt 2026-10-08). Absent on a row that did not say.
   */
  hoaClass?: string | null
  /**
   * Printed when this sale is inside the recorded plat and its sewer is not
   * the subject's. Names which is which. No dollar adjustment.
   */
  sewerNote?: string | null
}

export type CmaCompKeepTier = 'strong' | 'weak'

export interface CmaAdjustedComp extends CmaComp {
  monthsSinceClose: number
  timeAdjustment: number
  timeAdjustedPrice: number
  ppsfTimeAdjusted: number
  sizeAdjustment: number
  /**
   * Why the size move is what it is (lib/pricing/size-adjustment.ts). A sale
   * with no living area recorded is not adjusted for size, and the grid says
   * so on its row instead of printing a dollar figure. Absent on rows stored
   * before 2026-10-08.
   */
  sizeAdjustmentBasis?: SizeAdjustmentBasis | null
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
  /**
   * The market path that moved this sale's price, kept so a short-set reweight
   * uses the same age rule as the first pass.
   */
  marketPathSource?: 'index' | 'none' | null
  marketMonthlyRate?: number | null
  marketReversed?: boolean | null
  marketCapped?: boolean | null
  /** Display-only judge tier. Does not change pricing math. */
  keepTier?: CmaCompKeepTier | null
  /** Display-only judge reason. Does not change pricing math. */
  keepReason?: string | null
}

export interface CmaMarketTrendPoint {
  periodStart: string
  medianSalePrice: number | null
  soldCount: number | null
  /**
   * Null on builds since 2026-10-08: the month line reads Market Truth, which
   * has no monthly inventory cell. Rows built before carry the cache's
   * polygon-clipped figure, which no renderer prints.
   */
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
  /**
   * The closes in the 180 days `monthsOfSupply` divides by (Market Truth
   * `sample_n`), so activeCount / (closedSixMonths / 6) = monthsOfSupply.
   * Null when the figure is withheld or the row predates 2026-10-08.
   */
  closedSixMonths?: number | null
  /** Which formula/source produced monthsOfSupply (canonical pulse vs 365d fallback). */
  mosFormula: string | null
  marketVerdict: 'seller' | 'balanced' | 'buyer' | null
  methodologyVersion: string | null
  computedAt: string | null
  pulseUpdatedAt: string | null
  /**
   * Completed months only, from the same Market Truth detached membership as
   * activeCount and monthsOfSupply (2026-10-08; earlier rows carry
   * market_stats_cache monthly). A chart renders only when six priced months
   * exist.
   */
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

/**
 * THE HOUSE NEXT DOOR IS THE EVIDENCE (Matt 2026-09-10).
 *
 * 23 Benaiah recommended $653,000 while 31 Benaiah — the identical 2,080 sqft
 * plan on the same street, an arm's-length sale that closed above its last ask
 * — had sold at $512,000, and the six sales carrying the number were 1,776 to
 * 2,195 sqft homes in other plats at $305 to $349 a square foot against the
 * twin's $246. Matt: the twin anchors the number, and the other sales bracket
 * it rather than set it.
 */
export interface CmaPricingStreetAnchor {
  /** The same-street sale or sales the number is held to (or, when `setAside`, would have been). */
  addresses: string[]
  /** Their listing keys, when the pricer wrote them. */
  listingKeys?: string[]
  /**
   * TRIM NORMALLY (Matt 2026-10-08, 915 Saginaw). True when every same-street
   * sale was an end of the adjusted sales and the range rule set it aside
   * like any end sale. It then does not cap the price and does not set the
   * floor: `before` and `after` are the same number and `ceiling` is only
   * what the cap would have been. Absent on rows built before this ruling.
   */
  setAside?: boolean
  /**
   * True when the anchor held the recommendation to `ceiling` when it was
   * applied. False on a set-aside record. Absent on rows built before
   * 2026-10-08, where every stored anchor was one that capped.
   */
  capped?: boolean
  /** Median adjusted price of those sales — the anchor itself. */
  anchor: number
  /** The most the recommendation may sit above the anchor. */
  ceiling: number
  /**
   * The comp-supported FLOOR once the anchor binds: the anchor itself. Without
   * it the recommendation lands on the old floor and a seller reads the number
   * as the bottom of its own range, which is the complaint Matt raised on 655
   * 12th. The twin is the low, the wider set is the high, and the number sits
   * between them near the twin because the twin is the better evidence.
   */
  floor: number
  /** What the three methods supported before the anchor bound them. */
  before: number
  /**
   * The recommendation after the anchor: `ceiling` when it capped, `before`
   * when it was set aside. Read when the anchor was applied in the pricer; a
   * later failed-ask pass in the build can still move the printed price.
   */
  after: number
  /** One sentence, for the document and the review page. */
  sentence: string
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
export type CmaPricingHold = {
  /**
   * 'ask-in-band': rule 22, the last failed ask inside the printed band.
   * 'ask-below-band': the failed-ask ceiling pulled the recommendation under
   * every sale that set it (rule 20 says that is not a price); Matt has not
   * decided how to treat these homes, so the document waits for him.
   */
  kind: 'ask-in-band' | 'ask-below-band'
  ask: number
  bandLow: number
  bandHigh: number
  /** The recommendation the hold is about. Written on 'ask-below-band'. */
  recommended?: number
  /** The sentence Matt reads in the queue. No em dash. */
  reason: string
}

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
   * True when the last failed ask sat below the hero band (`valueLow` /
   * `valueHigh`). The failed-ask haircut is skipped and the recommendation
   * is pinned to the band low. The letter explains that price was not what
   * held the listing back.
   */
  failedAskBelowRange?: boolean
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
   * Set when a sale on the subject's own street, of the subject's own size,
   * held the recommendation down (Matt 2026-09-10). Separate from `clamp`
   * because the failed-ask ceiling is a different thing and both can bind.
   */
  streetAnchor?: CmaPricingStreetAnchor | null
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
   * lowest adjusted price, once there are five of them (Matt 2026-10-07: the
   * band is always the trimmed range). They are printed as evidence and carry
   * NONE of the range: not an end of `valueLow`..`valueHigh`, and the grid
   * marks them with their reason and no weight row.
   */
  setAside?: CmaSetAsideSale[] | null
  /**
   * Why a broker has to look before this is sent, in seller-safe language, and
   * what the adversarial audit said. Present on every build; `needsReview` is
   * false and `reasons` empty on a clean one.
   */
  review?: CmaPricingReview | null
  /**
   * The build's own hold for Matt (SKILL.md rule 22, Matt 2026-10-07): the
   * subject's last failed ask sits inside the trimmed band the recommendation
   * reads from. The build completes and the document persists; nothing sends
   * (lib/cma/gap-hold.ts reads it at every send gate).
   */
  hold?: CmaPricingHold | null
  /**
   * True when the build measured the last failed ask against the printed band
   * for rule 22 (a failed last cycle, an ask, and a band), whatever it found.
   * False or absent when there was nothing to measure; the send gates then run
   * the live backstop on the row's own ask and band (lib/cma/gap-hold.ts).
   */
  askInBandMeasured?: boolean
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
  /**
   * RULE 27 (Matt 2026-10-08, "$716,000, the likely sale"). Present when the
   * subject is on the market and `recommended` carries the opinion of value:
   * the sale the weighted sales point to, read off the printed grid
   * (lib/cma/on-market-opinion.ts). The §0 trace for the cover figure, and the
   * list figure it replaced, for the admin view.
   */
  onMarketOpinion?: CmaOnMarketOpinion | null
}

export interface CmaOnMarketOpinion {
  /** The cover figure: the weighted sale to the nearest thousand, inside the printed band. */
  value: number
  /** The stored weighted sale it was rounded from, whole dollars. */
  weightedPrice: number
  /** The render_args field `weightedPrice` was read from. */
  field: 'pricing.predictedClose' | 'pricing.reconciliation.weightedPrice'
  /** How many sales carry weight in it. */
  sales: number | null
  /** The list recommendation the opinion replaced. Admin trace; never printed. */
  listRecommended: number
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
