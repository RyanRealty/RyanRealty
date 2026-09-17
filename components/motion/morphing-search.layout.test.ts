import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  catalogPanelLeft,
  catalogPanelWidth,
  iconOnlyPanelLayout,
  isPhoneMorphViewport,
  overlayLayerZIndex,
} from './morphing-search-layout'

const src = readFileSync('components/motion/morphing-search.tsx', 'utf8')

describe('SITE-121 phone MorphingSearch sheet', () => {
  it('opens a full-width sheet under the chrome on a 375 phone', () => {
    const box = iconOnlyPanelLayout(375, 56)
    expect(box.width).toBe(351)
    expect(box.left).toBe(12)
    expect(box.top).toBe(64)
    expect(box.width).toBeGreaterThan(280)
    expect(isPhoneMorphViewport(375)).toBe(true)
    expect(isPhoneMorphViewport(1440)).toBe(false)
  })

  it('desktop grows the official catalog panel, not a full-bleed slab', () => {
    expect(catalogPanelWidth(1440, 16, 288)).toBe(448)
    expect(catalogPanelWidth(1440, 1380, 48)).toBe(448)
    expect(catalogPanelLeft(1440, 1380, 448)).toBe(976)
    expect(catalogPanelLeft(1440, 16, 448)).toBe(16)
    expect(catalogPanelWidth(375, 12, 288)).toBe(343)
  })

  it('reads overlay z-[150] so the input is not under sticky chrome at 100', () => {
    expect(overlayLayerZIndex('z-[150]')).toBe(150)
    expect(overlayLayerZIndex(undefined)).toBe(50)
  })

  it('keeps the catalog morph (mustContain) and focuses inside the tap', () => {
    expect(src).toContain('aria-haspopup="dialog"')
    expect(src).toContain('layoutId')
    expect(src).toContain('backdrop-blur-xl')
    expect(src).toContain('autoFocus')
    expect(src).toContain('data-v3-morph-overlay')
  })

  it('opens with the catalog morph, not a Command autocomplete', () => {
    expect(src).toContain('clipPath')
    expect(src).toContain('SEARCH_MORPH')
    expect(src).toContain('collapsedContentClip')
    expect(src).not.toMatch(/from ['"]@\/components\/ui\/command['"]/)
    expect(src).not.toContain('CommandGroup')
  })
})
