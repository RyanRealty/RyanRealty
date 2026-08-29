import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  ABOUT_BOUTIQUE_SENTENCE,
  aboutHtmlGate,
} from './about-html-gate.mjs'

const FACE_TELLS = [
  /\bleftover\b/i,
  /Market Truth leftover/i,
  /leftover\s*:\s*true/i,
  /leftover membership/i,
  /A miss omits/,
  /boutique real estate brokerage/,
]

const FACE_FILES = [
  'app/about/page.tsx',
  'app/about/_v3/about-constants.ts',
  'app/about/_v3/AboutFaces.tsx',
  'app/about/_v3/about-faces.ts',
]

describe('aboutHtmlGate', () => {
  it('passes an About face without leftover labels or the boutique sentence', () => {
    const html = `
      <h1>About Ryan Realty</h1>
      <h2>How it started</h2>
      <p>Matt Ryan opened Ryan Realty in Bend in June 2023, after years in the fire service.</p>
      <p>Oregon Real Estate Agency. Ryan Realty LLC, OREA 201253677.</p>
      <h2>Working with Ryan Realty</h2>
      <p>We cover Bend, Redmond, Sisters, Sunriver, La Pine, Terrebonne, and Prineville.</p>
    `
    expect(aboutHtmlGate(html)).toEqual({ ok: true, fails: [] })
  })

  it('fails leftover, Market Truth leftover, leftover:true, A miss omits, and the boutique sentence', () => {
    const html = `
      Market Truth leftover
      leftover:true
      leftover:true
      "leftover": true
      Leftover membership
      A miss omits.
      ${ABOUT_BOUTIQUE_SENTENCE}
    `
    const result = aboutHtmlGate(html)
    expect(result.ok).toBe(false)
    expect(result.fails).toEqual([
      'leftover',
      'market-truth-leftover',
      'leftover-true',
      'leftover-json',
      'leftover-membership',
      'a-miss-omits',
      'boutique-community',
    ])
  })

  it('keeps leftover labels and the boutique sentence off the About face strings', () => {
    const page = readFileSync(resolve('app/about/page.tsx'), 'utf8')
    for (const rel of FACE_FILES) {
      const src = readFileSync(resolve(rel), 'utf8')
      for (const tell of FACE_TELLS) {
        expect(src).not.toMatch(tell)
      }
      expect(aboutHtmlGate(src)).toEqual({ ok: true, fails: [] })
    }
    expect(page).toContain('About Ryan Realty')
    expect(page).toContain('How it started')
    expect(page).toContain('trio')
    expect(page).not.toContain('V3Instrument')
    expect(page).not.toContain('V3Ledger')
    expect(page).toContain('/housing-market')
  })
})
