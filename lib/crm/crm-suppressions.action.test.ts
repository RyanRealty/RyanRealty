import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// next/cache revalidate APIs need a request store that doesn't exist under the
// test runner — stub them so the action's bust() is a no-op.
vi.mock('next/cache', () => ({
  revalidateTag: () => {},
  revalidatePath: () => {},
}))

// getCrmAccess is the access gate. Tests swap its return per case.
let access: { email: string; role: string; brokerSlug: string | null } | null = {
  email: 'matt@ryan-realty.com',
  role: 'superuser',
  brokerSlug: 'matt',
}
vi.mock('@/app/actions/crm', () => ({
  getCrmAccess: () => Promise.resolve(access),
}))

// A tiny in-memory Supabase double: records inserts, returns canned reads.
type Insert = { table: string; row: Record<string, unknown> }
const inserts: Insert[] = []
const deletes: Array<{ table: string; id: number }> = []
let personExists = true
let suppressionRow: Record<string, unknown> | null = null
let existingDuplicate: Record<string, unknown> | null = null

function makeSb() {
  return {
    from(table: string) {
      const chain: Record<string, unknown> = {}
      const self = () => chain
      chain.select = self
      chain.eq = self
      chain.insert = (row: Record<string, unknown>) => {
        inserts.push({ table, row })
        return Promise.resolve({ error: null })
      }
      chain.delete = () => ({
        eq: (_c: string, id: number) => {
          deletes.push({ table, id })
          return Promise.resolve({ error: null })
        },
      })
      chain.maybeSingle = () => {
        if (table === 'crm_people') return Promise.resolve({ data: personExists ? { id: 1 } : null })
        if (table === 'crm_suppressions') {
          // The add-path duplicate check selects id; the lift-path selects the full row.
          if (suppressionRow !== null) return Promise.resolve({ data: suppressionRow })
          return Promise.resolve({ data: existingDuplicate })
        }
        return Promise.resolve({ data: null })
      }
      return chain
    },
  }
}
vi.mock('@/lib/supabase/service', () => ({ createServiceClient: () => makeSb() }))

import {
  buildSuppressionAuditRow,
  checkComplianceLiftAllowed,
} from '@/lib/crm/suppression-helpers'
import {
  addSuppressionAction,
  liftSuppressionAction,
} from '@/app/actions/crm-suppressions'

function fd(obj: Record<string, string>): FormData {
  const f = new FormData()
  for (const [k, v] of Object.entries(obj)) f.set(k, v)
  return f
}

beforeEach(() => {
  access = { email: 'matt@ryan-realty.com', role: 'superuser', brokerSlug: 'matt' }
  inserts.length = 0
  deletes.length = 0
  personExists = true
  suppressionRow = null
  existingDuplicate = null
})
afterEach(() => vi.clearAllMocks())

// ── Pure: audit-row construction ────────────────────────────────────────────
describe('buildSuppressionAuditRow', () => {
  it('stamps a system row with who, channel, reason and compliance flag', () => {
    const row = buildSuppressionAuditRow({
      action: 'lift',
      personId: 42,
      channel: 'sms',
      reason: 'contact:do-not-text',
      who: 'matt@ryan-realty.com',
      whoBroker: 'matt',
      confirmed: true,
    })
    expect(row.person_id).toBe(42)
    expect(row.kind).toBe('system')
    expect(row.source).toBe('app')
    expect(row.broker).toBe('matt')
    expect(row.title).toContain('Suppression lifted')
    expect(row.title).toContain('sms')
    expect(row.body).toContain('matt@ryan-realty.com')
    expect(row.payload).toMatchObject({
      audit: 'suppression',
      action: 'lift',
      channel: 'sms',
      reason: 'contact:do-not-text',
      compliance: true,
      confirmed: true,
      by: 'matt@ryan-realty.com',
    })
    expect(typeof row.payload.at).toBe('string')
  })
  it('marks an ordinary opt-out as non-compliance and defaults confirmed false', () => {
    const row = buildSuppressionAuditRow({
      action: 'add',
      personId: 7,
      channel: 'email',
      reason: 'unsubscribed',
      who: 'matt@ryan-realty.com',
      whoBroker: null,
    })
    expect(row.payload.compliance).toBe(false)
    expect(row.payload.confirmed).toBe(false)
    expect(row.broker).toBeNull()
  })
})

