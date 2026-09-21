import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  BEND_NEW_CON_DISCLAIMER,
  BEND_NEW_CON_FINANCING,
  BEND_NEW_CON_HEADLINE,
  BEND_NEW_CON_NAMED,
  BEND_NEW_CON_HORTON_TOWNHOME_NAMES,
  BEND_NEW_CON_HORTON_TOWNHOME_NOTE,
  BEND_NEW_CON_LEAD_NAMES,
  BEND_NEW_CON_LEDE,
  BEND_NEW_CON_PRIMARY,
  BEND_NEW_CON_SEARCH_HREF,
  BEND_NEW_CON_SFR_ORDER,
  BEND_NEW_CON_STEVENS_RANCH_SF,
  BEND_NEW_CON_STEVENS_RANCH_TOWNHOMES,
  BEND_NEW_CON_SFR_SUBTYPE,
  BEND_NEW_CON_TOWNHOUSE_SUBTYPE,
  bendNewConCoverageCounts,
  bendNewConHortonTownhomeRows,
  bendNewConLeadRows,
  bendNewConRestPrimary,
  BEND_NEW_CON_ROW_OFFERS,
  bendNewConRowOffer,
  bendNewConRowOffers,
  bendNewConRowConcessionLine,
  bendNewConRowConcessionReveal,
  financingHighlight,
  BEND_NEW_CON_SINGLE,
  BEND_NEW_CON_UNSPECIFIED,
  BEND_NEW_CON_FAQ,
  BEND_NEW_CON_HOME_NAV_NAMES,
  BEND_NEW_CON_SAVINGS_CHIPS,
  BEND_NEW_CON_STATUS_LEGEND,
  BEND_NEW_CONSTRUCTION_DESCRIPTION,
  BEND_NEW_CONSTRUCTION_H1,
  BEND_NEW_CONSTRUCTION_PATH,
  BEND_NEW_CONSTRUCTION_RESEARCH_DATE,
  BEND_NEW_CONSTRUCTION_TITLE,
  bendNewConChipFlags,
  bendNewConChipHref,
  bendNewConPlatMatchesName,
  bendNewConCommunityHref,
  bendNewConSearchFilter,
  bendNewConSearchHref,
  bendNewConSeeHomesLabel,
  bendNewConStevensRanchSfHref,
  bendNewConStevensRanchTownhomeHref,
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
    expect(BEND_NEW_CONSTRUCTION_TITLE).toBe('New Homes in Bend: Builder Savings')
    expect(BEND_NEW_CONSTRUCTION_H1).toBe('New homes in Bend: inventory and builder savings')
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
    expect(BEND_NEW_CON_HEADLINE.priceSpanFold).toBe('$185K–$5.3M')
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

  it('opens exclusive new-construction search, and never the Tetherow 301 path', () => {
    expect(BEND_NEW_CON_SEARCH_HREF).toBe('/homes-for-sale/bend?newConstruction=1')
    expect(bendNewConSearchHref('Easton')).toBe('/homes-for-sale/bend/easton?newConstruction=1')
    expect(bendNewConSearchHref('Parkside Place Phase 1')).toBe(
      '/homes-for-sale/bend/parkside-place-phase-1?newConstruction=1',
    )
    expect(bendNewConSearchHref('Petrosa')).toBe('/homes-for-sale/bend/petrosa?newConstruction=1')
    expect(bendNewConSearchHref('Acadia Pointe Phase 5 and 6')).toBe(
      '/homes-for-sale/bend/acadia-pointe-phase-5-and-6?newConstruction=1',
    )
    expect(bendNewConSearchHref('NorthWest Crossing')).toBe(
      '/homes-for-sale/bend/northwest-crossing?newConstruction=1',
    )
    expect(bendNewConSearchHref('Tetherow')).toBe(
      '/homes-for-sale?newConstruction=1&city=Bend&subdivision=Tetherow',
    )
    expect(bendNewConSearchHref('Tetherow')).not.toContain('/homes-for-sale/bend/tetherow')
    expect(bendNewConStevensRanchSfHref()).toBe(
      `/homes-for-sale/bend/stevens-ranch?newConstruction=1&propertySubType=${encodeURIComponent(BEND_NEW_CON_SFR_SUBTYPE).replace(/%20/g, '+')}`,
    )
    expect(bendNewConStevensRanchTownhomeHref()).toContain('propertySubType=Townhouse')
    expect(bendNewConStevensRanchTownhomeHref()).toContain('/homes-for-sale/bend/stevens-ranch')
    expect(bendNewConStevensRanchTownhomeHref()).not.toContain('drhorton.com')
    expect(bendNewConCommunityHref('NorthWest Crossing')).toBe('/communities/northwest-crossing')
    expect(bendNewConCommunityHref('Tetherow')).toBe('/communities/tetherow')
    expect(bendNewConCommunityHref('Easton')).toBeNull()
    expect(bendNewConSeeHomesLabel(null)).toBe('See homes')
    expect(bendNewConSeeHomesLabel(0)).toBe('See homes')
    expect(bendNewConSeeHomesLabel(1)).toBe('See 1 home')
    expect(bendNewConSeeHomesLabel(8)).toBe('See 8 homes')
    expect(bendNewConSearchFilter('Easton')).toEqual(
      expect.objectContaining({
        city: 'Bend',
        newConstruction: true,
        status: 'active',
        subdivisions: expect.arrayContaining(['Easton']),
      }),
    )
    expect(bendNewConSearchFilter('Stevens Ranch', { propertySubType: BEND_NEW_CON_SFR_SUBTYPE }))
      .toEqual(
        expect.objectContaining({
          city: 'Bend',
          newConstruction: true,
          propertySubType: BEND_NEW_CON_SFR_SUBTYPE,
          subdivisions: expect.arrayContaining(['Stevens Ranch']),
        }),
      )
    expect(BEND_NEW_CON_TOWNHOUSE_SUBTYPE).toBe('Townhouse')
    expect(BEND_NEW_CON_STEVENS_RANCH_TOWNHOMES.builderHref).toMatch(/drhorton\.com/)
    for (const row of BEND_NEW_CON_NAMED) {
      const href = bendNewConSearchHref(row.name)
      expect(href).toContain('newConstruction=1')
      expect(href).not.toMatch(/^\/communities\//)
      expect(href).not.toBe(BEND_NEW_CON_SEARCH_HREF)
      if (row.name === 'Tetherow') {
        expect(href).toContain('subdivision=Tetherow')
        expect(href).toContain('city=Bend')
      } else {
        expect(href.startsWith('/homes-for-sale/bend/')).toBe(true)
      }
    }
  })

  it('splits 2+ active from singles and encodes Easton as the weight ceiling', () => {
    expect(BEND_NEW_CON_PRIMARY.every((row) => row.active >= 2)).toBe(true)
    expect(BEND_NEW_CON_SINGLE.every((row) => row.active === 1)).toBe(true)
    expect(bendNewConWeight(20)).toBe(1)
    expect(bendNewConWeight(10)).toBe(0.5)
  })

  it('leads with affordable SFR, not Horton townhomes', () => {
    expect([...BEND_NEW_CON_SFR_ORDER]).toEqual([
      'Parkside Place Phase 1',
      'Calaveras',
      'Easton',
      'Petrosa',
      'Acadia Pointe Phase 5 and 6',
      'Stevens Ranch',
    ])
    expect([...BEND_NEW_CON_LEAD_NAMES]).toEqual([
      'Parkside Place Phase 1',
      'Calaveras',
      'Easton',
    ])
    expect(BEND_NEW_CON_LEDE).toBe('Single-family starts at $399,990 at Parkside Place')
    expect(bendNewConLeadRows().map((row) => row.name)).toEqual([...BEND_NEW_CON_LEAD_NAMES])
    expect(bendNewConRestPrimary().map((row) => row.name).slice(0, 3)).toEqual([
      'Petrosa',
      'Acadia Pointe Phase 5 and 6',
      'Stevens Ranch',
    ])
    expect(bendNewConRestPrimary().some((row) => row.name === 'Easton')).toBe(false)
    expect(bendNewConRestPrimary().some((row) => row.name === 'Thunder Ridge')).toBe(false)
    expect(bendNewConRestPrimary().some((row) => row.name === 'Ponderosa, Phase 1')).toBe(false)
    expect(BEND_NEW_CON_STEVENS_RANCH_SF.priceBand).toBe('From $579,995')
    expect(BEND_NEW_CON_STEVENS_RANCH_TOWNHOMES.priceBand).toBe('From $419,995')
    expect([...BEND_NEW_CON_HORTON_TOWNHOME_NAMES]).toEqual(['Thunder Ridge', 'Ponderosa, Phase 1'])
    expect(bendNewConHortonTownhomeRows().map((row) => row.priceBand)).toEqual([
      '$379,995–$419,995',
      '$414,995–$419,995',
    ])
    expect(BEND_NEW_CON_HORTON_TOWNHOME_NOTE).toMatch(/Thunder Ridge \$379,995–\$419,995/)
    expect(BEND_NEW_CON_HORTON_TOWNHOME_NOTE).toMatch(/Stevens Ranch from \$419,995/)
    expect(financingHighlight({
      id: 'pahlisch-golden-key',
      builder: 'Pahlisch Homes',
      title: 'Golden Key',
      flags: ['UNVERIFIED'],
      terms: [],
      sources: [],
    }).value).toBe('3% / $20,000')
  })

  it('maps savings chips onto existing cards and never invents a dollar', () => {
    const invented = /\$25,000|\$15,000|\$50,000/
    for (const chip of BEND_NEW_CON_SAVINGS_CHIPS) {
      expect(chip.offerIds.length).toBeGreaterThan(0)
      expect(bendNewConChipHref(chip)).toBe(`#${chip.offerIds[0]}`)
      for (const id of chip.offerIds) {
        expect(BEND_NEW_CON_FINANCING.some((offer) => offer.id === id)).toBe(true)
      }
      expect(chip.scan).not.toMatch(invented)
      expect(chip.scan).not.toMatch(MOS)
    }
    expect(BEND_NEW_CON_SAVINGS_CHIPS.map((chip) => chip.id)).toEqual([
      'rate',
      'closing',
      'dpa',
      'options',
      'other',
    ])
    expect(BEND_NEW_CON_STATUS_LEGEND.map((row) => row.flag)).toEqual([
      'UNVERIFIED',
      'STALE',
      'NOT DISCLOSED',
      'CONFLICT',
    ])
    expect(bendNewConChipFlags(BEND_NEW_CON_SAVINGS_CHIPS[0]!)).toEqual(
      expect.arrayContaining(['UNVERIFIED', 'CONFLICT', 'NOT DISCLOSED', 'STALE']),
    )
    expect([...BEND_NEW_CON_HOME_NAV_NAMES]).toEqual([
      'Parkside Place Phase 1',
      'Calaveras',
      'Easton',
      'Petrosa',
      'Acadia Pointe Phase 5 and 6',
      'Stevens Ranch',
    ])
  })

  it('matches recorded plats to MLS names without inventing a slug', () => {
    expect(
      bendNewConPlatMatchesName('Parkside Place Phase 1', {
        slug: 'parkside-place',
        label: 'Parkside Place',
      }),
    ).toBe(true)
    expect(
      bendNewConPlatMatchesName('Discovery West Phase 8 & 9', {
        slug: 'discovery-west',
        label: 'Discovery West',
      }),
    ).toBe(true)
    expect(
      bendNewConPlatMatchesName('Acadia Pointe Phase 5 and 6', {
        slug: 'acadia-pointe',
        label: 'Acadia Pointe',
      }),
    ).toBe(true)
    expect(
      bendNewConPlatMatchesName('Easton', { slug: 'easton', label: 'Easton' }),
    ).toBe(true)
    expect(
      bendNewConPlatMatchesName('Easton', { slug: 'petrosa', label: 'Petrosa' }),
    ).toBe(false)
    expect(
      bendNewConPlatMatchesName('Highland', { slug: 'awbrey-butte', label: 'Awbrey Butte' }),
    ).toBe(false)
  })

  it('keeps public NC copy free of em dashes (Matt lock 2026-09-20)', () => {
    const blobs = [
      BEND_NEW_CONSTRUCTION_TITLE,
      BEND_NEW_CONSTRUCTION_H1,
      BEND_NEW_CONSTRUCTION_DESCRIPTION,
      ...BEND_NEW_CON_FAQ.flatMap((item) => [item.question, item.answer]),
      ...BEND_NEW_CON_FINANCING.flatMap((offer) => [
        offer.builder,
        offer.title,
        ...offer.terms,
        ...offer.sources.map((source) => source.label),
      ]),
    ]
    for (const text of blobs) {
      expect(text, text).not.toContain('\u2014')
      expect(text, text).not.toMatch(/ -- /)
    }
    const page = readFileSync(resolve('app/new-construction/page.tsx'), 'utf8')
    expect(page).toContain('New homes in Bend: short answers')
    expect(page).not.toContain('New homes in Bend \u2014 short answers')
  })

  it('attaches per-home concessions only where the offer names that community (SITE-151)', () => {
    // Every attached row id is a real community in the snapshot.
    for (const name of Object.keys(BEND_NEW_CON_ROW_OFFERS)) {
      expect(BEND_NEW_CON_NAMED.some((row) => row.name === name)).toBe(true)
    }

    // Collier gets Golden Key, with the narrower-than-community caveat attached.
    const collier = bendNewConRowOffer('Collier')
    expect(collier?.kind).toBe('published')
    expect(bendNewConRowOffers('Collier').map((o) => o.id)).toEqual(['pahlisch-golden-key'])
    expect(bendNewConRowConcessionLine('Collier')).toBe('3% / $20,000, published credit cap')
    const colliersDeep = bendNewConRowConcessionReveal('Collier')
    expect(colliersDeep).toMatch(/Pahlisch Homes/)
    expect(colliersDeep).toMatch(/Collier lots/)
    expect(colliersDeep).toMatch(/pahlischhomes\.com\/golden-key/)

    // Easton and Petrosa share Pahlisch as builder but do NOT inherit Golden
    // Key — their own community pages published no separate concession.
    for (const name of ['Easton', 'Petrosa']) {
      const attach = bendNewConRowOffer(name)
      expect(attach?.kind).toBe('reviewed-no-concession')
      expect(bendNewConRowOffers(name)).toHaveLength(0)
      expect(bendNewConRowConcessionLine(name)).toBe('No published concession found (reviewed 2026-09-16)')
      expect(bendNewConRowConcessionReveal(name)).toMatch(/pahlischhomes\.com\/communities\//)
      // Explains why Golden Key does NOT apply here (Collier-only that day)
      // without ever claiming the credit for this community.
      expect(bendNewConRowConcessionReveal(name)).toMatch(/Collier lots only/)
    }

    // Stevens Ranch carries the Horton flyer's CONFLICT flag through.
    expect(bendNewConRowOffers('Stevens Ranch').map((o) => o.id)).toEqual([
      'horton-stevens-ranch-flyer',
    ])
    expect(bendNewConRowConcessionLine('Stevens Ranch')).toMatch(/CONFLICT/)

    // Parkside surfaces the most concrete Hayden offer first, and carries
    // its narrower-than-every-homesite caveat.
    expect(bendNewConRowOffers('Parkside Place Phase 1').map((o) => o.id)).toEqual([
      'hayden-parkside-10k',
      'hayden-zero-down',
      'hayden-summer-savings',
    ])
    expect(bendNewConRowConcessionLine('Parkside Place Phase 1')).toBe('$10K, on listed homesites')
    expect(bendNewConRowConcessionReveal('Parkside Place Phase 1')).toMatch(/Cascade homesite 67/)

    // A row with no sampled builder, and a row with a builder we did not
    // transcribe a concession for, both say nothing rather than imply one.
    expect(bendNewConRowOffer('Calaveras')).toBeNull()
    expect(bendNewConRowConcessionLine('Calaveras')).toBeNull()
    expect(bendNewConRowOffer('Stone Creek')).toBeNull()
    expect(bendNewConRowConcessionLine('Stone Creek')).toBeNull()
    expect(bendNewConRowOffer('Thunder Ridge')).toBeNull()
    expect(bendNewConRowOffer('unknown-row-name')).toBeNull()

    // Every offer id referenced in the map resolves to a real financing card.
    for (const attach of Object.values(BEND_NEW_CON_ROW_OFFERS)) {
      if (attach.kind !== 'published') continue
      for (const id of attach.offerIds) {
        expect(BEND_NEW_CON_FINANCING.some((offer) => offer.id === id)).toBe(true)
      }
    }
  })

  it('never lets a row concession reference MLS private remarks or a phone number (SITE-151 §0)', () => {
    const blobs = Object.keys(BEND_NEW_CON_ROW_OFFERS).flatMap((name) => [
      bendNewConRowConcessionLine(name) ?? '',
      bendNewConRowConcessionReveal(name) ?? '',
    ])
    const text = blobs.join('\n')
    expect(text).not.toMatch(/private remarks?/i)
    expect(text).not.toMatch(/\b\d{3}[.\-]\d{3}[.\-]\d{4}\b/) // no phone-number shape
    expect(text).not.toMatch(/call\s+\w+\s+at/i)
  })

  it('keeps FAQ answers on the transcribed snapshot and live-count split', () => {
    expect(BEND_NEW_CON_FAQ).toHaveLength(6)
    expect(BEND_NEW_CON_FAQ.map((item) => item.id)).toContain('faq-status-flags')
    const text = BEND_NEW_CON_FAQ.map((item) => item.answer).join('\n')
    expect(text).toMatch(/2026-09-16/)
    expect(text).toMatch(/UNVERIFIED/)
    expect(text).not.toMatch(MOS)
    expect(text).not.toMatch(INVENTED_HAYDEN_25K)
  })

  it('states the subdivision coverage rule honestly, with counts that trace to the same arrays the page renders (SITE-152)', () => {
    const counts = bendNewConCoverageCounts()
    // Every count is derived from the same constants the page maps over, so
    // this can never silently drift from what actually renders.
    expect(counts.total).toBe(BEND_NEW_CON_NAMED.length)
    expect(counts.shelf).toBe(BEND_NEW_CON_LEAD_NAMES.length)
    expect(counts.ledger).toBe(bendNewConRestPrimary().length)
    expect(counts.townhomes).toBe(BEND_NEW_CON_HORTON_TOWNHOME_NAMES.length)
    expect(counts.single).toBe(BEND_NEW_CON_SINGLE.length)
    expect(counts.rest).toBe(counts.total - counts.shelf)
    // Every named row lands in exactly one of the four sections — nothing
    // dropped, nothing double-counted.
    expect(counts.shelf + counts.ledger + counts.townhomes + counts.single).toBe(counts.total)

    const faq = BEND_NEW_CON_FAQ.find((item) => item.id === 'faq-coverage')
    expect(faq).toBeDefined()
    expect(faq!.answer).toContain(String(counts.total))
    expect(faq!.answer).toContain(String(counts.shelf))
    expect(faq!.answer).toContain(String(counts.rest))
    expect(faq!.answer).toContain(String(counts.ledger))
    expect(faq!.answer).toContain(String(counts.townhomes))
    expect(faq!.answer).toContain(String(counts.single))

    const page = readFileSync(resolve('app/new-construction/page.tsx'), 'utf8')
    expect(page).toContain('bendNewConCoverageCounts')
  })

  it('wires the overview map, savings chips, and contact on the public page', () => {
    const page = readFileSync(resolve('app/new-construction/page.tsx'), 'utf8')
    const chips = readFileSync(resolve('app/new-construction/_v3/NewConSavingsChips.tsx'), 'utf8')
    const home = readFileSync(resolve('app/_v3/home-new-construction.ts'), 'utf8')
    expect(page).toContain('<V3Atlas')
    expect(page).toContain('id="zones"')
    expect(page).toContain('<NewConSavingsChips')
    expect(page).toContain("id=\"tour\"")
    expect(page).toContain('BEND_NEW_CONSTRUCTION_H1')
    expect(page).toContain('priceSpanFold')
    expect(page).toContain("{ label: 'New construction' }")
    expect(page).toContain('FAQPage')
    expect(page).not.toMatch(/Hover a row/)
    expect(page).toMatch(/Open a row/)
    expect(chips).toContain('BEND_NEW_CON_SAVINGS_CHIPS')
    expect(chips).toContain('BEND_NEW_CON_STATUS_LEGEND')
    expect(chips).toContain('id="savings"')
    expect(home).toContain("href: '/new-construction'")
    expect(home).toContain("layout: 'carousel'")
  })
})
