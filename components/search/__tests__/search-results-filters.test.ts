import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/app/actions/search', () => ({ getSearchListings: vi.fn() }))
vi.mock('@/app/actions/hidden-listings', () => ({ getHiddenListingKeys: vi.fn() }))
vi.mock('next/link', () => ({ default: (props: { children?: unknown }) => props.children }))

import { toSearchListingsFilters } from '@/components/search/SearchResults'

function readSrc(rel: string): string {
  return readFileSync(resolve(rel), 'utf8')
}

describe('SearchResults loadMore filter shape (page 2 matches page 1)', () => {
  const src = readSrc('components/search/SearchResults.tsx')

  it('exports toSearchListingsFilters with registry passthrough + max beds/baths', () => {
    expect(src).toMatch(/export function toSearchListingsFilters/)
    expect(src).toMatch(/for \(const def of SEARCH_FIELDS\)/)
    expect(src).toMatch(/maxBeds: f\.maxBeds \? Number\(f\.maxBeds\) : undefined/)
    expect(src).toMatch(/maxBaths: f\.maxBaths \? Number\(f\.maxBaths\) : undefined/)
    expect(src).toMatch(/hasFireplace: f\.hasFireplace === '1' \? true : undefined/)
    expect(src).toMatch(/hasGolfCourse: f\.hasGolfCourse === '1' \? true : undefined/)
  })

  it('loadMore uses toSearchListingsFilters instead of a hand-written subset', () => {
    expect(src).toMatch(/getSearchListings\(\s*toSearchListingsFilters\(filters\),\s*nextPage/)
    expect(src).not.toMatch(/status: filters\.status \|\| 'Active'/)
  })

  it('does not coerce an explicit empty status to Active', () => {
    expect(src).toMatch(/status: f\.status \?\? 'Active'/)
    expect(src).not.toMatch(/status: f\.status \|\| 'Active'/)
  })
})

describe('toSearchListingsFilters shape', () => {
  it('passes maxBeds, maxBaths, and registry booleans through to getSearchListings', () => {
    const out = toSearchListingsFilters({
      city: 'Redmond',
      beds: '3',
      maxBeds: '4',
      baths: '2',
      maxBaths: '3',
      hasFireplace: '1',
      hasGolfCourse: '1',
      status: '',
    })
    expect(out.city).toBe('Redmond')
    expect(out.beds).toBe(3)
    expect(out.maxBeds).toBe(4)
    expect(out.baths).toBe(2)
    expect(out.maxBaths).toBe(3)
    expect(out.hasFireplace).toBe(true)
    expect(out.hasGolfCourse).toBe(true)
    expect(out.status).toBe('')
  })

  it('defaults missing status to Active without rewriting empty', () => {
    expect(toSearchListingsFilters({}).status).toBe('Active')
    expect(toSearchListingsFilters({ status: undefined }).status).toBe('Active')
  })
})
