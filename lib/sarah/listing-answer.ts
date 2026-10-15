/**
 * Deterministic listing-page answers. No model call.
 *
 * Production web chat had no listing context and no chat route: evaluateSarahTurn
 * returns reply:null for ordinary questions, and the panel printed WEB_HELP_EN.
 * This module answers from the current listing's facts, or says the fact is
 * missing and offers the assigned broker. Never invents a year.
 */
import { listingKeyFromPageUrl } from '@/lib/crm/looking-at'
import type { SarahListingFacts } from '@/lib/data/sarah/listing-facts'
import { matchIntentChip, type FlowStep } from './intent-flow'
import { DEFAULT_DESK_BROKER_FIRST_NAME, WEB_HELP_EN } from './scripts'

export const LISTING_UNKNOWN_FACT_EN =
  "That fact isn't in the listing data I have. I can have the broker find out."

const SHOP_RE = /\b(shop|workshop|outbuilding|out[- ]building|barn|shed|studio)\b/i
const YEAR_RE = /\b(when|year|built|age|old|how old)\b/i
const HOME_YEAR_RE = /\b(home|house|this (place|property)|year built|the house|the home)\b/i
const HOA_RE = /\b(hoa|homeowners? association|dues|cc&?rs?|association fee)\b/i
const BEDS_RE = /\b(bed(room)?s?)\b/i
const BATHS_RE = /\b(bath(room)?s?)\b/i
const SQFT_RE = /\b(sq\.?\s*ft|square feet|square foot|living area|how big|size of (the )?(home|house))\b/i
const GARAGE_RE = /\b(garage|parking|rv|boat)\b/i
const LOT_RE = /\b(lot|acre|yard|fenced)\b/i
const FEATURE_RE = /\b(feature|amenities|amenity|kitchen|quartz|fireplace|office|bonus room|primary suite)\b/i

function brokerName(first: string): string {
  return first.trim() || DEFAULT_DESK_BROKER_FIRST_NAME
}

export function listingUnknownFactEn(brokerFirstName = DEFAULT_DESK_BROKER_FIRST_NAME): string {
  return `That fact isn't in the listing data I have. I can have ${brokerName(brokerFirstName)} find out.`
}

export type SarahPageKind = 'listing' | 'community' | 'city' | 'neighborhood' | 'other'

export function parseSarahPage(pathname: string | null | undefined): {
  kind: SarahPageKind
  listNumber: string | null
  citySlug: string | null
  communitySlug: string | null
  neighborhoodSlug: string | null
} {
  const empty = {
    kind: 'other' as const,
    listNumber: null,
    citySlug: null,
    communitySlug: null,
    neighborhoodSlug: null,
  }
  if (!pathname) return empty
  const listNumber = listingKeyFromPageUrl(pathname)
  if (listNumber) {
    return { kind: 'listing', listNumber, citySlug: null, communitySlug: null, neighborhoodSlug: null }
  }
  const segs = pathname.toLowerCase().replace(/\/+$/, '').split('/').filter(Boolean)
  if (segs[0] === 'communities' && segs[1] && segs[1] !== 'types') {
    return { kind: 'community', listNumber: null, citySlug: null, communitySlug: segs[1], neighborhoodSlug: null }
  }
  if (segs[0] === 'cities' && segs[1] && segs[2] && segs[2] !== 'types') {
    return { kind: 'neighborhood', listNumber: null, citySlug: segs[1], communitySlug: null, neighborhoodSlug: segs[2] }
  }
  if (segs[0] === 'cities' && segs[1] && segs[1] !== 'types') {
    return { kind: 'city', listNumber: null, citySlug: segs[1], communitySlug: null, neighborhoodSlug: null }
  }
  if (segs[0] === 'homes-for-sale' && segs.length === 2) {
    return { kind: 'city', listNumber: null, citySlug: segs[1], communitySlug: null, neighborhoodSlug: null }
  }
  return empty
}

export function shouldAnswerFromPage(input: {
  pathname: string | null | undefined
  visitorText: string
  flowStep: FlowStep
}): boolean {
  const page = parseSarahPage(input.pathname)
  if (page.kind === 'other') return false
  if (input.flowStep !== 'intent' && input.flowStep !== 'ask') return false
  const text = input.visitorText.trim()
  if (!text) return false
  if (matchIntentChip(text)) return false
  return true
}

/** @deprecated use shouldAnswerFromPage */
export const shouldAnswerFromListing = shouldAnswerFromPage

function formatCount(n: number): string {
  return Number.isInteger(n) ? String(n) : String(n)
}

function formatSqft(n: number): string {
  return Math.round(n).toLocaleString('en-US')
}

