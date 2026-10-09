/**
 * The crawlable copy on /tools/seller-net-sheet, word for word at the Oct 8,
 * 2026 example (brief sections 3, 5, 7 and accept tests 3, 6, 7, 9).
 */
import { describe, expect, it } from 'vitest'
import { COST_TO_SELL_INPUTS } from '@/lib/blog/cost-to-sell-inputs'
import { netSheetExample } from '@/lib/tools/seller-net-sheet'
import { netSheetCopy } from './net-sheet-copy'

const ex = netSheetExample(COST_TO_SELL_INPUTS.medianSalePrice, COST_TO_SELL_INPUTS.figuresAsOf)!
const copy = netSheetCopy(ex)
const everything = [
  copy.answer,
  copy.intro,
  copy.caption,
  copy.lowHeader,
  copy.highHeader,
  ...copy.rows.flatMap((r) => [r.line, r.low, r.high]),
  copy.taxNote,
  copy.whereFrom,
  ...copy.faqs.flatMap((f) => [f.question, f.answer]),
  copy.metaDescription,
].join('\n')

describe('net sheet copy at the Oct 8, 2026 median', () => {
  it('answer block (section 3), verbatim', () => {
    expect(copy.answer).toBe(
      "On a $765,000 Bend home, the city's median sale price over the last 12 months, you'd walk away with about $737,050 before paying off your mortgage, or about $717,925 if you agree to cover an illustrative 2.5% for the buyer's agent. That's the price minus our 3% listing fee ($22,950), about $3,215 for the owner's title policy, your half of escrow, the lien search, and recording your mortgage release, and an illustrative $1,785 property-tax share for an Oct 30 closing, and Deschutes County charges no transfer tax.",
    )
  })

  it('worked-example intro and caption (section 5), verbatim', () => {
    expect(copy.intro).toBe(
      "Here is the net sheet for a $765,000 sale, Bend's median single-family sale price over the last 12 months in Oregon Data Share MLS data as of Oct 8, 2026, closing Oct 30, 2026, with one mortgage to release and the 2026\u201327 tax bill not yet paid. The buyer's-agent line is shown both ways because it's negotiated offer by offer.",
    )
    expect(copy.caption).toBe('Seller net sheet on a $765,000 Bend sale, as of Oct 8, 2026')
    expect(copy.highHeader).toBe('You cover 2.5% (illustrative)')
  })

  it('table rows (section 5)', () => {
    const byLine = Object.fromEntries(copy.rows.map((r) => [r.line, [r.low, r.high]]))
    expect(byLine['Sale price']).toEqual(['$765,000', '$765,000'])
    expect(byLine['Ryan Realty listing fee, 3%']).toEqual(['\u2212$22,950', '\u2212$22,950'])
    expect(byLine["Buyer's-agent compensation"]).toEqual(['$0', '\u2212$19,125 (illustrative)'])
    expect(byLine["Owner's title policy, standard coverage"]).toEqual(['\u2212$1,748', '\u2212$1,748'])
    expect(byLine['Escrow fee, your half (2023 rate card, ask for a current quote)']).toEqual(['\u2212$1,340', '\u2212$1,340'])
    expect(byLine['Local government lien search']).toEqual(['\u2212$25', '\u2212$25'])
    expect(byLine['Recording your mortgage release (1 page)']).toEqual(['\u2212$102', '\u2212$102'])
    expect(byLine['Transfer tax']).toEqual(['$0', '$0'])
    expect(byLine['Cost of the sale']).toEqual(['\u2212$26,165 (3.4%)', '\u2212$45,290 (5.9%)'])
    expect(byLine['Property tax, your share Jul 1\u2013Oct 30 (illustrative)']).toEqual(['\u2212$1,785', '\u2212$1,785'])
    expect(byLine['Net before your loan payoff']).toEqual(['$737,050', '$717,925'])
  })

  it('below-table notes (section 5), verbatim', () => {
    expect(copy.taxNote).toBe(
      "The property-tax line is illustrative. It assumes a $5,340 annual bill, which is the $765,000 price at Deschutes County's 0.698% average effective rate, and 122 of 365 days in the July-through-June tax year. Use your own bill from DIAL. If you've already paid the year in full, the buyer's share comes back to you as a credit instead. HOA transfer fees, credits to the buyer, and repairs come out too, if you agree to them. Oregon withholding for nonresident sellers is a tax prepayment, not a cost.",
    )
    expect(copy.whereFrom).toBe(
      "Where the numbers come from: the 3% is our listing fee. The owner's title premium is the rate filed for Oregon by the Oregon Title Insurance Rating Organization (effective Sept. 1, 2025), so every title company charges the same premium. The escrow fee is from Deschutes County Title's published rate card (revised March 2023), split 50/50 by local custom, so ask for a current quote. Recording is the Deschutes County Clerk's fee effective July 1, 2026. Oregon law (ORS 306.815) bars new local transfer taxes. The 2.5% is an example, not a standard rate. Commission is negotiable.",
    )
  })

  it('five FAQs (section 7), verbatim', () => {
    expect(copy.faqs.map((f) => f.question)).toEqual([
      'How much will I net if I sell my house in Bend?',
      'What comes out of my proceeds when I sell in Bend?',
      "How much is owner's title insurance on a Bend sale?",
      'Is there a transfer tax when I sell a house in Deschutes County?',
      'How accurate is this net sheet?',
    ])
    expect(copy.faqs[0].answer).toBe(
      "On a $765,000 home, Bend's median sale price over the last 12 months as of Oct 8, 2026, you'd net about $737,050 before your loan payoff if you don't cover the buyer's agent, or about $717,925 if you agree to cover an illustrative 2.5%. That's after our 3% listing fee, about $3,215 in title, escrow, lien search, and recording, and an illustrative $1,785 property-tax share on an Oct 30 closing. Enter your own price, payoff, and tax bill above for your number.",
    )
    expect(copy.faqs[2].answer).toBe(
      "Oregon title premiums are filed rates, so every title company charges the same. A standard owner's policy on a $765,000 sale is $1,748 under the Oregon Title Insurance Rating Organization manual effective Sept. 1, 2025, and in Central Oregon the seller customarily pays it.",
    )
  })

  it('meta description (148 characters at this median)', () => {
    expect(copy.metaDescription).toBe(
      "What you'd net selling a Bend home: a $765,000 sale nets about $737,050 before your loan payoff. Title, escrow, recording, and our 3% fee, itemized.",
    )
    expect(copy.metaDescription.length).toBeLessThanOrEqual(155)
  })

  it('carries every accept-test figure and label', () => {
    for (const s of ['$765,000', '$737,050', '$717,925', '$26,165', '$45,290', '3.4%', '5.9%', '$1,748', '$1,340', '$102', '$1,785', 'illustrative', 'no transfer tax']) {
      expect(everything).toContain(s)
    }
  })

  it('no em dash, never calls a commission typical, and only says "standard rate" to deny it', () => {
    expect(everything).not.toContain('\u2014')
    expect(everything).not.toMatch(/typical/i)
    expect(everything.match(/standard rate/g)).toEqual(['standard rate'])
    expect(everything).toContain('not a standard rate')
    expect(everything).not.toMatch(/NaN|undefined|null/)
  })

  it('takes the right article for other prices and closing months', () => {
    const c = netSheetCopy(netSheetExample(812_000, '2026-11-02')!)
    expect(c.answer.startsWith('On an $812,000 Bend home')).toBe(true)
    expect(c.answer).toContain('for a Nov 30 closing')
  })
})
