/**
 * Crawlable copy on /buy/leverage (SEO & AEO Desk brief 2026-10-13, BUY-1).
 * Every figure is interpolated from leftover HUD / public pace / price-drop
 * helpers. Writing Bot swaps LEVERAGE_COPY in one edit.
 *
 * Wording lock: say "buyers have leverage". Do not write "buyer's market"
 * or "buyers market" anywhere on this page, including FAQ questions.
 */
import { MOS_SELLER_MAX } from '@/lib/market/classify'
import { LEVERAGE_H1, LEVERAGE_LINKS, LEVERAGE_TITLE } from './leverage-constants'
import type { LeverageAreaRow, LeverageSnapshot } from './leverage-types'

export type LeverageFaq = {
  question: string
  answer: string
  related?: { label: string; href: string }
}

export type LeverageCopy = {
  title: string
  h1: string
  eyebrow: string
  metaDescription: string
  answer: string[]
  weekLine: string | null
  qualifier: string | null
  paceLine: string | null
  methodLine: string
  regionLine: string | null
  areaCaption: string
  faqs: LeverageFaq[]
  reportHeading: string
  reportSubhead: string
  reportButton: string
  reportSuccessTitle: string
  reportSuccessBody: string
  consultHeading: string
  consultSubhead: string
  consultButton: string
  consultSuccessTitle: string
  consultSuccessBody: string
  questionsHeading: string
  townsHeading: string
  sourcesHeading: string
  nextHeading: string
  formNameLabel: string
  formEmailLabel: string
  formPhoneLabel: string
  formPhoneHint: string
  formMessageLabel: string
  firmLine: string
}

/**
 * All user-visible copy for /buy/leverage. Live numbers are filled in
 * leverageCopy(); swap this object when Writing Bot copy lands.
 */
