import { describe, expect, it, vi, beforeEach } from 'vitest'

const state = {
  person: { id: 1, stage: 'Nurture' } as { id: number; stage: string | null } | null,
  updated: [] as Array<Record<string, unknown>>,
  timeline: [] as Array<Record<string, unknown>>,
  enrollmentsPaused: [] as Array<{ id: number }>,
  tasks: [] as Array<Record<string, unknown>>,
  alerts: [] as Array<Record<string, unknown>>,
  idemSeen: new Set<string>(),
}

vi.mock('server-only', () => ({}))

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({
    from(table: string) {
      const api: Record<string, unknown> = {
        select: () => api,
        eq: () => api,
        maybeSingle: async () => ({ data: state.person, error: null }),
        insert: async (row: Record<string, unknown>) => {
          if (table === 'crm_timeline') state.timeline.push(row)
          return { data: null, error: null }
        },
        update(row: Record<string, unknown>) {
          if (table === 'crm_people') state.updated.push(row)
          const chain: Record<string, unknown> = {
            eq: () => chain,
            select: async () => ({ data: state.enrollmentsPaused, error: null }),
          }
          return chain
        },
      }
      return api
    },
  }),
}))

vi.mock('@/lib/crm/idempotency', () => ({
  withIdempotency: async (args: { key: string }, run: () => Promise<unknown>) => {
    if (state.idemSeen.has(args.key)) return { tasked: false, alerted: false }
    state.idemSeen.add(args.key)
    return run()
  },
}))

vi.mock('@/lib/data/crm/ensureNativeLead', () => ({
  createNativeTask: async (t: Record<string, unknown>) => { state.tasks.push(t) },
}))

vi.mock('@/lib/crm/broker-alerts', () => ({
  queueBrokerAlert: async (a: Record<string, unknown>) => { state.alerts.push(a); return true },
}))

const { handleInboundReply } = await import('./on-reply')

beforeEach(() => {
  state.person = { id: 1, stage: 'Nurture' }
  state.updated = []
  state.timeline = []
  state.enrollmentsPaused = [{ id: 9 }]
  state.tasks = []
  state.alerts = []
  state.idemSeen = new Set()
})

describe('handleInboundReply — a two-way conversation is engagement', () => {
  it('advances Nurture to Engaged and records the transition structurally', () => {
    return handleInboundReply({ personId: 1, broker: 'matt', channel: 'sms', preview: 'yes please' }).then((r) => {
      expect(r.advanced).toBe(true)
      expect(state.updated[0]?.stage).toBe('Engaged')
      const row = state.timeline.find((t) => t.kind === 'stage_change')
      expect(row?.title).toBe('Stage: Nurture → Engaged')
      expect(row?.payload).toMatchObject({ from: 'Nurture', to: 'Engaged', via: 'sms' })
    })
  })

  it('advances a Lead too', async () => {
    state.person = { id: 1, stage: 'Lead' }
    expect((await handleInboundReply({ personId: 1, channel: 'sms' })).advanced).toBe(true)
  })

  it('does NOT demote someone already further along', async () => {
    for (const stage of ['Active Client', 'Pending', 'Closed', 'Past Client', 'Sphere']) {
      state.person = { id: 1, stage }
      state.updated = []
      const r = await handleInboundReply({ personId: 1, channel: 'sms' })
      expect(r.advanced).toBe(false)
      expect(state.updated).toHaveLength(0)
    }
  })

  it('does NOT resurrect a binned contact', async () => {
    state.person = { id: 1, stage: 'Trash' }
    expect((await handleInboundReply({ personId: 1, channel: 'sms' })).advanced).toBe(false)
  })

  it('stops running automation immediately', async () => {
    const r = await handleInboundReply({ personId: 1, channel: 'sms' })
    expect(r.paused).toBe(1)
  })

  it('tasks the broker and alerts them', async () => {
    const r = await handleInboundReply({ personId: 1, broker: 'rebecca', channel: 'sms', preview: 'call me' })
    expect(r.tasked).toBe(true)
    expect(r.alerted).toBe(true)
    expect(state.tasks[0]).toMatchObject({ personId: 1, assignedBroker: 'rebecca' })
    expect(state.alerts[0]).toMatchObject({ broker: 'rebecca', kind: 'reply:sms' })
    expect(String(state.alerts[0]?.body)).toContain('call me')
  })

  it('falls back to the default desk on an unknown broker', async () => {
    await handleInboundReply({ personId: 1, broker: 'nobody', channel: 'sms' })
    expect(state.tasks[0]).toMatchObject({ assignedBroker: 'matt' })
  })

  it('a burst of texts produces ONE task, not one per message', async () => {
    await handleInboundReply({ personId: 1, channel: 'sms', preview: 'one' })
    await handleInboundReply({ personId: 1, channel: 'sms', preview: 'two' })
    await handleInboundReply({ personId: 1, channel: 'sms', preview: 'three' })
    expect(state.tasks).toHaveLength(1)
    expect(state.alerts).toHaveLength(1)
  })

  it('ignores a bad person id instead of throwing into the webhook', async () => {
    const r = await handleInboundReply({ personId: 0, channel: 'sms' })
    expect(r.advanced).toBe(false)
    expect(state.tasks).toHaveLength(0)
  })
})
