import { describe, expect, it } from 'vitest'
import { answeredRows, decidePlatRobots } from '@/lib/site/plat-robots'
import type { IndexableSubdivision, PlatClosedCount } from '@/lib/data/subdivisions/subdivision-index'

const SET: IndexableSubdivision[] = [
  { slug: 'blakley-heights', name: 'Blakley Heights', citySlug: 'bend', closedCount: 40 },
  { slug: 'waywest-properties', name: 'Waywest Properties', citySlug: 'bend', closedCount: 3245 },
]

function row(slug: string, closedCount: number): PlatClosedCount {
  return {
    slug,
    label: slug,
    closedCount,
    closedInPolygon: closedCount,
    closedByName: 0,
    closedCountSfr: closedCount,
    topCityLower: 'bend',
    lastCloseDate: null,
    closedByYear: {},
  }
}

describe('decidePlatRobots', () => {
  it('uses indexable-set membership when the set answered, exactly as before', () => {
    const inSet = decidePlatRobots({ slug: 'blakley-heights', indexableSet: SET, platClosedCounts: null, hasPolygon: null })
    expect(inSet).toMatchObject({ noindex: false, known: true, basis: 'indexable-set' })
    expect(inSet.entry?.citySlug).toBe('bend')

    const notInSet = decidePlatRobots({ slug: 'bartel-addition', indexableSet: SET, platClosedCounts: null, hasPolygon: true })
    expect(notInSet).toMatchObject({ noindex: true, known: true, entry: null, basis: 'indexable-set' })
  })

  it('never reads a fallen-back empty set as "not indexable" (the noindex-on-a-sitemapped-plat case)', () => {
    const v = decidePlatRobots({ slug: 'blakley-heights', indexableSet: null, platClosedCounts: null, hasPolygon: true })
    expect(v.noindex).toBe(false)
    expect(v.known).toBe(false)
    expect(v.basis).toBe('unknown')
  })

  it('treats an empty array like an unanswered set', () => {
    const v = decidePlatRobots({ slug: 'blakley-heights', indexableSet: [], platClosedCounts: null, hasPolygon: null })
    expect(v).toMatchObject({ noindex: false, known: false })
  })

  it('noindexes a plat the boundary read says has no polygon, whatever else failed', () => {
    const v = decidePlatRobots({ slug: 'pettigrew-place', indexableSet: null, platClosedCounts: null, hasPolygon: false })
    expect(v).toMatchObject({ noindex: true, known: true, basis: 'no-polygon' })
  })

  it('applies the same floor to the plat’s own closed-count row when only that set answered', () => {
    const counts = [row('blakley-heights', 40), row('bartel-addition', 9)]
    expect(
      decidePlatRobots({ slug: 'blakley-heights', indexableSet: null, platClosedCounts: counts, hasPolygon: null }),
    ).toMatchObject({ noindex: false, known: true, basis: 'plat-closed-count' })
    expect(
      decidePlatRobots({ slug: 'bartel-addition', indexableSet: null, platClosedCounts: counts, hasPolygon: null }),
    ).toMatchObject({ noindex: true, known: true, basis: 'plat-closed-count' })
    // absent from the MV = no closed sale recorded inside it
    expect(
      decidePlatRobots({ slug: 'courtyard-garages-at-broken-top', indexableSet: null, platClosedCounts: counts, hasPolygon: true }),
    ).toMatchObject({ noindex: true, known: true })
  })

  it('holds the floor at exactly ten lifetime sales (R-123)', () => {
    const counts = [row('ten', 10), row('nine', 9)]
    expect(decidePlatRobots({ slug: 'ten', indexableSet: null, platClosedCounts: counts, hasPolygon: null }).noindex).toBe(false)
    expect(decidePlatRobots({ slug: 'nine', indexableSet: null, platClosedCounts: counts, hasPolygon: null }).noindex).toBe(true)
  })

  it('normalises the slug the way the set stores it', () => {
    expect(
      decidePlatRobots({ slug: ' Blakley-Heights ', indexableSet: SET, platClosedCounts: null, hasPolygon: null }).noindex,
    ).toBe(false)
  })
})

describe('answeredRows', () => {
  it('returns rows only when the read answered with rows', () => {
    expect(answeredRows({ ok: true, value: [1, 2] })).toEqual([1, 2])
    expect(answeredRows({ ok: true, value: [] })).toBeNull()
    expect(answeredRows({ ok: false, value: [1] })).toBeNull()
  })
})