export const LEVERAGE_COPY = {
  title: LEVERAGE_TITLE,
  h1: LEVERAGE_H1,
  eyebrow: 'Bend and Central Oregon · live MLS numbers',
  fallbackMeta:
    'Buyers have leverage in Bend again on price cuts and first asks. Live MLS numbers for Bend and Central Oregon, updated daily.',
  metaLive:
    'Buyers have leverage in Bend again: {cut} of homes sold after a price cut and closed at {ask} of first ask. Live MLS numbers, updated daily.',
  mosWindow:
    'Months of supply is active listings divided by average monthly closings over the last 6 months.',
  methodPulseNote:
    'Pulse active counts and unpublished pulse months of supply stay off this page.',
  answerYesOnPrice:
    'Yes, on price.{asOf} {cut} of Bend homes that sold in the last 12 months took a price cut first, the median cut was {medianCut}, and homes closed at {ask} of their first asking price.',
  answerYesOnPriceNoMedian:
    'Yes, on price.{asOf} {cut} of Bend homes that sold in the last 12 months took a price cut first, and homes closed at {ask} of their first asking price.',
  answerYesOnPriceFallback:
    'Yes, on price.{asOf} Buyers have leverage in Bend on price cuts and first asks. The live share and sale-to-list figures are on the Bend housing market page when they publish.',
  qualifierUnderFour:
    'Bend still has {mos} months of supply, under the 4-month line, so it is not oversupplied. The leverage is in pricing, not in inventory.',
  paceBoth: 'Homes are taking a median {days90} days to an offer over the last 90 days, vs {days12} over 12 months.',
  pace90: 'Homes are taking a median {days90} days to an offer over the last 90 days.',
  weekWithMedian:
    '{count} Bend homes cut their asking price in the last 7 days. Median drop {median}{asOf}.',
  weekCountOnly: '{count} Bend homes cut their asking price in the last 7 days{asOf}.',
  regionLine:
    'Central Oregon overall is {mos} months of supply, with {cut} of sales after a cut{days}.',
  regionDays: ' and {days} days to an offer over the last 90 days',
  areaCaption:
    'Months of supply, share of sales after a price cut (12 months), and days to an offer (last 90 days). {method}',
  townsHeading: 'Leverage by town',
  questionsHeading: 'Questions',
  sourcesHeading: 'Sources',
  nextHeading: 'Next step',
  reportHeading: 'Get my weekly deal report',
  reportSubhead:
    'Email is required. Phone is optional. A broker follows up with Bend and Central Oregon homes that cut price. This is not an automated newsletter.',
  reportButton: 'Send me deal notes',
  reportSuccessTitle: 'Request received',
  reportSuccessBody: 'A Ryan Realty broker will follow up. This does not enroll you in an automated weekly email.',
  consultHeading: 'Talk to a buyer agent',
  consultSubhead: 'Ask about a town, a price band, or a home that has sat. A broker replies.',
  consultButton: 'Request a consult',
  consultSuccessTitle: 'Request received',
  consultSuccessBody: 'A Ryan Realty broker will follow up.',
  formNameLabel: 'Name',
  formEmailLabel: 'Email',
  formPhoneLabel: 'Phone (optional)',
  formPhoneHint: 'Optional. We use it to follow up on this request.',
  formMessageLabel: 'What do you want to know',
  firmLine: 'Matt Ryan founded Ryan Realty in 2014 and opened the Bend office in June 2023.',
  bookDoor: 'Or pick a time',
  again: 'Send another request',
  faq1Question: 'Do buyers have the upper hand in Bend right now?',
  faq1YesUnderFour:
    'Yes, on price.{asOf} {cut} sold after a cut and closed at {ask} of first ask. Bend still has {mos} months of supply, under the 4-month line, so the upper hand is in pricing, not in inventory.',
  faq1YesOnPrice: 'Yes, on price.{asOf} {cut} sold after a cut and closed at {ask} of first ask.',
  faq1Fallback:
    'Yes, on price. Buyers have leverage in Bend on price cuts and first asks. See the Bend housing market page for the live months of supply.',
  faq2Question: 'How much below asking do Bend homes sell?',
  faq2Both:
    'Median {ask} of first ask, {final} of final list (last 12 months{asOf}). The gap is mostly price cuts before the offer.',
  faq2Ask: 'Median {ask} of first ask (last 12 months{asOf}). The gap is mostly price cuts before the offer.',
  faq2Fallback:
    'The Bend city page prints sale price against the first asking price, last 12 months, when that cell publishes.',
  faq3Question: 'Can I ask for seller credits in Bend?',
  faq3Answer:
    'Yes, it is common to ask. Our dated article on Bend tilting toward buyers has the concession figures from closed MLS data. We do not reprint a concession percent here because that article is dated.',
  faq4Question: 'Which Central Oregon towns give buyers the most room?',
  faq4Fallback:
    'Prineville and Sunriver have been the more open towns when months of supply publishes above 4. Sisters is mixed when well-priced homes still go fast. Redmond sits near the 4-month line, so do not run a leverage-in-Redmond claim.',
  faq4SistersMixedFast: ' Sisters is mixed when well-priced homes still go fast.',
  faq4SistersMixedDays: ' Sisters is mixed ({days} days to an offer over the last 90 days).',
  faq4Redmond: ' Redmond {mos} months, little leverage.',
  faq5Question: 'Which homes give the most room?',
  faq5WithDays:
    'Homes listed longer than the typical {days} days to an offer, and homes that already took a cut. See this week\'s Bend price drops.',
  faq5Fallback: 'Homes that have sat, and homes that already took a cut. See this week\'s Bend price drops.',
  faq6Question: 'How often are these numbers updated?',
  faq6Answer:
    'Daily from the MLS. Each figure names its window and as-of date. The method page explains months of supply and sale-to-list.',
  relatedBendMarket: 'Bend housing market',
  relatedBendCity: 'Bend city page',
  relatedShift: 'Bend tilting toward buyers (dated article)',
  relatedDrops: 'Bend price drops this week',
  relatedMethod: 'How we get our numbers',
  nextBendMarket: 'Bend housing market',
  nextDrops: 'Bend price drops this week',
  nextMos: 'Months of supply',
  nextMethod: 'How we get our numbers',
  nextAlerts: 'Listing alerts',
  nextBook: 'Book a broker',
  nextGoodTime: 'Is now a good time to buy in Bend',
  nextClosingCosts: 'Closing costs for Bend buyers',
  nextMortgage: 'Mortgage calculator',
  noteLaPineUnpublished: 'Cuts and days support room to negotiate. Months of supply is not published here.',
  noteBendUnderFour: 'Leverage is on price cuts and first asks, not on inventory.',
  noteBendReadMos: 'Read the live months of supply beside the price-cut share.',
  noteRedmondLittle: 'Little leverage. Room to negotiate on homes that have sat.',
  noteRedmondSat: 'Room to negotiate on homes that have sat.',
  noteSistersMixedFast: 'Mixed. Supply is open, and well-priced homes still go fast.',
  noteSistersOpen: 'More room on homes that have sat.',
  noteSistersSat: 'Claim leverage only on homes that have sat.',
  noteOpen: 'These numbers support leverage on price and terms.',
  noteReadMos: 'Read the live months of supply beside the price-cut share.',
} as const

