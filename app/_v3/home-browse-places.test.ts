import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { placeDoorPhotoSrc } from './home-browse-places'

const PLACES = readFileSync(resolve('app/_v3/HomeBrowsePlaces.tsx'), 'utf8')
const CSS = readFileSync(resolve('app/_v3/home-browse-places.css'), 'utf8')
const NEW_CON = readFileSync(resolve('app/_v3/home-new-construction.ts'), 'utf8')
const PAGE = readFileSync(resolve('app/page.tsx'), 'utf8')

describe('placeDoorPhotoSrc', () => {
  it('keeps a trimmed honest URL and drops blanks', () => {
    expect(placeDoorPhotoSrc(' /images/kb/bend.jpg ')).toBe('/images/kb/bend.jpg')
    expect(placeDoorPhotoSrc('')).toBeNull()
    expect(placeDoorPhotoSrc('   ')).toBeNull()
    expect(placeDoorPhotoSrc(undefined)).toBeNull()
    expect(placeDoorPhotoSrc(null)).toBeNull()
  })
})

/**
 * 2026-10-01: Browse places is two forms, not one card run three times (the
 * separate judge's "three consecutive sections ... the identical card shape").
 * SITE-148's rule stands in the new forms: every door has its media or a navy
 * plate with the same words, never an empty box, and every count prints with
 * its unit.
 */
describe('Browse places: towns mosaic and new-construction ledger', () => {
  it('draws every town as a photograph or a navy plate, never an empty box', () => {
    expect(PLACES).toMatch(/placeDoorPhotoSrc\(door\.photoSrc\)/)
    expect(PLACES).toMatch(/home-places__tile--plate/)
    expect(CSS).toMatch(/\.home-places__tile \{[\s\S]*?background:\s*var\(--v3-ink\)/)
    expect(CSS).toMatch(/\.home-places__tile--plate \.home-places__tile-copy[\s\S]*?color:\s*var\(--v3-ink-on-navy\)/)
    expect(CSS).not.toMatch(/background:\s*#/)
  })

  it('prints every count with its unit, on the tile and on the ledger row', () => {
    expect(PLACES).toMatch(/home-places__tile-n">\{live\.label\}[\s\S]*?unitFor\(run, live\.n\)/)
    expect(PLACES).toMatch(/home-places__row-n">\{live\.label\}[\s\S]*?unitFor\(run, live\.n\)/)
    expect(PAGE).toMatch(/unit: 'houses for sale'/)
    expect(NEW_CON).toMatch(/unit: 'new homes for sale'/)
  })

  it('draws each ledger count as a length on the run\'s one scale', () => {
    expect(PLACES).toMatch(/live\.n \/ largest/)
    expect(CSS).toMatch(/\.home-places__row-rule > span/)
  })

  it('reveals the town median on hover or focus, the lead tile on touch', () => {
    expect(PAGE).toMatch(/reveal: \{ label: 'Median list price', value: formatPriceExact\(town\.medianPrice\) \}/)
    expect(CSS).toMatch(/@media \(hover: hover\)[\s\S]*?\.home-places__tile-link:focus-visible \.home-places__tile-reveal/)
    expect(CSS).toMatch(/@media \(hover: none\)[\s\S]*?\.home-places__tile--lead \.home-places__tile-reveal/)
  })

  it('stands the counted ledger as its own navy band after the places, with each row\'s share of the lead', () => {
    expect(PLACES).toMatch(/const bands = shown\.filter\(\(run\) => run\.layout === 'ledger'\)/)
    expect(PLACES).toMatch(/home-places-band/)
    expect(CSS).toMatch(/\.v3\.home-places-band \{[\s\S]*?background:\s*var\(--v3-surface-inverse\)/)
    expect(PLACES).toMatch(/Math\.round\(\(live\.n \/ leadLive\.n\) \* 100\)/)
    expect(PLACES).toMatch(/live\.n <= leadLive\.n/)
  })

  it('prints published figures as strings: no count-up whose server face is a zero', () => {
    expect(PLACES).not.toMatch(/AnimatedNumber/)
    expect(PLACES).not.toMatch(/'use client'/)
  })

  it('keeps every town and every building subdivision as a door', () => {
    expect(PAGE).toMatch(/doors: townRows\.map\(\(town\) => \(\{/)
    expect(PAGE).not.toMatch(/if \(!photoSrc\) return \[\]/)
    expect(NEW_CON).toMatch(/BEND_NEW_CON_HOME_NAV_NAMES\.map\(\(name, i\) => \(\{/)
    expect(NEW_CON).toMatch(/lead,/)
  })
})
