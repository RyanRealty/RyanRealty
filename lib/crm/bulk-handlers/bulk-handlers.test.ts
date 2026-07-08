import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// ── In-memory Supabase double ────────────────────────────────────────────────
// Records updates / inserts / upserts and serves canned reads. Each handler reads
// a chunk of crm_people in ONE .in('id', ids) query, then mutates per id, so the
// double supports: select().in() (people read), select().eq() (crm_stages read),
// update().eq(), insert(), upsert().

type PersonRow = {
  id: number
  tags?: string[]
  stage?: string
  assigned_broker?: string | null
  deleted?: boolean
  fub_legacy_id?: number | null
  emails?: Array<{ value?: string; isPrimary?: number | boolean }>
}

let people: PersonRow[] = []
let stageRows: Array<{ key: string; label: string }> = []
let stageReadError: string | null = null
let peopleReadError: string | null = null

const updates: Array<{ table: string; id: number; patch: Record<string, unknown> }> = []
const inserts: Array<{ table: string; row: Record<string, unknown> }> = []
const upserts: Array<{ table: string; row: Record<string, unknown> }> = []

function makeSb() {
  return {
    from(table: string) {
      const chain: Record<string, unknown> = { __table: table }
      // select(cols, opts) -> returns a thing that supports .in / .eq + await
      chain.select = () => {
        const q: Record<string, unknown> = {}
        q.in = (_col: string, ids: number[]) => {
          if (table === 'crm_people' && peopleReadError) {
            return Promise.resolve({ data: null, error: { message: peopleReadError } })
          }
          if (table === 'crm_people') {
            return Promise.resolve({ data: people.filter((p) => ids.includes(p.id)), error: null })
          }
          return Promise.resolve({ data: [], error: null })
        }
        q.eq = () => {
          if (table === 'crm_stages') {
            if (stageReadError) return Promise.resolve({ data: null, error: { message: stageReadError } })
            return Promise.resolve({ data: stageRows, error: null })
          }
          return Promise.resolve({ data: [], error: null })
        }
        return q
      }
      chain.update = (patch: Record<string, unknown>) => ({
        eq: (_col: string, id: number) => {
          updates.push({ table, id, patch })
          return Promise.resolve({ error: null })
        },
      })
      chain.insert = (row: Record<string, unknown>) => {
        inserts.push({ table, row })
        return Promise.resolve({ error: null })
      }
      chain.upsert = (row: Record<string, unknown>) => {
        upserts.push({ table, row })
        return Promise.resolve({ error: null })
      }
      return chain
    },
  }
}
vi.mock('@/lib/supabase/service', () => ({ createServiceClient: () => makeSb() }))

// enroll-workflow delegates to manualEnrollPerson — mock its outcomes per id.
const enrollOutcomes = new Map<number, { enrolled: boolean; reason?: string; sequence?: string }>()
let enrollDefault: { enrolled: boolean; reason?: string; sequence?: string } = { enrolled: true, sequence: 'Seller Master' }
vi.mock('@/lib/crm/enroll', () => ({
  manualEnrollPerson: (personId: number) => {
    const o = enrollOutcomes.get(personId) ?? enrollDefault
    return Promise.resolve(
      o.enrolled ? { enrolled: true, sequence: o.sequence ?? 'X' } : { enrolled: false, reason: o.reason ?? 'no rule' },
    )
  },
}))

// report-subscription sanitizer needs the area registry + frequency normalizer.
vi.mock('@/lib/data/crm/getContactReportSubscriptions', () => ({
  normalizeReportFrequency: (v: unknown) =>
    v === 'weekly' || v === 'quarterly' ? v : 'monthly',
  buildMarketReportAreas: () => [{ slug: 'bend' }, { slug: 'redmond' }, { slug: 'sisters' }],
}))

import { assignBrokerHandler } from './assign-broker'
import { addTagHandler } from './add-tag'
import { removeTagHandler } from './remove-tag'
import { setStageHandler, resolveStageLabel } from './set-stage'
import { enrollWorkflowHandler, enrollSkipReasonKey } from './enroll-workflow'
import { setReportSubscriptionHandler, sanitizeReportAreas } from './set-report-subscription'
import { assignSavedSearchHandler, pickPersonEmail } from './assign-saved-search'
import { isProtectedComplianceTag, listProtectedComplianceTags } from './protected-tags'

