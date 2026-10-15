import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type PersonRow = {
  id: number
  tags: string[]
  emails: Array<{ value: string }>
  deleted?: boolean
}
type SuppressionRow = { id: number; channel: string; reason: string; cleared_at?: string | null }

const state = {
  person: {
    id: 57526,
    tags: ['contact:do-not-call', 'contact:do-not-text', 'broker:matt', 'unsubscribed'],
    emails: [{ value: 'leslie@example.com' }],
  } as PersonRow | null,
  trackedSends: 1,
  suppressions: [
    { id: 11, channel: 'call', reason: 'contact:do-not-call' },
    { id: 12, channel: 'sms', reason: 'no-sms-consent' },
    { id: 13, channel: 'email', reason: 'unsubscribe' },
  ] as SuppressionRow[],
  tagUpdates: [] as Array<Record<string, unknown>>,
  clearedIds: [] as number[],
  timeline: [] as Array<Record<string, unknown>>,
}

vi.mock('server-only', () => ({}))

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({
    from(table: string) {
      const chain: Record<string, unknown> = {}
      const back = () => chain
      chain.select = back
      chain.eq = back
      chain.in = (col: string, ids: unknown[]) => {
        if (table === 'crm_suppressions' && col === 'id') {
          state.clearedIds = (ids as number[]).slice()
        }
        return chain
      }
      chain.limit = back
      chain.is = () => {
        if (table === 'crm_suppressions' && state.clearedIds.length === 0) {
          return Promise.resolve({
            data: state.suppressions.filter((r) => !r.cleared_at),
            error: null,
          })
        }
        return Promise.resolve({ data: null, error: null })
      }
      chain.maybeSingle = async () => {
        if (table === 'email_events') {
          return { data: state.trackedSends > 0 ? { id: 1 } : null, error: null }
        }
        if (table === 'crm_people') {
          return { data: state.person, error: null }
        }
        if (table === 'crm_timeline') {
          const last = state.timeline[state.timeline.length - 1]
          return { data: last ? { id: 9001 } : null, error: null }
        }
        return { data: null, error: null }
      }
      chain.update = (row: Record<string, unknown>) => {
        if (table === 'crm_people') state.tagUpdates.push(row)
        return chain
      }
      chain.upsert = (row: Record<string, unknown>) => {
        if (table === 'crm_timeline') state.timeline.push(row)
        return chain
      }
      return chain
    },
  }),
}))

const { applyInboundConsentClear } = await import('./applyInboundConsentClear')

beforeEach(() => {
  state.person = {
    id: 57526,
    tags: ['contact:do-not-call', 'contact:do-not-text', 'broker:matt', 'unsubscribed'],
    emails: [{ value: 'leslie@example.com' }],
  }
  state.trackedSends = 1
  state.suppressions = [
    { id: 11, channel: 'call', reason: 'contact:do-not-call' },
    { id: 12, channel: 'sms', reason: 'no-sms-consent' },
    { id: 13, channel: 'email', reason: 'unsubscribe' },
  ]
  state.tagUpdates = []
  state.clearedIds = []
  state.timeline = []
})
afterEach(() => vi.clearAllMocks())

describe('applyInboundConsentClear', () => {
  it('call clears DNC / no-SMS and writes the timeline note', async () => {
    const out = await applyInboundConsentClear({
      personId: 57526,
      event: 'call',
      eventId: 'CA123',
      broker: 'matt',
    })
    expect(out.ok).toBe(true)
    expect(out.applied).toBe(true)
    expect(out.tagsRemoved).toEqual(['contact:do-not-call', 'contact:do-not-text'])
    expect(state.tagUpdates[0]?.tags).toEqual(['broker:matt', 'unsubscribed'])
    expect(state.clearedIds.sort()).toEqual([11, 12])
    expect(state.timeline[0]).toMatchObject({
      person_id: 57526,
      kind: 'system',
      source: 'inbound-consent-clear',
      dedupe_key: 'inbound-consent-clear:call:CA123:p57526',
    })
    expect(out.timelineId).toBe(9001)
  })

  it('STOP keeps every flag and writes no note', async () => {
    const out = await applyInboundConsentClear({
      personId: 57526,
      event: 'sms',
      smsBody: 'STOP',
      eventId: 'SMstop',
    })
    expect(out.applied).toBe(false)
    expect(out.skipped).toBe('stop-keyword')
    expect(state.tagUpdates).toEqual([])
    expect(state.clearedIds).toEqual([])
    expect(state.timeline).toEqual([])
  })

  it('does not clear when there is no prior tracked send', async () => {
    state.trackedSends = 0
    const out = await applyInboundConsentClear({
      personId: 57526,
      event: 'email',
      eventId: 'msg-1',
    })
    expect(out.applied).toBe(false)
    expect(out.skipped).toBe('no-tracked-send')
    expect(state.tagUpdates).toEqual([])
    expect(state.timeline).toEqual([])
  })
})
