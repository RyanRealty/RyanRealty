import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const hub = readFileSync(resolve('app/housing-market/page.tsx'), 'utf8')
const city = readFileSync(resolve('app/housing-market/[...slug]/_v3/city-view.tsx'), 'utf8')
const community = readFileSync(resolve('app/housing-market/[...slug]/_v3/community-view.tsx'), 'utf8')
const region = readFileSync(resolve('app/housing-market/central-oregon/page.tsx'), 'utf8')
const geoMeta = readFileSync(resolve('app/housing-market/[...slug]/page.tsx'), 'utf8')

describe('market instruments fold the leftover KPI wall', () => {
  it('opens on the chart, with leftover tiles folded, on hub city community and region', () => {
    expect(hub).toMatch(/chartFirst/)
    expect(hub).toMatch(/foldAfter=\{0\}/)
    expect(city).toMatch(/chartFirst/)
    expect(city).toMatch(/foldAfter=\{0\}/)
    expect(community).toMatch(/chartFirst/)
    expect(community).toMatch(/foldAfter=\{0\}/)
    expect(region).toMatch(/chartFirst/)
    expect(region).toMatch(/foldAfter=\{0\}/)
  })

  it('draws MOS on the hub opening instrument, not two leftover tiles above the chart', () => {
    expect(hub).toMatch(/buildMosSupplyChart/)
    expect(hub).toMatch(/chart=\{mosChart \?\? regionChart\}/)
    expect(hub).toMatch(/label: v3Text\('a month of sales'\)/)
    expect(hub).toMatch(/chartFirst/)
    expect(hub).toMatch(/foldAfter=\{0\}/)
  })

  it('does not retarget {city} homes for sale in market metadata keywords', () => {
    const start = geoMeta.indexOf('keywords:')
    expect(start).toBeGreaterThan(-1)
    const block = geoMeta.slice(start, start + 500)
    expect(block).not.toMatch(/homes for sale/)
    expect(geoMeta).not.toMatch(/\$\{geoName\} homes for sale/)
  })
})
