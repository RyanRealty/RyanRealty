/**
 * AIV #1 accept tests that can be held in code (SEO & AEO Desk brief
 * 2026-10-08, section 8). Live-only checks (preview URL, HTTP 200 on links,
 * Lighthouse) are run against the preview and reported on the PR.
 */
import { describe, expect, it } from 'vitest'
import {
  COST_TO_SELL_ANSWER,
  COST_TO_SELL_CONTENT,
  COST_TO_SELL_FAQS,
  COST_TO_SELL_INPUTS,
  COST_TO_SELL_SEO_DESCRIPTION,
  COST_TO_SELL_SLUG,
  costToSellFigures,
  costToSellSeed,
  otiroStandardOwnersPolicy,
} from '@/lib/blog/cost-to-sell'
import { extractBlogFaq } from '@/lib/blog/publish-blog-faq'
import { extractAnswerFirst } from '@/app/blog/[slug]/_v3/answer-first'
import { buildBlogArticleView, stripTags } from '@/app/blog/[slug]/_v3/article-view'
import { posts as aeoGuides } from '../../scripts/blog-content/aeo-guides-2026-09'

const text = stripTags(COST_TO_SELL_CONTENT)

describe('cost to sell: worked example math (accept test 4)', () => {
  const f = costToSellFigures()

  it('prices at the 12-month median the brief names', () => {
    expect(COST_TO_SELL_INPUTS.medianSalePrice).toBe(765_000)
    expect(COST_TO_SELL_INPUTS.figuresAsOf).toBe('2026-10-08')
  })

  it('reproduces every line of the brief table', () => {
    expect(f.listingFee).toBe(22_950)
    expect(f.buyerAgentIllustrative).toBe(19_125)
    expect(f.ownersTitlePolicy).toBe(1_748)
    expect(f.lienSearch).toBe(25)
    expect(f.escrowSellerHalf).toBe(1_340)
    expect(f.recordingRelease).toBe(102)
    expect(f.transferTax).toBe(0)
    expect(f.totalWithoutBuyerAgent).toBe(26_165)
    expect(f.totalWithBuyerAgent).toBe(45_290)
    expect(f.fixedCosts).toBe(3_215)
    expect(f.annualTaxIllustrative).toBe(5_340)
    expect(f.prorationIllustrative).toBe(1_785)
    expect((f.totalWithoutBuyerAgent / f.price) * 100).toBeCloseTo(3.42, 2)
    expect((f.totalWithBuyerAgent / f.price) * 100).toBeCloseTo(5.92, 2)
  })

  it('applies OTIRO Schedule One with its fraction-of-a-thousand rule', () => {
    expect(otiroStandardOwnersPolicy(765_000)).toBe(1_748)
    expect(otiroStandardOwnersPolicy(645_000)).toBe(1_568)
    expect(otiroStandardOwnersPolicy(500_001)).toBe(1_352)
    expect(() => otiroStandardOwnersPolicy(450_000)).toThrow()
  })

  it('renders a semantic table with the brief caption and totals', () => {
    expect(COST_TO_SELL_CONTENT).toContain(
      '<caption>Seller costs on a $765,000 Bend sale, as of Oct 8, 2026</caption>',
    )
    expect(COST_TO_SELL_CONTENT).toMatch(/<table>[\s\S]*<thead>[\s\S]*<tbody>[\s\S]*<tfoot>[\s\S]*<\/table>/)
    expect(COST_TO_SELL_CONTENT).toContain(
      '<tr><th scope="row">Total cost of the sale</th><td>$26,165</td><td>$45,290</td></tr>',
    )
    expect(COST_TO_SELL_CONTENT).toContain(
      '<tr><th scope="row">Share of price</th><td>3.4%</td><td>5.9%</td></tr>',
    )
  })
})

describe('cost to sell: answer-first block (accept test 2)', () => {
  const lifted = extractAnswerFirst(COST_TO_SELL_CONTENT)

  it('is the first thing in the body and carries the as-of day', () => {
    expect(lifted.answerHtml).toContain(COST_TO_SELL_ANSWER)
    expect(lifted.figuresAsOf).toBe('2026-10-08')
    expect(lifted.body.trim().startsWith('<p>Sellers compare cost')).toBe(true)
  })

  it('is the brief copy word for word', () => {
    expect(COST_TO_SELL_ANSWER).toBe(
      "Selling a $765,000 home in Bend, which is the city's median sale price over the last 12 months, costs about $26,200 to $45,300, or 3.4% to 5.9% of the price, before your loan payoff and property-tax proration. The low end is our 3% listing fee plus about $3,200 for the owner's title policy, your half of escrow, the lien search, and recording the release of your mortgage. The high end adds 2.5% if you agree to cover the buyer's agent, an illustrative figure because that fee is negotiated offer by offer, and Deschutes County charges no transfer tax. To the dollar, the table below totals $26,165 to $45,290, including $1,748 for the owner's title policy.",
    )
    for (const needle of [
      '$765,000', '$26,200 to $45,300', '3.4% to 5.9%', 'illustrative', 'no transfer tax',
      '$26,165 to $45,290', '$1,748',
    ]) {
      expect(COST_TO_SELL_ANSWER).toContain(needle)
    }
    expect(lifted.answerHtml).toContain(
      'Median: Ryan Realty, Oregon Data Share MLS, single-family, as of Oct 8, 2026 (<a href="/housing-market/bend">Bend housing market</a>). Line-item sources are under the table below.',
    )
  })
})