function fill(template: string, vars: Record<string, string>): string {
  return template.replace(/\{([a-z0-9]+)\}/gi, (_, key: string) => vars[key] ?? '')
}

export function displayedMosUnderFour(mos: number | null, mosLabel: string | null): boolean {
  if (mos == null || mosLabel == null) return false
  const shown = Number.parseFloat(mosLabel)
  return Number.isFinite(shown) && shown < MOS_SELLER_MAX
}

export function areaNote(input: {
  slug: string
  monthsSupply: number | null
  monthsSupplyLabel: string | null
  daysToOffer90: number | null
}): string {
  if (input.slug === 'la-pine' && (input.monthsSupply == null || input.monthsSupplyLabel == null)) {
    return LEVERAGE_COPY.noteLaPineUnpublished
  }
  if (input.slug === 'bend') {
    return displayedMosUnderFour(input.monthsSupply, input.monthsSupplyLabel)
      ? LEVERAGE_COPY.noteBendUnderFour
      : LEVERAGE_COPY.noteBendReadMos
  }
  if (input.slug === 'redmond') {
    if (input.monthsSupply != null && input.monthsSupply <= MOS_SELLER_MAX) {
      return LEVERAGE_COPY.noteRedmondLittle
    }
    return LEVERAGE_COPY.noteRedmondSat
  }
  if (input.slug === 'sisters') {
    const fastOffer = input.daysToOffer90 != null && input.daysToOffer90 <= 25
    if (input.monthsSupply != null && input.monthsSupply >= 6 && fastOffer) {
      return LEVERAGE_COPY.noteSistersMixedFast
    }
    if (input.monthsSupply != null && input.monthsSupply >= 6) {
      return LEVERAGE_COPY.noteSistersOpen
    }
    return LEVERAGE_COPY.noteSistersSat
  }
  if (input.monthsSupply != null && input.monthsSupply > MOS_SELLER_MAX) {
    return LEVERAGE_COPY.noteOpen
  }
  return LEVERAGE_COPY.noteReadMos
}

export function leverageMetaDescription(snap: LeverageSnapshot): string {
  const cut = snap.bend.priceCutShareLabel
  const ask = snap.bend.saleToFirstAskLabel
  if (cut && ask) {
    return fill(LEVERAGE_COPY.metaLive, { cut, ask })
  }
  return LEVERAGE_COPY.fallbackMeta
}

function asOfClause(asOf: string | null): string {
  return asOf ? ` As of ${asOf}.` : ''
}

