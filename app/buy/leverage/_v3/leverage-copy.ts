/**
 * Crawlable copy on /buy/leverage (Matt-approved Writing Bot copy, 2026-10-13).
 * Every figure is interpolated from public MOS / public pace / price-drop
 * helpers. Live numbers are filled in leverageCopy().
 *
 * Wording lock: say "buyers have leverage". Do not write "buyer's market"
 * or "buyers market" anywhere on this page, including FAQ questions.
 */
import { MOS_BALANCED_MAX, MOS_SELLER_MAX } from '@/lib/market/classify'
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
  weekHeading: string
  weekLinkLabel: string
  qualifier: string | null
  paceHeading: string
  paceLine: string | null
  saleToListLine: string | null
  paceLinkLabel: string
  methodLine: string
  regionLine: string | null
  regionLinkLabel: string
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
  colArea: string
  colMos: string
  colCut: string
  colDays: string
  colRead: string
  useHeading: string
  useStart: string | null
  usePayment: string
  usePaymentLink: string
  useClosingLink: string
  useStory: string
  useShiftLink: string
  useShiftNote: string
  useGoodTimeLink: string
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
 * leverageCopy().
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
  footerLine: 'Single-family homes, Oregon Data Share MLS, as of {asOf}. Windows as labeled.',
  footerLineNoAsOf: 'Single-family homes, Oregon Data Share MLS. Windows as labeled.',
  answerYesOnPrice:
    'Yes, on price. {asOf}{cut} of Bend homes that sold in the last 12 months took a price cut first. The median cut was {medianCut}, and homes closed at {ask} of their first asking price.',
  answerYesOnPriceNoMedian:
    'Yes, on price. {asOf}{cut} of Bend homes that sold in the last 12 months took a price cut first, and homes closed at {ask} of their first asking price.',
  answerYesOnPriceFallback:
    'Yes, on price.{asOf} Buyers have leverage in Bend on price cuts and first asks. The live share and sale-to-list figures are on the Bend housing market page when they publish.',
  qualifierUnderFour:
    "Bend still has {mos} months of supply, under the 4-month line, so it isn't oversupplied. Buyers have leverage in Bend on price and first asks, not on inventory.",
  paceHeading: 'Homes are taking longer to get an offer',
  paceBoth:
    'Over the last 90 days, the median Bend home took {days90} days to get an offer. Over the last 12 months it was {days12}. Recent listings are sitting a little longer, and a home that has sat is a home where the seller is more likely to listen.',
  pace90:
    'Over the last 90 days, the median Bend home took {days90} days to get an offer. Recent listings are sitting a little longer, and a home that has sat is a home where the seller is more likely to listen.',
  saleToListBoth:
    'The median Bend sale closed at {ask} of its first asking price and {final} of its final list price over the last 12 months. Most of that gap comes from price cuts made before an offer comes in, so the asking price on day one is often not the number that matters.',
  saleToListAsk:
    'The median Bend sale closed at {ask} of its first asking price over the last 12 months. Most of the gap from first ask comes from price cuts made before an offer comes in, so the asking price on day one is often not the number that matters.',
  paceLinkLabel: 'See the full Bend numbers',
  weekHeading: "This week's price cuts in Bend",
  weekWithMedian:
    '{count} Bend homes cut their asking price in the last 7 days. The median drop was {median}{asOf}.',
  weekCountOnly: '{count} Bend homes cut their asking price in the last 7 days{asOf}.',
  weekLinkLabel: "See this week's Bend price drops",
  regionLine: '{asOf}Central Oregon overall: {mos} months of supply, {cut} sold after a cut.',
  regionLinkLabel: 'Central Oregon months of supply',
  areaCaption:
    'Months of supply, sold after a price cut (12 months), and median days to an offer (last 90 days). {method}',
  townsHeading: 'Where buyers have room in Central Oregon',
  colArea: 'Area',
  colMos: 'Months of supply',
  colCut: 'Sold after a price cut (12 mo)',
  colDays: 'Median days to an offer (90 days)',
  colRead: 'Read',
  useHeading: 'How to use it',
  useStart:
    "Start with homes that have been listed longer than {days} days or have already cut their price. Those are the sellers most likely to talk about price or credits. A home that's priced right and just listed can still draw a fast offer, especially in Sisters.",
  useStartFallback:
    "Start with homes that have sat or have already cut their price. Those are the sellers most likely to talk about price or credits. A home that's priced right and just listed can still draw a fast offer, especially in Sisters.",
  usePayment: 'Know your number before you tour.',
  usePaymentLink: 'Run your payment',
  useClosingLink: 'buyer closing costs in Bend',
  useStory: 'For the longer story, read',
  useShiftLink: 'Bend is tilting toward buyers',
  useShiftNote: '(data from July 17, 2026)',
  useGoodTimeLink: 'is now a good time to buy in Bend',
  questionsHeading: 'Questions',
  sourcesHeading: 'Sources',
  nextHeading: 'Next step',
  reportHeading: 'Get the weekly deal report',
  reportSubhead:
    'Bend price cuts, new listings and the leverage numbers. Email is required. Phone is optional. A broker follows up. This is not an automated newsletter.',
  reportButton: 'Send me the report',
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
  faq1NotBySupply:
    'Not by supply. Bend has {mos} months of supply{asOf}, under the 6-month mark people usually use. But buyers have leverage in Bend on price: {cut} of homes sold in the last 12 months after a price cut, and the median home closed at {ask} of its first ask.',
  faq1YesOnPrice:
    'Buyers have leverage in Bend on price: {cut} of homes sold in the last 12 months after a price cut, and the median home closed at {ask} of its first ask.',
  faq1Fallback:
    'Buyers have leverage in Bend on price cuts and first asks. See the Bend housing market page for the live months of supply.',
  faq2Question: 'How much below asking do Bend homes sell?',
  faq2Both:
    'Over the last 12 months, the median Bend home sold at {ask} of its first asking price and {final} of its final list price. The gap is mostly price cuts made before an offer.',
  faq2Ask:
    'Over the last 12 months, the median Bend home sold at {ask} of its first asking price. The gap is mostly price cuts made before an offer.',
  faq2Fallback:
    'The Bend city page prints sale price against the first asking price, last 12 months, when that cell publishes.',
  faq3Question: 'Can I ask for seller credits in Bend?',
  faq3Answer:
    'Yes. Asking for credits toward closing costs or repairs is common, and a home that has sat or already cut its price gives you more room to ask.',
  faq4Question: 'Which Central Oregon towns give buyers the most room?',
  faq4Open: 'Prineville ({prineville} months of supply) and Sunriver ({sunriver}).',
  faq4Fallback:
    'Prineville and Sunriver have been the more open towns when months of supply publishes above 4. Sisters is mixed when well-priced homes still go fast. Redmond sits near the 4-month line, so there is little leverage beyond homes that have sat.',
  faq4SistersMixedFast: ' Sisters is mixed, and well-priced homes still go fast.',
  faq4SistersMixedDays: ' Sisters is mixed, with a median of {days} days to an offer.',
  faq4Redmond: " Redmond is at {mos} months, so there's little leverage beyond homes that have sat.",
  faq5Question: 'Which homes give the most room to negotiate?',
  faq5WithDays:
    'Homes listed longer than the typical {days} days to an offer, and homes that have already cut their price.',
  faq5Fallback: 'Homes that have sat, and homes that have already cut their price.',
  faq6Question: 'How often are these numbers updated?',
  faq6Answer: 'Daily, from Oregon Data Share MLS.',
  relatedBendMarket: 'Bend housing market',
  relatedBendCity: 'Bend city page',
  relatedShift: 'Our concession data',
  relatedDrops: "This week's Bend price drops",
  relatedMethod: 'How we get our numbers',
  nextBendMarket: 'See the full Bend numbers',
  nextDrops: 'See Bend price drops',
  nextMos: 'Months of supply',
  nextMethod: 'How we get our numbers',
  nextAlerts: 'Get listing alerts',
  nextBook: 'Talk to Matt',
  nextGoodTime: 'Is now a good time to buy in Bend',
  nextClosingCosts: 'Closing costs for Bend buyers',
  nextMortgage: 'Mortgage calculator',
  noteLaPineUnpublished: 'Cuts and pace give buyers room',
  noteBendUnderFour: 'Leverage on price, not supply',
  noteBendReadMos: 'Read the live months of supply beside the price-cut share.',
  noteRedmondLittle: 'Little leverage. Room to negotiate on homes that have sat',
  noteRedmondSat: 'Room to negotiate on homes that have sat',
  noteSistersMixedFast: 'Mixed. Well-priced homes still go fast',
  noteSistersOpen: 'More room on homes that have sat',
  noteSistersSat: 'Claim leverage only on homes that have sat',
  noteOpen: 'Buyers have room',
  noteReadMos: 'Read the live months of supply beside the price-cut share.',
} as const

