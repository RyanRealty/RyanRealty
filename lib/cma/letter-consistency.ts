/**
 * Letter-consistency contract checks that run on the rendered HTML and the
 * pricing the letter prints. Gates, not prose: a hard fail refuses the letter.
 */

import { countedAddressesMissingFromDocument } from '@/lib/cma/counted-rows'
import { letterLinkTrackingCheck, type LetterLinkIdentity } from '@/lib/cma/letter-link-contract'
import { letterOwnerNameCheck, type LetterNameSource } from '@/lib/cma/letter-privacy'
import { letterProductNoun } from '@/lib/cma/market-area'
import { int } from '@/lib/cma/render-blocks'
import { namedSalesPlace } from '@/lib/pricing/comp-area'
import { printedAdjustedPrice, settingWeight } from '@/lib/pricing/seller-net'
import { readSetAsideSales, setAsideMatcher } from '@/lib/cma/set-aside'
import {
  ASK_BELOW_BAND_KIND,
  failedAskPutRecommendationUnderBand,
  recommendationUnderPrintedBand,
} from '@/lib/cma/gap-hold'
import type { CmaPricing } from '@/lib/cma/types'
import type { ContractCheck } from '@/lib/cma/contract'
import { pocketLocalReadOf, readListingMarketMove } from '@/lib/cma/listing-window-market'
import { isPocketTimeBasis } from '@/lib/pricing/exclusive-pocket-date-adj'

/**
 * The sales caption as a bare ring: "Within one mile of your home." That is
 * the sentence areaSentence in lib/pricing/comp-area.ts writes for a radius
 * area. The competition and did-not-sell chapters no longer widen past a
 * short plat (Matt 2026-10-07 reversed the 2026-10-06 permission, rule 24):
 * inside a named sales place neither chapter may print a ring sentence of
 * its own, and a sales caption may still name its plats and then the ring
 * that found one ("Deschutes, and Park Addition within one mile of your
 * home."). cma-61433-linton (2026-10-05) and cma-711-georgia (2026-10-07)
 * are why the bare-ring check exists.
 */
const MILES = '(?:[\\d.]+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)'
const BARE_RING_CAPTION = new RegExp(`(?:^|>|[.!?]\\s)Within\\s+${MILES}\\s+miles?\\s+of your home\\.`)
/**
 * A competition or did-not-sell sentence that counts homes inside a mile
 * ring: "6 homes are for sale within one mile of your home between ...",
 * "... within one mile of your home came off the market ...". Inside a named
 * sales place that sentence cannot be written (rule 24); this is the
 * mechanical gate that keeps the widening from coming back by prose.
 */
const CHAPTER_RING_SENTENCE = new RegExp(
  `(?:for sale|under contract)[^<.]{0,120}?\\bwithin ${MILES} miles? of your home\\b|\\bwithin ${MILES} miles? of your home came off the market`,
  'i',
)
const WRONG_PRODUCT_LINE = /single-family homes in|single-family sales|single-family listings/i
const SIZE_STORY_DO_NOT_ADJUST = 'Size and story class do not adjust'
const ADJUSTED_FOR_DATE_AND_SIZE = 'adjusted for date and size'

/**
 * A pocket letter that says size and story do not adjust cannot also say
 * the sales were adjusted for date and size. Runs with or without a place.
 */
export function letterAdjustmentClaimCheck(html: string): ContractCheck {
  const both = html.includes(SIZE_STORY_DO_NOT_ADJUST) && html.includes(ADJUSTED_FOR_DATE_AND_SIZE)
  return {
    id: 'adjustment-claim-matches-lines',
    severity: 'hard',
    pass: !both,
    detail: both
      ? 'The letter says size and story do not adjust and also says the sales were adjusted for date and size.'
      : 'The letter does not claim a date-and-size adjustment the lines say did not happen.',
  }
}

export type LetterPlaceSource = {
  compArea?: { kind?: string | null; sentence?: string | null } | null
  propertySubType?: string | null
  listingMarket?: { place?: string | null; productNoun?: string | null } | null
  /** Ask-outcome group counts. A named place does not print these as "N listings". */
  citywideListingCounts?: readonly number[] | null
}

/**
 * The page the seller reads. A mile ring, a citywide count, or a
 * single-family line on a townhouse letter fails the save.
 */
