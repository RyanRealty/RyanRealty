import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = readFileSync(resolve('components/site/v3/V3PhoneDock.client.tsx'), 'utf8')
const CSS = readFileSync(resolve('components/site/v3/V3PhoneDock.css'), 'utf8')
const LISTING = readFileSync(
  resolve('components/site/listing-detail/ListingMobileContactBar.client.tsx'),
  'utf8',
)

describe('V3PhoneDock sheet · Matt voice 2026-09-16', () => {
  it('is the one sheet the listing bar opens', () => {
    expect(LISTING).toContain('V3WorkWithUs')
    expect(LISTING).toContain("from '@/components/site/v3/V3PhoneDock.client'")
    expect(SRC).toContain('export function V3WorkWithUs')
  })

  it('keeps the dock chip and titles the sheet Buy or sell', () => {
    expect(SRC).toMatch(/data-v3-dock-ask="true"[\s\S]*Work with us/)
    expect(SRC).toContain('Buy or sell')
    expect(SRC).toContain('Boutique Central Oregon buy-and-sell firm.')
  })

  it('does not lecture a broker count or syrup the head', () => {
    expect(SRC).not.toMatch(/BROKERS/)
    expect(SRC).not.toMatch(/BROKER_COUNT/)
    expect(SRC).not.toMatch(/COUNT_WORD/)
    expect(SRC).not.toMatch(/Three brokers|two brokers|\d+ brokers/i)
    expect(SRC).not.toMatch(/whole of Central Oregon/)
    expect(SRC).not.toMatch(/Ryan Realty is a Bend brokerage/)
  })

  it('teases the doors without echoing the /sell headline', () => {
    expect(SRC).toContain('See homes on the map.')
    expect(SRC).toContain('Get a pricing take on your home.')
    expect(SRC).not.toMatch(/Value my home: a written valuation from a principal broker/)
    expect(SRC).not.toMatch(/Sell your home in Central Oregon/)
  })

  it('keeps About / team / reviews / contact, with the street under Call and Text', () => {
    expect(SRC).toContain("label: 'About'")
    expect(SRC).toContain("label: 'Our team'")
    expect(SRC).toContain("label: 'Client reviews'")
    expect(SRC).toContain("label: 'Contact'")
    expect(SRC).toContain('BRAND.address.street')
    expect(SRC).toContain('v3-dock-sheet__addr')
    expect(CSS).toContain('.v3-dock-sheet__addr')
    expect(CSS).toContain('var(--v3-navy)')
    expect(CSS).toContain('var(--v3-surface)')
  })
})
