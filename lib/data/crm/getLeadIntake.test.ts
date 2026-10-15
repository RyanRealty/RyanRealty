import { describe, expect, it, vi } from 'vitest'
import { fakeSupabase } from '@/test/fake-supabase-chain'

const people = [
  { id: 1, name: 'Old Contact', source: 'Contact form', assigned_broker: 'matt', created_at: '2026-10-07T10:00:00Z' },
  { id: 2, name: null, source: 'Farm', assigned_broker: 'matt', created_at: '2026-10-08T10:00:00Z' },
  { id: 3, name: 'Alert Person', source: 'listing-alert', assigned_broker: null, created_at: '2026-10-09T10:00:00Z' },
  { id: 4, name: 'Newest', source: 'Contact form', assigned_broker: 'Matt', created_at: '2026-10-13T10:00:00Z' },
]
const fake = fakeSupabase(() => ({ data: people, error: null }))
vi.mock('@/lib/supabase/service', () => ({ createServiceClient: () => fake.client }))
vi.mock('@/lib/data/cache/next-cache', () => ({ unstable_cache: (fn: () => unknown) => fn }))

const { getLeadIntake } = await import('./getLeadIntake')

describe('getLeadIntake — door breakdown and newest leads', () => {
  it('counts inbound by form or path and lists the newest first with ids', async () => {
    const r = await getLeadIntake({ startIso: '2026-10-07T00:00:00Z', endIso: '2026-10-13T23:59:59Z' })
    expect(r.inboundLeads).toBe(3)
    expect(r.outreachAdded).toBe(1)
    expect(r.byDoor.reduce((n, d) => n + d.count, 0)).toBe(3)
    expect(r.byDoor[0]).toMatchObject({ count: 2 })
    // Outreach rows never appear in the newest list.
    expect(r.recent.map((x) => x.id)).toEqual([4, 3, 1])
    expect(r.recent[0]).toMatchObject({ id: 4, name: 'Newest', broker: 'matt' })
    expect(r.recent[1].broker).toBe('unassigned')
    expect(fake.chains[0].calls.find((c) => c.method === 'select')?.args[0]).toContain('id, name')
  })
})
