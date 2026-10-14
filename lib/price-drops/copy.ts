/**
 * City copy for the upgraded /price-drops/[city] pages.
 * Title and H1 stay on price drops / price reduced. "Best deals" is body only.
 * Never "buyer's market", never a motivated-seller H1, never an em dash.
 */

import { formatMonthsOfSupply } from '@/lib/format/months-of-supply'
import { formatDate } from '@/lib/format/date'
import { formatPaceShare } from '@/lib/data/market-truth/public-pace'

export const PRICE_DROPS_FOCUS_SLUGS = ['bend', 'redmond', 'sisters', 'la-pine'] as const
export type PriceDropFocusSlug = (typeof PRICE_DROPS_FOCUS_SLUGS)[number]

export function isPriceDropFocusSlug(slug: string): slug is PriceDropFocusSlug {
  return (PRICE_DROPS_FOCUS_SLUGS as readonly string[]).includes(slug)
}

export function priceDropsCityTitle(cityName: string): string {
  return `Price Drops in ${cityName}, Oregon`
}

export function priceDropsCityH1(cityName: string): string {
  return `Price drops in ${cityName}`
}

export function priceDropsCityDescription(input: {
  cityName: string
  cutCount: number | null
}): string {
  const n = input.cutCount != null && input.cutCount > 0 ? String(input.cutCount) : 'Active'
  return (
    `${n} ${input.cityName} homes cut their price in the last 7 days. ` +
    `See repeat cuts, long-listed homes and owner-will-carry terms, updated daily from the MLS. Get alerts.`
  )
}

export type PriceDropCityContext = {
  monthsOfSupply: number | null
  priceCutShare: number | null
  medianPriceCut: number | null
  saleToOriginal: number | null
  daysToPending: number | null
  asOf: string | null
}

function asOfClause(asOf: string | null | undefined): string {
  if (!asOf) return ''
  const at = new Date(asOf)
  return Number.isNaN(at.getTime()) ? '' : ` as of ${formatDate(at)}`
}

function shareLabel(share: number | null | undefined): string | null {
  if (share == null || !Number.isFinite(share) || share <= 0) return null
  return formatPaceShare(share)
}

export function priceDropLeverageLine(input: {
  citySlug: string
  cityName: string
  monthsOfSupply: number | null
}): string | null {
  const { citySlug, cityName, monthsOfSupply } = input
  if (citySlug === 'bend') {
    return 'Buyers have leverage in Bend on price.'
  }
  if (citySlug === 'redmond') {
    return 'Some sellers in Redmond are cutting their asking price.'
  }
  if (citySlug === 'sisters') {
    return 'In Sisters, leverage applies on homes that have been listed a long time, not on every listing.'
  }
  if (citySlug === 'la-pine') {
    return null
  }
  if (monthsOfSupply != null && monthsOfSupply >= 6) {
    return `On long-listed homes in ${cityName}, buyers can ask about price and terms.`
  }
  return null
}

export function priceDropMosQualifier(input: {
  citySlug: string
  monthsOfSupply: number | null
}): string | null {
  if (input.citySlug === 'la-pine') return null
  if (input.monthsOfSupply == null || !Number.isFinite(input.monthsOfSupply)) return null
  return `${formatMonthsOfSupply(input.monthsOfSupply)} months of supply`
}

export function priceDropAnswerSentences(input: {
  citySlug: string
  cityName: string
  weekCount: number
  medianDropPct: number | null
  totalReducedLabel: string | null
  weekAsOf: string | null
  context: PriceDropCityContext
}): string[] {
  const sentences: string[] = []
  const weekDate = asOfClause(input.weekAsOf)
  const homes = input.weekCount === 1 ? 'home' : 'homes'
  let week = `${input.weekCount} ${input.cityName} ${homes} cut their asking price in the last 7 days${weekDate}.`
  if (input.medianDropPct != null) {
    week += ` The median cut was ${input.medianDropPct.toFixed(1)}%.`
  }
  if (input.totalReducedLabel) {
    week += ` Asking prices came down ${input.totalReducedLabel} in that window.`
  }
  sentences.push(week)

  const contextDate = asOfClause(input.context.asOf)
  const cutShare = shareLabel(input.context.priceCutShare)
  const medianCut = shareLabel(input.context.medianPriceCut)
  const saleToAsk = shareLabel(input.context.saleToOriginal)
  const contextBits: string[] = []
  if (cutShare) {
    contextBits.push(`${cutShare} of 12-month sales closed after a cut`)
  }
  if (medianCut) {
    contextBits.push(`the median cut on those sales was ${medianCut}`)
  }
  if (saleToAsk) {
    contextBits.push(`sale price was ${saleToAsk} of first ask`)
  }
  if (input.context.daysToPending != null) {
    contextBits.push(`${Math.round(input.context.daysToPending)} days to an offer over the last 90 days`)
  }
  if (contextBits.length > 0) {
    sentences.push(`On the ${input.cityName} city page${contextDate}: ${contextBits.join(', ')}.`)
  }

  const mos = priceDropMosQualifier({
    citySlug: input.citySlug,
    monthsOfSupply: input.context.monthsOfSupply,
  })
  if (mos) {
    sentences.push(`That sits next to ${mos} on the ${input.cityName} housing-market page.`)
  }

  const leverage = priceDropLeverageLine({
    citySlug: input.citySlug,
    cityName: input.cityName,
    monthsOfSupply: input.context.monthsOfSupply,
  })
  if (leverage) sentences.push(leverage)

  sentences.push(
    `These are the best deals we can show from the MLS this week: documented price cuts, not a guess that a home is below market.`,
  )
  return sentences
}

