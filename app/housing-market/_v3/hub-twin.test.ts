import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * SITE-178 — one indexable regional housing-market URL.
 *
 * Strip comments so a comment that names the twin cannot satisfy the gate.
 */
function code(path: string): string {
  return readFileSync(resolve(path), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
}

const hub = code('app/housing-market/page.tsx')
const region = code('app/housing-market/central-oregon/page.tsx')
const city = code('app/housing-market/[...slug]/_v3/city-view.tsx')
const geoMeta = code('app/housing-market/[...slug]/page.tsx')
const sitemap = code('app/sitemap.ts')

function metadataBlock(src: string): string {
  const start = src.indexOf('export async function generateMetadata')
  expect(start).toBeGreaterThan(-1)
  const end = src.indexOf('export default', start)
  expect(end).toBeGreaterThan(start)
  return src.slice(start, end)
}

describe('SITE-178 housing-market hub twin', () => {
  it('indexes the live hub and noindexes the region report', () => {
    const hubMeta = metadataBlock(hub)
    const regionMeta = metadataBlock(region)
    expect(hubMeta).toMatch(/path:\s*'\/housing-market'/)
    expect(hubMeta).not.toMatch(/noindex:\s*true/)
    expect(hubMeta).toMatch(/title:\s*'Central Oregon Housing Market'/)
    expect(regionMeta).toMatch(/path:\s*'\/housing-market\/central-oregon'/)
    expect(regionMeta).toMatch(/noindex:\s*true/)
    expect(regionMeta).toMatch(/title:\s*'Central Oregon housing market report'/)
    expect(regionMeta).not.toMatch(/homes for sale/)
  })

  it('does not list the noindexed region report in the sitemap', () => {
    expect(sitemap).toMatch(/\$\{baseUrl\}\/housing-market/)
    expect(sitemap).not.toMatch(/housing-market\/central-oregon/)
  })

  it('opens the hub on the live housing-market H1 and the leaf on a report H1', () => {
    expect(hub).toMatch(/`Central Oregon housing market/)
    expect(region).toMatch(/headline=\{v3Text\('Central Oregon housing market report'\)\}/)
    expect(region).not.toMatch(/`A \$\{verdict\.label\}`/)
  })

  it('keeps city market H1s on housing-market and MOS as two named bars on the city fold', () => {
    expect(city).toMatch(/\$\{cityName\} housing market/)
    expect(city).not.toMatch(/\$\{cityName\} homes for sale/)
    expect(city).toMatch(/homesName=\{placeMos\.homesName\}/)
    expect(city).toMatch(/salesName=\{placeMos\.salesName\}/)
    expect(city).toMatch(/id="market-mos"/)
    const drawing = city.slice(city.indexOf('drawing='))
    const mosAt = drawing.indexOf('<V3MosBars')
    const insightAt = drawing.indexOf('<CityInsight')
    expect(mosAt).toBeGreaterThan(-1)
    expect(insightAt).toBeGreaterThan(-1)
    expect(mosAt).toBeLessThan(insightAt)
  })

  it('does not rewrite geoTitle (SITE-171 / SITE-173)', () => {
    expect(geoMeta).toMatch(/function geoTitle\(/)
    expect(geoMeta).toMatch(/\$\{input\.geoName\} housing market 2026/)
  })
})
