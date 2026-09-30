import { describe, it, expect } from 'vitest'
import {
  CONTACT_STOP_VIAS,
  describeVia,
  isContactStopped,
  isContactStopVia,
  MIN_CONSENT_NOTE,
  planReportChange,
  planReportChanges,
  reportSubscriptionState,
  withReportPatch,
} from './market-report-subscription-control'
import type { ReportSubscriptionRecord } from '@/lib/data/crm/marketReportSubscription'

const NOW = new Date('2026-09-29T18:00:00.000Z')

function rec(over: Partial<ReportSubscriptionRecord> = {}): ReportSubscriptionRecord {
  return {
    id: 9016,
    personId: 64138,
    areas: ['bend', 'bend-larkspur'],
    frequency: 'monthly',
    isActive: true,
    lastSentAt: null,
    lastAttemptAt: null,
    createdAt: '2026-09-28T23:00:00.000Z',
    updatedAt: null,
    firstSendApprovedAt: null,
    firstSendApprovedBy: null,
    source: 'email-reply',
    requestedAt: '2026-09-28T22:54:59.000Z',
    consentNote: 'Replied to a CMA email on 2026-09-28: "Yes please keep me in the loop on the market."',
    stoppedAt: null,
    stoppedVia: null,
    ...over,
  }
}

const EMAIL = { via: 'email-link' } as const
const ONE_CLICK = { via: 'one-click' } as const
const ADMIN = { via: 'admin', adminEmail: 'matt@ryan-realty.com' } as const

describe('reportSubscriptionState', () => {
  it('on / paused / stopped', () => {
    expect(reportSubscriptionState(rec())).toBe('on')
    expect(reportSubscriptionState(rec({ isActive: false }))).toBe('paused')
    expect(reportSubscriptionState(rec({ isActive: false, stoppedAt: NOW.toISOString() }))).toBe('stopped')
  })
})

describe('planReportChange: pause, resume, stop', () => {
  it('pause turns the report off without a stop stamp', () => {
    const p = planReportChange(rec(), { kind: 'pause' }, EMAIL, NOW)
    expect(p).toMatchObject({ ok: true, noop: false, patch: { is_active: false } })
    if (p.ok && !p.noop) {
      expect(p.patch).not.toHaveProperty('stopped_at')
      expect(p.title).toBe("Market report paused from the report's email link")
    }
  })

  it('stop is report-scoped: off, stamped, and says who', () => {
    const p = planReportChange(rec(), { kind: 'stop' }, ONE_CLICK, NOW)
    expect(p).toMatchObject({
      ok: true,
      noop: false,
      patch: { is_active: false, stopped_at: NOW.toISOString(), stopped_via: 'one-click' },
    })
    if (p.ok && !p.noop) {
      expect(p.title).toBe("Market report stopped by the one-click unsubscribe in the report's email")
      expect(p.message).toContain('Other email from Ryan Realty is not affected')
    }
  })

  it('a stop of a stopped report is a no-op', () => {
    expect(planReportChange(rec({ isActive: false, stoppedAt: NOW.toISOString(), stoppedVia: 'one-click' }), { kind: 'stop' }, EMAIL, NOW)).toMatchObject({
      ok: true,
      noop: true,
    })
  })

  it('her own resume after her own stop turns it back on and clears the stop', () => {
    const stopped = rec({ isActive: false, stoppedAt: '2026-09-20T00:00:00Z', stoppedVia: 'email-link' })
    const p = planReportChange(stopped, { kind: 'resume' }, EMAIL, NOW)
    expect(p).toMatchObject({ ok: true, noop: false, patch: { is_active: true, stopped_at: null, stopped_via: null } })
  })

  it('a resume needs at least one area', () => {
    expect(planReportChange(rec({ isActive: false, areas: [] }), { kind: 'resume' }, EMAIL, NOW)).toMatchObject({
      ok: false,
      code: 'no-areas',
    })
  })
})

