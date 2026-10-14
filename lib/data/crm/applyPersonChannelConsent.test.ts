import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type PersonRow = {
  id: number
  tags: string[]
  custom: Record<string, unknown>
  deleted?: boolean
}

const state = {
  person: {
    id: 57526,
    tags: ['sms-consent:no', 'broker:matt'],
    custom: { cmaConsent: { sms: false, email: false, slug: 'cma-x' } },
  } as PersonRow | null,
  suppressions: [{ id: 12, channel: 'sms', reason: 'no-sms-consent' }] as Array<{
    id: number
    channel: string
    reason: string
    cleared_at?: string | null
  }>,
  updates: [] as Array<Record<string, unknown>>,
  added: [] as Array<Record<string, unknown>>,
  timeline: [] as Array<Record<string, unknown>>,
}

vi.mock('server-only', () => ({}))
vi.mock('@/lib/crm/suppressions', () => ({
  addSuppression: async (row: Record<string, unknown>) => {
    state.added.push(row)
  },
}))

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({
    from(table: string) {
      const chain: Record<string, unknown> = {}
      const back = () => chain
      chain.select = back
      chain.eq = back
      chain.in = back
      chain.limit = back
      chain.is = () => {
        if (table === 'crm_suppressions') {
          return Promise.resolve({
            data: state.suppressions.filter((r) => !r.cleared_at),
            error: null,
          })
        }
        return Promise.resolve({ data: null, error: null })
      }
      chain.maybeSingle = async () => {
        if (table === 'crm_people') return { data: state.person, error: null }
        if (table === 'crm_timeline') {
          const last = state.timeline[state.timeline.length - 1]
          return { data: last ? { id: 9101 } : null, error: null }
        }
        return { data: null, error: null }
      }
      chain.update = (row: Record<string, unknown>) => {
        if (table === 'crm_people') state.updates.push(row)
        return chain
      }
      chain.insert = (row: Record<string, unknown>) => {
        if (table === 'crm_timeline') state.timeline.push(row)
        return chain
      }
      return chain
    },
  }),
}))

const { applyPersonChannelConsent } = await import('./applyPersonChannelConsent')

beforeEach(() => {
  state.person = {
    id: 57526,
    tags: ['sms-consent:no', 'broker:matt'],
    custom: { cmaConsent: { sms: false, email: false, slug: 'cma-x' } },
  }
  state.suppressions = [{ id: 12, channel: 'sms', reason: 'no-sms-consent' }]
  state.updates = []
  state.added = []
  state.timeline = []
})
afterEach(() => vi.clearAllMocks())

describe('applyPersonChannelConsent', () => {
  it('allows SMS, resets CMA sms, and writes a timeline note', async () => {
    const out = await applyPersonChannelConsent({
      personId: 57526,
      channel: 'sms',
      allowed: true,
      broker: 'matt',
    })
    expect(out.ok).toBe(true)
    expect(out.applied).toBe(true)
    expect((state.updates[0]?.custom as { cmaConsent: { sms: boolean } }).cmaConsent.sms).toBe(true)
    expect(state.updates[0]?.tags).toEqual(['broker:matt', 'sms-consent:yes'])
    expect(state.timeline[0]).toMatchObject({
      person_id: 57526,
      source: 'admin-consent',
      title: 'SMS consent set to allowed',
    })
    expect(out.timelineId).toBe(9101)
  })

  it('refuses to allow SMS when STOP is on file', async () => {
    state.suppressions = [{ id: 9, channel: 'sms', reason: 'stop-keyword' }]
    const out = await applyPersonChannelConsent({
      personId: 57526,
      channel: 'sms',
      allowed: true,
    })
    expect(out.applied).toBe(false)
    expect(out.skipped).toBe('refuse')
    expect(out.reason).toBe('stop-keyword')
    expect(state.updates).toEqual([])
    expect(state.timeline).toEqual([])
  })
})
