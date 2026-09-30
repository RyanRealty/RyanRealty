import { describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { mergeReportSubscriptionRows, planReportStopCarry } from './merge-people'

/**
 * A contact merge and her market-report stop (review 2026-09-30):
 *   - her own stop on the duplicate carries onto the survivor even when a
 *     broker had stopped the survivor's report (hers replaces the broker's);
 *   - when that carry fails, the duplicate's row is KEPT, never deleted.
 */

type Row = { person_id: number; is_active: boolean; stopped_at: string | null; stopped_via: string | null }

function fakeDb(rows: Row[], opts: { failStopWrite?: boolean } = {}) {
  const table = rows.map((r) => ({ ...r }))
  const timeline: Array<Record<string, unknown>> = []
  const deleted: number[] = []
  const sb = {
    from(name: string) {
      if (name === 'crm_timeline') {
        return {
          insert: async (row: Record<string, unknown>) => {
            timeline.push(row)
            return { error: null }
          },
        }
      }
      if (name !== 'crm_report_subscriptions') throw new Error(`unexpected table ${name}`)
      return {
        select: (_cols: string, o?: { count?: string; head?: boolean }) => ({
          eq: (_col: string, personId: number) => {
            const match = table.filter((r) => r.person_id === personId)
            if (o?.head) return Promise.resolve({ count: match.length, error: null })
            return { maybeSingle: async () => ({ data: match[0] ?? null, error: null }) }
          },
        }),
        update: (patch: Partial<Row>) => ({
          eq: async (_col: string, personId: number) => {
            if (opts.failStopWrite && 'stopped_via' in patch) return { error: { message: 'write timed out' } }
            for (const r of table) if (r.person_id === personId) Object.assign(r, patch)
            return { error: null }
          },
        }),
        delete: () => ({
          eq: async (_col: string, personId: number) => {
            for (let i = table.length - 1; i >= 0; i--) if (table[i]!.person_id === personId) table.splice(i, 1)
            deleted.push(personId)
            return { error: null }
          },
        }),
      }
    },
  }
  return { sb: sb as unknown as SupabaseClient, table, timeline, deleted }
}

const HER_STOP = { is_active: false, stopped_at: '2026-09-20T16:00:00Z', stopped_via: 'one-click' }

describe('planReportStopCarry', () => {
  it('carries her stop onto a survivor that is on, paused, or stopped by a broker', () => {
    expect(planReportStopCarry(HER_STOP, { is_active: true, stopped_at: null, stopped_via: null })).toBe('carry')
    expect(planReportStopCarry(HER_STOP, { is_active: false, stopped_at: null, stopped_via: null })).toBe('carry')
    expect(planReportStopCarry(HER_STOP, { is_active: false, stopped_at: '2026-09-01T00:00:00Z', stopped_via: 'admin' })).toBe('carry')
  })

  it('leaves a survivor that already carries her own stop, and carries nothing that is not hers', () => {
    expect(planReportStopCarry(HER_STOP, { is_active: false, stopped_at: '2026-09-01T00:00:00Z', stopped_via: 'email-link' })).toBe('nothing')
    expect(planReportStopCarry({ is_active: false, stopped_at: '2026-09-01T00:00:00Z', stopped_via: 'admin' }, null)).toBe('nothing')
    expect(planReportStopCarry({ is_active: true, stopped_at: null, stopped_via: null }, null)).toBe('nothing')
  })
})

describe('mergeReportSubscriptionRows', () => {
  it('her stop replaces the survivor\'s BROKER stop, is logged on the survivor, then the duplicate row goes', async () => {
    const db = fakeDb([
      { person_id: 2, ...HER_STOP },
      { person_id: 1, is_active: false, stopped_at: '2026-09-01T00:00:00Z', stopped_via: 'admin' },
    ])
    const repointed: Record<string, number> = {}
    const incidents: string[] = []
    await mergeReportSubscriptionRows(db.sb, 1, 2, repointed, incidents)
    expect(incidents).toEqual([])
    expect(db.table).toEqual([
      expect.objectContaining({ person_id: 1, is_active: false, stopped_at: HER_STOP.stopped_at, stopped_via: 'one-click' }),
    ])
    expect(db.timeline).toHaveLength(1)
    expect(db.timeline[0]).toMatchObject({ person_id: 1, kind: 'system' })
    expect(String(db.timeline[0]!.title)).toContain('carried over from merged contact 2')
    expect(repointed.crm_report_subscriptions).toBe(1)
  })

  it('KEEPS the duplicate\'s row when her stop could not be carried, and says so', async () => {
    const db = fakeDb(
      [
        { person_id: 2, ...HER_STOP },
        { person_id: 1, is_active: true, stopped_at: null, stopped_via: null },
      ],
      { failStopWrite: true },
    )
    const incidents: string[] = []
    await mergeReportSubscriptionRows(db.sb, 1, 2, {}, incidents)
    expect(db.deleted).toEqual([])
    expect(db.table.find((r) => r.person_id === 2)).toMatchObject({ stopped_via: 'one-click' })
    expect(incidents.join(' ')).toContain('write timed out')
    expect(incidents.join(' ')).toContain("kept the duplicate's row")
  })

  it('a survivor with no row takes the duplicate\'s, stop and all', async () => {
    const db = fakeDb([{ person_id: 2, ...HER_STOP }])
    await mergeReportSubscriptionRows(db.sb, 1, 2, {}, [])
    expect(db.table).toEqual([{ person_id: 1, ...HER_STOP }])
  })

  it('a survivor already stopped by her keeps its own stop; the duplicate row goes', async () => {
    const own = { is_active: false, stopped_at: '2026-09-10T00:00:00Z', stopped_via: 'email-link' }
    const db = fakeDb([
      { person_id: 2, ...HER_STOP },
      { person_id: 1, ...own },
    ])
    await mergeReportSubscriptionRows(db.sb, 1, 2, {}, [])
    expect(db.table).toEqual([{ person_id: 1, ...own }])
    expect(db.timeline).toHaveLength(0)
  })
})