// ── Pure: the confirm-required-on-compliance-lift guard ─────────────────────
describe('checkComplianceLiftAllowed', () => {
  it('blocks a compliance lift without confirm', () => {
    const r = checkComplianceLiftAllowed({ reason: 'compliance:hard-stop', confirm: false })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/compliance or litigator/i)
  })
  it('allows a compliance lift WITH confirm', () => {
    expect(checkComplianceLiftAllowed({ reason: 'litigator', confirm: true }).ok).toBe(true)
  })
  it('allows an ordinary opt-out lift without confirm', () => {
    expect(checkComplianceLiftAllowed({ reason: 'unsubscribed', confirm: false }).ok).toBe(true)
  })
})

// ── Guards: fail-closed defaults ────────────────────────────────────────────
describe('access guards (fail closed)', () => {
  it('addSuppressionAction refuses a non-admin (null access)', async () => {
    access = null
    const r = await addSuppressionAction(fd({ target: '1', channel: 'all', reason: 'manual' }))
    expect(r).toEqual({ ok: false, error: 'Unauthorized' })
    expect(inserts).toHaveLength(0)
  })
  it('addSuppressionAction refuses a non-owner broker', async () => {
    access = { email: 'paul@ryan-realty.com', role: 'broker', brokerSlug: 'paul' }
    const r = await addSuppressionAction(fd({ target: '1', channel: 'all', reason: 'manual' }))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/owner/i)
    expect(inserts).toHaveLength(0)
  })
  it('liftSuppressionAction refuses a non-owner broker', async () => {
    access = { email: 'rebecca@ryan-realty.com', role: 'broker', brokerSlug: 'rebecca' }
    const r = await liftSuppressionAction(fd({ id: '5' }))
    expect(r.ok).toBe(false)
    expect(deletes).toHaveLength(0)
  })
})

// ── add behavior ────────────────────────────────────────────────────────────
describe('addSuppressionAction', () => {
  it('requires a target and a reason', async () => {
    expect((await addSuppressionAction(fd({ channel: 'all', reason: 'manual' }))).ok).toBe(false)
    expect((await addSuppressionAction(fd({ target: '1', channel: 'all' }))).ok).toBe(false)
  })
  it('writes the suppression AND an audit timeline row', async () => {
    const r = await addSuppressionAction(fd({ target: '1', channel: 'sms', reason: 'manual' }))
    expect(r.ok).toBe(true)
    const supp = inserts.find((i) => i.table === 'crm_suppressions')
    const audit = inserts.find((i) => i.table === 'crm_timeline')
    expect(supp?.row).toMatchObject({ person_id: 1, channel: 'sms', reason: 'manual', source: 'manual' })
    expect(audit?.row).toMatchObject({ kind: 'system', source: 'app' })
  })
  it('is idempotent on an exact duplicate (no second row)', async () => {
    existingDuplicate = { id: 99 }
    const r = await addSuppressionAction(fd({ target: '1', channel: 'sms', reason: 'manual' }))
    expect(r.ok).toBe(true)
    expect(inserts.filter((i) => i.table === 'crm_suppressions')).toHaveLength(0)
  })
})

// ── lift behavior (single-record + compliance confirm) ──────────────────────
describe('liftSuppressionAction', () => {
  it('refuses to lift a litigator row without confirm', async () => {
    suppressionRow = { id: 5, person_id: 1, channel: 'sms', reason: 'litigator', value: null }
    const r = await liftSuppressionAction(fd({ id: '5' }))
    expect(r.ok).toBe(false)
    expect(deletes).toHaveLength(0)
  })
  it('lifts a litigator row WITH confirm, writing the audit first then deleting', async () => {
    suppressionRow = { id: 5, person_id: 1, channel: 'sms', reason: 'compliance:hard-stop', value: null }
    const r = await liftSuppressionAction(fd({ id: '5', confirm: '1' }))
    expect(r.ok).toBe(true)
    expect(inserts.find((i) => i.table === 'crm_timeline')?.row).toMatchObject({
      payload: expect.objectContaining({ action: 'lift', compliance: true, confirmed: true }),
    })
    expect(deletes).toEqual([{ table: 'crm_suppressions', id: 5 }])
  })
  it('lifts an ordinary opt-out without confirm', async () => {
    suppressionRow = { id: 6, person_id: 1, channel: 'email', reason: 'unsubscribed', value: null }
    const r = await liftSuppressionAction(fd({ id: '6' }))
    expect(r.ok).toBe(true)
    expect(deletes).toEqual([{ table: 'crm_suppressions', id: 6 }])
  })
  it('returns not found for a missing row', async () => {
    suppressionRow = null
    const r = await liftSuppressionAction(fd({ id: '404' }))
    expect(r.ok).toBe(false)
  })
})
