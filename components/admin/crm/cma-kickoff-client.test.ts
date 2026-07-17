import { describe, expect, it } from 'vitest'
import { resolveKickoff } from './cma-kickoff-client'
import type { CmaKickoffResult } from '@/lib/crm/cma-kickoff'

const ok = (extra: Partial<Extract<CmaKickoffResult, { ok: true }>> = {}): CmaKickoffResult => ({
  ok: true,
  slug: 'cma-test',
  alreadyQueued: false,
  ...extra,
})
const noSleep = () => Promise.resolve()

function scripted(results: Array<CmaKickoffResult | 'reject'>) {
  let i = 0
  return () => {
    const r = results[Math.min(i++, results.length - 1)]
    return r === 'reject' ? Promise.reject(new Error('aborted')) : Promise.resolve(r)
  }
}

describe('resolveKickoff (adversarial-review hardening)', () => {
  it('happy path resolves done', async () => {
    const out = await resolveKickoff(scripted([ok()]), noSleep)
    expect(out).toEqual({ kind: 'done', result: ok() })
  })

  it('aborted POST retries once with the same attempt and succeeds', async () => {
    const out = await resolveKickoff(scripted(['reject', ok()]), noSleep)
    expect(out.kind).toBe('done')
  })

  it('double abort gives an honest tryAgain, never a fabricated success', async () => {
    const out = await resolveKickoff(scripted(['reject', 'reject']), noSleep)
    expect(out.kind).toBe('tryAgain')
  })

  it('inFlight polls again and returns the sibling\'s stored truth', async () => {
    const out = await resolveKickoff(
      scripted([ok({ inFlight: true, alreadyQueued: true }), ok()]),
      noSleep,
    )
    expect(out).toEqual({ kind: 'done', result: ok() })
  })

  it('inFlight where the sibling FAILED surfaces the real error (poll claims the released key)', async () => {
    const out = await resolveKickoff(
      scripted([ok({ inFlight: true, alreadyQueued: true }), { ok: false, error: 'no city' }]),
      noSleep,
    )
    expect(out).toEqual({ kind: 'error', message: 'no city' })
  })

  it('exhausted inFlight polls give up HONESTLY (the review-HIGH: no fabricated kicked-off)', async () => {
    const inflight = ok({ inFlight: true, alreadyQueued: true })
    const out = await resolveKickoff(scripted([inflight, inflight, inflight, inflight]), noSleep)
    expect(out.kind).toBe('tryAgain')
  })
})
