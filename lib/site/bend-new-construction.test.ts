import { describe, expect, it } from 'vitest'
import {
  BEND_NEW_CON_DISCLAIMER,
  BEND_NEW_CON_FINANCING,
  BEND_NEW_CON_HEADLINE,
  BEND_NEW_CON_NAMED,
  BEND_NEW_CON_LEAD_NAMES,
  BEND_NEW_CON_LEDE,
  BEND_NEW_CON_PRIMARY,
  BEND_NEW_CON_SEARCH_HREF,
  bendNewConLeadRows,
  bendNewConRestPrimary,
  financingHighlight,
  BEND_NEW_CON_SINGLE,
  BEND_NEW_CON_UNSPECIFIED,
  BEND_NEW_CONSTRUCTION_DESCRIPTION,
  BEND_NEW_CONSTRUCTION_PATH,
  BEND_NEW_CONSTRUCTION_RESEARCH_DATE,
  BEND_NEW_CONSTRUCTION_TITLE,
  bendNewConCommunityHref,
  bendNewConSearchHref,
  bendNewConWeight,
} from './bend-new-construction'

const CALDERA = /caldera/i
const INVENTED_HAYDEN_25K = /\$25,000/
const INVENTED_HORTON_PAGE_APR = /5\.727%/
const INVENTED_HORTON_PAGE_CLOSE = /09\/30\/2026|9\/30\/2026/
const MOS = /months of supply|\bMOS\b/i

function financingText(): string {
  return BEND_NEW_CON_FINANCING.flatMap((offer) => [offer.title, ...offer.terms]).join('\n')
}

function inventoryText(): string {
  return BEND_NEW_CON_NAMED.map((row) => row.name).join('\n')
}

