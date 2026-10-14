import fs from 'fs'
import path from 'path'
import { describe, expect, it } from 'vitest'
import {
  COMMISSION_ANSWER,
  COMMISSION_CONTENT,
  COMMISSION_FAQS,
  COMMISSION_SEO_DESCRIPTION,
  COMMISSION_SEO_TITLE,
  commissionFigures,
  commissionSeed,
} from './real-estate-commission'
import { costToSellFigures } from './cost-to-sell'
import { extractBlogFaq } from '@/lib/blog/publish-blog-faq'
import { extractAnswerFirst } from '@/app/blog/[slug]/_v3/answer-first'
import { buildBlogArticleView, stripTags } from '@/app/blog/[slug]/_v3/article-view'
import { TITLE_BUDGET } from '@/lib/site/page-metadata'
import { posts as aeoGuides } from '../../scripts/blog-content/aeo-guides-2026-09'

const MIGRATION = path.resolve(
  __dirname,
  '../../supabase/migrations/20261009150000_blog_real_estate_commission_bend.sql',
)

describe('commission guide: figures (brief section 3)', () => {
  it('derives every dollar figure from the cost-to-sell inputs', () => {
    const c = commissionFigures()
    const f = costToSellFigures()
    expect(c.price).toBe(765_000)
    expect(c.listingFee).toBe(22_950)
    expect(c.halfPoint).toBe(3_825)
    expect(c.fixedCosts).toBe(f.fixedCosts)
    expect(c.fixedCosts).toBe(3_215)
    expect(c.fixedShare).toBe('0.42%')
    expect(c.asOf).toBe('Oct 8, 2026')
  })

  it('answer block carries the accept-test strings (brief 9.3)', () => {
    for (const s of ['3%', '$22,950', '$765,000', 'August 17, 2024', 'ORS 696.810', 'negotiable']) {
      expect(COMMISSION_ANSWER).toContain(s)
    }
    const { answerHtml, figuresAsOf, body } = extractAnswerFirst(COMMISSION_CONTENT)
    expect(answerHtml).toContain(COMMISSION_ANSWER)
    expect(figuresAsOf).toBe('2026-10-08')
    expect(body.trimStart().startsWith('<h2>Our listing fee, in dollars</h2>')).toBe(true)
  })
})

describe('commission guide: structure and copy rules', () => {
  it('has the brief H2s in order', () => {
    const view = buildBlogArticleView(extractAnswerFirst(COMMISSION_CONTENT).body)
    expect(view.sections.map((s) => s.label)).toEqual([
      'Our listing fee, in dollars',
      "Who pays the buyer's agent now",
      'What Oregon law requires in writing',
      'What you pay besides commission',
      'How to compare agents on fees',
      'Questions',
      'Sources',
    ])
  })

  it('FAQPage has exactly the 7 visible questions, word for word', () => {
    const items = extractBlogFaq(COMMISSION_CONTENT)
    expect(items).toHaveLength(7)
    items.forEach((item, i) => {
      expect(item.question).toBe(COMMISSION_FAQS[i].question)
      expect(item.answer).toBe(COMMISSION_FAQS[i].answer)
    })
  })

  it('quotes no typical, average, or standard rate (brief 9.5)', () => {
    const text = stripTags(COMMISSION_CONTENT).toLowerCase()
    for (const bad of ['typical', 'average', 'standard rate', 'usually charge', ' 5%', '5.5%', '6%']) {
      expect(text, bad).not.toContain(bad)
    }
  })

  it('dates the Oregon law Jan 1, 2025 and the NAR changes Aug 17, 2024 (brief 9.7)', () => {
    const text = stripTags(COMMISSION_CONTENT)
    expect(text).toContain('in effect since January 1, 2025')
    expect(text).not.toMatch(/Oregon[^.]*in 2024 with House Bill/)
    expect(text).toContain('August 17, 2024')
  })

  it('links only the brief list: our pages plus nar.realtor, oregonlegislature.gov, oregon.gov, oregon.legal', () => {
    const internal = new Set([
      '/housing-market/bend', '/tools/seller-net-sheet', '/blog/buyers-agent-bend-buyer-broker-agreement',
      '/blog/cost-to-sell-house-bend-oregon', '/about', '/sell', '/sell/valuation',
    ])
    for (const [, href] of COMMISSION_CONTENT.matchAll(/href="([^"]*)"/g)) {
      if (href.startsWith('/')) expect(internal, href).toContain(href)
      else expect(href, href).toMatch(/^https:\/\/(www\.)?(nar\.realtor|oregonlegislature\.gov|oregon\.gov|oregon\.legal)\//)
    }
    expect(COMMISSION_CONTENT).not.toMatch(/clever|sunnyinbend|byowner|anytimeestimate|redfin|zillow/i)
  })

  it('has no em dash, and the title and meta fit', () => {
    const seed = commissionSeed()
    for (const v of [seed.title, seed.seo_title, seed.seo_description, seed.excerpt, seed.content]) {
      expect(v).not.toContain('\u2014')
    }
    expect(COMMISSION_SEO_TITLE.length).toBeLessThanOrEqual(TITLE_BUDGET)
    expect(COMMISSION_SEO_DESCRIPTION.length).toBeLessThanOrEqual(155)
  })
})

describe('commission guide: publishing path', () => {
  it('is seeded from aeo-guides-2026-09', () => {
    const post = aeoGuides.find((p) => p.slug === 'real-estate-commission-bend-oregon')
    expect(post).toEqual(commissionSeed())
  })

  it('the migration inserts the same body, title, and meta the seed carries', () => {
    const sql = fs.readFileSync(MIGRATION, 'utf8')
    const body = sql.match(/\$cm\$([\s\S]*?)\$cm\$/)?.[1]
    expect(body).toBe(COMMISSION_CONTENT)
    const seed = commissionSeed()
    for (const v of [seed.title, seed.seo_title, seed.seo_description, seed.excerpt, seed.published_at]) {
      expect(sql).toContain(`'${v.replace(/'/g, "''")}'`)
    }
  })

  it('fixes the buyer-agent law date in the seed', () => {
    const post = aeoGuides.find((p) => p.slug === 'buyers-agent-bend-buyer-broker-agreement')!
    expect(post.content).toContain(
      'Oregon wrote the same requirement into state law with House Bill 4058, passed in 2024 and in effect since January 1, 2025 (ORS 696.810)',
    )
    expect(post.content).not.toContain('state law in 2024 with House Bill 4058')
  })
})
