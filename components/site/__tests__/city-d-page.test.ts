import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const read = (rel: string) => readFileSync(join(root, rel), 'utf8')

describe('city-d city template restyle', () => {
  it('keeps one /cities/[slug] template and the SEO H1', () => {
    const page = read('app/cities/[slug]/page.tsx')
    const hero = read('components/site/city-d/CityDHero.tsx')
    expect(page).toMatch(/CityDHero/)
    expect(hero).toMatch(/homes for sale/)
    expect(page).toMatch(/\$\{cityName\} homes for sale/)
    expect(page).toMatch(/generateStaticParams/)
    expect(page).not.toMatch(/app\/cities\/redmond\/page/)
  })

  it('keeps Spark, Chart Room Time/Relate/Rank, and live place names', () => {
    const page = read('app/cities/[slug]/page.tsx')
    expect(page).toMatch(/getMarketPulse/)
    expect(page).toMatch(/publishCityInventory/)
    expect(page).toMatch(/CityMarketCharts/)
    expect(page).toMatch(/cityResorts/)
    expect(page).toMatch(/nearbyPlacesForCity/)
    const charts = read('app/cities/[slug]/_v3/city-market-charts.tsx')
    expect(charts).toMatch(/buildYearCard/)
    expect(charts).toMatch(/buildRelateCard/)
    expect(charts).toMatch(/buildMosCard/)
    expect(charts).toMatch(/Chart Room Time/)
  })

  it('does not invent parks, HOA dollars, /places, or a Crooked River Ranch city page', () => {
    const page = read('app/cities/[slug]/page.tsx')
    const data = read('app/cities/[slug]/_v3/city-d-data.ts')
    const nearby = read('components/site/city-d/CityDNearby.tsx')
    const hero = read('components/site/city-d/CityDHero.tsx')
    const footer = read('components/site/city-d/CityDFooter.tsx')
    const blob = `${page}\n${data}\n${nearby}\n${hero}\n${footer}`
    expect(blob).not.toMatch(/\/places/)
    expect(blob).not.toMatch(/\$[0-9]+\/mo HOA/)
    expect(blob).not.toMatch(/Cartwright/)
    expect(blob).not.toMatch(/\$[0-9]+\/mo/)
    expect(data).toMatch(/crooked-river-ranch/)
    expect(data).toMatch(/slug !== 'crooked-river-ranch'/)
  })

  it('does not mount chips, mid-page Ask me, or broker photos', () => {
    const page = read('app/cities/[slug]/page.tsx')
    expect(page).not.toMatch(/<KbPopularSearches/)
    expect(page).not.toMatch(/<KbSell/)
    expect(page).not.toMatch(/<KbTeam/)
    expect(page).not.toMatch(/Ask me/)
    const dock = read('components/site/city-d/CityDDock.client.tsx')
    expect(dock).not.toMatch(/headshot|broker\.|img/)
    expect(dock).toMatch(/Call/)
    expect(dock).toMatch(/Text/)
    const walk = read('components/site/city-d/CityDWalk.tsx')
    expect(walk).not.toMatch(/img/)
  })

  it('does not say plat, nest, parent, CDP, or Feeders on the city-d surface', () => {
    const files = [
      'app/cities/[slug]/page.tsx',
      'app/cities/[slug]/_v3/city-d-data.ts',
      'components/site/city-d/CityDHero.tsx',
      'components/site/city-d/CityDPitch.tsx',
      'components/site/city-d/CityDNearby.tsx',
      'components/site/city-d/CityDMarket.tsx',
      'components/site/city-d/CityDSchools.tsx',
      'components/site/city-d/CityDReviews.tsx',
      'components/site/city-d/CityDWalk.tsx',
      'components/site/city-d/CityDFooter.tsx',
    ]
    for (const file of files) {
      const src = read(file)
      expect(src).not.toMatch(/\bplat\b/i)
      expect(src).not.toMatch(/\bnest\b/i)
      expect(src).not.toMatch(/\bparent\b/i)
      expect(src).not.toMatch(/\bCDP\b/)
      expect(src).not.toMatch(/\bFeeders\b/i)
    }
  })

  it('hero crumb is names only', () => {
    const page = read('app/cities/[slug]/page.tsx')
    expect(page).toMatch(/label: 'Places'/)
    expect(page).toMatch(/City of \$\{cityName\}/)
    expect(page).not.toMatch(/href: '\/places'/)
  })
})