export type PriceDropFaqItem = { question: string; answer: string }

export function priceDropFaqItems(input: {
  citySlug: string
  cityName: string
  weekCount: number
  context: PriceDropCityContext
  reoCount: number | null
  reoEnabled: boolean
}): PriceDropFaqItem[] {
  const { cityName, citySlug, weekCount, context } = input
  const weekHomes = weekCount === 1 ? 'home' : 'homes'
  const cutShare = shareLabel(context.priceCutShare)
  const medianCut = shareLabel(context.medianPriceCut)
  const contextDate = asOfClause(context.asOf)

  const items: PriceDropFaqItem[] = [
    {
      question: `Where can I find price-reduced homes in ${cityName}?`,
      answer:
        `This page lists active single-family ${cityName} homes whose asking price fell in the last 7 days, ${weekCount} ${weekHomes} on this pull. Use the alert form on this page for an email when another ${cityName} home cuts its price. The list updates daily from the regional MLS.`,
    },
  ]

  if (cutShare && medianCut) {
    items.push({
      question: `How much do ${cityName} sellers usually cut?`,
      answer: `${cutShare} of ${cityName} sales in the last 12 months closed after a cut, and the median cut was ${medianCut}${contextDate}. That is closed-sale history on the ${cityName} city page, not a forecast.`,
    })
  } else if (medianCut) {
    items.push({
      question: `How much do ${cityName} sellers usually cut?`,
      answer: `The median cut on ${cityName} sales that reduced in the last 12 months was ${medianCut}${contextDate}. A cut on an active home is the ask moving, not a promise of the sale price.`,
    })
  } else {
    items.push({
      question: `How much do ${cityName} sellers usually cut?`,
      answer: `A price cut on this page is the current ask against the prior ask on that listing. We do not have a published 12-month median cut for ${cityName} on this pull.`,
    })
  }

  if (input.reoEnabled) {
    const count = input.reoCount ?? 0
    items.push({
      question: `Are there foreclosures or bank-owned homes in ${cityName} right now?`,
      answer:
        count === 0
          ? `None of the ${cityName} homes on this pull are marked bank-owned, HUD owned, in foreclosure, or short sale in the MLS Special Listing Conditions field today. REO and short-sale sales can still need lender approval.`
          : `${count} ${count === 1 ? 'home' : 'homes'} on this ${cityName} pull ${count === 1 ? 'is' : 'are'} marked bank-owned, HUD owned, in foreclosure, or short sale in the MLS field. Those sales may need lender approval.`,
    })
  }

  items.push(
    {
      question: `Does a price cut mean the home is priced under nearby sales?`,
      answer:
        `No. A cut means the asking price moved. It is not proof the home is under recent nearby sales. Compare the current ask to those sales with a broker before you write an offer.`,
    },
    {
      question: `How do I make an offer on a home that has been listed a long time?`,
      answer:
        `Ask about seller credits and terms, then write the offer with a buyer-broker agreement. Read the Bend buyer-broker agreement note linked from this page.`,
    },
    {
      question: `Can I get alerts when ${cityName} homes drop in price?`,
      answer: `Yes. The alert form on this page emails you when another ${cityName} single-family home cuts its asking price. One email per new cut. Unsubscribe any time.`,
    },
  )

  if (citySlug === 'bend') {
    items.push({
      question: `What are the cheapest homes in Bend right now?`,
      answer:
        `Price-band pages list Bend homes by ask, including homes under $400,000 and under $500,000. A lower ask is not the same as a price cut. Use those pages for the cheapest list prices, and this page for homes that just reduced.`,
    })
  }

  return items
}

const BANNED = /buyer's market|buyers market|below market value|under market|\bsteal\b|\bbargain\b|\u2014|\u2013/i

export function assertPriceDropCopy(text: string): void {
  if (BANNED.test(text)) {
    throw new Error(`price-drops copy failed the wording gate: ${text.slice(0, 160)}`)
  }
}
