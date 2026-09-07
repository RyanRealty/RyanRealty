import { describe, expect, it } from 'vitest'
import { checkBrandVoice } from '@/lib/voice/check'
import { extractBlogFaq } from './publish-blog-faq'
import {
  MONTHLY_REPORT_CITIES,
  buildMonthlyCityReport,
  findMonth,
  monthlyReportSlug,
  previousMonth,
  sameMonthLastYear,
} from './monthly-city-report'

const bend = MONTHLY_REPORT_CITIES[0]
const base = {
  city: bend,
  month: '2026-08',
  current: { periodStart: '2026-08-01', medianSalePrice: 750000, soldCount: 180, medianDom: 22, endOfPeriodInventory: 443 },
  priorYear: { periodStart: '2025-08-01', medianSalePrice: 795000, soldCount: 165, medianDom: 19, endOfPeriodInventory: 492 },
  live: { activeCount: 673, monthsOfSupply: 3.9, medianDaysToPending: 23, refreshedAt: '2026-09-07T18:00:00Z' },
  builtAt: '2026-09-07T19:00:00Z',
  methodology: 'v3-2026-05-07',
}

describe('buildMonthlyCityReport', () => {
  it('builds the post with each figure stated once and the verdict from the bucket rule', () => {
    const r = buildMonthlyCityReport(base)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.post.slug).toBe('bend-oregon-market-report-august-2026')
    expect(r.post.title).toBe('Bend Oregon Market Report: August 2026')
    expect(r.post.category).toBe('Market Reports')
    expect(r.post.content).toContain('<strong>$750,000</strong>, down 5.7% from $795,000 in August 2025')
    expect(r.post.content).toContain('<strong>180</strong>, up 9.1% from 165 a year earlier')
    expect(r.post.content).toContain('Months of supply sits at 3.9, which is a seller\'s market')
    expect(r.post.content).toContain('verified September 7, 2026')
    expect(r.post.content).toContain('methodology v3-2026-05-07')
    // the median sale price figure appears in the numbers list, the bottom line, and one answer, never as a second value
    expect(r.post.content.match(/\$750,000/g)?.length).toBe(3)
    expect(extractBlogFaq(r.post.content)).toHaveLength(5)
    expect(r.post.seoTitle.length).toBeLessThanOrEqual(60)
    expect(r.post.seoDescription.length).toBeLessThanOrEqual(160)
  })

  it('passes the brand voice check', () => {
    const r = buildMonthlyCityReport(base)
    if (!r.ok) throw new Error(r.reason)
    const v = checkBrandVoice(
      { subject: [r.post.title, r.post.excerpt, r.post.seoTitle, r.post.seoDescription].join(' '), bodyHtml: r.post.content },
      { stripHtml: true },
    )
    expect(v.violations).toEqual([])
  })

  it('prints balanced and buyer verdicts from the same rule, never a rounded value across the line', () => {
    const balanced = buildMonthlyCityReport({ ...base, live: { ...base.live, monthsOfSupply: 4.04 } })
    if (!balanced.ok) throw new Error(balanced.reason)
    expect(balanced.post.content).toContain('4.1, which is a balanced market')
    const buyers = buildMonthlyCityReport({ ...base, live: { ...base.live, monthsOfSupply: 6.5 } })
    if (!buyers.ok) throw new Error(buyers.reason)
    expect(buyers.post.content).toContain("6.5, which is a buyer's market")
  })

  it('omits the year-over-year clauses when the prior year is missing', () => {
    const r = buildMonthlyCityReport({ ...base, priorYear: null })
    if (!r.ok) throw new Error(r.reason)
    expect(r.post.content).toContain('<li>Median sale price: <strong>$750,000</strong></li>')
    expect(r.post.content).not.toContain('a year earlier')
  })

  it('points to the market page when the live block is missing, and never invents supply', () => {
    const r = buildMonthlyCityReport({ ...base, live: null })
    if (!r.ok) throw new Error(r.reason)
    expect(r.post.content).not.toContain('months of supply sits')
    expect(r.post.content).toContain('are on the <a href="/housing-market/bend">Bend market page</a>')
  })

  it('refuses a thin month, a missing median, a missing row, and the wrong month', () => {
    expect(buildMonthlyCityReport({ ...base, current: { ...base.current, soldCount: 9 } })).toEqual({ ok: false, reason: 'Bend August 2026: 9 closings is below the 15 floor' })
    expect(buildMonthlyCityReport({ ...base, current: { ...base.current, medianSalePrice: null } }).ok).toBe(false)
    expect(buildMonthlyCityReport({ ...base, current: null }).ok).toBe(false)
    const wrong = buildMonthlyCityReport({ ...base, current: { ...base.current, periodStart: '2026-07-01' } })
    expect(wrong).toEqual({ ok: false, reason: 'Bend: latest completed month is 2026-07, not 2026-08' })
    expect(buildMonthlyCityReport({ ...base, month: 'August' }).ok).toBe(false)
  })
})

describe('month helpers', () => {
  it('previousMonth rolls the year', () => {
    expect(previousMonth(new Date('2026-09-03T15:00:00Z'))).toBe('2026-08')
    expect(previousMonth(new Date('2026-01-03T15:00:00Z'))).toBe('2025-12')
  })
  it('sameMonthLastYear and findMonth', () => {
    expect(sameMonthLastYear('2026-08')).toBe('2025-08')
    expect(findMonth([{ periodStart: '2026-07-01', medianSalePrice: 1, soldCount: 1, medianDom: null, endOfPeriodInventory: null }], '2026-08')).toBeNull()
  })
  it('slug follows the July 2026 pattern', () => {
    expect(monthlyReportSlug(MONTHLY_REPORT_CITIES[1], '2026-08')).toBe('redmond-oregon-market-report-august-2026')
  })
})
