/**
 * Crawlable copy on /buy/leverage. Figures are interpolated. The brief's
 * Oct 13, 2026 published set is the fixture so the sentences stay honest
 * when those same leftover HUD cells publish.
 */
import { describe, expect, it } from 'vitest'
import { LEVERAGE_H1, LEVERAGE_TITLE } from './leverage-constants'
import { areaNote, LEVERAGE_COPY, leverageCopy, leverageMetaDescription, leverageNextItems } from './leverage-copy'
import type { LeverageSnapshot } from './leverage-types'

function snap(over: Partial<LeverageSnapshot> = {}): LeverageSnapshot {
  const bend = {
    asOfLabel: 'Oct 13, 2026',
    asOfIso: '2026-10-13',
    monthsSupply: 3.5,
    monthsSupplyLabel: '3.5',
    priceCutShareLabel: '45.4%',
    medianPriceCutLabel: '5.6%',
    saleToFirstAskLabel: '97.1%',
    saleToFinalListLabel: '99.2%',
    daysToOffer90: 33,
    daysToOffer12mo: 28,
    daysToClose12mo: 64,
    medianAgeActive: 68,
    ...over.bend,
  }
  const areas = over.areas ?? [
    {
      slug: 'bend' as const,
      name: 'Bend',
      href: '/housing-market/bend',
      monthsSupply: 3.5,
      monthsSupplyLabel: '3.5',
      priceCutShareLabel: '45.4%',
      daysToOffer90: 33,
      daysToOffer90Label: '33',
      note: 'Leverage is on price cuts and first asks, not on inventory.',
    },
    {
      slug: 'redmond' as const,
      name: 'Redmond',
      href: '/housing-market/redmond',
      monthsSupply: 4.0,
      monthsSupplyLabel: '4.0',
      priceCutShareLabel: '44.7%',
      daysToOffer90: 33,
      daysToOffer90Label: '33',
      note: 'Little leverage. Room to negotiate on homes that have sat.',
    },
    {
      slug: 'sisters' as const,
      name: 'Sisters',
      href: '/housing-market/sisters',
      monthsSupply: 6.2,
      monthsSupplyLabel: '6.2',
      priceCutShareLabel: '36.2%',
      daysToOffer90: 18,
      daysToOffer90Label: '18',
      note: 'Mixed. Supply is open, and well-priced homes still go fast.',
    },
    {
      slug: 'sunriver' as const,
      name: 'Sunriver',
      href: '/housing-market/sunriver',
      monthsSupply: 5.1,
      monthsSupplyLabel: '5.1',
      priceCutShareLabel: '49.2%',
      daysToOffer90: 31,
      daysToOffer90Label: '31',
      note: 'These numbers support leverage on price and terms.',
    },
    {
      slug: 'prineville' as const,
      name: 'Prineville',
      href: '/housing-market/prineville',
      monthsSupply: 7.5,
      monthsSupplyLabel: '7.5',
      priceCutShareLabel: '49.0%',
      daysToOffer90: 69,
      daysToOffer90Label: '69',
      note: 'These numbers support leverage on price and terms.',
    },
    {
      slug: 'la-pine' as const,
      name: 'La Pine',
      href: '/housing-market/la-pine',
      monthsSupply: null,
      monthsSupplyLabel: null,
      priceCutShareLabel: '56.2%',
      daysToOffer90: 53,
      daysToOffer90Label: '53',
      note: 'Cuts and days support room to negotiate. Months of supply is not published here.',
    },
  ]
  return {
    bend,
    region: {
      monthsSupplyLabel: '4.7',
      priceCutShareLabel: '45.9%',
      daysToOffer90: 36,
      asOfLabel: 'Oct 13, 2026',
      ...over.region,
    },
    areas,
    weekDrops: over.weekDrops === undefined
      ? { count: 42, medianDropLabel: '3.3%', asOfLabel: 'Oct 13, 2026', degraded: false }
      : over.weekDrops,
    methodLine:
      over.methodLine ??
      'Oregon Data Share MLS, single-family homes, months of supply and 12-month pace, as of Oct 13, 2026.',
  }
}

