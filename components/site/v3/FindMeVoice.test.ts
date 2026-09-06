import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = readFileSync(resolve('components/site/v3/FindMeVoice.client.tsx'), 'utf8')
const CHROME = readFileSync(resolve('components/site/v3/V3Chrome.tsx'), 'utf8')

describe('FindMeVoice', () => {
  it('is mounted in the public chrome on every page', () => {
    expect(CHROME).toContain('<FindMeVoice')
  })

  it('sends speech through searchHrefForQuery, not a hardcoded Bend URL', () => {
    expect(SRC).toContain('searchHrefForQuery')
    expect(SRC).not.toContain('/homes-for-sale/bend?')
    expect(SRC).toContain('Find me a home')
    expect(SRC).toContain('v3-findme-stage')
    expect(SRC).toContain('v3-chrome__findme-word')
    expect(SRC).toContain('>Find<')
  })

  it('chrome hides the Menu button when the primary nav is visible (H1)', () => {
    const css = readFileSync(resolve('components/site/v3/V3Chrome.css'), 'utf8')
    expect(css).toMatch(/@media \(min-width: 56\.25rem\)[\s\S]*?\.v3-chrome__menu-btn \{[\s\S]*?display: none/)
  })
})
