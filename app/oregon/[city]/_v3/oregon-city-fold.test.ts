import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  OREGON_CITY_FIGURE_FOLD_AFTER,
  buildOregonCityClaim,
  buildOregonCityHonestyDescription,
  buildOregonCityItemListName,
  buildOregonCityTitle,
} from './oregon-city-fold'

const PAGE = readFileSync(new URL('../page.tsx', import.meta.url), 'utf8')
const HONESTY = readFileSync(new URL('./OregonCityHonesty.tsx', import.meta.url), 'utf8')
const QUIET = readFileSync(new URL('../../../../components/site/v3/V3Quiet.tsx', import.meta.url), 'utf8')
const QUIET_CSS = readFileSync(new URL('../../../../components/site/v3/V3Quiet.css', import.meta.url), 'utf8')

describe('oregon-city fold helpers', () => {
  it('puts the live count in the title for SEO', () => {
    expect(buildOregonCityTitle({ name: 'Medford', activeAllCount: 725 })).toBe(
      '725 Medford homes for sale — outside our market',
    )
    expect(buildOregonCityTitle({ name: 'Medford', activeAllCount: 0 })).toBe(
      'Medford homes for sale — outside our market',
    )
  })

  it('states all three snapshot figures in one claim', () => {
    expect(
      buildOregonCityClaim({
        name: 'Medford',
        activeAllCount: 725,
        activeSfrCount: 342,
        medianAsk: '$467,000',
      }),
    ).toBe('725 live listings in Medford. 342 are single-family. Median ask $467,000.')
  })

  it('states the live count in the honesty description', () => {
    expect(buildOregonCityHonestyDescription({ name: 'Medford', activeAllCount: 718 })).toBe(
      '718 live listings below are from the statewide MLS. We work Central Oregon, not Medford. Ask for a local broker introduction.',
    )
    expect(buildOregonCityHonestyDescription({ name: 'Medford', activeAllCount: 0 })).toBe(
      'We work Central Oregon, not Medford. Ask for a local broker introduction.',
    )
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
  it('folds extra figures and does not draw an asking-price lollipop', () => {
    expect(OREGON_CITY_FIGURE_FOLD_AFTER).toBe(1)
    expect(PAGE).toContain('foldAfter={OREGON_CITY_FIGURE_FOLD_AFTER}')
    expect(PAGE).not.toMatch(/kind:\s*'range'/)
    expect(PAGE).not.toContain('chartFirst')
    expect(PAGE).toContain('buildOregonCityItemListName')
    expect(PAGE).toContain('buildOregonCityTitle')
    expect(PAGE).toContain('OregonCityHonesty')
    expect(PAGE).toContain('id="about"')
  })

  it('keeps the installed Alert icon, title, description, and AlertAction button', () => {
    expect(HONESTY).toContain("from '@/components/ui/alert'")
    expect(HONESTY).toContain("from '@/components/ui/button'")
    expect(HONESTY).toContain('name="InfoCircle"')
    expect(HONESTY).toContain('<AlertAction')
    expect(HONESTY).toContain('variant="outline"')
    expect(QUIET).toContain("from '@/components/ui/alert'")
    expect(QUIET).toContain("from '@/components/ui/button'")
    expect(QUIET_CSS).not.toMatch(/border-left:\s*var\(--v3-rule-weight-section\)/)
    expect(QUIET_CSS).not.toMatch(/border-radius:\s*0/)
  })
})
