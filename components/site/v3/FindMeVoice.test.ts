import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = readFileSync(resolve('components/site/v3/FindMeVoice.client.tsx'), 'utf8')
const CHROME = readFileSync(resolve('components/site/v3/V3Chrome.tsx'), 'utf8')

describe('FindMeVoice', () => {
  it('is not mounted in public chrome (Matt/Cos 2026-09-06)', () => {
    expect(CHROME).not.toContain('<FindMeVoice')
    expect(CHROME).not.toContain("from './FindMeVoice.client'")
    expect(CHROME).toContain('v3-chrome__phone')
  })

  it('module still routes speech through searchHrefForQuery if revived', () => {
    expect(SRC).toContain('searchHrefForQuery')
    expect(SRC).not.toContain('/homes-for-sale/bend?')
  })

  it('chrome hides the Menu button when the primary nav is visible (H1)', () => {
    const css = readFileSync(resolve('components/site/v3/V3Chrome.css'), 'utf8')
    expect(css).toMatch(/@media \(min-width: 56\.25rem\)[\s\S]*?\.v3-chrome__menu-btn \{[\s\S]*?display: none/)
  })
})