describe('cost to sell: illustrative labels and traceability (accept tests 5, 6)', () => {
  it('labels the 2.5% column and cell and the proration illustrative', () => {
    expect(COST_TO_SELL_CONTENT).toContain('<th scope="col">If you cover 2.5% (illustrative)</th>')
    expect(COST_TO_SELL_CONTENT).toContain('<td>$19,125 (illustrative)</td>')
    expect(text).toMatch(/would be about \$1,785\. That is illustrative/)
  })

  it('never calls the buyer-agent figure typical, standard, or average', () => {
    expect(text).not.toMatch(/(typical|standard|average)[^.]{0,40}2\.5%|2\.5%[^.]{0,40}(typical|average)/i)
    expect(text).toContain('The 2.5% is an example, not a standard rate.')
  })

  it('prints only figures traced in the brief ledger', () => {
    const traced = new Set([
      '$765,000', '$26,200', '$45,300', '$3,200', '$22,950', '$0', '$19,125', '$1,748', '$25',
      '$1,340', '$2,679', '$102', '$5', '$26,165', '$45,290', '$3,215', '$5,340', '$1,785', '$1',
      '$1,000',
    ])
    const tracedPct = new Set(['3%', '2.5%', '3.4%', '5.9%'])
    for (const d of text.match(/\$\d{1,3}(?:,\d{3})*/g) ?? []) expect(traced, d).toContain(d)
    for (const p of text.match(/\d+(?:\.\d+)?%/g) ?? []) expect(tracedPct, p).toContain(p)
  })

  it('says the escrow figure is from a 2023 card and to get a current quote', () => {
    expect(text).toContain("Deschutes County Title's published rate card (revised March 2023)")
    expect(text).toContain('so ask for a current quote')
  })
})

describe('cost to sell: desk review 2026-10-08 (PR #429)', () => {
  it('drops the combined-commission calculator sentence', () => {
    expect(text).not.toMatch(/online calculators|combined commission/i)
    expect(text).toContain(
      "Your number depends on whether, and how much, you agree to cover the buyer's agent in the offer you accept.",
    )
  })

  it('carries the title figure and the exact totals in the table as well as the answer block', () => {
    expect(COST_TO_SELL_CONTENT).toContain(
      '<tr><th scope="row">Owner\'s title policy, standard coverage</th><td>$1,748</td><td>$1,748</td></tr>',
    )
    expect(COST_TO_SELL_CONTENT).toContain('<td>$26,165</td><td>$45,290</td>')
  })

  it('cites AmeriTitle for the recording wording and the county table for the $25 lien search', () => {
    expect(COST_TO_SELL_CONTENT).toContain(
      'AmeriTitle, Closing Costs: Homeowner Manual (Nov. 2019), for who customarily records the deed and the mortgage release: <a href="https://www.amerititle.com/2019/11/closing-costs-homeowner-manual/"',
    )
    expect(COST_TO_SELL_CONTENT).toContain('\u00a71.008(A) county lien search table, $25 per account in Deschutes')
  })

  it('links the withholding sentence to the live withholding guide', () => {
    expect(COST_TO_SELL_CONTENT).toContain(
      'Our <a href="/blog/oregon-withholding-firpta-home-sellers">withholding guide</a> explains it.',
    )
  })
})

describe('cost to sell: recording sentence (accept test 7)', () => {
  it('no longer says the seller pays to record the deed', () => {
    expect(text).not.toContain('The county charges a recording fee for the deed.')
    expect(text).toContain(
      "Deschutes County charges $102 to record the first page of a document, $5 for each additional page. On the seller's side that's usually the release of your mortgage; the deed itself is normally recorded on the buyer's side. Contract terms control.",
    )
  })
})