describe('Bend new-construction snapshot', () => {
  it('keeps the public path and research date', () => {
    expect(BEND_NEW_CONSTRUCTION_PATH).toBe('/new-construction')
    expect(BEND_NEW_CONSTRUCTION_RESEARCH_DATE).toBe('2026-09-16')
    expect(BEND_NEW_CONSTRUCTION_TITLE).toBe('New construction in Bend')
    expect(BEND_NEW_CONSTRUCTION_DESCRIPTION).toMatch(/2026-09-16/)
    expect(BEND_NEW_CONSTRUCTION_DESCRIPTION).toMatch(/Not a loan offer/)
    expect(BEND_NEW_CON_DISCLAIMER.title).toBe('Not a loan offer')
  })

  it('uses the 2026-09-16 DAL headline totals without rounding the band', () => {
    expect(BEND_NEW_CON_HEADLINE.active).toBe(185)
    expect(BEND_NEW_CON_HEADLINE.unspecifiedActive).toBe(16)
    expect(BEND_NEW_CON_HEADLINE.namedCommunities).toBe(BEND_NEW_CON_NAMED.length)
    expect(BEND_NEW_CON_HEADLINE.priceLow).toBe('$185,000')
    expect(BEND_NEW_CON_HEADLINE.priceHigh).toBe('$5,285,000')
    expect(BEND_NEW_CON_HEADLINE.median).toBe('$699,900')
    expect(BEND_NEW_CON_NAMED.reduce((sum, row) => sum + row.active, 0)).toBe(
      BEND_NEW_CON_HEADLINE.active - BEND_NEW_CON_UNSPECIFIED.active,
    )
  })

  it('does not treat Caldera as Bend proper', () => {
    expect(inventoryText()).not.toMatch(CALDERA)
    expect(financingText()).not.toMatch(CALDERA)
  })

  it('does not invent MOS, Hayden $25k, or the Horton community-page panel', () => {
    const all = [financingText(), inventoryText(), BEND_NEW_CONSTRUCTION_DESCRIPTION].join('\n')
    expect(all).not.toMatch(MOS)
    expect(all).not.toMatch(INVENTED_HAYDEN_25K)
    expect(all).not.toMatch(INVENTED_HORTON_PAGE_APR)
    expect(all).not.toMatch(INVENTED_HORTON_PAGE_CLOSE)
  })

  it('flags Pahlisch 4.99%, Hayden stale risk, and Horton conflict without merging sources', () => {
    const pahlisch = BEND_NEW_CON_FINANCING.find((offer) => offer.id === 'pahlisch-golden-key')
    const hayden = BEND_NEW_CON_FINANCING.find((offer) => offer.id === 'hayden-summer-savings')
    const horton = BEND_NEW_CON_FINANCING.find((offer) => offer.id === 'horton-stevens-ranch-flyer')
    expect(pahlisch?.flags).toContain('UNVERIFIED')
    expect(pahlisch?.terms.join(' ')).toMatch(/4\.99%/)
    expect(hayden?.flags).toEqual(expect.arrayContaining(['STALE', 'NOT DISCLOSED']))
    expect(hayden?.terms.join(' ')).toMatch(/2026-09-15/)
    expect(horton?.flags).toContain('CONFLICT')
    expect(horton?.terms[0]).toMatch(/Do not merge/)
    expect(horton?.sources).toHaveLength(2)
  })

  it('keeps flyer rates that were transcribed and omits builder names we did not sample', () => {
    const horton = BEND_NEW_CON_FINANCING.find((offer) => offer.id === 'horton-stevens-ranch-flyer')
    expect(horton?.terms.join(' ')).toMatch(/3\.875% rate \/ 5\.989% APR/)
    expect(horton?.terms.join(' ')).toMatch(/4\.250% rate \/ 5\.688% APR/)
    expect(horton?.terms.join(' ')).toMatch(/10\/30\/26/)
    const ponderosa = BEND_NEW_CON_NAMED.find((row) => row.name === 'Ponderosa, Phase 1')
    expect(ponderosa?.builders).toBeNull()
    const lodges = BEND_NEW_CON_NAMED.find((row) => row.name === 'Lodges at Bachelor V')
    expect(lodges?.builders).toBeNull()
  })

  it('links named rows to Bend new-construction search, and NWX / Tetherow to community pages', () => {
    expect(BEND_NEW_CON_SEARCH_HREF).toBe('/homes-for-sale/bend?newConstruction=1')
    expect(bendNewConSearchHref('Easton')).toBe('/homes-for-sale/bend/easton?newConstruction=1')
    expect(bendNewConCommunityHref('NorthWest Crossing')).toBe('/communities/northwest-crossing')
    expect(bendNewConCommunityHref('Tetherow')).toBe('/communities/tetherow')
    expect(bendNewConCommunityHref('Easton')).toBeNull()
  })

  it('splits 2+ active from singles and encodes Easton as the weight ceiling', () => {
    expect(BEND_NEW_CON_PRIMARY.every((row) => row.active >= 2)).toBe(true)
    expect(BEND_NEW_CON_SINGLE.every((row) => row.active === 1)).toBe(true)
    expect(bendNewConWeight(20)).toBe(1)
    expect(bendNewConWeight(10)).toBe(0.5)
  })

  it('leads with Parkside, then Calaveras, then Easton', () => {
    expect([...BEND_NEW_CON_LEAD_NAMES]).toEqual([
      'Parkside Place Phase 1',
      'Calaveras',
      'Easton',
    ])
    expect(BEND_NEW_CON_LEDE).toMatch(/\$399,990/)
    expect(bendNewConLeadRows().map((row) => row.name)).toEqual([...BEND_NEW_CON_LEAD_NAMES])
    expect(bendNewConRestPrimary().some((row) => row.name === 'Easton')).toBe(false)
    expect(financingHighlight({
      id: 'pahlisch-golden-key',
      builder: 'Pahlisch Homes',
      title: 'Golden Key',
      flags: ['UNVERIFIED'],
      terms: [],
      sources: [],
    }).value).toBe('3% / $20,000')
  })
})
