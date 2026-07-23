// W3.4 — the DAL half of the /site-index freshness contract, verified on the
// REAL exported value (import, not text-match) so no decoy string / template /
// comment can fool it. The page's `if (data.generatedAt === null) noStore()`
// guard only prevents an empty derivation from being cached if the empty
// fallback's generatedAt actually IS null. If it ever becomes a timestamp, the
// guard silently goes dark and a failed derivation gets pinned into the ISR
// window — so this pins the sentinel.
import { describe, it, expect } from 'vitest'
import { EMPTY_SITE_INDEX } from './getSiteIndexLinks'

describe('site-index freshness contract (W3.4)', () => {
  it('the empty/failed fallback carries generatedAt === null (the noStore sentinel)', () => {
    expect(EMPTY_SITE_INDEX.generatedAt).toBeNull()
  })

  it('the empty fallback is genuinely empty — no fabricated links ride a failed derivation', () => {
    expect(EMPTY_SITE_INDEX.cities).toEqual([])
    expect(EMPTY_SITE_INDEX.citySearches).toEqual([])
    expect(EMPTY_SITE_INDEX.communities).toEqual([])
    expect(EMPTY_SITE_INDEX.subdivisions).toEqual([])
  })
})
