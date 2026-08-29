import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { marketHtmlGate } from './market-html-gate.mjs'

const FACE_TELLS = [
  /\bleftover\b/i,
  /Market Truth leftover/i,
  /leftover\s*:\s*true/i,
  /leftover membership/i,
]

const FACE_FILES = [
  'app/housing-market/page.tsx',
  'app/housing-market/_v3/hub-sections.ts',
  'app/housing-market/_v3/hub-charts.ts',
  'app/housing-market/_v3/MarketChartRoom.tsx',
]

describe('marketHtmlGate', () => {
  it('passes a market face without leftover labels', () => {
    const html = `
      <h1>Central Oregon housing market: a balanced market</h1>
      <p>Median close by month, single-family, Central Oregon</p>
      <button>Time</button>
      <p>median list price · now, single-family</p>
      <p>More indicators</p>
      <p>Oregon Data Share MLS, Central Oregon, single-family</p>
    `
    expect(marketHtmlGate(html)).toEqual({ ok: true, fails: [] })
  })

  it('fails leftover, Market Truth leftover, leftover:true, leftover:true JSON, and Leftover membership', () => {
    const html = `
      Market Truth leftover
      leftover:true
      leftover:true
      "leftover": true
      Leftover membership
    `
    const result = marketHtmlGate(html)
    expect(result.ok).toBe(false)
    expect(result.fails).toEqual([
      'leftover',
      'market-truth-leftover',
      'leftover-true',
      'leftover-json',
      'leftover-membership',
    ])
  })

  it('keeps leftover labels off the market hub face strings', () => {
    const page = readFileSync(resolve('app/housing-market/page.tsx'), 'utf8')
    for (const rel of FACE_FILES) {
      const src = readFileSync(resolve(rel), 'utf8')
      for (const tell of FACE_TELLS) {
        expect(src).not.toMatch(tell)
      }
      expect(marketHtmlGate(src)).toEqual({ ok: true, fails: [] })
    }
    expect(page).toContain('Central Oregon housing market${verdict.kind === \'unknown\' ? \'\' : `: a ${verdict.label}`}')
    expect(page).toContain('chartFirst')
    expect(page).toContain('MarketChartRoom')
    expect(page).toContain('More indicators')
    expect(page).toContain('foldAfter={HUB_DECISION_FOLD_AFTER}')
  })
})