export function leverageCopy(snap: LeverageSnapshot): LeverageCopy {
  const bend = snap.bend
  const asOf = bend.asOfLabel
  const underFour = displayedMosUnderFour(bend.monthsSupply, bend.monthsSupplyLabel)

  const answer: string[] = []
  if (bend.priceCutShareLabel && bend.medianPriceCutLabel && bend.saleToFirstAskLabel) {
    answer.push(
      fill(LEVERAGE_COPY.answerYesOnPrice, {
        asOf: asOfClause(asOf),
        cut: bend.priceCutShareLabel,
        medianCut: bend.medianPriceCutLabel,
        ask: bend.saleToFirstAskLabel,
      }),
    )
  } else if (bend.priceCutShareLabel && bend.saleToFirstAskLabel) {
    answer.push(
      fill(LEVERAGE_COPY.answerYesOnPriceNoMedian, {
        asOf: asOfClause(asOf),
        cut: bend.priceCutShareLabel,
        ask: bend.saleToFirstAskLabel,
      }),
    )
  } else {
    answer.push(fill(LEVERAGE_COPY.answerYesOnPriceFallback, { asOf: asOfClause(asOf) }))
  }

  const qualifier =
    underFour && bend.monthsSupplyLabel
      ? fill(LEVERAGE_COPY.qualifierUnderFour, { mos: bend.monthsSupplyLabel })
      : null

  const paceLine =
    bend.daysToOffer90 != null && bend.daysToOffer12mo != null
      ? fill(LEVERAGE_COPY.paceBoth, {
          days90: String(bend.daysToOffer90),
          days12: String(bend.daysToOffer12mo),
        })
      : bend.daysToOffer90 != null
        ? fill(LEVERAGE_COPY.pace90, { days90: String(bend.daysToOffer90) })
        : null

  const weekAsOf = snap.weekDrops?.asOfLabel ? `, as of ${snap.weekDrops.asOfLabel}` : ''
  const weekLine =
    snap.weekDrops && !snap.weekDrops.degraded && snap.weekDrops.count > 0
      ? snap.weekDrops.medianDropLabel
        ? fill(LEVERAGE_COPY.weekWithMedian, {
            count: snap.weekDrops.count.toLocaleString('en-US'),
            median: snap.weekDrops.medianDropLabel,
            asOf: weekAsOf,
          })
        : fill(LEVERAGE_COPY.weekCountOnly, {
            count: snap.weekDrops.count.toLocaleString('en-US'),
            asOf: weekAsOf,
          })
      : null

  const region = snap.region
  const regionLine =
    region.monthsSupplyLabel && region.priceCutShareLabel
      ? fill(LEVERAGE_COPY.regionLine, {
          mos: region.monthsSupplyLabel,
          cut: region.priceCutShareLabel,
          days:
            region.daysToOffer90 != null
              ? fill(LEVERAGE_COPY.regionDays, { days: String(region.daysToOffer90) })
              : '',
        })
      : null

  const faqs = leverageFaqs(snap)

  return {
    title: LEVERAGE_COPY.title,
    h1: LEVERAGE_COPY.h1,
    eyebrow: LEVERAGE_COPY.eyebrow,
    metaDescription: leverageMetaDescription(snap),
    answer,
    weekLine,
    qualifier,
    paceLine,
    methodLine: `${snap.methodLine} ${LEVERAGE_COPY.mosWindow} ${LEVERAGE_COPY.methodPulseNote}`,
    regionLine,
    areaCaption: fill(LEVERAGE_COPY.areaCaption, { method: snap.methodLine }),
    faqs,
    reportHeading: LEVERAGE_COPY.reportHeading,
    reportSubhead: LEVERAGE_COPY.reportSubhead,
    reportButton: LEVERAGE_COPY.reportButton,
    reportSuccessTitle: LEVERAGE_COPY.reportSuccessTitle,
    reportSuccessBody: LEVERAGE_COPY.reportSuccessBody,
    consultHeading: LEVERAGE_COPY.consultHeading,
    consultSubhead: LEVERAGE_COPY.consultSubhead,
    consultButton: LEVERAGE_COPY.consultButton,
    consultSuccessTitle: LEVERAGE_COPY.consultSuccessTitle,
    consultSuccessBody: LEVERAGE_COPY.consultSuccessBody,
    questionsHeading: LEVERAGE_COPY.questionsHeading,
    townsHeading: LEVERAGE_COPY.townsHeading,
    sourcesHeading: LEVERAGE_COPY.sourcesHeading,
    nextHeading: LEVERAGE_COPY.nextHeading,
    formNameLabel: LEVERAGE_COPY.formNameLabel,
    formEmailLabel: LEVERAGE_COPY.formEmailLabel,
    formPhoneLabel: LEVERAGE_COPY.formPhoneLabel,
    formPhoneHint: LEVERAGE_COPY.formPhoneHint,
    formMessageLabel: LEVERAGE_COPY.formMessageLabel,
    firmLine: LEVERAGE_COPY.firmLine,
  }
}

