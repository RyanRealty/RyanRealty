import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { iconOnlyPanelLayout, overlayLayerZIndex } from './morphing-search-layout'

const src = readFileSync('components/motion/morphing-search.tsx', 'utf8')

describe('SITE-121 phone MorphingSearch sheet', () => {
  it('opens a full-width sheet under the chrome on a 375 phone', () => {
    const box = iconOnlyPanelLayout(375, 56)
    expect(box.width).toBe(351)
    expect(box.left).toBe(12)
    expect(box.top).toBe(64)
    expect(box.width).toBeGreaterThan(280)
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

  it('renders Command groups in the open morph, not a flat combobox', () => {
    expect(src).toMatch(/from ['"]@\/components\/ui\/command['"]/)
    expect(src).toContain('CommandGroup')
    expect(src).toContain('groupMorphItems')
  })
})
