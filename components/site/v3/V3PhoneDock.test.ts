import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = readFileSync(resolve('components/site/v3/V3PhoneDock.client.tsx'), 'utf8')
const CSS = readFileSync(resolve('components/site/v3/V3PhoneDock.css'), 'utf8')
const CHROME = readFileSync(resolve('components/site/v3/V3Chrome.tsx'), 'utf8')
const LAYOUT = readFileSync(resolve('app/layout.tsx'), 'utf8')
const LISTING_PAGE = readFileSync(resolve('app/listing/[listingKey]/page.tsx'), 'utf8')

describe('V3WorkWithUs sheet · Matt / Critiquito CTA lock 2026-09-19', () => {
  it('still exists as a sheet, but the chrome no longer opens it (Matt 2026-09-21, SITE-155)', () => {
    // The 2026-09-19 lock made the header one of this sheet's openers. Matt
    // reversed that on 2026-09-21 and gave the job to V3DogFloater
    // (SITE-153). The SHEET is untouched and still opens from the listing
    // agent card; only the chrome stopped opening it. Asserting the absence
    // here so the trigger cannot quietly return to the header.
    expect(SRC).toContain('export function V3WorkWithUs')
    expect(CHROME).not.toMatch(/<V3WorkWithUs/)
    expect(CHROME).not.toMatch(/from '\.\/V3PhoneDock\.client'/)
    expect(LAYOUT).not.toMatch(/<V3PhoneDock/)
    expect(LISTING_PAGE).not.toMatch(/<ListingBrokerBar/)
    expect(LISTING_PAGE).not.toMatch(/<ListingMobileContactBar/)
    expect(LISTING_PAGE).not.toMatch(/<V3PhoneDock[\s/>]/)
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
