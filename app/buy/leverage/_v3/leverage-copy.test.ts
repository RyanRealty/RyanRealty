/**
 * Crawlable copy on /buy/leverage. Figures are interpolated. The brief's
 * Oct 13, 2026 published set is the fixture so the sentences stay honest
 * when those same public MOS and pace cells publish.
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
      note: 'Leverage on price, not supply',
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
      note: 'Little leverage. Room to negotiate on homes that have sat',
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
      note: 'Mixed. Well-priced homes still go fast',
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
      note: 'Buyers have room',
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
      note: 'Buyers have room',
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
      note: 'Cuts and pace give buyers room',
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

function publicText(copy: ReturnType<typeof leverageCopy>): string {
  return [
    copy.h1,
    copy.eyebrow,
    copy.metaDescription,
    ...copy.answer,
    copy.qualifier,
    copy.paceHeading,
    copy.paceLine,
    copy.saleToListLine,
    copy.paceLinkLabel,
    copy.weekHeading,
    copy.weekLine,
    copy.weekLinkLabel,
    copy.regionLine,
    copy.regionLinkLabel,
    copy.methodLine,
    copy.areaCaption,
    copy.townsHeading,
    copy.colArea,
    copy.colMos,
    copy.colCut,
    copy.colDays,
    copy.colRead,
    copy.useHeading,
    copy.useStart,
    copy.usePayment,
    copy.usePaymentLink,
    copy.useClosingLink,
    copy.useStory,
    copy.useShiftLink,
    copy.useShiftNote,
    copy.useGoodTimeLink,
    copy.reportHeading,
    copy.reportSubhead,
    copy.reportButton,
    copy.consultHeading,
    copy.consultSubhead,
    ...copy.faqs.map((f) => `${f.question} ${f.answer} ${f.related?.label ?? ''}`),
    copy.firmLine,
    ...leverageNextItems().map((item) => item.label),
    JSON.stringify(LEVERAGE_COPY),
  ]
    .filter(Boolean)
    .join(' ')
}

describe('leverage copy', () => {
  it('keeps the brief title, H1, and live meta', () => {
    const copy = leverageCopy(snap())
    expect(copy.title).toBe(LEVERAGE_TITLE)
    expect(copy.h1).toBe(LEVERAGE_H1)
    expect(copy.title.length + ' | Ryan Realty'.length).toBeLessThanOrEqual(60)
    expect(copy.metaDescription.length).toBeLessThanOrEqual(155)
    expect(copy.metaDescription).toBe(
      'Buyers have leverage in Bend again: 45.4% of homes sold after a price cut and closed at 97.1% of first ask. Live MLS numbers, updated daily.',
    )
    expect(leverageMetaDescription(snap({ bend: { ...snap().bend, priceCutShareLabel: null } }))).not.toMatch(
      /\d+\.\d+%/,
    )
  })

  it('leads with price proof and the under-4-month qualifier', () => {
    const copy = leverageCopy(snap())
    expect(copy.answer[0]).toBe(
      'Yes, on price. As of Oct 13, 2026, 45.4% of Bend homes that sold in the last 12 months took a price cut first. The median cut was 5.6%, and homes closed at 97.1% of their first asking price.',
    )
    expect(copy.qualifier).toContain('3.5 months of supply')
    expect(copy.qualifier).toContain('under the 4-month line')
    expect(copy.qualifier).toContain("isn't oversupplied")
    expect(copy.qualifier).toContain('Buyers have leverage in Bend on price and first asks, not on inventory.')
    expect(copy.paceLine).toContain('Over the last 90 days, the median Bend home took 33 days to get an offer.')
    expect(copy.paceLine).toContain('Over the last 12 months it was 28.')
    expect(copy.saleToListLine).toContain('97.1% of its first asking price')
    expect(copy.saleToListLine).toContain('99.2% of its final list price')
    expect(copy.weekLine).toBe(
      '42 Bend homes cut their asking price in the last 7 days. The median drop was 3.3% (as of Oct 13, 2026).',
    )
    expect(copy.regionLine).toBe(
      'All figures as of Oct 13, 2026. Central Oregon overall: 4.7 months of supply, 45.9% sold after a cut.',
    )
    expect(copy.useStart).toContain('listed longer than 33 days')
    expect(copy.methodLine).toContain('Single-family homes, Oregon Data Share MLS, as of Oct 13, 2026.')
    expect(copy.methodLine).not.toMatch(/leftover HUD|Pulse active/i)
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

  it('never writes buyer\'s market, leftover HUD, SMS, or top team', () => {
    const copy = leverageCopy(snap())
    const joined = publicText(copy)
    expect(copy.faqs[0]?.question).toBe('Do buyers have the upper hand in Bend right now?')
    expect(joined.toLowerCase()).not.toMatch(/buyer's market|buyers market/)
    expect(joined).not.toContain('\u2014')
    expect(joined).not.toContain('68.5')
    expect(joined).not.toContain('2.97')
    expect(joined).not.toMatch(/\b471\b/)
    expect(joined.toLowerCase()).not.toMatch(/leftover hud|leftoverhud/)
    expect(joined.toLowerCase()).not.toMatch(/\btop team\b/)
    expect(joined.toLowerCase()).not.toMatch(/\bsms\b/)
  })

  it('omits SMS signup copy and links the brief next-step doors', () => {
    const copy = leverageCopy(snap())
    const form = [copy.reportSubhead, copy.formPhoneHint, copy.consultSubhead].join(' ')
    expect(form.toLowerCase()).not.toMatch(/\bsms\b|\btext back\b|\btexts\b/)
    const hrefs = leverageNextItems().map((item) => item.href)
    expect(hrefs).toContain('/blog/is-now-a-good-time-to-buy-in-bend')
    expect(hrefs).toContain('/blog/closing-costs-buyers-bend-oregon')
    expect(hrefs).toContain('/tools/mortgage-calculator')
    expect(leverageNextItems().map((item) => item.label)).toContain('Talk to Matt')
    expect(leverageNextItems().map((item) => item.label)).toContain('Get listing alerts')
  })

  it('labels Redmond little leverage, Sisters mixed, La Pine unpublished supply', () => {
    expect(
      areaNote({ slug: 'redmond', monthsSupply: 4.0, monthsSupplyLabel: '4.0', daysToOffer90: 33 }),
    ).toMatch(/Little leverage/)
    expect(
      areaNote({ slug: 'sisters', monthsSupply: 6.2, monthsSupplyLabel: '6.2', daysToOffer90: 18 }),
    ).toBe('Mixed. Well-priced homes still go fast')
    expect(
      areaNote({ slug: 'la-pine', monthsSupply: null, monthsSupplyLabel: null, daysToOffer90: 53 }),
    ).toBe('Cuts and pace give buyers room')
    expect(
      areaNote({ slug: 'la-pine', monthsSupply: 6.1, monthsSupplyLabel: '6.1', daysToOffer90: 53 }),
    ).toBe('Buyers have room')
    expect(
      areaNote({ slug: 'bend', monthsSupply: 3.5, monthsSupplyLabel: '3.5', daysToOffer90: 33 }),
    ).toBe('Leverage on price, not supply')
    expect(
      areaNote({ slug: 'sunriver', monthsSupply: 5.1, monthsSupplyLabel: '5.1', daysToOffer90: 31 }),
    ).toBe('Buyers have room')
    const copy = leverageCopy(snap())
    expect(copy.faqs[3]?.answer).toContain('Prineville (7.5 months of supply)')
    expect(copy.faqs[3]?.answer).toContain('Sunriver (5.1)')
    expect(copy.faqs[3]?.answer).toContain("there's little leverage")
  })

  it('prints the approved FAQ answers with live tokens', () => {
    const copy = leverageCopy(snap())
    expect(copy.faqs[0]?.answer).toBe(
      'Not by supply. Bend has 3.5 months of supply as of Oct 13, 2026, under the 6-month mark people usually use. But buyers have leverage in Bend on price: 45.4% of homes sold in the last 12 months after a price cut, and the median home closed at 97.1% of its first ask.',
    )
    expect(copy.faqs[1]?.answer).toBe(
      'Over the last 12 months, the median Bend home sold at 97.1% of its first asking price and 99.2% of its final list price. The gap is mostly price cuts made before an offer.',
    )
    expect(copy.faqs[2]?.question).toBe('Can I ask for seller credits in Bend?')
    expect(copy.faqs[2]?.related?.label).toBe('Our concession data')
    expect(copy.faqs[4]?.question).toBe('Which homes give the most room to negotiate?')
    expect(copy.faqs[4]?.answer).toContain('typical 33 days')
    expect(copy.faqs[5]?.answer).toBe('Daily, from Oregon Data Share MLS.')
  })

  it('hides the week line when the price-drop read is degraded', () => {
    const copy = leverageCopy(snap({ weekDrops: { count: 0, medianDropLabel: null, asOfLabel: null, degraded: true } }))
    expect(copy.weekLine).toBeNull()
  })

  it('uses the approved report heading and does not promise an automated weekly email', () => {
    const copy = leverageCopy(snap())
    expect(copy.reportHeading).toBe('Get the weekly deal report')
    expect(copy.reportButton).toBe('Send me the report')
    expect(copy.reportSubhead).toMatch(/not an automated newsletter/)
    expect(copy.reportSubhead.toLowerCase()).not.toMatch(/every week by email/)
    expect(copy.reportSuccessBody).toMatch(/does not enroll you in an automated weekly email/)
  })
})