export function letterPlaceChecks(html: string, place: LetterPlaceSource | null | undefined): ContractCheck[] {
  if (!place) return []
  const checks: ContractCheck[] = []
  const named = namedSalesPlace(place.compArea)
  if (named) {
    const mile = BARE_RING_CAPTION.test(html)
    checks.push({
      id: 'sales-place-not-a-mile-ring',
      severity: 'hard',
      pass: !mile,
      detail: mile
        ? 'The sales sit in a named place and the letter still says they are within a mile ring.'
        : 'The letter does not widen a named place out to a mile ring.',
    })
    const chapterRing = CHAPTER_RING_SENTENCE.test(html)
    checks.push({
      id: 'competition-not-a-mile-ring',
      severity: 'hard',
      pass: !chapterRing,
      detail: chapterRing
        ? 'The sales sit in a named place and a chapter still counts homes within a mile ring.'
        : 'The competition and did-not-sell chapters stay inside the named sales place.',
    })
    const sentence = place.compArea?.sentence?.trim() ?? ''
    if (sentence) {
      const shown = html.includes(sentence)
      checks.push({
        id: 'sales-place-sentence',
        severity: 'hard',
        pass: shown,
        detail: shown
          ? 'The letter names the place the sales sit in.'
          : `The letter is missing the sales place: ${sentence}`,
      })
    }
    const leaked = (place.citywideListingCounts ?? []).filter((n) => n > 0 && html.includes(`${int(n)} listings`))
    checks.push({
      id: 'no-citywide-count',
      severity: 'hard',
      pass: leaked.length === 0,
      detail:
        leaked.length === 0
          ? 'The letter does not print a citywide listing count beside a named place.'
          : `Citywide count still on the page: ${leaked.map((n) => `${int(n)} listings`).join(', ')}.`,
    })
  }
  const noun = letterProductNoun(place.propertySubType)
  if (noun) {
    const wrong = WRONG_PRODUCT_LINE.test(html)
    checks.push({
      id: 'chart-matches-product',
      severity: 'hard',
      pass: !wrong,
      detail: wrong
        ? `This home is a ${noun} and the letter still charts single-family homes.`
        : `The letter does not chart single-family homes for a ${noun}.`,
    })
  }
  const marketPlace = place.listingMarket?.place?.trim() ?? ''
  if (marketPlace) {
    const shown = html.includes(marketPlace)
    checks.push({
      id: 'listing-chart-place',
      severity: 'hard',
      pass: shown,
      detail: shown
        ? `The listing chart names ${marketPlace}.`
        : `The listing chart is missing ${marketPlace}.`,
    })
  }
  const productNoun = place.listingMarket?.productNoun?.trim() ?? ''
  if (productNoun) {
    const shown = html.toLowerCase().includes(productNoun.toLowerCase())
    checks.push({
      id: 'listing-chart-product',
      severity: 'hard',
      pass: shown,
      detail: shown
        ? `The listing chart names the ${productNoun}.`
        : `The listing chart does not name the ${productNoun}.`,
    })
  }
  return checks
}

function money(n: unknown): number | null {
  const v = typeof n === 'number' ? n : Number(n)
  return Number.isFinite(v) && v > 0 ? v : null
}

function usdForms(n: number): string[] {
  const exact = Math.round(n)
  const r1k = Math.round(n / 1000) * 1000
  const forms = [
    `$${exact.toLocaleString('en-US')}`,
    `$${exact}`,
    `$${Math.round(exact / 1000)}k`,
    `$${Math.round(exact / 1000)}K`,
  ]
  if (r1k !== exact) forms.push(`$${r1k.toLocaleString('en-US')}`, `$${r1k}`)
  return [...new Set(forms)]
}

const LIST_REC_FRAME =
  /(?:recommend(?:ed|ing)?(?: listing)?(?: at)?|list(?:ing)? at|would support listing at|do not recommend going above)\s+\$[\d,]+/gi

/** Whole-home list prices in this market are five figures and up. $/sf is not. */
const WHOLE_HOME_MIN_USD = 10_000

/** Suffix after the first dollar: a per-foot unit, or a range that ends in one. */
const PER_FOOT_AFTER =
  /^(?:\s+to\s+\$[\d,]+)?\s*(?:a foot|\/sf|per sq\.?\s*ft|per square foot)\b/i

