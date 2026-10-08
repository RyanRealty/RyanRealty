/**
 * /about sourced facts block (SEO & AEO Desk brief, 2026-10-08): the firm's
 * all-area record counts a sale once, the rail's Central Oregon count only
 * rides along as "in Central Oregon", every sentence binds to the live
 * figures, and the 13-question FAQ is one array for the page and FAQPage.
 */
import { describe, expect, it } from 'vitest'
import type { BrokerSaleTile } from '@/lib/data/brokers/getBrokerSales'
import { buildJsonLd } from '@/lib/site/json-ld'
import { firmAllAreaRecord } from '@/app/team/_v3/firm-record'
import { firmClosingRecord } from '@/app/team/[slug]/_v3/sale-rows'
import { aboutFaqItems } from './about-constants'
import {
  aboutDirectAnswer,
  aboutFaqWithRecord,
  aboutFit,
  aboutFreshnessLine,
  aboutMetaDescription,
  aboutRichTextPlain,
  aboutTrackRecord,
  type AboutLiveFigures,
} from './about-record'

function sale(
  key: string,
  day: string,
  price: number,
  city: string,
  postal: string,
  extra: Partial<Record<string, unknown>> = {},
): BrokerSaleTile {
  return {
    ListingKey: key,
    CloseDate: `${day}T00:00:00Z`,
    ClosePrice: price,
    City: city,
    PostalCode: postal,
    PropertyType: 'A',
    property_sub_type: 'Single Family Residence',
    SubdivisionName: null,
    saleSide: 'listed',
    ...extra,
  } as unknown as BrokerSaleTile
}

const NOW = new Date('2026-10-08T15:00:00Z')

describe('firm record: one count, once per sale (accept test 5)', () => {
  it('counts a sale both brokers hold once, and a non-977 sale in the total but not the rail', () => {
    const shared = sale('K-SHARED', '2025-11-02', 500_000, 'Bend', '97701')
    const outside = sale('K-OUT', '2025-05-16', 1_020_000, 'Ashland', '97520')
    const matt = [shared, outside, sale('K-1', '2015-04-15', 242_500, 'Bend', '97701')]
    const rebecca = [{ ...shared, saleSide: 'represented-buyer' } as BrokerSaleTile, sale('K-2', '2026-09-18', 950_000, 'Bend', '97703')]
    const record = firmAllAreaRecord(
      [
        { slug: 'matthew-ryan', name: 'A', sales: matt },
        { slug: 'rebecca-peterson', name: 'B', sales: rebecca },
      ],
      NOW,
    )
    expect(record.count).toBe(4)
    expect(record.brokers.map((b) => b.count)).toEqual([3, 2])
    expect(record.centralOregon).toBe(3)
    expect(record.outside).toBe(1)
    expect(record.firstClose).toBe('2015-04-15')
    expect(record.lastClose).toBe('2026-09-18')
    // The rail (977 only) never sees the Ashland sale.
    const rail = firmClosingRecord([...matt, ...rebecca])
    expect(rail.count).toBe(3)
  })

  it('uses the roster window for the last 12 months, counted once', () => {
    const shared = sale('K-SHARED', '2025-11-02', 500_000, 'Bend', '97701')
    const record = firmAllAreaRecord(
      [
        { slug: 'a', name: 'A', sales: [shared, sale('K-OLD', '2025-10-01', 400_000, 'Redmond', '97756')] },
        { slug: 'b', name: 'B', sales: [shared] },
      ],
      NOW,
    )
    expect(record.recent.cutoff).toBe('2025-10-08')
    expect(record.recent.count).toBe(1)
    expect(record.brokers.map((b) => b.recent)).toEqual([1, 1])
  })

  it('ignores rows with no close date, no price, or no ListingKey', () => {
    const record = firmAllAreaRecord(
      [
        {
          slug: 'a',
          name: 'A',
          sales: [
            sale('K-1', '2024-01-01', 300_000, 'Bend', '97701'),
            { ...sale('K-2', '2024-01-01', 0, 'Bend', '97701') },
            { ...sale('K-3', '2024-01-01', 300_000, 'Bend', '97701'), CloseDate: null } as BrokerSaleTile,
            { ...sale('', '2024-01-01', 300_000, 'Bend', '97701') },
          ],
        },
      ],
      NOW,
    )
    expect(record.count).toBe(1)
  })
})

