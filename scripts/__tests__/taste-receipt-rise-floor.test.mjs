import { afterAll, describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { RISE_FLOOR, RISE_FLOOR_FROM, receiptV2Problems, riseFloorFor, shotsHashFor } from '../lib/taste-receipt.mjs'

// "Score must rise" with no floor let judge noise ship as progress (Matt
// 2026-09-12: "there can be no gaps"). These tests hold the floor where the
// manifest measured it.

const SANDBOX = mkdtempSync(join(tmpdir(), 'rr-rise-floor-'))
afterAll(() => rmSync(SANDBOX, { recursive: true, force: true }))
mkdirSync(join(SANDBOX, 'shots'), { recursive: true })
writeFileSync(join(SANDBOX, 'shots', 'desktop.png'), 'd')
writeFileSync(join(SANDBOX, 'shots', 'mobile375.png'), 'm')
const shots = { desktop: 'shots/desktop.png', mobile375: 'shots/mobile375.png' }
const shotsHash = shotsHashFor(SANDBOX, shots)
const rubricText = 'rubric v1-2026-09-12 lives here'

function receipt({ score, priorScore, evaluatedAt = '2026-09-13' }) {
  const scores = [score - 1, score, score + 1]
  return {
    evaluatedAt,
    evaluatorModel: 'claude-sonnet-5',
    builderModel: 'grok-4.5',
    rubricVersion: 'v1-2026-09-12',
    shotSpec: { routes: ['/about'], viewports: [1440, 375], states: ['default'] },
    shots,
    shotsHash,
    scores,
    score,
    defects: [{ section: 'hero', finding: 'a finding of more than ten characters' }],
    comparedToPrior: 'rose',
    priorMark: { evaluatedAt: '2026-09-12', score: priorScore, evaluatorModel: 'claude-sonnet-5', rubricVersion: 'v1-2026-09-12', shotsHash },
  }
}

const riseProblems = (tr) => receiptV2Problems(tr, { root: SANDBOX, rubricText }).filter((p) => /rise/.test(p))

describe('the rise floor', () => {
  it('is the measured constant and applies from its date', () => {
    expect(RISE_FLOOR).toBe(6)
    expect(riseFloorFor(RISE_FLOOR_FROM)).toBe(6)
    expect(riseFloorFor('2026-12-01')).toBe(6)
    expect(riseFloorFor('2026-09-12')).toBe(1)
    expect(riseFloorFor(undefined)).toBe(1)
  })

  it('refuses a rise inside the judge noise — +1 and +5 are not done', () => {
    for (const delta of [1, 5]) {
      const p = riseProblems(receipt({ score: 50 + delta, priorScore: 50 }))
      expect(p).toHaveLength(1)
      expect(p[0]).toMatch(new RegExp(`score ${50 + delta} did not rise by the floor of 6 over the prior mark 50 \\(needs 56\\)`))
      expect(p[0]).toMatch(/inside the judge's own noise/)
    }
  })

  it('accepts a rise at or over the floor', () => {
    expect(riseProblems(receipt({ score: 56, priorScore: 50 }))).toEqual([])
    expect(riseProblems(receipt({ score: 61, priorScore: 50 }))).toEqual([])
  })

  it('still refuses no rise and a fall', () => {
    expect(riseProblems(receipt({ score: 50, priorScore: 50 }))).toHaveLength(1)
    expect(riseProblems(receipt({ score: 47, priorScore: 50 }))).toHaveLength(1)
  })

  it('holds a pre-floor receipt to the bare rise it was accepted under (city, 2026-09-10, +3)', () => {
    expect(riseProblems(receipt({ score: 63, priorScore: 60, evaluatedAt: '2026-09-10' }))).toEqual([])
    const p = riseProblems(receipt({ score: 60, priorScore: 60, evaluatedAt: '2026-09-10' }))
    expect(p[0]).toMatch(/did not rise above the prior mark 60/)
  })
})
