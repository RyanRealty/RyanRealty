import { describe, expect, it } from 'vitest'
import { extractBlogFaq, publishBlogFaq } from '@/lib/blog/publish-blog-faq'
import {
  BUYER_CLOSING_COSTS_CONTENT,
  BUYER_CLOSING_COSTS_FAQS,
  BUYER_CLOSING_COSTS_H1,
  BUYER_CLOSING_COSTS_HREF,
  BUYER_CLOSING_COSTS_LEGACY_SLUG,
  BUYER_CLOSING_COSTS_SLUG,
  BUYER_CLOSING_COSTS_TITLE,
  buyerClosingCostsDollarFigures,
  buyerClosingCostsInventedTotal,
  buyerClosingCostsPercentFigures,
  buyerClosingCostsSeed,
  buyerClosingCostsSourcedAllowlist,
} from '@/lib/blog/buyer-closing-costs'
import { AEO_HUB_GUIDES, AEO_HUB_OMIT, AEO_HUB_TIP_MINS } from '@/lib/seo/aeo-hub-guides'
import aiQueryMap from '@/lib/seo/ai-query-map.json'

describe('SITE-124 buyer closing costs — 12 Tip Ready tests', () => {
  it('1. publishes the SEO Desk slug', () => {
    expect(BUYER_CLOSING_COSTS_SLUG).toBe('closing-costs-buyers-bend-oregon')
    expect(BUYER_CLOSING_COSTS_HREF).toBe('/blog/closing-costs-buyers-bend-oregon')
    expect(buyerClosingCostsSeed().slug).toBe(BUYER_CLOSING_COSTS_SLUG)
  })

  it('2. keeps title and H1 the same published sentence', () => {
    expect(BUYER_CLOSING_COSTS_TITLE).toBe('Closing Costs for Home Buyers in Bend, Oregon')
    expect(BUYER_CLOSING_COSTS_H1).toBe(BUYER_CLOSING_COSTS_TITLE)
    expect(buyerClosingCostsSeed().title).toBe(BUYER_CLOSING_COSTS_H1)
  })

  it('3. keeps the 2026 seo title without inventing a cash-to-close total', () => {
    expect(buyerClosingCostsSeed().seo_title).toBe('Closing Costs for Buyers in Bend, Oregon (2026)')
    expect(buyerClosingCostsSeed().seo_description).not.toMatch(/\$\d{2,}/)
  })

  it('4. ships exactly five FAQ pairs under Questions', () => {
    const items = extractBlogFaq(BUYER_CLOSING_COSTS_CONTENT)
    expect(items).toHaveLength(5)
    expect(BUYER_CLOSING_COSTS_FAQS).toHaveLength(5)
  })

  it('5. locks the five FAQ questions from the brief', () => {
    expect(extractBlogFaq(BUYER_CLOSING_COSTS_CONTENT).map((item) => item.question)).toEqual(
      BUYER_CLOSING_COSTS_FAQS.map((item) => item.question),
    )
  })

  it('6. keeps FAQ answers on the page, not a summary', () => {
    const items = extractBlogFaq(BUYER_CLOSING_COSTS_CONTENT)
    for (const [index, item] of items.entries()) {
      expect(item.answer.length).toBeGreaterThan(40)
      expect(item.answer).toBe(BUYER_CLOSING_COSTS_FAQS[index]?.answer)
    }
  })

  it('7. FAQPage JSON-LD is the same five answers', () => {
    expect(publishBlogFaq(BUYER_CLOSING_COSTS_CONTENT)).toEqual({
      type: 'faqPage',
      items: [...BUYER_CLOSING_COSTS_FAQS],
    })
  })

  it('8. every dollar figure is on the §0 allowlist', () => {
    const allow = buyerClosingCostsSourcedAllowlist()
    for (const figure of buyerClosingCostsDollarFigures()) {
      expect(allow.has(figure), figure).toBe(true)
    }
  })

  it('9. every percent figure is on the §0 allowlist', () => {
    const allow = buyerClosingCostsSourcedAllowlist()
    for (const figure of buyerClosingCostsPercentFigures()) {
      expect(allow.has(figure), figure).toBe(true)
    }
  })

  it('10. does not invent a percent-of-price closing-cost total', () => {
    expect(buyerClosingCostsInventedTotal()).toBe(false)
    expect(BUYER_CLOSING_COSTS_CONTENT).not.toMatch(/2\s*[–-]\s*5\s*%/)
  })

  it('11. /buy and the buy tip-min floor crawlably link the live slug', () => {
    const buy = AEO_HUB_GUIDES.buy.find((guide) => guide.href === BUYER_CLOSING_COSTS_HREF)
    expect(buy?.title).toBe(BUYER_CLOSING_COSTS_TITLE)
    expect(AEO_HUB_TIP_MINS.buy).toContain(BUYER_CLOSING_COSTS_HREF)
    expect(AEO_HUB_OMIT).not.toContain(BUYER_CLOSING_COSTS_HREF)
  })

  it('12. llms / AI query map cites the survivor, and the old slug is the hop', () => {
    const pillar = aiQueryMap.pillars.find(
      (row) => row.path === BUYER_CLOSING_COSTS_HREF,
    )
    expect(pillar?.label).toBe(BUYER_CLOSING_COSTS_TITLE)
    const query = aiQueryMap.queries.find((row) => row.id === 'buyer-closing-costs-bend')
    expect(query?.citablePaths).toEqual([BUYER_CLOSING_COSTS_HREF])
    expect(BUYER_CLOSING_COSTS_LEGACY_SLUG).toBe('understanding-closing-costs-oregon')
  })
})
