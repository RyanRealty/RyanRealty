import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { notHeldByContactFilter } from '@/lib/crm/market-report-subscription-control'
import { primaryEmailOf, signalsFor } from './add-newsletter'
import { canSubscribe } from '@/lib/crm/membership-consent'

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
// SS-3 resurrection pre-check: null = no prior opt-out (row is created active);
// { is_active: false } simulates a search the lead unsubscribed (stays muted).
// The market-report handler's existing-row read (.eq(person_id).maybeSingle())
// is served from the same slot, with the report columns.
let alertPreCheckRow: Record<string, unknown> | null = null

const updates: Array<{ table: string; id: number; patch: Record<string, unknown>; filters: Array<[string, string, unknown]> }> = []
const inserts: Array<{ table: string; row: Record<string, unknown> }> = []
const upserts: Array<{ table: string; row: Record<string, unknown>; opts?: Record<string, unknown> }> = []
// The market-report handler writes conditionally: a row changed since the job
// read it (a stop, a pause, a row that appeared) matches nothing.
let reportRowChanged = false

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
        q.eq = (col: string, val: unknown) => {
          // Awaitable for single-eq reads (crm_stages), AND chainable for the
          // listing_alerts resurrection pre-check
          // (.select('is_active').eq(email).eq(filters_hash).maybeSingle()).
          const settle = () => {
            if (table === 'crm_stages') {
              if (stageReadError) return { data: null, error: { message: stageReadError } }
              return { data: stageRows, error: null }
            }
            return { data: [], error: null }
          }
          const preCheck = () => Promise.resolve({ data: alertPreCheckRow, error: null })
          const maybePerson = () => {
            if (table === 'crm_people' && col === 'id') {
              const row = people.find((p) => p.id === Number(val)) ?? null
              return Promise.resolve({ data: row, error: null })
            }
            return preCheck()
          }
          return {
            // listing_alerts pre-check: .eq(email).eq(filters_hash).limit(1).maybeSingle()
            eq: () => ({ limit: () => ({ maybeSingle: preCheck }), maybeSingle: preCheck }),
            limit: () => ({ maybeSingle: preCheck }),
            maybeSingle: maybePerson,
            then: (resolve: (v: unknown) => void) => resolve(settle()),
          }
        }
        return q
      }
      chain.update = (patch: Record<string, unknown>) => {
        // A filter chain: .eq / .is / .or, then awaited (-> { error }) or
        // .select() (-> { data, error }). Records the update once.
        let id = -1
        const filters: Array<[string, string, unknown]> = []
        let recorded = false
        const record = () => {
          if (!recorded) updates.push({ table, id, patch, filters })
          recorded = true
        }
        const q: Record<string, unknown> = {}
        q.eq = (col: string, v: unknown) => {
          if (id === -1) id = Number(v)
          filters.push(['eq', col, v])
          return q
        }
        q.is = (col: string, v: unknown) => {
          filters.push(['is', col, v])
          return q
        }
        q.or = (expr: string) => {
          filters.push(['or', 'expr', expr])
          return q
        }
        q.select = () => {
          record()
          const hit = table === 'crm_report_subscriptions' && reportRowChanged ? [] : [{ person_id: id }]
          return Promise.resolve({ data: hit, error: null })
        }
        q.then = (resolve: (v: unknown) => void) => {
          record()
          resolve({ error: null })
        }
        return q
      }
      chain.insert = (row: Record<string, unknown>) => {
        inserts.push({ table, row })
        return Promise.resolve({ error: null })
      }
      chain.upsert = (row: Record<string, unknown>, opts?: Record<string, unknown>) => {
        upserts.push({ table, row, opts })
        const changed = table === 'crm_report_subscriptions' && reportRowChanged
        return Promise.resolve({ error: null, count: changed ? 0 : 1 })
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

// A first setup starts its cadence from the last report the contact received.
vi.mock('@/lib/data/crm/marketReportSends', () => ({ getLatestDeliveredReportAt: async () => null }))

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
  alertPreCheckRow = null
  reportRowChanged = false
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

  it('turning OFF with no areas keeps the areas already on the row', async () => {
    alertPreCheckRow = { is_active: true, stopped_at: null, stopped_via: null, areas: ['bend'], frequency: 'monthly' }
    const res = await setReportSubscriptionHandler([1], { areas: [], frequency: 'monthly', isActive: false }, ctxOwner)
    expect(res.processed).toBe(1)
    const writes = updates.filter((u) => u.table === 'crm_report_subscriptions')
    expect(writes).toHaveLength(1)
    expect(writes[0].patch.is_active).toBe(false)
    expect(writes[0].patch).not.toHaveProperty('areas')
    accountedFor(res, 1)
  })

  it('writes an existing row only while it is as read: the same on/off and the same stop stamp', async () => {
    alertPreCheckRow = { is_active: false, stopped_at: '2026-09-20T00:00:00Z', stopped_via: 'admin', areas: ['bend'], frequency: 'monthly' }
    const res = await setReportSubscriptionHandler([1], { areas: ['bend'], frequency: 'monthly', isActive: true }, ctxOwner)
    expect(res.processed).toBe(1)
    const [w] = updates.filter((u) => u.table === 'crm_report_subscriptions')
    expect(w.filters).toEqual(
      expect.arrayContaining([
        ['eq', 'person_id', 1],
        ['eq', 'is_active', false],
        ['eq', 'stopped_at', '2026-09-20T00:00:00Z'],
        // Neither her stop NOR her pause may have landed since the read (review 2026-09-30).
        ['or', 'expr', notHeldByContactFilter()],
      ]),
    )
    expect(upserts).toHaveLength(0)
  })

  it('turning reports on skips a contact who PAUSED them herself: her pause holds like her stop (review 2026-09-30)', async () => {
    alertPreCheckRow = {
      is_active: false,
      stopped_at: null,
      stopped_via: null,
      paused_at: '2026-09-20T00:00:00Z',
      paused_via: 'email-link',
      areas: ['bend'],
      frequency: 'monthly',
    }
    const res = await setReportSubscriptionHandler([1], { areas: ['bend'], frequency: 'monthly', isActive: true }, ctxOwner)
    expect(res.skipped).toBe(1)
    expect(res.breakdown?.skipped_contact_paused).toBe(1)
    expect(updates.filter((u) => u.table === 'crm_report_subscriptions')).toHaveLength(0)
    accountedFor(res, 1)
  })

  it("a broker's bulk turn-off is recorded as the broker's pause, never as hers", async () => {
    alertPreCheckRow = { is_active: true, stopped_at: null, stopped_via: null, areas: ['bend'], frequency: 'monthly' }
    await setReportSubscriptionHandler([1], { areas: ['bend'], frequency: 'monthly', isActive: false }, ctxOwner)
    const [w] = updates.filter((u) => u.table === 'crm_report_subscriptions')
    expect(w.patch).toMatchObject({ is_active: false, paused_via: 'admin' })
    expect(typeof w.patch.paused_at).toBe('string')
  })

  it('never overwrites a stop made between its read and its write (her one-click lands mid-job)', async () => {
    // The job read the row on; she stopped it before the write.
    alertPreCheckRow = { is_active: true, stopped_at: null, stopped_via: null, areas: ['bend'], frequency: 'monthly' }
    reportRowChanged = true
    const res = await setReportSubscriptionHandler([1], { areas: ['bend', 'redmond'], frequency: 'weekly', isActive: true }, ctxOwner)
    expect(res.skipped).toBe(1)
    expect(res.breakdown?.changed_during_job).toBe(1)
    const [w] = updates.filter((u) => u.table === 'crm_report_subscriptions')
    expect(w.filters).toEqual(expect.arrayContaining([['is', 'stopped_at', null], ['eq', 'is_active', true]]))
    expect(inserts.filter((i) => i.table === 'crm_timeline')).toHaveLength(0)
    accountedFor(res, 1)
  })

  it('a first setup inserts only while no row exists; one that appeared meanwhile is left alone', async () => {
    reportRowChanged = true
    const res = await setReportSubscriptionHandler([1], { areas: ['bend'], frequency: 'monthly', isActive: true }, ctxOwner)
    expect(res.skipped).toBe(1)
    expect(res.breakdown?.changed_during_job).toBe(1)
    expect(upserts[0].opts).toMatchObject({ onConflict: 'person_id', ignoreDuplicates: true })
    expect(inserts.filter((i) => i.table === 'crm_timeline')).toHaveLength(0)
    accountedFor(res, 1)
  })

  it('leaves a contact who is already exactly so alone: no write, no timeline row', async () => {
    alertPreCheckRow = { is_active: true, stopped_at: null, stopped_via: null, areas: ['redmond', 'bend'], frequency: 'weekly' }
    const res = await setReportSubscriptionHandler([1], { areas: ['bend', 'redmond'], frequency: 'weekly', isActive: true }, ctxOwner)
    expect(res.processed).toBe(1)
    expect(res.breakdown?.unchanged).toBe(1)
    expect(upserts).toHaveLength(0)
    expect(inserts.filter((i) => i.table === 'crm_timeline')).toHaveLength(0)
    accountedFor(res, 1)
  })

  it('never turns on a report the contact stopped herself', async () => {
    alertPreCheckRow = { is_active: false, stopped_at: '2026-09-30T00:00:00Z', stopped_via: 'one-click', areas: ['bend'], frequency: 'monthly' }
    const res = await setReportSubscriptionHandler([1], { areas: ['bend'], frequency: 'monthly', isActive: true }, ctxOwner)
    expect(res.skipped).toBe(1)
    expect(res.breakdown?.skipped_contact_stopped).toBe(1)
    expect(upserts).toHaveLength(0)
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

describe('add-newsletter — consent is checked, not assumed', () => {
  it('folds tags into the same signals the chokepoint reads', () => {
    // An inherited "Unsubscribed" tag with no suppression row must still read
    // as an email opt-out — that is how the migrated book carries opt-outs.
    const signals = signalsFor(['Unsubscribed'], [])
    expect(signals).toContainEqual({ channel: 'email', reason: 'tag:unsubscribed' })
    expect(canSubscribe('email', signals).allowed).toBe(false)
  })

  it('treats a do-not-call tag as call+sms, not email', () => {
    const signals = signalsFor(['contact:do-not-call'], [])
    expect(canSubscribe('email', signals).allowed).toBe(true)
    expect(canSubscribe('sms', signals).allowed).toBe(false)
  })

  it('honours a hard-stop suppression row on every channel', () => {
    const signals = signalsFor([], [{ channel: 'all', reason: 'tcpa-hard-stop' }])
    expect(canSubscribe('email', signals).allowed).toBe(false)
  })

  it('lets a clean contact through', () => {
    expect(canSubscribe('email', signalsFor(['audience:buyer'], [])).allowed).toBe(true)
  })

  it('reads the first non-empty address as primary', () => {
    expect(primaryEmailOf({ emails: [{ value: '' }, { value: ' A@B.com ' }] })).toBe('a@b.com')
    expect(primaryEmailOf({ emails: null })).toBe('')
  })
})

describe('DNC blocks at the chokepoint, not by coincidence', () => {
  it('a contact whose ONLY flag is the DNC registry is blocked from call and sms', () => {
    // The failure this pins: compliance:dnc-registry used to be a label the
    // send path never read. Every contact carrying it was blocked only because
    // it also carried contact:do-not-call. A DNC-only import was textable.
    const signals = signalsFor(['compliance:dnc-registry'], [])
    // canSubscribe only speaks email/sms (ConsentChannel), so the call channel
    // is asserted on the signals themselves — that is what isSuppressed reads.
    expect(signals).toContainEqual({ channel: 'call', reason: 'tag:compliance:dnc-registry' })
    expect(signals).toContainEqual({ channel: 'sms', reason: 'tag:compliance:dnc-registry' })
    expect(canSubscribe('sms', signals).allowed).toBe(false)
  })

  it('leaves email alone — the DNC registry is telephone, not email', () => {
    expect(canSubscribe('email', signalsFor(['compliance:dnc-registry'], [])).allowed).toBe(true)
  })

  it('honours the do_not_text alias carried in from the old CRM', () => {
    expect(canSubscribe('sms', signalsFor(['do_not_text'], [])).allowed).toBe(false)
  })
})
