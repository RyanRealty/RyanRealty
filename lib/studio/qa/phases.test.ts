/**
 * The CHECK_PHASES table (Matt 2026-10-14: "I expect you to know the rules
 * before you build a video"): every video:check check is classified preflight
 * or file-only, and the table names exactly the checks video:check runs. That
 * each preflight check is refused by each step its row names, on a brief or
 * timeline that breaks it, is lib/studio/timeline/preflight.test.ts.
 */
import { describe, expect, it } from 'vitest'
import { CHECK_IDS } from './check'
import { CHECK_PHASES, PREFLIGHT_CHECK_IDS, PREFLIGHT_STEPS, checkName, checkPhase } from './phases'

describe('CHECK_PHASES: every check is preflight or file-only', () => {
  it('classifies exactly the checks video:check runs, in order', () => {
    expect(CHECK_PHASES.map((c) => c.id)).toEqual([...CHECK_IDS])
    for (const c of CHECK_PHASES) {
      expect(['preflight', 'file-only'], `check ${c.id}`).toContain(c.phase)
      expect(c.name.trim(), `check ${c.id}`).not.toBe('')
      if (c.phase === 'preflight') {
        expect(c.steps.length, `check ${c.id}`).toBeGreaterThan(0)
        for (const step of c.steps) expect(Object.keys(PREFLIGHT_STEPS), `check ${c.id}`).toContain(step)
        expect(c.preflight.trim(), `check ${c.id}`).not.toBe('')
      } else {
        expect(c.fileOnly.trim(), `check ${c.id}`).not.toBe('')
      }
    }
  })

  it('fails an unclassified check: every id video:check runs has a row', () => {
    for (const id of CHECK_IDS) expect(checkPhase(id), `check ${id}`).toBeDefined()
    expect(checkPhase(99)).toBeUndefined()
    expect(checkName(99)).toBe('check 99')
  })

  it('keeps the file-only checks to what only the MP4 can show', () => {
    expect(CHECK_PHASES.filter((c) => c.phase === 'file-only').map((c) => c.id)).toEqual([1, 2, 6, 14, 17])
    expect([...PREFLIGHT_CHECK_IDS]).toEqual([3, 4, 5, 7, 8, 9, 10, 11, 12, 13, 15, 16])
  })
})