export function highEndAtOrBelowBandCheck(pricing: {
  highEnd?: number | null
  valueLow?: number | null
  valueHigh?: number | null
}): ContractCheck {
  const highEnd = money(pricing.highEnd)
  const low = money(pricing.valueLow)
  const high = money(pricing.valueHigh)
  const bandHigh = low != null && high != null ? Math.max(low, high) : high
  const pass = highEnd == null || bandHigh == null || highEnd <= bandHigh
  return {
    id: 'high-end-at-or-below-band',
    severity: 'hard',
    pass,
    detail: pass
      ? highEnd != null && bandHigh != null
        ? `High end $${highEnd.toLocaleString('en-US')} sits at or below the band top $${bandHigh.toLocaleString('en-US')}.`
        : 'High end or band top is not printed.'
      : `High end $${highEnd!.toLocaleString('en-US')} sits above the band top $${bandHigh!.toLocaleString('en-US')}.`,
  }
}

/**
 * A list above every sale that set the price is not a price. A list the
 * failed ask already pulled under the band stays, and the letter says so.
 */
export function recommendedAtOrBelowBandCheck(pricing: {
  recommended?: number | null
  valueLow?: number | null
  valueHigh?: number | null
}): ContractCheck {
  const rec = money(pricing.recommended)
  const low = money(pricing.valueLow)
  const high = money(pricing.valueHigh)
  const bandHigh = low != null && high != null ? Math.max(low, high) : high
  const pass = rec == null || bandHigh == null || rec <= bandHigh
  return {
    id: 'recommended-at-or-below-band',
    severity: 'hard',
    pass,
    detail: pass
      ? rec != null && bandHigh != null
        ? `Recommended list $${rec.toLocaleString('en-US')} sits at or below the highest sale that set the price, $${bandHigh.toLocaleString('en-US')}.`
        : 'Recommended list or band top is not printed.'
      : `Recommended list $${rec!.toLocaleString('en-US')} sits above the highest sale that set the price, $${bandHigh!.toLocaleString('en-US')}.`,
  }
}

/**
 * A list under the printed band low is not a price either (rule 20; review,
 * 2026-10-07: 120 Benaiah printed $550,000 under a $600,000 to $660,000 band).
 * The one recommendation that may sit there is one the failed-ask ceiling put
 * there on a document the build holds for Matt (lib/cma/gap-hold.ts
 * applyAskBelowBandHold); that letter never sends. Measured on the band the
 * reader sees (printedBandBounds), so a rec on the printed low passes.
 */
export function recommendedAtOrAboveBandLowCheck(pricing: {
  recommended?: number | null
  valueLow?: number | null
  valueHigh?: number | null
  hold?: { kind?: string | null } | null
  clamp?: CmaPricing['clamp']
  priceOverride?: number | null
}): ContractCheck {
  const rec = money(pricing.recommended)
  const under = recommendationUnderPrintedBand(pricing)
  const held =
    under != null &&
    (pricing.hold?.kind === ASK_BELOW_BAND_KIND ||
      (pricing.hold != null && failedAskPutRecommendationUnderBand(pricing)))
  // A broker override is a person choosing the number (rule 26).
  const override = pricing.priceOverride != null && pricing.priceOverride > 0
  const pass = under == null || held || override
  return {
    id: 'recommended-at-or-above-band-low',
    severity: 'hard',
    pass,
    detail:
      under == null
        ? rec != null
          ? `Recommended list $${rec.toLocaleString('en-US')} sits at or above the printed band low.`
          : 'Recommended list or band is not printed.'
        : override
          ? `Recommended list $${rec!.toLocaleString('en-US')} sits under the printed band low $${under.low.toLocaleString('en-US')} as a broker override.`
          : held
          ? `Recommended list $${rec!.toLocaleString('en-US')} sits under the printed band low $${under.low.toLocaleString('en-US')} because the failed ask pulled it there, and the document is held for Matt.`
          : `Recommended list $${rec!.toLocaleString('en-US')} sits under the printed band low $${under.low.toLocaleString('en-US')}, and no held failed-ask ceiling explains it.`,
  }
}