describe('leverage copy', () => {
  it('keeps the brief title, H1, and live meta', () => {
    const copy = leverageCopy(snap())
    expect(copy.title).toBe(LEVERAGE_TITLE)
    expect(copy.h1).toBe(LEVERAGE_H1)
    expect(copy.title.length + ' | Ryan Realty'.length).toBeLessThanOrEqual(60)
    expect(copy.metaDescription.length).toBeLessThanOrEqual(155)
    expect(copy.metaDescription).toContain('45.4%')
    expect(copy.metaDescription).toContain('97.1%')
    expect(leverageMetaDescription(snap({ bend: { ...snap().bend, priceCutShareLabel: null } }))).not.toMatch(
      /\d+\.\d+%/,
    )
  })

  it('leads with price proof and the under-4-month qualifier', () => {
    const copy = leverageCopy(snap())
    expect(copy.answer[0]).toContain('Yes, on price.')
    expect(copy.answer[0]).toContain('45.4%')
    expect(copy.answer[0]).toContain('5.6%')
    expect(copy.answer[0]).toContain('97.1%')
    expect(copy.qualifier).toContain('3.5 months of supply')
    expect(copy.qualifier).toContain('under the 4-month line')
    expect(copy.paceLine).toContain('33 days')
    expect(copy.paceLine).toContain('28')
    expect(copy.weekLine).toContain('3.3%')
  })

  it('hides the under-4 qualifier when displayed MOS is 4.0 or above', () => {
    const copy = leverageCopy(
      snap({
        bend: {
          ...snap().bend,
          monthsSupply: 4.0,
          monthsSupplyLabel: '4.0',
        },
      }),
    )
    expect(copy.qualifier).toBeNull()
  })

  it('never writes buyer\'s market, including FAQ questions', () => {
    const copy = leverageCopy(snap())
    const joined = [
      copy.h1,
      copy.eyebrow,
      copy.metaDescription,
      ...copy.answer,
      copy.qualifier,
      copy.paceLine,
      copy.weekLine,
      copy.regionLine,
      copy.reportHeading,
      copy.reportSubhead,
      copy.consultHeading,
      copy.consultSubhead,
      ...copy.faqs.map((f) => `${f.question} ${f.answer}`),
      JSON.stringify(LEVERAGE_COPY),
    ]
      .filter(Boolean)
      .join(' ')
    expect(copy.faqs[0]?.question).toBe('Do buyers have the upper hand in Bend right now?')
    expect(joined.toLowerCase()).not.toMatch(/buyer's market|buyers market/)
    expect(joined).not.toContain('\u2014')
    expect(joined).not.toContain('68.5')
    expect(joined).not.toContain('2.97')
    expect(joined).not.toMatch(/\b471\b/)
  })

  it('omits SMS signup copy and links the brief next-step doors', () => {
    const copy = leverageCopy(snap())
    const form = [copy.reportSubhead, copy.formPhoneHint, copy.consultSubhead].join(' ')
    expect(form.toLowerCase()).not.toMatch(/\bsms\b|\btext back\b|\btexts\b/)
    const hrefs = leverageNextItems().map((item) => item.href)
    expect(hrefs).toContain('/blog/is-now-a-good-time-to-buy-in-bend')
    expect(hrefs).toContain('/blog/closing-costs-buyers-bend-oregon')
    expect(hrefs).toContain('/tools/mortgage-calculator')
  })

  it('labels Redmond little leverage, Sisters mixed, La Pine unpublished supply', () => {
    expect(
      areaNote({ slug: 'redmond', monthsSupply: 4.0, monthsSupplyLabel: '4.0', daysToOffer90: 33 }),
    ).toMatch(/Little leverage/)
    expect(
      areaNote({ slug: 'sisters', monthsSupply: 6.2, monthsSupplyLabel: '6.2', daysToOffer90: 18 }),
    ).toMatch(/Mixed/)
    expect(
      areaNote({ slug: 'la-pine', monthsSupply: null, monthsSupplyLabel: null, daysToOffer90: 53 }),
    ).toMatch(/not published/)
    expect(
      areaNote({ slug: 'la-pine', monthsSupply: 6.1, monthsSupplyLabel: '6.1', daysToOffer90: 53 }),
    ).toMatch(/support leverage/)
    expect(
      areaNote({ slug: 'bend', monthsSupply: 3.5, monthsSupplyLabel: '3.5', daysToOffer90: 33 }),
    ).toMatch(/not on inventory/)
    const copy = leverageCopy(snap())
    expect(copy.faqs[3]?.answer).toContain('Prineville 7.5')
    expect(copy.faqs[3]?.answer).toContain('Sunriver 5.1')
    expect(copy.faqs[3]?.answer).toContain('little leverage')
  })

  it('hides the week line when the price-drop read is degraded', () => {
    const copy = leverageCopy(snap({ weekDrops: { count: 0, medianDropLabel: null, asOfLabel: null, degraded: true } }))
    expect(copy.weekLine).toBeNull()
  })

  it('does not promise an automated weekly email', () => {
    const copy = leverageCopy(snap())
    expect(copy.reportSubhead).toMatch(/not an automated newsletter/)
    expect(copy.reportSuccessBody).toMatch(/does not enroll you in an automated weekly email/)
  })
})
