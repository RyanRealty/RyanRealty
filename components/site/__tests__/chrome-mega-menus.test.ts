import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const CHROME = readFileSync(resolve('components/site/v3/V3Chrome.tsx'), 'utf8')
const CHROME_CSS = readFileSync(resolve('components/site/v3/V3Chrome.css'), 'utf8')
const MEGA = readFileSync(resolve('lib/site/chrome-mega.ts'), 'utf8')

describe('V3Chrome mega-menus — all five, one language', () => {
  it('renders every destination through the shared mega model, not a Places-only branch', () => {
    expect(CHROME).toContain("import { chromeMegaModel } from '@/lib/site/chrome-mega'")
    expect(CHROME).toContain('v3-chrome__panel--mega')
    expect(CHROME).toContain('v3-chrome__mega-heading')
    expect(CHROME).toContain('v3-chrome__panel-link--fact')
    expect(CHROME).not.toContain("group.key === 'Areas'")
    expect(CHROME).not.toContain('placesMegaSections')
    expect(CHROME).not.toContain('v3-chrome__panel--places')
    expect(MEGA).toContain("'Buy', 'Areas', 'Market', 'Sell', 'About'")
  })

  it('locks dense packed columns: real padding, explicit tracks, no auto-fit leftovers', () => {
    expect(CHROME_CSS).toContain('.v3-chrome__panel--mega')
    expect(CHROME_CSS).toContain('padding: var(--v3-space-md) var(--v3-space-md) var(--v3-space-sm)')
    expect(CHROME_CSS).toContain('repeat(var(--v3-chrome-mega-cols, 2), minmax(10.5rem, 13.25rem))')
    expect(CHROME_CSS).not.toMatch(/repeat\(\s*auto-fit/)
    expect(CHROME_CSS).not.toContain('v3-chrome__panel--places')
    expect(CHROME_CSS).not.toContain('v3-chrome__places-mega')
    expect(CHROME_CSS).not.toContain('grid-template-columns: max-content minmax(16rem, 19rem)')
  })
})