export function letterRecommendDollarsCheck(
  html: string,
  pricing: { recommended?: number | null; valueLow?: number | null; valueHigh?: number | null },
): ContractCheck {
  const rec = money(pricing.recommended)
  const low = money(pricing.valueLow)
  const high = money(pricing.valueHigh)
  const bandLow = low != null && high != null ? Math.min(low, high) : null
  const bandHigh = low != null && high != null ? Math.max(low, high) : null
  if (rec == null) {
    return {
      id: 'letter-one-recommend-price',
      severity: 'hard',
      pass: true,
      detail: 'No recommended list to grade.',
    }
  }
  const recForms = new Set(usdForms(rec).map((s) => s.toLowerCase()))
  const bad: string[] = []
  const frameRe = new RegExp(LIST_REC_FRAME.source, 'gi')
  let m: RegExpExecArray | null
  while ((m = frameRe.exec(html))) {
    const frame = m[0]
    const after = html.slice(m.index + frame.length)
    if (PER_FOOT_AFTER.test(after)) continue
    const dollar = frame.match(/\$[\d,]+/)?.[0]
    if (!dollar) continue
    const n = Number(dollar.replace(/[$,]/g, ''))
    if (!Number.isFinite(n) || n <= 0 || n < WHOLE_HOME_MIN_USD) continue
    const framedAsRec = /recommend|listing at|list at/i.test(frame)
    const framedAsRangeCap = /going above/i.test(frame)
    if (!framedAsRec && !framedAsRangeCap) continue
    const isRec = recForms.has(dollar.toLowerCase()) || Math.round(n / 1000) * 1000 === Math.round(rec / 1000) * 1000
    const inBand = bandLow != null && bandHigh != null && n >= bandLow && n <= bandHigh
    if (framedAsRangeCap && inBand) continue
    if (!isRec && !(framedAsRangeCap && inBand)) bad.push(frame.trim())
  }
  return {
    id: 'letter-one-recommend-price',
    severity: 'hard',
    pass: bad.length === 0,
    detail:
      bad.length === 0
        ? `Every list-recommendation dollar equals the rec $${rec.toLocaleString('en-US')} or sits inside the band as a range.`
        : `List-recommendation dollars that are not the rec and not inside the band: ${bad.join(' · ')}`,
  }
}

/**
 * The hero band must overlap the closed comps. A band that sits entirely
 * under every sale, or entirely over every sale, is not support (Marys Grace:
 * band $531k-$577k under comps at $610k-$665k).
 *
 * With the sales that set the price, the band is exactly their adjusted
 * range, less the highest and lowest the trimmed band set aside (Matt
 * 2026-10-07: the printed band is always the trimmed range). The set-aside
 * rows are read the same way pinPrintedBandToSettingSales reads them, so the
 * pin and this check can never disagree about which sales the band spans.
 */
