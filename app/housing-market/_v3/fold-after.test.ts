import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const hub = readFileSync(resolve('app/housing-market/page.tsx'), 'utf8')
const city = readFileSync(resolve('app/housing-market/[...slug]/_v3/city-view.tsx'), 'utf8')
const community = readFileSync(resolve('app/housing-market/[...slug]/_v3/community-view.tsx'), 'utf8')
const region = readFileSync(resolve('app/housing-market/central-oregon/page.tsx'), 'utf8')
const geoMeta = readFileSync(resolve('app/housing-market/[...slug]/page.tsx'), 'utf8')

describe('market instruments fold the leftover KPI wall', () => {
  it('passes foldAfter={2} on the hub, city, community, and region opening instruments', () => {
    expect(hub).toMatch(/foldAfter=\{2\}/)
    expect(city).toMatch(/foldAfter=\{2\}/)
    expect(community).toMatch(/foldAfter=\{2\}/)
    expect(region).toMatch(/foldAfter=\{2\}/)
  })

  it('does not retarget {city} homes for sale in market metadata keywords', () => {
    const start = geoMeta.indexOf('keywords:')
    expect(start).toBeGreaterThan(-1)
    const block = geoMeta.slice(start, start + 500)
    expect(block).not.toMatch(/homes for sale/)
    expect(geoMeta).not.toMatch(/\$\{geoName\} homes for sale/)
  })
})