describe('planReportChange: the one compliance rule (a contact-stopped report)', () => {
  const stoppedByHer = rec({ isActive: false, stoppedAt: '2026-09-20T00:00:00Z', stoppedVia: 'one-click' })

  it('an admin cannot turn a contact-stopped report back on without her consent on record', () => {
    const p = planReportChange(stoppedByHer, { kind: 'resume' }, ADMIN, NOW)
    expect(p.ok).toBe(false)
    const short = planReportChange(stoppedByHer, { kind: 'resume' }, { ...ADMIN, consentNote: 'yes' }, NOW)
    expect(short.ok).toBe(false)
  })

  it(`a consent note of at least ${MIN_CONSENT_NOTE} characters restarts it and is kept on the row`, () => {
    const note = 'She called 9/29 and asked to get the monthly report again'
    const p = planReportChange(stoppedByHer, { kind: 'resume' }, { ...ADMIN, consentNote: note }, NOW)
    expect(p).toMatchObject({ ok: true, noop: false })
    if (p.ok && !p.noop) {
      expect(p.patch.is_active).toBe(true)
      expect(p.patch.stopped_at).toBeNull()
      expect(p.patch.requested_at).toBe(NOW.toISOString())
      expect(p.patch.consent_note).toContain(stoppedByHer.consentNote as string)
      expect(p.patch.consent_note).toContain(`2026-09-29 restarted by matt@ryan-realty.com: ${note}`)
    }
  })

  it('an admin-stopped report restarts without a note', () => {
    const p = planReportChange(rec({ isActive: false, stoppedAt: '2026-09-20T00:00:00Z', stoppedVia: 'admin' }), { kind: 'resume' }, ADMIN, NOW)
    expect(p).toMatchObject({ ok: true, noop: false, patch: { is_active: true } })
  })
})

describe('planReportChange: her stop always lands, even on a report a broker stopped', () => {
  const brokerStopped = rec({ isActive: false, stoppedAt: '2026-09-20T00:00:00Z', stoppedVia: 'admin' })

  it('her one-click, her email link and her account page each replace a broker stop with hers', () => {
    for (const actor of [ONE_CLICK, EMAIL, { via: 'self-serve' } as const]) {
      const p = planReportChange(brokerStopped, { kind: 'stop' }, actor, NOW)
      expect(p).toMatchObject({
        ok: true,
        noop: false,
        patch: { is_active: false, stopped_at: NOW.toISOString(), stopped_via: actor.via },
      })
    }
  })

  it('after she replaces the stop, a broker restart needs her consent on record', () => {
    const p = planReportChange(brokerStopped, { kind: 'stop' }, ONE_CLICK, NOW)
    if (!p.ok || p.noop) throw new Error('expected a patch')
    const after = withReportPatch(brokerStopped, p.patch)
    expect(isContactStopped(after)).toBe(true)
    expect(planReportChange(after, { kind: 'resume' }, ADMIN, NOW)).toMatchObject({ ok: false, code: 'consent-required' })
  })

  it('a broker stop never replaces hers, and her second stop is a no-op', () => {
    const hers = rec({ isActive: false, stoppedAt: '2026-09-20T00:00:00Z', stoppedVia: 'one-click' })
    expect(planReportChange(hers, { kind: 'stop' }, ADMIN, NOW)).toMatchObject({ ok: true, noop: true })
    expect(planReportChange(hers, { kind: 'stop' }, EMAIL, NOW)).toMatchObject({ ok: true, noop: true })
  })
})

describe('planReportChange: interval, areas, approval', () => {
  it('switches the interval', () => {
    expect(planReportChange(rec(), { kind: 'frequency', frequency: 'quarterly' }, EMAIL, NOW)).toMatchObject({
      ok: true,
      noop: false,
      patch: { frequency: 'quarterly' },
    })
    expect(planReportChange(rec(), { kind: 'frequency', frequency: 'monthly' }, EMAIL, NOW)).toMatchObject({ noop: true })
  })

  it('changes areas, never to none', () => {
    const p = planReportChange(rec(), { kind: 'areas', areas: ['bend-larkspur'], labels: ['Larkspur'] }, EMAIL, NOW)
    expect(p).toMatchObject({ ok: true, noop: false, patch: { areas: ['bend-larkspur'] } })
    if (p.ok && !p.noop) expect(p.title).toBe("Market report areas set to Larkspur from the report's email link")
    expect(planReportChange(rec(), { kind: 'areas', areas: [], labels: [] }, EMAIL, NOW)).toMatchObject({ ok: false })
  })

  it('only a broker can approve the first send', () => {
    expect(planReportChange(rec(), { kind: 'approve' }, EMAIL, NOW)).toMatchObject({ ok: false })
    expect(planReportChange(rec(), { kind: 'approve' }, ADMIN, NOW)).toMatchObject({
      ok: true,
      noop: false,
      patch: { first_send_approved_at: NOW.toISOString(), first_send_approved_by: 'matt@ryan-realty.com' },
    })
    expect(planReportChange(rec({ firstSendApprovedAt: '2026-09-29T00:00:00Z' }), { kind: 'approve' }, ADMIN, NOW)).toMatchObject({
      noop: true,
    })
  })
})

