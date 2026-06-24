import { describe, it, expect, vi } from 'vitest'
import {
  canTransition,
  assertEnvelopeTransition,
  isTerminalEnvelopeStatus,
  claimTransition,
  IllegalEnvelopeTransitionError,
  type CasClient,
} from './deal-state'

describe('envelope transition table', () => {
  it('allows the real lifecycle moves', () => {
    expect(canTransition('draft', 'sent')).toBe(true)
    expect(canTransition('sent', 'partially_signed')).toBe(true)
    expect(canTransition('sent', 'completed')).toBe(true)
    expect(canTransition('partially_signed', 'completed')).toBe(true)
    expect(canTransition('draft', 'voided')).toBe(true)
    expect(canTransition('sent', 'voided')).toBe(true)
  })

  it('forbids regressions and resurrecting terminal states', () => {
    expect(canTransition('completed', 'partially_signed')).toBe(false) // the C2 regression
    expect(canTransition('completed', 'sent')).toBe(false)
    expect(canTransition('voided', 'completed')).toBe(false) // sealing a voided envelope
    expect(canTransition('partially_signed', 'sent')).toBe(false)
    expect(canTransition('draft', 'completed')).toBe(false) // can't seal an unsent draft
  })

  it('marks completed + voided terminal, others not', () => {
    expect(isTerminalEnvelopeStatus('completed')).toBe(true)
    expect(isTerminalEnvelopeStatus('voided')).toBe(true)
    expect(isTerminalEnvelopeStatus('draft')).toBe(false)
    expect(isTerminalEnvelopeStatus('sent')).toBe(false)
    expect(isTerminalEnvelopeStatus('partially_signed')).toBe(false)
  })

  it('assertEnvelopeTransition throws IllegalEnvelopeTransitionError on illegal moves', () => {
    expect(() => assertEnvelopeTransition('completed', 'sent')).toThrow(IllegalEnvelopeTransitionError)
    expect(() => assertEnvelopeTransition('sent', 'completed')).not.toThrow()
  })
})

// Build a mock that returns a configurable CAS result and records the query shape.
function mockCas(result: { data: unknown[] | null; error: { message: string } | null }) {
  const calls: { update?: Record<string, unknown>; eqCol?: string; eqVal?: string; inCol?: string; inVals?: readonly string[] } = {}
  const client: CasClient = {
    from: vi.fn(() => ({
      update: (patch: Record<string, unknown>) => {
        calls.update = patch
        return {
          eq: (col: string, val: string) => {
            calls.eqCol = col
            calls.eqVal = val
            return {
              in: (icol: string, ivals: readonly string[]) => {
                calls.inCol = icol
                calls.inVals = ivals
                return { select: () => Promise.resolve(result) }
              },
            }
          },
        }
      },
    })),
  }
  return { client, calls }
}

describe('claimTransition (compare-and-swap)', () => {
  it('returns true when exactly one row was claimed', async () => {
    const { client, calls } = mockCas({ data: [{ id: 'env-1' }], error: null })
    const won = await claimTransition(client, 'env-1', ['sent', 'partially_signed'], 'completed')
    expect(won).toBe(true)
    // verifies it CAS'd the right shape: SET status=completed WHERE id AND status IN (...)
    expect(calls.update).toEqual({ status: 'completed' })
    expect(calls.eqCol).toBe('id')
    expect(calls.eqVal).toBe('env-1')
    expect(calls.inCol).toBe('status')
    expect(calls.inVals).toEqual(['sent', 'partially_signed'])
  })

  it('returns false when the row was already moved (the losing concurrent caller)', async () => {
    const { client } = mockCas({ data: [], error: null })
    const won = await claimTransition(client, 'env-1', ['sent', 'partially_signed'], 'completed')
    expect(won).toBe(false)
  })

  it('throws on a db error', async () => {
    const { client } = mockCas({ data: null, error: { message: 'deadlock' } })
    await expect(claimTransition(client, 'env-1', ['sent'], 'completed')).rejects.toThrow(/deadlock/)
  })

  it('refuses to build an illegal transition before touching the db', async () => {
    const { client } = mockCas({ data: [{ id: 'x' }], error: null })
    // completed -> partially_signed is illegal; must throw, not silently CAS
    await expect(claimTransition(client, 'env-1', ['completed'], 'partially_signed')).rejects.toThrow(
      IllegalEnvelopeTransitionError,
    )
  })
})
