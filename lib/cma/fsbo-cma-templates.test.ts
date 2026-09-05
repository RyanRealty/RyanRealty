import { describe, expect, it } from 'vitest'
import { checkBrandVoice } from '@/lib/voice/check'
import {
 CMA_BOTTOM_WHY_LIST_V1,
 CMA_COVER_INTRO_V1,
 FSBO_CMA_FIRST_TOUCH_V1,
 FSBO_CMA_STATS,
 buildCmaProductBar,
 clusterSalePriceBands,
 cmaProductBarHtml,
 composeCmaBottomWhyList,
 composeCmaCoverIntro,
 composeFsboCmaFirstTouchEmail,
 emptyFsboCmaMergeFacts,
 formatFsboCmaUsd,
 pickFsboCmaFirstTouchSubject,
 subjectHasBareCma,
} from './fsbo-cma-templates'

const FULL = {
 ...emptyFsboCmaMergeFacts(),
 ownerFirstName: 'Sarah',
 ownerFullName: 'Sarah Nguyen',
 propertyAddress: '123 NW Cascade Ave, Bend, OR 97703',
 propertyStreet: '123 NW Cascade Ave',
 propertyCity: 'Bend',
 priceRangeLow: '$625,000',
 priceRangeHigh: '$655,000',
 suggestedListPrice: '$649,000',
 currentAskPrice: '$679,000',
 reportDate: 'September 3, 2026',
 calendarLink: 'https://ryan-realty.com/book/matt',
 agentName: 'Matt Ryan',
 agentPhone: '(541) 703-3095',
 agentEmail: 'matt@ryan-realty.com',
 brokerageDisclosureLine: 'Licensed in Oregon · Ryan Realty',
 leadType: 'fsbo' as const,
}

describe('fsbo_cma_first_touch_v1', () => {
 it('uses pricing-report subjects without bare CMA', () => {
 const email = composeFsboCmaFirstTouchEmail(FULL)
 expect(email.templateId).toBe(FSBO_CMA_FIRST_TOUCH_V1)
 expect(email.requiresPdfAttachment).toBe(true)
 expect(email.subject).toBe('Pricing report for 123 NW Cascade Ave, Bend, OR 97703')
 expect(subjectHasBareCma(email.subject)).toBe(false)
 expect(pickFsboCmaFirstTouchSubject(FULL, 2)).toContain('Nearby sales')
 expect(pickFsboCmaFirstTouchSubject(FULL, 3)).toContain('Market snapshot')
 for (const opt of [1, 2, 3] as const) {
 expect(subjectHasBareCma(pickFsboCmaFirstTouchSubject(FULL, opt))).toBe(false)
 expect(pickFsboCmaFirstTouchSubject(FULL, opt)).not.toMatch(/\bCMA\b/)
 }
 })

 it('names the property, range, CTA, and passes voice', () => {
 const { body } = composeFsboCmaFirstTouchEmail(FULL)
 expect(body).toContain('Sarah')
 expect(body).toContain('123 NW Cascade Ave, Bend, OR 97703')
 expect(body).toContain('$625,000 to $655,000')
 expect(body).toContain('Recommended list: $649,000')
 expect(body).toContain('https://ryan-realty.com/book/matt')
 expect(body).not.toMatch(/net more/i)
 expect(body).not.toMatch(/\bCMA\b/)
 const voice = checkBrandVoice(body)
 expect(voice.ok, JSON.stringify(voice.violations)).toBe(true)
 })

 it('omits suggested list and range digits when missing - invents nothing', () => {
 const { body } = composeFsboCmaFirstTouchEmail({
 ...emptyFsboCmaMergeFacts(),
 ownerFirstName: 'Pat',
 propertyAddress: '9 Pine Rd',
 propertyCity: 'Bend',
 })
 expect(body).toContain('9 Pine Rd')
 expect(body).not.toMatch(/\$\d/)
 expect(body).not.toContain('Suggested list:')
 })
})

describe('cma_cover_intro_v1', () => {
 it('names it a pricing report, not an appraisal, and requires prepared-for name', () => {
 const cover = composeCmaCoverIntro(FULL)
 expect(cover.templateId).toBe(CMA_COVER_INTRO_V1)
 expect(cover.title).toBe('Pricing report for 123 NW Cascade Ave, Bend, OR 97703')
 expect(cover.preparedLine).toBe('Prepared for Sarah Nguyen · September 3, 2026')
 expect(cover.body).toMatch(/not an appraisal/i)
 expect(cover.body).toMatch(/pricing report/i)
 expect(cover.body).not.toMatch(/comparative market analysis/i)
 expect(cover.body).not.toMatch(/Lenders order appraisals/i)
 expect(cover.askLine).toContain('$679,000')
 expect(cover.fullText).toContain('Sarah Nguyen')
 })

 it('omits current-ask sentence when ask unknown', () => {
 const cover = composeCmaCoverIntro({ ...FULL, currentAskPrice: null })
 expect(cover.askLine).not.toMatch(/\$\d/)
 expect(cover.askLine).toContain('how your ask sits')
 })
})