/** The shape of the live record on 2026-10-08 (26 / 25 / 8). */
function liveLike(): AboutLiveFigures {
  const tiles: BrokerSaleTile[] = []
  let i = 0
  const add = (n: number, city: string, day: string, price: number, extra: Partial<Record<string, unknown>> = {}) => {
    for (let k = 0; k < n; k += 1) tiles.push(sale(`K${(i += 1)}`, day, price, city, city === 'Ashland' ? '97520' : '97701', extra))
  }
  add(1, 'Bend', '2015-04-15', 242_500)
  add(1, 'Bend', '2026-05-20', 3_025_000, { SubdivisionName: 'Vandevert Ranch' })
  add(1, 'La Pine', '2024-10-10', 92_034, { property_sub_type: 'Manufactured On Land' })
  add(1, 'La Pine', '2024-06-10', 110_000, { property_sub_type: 'Manufactured On Land' })
  add(2, 'Prineville', '2024-11-10', 360_000, { property_sub_type: 'Manufactured On Land' })
  add(1, 'Madras', '2024-05-10', 275_000)
  add(1, 'Ashland', '2025-05-16', 1_020_000)
  add(6, 'Bend', '2026-03-10', 735_000)
  add(1, 'Redmond', '2026-09-10', 665_000)
  add(3, 'Redmond', '2025-08-10', 650_000)
  add(8, 'Bend', '2025-06-10', 700_000)
  const record = firmAllAreaRecord([{ slug: 'matthew-ryan', name: 'Founder Person', sales: tiles }], NOW)
  return {
    record,
    centralOregonListed: 25,
    reviews: { average: 5, count: 25, newest: '2026-07-10' },
    brokerCount: 3,
    asOf: '2026-10-08',
  }
}

describe('direct answer (accept test 2)', () => {
  it('carries every sourced fact from the live figures', () => {
    const live = liveLike()
    const answer = aboutDirectAnswer(live)
    for (const needle of [
      'founded it in 2014',
      'June 2023',
      '201206613',
      '26 recorded MLS closings',
      'April 2015 to September 2026',
      '5.0',
      '25 reviews',
      '3%',
      'no add-on fees',
      'as of October 8, 2026',
    ]) {
      expect(answer, needle).toContain(needle)
    }
    expect(aboutFreshnessLine(live)).toBe('Updated Oct 8, 2026 · Figures as of Oct 8, 2026')
    expect(aboutMetaDescription(live)).toBe(
      'Bend, Oregon brokerage founded in 2014. 26 recorded MLS closings since 2015, 5.0 from 25 Google reviews, and a 3% listing fee with no add-ons.',
    )
  })

  it('drops a figure that did not load instead of guessing it', () => {
    const answer = aboutDirectAnswer({ ...liveLike(), record: null, reviews: null })
    expect(answer).not.toMatch(/closings|reviews/)
    expect(answer).toContain('founded it in 2014')
  })
})

