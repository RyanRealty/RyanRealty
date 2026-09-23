import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * FUNNEL-5 / TRACK-8 (visibility audit 2026-09-22). The crm-health-check backfill
 * stamped custom.first_broker_action_at from the first outbound timeline row of
 * ANY kind, so the site's own same-minute confirmation became "the broker's first
 * action". It must stamp only from a row that passes isHumanTouch.
 */

type Row = Record<string, unknown>
const h = vi.hoisted(() => ({
  people: [] as Array<{ id: number; custom: Record<string, unknown> | null }>,
  timeline: new Map<number, Row[]>(),
  timelineReads: 0,
  stamp: vi.fn(async (_sb: unknown, _personId: number, _input: Record<string, unknown>) => true),
}))

type Fake = {
  select: () => Fake
  eq: (col: string, v: unknown) => Fake
  gte: () => Fake
  in: () => Fake
  order: () => Fake
  limit: () => Fake
  range: (a: number, b: number) => Fake
  then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => Promise<unknown>
}

function query(table: string): Fake {
  const f: { personId?: number; from?: number; to?: number } = {}
  const q: Fake = {
    select: () => q,
    eq: (col: string, v: unknown) => {
      if (col === 'person_id') f.personId = Number(v)
      return q
    },
    gte: () => q,
    in: () => q,
    order: () => q,
    limit: () => q,
    range: (a: number, b: number) => {
      f.from = a
      f.to = b
      return q
    },
    then(resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) {
      if (table === 'crm_people') return Promise.resolve({ data: h.people, error: null }).then(resolve, reject)
      h.timelineReads++
      const rows = (h.timeline.get(f.personId ?? -1) ?? []).slice(f.from ?? 0, (f.to ?? 10_000) + 1)
      return Promise.resolve({ data: rows, error: null }).then(resolve, reject)
    },
  }
  return q
}

vi.mock('@/lib/supabase/service', () => ({ createServiceClient: () => ({ from: (t: string) => query(t) }) }))
vi.mock('@/lib/crm/first-broker-action', () => ({ stampFirstBrokerActionIfEmpty: h.stamp }))

import { backfillFirstBrokerActionStamps } from './backfillFirstBrokerAction'
import { firstHumanTouchRow } from '@/lib/crm/response-clock'

const CONFIRMATION: Row = {
  kind: 'email_out',
  ts: '2026-09-22T17:21:41.000Z',
  source: 'app',
  broker: 'matt',
  payload: { initiator: 'system', purpose: 'contact:confirmation' },
}
const DRIP: Row = { kind: 'email_out', ts: '2026-09-22T17:28:38.000Z', source: 'sequence', broker: 'matt', payload: {} }
const REPLY: Row = { kind: 'email_out', ts: '2026-09-22T18:02:10.000Z', source: 'gmail', broker: 'matt', payload: null }

beforeEach(() => {
  h.people = []
  h.timeline = new Map()
  h.timelineReads = 0
  h.stamp.mockClear()
})

describe('firstHumanTouchRow', () => {
  it('passes over the confirmation and the drip to the broker reply', () => {
    expect(firstHumanTouchRow([CONFIRMATION, DRIP, REPLY])).toBe(REPLY)
  })

  it('returns null when only the rails have written', () => {
    expect(firstHumanTouchRow([CONFIRMATION, DRIP])).toBeNull()
  })
})

describe('backfillFirstBrokerActionStamps', () => {
  it('stamps from the first human touch, not the first outbound row', async () => {
    h.people = [{ id: 64105, custom: {} }]
    h.timeline.set(64105, [CONFIRMATION, DRIP, REPLY])
    const res = await backfillFirstBrokerActionStamps({ sinceDays: 14, limit: 100 })
    expect(res).toEqual({ scanned: 1, stamped: 1 })
    expect(h.stamp).toHaveBeenCalledTimes(1)
    expect(h.stamp.mock.calls[0][1]).toBe(64105)
    expect(h.stamp.mock.calls[0][2]).toEqual({ kind: 'email_out', at: REPLY.ts, broker: 'matt' })
  })

  it('leaves a person nobody touched unstamped', async () => {
    h.people = [{ id: 64099, custom: {} }]
    h.timeline.set(64099, [CONFIRMATION, DRIP])
    const res = await backfillFirstBrokerActionStamps()
    expect(res).toEqual({ scanned: 1, stamped: 0 })
    expect(h.stamp).not.toHaveBeenCalled()
  })

  it('never rewrites an existing stamp', async () => {
    h.people = [{ id: 1, custom: { first_broker_action_at: '2026-09-01T00:00:00Z' } }]
    h.timeline.set(1, [REPLY])
    await backfillFirstBrokerActionStamps()
    expect(h.timelineReads).toBe(0)
    expect(h.stamp).not.toHaveBeenCalled()
  })

  it('pages past a long run of machine rows to reach the human one', async () => {
    const machine = Array.from({ length: 450 }, (_, i) => ({
      ...DRIP,
      ts: `2026-09-22T17:${String(30 + Math.floor(i / 60)).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}.000Z`,
    }))
    h.people = [{ id: 7, custom: null }]
    h.timeline.set(7, [...machine, REPLY])
    const res = await backfillFirstBrokerActionStamps()
    expect(res.stamped).toBe(1)
    expect(h.stamp.mock.calls[0][2]).toMatchObject({ at: REPLY.ts })
  })
})
