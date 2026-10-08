/**
 * Cover owns the recommend dollars. Method / net / clamp say "that price".
 */
import { describe, expect, it } from 'vitest'
import { pricingPage, whatItsWorthLead } from '@/lib/cma/render-pricing-page'
import { sellerNetBodyHtml, type OpinionPageArgs } from '@/lib/cma/opinion-pages'
import {
  deRepeatRecommendDollars,
  isRecommendMark,
  recommendUsdForms,
} from '@/lib/cma/recommend-once'
import type { CmaPricing, CmaSubject } from '@/lib/cma/types'

describe('recommend-once helper', () => {
  it('matches exact and 1k-rounded recommend marks', () => {
    expect(isRecommendMark(565_000, 565_000)).toBe(true)
    expect(isRecommendMark(564_800, 565_000)).toBe(true)
    expect(isRecommendMark(533_000, 565_000)).toBe(false)
    expect(isRecommendMark(1_500, 565_000)).toBe(false)
  })

  it('rewrites stored method / net sentences without touching other dollars', () => {
    expect(recommendUsdForms(565_000)).toContain('$565,000')
    const clamp =
      'The sales alone would support listing at $571,000. Because $575,000 already failed to sell, we do not recommend going above $565,000, which is the 75th percentile.'
    expect(deRepeatRecommendDollars(clamp, 565_000)).toBe(
      'The sales alone would support listing at $571,000. Because $575,000 already failed to sell, we do not recommend going above that price, which is the 75th percentile.',
    )
    expect(
      deRepeatRecommendDollars(
        'From a $565,000 list, less $1,500 in seller concessions, $563,500 remains.',
        565_000,
      ),
    ).toBe('From that price, less $1,500 in seller concessions, $563,500 remains.')
  })
})

describe('method lead — list high is the recommend echo', () => {
  const subject = {
    streetAddress: '15991 Falcon',
    city: 'La Pine',
    standardStatus: 'Expired',
  } as CmaSubject

  it('cites the closed-comp (hero) band once — listRange is not a second tier', () => {
    const pricing = {
      conservative: 533_000,
      recommended: 565_000,
      highEnd: 565_000,
      valueLow: 513_000,
      valueHigh: 658_000,
    } as unknown as CmaPricing
    const lead = whatItsWorthLead(subject, pricing)
    expect(lead).toContain('The sales support $513,000 to $658,000.')
    // Same band as hero → instruction only, figures do not repeat.
    expect(lead).toContain('List in that range.')
    expect(lead).not.toContain('List between $533,000')
    expect(lead).not.toContain('$565,000')
  })
})

describe('net sheet — cover already named the list', () => {
  const a = {
    subject: {
      streetAddress: '15991 Falcon',
      city: 'La Pine',
      standardStatus: 'Expired',
    },
    pricing: {
      conservative: 533_000,
      recommended: 565_000,
      highEnd: 565_000,
      valueLow: 513_000,
      valueHigh: 658_000,
      sellerNet: {
        basis: 'list',
        list: 565_000,
        lines: [{ label: 'Seller concession', amount: 1_500, source: 'Median of the comps.' }],
        net: 563_500,
        sentence: 'From a $565,000 list, less $1,500 in seller concessions, $563,500 remains.',
        unknowns: ['the listing and buyer-broker commission'],
      },
    },
  } as unknown as OpinionPageArgs

  it('heads the column with its price, once, and keeps the prose off the dollars', () => {
    const html = sellerNetBodyHtml(a)
    // The cover owns the dollars: the head names the price in words, and the
    // sentence above it points at "that price".
    expect(html).toContain('At the list price')
    expect(html).not.toContain('At $565,000')
    expect(html.split('$565,000')).toHaveLength(1)
    expect(html).toContain('Left from the sale')
    expect(html).toContain('From that price, less $1,500')
    expect(html).toContain('$563,500')
    expect(html).toContain('−$1,500')
    // Matt 2026-10-07: "that price" in the money column read like a bug.
    expect(html).not.toContain('<td class="v">that price</td>')
  })
})

describe('clamp note — recommend dollars already on the cover', () => {
  it('rewrites going-above $565,000 to that price and keeps the failed ask', () => {
    const page = pricingPage({
      subject: {
        streetAddress: '15991 Falcon',
        city: 'La Pine',
        standardStatus: 'Expired',
      } as CmaSubject,
      comps: [],
      market: null,
      pricing: {
        conservative: 533_000,
        recommended: 565_000,
        highEnd: 565_000,
        valueLow: 513_000,
        valueHigh: 658_000,
        clamp: {
          sentence:
            'The sales alone would support listing at $571,000. Because $575,000 already failed to sell, we do not recommend going above $565,000, which is the 75th percentile of what failed listings later sold for across 3,394 Central Oregon pairs.',
        },
      } as unknown as CmaPricing,
    })
    expect(page.body).toContain('worth-lead-note')
    expect(page.body).toContain('going above that price')
    expect(page.body).toContain('$571,000')
    expect(page.body).toContain('$575,000')
    expect(page.body).not.toContain('$565,000')
  })
})