function formatMoney(n: number): string {
  if (Number.isInteger(n)) return `$${n.toLocaleString('en-US')}`
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function extractShopPhrase(remarks: string | null): string | null {
  if (!remarks) return null
  const sentences = remarks.split(/(?<=[.!?])\s+/)
  const hit = sentences.find((s) => SHOP_RE.test(s))
  if (!hit) return null
  const phrase = hit.match(
    /\b(?:a |an )?(?:\d+\s*[x×]\s*\d+\s+)?(?:powered\s+)?(?:shop|workshop)\b[^.]*/i,
  )
  return (phrase?.[0] ?? hit).replace(/\s+/g, ' ').replace(/[.,;:]+$/, '').trim() || null
}

/**
 * Only an explicit shop/workshop year in remarks. Never the home year_built.
 */
export function extractShopYear(remarks: string | null): number | null {
  if (!remarks) return null
  const m = remarks.match(
    /\b(?:shop|workshop|outbuilding|barn|shed)\b[^.!?]{0,80}?\b(?:built|year|in)\b[^.!?]{0,20}?\b(19|20)\d{2}\b/i,
  )
  if (!m) {
    const alt = remarks.match(
      /\b(?:built|year)\b[^.!?]{0,20}?\b(19|20)\d{2}\b[^.!?]{0,40}?\b(?:shop|workshop|outbuilding)\b/i,
    )
    if (!alt) return null
    const year = Number(alt[0].match(/\b((?:19|20)\d{2})\b/)?.[1])
    return Number.isFinite(year) ? year : null
  }
  const year = Number(m[0].match(/\b((?:19|20)\d{2})\b/)?.[1])
  return Number.isFinite(year) ? year : null
}

function joinSentences(parts: string[]): string {
  return parts
    .map((p) => p.replace(/\s+/g, ' ').replace(/[.\s]+$/, '').trim())
    .filter(Boolean)
    .map((p) => (/[.!?]$/.test(p) ? p : `${p}.`))
    .join(' ')
}

function shopAnswer(facts: SarahListingFacts, broker: string): string {
  const shopYear = extractShopYear(facts.publicRemarks)
  const phrase = extractShopPhrase(facts.publicRemarks)
  const parts: string[] = []
  if (shopYear) {
    parts.push(`The listing shows the shop was built in ${shopYear}`)
  } else {
    parts.push("The listing does not give the shop's build year")
  }
  if (facts.yearBuilt) parts.push(`The home was built in ${facts.yearBuilt}`)
  if (phrase) parts.push(`The remarks describe ${phrase}`)
  if (!shopYear) parts.push(`I can have ${broker} find out`)
  return joinSentences(parts)
}

function yearAnswer(facts: SarahListingFacts, broker: string): string {
  if (facts.yearBuilt) return `The listing shows this home was built in ${facts.yearBuilt}.`
  return listingUnknownFactEn(broker)
}

function hoaAnswer(facts: SarahListingFacts, broker: string): string {
  if (facts.hoaMonthly) {
    const freq = facts.associationFeeFrequency?.toLowerCase().includes('month')
      ? 'a month'
      : facts.associationFeeFrequency
        ? ` (${facts.associationFeeFrequency.toLowerCase()})`
        : 'a month'
    return `The listing shows an HOA of ${formatMoney(facts.hoaMonthly)} ${freq}.`
  }
  if (facts.associationYn === false) return 'The listing shows no HOA.'
  if (facts.associationYn === true) {
    return `The listing says there is an HOA, but it does not include the dues. I can have ${broker} find out.`
  }
  return listingUnknownFactEn(broker)
}

function sizeAnswer(facts: SarahListingFacts, broker: string): string {
  const bits: string[] = []
  if (facts.bedrooms != null) bits.push(`${formatCount(facts.bedrooms)} bedroom${facts.bedrooms === 1 ? '' : 's'}`)
  if (facts.bathrooms != null) bits.push(`${formatCount(facts.bathrooms)} bathroom${facts.bathrooms === 1 ? '' : 's'}`)
  if (facts.livingSqft != null) bits.push(`${formatSqft(facts.livingSqft)} square feet`)
  if (!bits.length) return listingUnknownFactEn(broker)
  return `The listing shows ${bits.join(', ')}.`
}

function garageAnswer(facts: SarahListingFacts, broker: string): string {
  const parts: string[] = []
  if (facts.garageSpaces != null && facts.garageSpaces > 0) {
    parts.push(`The listing shows a ${formatCount(facts.garageSpaces)}-car garage`)
  } else if (facts.garageYn === true) {
    parts.push('The listing shows a garage')
  } else if (facts.garageYn === false) {
    parts.push('The listing does not show a garage')
  }
  if (facts.otherStructures && /rv|boat|garage|storage/i.test(facts.otherStructures)) {
    parts.push(`Other structures listed: ${facts.otherStructures}`)
  }
  if (facts.publicRemarks && /\brv\b/i.test(facts.publicRemarks)) {
    const rv = facts.publicRemarks.match(/gated RV parking/i)
    if (rv) parts.push('It also mentions gated RV parking')
  }
  if (!parts.length) return listingUnknownFactEn(broker)
  return joinSentences(parts)
}

function lotAnswer(facts: SarahListingFacts, broker: string): string {
  const parts: string[] = []
  if (facts.lotAcres != null && facts.lotAcres > 0) {
    const acres = Number(facts.lotAcres.toFixed(2))
    parts.push(`The listing shows a ${acres} acre lot`)
  }
  if (facts.lotFeatures) parts.push(`Lot features: ${facts.lotFeatures}`)
  if (facts.publicRemarks && /fenced backyard/i.test(facts.publicRemarks)) {
    parts.push('The remarks mention a fenced backyard')
  }
  if (!parts.length) return listingUnknownFactEn(broker)
  return joinSentences(parts)
}

function featureAnswer(facts: SarahListingFacts, broker: string): string {
  if (facts.interiorFeatures) return `The listing lists these interior features: ${facts.interiorFeatures}.`
  if (facts.publicRemarks) {
    const first = facts.publicRemarks.split(/(?<=[.!?])\s+/).slice(0, 2).join(' ')
    return `The listing says: ${first}`
  }
  return listingUnknownFactEn(broker)
}

export function answerListingQuestion(
  question: string,
  facts: SarahListingFacts | null,
  brokerFirstName = DEFAULT_DESK_BROKER_FIRST_NAME,
): string {
  const broker = brokerName(brokerFirstName)
  const q = question.trim()
  if (!q) return listingUnknownFactEn(broker)
  if (!facts) return listingUnknownFactEn(broker)

  let reply: string
  if (SHOP_RE.test(q) && YEAR_RE.test(q)) reply = shopAnswer(facts, broker)
  else if (SHOP_RE.test(q)) reply = shopAnswer(facts, broker)
  else if (YEAR_RE.test(q) && (HOME_YEAR_RE.test(q) || /when was (this|it) built/i.test(q))) {
    reply = yearAnswer(facts, broker)
  } else if (HOA_RE.test(q)) reply = hoaAnswer(facts, broker)
  else if (BEDS_RE.test(q) || BATHS_RE.test(q) || SQFT_RE.test(q)) reply = sizeAnswer(facts, broker)
  else if (GARAGE_RE.test(q)) reply = garageAnswer(facts, broker)
  else if (LOT_RE.test(q)) reply = lotAnswer(facts, broker)
  else if (FEATURE_RE.test(q)) reply = featureAnswer(facts, broker)
  else if (YEAR_RE.test(q) && !SHOP_RE.test(q)) reply = yearAnswer(facts, broker)
  else reply = listingUnknownFactEn(broker)

  if (reply === WEB_HELP_EN) reply = listingUnknownFactEn(broker)
  return reply
}

export function assertDistinctListingReplies(replies: string[]): void {
  if (replies.some((r) => r === WEB_HELP_EN)) {
    throw new Error('listing answers must not use WEB_HELP_EN')
  }
  for (let i = 1; i < replies.length; i += 1) {
    if (replies[i] === replies[i - 1]) {
      throw new Error('the same Sarah listing reply twice in a row')
    }
  }
}

export type SarahPlaceFacts = {
  kind: 'community' | 'city' | 'neighborhood'
  name: string
  city: string | null
  description: string | null
  character: string | null
  hoaAnnual: number | null
}

export function placeUnknownFactEn(
  kind: SarahPlaceFacts['kind'] | 'page',
  brokerFirstName = DEFAULT_DESK_BROKER_FIRST_NAME,
): string {
  const label = kind === 'page' ? 'page' : `${kind} page`
  return `That isn't listed on this ${label}. I can have ${brokerName(brokerFirstName)} find out.`
}

export function answerPlaceQuestion(
  question: string,
  facts: SarahPlaceFacts | null,
  brokerFirstName = DEFAULT_DESK_BROKER_FIRST_NAME,
): string {
  const broker = brokerName(brokerFirstName)
  const q = question.trim()
  if (!q || !facts) return placeUnknownFactEn('page', broker)

  if (HOA_RE.test(q)) {
    if (facts.hoaAnnual != null && facts.hoaAnnual > 0) {
      return `${facts.name} has an estimated HOA of ${formatMoney(facts.hoaAnnual)} a year on our community page.`
    }
    return placeUnknownFactEn(facts.kind, broker)
  }
  if (/\b(where|what (city|area|community|neighborhood)|this (area|community|neighborhood|city)|tell me about)\b/i.test(q)) {
    const parts: string[] = []
    if (facts.kind === 'community') {
      parts.push(`This page is ${facts.name}${facts.city ? ` in ${facts.city}` : ''}`)
    } else if (facts.kind === 'neighborhood') {
      parts.push(`This page is ${facts.name}${facts.city ? ` in ${facts.city}` : ''}`)
    } else {
      parts.push(`This page is about ${facts.name}`)
    }
    if (facts.character) parts.push(facts.character)
    else if (facts.description) parts.push(facts.description)
    return joinSentences(parts)
  }
  return placeUnknownFactEn(facts.kind, broker)
}
