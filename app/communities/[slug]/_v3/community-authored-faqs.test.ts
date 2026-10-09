import { describe, expect, it } from 'vitest'
import {
  communityAnswerMarketLink,
  communityAuthoredFaqs,
  dropsGeneratedHoaQuestion,
  isGeneratedHoaQuestion,
  stockRailAsk,
  type CommunityAuthoredFaqInput,
} from './community-authored-faqs'

const AS_OF = 'Oct 8, 2026'

const base = (over: Partial<CommunityAuthoredFaqInput>): CommunityAuthoredFaqInput => ({
  slug: 'tetherow',
  name: 'Tetherow',
  asOfLabel: AS_OF,
  medianSale12: null,
  medianList: null,
  closedCount12: null,
  saleToOriginal: null,
  cashShare: null,
  activeSfr: null,
  lotsForSale: 0,
  lotsAskLow: null,
  lotsAskHigh: null,
  townhomesForSale: 0,
  hoaMonthly: null,
  hoaAnnual: null,
  hoaReported: null,
  membershipOfficePhone: null,
  membershipTierCount: null,
  ...over,
})

describe('communityAuthoredFaqs, Oct 8 render', () => {
  it('Brasada Qs match the brief, and drop lots when the rail is empty', () => {
    const faqs = communityAuthoredFaqs(
      base({
        slug: 'brasada-ranch',
        name: 'Brasada Ranch',
        medianSale12: 1_412_500,
        medianList: 1_550_000,
        closedCount12: 28,
        saleToOriginal: 0.929,
        cashShare: 0.367,
        lotsForSale: 44,
        lotsAskLow: 100_000,
        lotsAskHigh: 799_000,
      }),
    )
    expect(faqs.map((f) => f.question)).toEqual([
      'How do I find a real estate agent for Brasada Ranch?',
      'How much are homes for sale in Brasada Ranch?',
      'Are there lots for sale in Brasada Ranch?',
      'Where is Brasada Ranch?',
    ])
    expect(faqs[0]?.answer).toBe(
      "Work with a broker who reads Brasada Ranch's own sales, not Powell Butte averages. Ryan Realty is a Bend brokerage (541.703.3095). We can show you any Brasada Ranch listing, and if you're selling, we compare your home with the 28 single-family homes that closed here over the last 12 months. Those homes closed at a median 92.9% of their first list price.",
    )
    expect(faqs[1]?.answer).toBe(
      'As of Oct 8, 2026, single-family homes for sale in Brasada Ranch were asking a median $1,550,000. Homes that actually sold over the last 12 months went for a median $1,412,500, and 36.7% of those buyers paid cash.',
    )
    expect(faqs[2]?.answer).toBe(
      'Yes. On Oct 8, 2026 there were 44 lots for sale in Brasada Ranch, asking from $100,000 to $799,000.',
    )
    expect(faqs[3]?.answer).toMatch(/1,800 acres/)
    expect(
      communityAuthoredFaqs(
        base({ slug: 'brasada-ranch', name: 'Brasada Ranch', lotsForSale: 0 }),
      ).some((f) => f.question.startsWith('Are there lots')),
    ).toBe(false)
    for (const f of faqs) expect(f.answer).not.toMatch(/\u2014|\u2013| -- /)
  })

  it('Black Butte Ranch uses the FAQ/Dataset count and replaces the generated HOA question', () => {
    const faqs = communityAuthoredFaqs(
      base({
        slug: 'black-butte-ranch',
        name: 'Black Butte Ranch',
        medianSale12: 1_060_000,
        medianList: 1_190_000,
        closedCount12: 34,
        saleToOriginal: 0.901,
        activeSfr: 29,
        hoaMonthly: 549,
        hoaAnnual: 6588,
        hoaReported: 184,
      }),
    )
    expect(faqs[0]?.question).toBe('How many homes are for sale in Black Butte Ranch?')
    expect(faqs[0]?.answer).toBe(
      'On Oct 8, 2026, 29 single-family homes were for sale in Black Butte Ranch, asking a median $1,190,000. Over the last 12 months 34 sold, at a median $1,060,000 and a median 90.1% of their first list price.',
    )
    expect(faqs[1]?.question).toBe('What are HOA dues in Black Butte Ranch?')
    expect(faqs[1]?.answer).toBe(
      'Detached Black Butte Ranch listings that reported dues since October 2023 show a median of $549 a month ($6,588 a year), across 184 listings. Dues vary by property, so confirm the current amount with the association before you buy.',
    )
    expect(dropsGeneratedHoaQuestion(faqs)).toBe(true)
    expect(isGeneratedHoaQuestion('Does Black Butte Ranch have an HOA?')).toBe(true)
  })

  it('Tetherow membership and HOA match the brief', () => {
    const faqs = communityAuthoredFaqs(
      base({
        slug: 'tetherow',
        name: 'Tetherow',
        medianSale12: 2_257_500,
        medianList: 2_747_500,
        closedCount12: 30,
        saleToOriginal: 0.969,
        activeSfr: 12,
        hoaMonthly: 171,
        hoaAnnual: 2052,
        hoaReported: 132,
        membershipOfficePhone: '844-431-9701',
        membershipTierCount: 3,
      }),
    )
    expect(faqs[0]?.answer).toBe(
      'On Oct 8, 2026, 12 single-family homes were for sale in Tetherow at a median asking price of $2,747,500. Over the last 12 months 30 sold, at a median $2,257,500 and a median 96.9% of their first list price.',
    )
    expect(faqs[1]?.answer).toBe(
      "Tetherow offers three membership tiers, and golf membership is typically waitlisted. We don't publish membership prices because the club sets them and they change. Call Tetherow's membership office at 844-431-9701 for current rates.",
    )
    expect(faqs[2]?.answer).toBe(
      'Detached Tetherow listings that reported dues since October 2023 show a median of $171 a month ($2,052 a year), across 132 listings. Club membership is separate. Confirm the current HOA amount with the association before you buy.',
    )
    expect(faqs[3]?.answer).toMatch(/Bend's west side/)
  })

  it('Broken Top type-rail Q2 drops a zero clause', () => {
    const faqs = communityAuthoredFaqs(
      base({
        slug: 'broken-top',
        name: 'Broken Top',
        medianSale12: 1_725_000,
        medianList: 2_595_000,
        closedCount12: 27,
        saleToOriginal: 0.958,
        townhomesForSale: 6,
        lotsForSale: 1,
        hoaMonthly: 231,
        hoaAnnual: 2772,
        hoaReported: 123,
        membershipOfficePhone: '541.383.8200',
      }),
    )
    expect(faqs[0]?.answer).toBe(
      'On Oct 8, 2026, single-family homes for sale in Broken Top were asking a median $2,595,000. Over the last 12 months 27 sold, at a median $1,725,000 and a median 95.8% of their first list price.',
    )
    expect(faqs[1]?.answer).toBe(
      'Yes. On Oct 8, 2026 Broken Top had 6 townhomes or condos and 1 lot for sale alongside its houses.',
    )
    expect(
      communityAuthoredFaqs(
        base({
          slug: 'broken-top',
          name: 'Broken Top',
          medianList: 2_595_000,
          townhomesForSale: 6,
          lotsForSale: 0,
        }),
      ).find((f) => f.question.startsWith('Are there townhomes'))?.answer,
    ).toBe('Yes. On Oct 8, 2026 Broken Top had 6 townhomes or condos for sale alongside its houses.')
    expect(faqs[2]?.answer).toMatch(/541\.383\.8200/)
  })
})

describe('stockRailAsk', () => {
  it('counts for-sale rows and the ask range, skipping under contract', () => {
    expect(
      stockRailAsk([
        { price: 100_000, standardStatus: 'Active' },
        { price: 799_000, standardStatus: 'Active' },
        { price: 50_000, standardStatus: 'Active Under Contract' },
      ]),
    ).toEqual({ forSale: 2, low: 100_000, high: 799_000 })
    expect(stockRailAsk([])).toEqual({ forSale: 0, low: null, high: null })
  })
})

describe('communityAnswerMarketLink', () => {
  it('uses the community report unless that URL redirects away', () => {
    expect(
      communityAnswerMarketLink({
        name: 'Brasada Ranch',
        cityName: 'Powell Butte',
        citySlug: 'powell-butte',
        communityMarketHref: '/housing-market/powell-butte/brasada-ranch',
        cityReportHref: '/housing-market/powell-butte',
      }),
    ).toEqual({
      label: 'Brasada Ranch market report',
      href: '/housing-market/powell-butte/brasada-ranch',
    })
    expect(
      communityAnswerMarketLink({
        name: 'Tetherow',
        cityName: 'Bend',
        citySlug: 'bend',
        communityMarketHref: '/housing-market/bend/tetherow',
        cityReportHref: '/housing-market/bend',
      }),
    ).toEqual({ label: 'Bend market report', href: '/housing-market/bend' })
  })
})