const ctxOwner = { jobId: 1, actorEmail: 'matt@ryan-realty.com', brokerScope: null }
const ctxRestricted = { jobId: 1, actorEmail: 'rebecca@ryan-realty.com', brokerScope: 'rebecca' }

beforeEach(() => {
  people = []
  stageRows = []
  stageReadError = null
  peopleReadError = null
  updates.length = 0
  inserts.length = 0
  upserts.length = 0
  enrollOutcomes.clear()
  enrollDefault = { enrolled: true, sequence: 'Seller Master' }
})
afterEach(() => vi.clearAllMocks())

/** Invariant every handler must hold: every id is processed OR skipped. */
function accountedFor(res: { processed?: number; skipped?: number }, n: number) {
  expect((res.processed ?? 0) + (res.skipped ?? 0)).toBe(n)
}

// ── protected-tags (pure) ────────────────────────────────────────────────────

describe('isProtectedComplianceTag', () => {
  it('flags every suppression-driving tag (case-insensitive)', () => {
    expect(isProtectedComplianceTag('compliance:hard-stop')).toBe(true)
    expect(isProtectedComplianceTag('COMPLIANCE:HARD-STOP')).toBe(true)
    expect(isProtectedComplianceTag('contact:do-not-text')).toBe(true)
    expect(isProtectedComplianceTag('contact:do-not-call')).toBe(true)
    expect(isProtectedComplianceTag('do_not_email')).toBe(true)
    expect(isProtectedComplianceTag('unsubscribed')).toBe(true)
    expect(isProtectedComplianceTag(' bounced ')).toBe(true)
    expect(isProtectedComplianceTag('complained')).toBe(true)
  })
  it('does not flag an ordinary marketing tag', () => {
    expect(isProtectedComplianceTag('audience:seller')).toBe(false)
    expect(isProtectedComplianceTag('vip')).toBe(false)
  })
  it('exposes the protected set', () => {
    expect(listProtectedComplianceTags()).toContain('compliance:hard-stop')
  })
})

// ── assign-broker ────────────────────────────────────────────────────────────

describe('assignBrokerHandler', () => {
  it('refuses the whole chunk when a restricted broker scope reaches the handler', async () => {
    people = [{ id: 1, tags: [], assigned_broker: 'matt' }]
    const res = await assignBrokerHandler([1, 2, 3], { brokerSlug: 'paul' }, ctxRestricted)
    expect(res.processed).toBe(0)
    expect(res.skipped).toBe(3)
    expect(res.breakdown?.refused_not_owner).toBe(3)
    expect(updates).toHaveLength(0)
    accountedFor(res, 3)
  })
  it('skips an invalid broker slug for the whole chunk', async () => {
    const res = await assignBrokerHandler([1, 2], { brokerSlug: 'nope' }, ctxOwner)
    expect(res.skipped).toBe(2)
    expect(res.breakdown?.invalid_broker).toBe(2)
    accountedFor(res, 2)
  })
  it('reassigns, swaps the broker tag, and writes a timeline row', async () => {
    people = [
      { id: 1, tags: ['broker:matt', 'vip'], assigned_broker: 'matt' },
      { id: 2, tags: ['broker:paul'], assigned_broker: 'paul' }, // already paul -> skip
      { id: 3, tags: [], assigned_broker: null },
    ]
    const res = await assignBrokerHandler([1, 2, 3], { brokerSlug: 'paul' }, ctxOwner)
    expect(res.processed).toBe(2) // ids 1 and 3
    expect(res.skipped).toBe(1) // id 2 already assigned
    accountedFor(res, 3)
    const p1 = updates.find((u) => u.id === 1)
    expect(p1?.patch.assigned_broker).toBe('paul')
    expect(p1?.patch.tags).toEqual(['vip', 'broker:paul']) // old broker: tag dropped
    expect(inserts.filter((i) => i.table === 'crm_timeline')).toHaveLength(2)
  })
  it('skips ids missing from the read', async () => {
    people = []
    const res = await assignBrokerHandler([99], { brokerSlug: 'matt' }, ctxOwner)
    expect(res.breakdown?.not_found).toBe(1)
    accountedFor(res, 1)
  })
})