export function bandVersusClosedCompsCheck(
  pricing: { valueLow?: number | null; valueHigh?: number | null; setAside?: unknown; rangeRule?: unknown },
  comps: readonly {
    listingKey?: string | null
    address?: string | null
    adjustedPrice?: number | null
    closePrice?: number | null
    weight?: number | null
    printedWeight?: number | null
    timeAdjustment?: number | null
    sizeAdjustment?: number | null
    storyAdjustment?: number | null
    concessionsAmount?: number | null
    concessionsYn?: string | null
  }[] | null | undefined,
): ContractCheck {
  const low = money(pricing.valueLow)
  const high = money(pricing.valueHigh)
  const bandLow = low != null && high != null ? Math.min(low, high) : null
  const bandHigh = low != null && high != null ? Math.max(low, high) : null
  const rows = comps ?? []
  const weighted = rows.filter((c) => settingWeight(c) != null)
  const setters = weighted.filter((c) => (settingWeight(c) ?? 0) > 0)
  if (setters.length >= 3 && weighted.some((c) => (settingWeight(c) ?? 0) === 0)) {
    return {
      id: 'band-overlaps-closed-comps',
      severity: 'hard',
      pass: false,
      detail: 'A sale that does not set the price is still in the table.',
    }
  }
  // The pin's own matcher: by listing key, never by a unit-less address.
  const isAside = setAsideMatcher(pricing as unknown as CmaPricing)
  const asideCount = readSetAsideSales(pricing as unknown as CmaPricing).length
  const asideWords =
    asideCount >= 2 ? ', the highest and lowest set aside' : asideCount === 1 ? ', one sale set aside' : ''
  const bandSetters = setters.filter((c) => !isAside(c))
  if (bandSetters.length > 0) {
    const ends = bandSetters
      .map((c) =>
        printedAdjustedPrice({
          closePrice: c.closePrice ?? 0,
          adjustedPrice: c.adjustedPrice,
          timeAdjustment: c.timeAdjustment,
          sizeAdjustment: c.sizeAdjustment,
          storyAdjustment: c.storyAdjustment,
          concessionsAmount: c.concessionsAmount,
          concessionsYn: c.concessionsYn,
        }),
      )
      .filter((n) => Number.isFinite(n) && n > 0)
    if (ends.length > 0) {
      const min = Math.min(...ends)
      const max = Math.max(...ends)
      const pass =
        bandLow != null && bandHigh != null && Math.abs(bandLow - min) <= 1 && Math.abs(bandHigh - max) <= 1
      const band = `$${Math.round(bandLow ?? 0).toLocaleString('en-US')}-$${Math.round(bandHigh ?? 0).toLocaleString('en-US')}`
      const span = `$${Math.round(min).toLocaleString('en-US')}-$${Math.round(max).toLocaleString('en-US')}`
      return {
        id: 'band-overlaps-closed-comps',
        severity: 'hard',
        pass,
        detail: pass
          ? `Band ${band} is the adjusted sales that set the price ${span}${asideWords}.`
          : `Band ${band} is not the adjusted sales that set the price ${span}${asideWords}.`,
      }
    }
  }
  const prices = rows
    .map((c) => money(c.adjustedPrice) ?? money(c.closePrice))
    .filter((n): n is number => n != null)
  if (bandLow == null || bandHigh == null || prices.length === 0) {
    return {
      id: 'band-overlaps-closed-comps',
      severity: 'hard',
      pass: true,
      detail: 'No band or no closed comps to compare.',
    }
  }
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const entirelyBelow = bandHigh < min
  const entirelyAbove = bandLow > max
  const pass = !entirelyBelow && !entirelyAbove
  const band = `$${Math.round(bandLow).toLocaleString('en-US')}-$${Math.round(bandHigh).toLocaleString('en-US')}`
  const span = `$${Math.round(min).toLocaleString('en-US')}-$${Math.round(max).toLocaleString('en-US')}`
  return {
    id: 'band-overlaps-closed-comps',
    severity: 'hard',
    pass,
    detail: pass
      ? `Band ${band} overlaps the closed comps ${span}.`
      : entirelyBelow
        ? `Band ${band} sits entirely below every closed comp ${span}.`
        : `Band ${band} sits entirely above every closed comp ${span}.`,
  }
}


/**
 * Every sale and every expired listing the document counts has to be in the
 * document. A missing address fails the letter.
 */
export function countedRowsInDocumentCheck(args: {
  html: string
  sales?: readonly (string | null | undefined)[] | null
  expired?: readonly (string | null | undefined)[] | null
}): ContractCheck {
  const missing = countedAddressesMissingFromDocument(
    [...(args.sales ?? []), ...(args.expired ?? [])],
    args.html,
  )
  const pass = missing.length === 0
  return {
    id: 'counted-rows-in-table',
    severity: 'hard',
    pass,
    detail: pass
      ? 'Every counted sale and expired listing is in the document.'
      : `Counted but missing from the table: ${missing.join(', ')}.`,
  }
}

/**
 * DOWN ONLY IF LOCAL FELL (Matt 2026-10-08). A pocket letter priced with the
 * local gate (`timeAdjustment.localGate`) moves a sale down for date only
 * when its own local page prints a per-foot fall, or, with no per-foot trend,
 * when the gate recorded the home's own unsold listing (an on-market home whose
 * ask came down, Matt 2026-10-09). A letter that moved a sale
 * while that page prints held flat, rose or no trend, or whose page reads a
 * different verdict from the one the price was gated on, fails the save.
 * Rows priced before the gate carry no `localGate` and are not graded.
 */
