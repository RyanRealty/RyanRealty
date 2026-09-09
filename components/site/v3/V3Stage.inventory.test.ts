import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * THE VARIANT IS A PROP, NOT A FORK (SITE-46).
 *
 * The Stage's inventory variant exists to put live figures inside the hero of a
 * page that has inventory behind it. The thing that must never break is the
 * other twenty callers: a Stage that passes no `inventory` has to render
 * exactly what it rendered before. That is a markup and stylesheet property, so
 * it is pinned here the way V3StickyAsk.test.ts pins its own — by reading the
 * source, because a gate does not read it and a refactor loses it silently.
 */
const SRC = readFileSync(resolve('components/site/v3/V3Stage.tsx'), 'utf8')
const CSS = readFileSync(resolve('components/site/v3/V3Stage.css'), 'utf8')
const BARREL = readFileSync(resolve('components/site/v3/index.ts'), 'utf8')

describe('V3Stage inventory · opt-in', () => {
  it('mounts the variant class only when a strip resolved', () => {
    expect(SRC).toContain("strip && 'v3-stage--inventory'")
  })

  it('renders no strip markup at all without the prop', () => {
    // Every element the variant adds sits inside this one conditional, which is
    // the last thing in the section. Anything the render mounts outside it
    // reaches every other caller of this pattern.
    const open = SRC.indexOf('{strip ? (')
    const close = SRC.indexOf(') : null}\n    </section>')
    expect(open).toBeGreaterThan(0)
    expect(close).toBeGreaterThan(open)
    const guarded = SRC.slice(open, close)
    const render = SRC.slice(SRC.indexOf('  return (\n    <section'))
    for (const mark of ['v3-stage-band', 'v3-stage-strip', '<V3Figure', '<V3SourceLine']) {
      expect(guarded).toContain(mark)
      const inRender = render.split(mark).length - 1
      const inGuard = guarded.split(mark).length - 1
      expect(inRender - inGuard).toBe(0)
    }
  })

  it('scopes every new rule to the variant or to the strip itself', () => {
    const section = CSS.slice(CSS.indexOf('3. THE INVENTORY VARIANT'))
    const selectors = section
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n')
      .filter((line) => line.trim().endsWith('{') && !line.trim().startsWith('@'))
      .map((line) => line.trim())
    expect(selectors.length).toBeGreaterThan(6)
    for (const selector of selectors) {
      // Three families, and no fourth: the variant class itself, the band that
      // only the variant mounts, and the strip inside that band. A rule that
      // matches a plain .v3-stage would reach every other caller.
      expect(
        selector.includes('v3-stage--inventory') ||
          selector.includes('v3-stage-band') ||
          selector.includes('v3-stage-strip'),
      ).toBe(true)
    }
  })

  it('never restyles the base primary or the ghost variant globally', () => {
    const section = CSS.slice(CSS.indexOf('3. THE INVENTORY VARIANT'))
    expect(section).not.toMatch(/^\.v3 \.v3-btn--primary/m)
    expect(section).not.toContain('v3-btn--ghost')
  })
})

describe('V3Stage inventory · the figures', () => {
  it('formats nothing: values and labels arrive finished', () => {
    // The barrel rule. A figure the primitive formatted would be a figure the
    // caller's source trace does not cover.
    expect(SRC).not.toMatch(/toLocaleString|toFixed|Intl\.NumberFormat/)
  })

  it('requires two figures, and enforces it in production as well as in dev', () => {
    expect(SRC).toContain('inventory.figures.length < 2')
    expect(SRC).toContain('inventory.figures.length >= 2 ? inventory : null')
  })

  it('throws in development on a blank value, label, or trace', () => {
    const assertion = SRC.slice(SRC.indexOf('function assertInventory'), SRC.indexOf('export function V3Stage'))
    expect(assertion).toContain("process.env.NODE_ENV === 'production'")
    expect(assertion).toContain('isBlank(figure.value) || isBlank(figure.label)')
    expect(assertion).toContain('isBlank(inventory.source)')
  })

  it('carries one section 0 trace under the strip, never a figure without one', () => {
    expect(SRC).toContain('<V3SourceLine')
    expect(SRC).toContain('source={strip.source}')
    expect(SRC).toContain('updatedAt={strip.updatedAt}')
  })

  it('is exported from the barrel so a page can type its own strip', () => {
    expect(BARREL).toContain('V3StageInventory')
    expect(BARREL).toContain('V3StageFigure')
  })
})

describe('V3Stage inventory · the action', () => {
  it('paints the navy fill with a cream edge, on the variant only', () => {
    const rule = CSS.slice(
      CSS.indexOf('.v3.v3-stage--inventory .v3-btn--on-media.v3-btn--primary {'),
    ).slice(0, 260)
    expect(rule).toContain('background: var(--v3-navy)')
    expect(rule).toContain('color: var(--v3-ink-on-navy)')
    expect(rule).toContain('border-color: var(--v3-ink-on-navy)')
  })

  it('leaves the cream-face on-media primary standing for every other Stage', () => {
    expect(CSS).toContain('.v3.v3-stage .v3-btn--on-media.v3-btn--primary {')
    expect(CSS).toContain('background: var(--v3-surface);')
  })

  it('declares no raw color anywhere in the stylesheet', () => {
    expect(CSS).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(CSS).not.toMatch(/\brgba?\(/)
  })
})
