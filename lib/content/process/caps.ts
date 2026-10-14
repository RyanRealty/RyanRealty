/**
 * lib/content/process/caps.ts - the limits on one job (CONTENT_PROCESS.md,
 * "What keeps it from burning time and tokens").
 *
 * A job is one slug. It may spend 3 boards, 2 animatics and 2 masters, and 90
 * minutes from its first brief attempt. Over a cap the run stops and prints
 * what failed each time, so a bot cannot retry its way past a rule.
 *
 * The count comes from an append-only file, out/studio/<slug>/stamps/attempts.jsonl:
 * a `start` line when a step begins and an `end` line with its verdict. A step
 * that crashed leaves a start with no end, and still counts. ClaimStore is the
 * seam: the job-claims table (CONTENT_PROCESS.md ruling 7) replaces the file one.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { CAPS, type StepId } from './rules'
import { CAPPED_STEPS } from './steps'

export { CAPS }
export type CapName = keyof typeof CAPS

export type AttemptLine =
  | { kind: 'start'; step: StepId; attempt: number; at: string; builder: string; machine: string }
  | { kind: 'end'; step: StepId; attempt: number; at: string; verdict: 'pass' | 'fail'; problems: string[] }

export type Attempt = {
  step: StepId
  attempt: number
  startedAt: string
  builder: string
  machine: string
  /** Absent when the step never reported (it crashed). */
  verdict?: 'pass' | 'fail'
  problems: string[]
}

/** Where attempts are kept. The file one below is phase 1; the database one replaces it. */
export interface ClaimStore {
  /** Every attempt for the slug, in the order they started. */
  attempts(slug: string): Attempt[]
  /** When the slug's first brief attempt started, or null before it has one. */
  startedAt(slug: string): string | null
  recordStart(slug: string, line: Extract<AttemptLine, { kind: 'start' }>): void
  recordEnd(slug: string, line: Extract<AttemptLine, { kind: 'end' }>): void
}

export function attemptsPath(outRoot: string, slug: string): string {
  return join(outRoot, 'studio', slug, 'stamps', 'attempts.jsonl')
}

/** Parse attempts.jsonl; a line that is not an attempt line is an error, never skipped. */
export function parseAttempts(text: string): { attempts: Attempt[]; errors: string[] } {
  const attempts: Attempt[] = []
  const errors: string[] = []
  text.split(/\r?\n/).forEach((line, i) => {
    if (line.trim() === '') return
    let raw: Partial<AttemptLine> | null
    try {
      raw = JSON.parse(line) as Partial<AttemptLine> | null
    } catch {
      errors.push(`line ${i + 1} is not JSON`)
      return
    }
    if (!raw || typeof raw !== 'object' || typeof raw.step !== 'string' || typeof raw.attempt !== 'number' || typeof raw.at !== 'string') {
      errors.push(`line ${i + 1} is not an attempt line`)
      return
    }
    if (raw.kind === 'start') {
      attempts.push({ step: raw.step, attempt: raw.attempt, startedAt: raw.at, builder: String(raw.builder ?? ''), machine: String(raw.machine ?? ''), problems: [] })
    } else if (raw.kind === 'end') {
      const a = [...attempts].reverse().find((x) => x.step === raw!.step && x.attempt === raw!.attempt)
      if (!a) {
        errors.push(`line ${i + 1} ends an attempt that never started`)
        return
      }
      a.verdict = raw.verdict === 'pass' ? 'pass' : 'fail'
      a.problems = Array.isArray(raw.problems) ? raw.problems.map(String) : []
    } else errors.push(`line ${i + 1} is neither a start nor an end`)
  })
  return { attempts, errors }
}

export class FileClaimStore implements ClaimStore {
  constructor(private readonly outRoot: string) {}

  private read(slug: string): Attempt[] {
    const file = attemptsPath(this.outRoot, slug)
    if (!existsSync(file)) return []
    const { attempts, errors } = parseAttempts(readFileSync(file, 'utf8'))
    if (errors.length) throw new Error(`${file} is damaged: ${errors.slice(0, 3).join('; ')}`)
    return attempts
  }

  attempts(slug: string): Attempt[] {
    return this.read(slug)
  }

  startedAt(slug: string): string | null {
    return this.read(slug).find((a) => a.step === 'brief')?.startedAt ?? null
  }

  private append(slug: string, line: AttemptLine): void {
    const file = attemptsPath(this.outRoot, slug)
    mkdirSync(dirname(file), { recursive: true })
    appendFileSync(file, `${JSON.stringify(line)}\n`)
  }

  recordStart(slug: string, line: Extract<AttemptLine, { kind: 'start' }>): void {
    this.append(slug, line)
  }

  recordEnd(slug: string, line: Extract<AttemptLine, { kind: 'end' }>): void {
    this.append(slug, line)
  }
}

export type CapRefusal = { cap: CapName; problem: string }

/**
 * May this step run now? A refusal names the cap and prints what failed each
 * time. The minutes run from the slug's first brief attempt (a first brief is
 * never refused for time: there is no clock yet).
 */
export function capRefusal(store: ClaimStore, slug: string, step: StepId, now: Date, caps = CAPS): CapRefusal | null {
  const attempts = store.attempts(slug)
  const startedAt = store.startedAt(slug)
  if (startedAt !== null) {
    const spent = (now.getTime() - Date.parse(startedAt)) / 60000
    if (spent > caps.minutes) {
      return { cap: 'minutes', problem: `this job has used ${Math.round(spent)} minutes of its ${caps.minutes} (the clock started at its first brief attempt, ${startedAt}); stop, report what failed, and ask Matt${failedEach(attempts)}` }
    }
  }
  const cap = CAPPED_STEPS[step]
  if (!cap) return null
  const used = attempts.filter((a) => a.step === step).length
  if (used >= caps[cap]) {
    return { cap, problem: `this job has already spent its ${caps[cap]} ${cap} (${used} ${step} attempts); stop and report${failedEach(attempts.filter((a) => a.step === step))}` }
  }
  return null
}

/** What failed each time, one line per failed attempt. */
function failedEach(attempts: readonly Attempt[]): string {
  const failed = attempts.filter((a) => a.verdict !== 'pass')
  if (failed.length === 0) return ''
  const lines = failed.map((a) => `  - ${a.step} attempt ${a.attempt} (${a.startedAt}): ${a.verdict === undefined ? 'it never reported (it crashed)' : a.problems.slice(0, 3).join('; ') || 'failed'}`)
  return `\nWhat failed each time:\n${lines.join('\n')}`
}
