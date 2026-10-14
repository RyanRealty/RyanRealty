import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type Row = { id: number; reason: string; source: string; cleared_at?: string | null }

let rows: Row[] = []
let updatePayload: Record<string, unknown> | null = null
let updatedIds: number[] = []

function makeSb() {
  return {
    from(table: string) {
      if (table !== 'crm_suppressions') return { select: () => ({}) }
      const chain: Record<string, unknown> = {}
      chain.select = () => chain
      chain.eq = () => chain
      chain.in = (_col: string, ids: number[]) => {
        updatedIds = ids
        return chain
      }
      chain.is = () => {
        if (updatePayload) {
          return Promise.resolve({ data: null, error: null })
        }
        return Promise.resolve({
          data: rows.filter((r) => !r.cleared_at),
          error: null,
        })
      }
      chain.update = (payload: Record<string, unknown>) => {
        updatePayload = payload
        return chain
      }
      return chain
    },
  }
}

vi.mock('@/lib/supabase/service', () => ({ createServiceClient: () => makeSb() }))

import { clearNonOptOutSuppressions } from '@/lib/crm/suppressions'

beforeEach(() => {
  rows = []
  updatePayload = null
  updatedIds = []
})
afterEach(() => vi.clearAllMocks())

describe('clearNonOptOutSuppressions', () => {
  it('marks import hard-stops cleared and leaves STOP', async () => {
    rows = [
      { id: 1, reason: 'tcpa-hard-stop', source: 'import' },
      { id: 2, reason: 'stop-keyword', source: 'twilio' },
      { id: 3, reason: 'no-sms-consent', source: 'import' },
    ]
    const out = await clearNonOptOutSuppressions({
      personId: 9,
      clearedBy: 'inbound-sms',
      clearedReason: 'inbound sms_in SMabc',
    })
    expect(out.cleared).toBe(2)
    expect(updatedIds.sort()).toEqual([1, 3])
    expect(updatePayload).toMatchObject({
      cleared_by: 'inbound-sms',
      cleared_reason: 'inbound sms_in SMabc',
    })
    expect(updatePayload?.cleared_at).toEqual(expect.any(String))
  })

  it('does not clear an already-cleared row or a bounce', async () => {
    rows = [
      { id: 4, reason: 'tcpa-hard-stop', source: 'import', cleared_at: '2026-10-01T00:00:00Z' },
      { id: 5, reason: 'bounced', source: 'resend-webhook' },
    ]
    const out = await clearNonOptOutSuppressions({
      personId: 9,
      clearedBy: 'inbound-sms',
      clearedReason: 'inbound sms_in SMabc',
    })
    expect(out.cleared).toBe(0)
    expect(updatePayload).toBeNull()
  })
})