describe('cost to sell: FAQ (accept test 8)', () => {
  it('has exactly eight questions and the visible block matches FAQPage word for word', () => {
    const faq = extractBlogFaq(COST_TO_SELL_CONTENT)
    expect(faq).toHaveLength(8)
    expect(faq).toEqual(COST_TO_SELL_FAQS.map((q) => ({ question: q.question, answer: q.answer })))
  })

  it('carries the brief copy for the replaced and new questions', () => {
    expect(COST_TO_SELL_FAQS[0].answer).toBe(
      "On a $765,000 home, Bend's median sale price over the last 12 months as of Oct 8, 2026, the sale costs about $26,165 (3.4%) with our 3% listing fee if you don't cover the buyer's agent, or about $45,290 (5.9%) if you agree to cover an illustrative 2.5%. Title, escrow, the lien search, and recording add about $3,215 of that. Your loan payoff and prorated property taxes come out of proceeds too, and we itemize all of it on a seller net sheet before you accept an offer.",
    )
    expect(COST_TO_SELL_FAQS[5].answer).toBe(
      "Oregon title premiums are filed rates, so every title company charges the same. A standard owner's policy on a $765,000 sale is $1,748 under the Oregon Title Insurance Rating Organization manual effective Sept. 1, 2025, and in Central Oregon the seller customarily pays it.",
    )
    expect(COST_TO_SELL_FAQS[6].answer).toBe(
      "Deschutes County Title's published rate card (revised March 2023) lists a $2,679 sale escrow fee at $765,000. The fee is customarily split 50/50, so the seller's share is about $1,340. Ask the escrow company for a current quote, because the contract decides the split.",
    )
  })
})

describe('cost to sell: links, names, regressions (accept tests 10, 11, 12)', () => {
  it('never links the seller net sheet tool (404) and links only the brief list internally', () => {
    expect(COST_TO_SELL_CONTENT).not.toContain('/tools/seller-net-sheet')
    const allowed = new Set([
      '/housing-market/bend', '/blog/property-taxes-deschutes-county', '/blog/hoa-guide-central-oregon',
      '/blog/oregon-withholding-firpta-home-sellers', '/blog/preparing-home-for-sale-checklist',
      '/blog/buyers-agent-bend-buyer-broker-agreement', '/blog/closing-costs-buyers-bend-oregon', '/sell',
      '/sell/valuation', '/team/matthew-ryan',
    ])
    for (const [, href] of COST_TO_SELL_CONTENT.matchAll(/href="(\/[^"]*)"/g)) expect(allowed, href).toContain(href)
  })

  it('links no competitor', () => {
    expect(COST_TO_SELL_CONTENT).not.toMatch(/netsheet\.org|housesinbendoregon|zillow|redfin/i)
  })

  it('has no em dash anywhere in the public copy or meta', () => {
    const seed = costToSellSeed()
    for (const value of [seed.title, seed.seo_title, seed.seo_description, seed.excerpt, seed.content]) {
      expect(value).not.toContain('\u2014')
      expect(value).not.toMatch(/ -- /)
    }
  })

  it('keeps every live H2, the 3% plan copy, the transfer-tax line, slug, and title', () => {
    const view = buildBlogArticleView(extractAnswerFirst(COST_TO_SELL_CONTENT).body)
    const labels = view.sections.map((s) => s.label)
    for (const h2 of [
      'The big buckets', 'Listing fee versus buyer-agent compensation', 'Title, escrow, and recording',
      'Prorations, payoffs, and the HOA', 'Prep, marketing, and what is included',
      'What the settlement statement looks like', 'Questions', 'Next step',
    ]) {
      expect(labels).toContain(h2)
    }
    expect(labels.indexOf("A worked example at Bend's median price")).toBe(labels.indexOf('The big buckets') + 1)
    expect(text).toContain('Our listing fee is 3% of the sale price with no add-on fees')
    expect(text).toContain(
      'Oregon has no state real estate transfer tax outside of Washington County, so in Deschutes County that line is zero.',
    )
    const seed = costToSellSeed()
    expect(seed.slug).toBe(COST_TO_SELL_SLUG)
    expect(seed.title).toBe('What It Costs to Sell a House in Bend (and Oregon)')
    expect(seed.seo_title).toBe('Cost to Sell a House in Bend, Oregon')
    expect(seed.published_at).toBe('2026-09-07T16:00:00Z')
  })

  it('keeps the meta description inside 155 characters', () => {
    expect(COST_TO_SELL_SEO_DESCRIPTION.length).toBeLessThanOrEqual(155)
  })

  it('is the row the AEO guide pack seeds, exactly once', () => {
    const rows = aeoGuides.filter((p) => p.slug === COST_TO_SELL_SLUG)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toEqual(costToSellSeed())
  })
})