// ── add-tag ──────────────────────────────────────────────────────────────────

describe('addTagHandler', () => {
  it('REFUSES adding a protected compliance tag for the whole chunk', async () => {
    people = [{ id: 1, tags: [] }]
    const res = await addTagHandler([1, 2], { tag: 'compliance:hard-stop' }, ctxOwner)
    expect(res.processed).toBe(0)
    expect(res.skipped).toBe(2)
    expect(res.breakdown?.refused_protected_tag).toBe(2)
    expect(updates).toHaveLength(0)
    accountedFor(res, 2)
  })
  it('appends a new tag and skips one that already has it', async () => {
    people = [
      { id: 1, tags: ['vip'] },
      { id: 2, tags: ['newsletter'] }, // already has -> skip
    ]
    const res = await addTagHandler([1, 2], { tag: 'newsletter' }, ctxOwner)
    expect(res.processed).toBe(1)
    expect(res.skipped).toBe(1)
    accountedFor(res, 2)
    expect(updates.find((u) => u.id === 1)?.patch.tags).toEqual(['vip', 'newsletter'])
  })
  it('skips the whole chunk on an invalid (empty / overlong) tag', async () => {
    const res = await addTagHandler([1, 2, 3], { tag: '   ' }, ctxOwner)
    expect(res.skipped).toBe(3)
    expect(res.breakdown?.invalid_tag).toBe(3)
    accountedFor(res, 3)
  })
})

// ── remove-tag ───────────────────────────────────────────────────────────────

describe('removeTagHandler', () => {
  it('REFUSES removing a protected compliance tag (never un-suppress in bulk)', async () => {
    people = [{ id: 1, tags: ['compliance:hard-stop'] }]
    const res = await removeTagHandler([1, 2], { tag: 'compliance:hard-stop' }, ctxOwner)
    expect(res.processed).toBe(0)
    expect(res.skipped).toBe(2)
    expect(res.breakdown?.refused_protected_tag).toBe(2)
    expect(updates).toHaveLength(0)
    accountedFor(res, 2)
  })
  it('refuses a differently-cased compliance tag too', async () => {
    const res = await removeTagHandler([1], { tag: 'Contact:Do-Not-Text' }, ctxOwner)
    expect(res.breakdown?.refused_protected_tag).toBe(1)
    expect(updates).toHaveLength(0)
  })
  it('removes a present ordinary tag and skips one that lacks it', async () => {
    people = [
      { id: 1, tags: ['vip', 'newsletter'] },
      { id: 2, tags: ['vip'] }, // lacks newsletter -> skip
    ]
    const res = await removeTagHandler([1, 2], { tag: 'newsletter' }, ctxOwner)
    expect(res.processed).toBe(1)
    expect(res.skipped).toBe(1)
    accountedFor(res, 2)
    expect(updates.find((u) => u.id === 1)?.patch.tags).toEqual(['vip'])
  })
})

// ── set-stage ────────────────────────────────────────────────────────────────

describe('resolveStageLabel (pure)', () => {
  const rows = [{ key: 'lead', label: 'Lead' }, { key: 'pending', label: 'Pending' }]
  it('matches by label', () => expect(resolveStageLabel(rows, 'Pending')).toBe('Pending'))
  it('matches by key and returns the label', () => expect(resolveStageLabel(rows, 'lead')).toBe('Lead'))
  it('returns null for an unknown stage', () => expect(resolveStageLabel(rows, 'Ghost')).toBeNull())
  it('returns null for empty', () => expect(resolveStageLabel(rows, '  ')).toBeNull())
})

