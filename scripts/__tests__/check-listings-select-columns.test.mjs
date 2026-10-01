import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { execFileSync } from 'node:child_process'
import {
  listingsColumns,
  orFilterColumns,
  scanSource,
  selectItemColumn,
} from '../check-listings-select-columns.mjs'

/**
 * ci:listings-select-columns (scripts/check-listings-select-columns.mjs).
 * Founding case: lib/data/listings/attachListingCardExtras.ts selected
 * original_list_price from 2026-09-21 to 09-30 (the column is
 * OriginalListPrice); every card read failed, with nothing logged.
 */

const REPO = resolve(new URL('.', import.meta.url).pathname, '../..')
const columns = listingsColumns(readFileSync(resolve(REPO, 'docs/DATABASE_SCHEMA_SNAPSHOT.md'), 'utf8'))
const unknown = (src) => scanSource(src).filter((r) => !columns.has(r.column)).map((r) => `${r.method}:${r.column}`)

describe('the listings columns read off the schema snapshot', () => {
  it('holds the mixed-case and snake_case columns listings has, and none it lacks', () => {
    for (const c of ['ListingKey', 'OriginalListPrice', 'StandardStatus', 'details', 'virtual_tour_url', 'year_built']) {
      expect(columns.has(c)).toBe(true)
    }
    for (const c of ['original_list_price', 'listing_key', 'standard_status', 'list_price', 'id']) {
      expect(columns.has(c)).toBe(false)
    }
  })
})

describe('reading a select list down to its base columns', () => {
  it('strips an alias, a JSON path and a cast; skips *, count() and embedded resources', () => {
    expect(selectItemColumn('Photos:details->Photos')).toBe('details')
    expect(selectItemColumn('details->>Remarks')).toBe('details')
    expect(selectItemColumn('ListPrice::text')).toBe('ListPrice')
    expect(selectItemColumn('*')).toBeNull()
    expect(selectItemColumn('count()')).toBeNull()
    expect(selectItemColumn('listing_photos(photo_url)')).toBeNull()
    expect(selectItemColumn('"ListingKey"')).toBeNull() // literal quotes are G17's
  })

  it('reads the columns of an or() filter, nested groups too', () => {
    expect(orFilterColumns('StandardStatus.eq.Active,and(ListPrice.gt.1,details->Photos.not.is.null)')).toEqual([
      'StandardStatus',
      'ListPrice',
      'details',
    ])
  })
})

describe('scanning a source file', () => {
  it('fails the founding select', () => {
    const src = `sb.from('listings').select('ListingKey, original_list_price, virtual_tour_url, details').in('ListingKey', keys)`
    expect(unknown(src)).toEqual(['select:original_list_price'])
  })

  it('passes the fixed select', () => {
    const src = `sb.from('listings').select('ListingKey, OriginalListPrice, virtual_tour_url, ListOfficeName, PhotoURL, Photos:details->Photos').in('ListingKey', keys)`
    expect(unknown(src)).toEqual([])
  })

  it('checks every filter in the chain, not only the select', () => {
    const src = `sb.from('listings').select('ListingKey').eq('listing_key', k).order('close_date', { ascending: false }).maybeSingle()`
    expect(unknown(src)).toEqual(['eq:listing_key', 'order:close_date'])
  })

  it('checks the paging helper form', () => {
    const src = `fetchAllRows(supabase, 'listings', 'SubdivisionName, subdivision_name', (q) => q)`
    expect(unknown(src)).toEqual(['select:subdivision_name'])
  })

  it('leaves other tables alone, and a column that is not a string literal', () => {
    const src = `sb.from('listing_tile_mv').select('listing_key, standard_status'); sb.from('listings').select(cols).eq(col, 1)`
    expect(unknown(src)).toEqual([])
  })

  it('reads the line of each reference', () => {
    const src = `const a = 1\nsb.from('listings')\n  .select('ListingKey')\n  .eq('list_number', k)`
    expect(scanSource(src).find((r) => r.column === 'list_number')?.line).toBe(4)
  })
})

describe('the gate on this tree', () => {
  it('passes: every listings column a read names exists or is held in the baseline', () => {
    const out = execFileSync('node', ['scripts/check-listings-select-columns.mjs'], { cwd: REPO, encoding: 'utf8' })
    expect(out).toMatch(/OK: every column a read names on listings exists/)
  })
})
