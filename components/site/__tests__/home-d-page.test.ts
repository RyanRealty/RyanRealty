import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const read = (rel: string) => readFileSync(join(root, rel), 'utf8')

describe('home-d homepage restyle', () => {
  it('keeps the D11 H1 and regional lead literals', () => {
    const page = read('app/page.tsx')
    expect(page).toMatch(/titleTop="Central Oregon"/)
    expect(page).toMatch(/titleBottom="Homes for Sale"/)
    expect(page).toMatch(/across Central Oregon\. Live list prices and days on market\./)
    expect(page).toMatch(/Bend, Redmond, Sisters, Sunriver, La Pine, and Terrebonne\. Live list prices and days on market\./)
  })

  it('keeps the live hero video and Old Mill poster', () => {
    const hero = read('components/site/home-d/HomeDHero.client.tsx')
    expect(hero).toMatch(/\/videos\/hero-optimized\.mp4/)
    expect(hero).toMatch(/\/images\/hero\/hero-old-mill-master-4k\.jpg/)
  })

  it('does not invent listing addresses or park copy from the kit PNGs', () => {
    const page = read('app/page.tsx')
    expect(page).not.toMatch(/Cartwright/)
    expect(page).not.toMatch(/McClain/)
    expect(page).not.toMatch(/1840 Ridge Line/)
    expect(page).not.toMatch(/River West/)
    expect(page).not.toMatch(/Pioneer Reach/)
    expect(page).not.toMatch(/Tumalo Falls/)
  })

  it('does not mount a mid-page Ask me / Call band or broker photos on the dock', () => {
    const page = read('app/page.tsx')
    expect(page).not.toMatch(/<KbSell/)
    expect(page).not.toMatch(/<KbTeam/)
    expect(page).not.toMatch(/Ask me/)
    const dock = read('components/site/home-d/HomeDDock.client.tsx')
    expect(dock).not.toMatch(/headshot|broker\.|img/)
    expect(dock).toMatch(/Call/)
    expect(dock).toMatch(/Text/)
  })

  it('guest bar on home says Sign in, not Saved', () => {
    const chrome = read('components/site/v3/V3Chrome.tsx')
    expect(chrome).toMatch(/Sign in/)
    expect(chrome).toMatch(/isHome && SIGN_IN/)
  })

  it('luxury asks resolve a share label through publishListingShareKind', () => {
    const page = read('app/page.tsx')
    const luxury = read('components/site/home-d/HomeDLuxury.client.tsx')
    expect(page).toMatch(/from ['"]@\/lib\/listing\/publish-listing-share['"]/)
    expect(page).toMatch(/publishListingShareKind\s*\(/)
    expect(luxury).toMatch(/publishListingShareKind\s*\(/)
    expect(luxury).toMatch(/formatPublishedAsk\s*\(/)
  })

  it('each home-d section is a different object, not a second photo-tile grid', () => {
    const towns = read('components/site/home-d/HomeDTowns.client.tsx')
    const golf = read('components/site/home-d/HomeDGolf.client.tsx')
    const luxury = read('components/site/home-d/HomeDLuxury.client.tsx')
    expect(towns).toMatch(/HomeDTownsMapImpl/)
    expect(golf).toMatch(/home-d-golf-list/)
    expect(luxury).toMatch(/home-d-lux-rail/)
    expect(golf).not.toMatch(/comm-track/)
    expect(luxury).not.toMatch(/lst-grid/)
  })
})