describe('setStageHandler', () => {
  beforeEach(() => { stageRows = [{ key: 'pending', label: 'Pending' }, { key: 'lead', label: 'Lead' }] })
  it('skips the whole chunk for an unknown stage', async () => {
    const res = await setStageHandler([1, 2], { stage: 'Ghost' }, ctxOwner)
    expect(res.skipped).toBe(2)
    expect(res.breakdown?.unknown_stage).toBe(2)
    accountedFor(res, 2)
  })
  it('fails closed (skips) when the stage table is unreadable', async () => {
    stageReadError = 'boom'
    const res = await setStageHandler([1], { stage: 'Pending' }, ctxOwner)
    expect(res.breakdown?.stage_lookup_failed).toBe(1)
    expect(updates).toHaveLength(0)
    accountedFor(res, 1)
  })
  it('updates the stage and writes a stage_change timeline row, skipping no-ops', async () => {
    people = [
      { id: 1, stage: 'Lead' },
      { id: 2, stage: 'Pending' }, // already Pending -> skip
    ]
    const res = await setStageHandler([1, 2], { stage: 'Pending' }, ctxOwner)
    expect(res.processed).toBe(1)
    expect(res.skipped).toBe(1)
    accountedFor(res, 2)
    expect(updates.find((u) => u.id === 1)?.patch.stage).toBe('Pending')
    const tl = inserts.find((i) => i.table === 'crm_timeline')
    expect(tl?.row.kind).toBe('stage_change')
  })
})

// ── enroll-workflow ──────────────────────────────────────────────────────────

describe('enrollSkipReasonKey (pure)', () => {
  it('maps hard-stop', () => expect(enrollSkipReasonKey('contact is hard-stopped')).toBe('skipped_hard_stop'))
  it('maps already-in', () => expect(enrollSkipReasonKey('already in Seller Master')).toBe('skipped_already_enrolled'))
  it('maps inactive', () => expect(enrollSkipReasonKey('that workflow is not active')).toBe('skipped_sequence_inactive'))
  it('maps missing', () => expect(enrollSkipReasonKey('workflow not found')).toBe('skipped_sequence_missing'))
  it('falls through to other', () => expect(enrollSkipReasonKey('weird')).toBe('skipped_other'))
})

describe('enrollWorkflowHandler', () => {
  it('skips the whole chunk for an invalid sequenceId', async () => {
    const res = await enrollWorkflowHandler([1, 2], { sequenceId: 0 }, ctxOwner)
    expect(res.skipped).toBe(2)
    expect(res.breakdown?.invalid_sequence).toBe(2)
    accountedFor(res, 2)
  })
  it('tallies enrolled vs hard-stop-skipped via manualEnrollPerson', async () => {
    enrollOutcomes.set(1, { enrolled: true, sequence: 'Seller Master' })
    enrollOutcomes.set(2, { enrolled: false, reason: 'contact is hard-stopped' })
    enrollOutcomes.set(3, { enrolled: false, reason: 'already in Seller Master' })
    const res = await enrollWorkflowHandler([1, 2, 3], { sequenceId: 69 }, ctxOwner)
    expect(res.processed).toBe(1)
    expect(res.skipped).toBe(2)
    expect(res.breakdown?.enrolled).toBe(1)
    expect(res.breakdown?.skipped_hard_stop).toBe(1)
    expect(res.breakdown?.skipped_already_enrolled).toBe(1)
    accountedFor(res, 3)
  })
})

// ── set-report-subscription ──────────────────────────────────────────────────

describe('sanitizeReportAreas (pure)', () => {
  const valid = new Set(['bend', 'redmond', 'sisters'])
  it('drops unknown + de-dupes + trims', () => {
    expect(sanitizeReportAreas([' bend ', 'bend', 'mars', 'redmond'], valid)).toEqual(['bend', 'redmond'])
  })
  it('returns [] for non-array', () => expect(sanitizeReportAreas('bend', valid)).toEqual([]))
})

