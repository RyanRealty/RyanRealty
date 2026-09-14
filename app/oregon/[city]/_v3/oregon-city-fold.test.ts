import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  OREGON_CITY_FIGURE_FOLD_AFTER,
  buildOregonCityClaim,
  buildOregonCityHonestyDescription,
  buildOregonCityItemListName,
  buildOregonCityMixChart,
  buildOregonCityTitle,
} from './oregon-city-fold'

const PAGE = readFileSync(new URL('../page.tsx', import.meta.url), 'utf8')
const HONESTY = readFileSync(new URL('./OregonCityHonesty.tsx', import.meta.url), 'utf8')
const HONESTY_CSS = readFileSync(new URL('./OregonCityHonesty.css', import.meta.url), 'utf8')
const CATALOG = readFileSync(new URL('../../../../design_system/public/taste-catalog.json', import.meta.url), 'utf8')

describe('oregon-city fold helpers', () => {
  it('puts the live count in the title for SEO', () => {
    expect(buildOregonCityTitle({ name: 'Medford', activeAllCount: 725 })).toBe(
      '725 Medford homes for sale — outside our market',
    )
    expect(buildOregonCityTitle({ name: 'Medford', activeAllCount: 0 })).toBe(
      'Medford homes for sale — outside our market',
    )
  })

  it('states all three snapshot figures in one claim without SFR jargon', () => {
    expect(
      buildOregonCityClaim({
        name: 'Medford',
        activeAllCount: 725,
        activeSfrCount: 342,
        medianAsk: '$467,000',
      }),
    ).toBe('725 live listings in Medford. 342 are houses. Typical ask $467,000.')
  })

  it('states the live count in the honesty description', () => {
    expect(buildOregonCityHonestyDescription({ name: 'Medford', activeAllCount: 718 })).toBe(
      '718 live listings below are from the statewide MLS. We work Central Oregon, not Medford. Ask for a local broker introduction.',
    )
    expect(buildOregonCityHonestyDescription({ name: 'Medford', activeAllCount: 0 })).toBe(
      'We work Central Oregon, not Medford. Ask for a local broker introduction.',
    )
  })

  it('draws two bars for on-the-market vs houses', () => {
    const chart = buildOregonCityMixChart({
      name: 'Medford',
      activeAllCount: 718,
      activeSfrCount: 339,
    })
    expect(chart?.kind).toBe('bars')
    expect(chart?.series?.[0]?.points).toHaveLength(2)
    expect(chart?.series?.[0]?.points?.[0]?.value).toBe(718)
    expect(chart?.series?.[0]?.points?.[1]?.value).toBe(339)
    expect(buildOregonCityMixChart({ name: 'Medford', activeAllCount: 0, activeSfrCount: 0 })).toBeNull()
  })

  it('puts price and beds/baths/sqft on the ItemList name', () => {
    expect(
      buildOregonCityItemListName({
        address: '3311 Biddle Rd, Medford',
        price: '$1,850,000',
        detail: '4 bd · 3 ba · 3,200 sqft',
      }),
    ).toBe('3311 Biddle Rd, Medford · $1,850,000 · 4 bd · 3 ba · 3,200 sqft')
  })
})

describe('oregon-city page holds the SITE-105 catalog object', () => {
  it('puts a two-bar drawing first and folds the KPI tiles', () => {
    expect(OREGON_CITY_FIGURE_FOLD_AFTER).toBe(0)
    expect(PAGE).toContain('foldAfter={mixChart ? OREGON_CITY_FIGURE_FOLD_AFTER : undefined}')
    expect(PAGE).toContain('chartFirst={mixChart != null}')
    expect(PAGE).toContain('buildOregonCityMixChart')
    expect(PAGE).not.toMatch(/kind:\s*'range'/)
    expect(PAGE).toContain('buildOregonCityItemListName')
    expect(PAGE).toContain('buildOregonCityTitle')
    expect(PAGE).toContain('OregonCityHonesty')
    expect(PAGE).toContain('id="about"')
    expect(PAGE).toContain('id="listings"')
    expect(PAGE.indexOf('id="listings"')).toBeLessThan(PAGE.indexOf('HOME_MARKET_EDGES]}'))
  })

  it('keeps the installed Alert as a stacked card, not a Quiet strip', () => {
    expect(HONESTY).toContain("from '@/components/ui/alert'")
    expect(HONESTY).toContain("from '@/components/ui/button'")
    expect(HONESTY).toContain('name="InfoCircle"')
    expect(HONESTY).toContain('<AlertAction')
    expect(HONESTY).toContain('variant="outline"')
    expect(HONESTY).toContain('oregon-city-honesty')
    expect(HONESTY).not.toContain('v3-quiet')
    expect(HONESTY).not.toContain('V3Quiet.css')
    expect(HONESTY_CSS).toContain('[data-slot=\'alert-title\']')
    expect(HONESTY_CSS).not.toMatch(/border-radius:\s*0/)
    expect(HONESTY_CSS).not.toMatch(/width:\s*100%/)
  })

  it('asks the judge to shoot listings as well as the figure fold', () => {
    expect(CATALOG).toContain('figures-open=#top .v3-instrument__fold-summary!click')
    expect(CATALOG).toContain('listings=#listings')
  })
})