describe('cma_bottom_why_list_v1', () => {
 it('uses locked NAR/Zillow shares only - no national $ gap', () => {
 const block = composeCmaBottomWhyList(FULL)
 expect(block.templateId).toBe(CMA_BOTTOM_WHY_LIST_V1)
 expect(block.bodyText).toContain(FSBO_CMA_STATS.fsboShare)
 expect(block.bodyText).toContain(FSBO_CMA_STATS.sellerAgentShare)
 expect(block.bodyText).toContain(FSBO_CMA_STATS.buyerAgentShare)
 expect(block.bodyText).toContain(FSBO_CMA_STATS.fsboKnewBuyerShare)
 expect(block.bodyText).toContain(FSBO_CMA_STATS.tryThenHireShare)
 expect(block.bodyText).toMatch(/ORS 105\.464/)
 expect(block.bodyText).not.toMatch(/net more/i)
 expect(block.bodyText).not.toMatch(/median.*FSBO.*\$/i)
 expect(block.footnotes).toContain('REALTORS')
 expect(block.bodyHtml).toContain('data-template="cma_bottom_why_list_v1"')
 })
})

describe('CMA product bar', () => {
 it('omits market data when missing - never invents', () => {
 const bar = buildCmaProductBar({ marketDataPresent: false })
 expect(bar.marketDataLine).toBeNull()
 expect(bar.placeLinks).toEqual([])
 expect(bar.competitionSummary).toBeNull()
 expect(bar.priceBandSummary).toBeNull()
 expect(bar.saleClusterBands).toEqual([])
 expect(cmaProductBarHtml(bar)).toBe('')
 })

 it('renders links and competition when present', () => {
 const bar = buildCmaProductBar({
 marketDataPresent: true,
 marketGeoLabel: 'Bend',
 neighborhood: { label: 'Old Bend', href: 'https://ryan-realty.com/communities/bend-old-bend' },
 nearbyActiveCount: 12,
 nearbyPendingCount: 3,
 nearbyActiveLabels: ['12 Pine', '88 Ranch'],
 recentSoldCount: 8,
 priceBandLo: '$600,000',
 priceBandHi: '$700,000',
 priceBandActiveCount: 4,
 })
 expect(bar.marketDataLine).toContain('Bend')
 expect(bar.placeLinks).toHaveLength(1)
 expect(bar.competitionSummary).toContain('12 for sale')
 expect(bar.competitionSummary).toContain('3 under contract')
 expect(bar.competitionSummary).not.toContain('incl.')
 expect(bar.priceBandSummary).toContain('$600,000')
 expect(bar.priceBandSummary).toContain('$700,000')
 const html = cmaProductBarHtml(bar)
 expect(html).toContain('Old Bend')
 expect(html).toContain('#102742')
 })
})

describe('formatFsboCmaUsd', () => {
 it('formats and nulls invalid', () => {
 expect(formatFsboCmaUsd(649000)).toBe('$649,000')
 expect(formatFsboCmaUsd(null)).toBeNull()
 expect(formatFsboCmaUsd(0)).toBeNull()
 })
})

describe('subjectHasBareCma', () => {
 it('flags legacy CMA - address subjects', () => {
 expect(subjectHasBareCma('CMA - 648 SE Douglas')).toBe(true)
 expect(subjectHasBareCma('Pricing report for 648 SE Douglas')).toBe(false)
 })
})


describe('clusterSalePriceBands', () => {
 it('groups closed sales and keeps dense bands', () => {
  const bands = clusterSalePriceBands([510000, 525000, 540000, 610000, 615000, 700000])
  expect(bands.length).toBeGreaterThanOrEqual(1)
  expect(bands.some((b) => b.saleCount >= 2)).toBe(true)
  expect(bands.every((b) => b.loLabel && b.hiLabel && b.saleCount > 0)).toBe(true)
 })

 it('returns empty when no prices', () => {
  expect(clusterSalePriceBands([])).toEqual([])
  expect(clusterSalePriceBands([NaN, -1])).toEqual([])
 })
})