describe('setReportSubscriptionHandler', () => {
  it('refuses an active subscription with zero valid areas for the whole chunk', async () => {
    const res = await setReportSubscriptionHandler([1, 2], { areas: ['mars'], frequency: 'weekly', isActive: true }, ctxOwner)
    expect(res.skipped).toBe(2)
    expect(res.breakdown?.refused_active_no_areas).toBe(2)
    expect(upserts).toHaveLength(0)
    accountedFor(res, 2)
  })
  it('upserts a subscription per id and writes a timeline row', async () => {
    const res = await setReportSubscriptionHandler([1, 2], { areas: ['bend', 'mars'], frequency: 'weekly', isActive: true }, ctxOwner)
    expect(res.processed).toBe(2)
    accountedFor(res, 2)
    expect(upserts).toHaveLength(2)
    expect(upserts[0].row.areas).toEqual(['bend']) // mars dropped
    expect(upserts[0].row.frequency).toBe('weekly')
    expect(upserts[0].row.is_active).toBe(true)
    expect(inserts.filter((i) => i.table === 'crm_timeline')).toHaveLength(2)
  })
  it('allows turning OFF with no areas', async () => {
    const res = await setReportSubscriptionHandler([1], { areas: [], frequency: 'monthly', isActive: false }, ctxOwner)
    expect(res.processed).toBe(1)
    expect(upserts[0].row.is_active).toBe(false)
    accountedFor(res, 1)
  })
})

// ── assign-saved-search ──────────────────────────────────────────────────────

describe('pickPersonEmail (pure)', () => {
  it('prefers the primary email', () => {
    expect(pickPersonEmail([{ value: 'b@x.com' }, { value: 'a@x.com', isPrimary: 1 }])).toBe('a@x.com')
  })
  it('falls back to the first email with a value', () => {
    expect(pickPersonEmail([{ value: '' }, { value: 'B@X.com' }])).toBe('b@x.com')
  })
  it('returns null when nothing usable', () => {
    expect(pickPersonEmail([])).toBeNull()
    expect(pickPersonEmail(null)).toBeNull()
    expect(pickPersonEmail([{ value: 'not-an-email' }])).toBeNull()
  })
})

describe('assignSavedSearchHandler', () => {
  it('refuses the whole chunk when normalized filters are empty', async () => {
    const res = await assignSavedSearchHandler([1, 2], { filters: {}, name: 'X', frequency: 'daily' }, ctxOwner)
    expect(res.skipped).toBe(2)
    expect(res.breakdown?.refused_empty_filters).toBe(2)
    expect(upserts).toHaveLength(0)
    accountedFor(res, 2)
  })
  it('upserts a listing_alerts row per contact with crm_person_id + origin broker', async () => {
    people = [
      { id: 1, deleted: false, fub_legacy_id: 900, emails: [{ value: 'lead@x.com', isPrimary: 1 }] },
      { id: 2, deleted: false, fub_legacy_id: null, emails: [] }, // no email -> skipped
    ]
    const res = await assignSavedSearchHandler(
      [1, 2],
      { filters: { city: 'Bend', minPrice: 500000 }, name: 'Bend 500k+', frequency: 'weekly' },
      ctxOwner,
    )
    expect(res.processed).toBe(1)
    expect(res.skipped).toBe(1)
    expect(res.breakdown?.no_email).toBe(1)
    accountedFor(res, 2)
    const row = upserts.find((u) => u.table === 'listing_alerts')?.row
    expect(row?.email).toBe('lead@x.com')
    expect(row?.crm_person_id).toBe(1)
    expect(row?.fub_person_id).toBe(900)
    expect(row?.origin).toBe('broker')
    expect(row?.assigned_by).toBe('matt@ryan-realty.com')
    expect(row?.notification_frequency).toBe('weekly')
    expect(inserts.filter((i) => i.table === 'crm_timeline')).toHaveLength(1)
  })
  it('skips deleted or missing contacts (counted)', async () => {
    people = [{ id: 1, deleted: true, emails: [{ value: 'gone@x.com' }] }]
    const res = await assignSavedSearchHandler([1, 99], { filters: { city: 'Bend' } }, ctxOwner)
    expect(res.skipped).toBe(2)
    expect(res.breakdown?.missing_or_deleted).toBe(2)
    accountedFor(res, 2)
  })
})