describe('describeVia (the timeline says where a change came from)', () => {
  it('names every door', () => {
    expect(describeVia({ via: 'email-link' })).toBe("from the report's email link")
    expect(describeVia({ via: 'one-click' })).toBe("by the one-click unsubscribe in the report's email")
    expect(describeVia({ via: 'self-serve' })).toBe('from the account page')
    expect(describeVia({ via: 'admin', adminEmail: 'paul@ryan-realty.com' })).toBe('by paul@ryan-realty.com')
  })
})

describe('who stopped it (one list, read by every door)', () => {
  it('the contact\'s own stops are one-click, her email link and her account page; an admin stop is not one', () => {
    expect([...CONTACT_STOP_VIAS]).toEqual(['one-click', 'email-link', 'self-serve'])
    for (const via of CONTACT_STOP_VIAS) expect(isContactStopVia(via)).toBe(true)
    expect(isContactStopVia('admin')).toBe(false)
    expect(isContactStopVia(null)).toBe(false)
    expect(isContactStopVia(undefined)).toBe(false)
  })

  it('a report is contact-stopped only while it is off', () => {
    expect(isContactStopped({ isActive: false, stoppedVia: 'one-click' })).toBe(true)
    expect(isContactStopped({ isActive: true, stoppedVia: 'one-click' })).toBe(false)
    expect(isContactStopped({ isActive: false, stoppedVia: 'admin' })).toBe(false)
    expect(isContactStopped({ isActive: false, stoppedVia: null })).toBe(false)
  })

  it('refusals carry a code a caller can branch on', () => {
    const stopped = rec({ isActive: false, stoppedAt: '2026-09-30T00:00:00Z', stoppedVia: 'one-click' })
    expect(planReportChange(stopped, { kind: 'resume' }, ADMIN, NOW)).toMatchObject({ ok: false, code: 'consent-required' })
    expect(planReportChange(rec(), { kind: 'areas', areas: [], labels: [] }, EMAIL, NOW)).toMatchObject({
      ok: false,
      code: 'last-area',
    })
    expect(planReportChange(rec(), { kind: 'approve' }, EMAIL, NOW)).toMatchObject({ ok: false, code: 'not-admin' })
  })
})

describe('withReportPatch', () => {
  it('maps every patch column onto the record and leaves the rest alone', () => {
    const next = withReportPatch(rec({ isActive: false, stoppedAt: '2026-09-30T00:00:00Z', stoppedVia: 'admin' }), {
      is_active: true,
      stopped_at: null,
      stopped_via: null,
      frequency: 'weekly',
      areas: ['sisters'],
    })
    expect(next).toMatchObject({ isActive: true, stoppedAt: null, stoppedVia: null, frequency: 'weekly', areas: ['sisters'] })
    expect(next.consentNote).toBe(rec().consentNote)
  })
})

describe('planReportChanges (several changes, one write)', () => {
  it('plans each change against the record the earlier ones leave, in one patch', () => {
    const plan = planReportChanges(
      rec({ isActive: false, areas: [] }),
      [
        { kind: 'areas', areas: ['bend'], labels: ['Bend'] },
        { kind: 'frequency', frequency: 'weekly' },
        { kind: 'resume' },
      ],
      ADMIN,
      NOW,
    )
    // The resume is planned AFTER the areas land, so "no areas" does not refuse it.
    expect(plan).toMatchObject({
      ok: true,
      noop: false,
      patch: { areas: ['bend'], frequency: 'weekly', is_active: true },
      titles: [
        'Market report areas set to Bend by matt@ryan-realty.com',
        'Market report set to weekly by matt@ryan-realty.com',
        'Market report resumed by matt@ryan-realty.com',
      ],
    })
    if (plan.ok && !plan.noop) expect(plan.after).toMatchObject({ isActive: true, areas: ['bend'], frequency: 'weekly' })
  })

  it('one refusal refuses the whole set, before anything is written', () => {
    const plan = planReportChanges(
      rec({ isActive: false, stoppedAt: '2026-09-30T00:00:00Z', stoppedVia: 'self-serve' }),
      [{ kind: 'frequency', frequency: 'weekly' }, { kind: 'resume' }],
      ADMIN,
      NOW,
    )
    expect(plan).toMatchObject({ ok: false, code: 'consent-required', change: { kind: 'resume' } })
    expect(plan).not.toHaveProperty('patch')
  })

  it('changes that are all already so are one no-op', () => {
    expect(
      planReportChanges(rec(), [{ kind: 'frequency', frequency: 'monthly' }, { kind: 'resume' }], ADMIN, NOW),
    ).toEqual({ ok: true, noop: true })
  })
})
