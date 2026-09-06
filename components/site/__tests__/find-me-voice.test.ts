import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = readFileSync(resolve('components/site/v3/FindMeVoice.client.tsx'), 'utf8')
const CHROME = readFileSync(resolve('components/site/v3/V3Chrome.tsx'), 'utf8')
const CHROME_CSS = readFileSync(resolve('components/site/v3/V3Chrome.css'), 'utf8')

describe('FindMeVoice', () => {
  it('is not mounted in public chrome (Matt/Cos 2026-09-06)', () => {
    expect(CHROME).not.toContain('<FindMeVoice')
    expect(CHROME).not.toContain("from './FindMeVoice.client'")
  })

  it('module still routes speech through searchHrefForQuery if revived', () => {
    expect(SRC).toContain('searchHrefForQuery')
    expect(SRC).not.toContain('/homes-for-sale/bend?')
  })

  it('hides the Menu button when the primary nav is visible (H1)', () => {
    expect(CHROME_CSS).toMatch(
      /@media \(min-width: 56\.25rem\)[\s\S]*?\.v3-chrome__menu-btn \{[\s\S]*?display: none/,
    )
  })

  it('mobile bar is logo | Sign in | hamburger (no phone clutter)', () => {
    expect(CHROME).toContain('v3-chrome__signin')
    expect(CHROME).toContain('SIGN_IN')
    expect(CHROME_CSS).toContain('.v3-chrome__signin')
    expect(CHROME_CSS).toMatch(/\.v3-chrome__phone \{[\s\S]*?display: none/)
  })
})
