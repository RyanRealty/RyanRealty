import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * F8 regression lock: marketing_assignments must hold ONE row per assignment,
 * not one row per event. A live production audit measured a single test buyer
 * producing 16 rows in a few hours (12 of them identical
 * buyer/matt/idx-registration/warm), which inflated every assignment metric by
 * roughly an order of magnitude.
 *
 * The mock is not a bare spy: it is a small in-memory stand-in for the table
 * that applies the ON CONFLICT arbiter the way Postgres does, including
 * NULLS-DISTINCT semantics. That lets these tests assert real row COUNTS —
 * "a repeat call does not create a second row" — instead of only asserting that
 * some options object was passed.
 */

type Row = Record<string, unknown>

const table: Row[] = []
let lastOptions: { onConflict?: string } | undefined
let lastPayload: Row | undefined
let forcedError: { message: string } | null = null
let forcedThrow: Error | null = null
let insertSeq = 0

const mockUpsert = vi.fn(async (payload: Row, options: { onConflict: string }) => {
  lastOptions = options
  lastPayload = payload
  if (forcedError) return { error: forcedError }

  const arbiter = options.onConflict.split(',').map((c) => c.trim())
  // Postgres treats NULLs as distinct in a unique index, so a row with a NULL
  // arbiter column can never conflict and always inserts.
  const arbiterIsNull = arbiter.some((c) => payload[c] === null || payload[c] === undefined)
  if (!arbiterIsNull) {
    const existing = table.find((r) => arbiter.every((c) => r[c] === payload[c]))
    if (existing) {
      // ON CONFLICT DO UPDATE SET <only the columns present in the payload>.
      // Columns absent from the payload (id, assigned_at) survive untouched.
      Object.assign(existing, payload)
      return { error: null }
    }
  }
  insertSeq += 1
  table.push({
    id: `row-${insertSeq}`,
    assigned_at: `2026-07-29T00:00:${String(insertSeq).padStart(2, '0')}.000Z`,
    notes: null,
    ...payload,
  })
  return { error: null }
})

const mockFrom = vi.fn(() => {
  if (forcedThrow) throw forcedThrow
  return { upsert: mockUpsert }
})

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({ from: mockFrom }),
}))

import {
  recordMarketingAssignment,
  buildMarketingAssignmentRow,
  MARKETING_ASSIGNMENT_CONFLICT_TARGET,
  type MarketingAssignmentInput,
} from './recordMarketingAssignment'

const BUYER_IDX: MarketingAssignmentInput = {
  audience: 'buyer',
  broker: 'matt',
  fubUserId: 1,
  fubPersonId: 59778,
  source: 'idx-registration',
  tier: 'warm',
}

beforeEach(() => {
  table.length = 0
  insertSeq = 0
  lastOptions = undefined
  lastPayload = undefined
  forcedError = null
  forcedThrow = null
  mockUpsert.mockClear()
  mockFrom.mockClear()
})

