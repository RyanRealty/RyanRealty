import { appendFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { CAPS, FileClaimStore, attemptsPath, capRefusal, parseAttempts } from './caps'
import type { StepId } from './rules'

let dir = ''
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'rr-caps-'))
})
afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

const NOW = new Date('2026-10-14T12:00:00.000Z')
const ago = (minutes: number) => new Date(NOW.getTime() - minutes * 60000).toISOString()

/** Spend an attempt: a start line, and an end line unless the step crashed. */
function spend(store: FileClaimStore, step: StepId, minutesAgo: number, verdict: 'pass' | 'fail' | 'crash' = 'fail') {
  const n = store.attempts('film').filter((a) => a.step === step).length + 1
  store.recordStart('film', { kind: 'start', step, attempt: n, at: ago(minutesAgo), builder: 'claude', machine: 'm' })
  if (verdict !== 'crash') store.recordEnd('film', { kind: 'end', step, attempt: n, at: ago(minutesAgo), verdict, problems: [`${step} ${n} problem`] })
}

describe('the caps (CONTENT_PROCESS.md)', () => {
  it('are 3 boards, 2 animatics, 2 masters and 90 minutes', () => {
    expect(CAPS).toEqual({ boards: 3, animatics: 2, masters: 2, minutes: 90 })
  })
})

describe('FileClaimStore', () => {
  it('writes an append-only file and reads attempts back with their verdicts', () => {
    const store = new FileClaimStore(dir)
    expect(store.attempts('film')).toEqual([])
    expect(store.startedAt('film')).toBeNull()
    spend(store, 'brief', 10, 'pass')
    spend(store, 'board', 5, 'fail')
    const attempts = store.attempts('film')
    expect(attempts.map((a) => [a.step, a.attempt, a.verdict])).toEqual([['brief', 1, 'pass'], ['board', 1, 'fail']])
    expect(attempts[1].problems).toEqual(['board 1 problem'])
    expect(store.startedAt('film')).toBe(ago(10))
  })

  it('keeps a step that never reported: a crash still counts as an attempt', () => {
    const store = new FileClaimStore(dir)
    spend(store, 'board', 5, 'crash')
    expect(store.attempts('film')[0].verdict).toBeUndefined()
  })

  it('refuses a damaged file instead of skipping a line', () => {
    const store = new FileClaimStore(dir)
    mkdirSync(dirname(attemptsPath(dir, 'film')), { recursive: true })
    writeFileSync(attemptsPath(dir, 'film'), 'not json\n')
    expect(() => store.attempts('film')).toThrow(/damaged/)
    appendFileSync(attemptsPath(dir, 'film'), '{"kind":"end","step":"board","attempt":1,"at":"x"}\n')
    expect(parseAttempts('{"kind":"end","step":"board","attempt":9,"at":"x"}\n').errors[0]).toMatch(/never started/)
  })
})

describe('capRefusal', () => {
  it('lets a job with no history run', () => {
    expect(capRefusal(new FileClaimStore(dir), 'film', 'brief', NOW)).toBeNull()
  })

  it('stops a fourth board, and prints what failed each time', () => {
    const store = new FileClaimStore(dir)
    for (let i = 0; i < 3; i++) spend(store, 'board', 10 - i)
    expect(capRefusal(store, 'film', 'board', NOW)?.problem).toMatch(/already spent its 3 boards[\s\S]*board attempt 1[\s\S]*board 1 problem[\s\S]*board attempt 3/)
    expect(capRefusal(store, 'film', 'master', NOW)).toBeNull()
  })

  it('stops a third animatic and a third master, and not a second', () => {
    const store = new FileClaimStore(dir)
    spend(store, 'animatic', 20)
    spend(store, 'master', 20)
    expect(capRefusal(store, 'film', 'animatic', NOW)).toBeNull()
    expect(capRefusal(store, 'film', 'master', NOW)).toBeNull()
    spend(store, 'animatic', 19)
    spend(store, 'master', 19)
    expect(capRefusal(store, 'film', 'animatic', NOW)?.cap).toBe('animatics')
    expect(capRefusal(store, 'film', 'master', NOW)?.cap).toBe('masters')
  })

  it('counts a crashed attempt, and says it never reported', () => {
    const store = new FileClaimStore(dir)
    spend(store, 'master', 30, 'crash')
    spend(store, 'master', 20)
    expect(capRefusal(store, 'film', 'master', NOW)?.problem).toContain('it never reported (it crashed)')
  })

  it('runs the 90 minutes from the first brief attempt, for every step', () => {
    const store = new FileClaimStore(dir)
    spend(store, 'brief', 89, 'pass')
    expect(capRefusal(store, 'film', 'voice', NOW)).toBeNull()
    const late = new FileClaimStore(join(dir, 'late'))
    spend(late, 'brief', 91, 'pass')
    const refusal = capRefusal(late, 'film', 'voice', NOW)
    expect(refusal?.cap).toBe('minutes')
    expect(refusal?.problem).toMatch(/91 minutes of its 90/)
  })

  it('does not start the clock before a first brief attempt', () => {
    const store = new FileClaimStore(dir)
    spend(store, 'board', 500)
    expect(capRefusal(store, 'film', 'animatic', NOW)).toBeNull()
  })
})