function fill(template: string, vars: Record<string, string>): string {
  return template.replace(/\{([a-z0-9]+)\}/gi, (_, key: string) => vars[key] ?? '')
}

function asOfLead(asOf: string | null): string {
  return asOf ? `As of ${asOf}, ` : ''
}

function asOfPeriod(asOf: string | null): string {
  return asOf ? ` As of ${asOf}.` : ''
}

function asOfInline(asOf: string | null): string {
  return asOf ? ` as of ${asOf}` : ''
}

function asOfParen(asOf: string | null): string {
  return asOf ? ` (as of ${asOf})` : ''
}

export function displayedMosUnderFour(mos: number | null, mosLabel: string | null): boolean {
  if (mos == null || mosLabel == null) return false
  const shown = Number.parseFloat(mosLabel)
  return Number.isFinite(shown) && shown < MOS_SELLER_MAX
}

export function displayedMosUnderSix(mos: number | null, mosLabel: string | null): boolean {
  if (mos == null || mosLabel == null) return false
  const shown = Number.parseFloat(mosLabel)
  return Number.isFinite(shown) && shown < MOS_BALANCED_MAX
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

export function leverageCopy(snap: LeverageSnapshot): LeverageCopy {
  const bend = snap.bend
  const asOf = bend.asOfLabel
  const underFour = displayedMosUnderFour(bend.monthsSupply, bend.monthsSupplyLabel)

  const answer: string[] = []
  if (bend.priceCutShareLabel && bend.medianPriceCutLabel && bend.saleToFirstAskLabel) {
    answer.push(
      fill(LEVERAGE_COPY.answerYesOnPrice, {
        asOf: asOfLead(asOf),
        cut: bend.priceCutShareLabel,
        medianCut: bend.medianPriceCutLabel,
        ask: bend.saleToFirstAskLabel,
      }),
    )
  } else if (bend.priceCutShareLabel && bend.saleToFirstAskLabel) {
    answer.push(
      fill(LEVERAGE_COPY.answerYesOnPriceNoMedian, {
        asOf: asOfLead(asOf),
        cut: bend.priceCutShareLabel,
        ask: bend.saleToFirstAskLabel,
      }),
    )
  } else {
    answer.push(fill(LEVERAGE_COPY.answerYesOnPriceFallback, { asOf: asOfPeriod(asOf) }))
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

  const saleToListLine =
    bend.saleToFirstAskLabel && bend.saleToFinalListLabel
      ? fill(LEVERAGE_COPY.saleToListBoth, {
          ask: bend.saleToFirstAskLabel,
          final: bend.saleToFinalListLabel,
        })
      : bend.saleToFirstAskLabel
        ? fill(LEVERAGE_COPY.saleToListAsk, { ask: bend.saleToFirstAskLabel })
        : null

  const weekAsOf = asOfParen(snap.weekDrops?.asOfLabel ?? null)
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
  const regionAsOf = region.asOfLabel ?? asOf
  const regionLine =
    region.monthsSupplyLabel && region.priceCutShareLabel
      ? fill(LEVERAGE_COPY.regionLine, {
          asOf: regionAsOf ? `All figures as of ${regionAsOf}. ` : '',
          mos: region.monthsSupplyLabel,
          cut: region.priceCutShareLabel,
        })
      : null

  const useStart =
    bend.daysToOffer90 != null
      ? fill(LEVERAGE_COPY.useStart, { days: String(bend.daysToOffer90) })
      : LEVERAGE_COPY.useStartFallback

  const faqs = leverageFaqs(snap)
  const methodLine = asOf
    ? `${fill(LEVERAGE_COPY.footerLine, { asOf })} ${LEVERAGE_COPY.mosWindow}`
    : `${LEVERAGE_COPY.footerLineNoAsOf} ${LEVERAGE_COPY.mosWindow}`

  return {
    title: LEVERAGE_COPY.title,
    h1: LEVERAGE_COPY.h1,
    eyebrow: LEVERAGE_COPY.eyebrow,
    metaDescription: leverageMetaDescription(snap),
    answer,
    weekLine,
    weekHeading: LEVERAGE_COPY.weekHeading,
    weekLinkLabel: LEVERAGE_COPY.weekLinkLabel,
    qualifier,
    paceHeading: LEVERAGE_COPY.paceHeading,
    paceLine,
    saleToListLine,
    paceLinkLabel: LEVERAGE_COPY.paceLinkLabel,
    methodLine,
    regionLine,
    regionLinkLabel: LEVERAGE_COPY.regionLinkLabel,
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
    colArea: LEVERAGE_COPY.colArea,
    colMos: LEVERAGE_COPY.colMos,
    colCut: LEVERAGE_COPY.colCut,
    colDays: LEVERAGE_COPY.colDays,
    colRead: LEVERAGE_COPY.colRead,
    useHeading: LEVERAGE_COPY.useHeading,
    useStart,
    usePayment: LEVERAGE_COPY.usePayment,
    usePaymentLink: LEVERAGE_COPY.usePaymentLink,
    useClosingLink: LEVERAGE_COPY.useClosingLink,
    useStory: LEVERAGE_COPY.useStory,
    useShiftLink: LEVERAGE_COPY.useShiftLink,
    useShiftNote: LEVERAGE_COPY.useShiftNote,
    useGoodTimeLink: LEVERAGE_COPY.useGoodTimeLink,
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
  const underSix = displayedMosUnderSix(bend.monthsSupply, bend.monthsSupplyLabel)

  const q1Answer = (() => {
    if (underSix && bend.monthsSupplyLabel && bend.priceCutShareLabel && bend.saleToFirstAskLabel) {
      return fill(LEVERAGE_COPY.faq1NotBySupply, {
        asOf: asOfInline(bend.asOfLabel),
        cut: bend.priceCutShareLabel,
        ask: bend.saleToFirstAskLabel,
        mos: bend.monthsSupplyLabel,
      })
    }
    if (bend.priceCutShareLabel && bend.saleToFirstAskLabel) {
      return fill(LEVERAGE_COPY.faq1YesOnPrice, {
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
      })
    }
    if (bend.saleToFirstAskLabel) {
      return fill(LEVERAGE_COPY.faq2Ask, { ask: bend.saleToFirstAskLabel })
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
  if (!prineville?.monthsSupplyLabel || !sunriver?.monthsSupplyLabel) {
    return LEVERAGE_COPY.faq4Fallback
  }
  let line = fill(LEVERAGE_COPY.faq4Open, {
    prineville: prineville.monthsSupplyLabel,
    sunriver: sunriver.monthsSupplyLabel,
  })
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
