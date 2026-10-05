/**
 * Matt 2026-10-04: the Sunriver rail ran 7,759px down the desktop fold. Past
 * RAIL_FOLD_AT rows the rail folds behind "Show all", but every row stays in
 * the served HTML so each place name and its page link is still crawlable.
 */
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { PlaceSubdivisionMap, PlaceSubdivisionRail, RAIL_FOLD_AT } from '@/components/site/v3/PlaceSubdivisionMap.client'

const rail = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `Place ${i}`, href: `/subdivisions/place-${i}` }))

function html(n: number) {
  return renderToStaticMarkup(
    <PlaceSubdivisionMap placeName="Sunriver" rail={rail(n)} homes={[]} leases={[]} keysBySlug={{}} source="regional MLS">
      <PlaceSubdivisionRail id="child-places" />
    </PlaceSubdivisionMap>,
  )
}

describe('place rail fold', () => {
  it('hides rows past the fold but keeps every name and page link in the HTML', () => {
    const out = html(14)
    expect(RAIL_FOLD_AT).toBe(10)
    expect(out.match(/<li hidden=""/g)).toHaveLength(14 - RAIL_FOLD_AT)
    for (let i = 0; i < 14; i++) expect(out).toContain(`href="/subdivisions/place-${i}"`)
    expect(out).toContain('Show all 14')
    expect(out).toContain('aria-expanded="false"')
  })

  it('does not fold a short rail', () => {
    const out = html(RAIL_FOLD_AT)
    expect(out).not.toContain('hidden=""')
    expect(out).not.toContain('Show all')
  })
})
