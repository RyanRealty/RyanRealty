import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { listingsResultsKind } from '../../app/search/[...slug]/sections/listings-results-kind'
import { withTimeout, withTimeoutSettled } from '../../app/search/[...slug]/fetch-guards'

const repo = process.cwd()
const read = (rel: string) => readFileSync(join(repo, rel), 'utf8')

describe('listingsResultsKind', () => {
  it('asks for a city when there is no scope', () => {
    expect(listingsResultsKind({ city: undefined, hasFilterOnly: false, listingCount: 0 })).toBe('no-scope')
  })

  it('does not treat a degraded timeout as an empty market', () => {
    expect(
      listingsResultsKind({ city: 'Bend', hasFilterOnly: false, listingCount: 0, degraded: true }),
    ).toBe('degraded')
  })

  it('uses the friendly empty state only after a clean zero', () => {
    expect(
      listingsResultsKind({ city: 'Bend', hasFilterOnly: false, listingCount: 0, degraded: false }),
    ).toBe('empty')
  })

  it('still renders a grid when some rows arrived even if the fetch flagged degraded', () => {
    expect(
      listingsResultsKind({ city: 'Bend', hasFilterOnly: false, listingCount: 4, degraded: true }),
    ).toBe('grid')
  })
})

describe('withTimeoutSettled', () => {
  it('resolves data and is not degraded when the promise wins', async () => {
    const settled = await withTimeoutSettled(
      Promise.resolve({ listings: [1], totalCount: 1 }),
      { listings: [], totalCount: 0 },
      50,
    )
    expect(settled).toEqual({ data: { listings: [1], totalCount: 1 }, degraded: false })
  })

  it('marks timeout as degraded and does not invent a real zero', async () => {
    vi.useFakeTimers()
    const pending = withTimeoutSettled(new Promise(() => {}), { listings: [], totalCount: 0 }, 20)
    await vi.advanceTimersByTimeAsync(25)
    const settled = await pending
    vi.useRealTimers()
    expect(settled.degraded).toBe(true)
    expect(settled.data).toEqual({ listings: [], totalCount: 0 })
  })

  it('marks rejection as degraded', async () => {
    const settled = await withTimeoutSettled(
      Promise.reject(new Error('db')),
      { listings: [], totalCount: 0 },
      50,
    )
    expect(settled.degraded).toBe(true)
    expect(settled.data.totalCount).toBe(0)
  })
})

describe('withTimeout', () => {
  it('still returns the fallback on rejection', async () => {
    await expect(withTimeout(Promise.reject(new Error('db')), 'fallback', 20)).resolves.toBe('fallback')
  })
})

describe('SEO search honesty contracts', () => {
  const page = read('app/search/[...slug]/page.tsx')
  const map = read('app/search/[...slug]/sections/MapSplitView.tsx')
  const golf = read('app/search/[...slug]/sections/GolfBranch.tsx')
  const listings = read('app/search/[...slug]/sections/ListingsResults.tsx')

  it('skips the 12s grid listings fetch on map/split', () => {
    const mapReturn = page.indexOf('return renderMapSplitView')
    const gridFetch = page.indexOf('getListingsWithAdvanced({ ...filterOpts, limit: pageSize, offset })')
    expect(mapReturn).toBeGreaterThan(0)
    expect(gridFetch).toBeGreaterThan(mapReturn)
    expect(page).toMatch(/const isMapSplitView = \(sp\.view === 'map' \|\| sp\.view === 'split'\)/)
  })

  it('prints the all-types caption on the city header intro', () => {
    expect(page).toMatch(/grain: filterOpts\.propertyType \? 'filter-match' : 'all-types'/)
    expect(page).toMatch(/const headerIntro = headerPublished \? `\$\{headerPublished\.phrase\}\.` : ''/)
    expect(page).toMatch(/\{headerIntro\}/)
  })

  it('passes neighborhood into MapSplitView and does not seed the map as a subdivision', () => {
    expect(map).toMatch(/neighborhood: neighborhoodName/)
    expect(map).toMatch(/subdivision: neighborhoodName \? undefined : decodedSubdivision/)
    expect(map).toMatch(/getListingsWithAdvanced\(\{/)
    expect(map).toMatch(/neighborhood: neighborhoodName/)
    expect(map).toMatch(/neighborhood: neighborhoodName \?\? ''/)
  })

  it('does not coerce empty (active+pending) map status to Active', () => {
    expect(map).toMatch(/status: status,/)
    expect(map).not.toMatch(/status: status \|\| 'Active'/)
  })

  it('golf landing uses a settled timeout and a degraded empty, not a fake zero market', () => {
    expect(golf).toMatch(/withTimeoutSettled\(getGolfHomesForLanding/)
    expect(golf).toMatch(/homesDegraded=\{homesDegraded\}/)
    expect(golf).not.toMatch(/withTimeout\(getGolfHomesForLanding/)
  })

  it('never says no homes match on the degraded listings branch', () => {
    expect(listings).toMatch(/kind === 'degraded'/)
    expect(listings).toMatch(/We could not load listings in time/)
    expect(listings).toMatch(/not an empty market/)
    const degradedBlock = listings.slice(
      listings.indexOf("kind === 'degraded'"),
      listings.indexOf("kind === 'empty'"),
    )
    expect(degradedBlock).not.toMatch(/No homes match/)
  })
})

describe('GTM and gtag do not both configure GA4', () => {
  const ga = read('components/GoogleAnalytics.tsx')
  const gtm = read('components/GTMHead.tsx')

  it('skips gtag GA4 config when the GTM container id is set', () => {
    expect(ga).toMatch(/const hasGTM = !!GTM_ID/)
    expect(ga).toMatch(/const hasGA4 = !!GA4_ID && !hasGTM/)
  })

  // Re-pinned 2026-09-01: load-suppression ("only after consent") made every
  // non-consenting visitor invisible to GA4 from 2026-08-18 on, because the
  // GA4 config tag lives inside the GTM container. The policy-correct shape is
  // Consent Mode v2 — always load on production with denied defaults pushed
  // BEFORE gtm.js, consent updates on the banner event.
  it('loads GTM with Consent Mode v2, never load-suppression', () => {
    expect(gtm).toMatch(/hasAnalyticsConsent/)
    expect(gtm).toMatch(/consent','default'|consent','default'/)
    expect(gtm).toMatch(/wait_for_update/)
    expect(gtm).not.toMatch(/if \(!GTM_ID \|\| !consent\) return null/)
    // The defaults must be in the same inline script, ahead of the gtm.js bootstrap.
    const inline = gtm.slice(gtm.indexOf('__html'))
    expect(inline.indexOf("consent','default'")).toBeGreaterThan(-1)
    expect(inline.indexOf("consent','default'")).toBeLessThan(inline.indexOf('gtm.js'))
  })
})

describe('map pan keeps neighborhood scope', () => {
  const search = read('app/actions/search.ts')
  const mapView = read('components/search/MapSearchView.tsx')

  it('SearchFilters and viewport mapping carry neighborhood', () => {
    expect(search).toMatch(/neighborhood\?: string/)
    expect(search).toMatch(/neighborhood: f\.neighborhood\?\.trim\(\) \|\| undefined/)
  })

  it('client viewport refetch passes neighborhood through', () => {
    expect(mapView).toMatch(/neighborhood: f\.neighborhood \|\| undefined/)
  })
})
