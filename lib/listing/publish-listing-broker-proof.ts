/**
 * One listing, one broker, one matching quote.
 *
 * The listing card used to SSR a default broker, then randomly assign another
 * on the client when no attribution cookie existed. Desktop and phone then
 * showed different faces. Reviews stayed brokerage-level, so Paul Robinson's
 * "his customers" sat next to Rebecca's headshot.
 *
 * Contact identity is the server-resolved default (listing agent, else the
 * principal). An inbound attribution slug may replace that default. Random
 * assignment is gone. The quote must not name another broker and must not
 * use a gendered pronoun that contradicts the face on the card.
 */

import type { Broker } from '@/lib/data/types/broker'
import type { ReviewsSummary } from '@/lib/data/reviews/getReviews'

export type ListingBrokerGender = 'feminine' | 'masculine'

const FEMININE_PRONOUNS = /\b(she|her|hers|herself)\b/i
const MASCULINE_PRONOUNS = /\b(he|him|his|himself)\b/i

export function listingBrokerGender(broker: Pick<Broker, 'slug' | 'fullName'>): ListingBrokerGender {
  const hay = `${broker.slug} ${broker.fullName}`.toLowerCase()
  if (/\brebecca\b/.test(hay) || hay.includes('ryser')) return 'feminine'
  return 'masculine'
}

export function listingBrokerNameTokens(brokers: ReadonlyArray<Pick<Broker, 'fullName'>>): string[] {
  const tokens = new Set<string>(['matt'])
  for (const broker of brokers) {
    for (const part of broker.fullName.split(/\s+/)) {
      const token = part.toLowerCase().replace(/[^a-z]/g, '')
      if (token.length >= 4 && token !== 'ryan') tokens.add(token)
    }
  }
  return [...tokens]
}

export function matchListingBroker(slug: string, brokers: readonly Broker[]): Broker | null {
  const s = slug.toLowerCase().trim()
  if (!s) return null
  return (
    brokers.find((broker) => {
      const bs = broker.slug.toLowerCase()
      return bs === s || bs.includes(s) || s.includes(bs.split('-')[0] ?? '')
    }) ?? null
  )
}

export function resolveListingPageBroker(input: {
  defaultBroker: Broker
  brokers: readonly Broker[]
  attributedSlug?: string | null
  lockToDefault?: boolean
}): Broker {
  if (input.lockToDefault) return input.defaultBroker
  const slug = input.attributedSlug?.trim()
  if (!slug) return input.defaultBroker
  return matchListingBroker(slug, input.brokers) ?? input.defaultBroker
}

function reviewNamesAnotherBroker(text: string, tokens: readonly string[]): boolean {
  const lower = text.toLowerCase()
  return tokens.some((token) => new RegExp(`\\b${token}\\b`).test(lower))
}

function reviewMatchesGender(text: string, gender: ListingBrokerGender): boolean {
  if (gender === 'feminine' && MASCULINE_PRONOUNS.test(text)) return false
  if (gender === 'masculine' && FEMININE_PRONOUNS.test(text)) return false
  return true
}

export function publishListingBrokerProof(input: {
  broker: Pick<Broker, 'slug' | 'fullName'>
  brokers: ReadonlyArray<Pick<Broker, 'fullName'>>
  reviews: ReviewsSummary | null | undefined
}): ReviewsSummary | null {
  if (!input.reviews) return null
  const tokens = listingBrokerNameTokens(input.brokers)
  const gender = listingBrokerGender(input.broker)
  return {
    ...input.reviews,
    reviews: input.reviews.reviews.filter(
      (review) =>
        !reviewNamesAnotherBroker(review.text, tokens) && reviewMatchesGender(review.text, gender),
    ),
  }
}