describe('recordMarketingAssignment — one row per assignment, not per event', () => {
  it('does NOT create a second row when the same grain is written again', async () => {
    // The exact production shape: one lead saving a search over and over.
    for (let i = 0; i < 12; i++) {
      expect(await recordMarketingAssignment(BUYER_IDX)).toEqual({ ok: true })
    }
    expect(mockUpsert).toHaveBeenCalledTimes(12)
    expect(table).toHaveLength(1)
    expect(table[0]).toMatchObject({
      audience: 'buyer',
      broker: 'matt',
      fub_person_id: 59778,
      source: 'idx-registration',
      tier: 'warm',
    })
  })

  it('DOES create a distinct row for a different audience (buyer and seller coexist)', async () => {
    await recordMarketingAssignment(BUYER_IDX)
    await recordMarketingAssignment({ ...BUYER_IDX, audience: 'seller' })
    expect(table).toHaveLength(2)
    expect(table.map((r) => r.audience).sort()).toEqual(['buyer', 'seller'])
    // Both rows still belong to the same person — the seller/buyer split is
    // preserved, not merged away.
    expect(new Set(table.map((r) => r.fub_person_id))).toEqual(new Set([59778]))
  })

  it('DOES create a distinct row for a different acquisition source', async () => {
    // Production case (crm person 13168): arrived via idx-registration, later
    // via contact-form. Two real doors, two rows.
    await recordMarketingAssignment(BUYER_IDX)
    await recordMarketingAssignment({ ...BUYER_IDX, source: 'contact-form' })
    expect(table).toHaveLength(2)
    expect(table.map((r) => r.source).sort()).toEqual(['contact-form', 'idx-registration'])
  })

  it('DOES create a distinct row for a different person', async () => {
    await recordMarketingAssignment(BUYER_IDX)
    await recordMarketingAssignment({ ...BUYER_IDX, fubPersonId: 59779 })
    expect(table).toHaveLength(2)
  })

  it('re-assigns the broker in place instead of stacking a second claim on the lead', async () => {
    await recordMarketingAssignment(BUYER_IDX)
    await recordMarketingAssignment({ ...BUYER_IDX, broker: 'rebecca', fubUserId: 2 })
    expect(table).toHaveLength(1)
    expect(table[0]).toMatchObject({ broker: 'rebecca', fub_user_id: 2 })
  })

  it('refreshes tier in place as a lead warms up', async () => {
    await recordMarketingAssignment({ ...BUYER_IDX, tier: 'nurture' })
    await recordMarketingAssignment({ ...BUYER_IDX, tier: 'hot' })
    expect(table).toHaveLength(1)
    expect(table[0].tier).toBe('hot')
  })

  it('preserves assigned_at across repeats — it is a first-touch anchor', async () => {
    await recordMarketingAssignment(BUYER_IDX)
    const firstTouch = table[0].assigned_at
    await recordMarketingAssignment({ ...BUYER_IDX, tier: 'hot', broker: 'rebecca', fubUserId: 2 })
    expect(table).toHaveLength(1)
    expect(table[0].assigned_at).toBe(firstTouch)
  })

  it('always inserts when the person id is NULL (a NULL key cannot dedupe)', async () => {
    // Matches Postgres NULLS-DISTINCT behavior on the unique index, which is
    // why the index is not partial and why callers should pass a real person id.
    await recordMarketingAssignment({ ...BUYER_IDX, fubPersonId: null })
    await recordMarketingAssignment({ ...BUYER_IDX, fubPersonId: null })
    expect(table).toHaveLength(2)
  })

  it('never throws, and reports a DB error as a result flag', async () => {
    forcedError = { message: 'duplicate key value violates unique constraint' }
    expect(await recordMarketingAssignment(BUYER_IDX)).toEqual({
      ok: false,
      error: 'duplicate key value violates unique constraint',
    })
  })

  it('never throws when the service client is unavailable', async () => {
    forcedThrow = new Error('Supabase service role not configured')
    expect(await recordMarketingAssignment(BUYER_IDX)).toEqual({
      ok: false,
      error: 'Supabase service role not configured',
    })
    expect(table).toHaveLength(0)
  })

  it('writes to the marketing_assignments table with the documented conflict target', async () => {
    await recordMarketingAssignment(BUYER_IDX)
    expect(mockFrom).toHaveBeenCalledWith('marketing_assignments')
    expect(lastOptions).toEqual({ onConflict: 'fub_person_id,audience,source' })
  })
})

describe('buildMarketingAssignmentRow — payload rules', () => {
  it('omits assigned_at so the DB default stamps it once and DO UPDATE never touches it', () => {
    expect(Object.keys(buildMarketingAssignmentRow(BUYER_IDX))).not.toContain('assigned_at')
  })

  it('omits id so the surviving row keeps its uuid across repeats', () => {
    expect(Object.keys(buildMarketingAssignmentRow(BUYER_IDX))).not.toContain('id')
  })

  it('omits notes when undefined, so a repeat write cannot blank an earlier note', async () => {
    await recordMarketingAssignment({ ...BUYER_IDX, notes: 'first touch: paid social' })
    expect(table[0].notes).toBe('first touch: paid social')
    await recordMarketingAssignment(BUYER_IDX)
    expect(lastPayload && 'notes' in lastPayload).toBe(false)
    expect(table).toHaveLength(1)
    expect(table[0].notes).toBe('first touch: paid social')
  })

  it('maps camelCase input onto the snake_case table columns', () => {
    expect(buildMarketingAssignmentRow(BUYER_IDX)).toEqual({
      audience: 'buyer',
      broker: 'matt',
      fub_user_id: 1,
      fub_person_id: 59778,
      source: 'idx-registration',
      tier: 'warm',
    })
  })
})

describe('conflict target matches the shipped unique index', () => {
  it('names exactly the columns of marketing_assignments_person_audience_source_key', () => {
    // Drift guard: if someone changes the grain in SQL without changing the
    // writer (or vice versa), every upsert fails at runtime with "no unique or
    // exclusion constraint matching the ON CONFLICT specification".
    const sql = readFileSync(
      resolve(__dirname, '../../../supabase/migrations/20260729183000_marketing_assignments_dedupe.sql'),
      'utf8',
    )
    const m = sql.match(
      /CREATE UNIQUE INDEX IF NOT EXISTS marketing_assignments_person_audience_source_key\s+ON public\.marketing_assignments \(([^)]+)\)/,
    )
    expect(m).not.toBeNull()
    const indexCols = m![1].split(',').map((c) => c.trim())
    expect(indexCols).toEqual(MARKETING_ASSIGNMENT_CONFLICT_TARGET.split(','))
  })
})