export function pocketDateFollowsLocalReadCheck(args: {
  timeAdjustment?: { basis?: unknown; localGate?: unknown } | null
  comps?: readonly { timeAdjustment?: number | null }[] | null
  listingMarket?: unknown
}): ContractCheck {
  const id = 'pocket-date-follows-local-read'
  const ta = args.timeAdjustment
  const gate = ta?.localGate && typeof ta.localGate === 'object' ? (ta.localGate as { verdict?: unknown }) : null
  if (!ta || !isPocketTimeBasis(ta.basis) || !gate) {
    return { id, severity: 'hard', pass: true, detail: 'Not a pocket priced with the local gate.' }
  }
  const page = pocketLocalReadOf(readListingMarketMove(args.listingMarket))
  const gated = gate.verdict === 'fell' || gate.verdict === 'held flat' || gate.verdict === 'rose' ? gate.verdict : null
  if (page.verdict !== gated) {
    return {
      id,
      severity: 'hard',
      pass: false,
      detail: `The local page reads "${page.verdict ?? 'no trend'}" but the date move was gated on "${gated ?? 'no trend'}".`,
    }
  }
  const movedDown = (args.comps ?? []).filter((c) => (c.timeAdjustment ?? 0) <= -1).length
  // The home's own unsold listing stands in for a read too thin to judge
  // (Matt 2026-10-09): with no per-foot trend on the page, a gate that
  // recorded that listing may move sales down.
  const ownListing =
    page.verdict == null && gated == null && (gate as { ownListing?: unknown }).ownListing != null
  if (movedDown > 0 && ownListing) {
    return {
      id,
      severity: 'hard',
      pass: true,
      detail: "Sales moved down for date on the home's own unsold listing; the local page reads no trend.",
    }
  }
  if (movedDown > 0 && page.verdict !== 'fell') {
    return {
      id,
      severity: 'hard',
      pass: false,
      detail: `${movedDown} sale(s) moved down for date while the local page reads "${page.verdict ?? 'no trend'}".`,
    }
  }
  return {
    id,
    severity: 'hard',
    pass: true,
    detail: movedDown > 0 ? 'Sales moved down for date and the local page reads a fall.' : 'No sale moved down for date.',
  }
}

export function evaluateLetterConsistencyContract(args: {
  html: string
  names: LetterNameSource | null | undefined
  identity: LetterLinkIdentity | null | undefined
  pricing: {
    recommended?: number | null
    highEnd?: number | null
    valueLow?: number | null
    valueHigh?: number | null
    hold?: { kind?: string | null } | null
    clamp?: CmaPricing['clamp']
    priceOverride?: number | null
  }
  closedComps?: readonly { adjustedPrice?: number | null; closePrice?: number | null; address?: string | null }[] | null
  /** Expired listings the letter counted. Each address has to be in the table. */
  expiredAddresses?: readonly (string | null | undefined)[] | null
  /** The addresses the letter prints (printedAddressesOf). Lets the owner-name check tell a street from a name. */
  printedAddresses?: readonly (string | null | undefined)[] | null
  /** The place names the letter prints from its data (printedPlacesOf). Lets the owner-name check tell a place from a name. */
  printedPlaces?: readonly (string | null | undefined)[] | null
  /** Where the sales sit, and the chart. Absent on older callers, which skip these checks. */
  place?: LetterPlaceSource | null
  /** The pocket's date gate against the local page (Matt 2026-10-08). Absent on older callers. */
  pocketDate?: Parameters<typeof pocketDateFollowsLocalReadCheck>[0] | null
}): { pass: boolean; checks: ContractCheck[] } {
  const checks: ContractCheck[] = [
    letterOwnerNameCheck(args.html, args.names, {
      printedAddresses: args.printedAddresses,
      printedPlaces: args.printedPlaces,
    }),
    letterLinkTrackingCheck(args.html, args.identity),
    highEndAtOrBelowBandCheck(args.pricing),
    recommendedAtOrBelowBandCheck(args.pricing),
    recommendedAtOrAboveBandLowCheck(args.pricing),
    letterRecommendDollarsCheck(args.html, args.pricing),
    bandVersusClosedCompsCheck(args.pricing, args.closedComps),
    countedRowsInDocumentCheck({
      html: args.html,
      sales: (args.closedComps ?? []).map((c) => c.address),
      expired: args.expiredAddresses,
    }),
    letterAdjustmentClaimCheck(args.html),
    ...letterPlaceChecks(args.html, args.place),
    ...(args.pocketDate ? [pocketDateFollowsLocalReadCheck(args.pocketDate)] : []),
  ]
  return { pass: checks.every((c) => c.pass), checks }
}