export function leverageFaqs(snap: LeverageSnapshot): LeverageFaq[] {
  const bend = snap.bend
  const asOf = bend.asOfLabel ? `, as of ${bend.asOfLabel}` : ''
  const asOfSentence = asOfClause(bend.asOfLabel)
  const underFour = displayedMosUnderFour(bend.monthsSupply, bend.monthsSupplyLabel)

  const q1Answer = (() => {
    if (underFour && bend.monthsSupplyLabel && bend.priceCutShareLabel && bend.saleToFirstAskLabel) {
      return fill(LEVERAGE_COPY.faq1YesUnderFour, {
        asOf: asOfSentence,
        cut: bend.priceCutShareLabel,
        ask: bend.saleToFirstAskLabel,
        mos: bend.monthsSupplyLabel,
      })
    }
    if (bend.priceCutShareLabel && bend.saleToFirstAskLabel) {
      return fill(LEVERAGE_COPY.faq1YesOnPrice, {
        asOf: asOfSentence || asOf,
        cut: bend.priceCutShareLabel,
        ask: bend.saleToFirstAskLabel,
      })
    }
    return LEVERAGE_COPY.faq1Fallback
  })()

  const q2Answer = (() => {
    if (bend.saleToFirstAskLabel && bend.saleToFinalListLabel) {
      return fill(LEVERAGE_COPY.faq2Both, {
        ask: bend.saleToFirstAskLabel,
        final: bend.saleToFinalListLabel,
        asOf,
      })
    }
    if (bend.saleToFirstAskLabel) {
      return fill(LEVERAGE_COPY.faq2Ask, { ask: bend.saleToFirstAskLabel, asOf })
    }
    return LEVERAGE_COPY.faq2Fallback
  })()

  const roomTowns = leverageRoomTownsLine(snap.areas)

  const homesRoom =
    bend.daysToOffer90 != null
      ? fill(LEVERAGE_COPY.faq5WithDays, { days: String(bend.daysToOffer90) })
      : LEVERAGE_COPY.faq5Fallback

  return [
    {
      question: LEVERAGE_COPY.faq1Question,
      answer: q1Answer,
      related: { label: LEVERAGE_COPY.relatedBendMarket, href: LEVERAGE_LINKS.bendMarket },
    },
    {
      question: LEVERAGE_COPY.faq2Question,
      answer: q2Answer,
      related: { label: LEVERAGE_COPY.relatedBendCity, href: LEVERAGE_LINKS.bendCity },
    },
    {
      question: LEVERAGE_COPY.faq3Question,
      answer: LEVERAGE_COPY.faq3Answer,
      related: { label: LEVERAGE_COPY.relatedShift, href: LEVERAGE_LINKS.shiftArticle },
    },
    {
      question: LEVERAGE_COPY.faq4Question,
      answer: roomTowns,
    },
    {
      question: LEVERAGE_COPY.faq5Question,
      answer: homesRoom,
      related: { label: LEVERAGE_COPY.relatedDrops, href: LEVERAGE_LINKS.bendDrops },
    },
    {
      question: LEVERAGE_COPY.faq6Question,
      answer: LEVERAGE_COPY.faq6Answer,
      related: { label: LEVERAGE_COPY.relatedMethod, href: LEVERAGE_LINKS.method },
    },
  ]
}

export function leverageRoomTownsLine(areas: readonly LeverageAreaRow[]): string {
  const prineville = areas.find((a) => a.slug === 'prineville')
  const sunriver = areas.find((a) => a.slug === 'sunriver')
  const sisters = areas.find((a) => a.slug === 'sisters')
  const redmond = areas.find((a) => a.slug === 'redmond')
  const parts: string[] = []
  if (prineville?.monthsSupplyLabel) {
    parts.push(`Prineville ${prineville.monthsSupplyLabel} months`)
  }
  if (sunriver?.monthsSupplyLabel) {
    parts.push(`Sunriver ${sunriver.monthsSupplyLabel} months`)
  }
  if (parts.length === 0) {
    return LEVERAGE_COPY.faq4Fallback
  }
  let line = `${parts.join(' and ')}.`
  if (sisters?.daysToOffer90 != null) {
    line += fill(LEVERAGE_COPY.faq4SistersMixedDays, { days: String(sisters.daysToOffer90) })
  } else {
    line += LEVERAGE_COPY.faq4SistersMixedFast
  }
  if (redmond?.monthsSupplyLabel) {
    line += fill(LEVERAGE_COPY.faq4Redmond, { mos: redmond.monthsSupplyLabel })
  }
  return line
}

export function leverageNextItems(): { label: string; href: string }[] {
  return [
    { label: LEVERAGE_COPY.nextBendMarket, href: LEVERAGE_LINKS.bendMarket },
    { label: LEVERAGE_COPY.nextDrops, href: LEVERAGE_LINKS.bendDrops },
    { label: LEVERAGE_COPY.nextMos, href: LEVERAGE_LINKS.monthsOfSupply },
    { label: LEVERAGE_COPY.nextMethod, href: LEVERAGE_LINKS.method },
    { label: LEVERAGE_COPY.nextGoodTime, href: LEVERAGE_LINKS.goodTime },
    { label: LEVERAGE_COPY.nextClosingCosts, href: LEVERAGE_LINKS.closingCosts },
    { label: LEVERAGE_COPY.nextMortgage, href: LEVERAGE_LINKS.mortgage },
    { label: LEVERAGE_COPY.nextAlerts, href: LEVERAGE_LINKS.alerts },
    { label: LEVERAGE_COPY.nextBook, href: LEVERAGE_LINKS.book },
  ]
}
