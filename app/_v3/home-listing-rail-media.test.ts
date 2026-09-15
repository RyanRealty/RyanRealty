import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const rail = readFileSync('app/_v3/HomeListingRail.client.tsx', 'utf8')
const rowCss = readFileSync('components/site/v3/V3ListingRow.css', 'utf8')
const railCss = readFileSync('app/_v3/home-homes-rails.css', 'utf8')

describe('HomeListingRail in-card gallery', () => {
  it('mounts SplitCardMedia on the homepage Homes rail (not search-only)', () => {
    expect(rail).toContain("from '@/components/site/v3/SplitCardMedia'")
    expect(rail).toContain('<SplitCardMedia')
    expect(rail).toContain('urls={card.photoUrls}')
    expect(rail).toContain('href={card.href}')
  })

  it('shows photo chevrons on home-rail cards (not only .v3-lrow hover)', () => {
    expect(rowCss).toContain('.home-rail__card:hover .v3-lrow__nav')
    expect(rowCss).toContain('.v3-lrow__media:hover .v3-lrow__nav')
    expect(rowCss).toContain('@media (hover: none)')
  })

  it('keeps street and city from gluing (LoopRedmond)', () => {
    expect(rail).toContain('home-rail__addr')
    expect(rail).toContain('home-rail__city')
    expect(railCss).toMatch(/\.home-rail__addr,\s*\.home-rail__city\s*\{[\s\S]*display:\s*block/)
  })
})
