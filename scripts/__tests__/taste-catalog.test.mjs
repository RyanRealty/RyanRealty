import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  EXM7777_IDS,
  EXM7777_URLS,
  adaptedFromProblems,
  layoutLockForClass,
  listPicksForClass,
  loadTasteCatalog,
  modulesForClass,
  publicInstallForbidden,
  shadcnPicksForClass,
} from '../lib/taste-catalog.mjs'

const raw = JSON.parse(readFileSync('design_system/public/taste-catalog.json', 'utf8'))
const loaded = loadTasteCatalog(raw)

describe('loadTasteCatalog', () => {
  it('loads the committed catalog from the X post with all five EXM7777 sources', () => {
    expect(loaded.problems).toEqual([])
    expect(loaded.source).toBe('https://x.com/EXM7777/status/2092250905655812121')
    expect(loaded.catalogUrls).toEqual([...EXM7777_URLS])
    expect(EXM7777_IDS.every((id) => loaded.catalogs.some((c) => c.id === id))).toBe(true)
    expect(loaded.catalogs.some((c) => c.id === 'house-v3' && c.kind === 'house')).toBe(true)
    expect(loaded.refuse.some((r) => /shadcn add/i.test(r))).toBe(true)
  })
})

describe('listing-detail is the proof class', () => {
  it('locks the full-bleed hero and names the house modules a lane must keep', () => {
    const lock = layoutLockForClass(loaded, 'listing-detail')
    expect(lock).toMatch(/listing-hero-bleed/)
    expect(lock).toMatch(/SITE-45/)
    const ids = modulesForClass(loaded, 'listing-detail').map((m) => m.id)
    expect(ids).toEqual(
      expect.arrayContaining([
        'listing-hero-bleed',
        'listing-specs',
        'listing-ask',
        'shadcn-carousel',
        'beui-tabs',
        'transitions-modal',
        'beautifului-loading',
      ]),
    )
  })
})

describe('adaptedFromProblems', () => {
  it('refuses an empty adaptedFrom — that is inventing a layout', () => {
    const problems = adaptedFromProblems(loaded, 'listing-detail', [])
    expect(problems.some((p) => /empty/i.test(p))).toBe(true)
  })

  it('accepts a house module id from the class list', () => {
    expect(adaptedFromProblems(loaded, 'listing-detail', [{ id: 'listing-hero-bleed' }])).toEqual([])
  })

  it('rejects a module that is not on the class list', () => {
    const problems = adaptedFromProblems(loaded, 'listing-detail', [{ id: 'fluid-orb' }])
    expect(problems.some((p) => /fluid-orb/.test(p))).toBe(true)
  })
})

describe('shadcn is the fetched list', () => {
  it('has the ui.shadcn.com catalog URL and 20+ named components', () => {
    expect(loaded.catalogUrl).toBe('https://ui.shadcn.com/docs/components')
    expect(loaded.shadcn.components.length).toBeGreaterThanOrEqual(20)
    const byName = Object.fromEntries(loaded.shadcn.components.map((c) => [c.name, c]))
    expect(byName.button.installed).toBe('components/ui/button.tsx')
    expect(byName.carousel.installed).toBeNull()
    expect(byName.carousel.docs).toBe('https://ui.shadcn.com/docs/components/carousel')
  })

  it('picks listing jobs from the list: carousel, button-group, sheet, dialog', () => {
    const names = shadcnPicksForClass(loaded, 'listing-detail').map((c) => c.name)
    expect(names).toEqual(expect.arrayContaining(['carousel', 'button-group', 'sheet', 'dialog']))
  })

  it('accepts a shadcn component name as adaptedFrom', () => {
    expect(adaptedFromProblems(loaded, 'listing-detail', [{ id: 'shadcn:carousel' }])).toEqual([])
    expect(adaptedFromProblems(loaded, 'listing-detail', [{ id: 'carousel' }])).toEqual([])
  })
})

describe('the other four EXM7777 catalogs', () => {
  it('picks takeable beui / transitions / beautifului modules for listing-detail', () => {
    const ids = listPicksForClass(loaded, 'listing-detail').map((c) => c.id)
    expect(ids).toEqual(expect.arrayContaining(['beui:tabs', 'transitions:modal-open', 'beautifului:loading-state']))
    expect(ids.some((id) => id.includes('fluid-orb'))).toBe(false)
  })

  it('accepts a beui module as adaptedFrom', () => {
    expect(adaptedFromProblems(loaded, 'listing-detail', [{ id: 'beui:tabs' }])).toEqual([])
    expect(adaptedFromProblems(loaded, 'listing-detail', [{ id: 'beui-tabs' }])).toEqual([])
  })
})

describe('publicInstallForbidden', () => {
  it('flags installing a catalog onto the public site', () => {
    expect(publicInstallForbidden('npx shadcn add @beui/tilt-card')).toBe(true)
    expect(publicInstallForbidden('adapt the tab indicator into V3Quiet')).toBe(false)
  })
})
