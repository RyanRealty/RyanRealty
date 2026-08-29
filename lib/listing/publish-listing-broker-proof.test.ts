import { describe, expect, it } from 'vitest'
import type { Broker } from '@/lib/data/types/broker'
import type { ReviewsSummary } from '@/lib/data/reviews/getReviews'
import {
  listingBrokerGender,
  matchListingBroker,
  publishListingBrokerProof,
  resolveListingPageBroker,
} from './publish-listing-broker-proof'

function broker(partial: Pick<Broker, 'slug' | 'fullName'> & Partial<Broker>): Broker {
  return {
    title: 'Broker',
    email: null,
    phoneDirect: null,
    phoneFub: null,
    headshotPng: '/images/brokers/x.png',
    headshotJpg: '/images/brokers/x.jpg',
    licenseNumber: null,
    bio: null,
    isPrincipal: false,
    ...partial,
  }
}

const matt = broker({
  slug: 'matthew-ryan',
  fullName: 'Matt Ryan',
  isPrincipal: true,
})
const paul = broker({ slug: 'paul-stevenson', fullName: 'Paul Stevenson' })
const rebecca = broker({ slug: 'rebecca-peterson', fullName: 'Rebecca Ryser Peterson' })
const roster = [matt, paul, rebecca]

const reviews: ReviewsSummary = {
  count: 25,
  averageRating: 5,
  source: 'google',
  reviews: [
    {
      rating: 5,
      text: 'Fantastic professional service. Goes the extra mile to cover the needs of his customers.',
      reviewerName: 'Paul Robinson',
      reviewDate: '2026-01-01',
    },
    {
      rating: 5,
      text: 'She walked us through every offer with clear numbers.',
      reviewerName: 'Sam Lee',
      reviewDate: '2026-02-01',
    },
    {
      rating: 5,
      text: 'Clear numbers and a same-day reply on the tour.',
      reviewerName: 'Jordan Hale',
      reviewDate: '2026-03-01',
    },
    {
      rating: 5,
      text: 'Matt found the right street without the usual runaround.',
      reviewerName: 'Alex Chen',
      reviewDate: '2026-04-01',
    },
  ],
}

describe('listingBrokerGender', () => {
  it('marks Rebecca feminine and the men masculine', () => {
    expect(listingBrokerGender(rebecca)).toBe('feminine')
    expect(listingBrokerGender(paul)).toBe('masculine')
    expect(listingBrokerGender(matt)).toBe('masculine')
  })
})

describe('resolveListingPageBroker', () => {
  it('keeps the server default when nothing is attributed', () => {
    expect(
      resolveListingPageBroker({
        defaultBroker: matt,
        brokers: roster,
        attributedSlug: null,
      }),
    ).toBe(matt)
  })

  it('honors an inbound attribution slug', () => {
    expect(
      resolveListingPageBroker({
        defaultBroker: matt,
        brokers: roster,
        attributedSlug: 'rebecca',
      }),
    ).toBe(rebecca)
  })

  it('does not swap over a locked listing agent', () => {
    expect(
      resolveListingPageBroker({
        defaultBroker: paul,
        brokers: roster,
        attributedSlug: 'rebecca',
        lockToDefault: true,
      }),
    ).toBe(paul)
  })

  it('never invents a random broker', () => {
    const first = resolveListingPageBroker({ defaultBroker: matt, brokers: roster })
    const second = resolveListingPageBroker({ defaultBroker: matt, brokers: roster })
    expect(first).toBe(matt)
    expect(second).toBe(matt)
  })
})

describe('matchListingBroker', () => {
  it('matches short attribution slugs to roster rows', () => {
    expect(matchListingBroker('paul', roster)).toBe(paul)
    expect(matchListingBroker('rebecca-peterson', roster)).toBe(rebecca)
    expect(matchListingBroker('unknown', roster)).toBeNull()
  })
})

describe('publishListingBrokerProof', () => {
  it('drops his-customers next to Rebecca and keeps a gender-safe quote', () => {
    const proof = publishListingBrokerProof({
      broker: rebecca,
      brokers: roster,
      reviews,
    })
    expect(proof?.reviews.map((r) => r.reviewerName)).toEqual(['Sam Lee', 'Jordan Hale'])
    expect(proof?.reviews.some((r) => /\bhis\b/i.test(r.text))).toBe(false)
    expect(proof?.count).toBe(25)
  })

  it('keeps the his-customers quote for Paul and drops she-quotes', () => {
    const proof = publishListingBrokerProof({
      broker: paul,
      brokers: roster,
      reviews,
    })
    expect(proof?.reviews.map((r) => r.reviewerName)).toEqual(['Paul Robinson', 'Jordan Hale'])
  })

  it('drops quotes that name a roster broker', () => {
    const proof = publishListingBrokerProof({
      broker: matt,
      brokers: roster,
      reviews,
    })
    expect(proof?.reviews.some((r) => /matt/i.test(r.text))).toBe(false)
  })
})
