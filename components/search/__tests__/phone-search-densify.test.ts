import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Phone search densify (P0 Matt 2026-09-16 / recreated 2026-09-17).
 *
 * Filter/results chrome below the header is too tall on 390. These pin the
 * density contract so a later edit cannot bring Per page + Columns, the dual
 * price rail, or a chrome-first map fold back without failing CI.
 *
 * SITE-121 (V3Chrome morphing header) is a different surface — do not encode
 * header changes here.
 */

function readSrc(rel: string): string {
  return readFileSync(resolve(rel), 'utf8')
}

describe('phone-search-densify', () => {
  it('hides Per page + Columns on phone and keeps them on desktop', () => {
    const toolbar = readSrc('components/SearchListingsToolbar.tsx')
    expect(toolbar).toMatch(/srch-layout-controls/)
    expect(toolbar).toMatch(/srch-layout-controls hidden[\s\S]*sm:flex/)
    expect(toolbar).toMatch(/Per page/)
    expect(toolbar).toMatch(/Columns/)
    const layout = toolbar.slice(
      toolbar.indexOf('srch-layout-controls'),
      toolbar.indexOf('srch-count'),
    )
    expect(layout).toMatch(/Per page/)
    expect(layout).toMatch(/Columns/)
    expect(layout).toMatch(/hidden/)
    expect(layout).toMatch(/sm:flex/)
  })

  it('keeps Price with Places on phone and hides the dual SITE-72 rail below 640', () => {
    const filters = readSrc('components/search/SearchFilters.tsx')
    const css = readSrc('components/search/search-ledger.css')
    expect(filters).toMatch(/srch-phone-places-price/)
    expect(filters).toMatch(/Phone densify: Price chip sits with Places/)
    const placesGroup = filters.slice(
      filters.indexOf('srch-phone-places-price'),
      filters.indexOf('srch-chip-rail'),
    )
    expect(placesGroup).toMatch(/placesChipLabel/)
    expect(placesGroup).toMatch(/openPanel === 'price'/)
    expect(placesGroup).toMatch(/weight="key"/)
    expect(filters).toMatch(/srch-price-rail/)
    expect(css).toMatch(/@media \(max-width: 639px\)/)
    const phoneBlock = css.slice(css.indexOf('@media (max-width: 639px)'))
    expect(phoneBlock).toMatch(/\.srch-price-rail \{[\s\S]*display:\s*none/)
  })

  it('prefers floating Map|List|Sort on phone map and keeps Places/Filters/Save compact', () => {
    const filters = readSrc('components/search/SearchFilters.tsx')
    const map = readSrc('components/search/MapSearchView.tsx')
    const save = readSrc('components/SaveSearchButton.tsx')
    expect(map).toMatch(/Zillow-style floating Map \| Sort/)
    expect(map).toMatch(/map-search-mapsort/)
    expect(map).toMatch(/aria-label="Map and sort"/)
    expect(filters).toMatch(/map-search-mapsort__pill/)
    expect(filters).toMatch(/view === 'map' && 'max-sm:hidden'/)
    expect(filters).toMatch(/sm:hidden">\{moreFilterCount > 0 \? moreFilterCount : 'Filters'\}/)
    expect(save).toMatch(/sm:hidden">\{status === 'done' \? 'Saved' : 'Save'\}/)
    expect(save).not.toMatch(/Save Search/)
  })

  it('slims the city-slug dock headline on phone without dropping font-display', () => {
    const map = readSrc('app/search/[...slug]/sections/MapSplitView.tsx')
    expect(map).toMatch(/font-display text-xs[\s\S]*sm:text-sm/)
    expect(map).toMatch(/px-3 pt-1/)
  })

  it('sizes the map-first phone viewport so the shell shows map, not chrome', () => {
    const frame = readSrc('app/search/search-frame.css')
    expect(frame).toMatch(/@media \(max-width: 639px\)/)
    const phone = frame.slice(frame.lastIndexOf('@media (max-width: 639px)'))
    expect(phone).toMatch(/\.search-app-frame \.map-search-shell/)
    expect(phone).toMatch(/min-height:\s*min\(62dvh,\s*28rem\)/)
    expect(frame).toMatch(/\.search-app-frame \.search-filter-dock/)
    expect(frame).toMatch(/position:\s*relative/)
  })

  it('does not retouch SITE-121 V3Chrome morphing search header', () => {
    const chrome = readSrc('components/site/v3/V3Chrome.tsx')
    expect(chrome).toMatch(/v3-chrome__panel--places/)
    expect(chrome).toMatch(/placesMegaSections/)
  })
})
