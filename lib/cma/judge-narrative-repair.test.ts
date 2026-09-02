/**
 * Guards on the audit-driven narrative repair.
 *
 * The repair exists because an analysis with sound comps and sound pricing was
 * failing its adversarial audit over a sentence — a miscounted bedroom claim, a
 * $/sqft bracket no comp falls in — and had no path back. On 2026-08-06 every
 * stored CMA carried `Audit verdict: fail` and sat in draft.
 *
 * These tests cover the FAIL-OPEN contract, which is the part that must never
 * regress: the repair is an optimization, so every way it can decline has to
 * leave the caller with its original narrative and its review flag intact. A
 * repair that throws, or that quietly returns an empty narrative, would either
 * brick a build or blank the prose a seller reads.
 *
 * The accept/reject decision itself is deliberately NOT tested by mocking a
 * model response, because the decision does not live in the model: build.ts
 * re-runs checkNarrativeIntegrity and keeps the rewrite only when it is not
 * worse. That deterministic check is covered by its own suite.
 */
import { describe, expect, it } from 'vitest'
import { repairNarrativeAgainstAudit } from '@/lib/cma/judge'
import type { CmaComp, CmaSubject } from '@/lib/cma/types'

const SUBJECT = {
  streetAddress: '20513 Byron Ave',
  city: 'Bend',
  subdivision: 'Stone Creek',
  beds: 4,
  baths: 3,
  sqft: 2200,
} as unknown as CmaSubject

const COMPS = [{ listingKey: '1', address: '20608 Rolen Ave' }] as unknown as CmaComp[]

const JUDGMENT = {
  narrative: 'Six sales closed from $279 to $289 per square foot. Five are 4-bedroom homes.',
  verdicts: [],
} as never

describe('repairNarrativeAgainstAudit — fail-open contract', () => {
  const withKey = async (key: string | undefined, run: () => Promise<unknown>) => {
    const prior = process.env.XAI_API_KEY
    if (key === undefined) delete process.env.XAI_API_KEY
    else process.env.XAI_API_KEY = key
    try {
      return await run()
    } finally {
      if (prior === undefined) delete process.env.XAI_API_KEY
      else process.env.XAI_API_KEY = prior
    }
  }

  it('returns null with no API key, so a keyless build keeps its narrative', async () => {
    const out = await withKey(undefined, () =>
      repairNarrativeAgainstAudit({
        subject: SUBJECT,
        comps: COMPS,
        market: null,
        judgment: JUDGMENT,
        findings: ['The narrative misstates the bedroom composition.'],
      }),
    )
    expect(out).toBeNull()
  })

  it('returns null when the audit raised nothing about the prose', async () => {
    const out = await withKey('test-key', () =>
      repairNarrativeAgainstAudit({
        subject: SUBJECT,
        comps: COMPS,
        market: null,
        judgment: JUDGMENT,
        findings: [],
      }),
    )
    expect(out).toBeNull()
  })

  it('returns null when there are no comps to check a claim against', async () => {
    const out = await withKey('test-key', () =>
      repairNarrativeAgainstAudit({
        subject: SUBJECT,
        comps: [],
        market: null,
        judgment: JUDGMENT,
        findings: ['The narrative misstates the bedroom composition.'],
      }),
    )
    expect(out).toBeNull()
  })

  it('returns null when there is no narrative to repair', async () => {
    const out = await withKey('test-key', () =>
      repairNarrativeAgainstAudit({
        subject: SUBJECT,
        comps: COMPS,
        market: null,
        judgment: { ...(JUDGMENT as object), narrative: '   ' } as never,
        findings: ['The narrative misstates the bedroom composition.'],
      }),
    )
    expect(out).toBeNull()
  })
})