describe('fit and track record sections (accept tests 4, 11, 12)', () => {
  it('prints five good-fit and four not-a-fit bullets from the live record', () => {
    const fit = aboutFit(liveLike())
    expect(fit.good).toHaveLength(5)
    expect(fit.notFit).toHaveLength(4)
    expect(fit.good.join(' ')).toContain('from $92,034 in La Pine to $3,025,000 in Vandevert Ranch')
    expect(fit.good.join(' ')).toContain('Four of our recorded closings are manufactured homes.')
    expect(fit.notFit.join(' ')).toContain('Ryan Realty is three brokers')
    expect(fit.notFit.join(' ')).toContain('26 recorded closings since 2015 and 8 in the last 12 months')
    expect(fit.notFit.join(' ')).toContain('inside Sisters or Sunriver')
  })

  it('states the headline count and names 25 only as the Central Oregon rail', () => {
    const items = aboutTrackRecord(liveLike())
    const text = items.map((i) => `${i.term}: ${aboutRichTextPlain(i.body)}`).join('\n')
    expect(text).toContain('Recorded closings: 26, from April 2015 to September 2026. Founder Person 26. 25 are in Central Oregon and listed above.')
    expect(text).toContain('Last 12 months: 8 closings, Founder Person 8.')
    expect(text).toContain('and 1 outside Central Oregon.')
    expect(text).toContain('The highest was $3,025,000 in Vandevert Ranch in May 2026.')
    expect(text).toContain('(registered business name)')
    expect(text).not.toMatch(/firm license|Clients served/i)
  })

  it('names no competitor or portal, makes no self-ranking, and uses no em dash', () => {
    const live = liveLike()
    const fit = aboutFit(live)
    const copy = [
      aboutDirectAnswer(live),
      ...fit.good,
      ...fit.notFit,
      ...aboutTrackRecord(live).map((i) => aboutRichTextPlain(i.body)),
    ].join('\n')
    expect(copy).not.toMatch(/Zillow|Redfin|Compass|Yelp|Realtor\.com|Homes\.com/)
    // "Broken Top" is a Bend neighborhood, not a ranking.
    expect(copy.replace(/Broken Top/g, '')).not.toMatch(/\b(best|#1|top|leading)\b/i)
    expect(copy).not.toContain('\u2014')
  })
})

describe('FAQ: 13 questions, one array (accept test 8)', () => {
  const people = [
    { name: 'Founder Person', title: 'Owner & Principal Broker' },
    { name: 'Second Person', title: 'Broker' },
    { name: 'Third Person', title: 'Broker' },
  ]
  const kept = aboutFaqItems(people, { hours: 'Monday through Saturday, 9:00 am to 5:00 pm Pacific' })
  const faq = aboutFaqWithRecord(kept, liveLike())

  it('runs in the brief order', () => {
    expect(faq.map((q) => q.question)).toEqual([
      'Is Ryan Realty a good brokerage in Bend?',
      'Who is the best realtor in Bend for selling a home?',
      'How many homes has Ryan Realty sold?',
      'Who are the brokers?',
      'How much does Ryan Realty charge to sell a home?',
      "Is Ryan Realty a good choice if I'm selling from out of state?",
      'How do I get a home valuation?',
      'Will I work with the same broker from start to finish?',
      'How quickly will Ryan Realty get back to me?',
      'Where is the Ryan Realty office?',
      'Is Ryan Realty licensed, and how can I check?',
      'Does Ryan Realty work in Redmond, Sisters, and Sunriver?',
      'Do you cover Tumalo?',
    ])
  })

  it('binds the record answers to the live figures', () => {
    const byQ = new Map(faq.map((q) => [q.question, q.answer]))
    expect(byQ.get('Is Ryan Realty a good brokerage in Bend?')).toContain('three-broker brokerage')
    expect(byQ.get('Is Ryan Realty a good brokerage in Bend?')).toContain('26 recorded MLS closings from April 2015 to September 2026')
    expect(byQ.get('Who is the best realtor in Bend for selling a home?')).toContain(
      'our brokers closed 8 homes in the last 12 months as of October 8, 2026, 7 in Bend and 1 in Redmond;',
    )
    expect(byQ.get('How many homes has Ryan Realty sold?')).toContain('25 of them are in Central Oregon')
    expect(byQ.get('How many homes has Ryan Realty sold?')).toContain('Prices range from $92,034 to $3,025,000.')
    expect(byQ.get("Is Ryan Realty a good choice if I'm selling from out of state?")).toContain(
      'Five of our 25 Google reviews, as of October 8, 2026, come from clients',
    )
    expect(byQ.get('Does Ryan Realty work in Redmond, Sisters, and Sunriver?')).toContain(
      "We don't have a recorded closing in Sisters or Sunriver yet",
    )
  })

  it('emits FAQPage with the same 13 strings', () => {
    const ld = buildJsonLd({ type: 'faqPage', items: faq }) as {
      mainEntity: Array<{ name: string; acceptedAnswer: { text: string } }>
    }
    expect(ld.mainEntity).toHaveLength(13)
    expect(ld.mainEntity.map((m) => [m.name, m.acceptedAnswer.text])).toEqual(faq.map((q) => [q.question, q.answer]))
  })

  it('leaves a record question out when the record did not load', () => {
    const lean = aboutFaqWithRecord(kept, { ...liveLike(), record: null })
    expect(lean.map((q) => q.question)).not.toContain('How many homes has Ryan Realty sold?')
    expect(lean.map((q) => q.question)).not.toContain('Does Ryan Realty work in Redmond, Sisters, and Sunriver?')
    expect(lean.map((q) => q.answer).join(' ')).not.toMatch(/recorded MLS closings/)
  })
})
