import { describe, expect, it } from 'vitest'
import type { Attempt } from './caps'
import { formatRun, formatStatus } from './report'
import type { RunResult } from './run'
import type { Stamp } from './stamp'

const stamp = (over: Partial<Stamp> = {}): Stamp => ({
  step: 'brief', slug: 'film', inputsSha256: 'a'.repeat(64), rulesVersion: 'b'.repeat(64), verdict: 'pass', problems: [], at: '2026-10-14T12:00:00.000Z', builder: 'claude', machine: 'mac',
  gitHead: 'abcdef1234567890', inputs: {}, outputs: {}, outputsSha256: 'c'.repeat(64), status: 'built', attempt: 1, ...over,
})

describe('formatRun', () => {
  it('names each step\'s result and, for a refusal, every problem with its rule ID', () => {
    const result: RunResult = {
      ok: false, slug: 'film', refusedAt: 'board',
      outcomes: [
        { step: 'brief', action: 'valid', stamp: stamp(), problems: [] },
        { step: 'voice', action: 'ran', stamp: stamp({ step: 'voice' }), problems: [] },
        { step: 'board', action: 'refused', problems: [{ rule: 'R-089', problem: 'check 11 Safe area: "x" reaches x 1100, y 136' }, { problem: 'a problem no rule names' }] },
      ],
      problems: [],
    }
    const text = formatRun(result, { root: '/repo', outRoot: '/repo/out' })
    expect(text).toContain('studio run film')
    expect(text).toMatch(/brief\s+holds \(its stamp still holds, nothing ran\) out\/studio\/film\/stamps\/brief\.json/)
    expect(text).toMatch(/voice\s+passed/)
    expect(text).toMatch(/board\s+REFUSED/)
    expect(text).toContain('- [R-089] check 11 Safe area')
    expect(text).toContain('- a problem no rule names')
    expect(text).toContain('Stopped at step board. Nothing after it ran.')
  })

  it('points at the board sheet when the board passed', () => {
    const result: RunResult = {
      ok: true, slug: 'film',
      outcomes: [{ step: 'board', action: 'ran', stamp: stamp({ step: 'board', outputs: { sheet: { file: 'board/2/board.png', sha256: 'x' } } }), problems: [] }],
      problems: [],
    }
    expect(formatRun(result, { root: '/repo', outRoot: '/repo/out' })).toContain('board sheet: out/studio/film/board/2/board.png')
  })

  it('says so when a step was passed unbuilt, and when the run passed', () => {
    const result: RunResult = { ok: true, slug: 'film', outcomes: [{ step: 'animatic', action: 'ran', stamp: stamp({ step: 'animatic', status: 'not built', allowUnbuilt: true }), problems: [] }], problems: [] }
    const text = formatRun(result, { root: '/repo', outRoot: '/repo/out' })
    expect(text).toContain('not built; allowed past with --allow-unbuilt-step, logged in the stamp')
    expect(text).toContain('Passed through step animatic.')
  })
})

describe('formatStatus', () => {
  it('prints each stamp, a missing one, and the caps spent', () => {
    const attempts: Attempt[] = [
      { step: 'brief', attempt: 1, startedAt: '2026-10-14T11:00:00.000Z', builder: 'claude', machine: 'mac', verdict: 'pass', problems: [] },
      { step: 'board', attempt: 1, startedAt: '2026-10-14T11:10:00.000Z', builder: 'claude', machine: 'mac', verdict: 'fail', problems: ['x'] },
    ]
    const text = formatStatus(
      'film',
      [
        { step: 'brief', read: { ok: true, stamp: stamp() } },
        { step: 'voice', read: { ok: false, reason: 'missing', detail: '' } },
        { step: 'board', read: { ok: true, stamp: stamp({ step: 'board', verdict: 'fail', problems: [{ rule: 'R-089', problem: 'check 11 Safe area: x' }] }) } },
      ],
      attempts,
      '2026-10-14T11:00:00.000Z',
      new Date('2026-10-14T12:00:00.000Z'),
    )
    expect(text).toMatch(/brief\s+PASS\s+2026-10-14T12:00:00\.000Z\s+attempt 1, by claude on mac, at abcdef123/)
    expect(text).toMatch(/voice\s+no stamp/)
    expect(text).toMatch(/board\s+FAIL/)
    expect(text).toContain('- [R-089] check 11 Safe area: x')
    expect(text).toContain('Job limits: boards 1 of 3, animatics 0 of 2, masters 0 of 2, minutes 60 of 90.')
  })

  it('says the clock has not started before a first brief attempt', () => {
    expect(formatStatus('film', [], [], null, new Date())).toContain('minutes 0 of 90 (the clock starts at the first brief attempt)')
  })
})
