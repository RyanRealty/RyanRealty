import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = readFileSync(resolve('components/site/v3/FindMeVoice.client.tsx'), 'utf8')
const CHROME = readFileSync(resolve('components/site/v3/V3Chrome.tsx'), 'utf8')
const CHROME_CSS = readFileSync(resolve('components/site/v3/V3Chrome.css'), 'utf8')

describe('FindMeVoice', () => {
  it('is mounted in the public chrome on every page', () => {
    expect(CHROME).toContain('<FindMeVoice')
  })

  it('opens a listening stage and sends speech through searchHrefForQuery', () => {
    expect(SRC).toContain('searchHrefForQuery')
    expect(SRC).toContain('Find me a home')
    expect(SRC).toContain('v3-findme-stage')
    expect(SRC).not.toContain('/homes-for-sale/bend?')
  })

  it('shows a visible Find label beside the mic (H4)', () => {
    expect(SRC).toContain('v3-chrome__findme-word')
    expect(SRC).toContain('>Find<')
  })

  it('hides the Menu button when the primary nav is visible (H1)', () => {
    expect(CHROME_CSS).toMatch(
      /@media \(min-width: 56\.25rem\)[\s\S]*?\.v3-chrome__menu-btn \{[\s\S]*?display: none/,
    )
  })

  it('keeps the phone control on the 44px tap floor (H7)', () => {
    expect(CHROME_CSS).toMatch(/\.v3-chrome__phone \{[\s\S]*?min-width: var\(--v3-tap\)/)
    expect(CHROME_CSS).toMatch(/\.v3-chrome__phone \{[\s\S]*?min-height: var\(--v3-tap\)/)
  })
})
