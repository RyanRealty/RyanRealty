import { describe, it, expect, vi } from 'vitest'
import {
  executeCohortEnrollment,
  type CohortEnrollmentDeps,
} from './cohort-enrollment'

// ── Injectable-dep test harness ──────────────────────────────────────────────
// executeCohortEnrollment is auth-free and dependency-injected, so the whole
// orchestration (three-cohort union, dedupe, the S-10 two-phase suppression
// plan, and the past-client/general segment split) runs here with fakes — no
// session, no database. This is the coverage the shipped action lacked.

const baseDeps: CohortEnrollmentDeps = {
  getAudienceEligiblePeople: async () => ({ people: [], excludedSuppressed: 0, excludedRealtors: 0 }),
  getEngagedLeadEmailsSince: async () => [],
  getWestsideLinkedPersonIds: async () => [],
  getPeopleForEnrollment: async () => [],
  getSubscribersByEmails: async () => [],
  isSuppressedByEmail: async () => ({ suppressed: false, reasons: [] }),
  bulkActivateSubscribers: async () => 0,
}

function makeDeps(over: Partial<CohortEnrollmentDeps>): CohortEnrollmentDeps {
  return { ...baseDeps, ...over }
}

const ACTOR = 'matt@ryan-realty.com'

describe('executeCohortEnrollment — confirmation gate', () => {
  it('refuses a real run without the typed ENROLL confirmation (writes nothing)', async () => {
    const bulk = vi.fn(async () => 0)
    const r = await executeCohortEnrollment(makeDeps({ bulkActivateSubscribers: bulk }), {
      dryRun: false,
      confirmText: 'yes please',
      actorEmail: ACTOR,
    })
    expect(r).toEqual({ ok: false, error: 'confirmation_required' })
    expect(bulk).not.toHaveBeenCalled()
  })
})

describe('executeCohortEnrollment — audience union + dedupe (dry run)', () => {
  it('unions the three cohorts, merges duplicate emails, and never writes on a dry run', async () => {
    const bulk = vi.fn(async () => 0)
    const deps = makeDeps({
      getAudienceEligiblePeople: async () => ({
        people: [
          { personId: 1, firstName: 'Ada', lastName: 'Byron', emails: ['ada@x.com'] },
          { personId: 2, firstName: 'Grace', lastName: 'Hopper', emails: ['grace@x.com'] },
        ],
        excludedSuppressed: 0,
        excludedRealtors: 0,
      }),
      // 'ada@x.com' also engaged → must dedupe into ONE candidate carrying both cohorts.
      getEngagedLeadEmailsSince: async () => [
        { email: 'ada@x.com', personId: 1 },
        { email: 'lee@x.com', personId: 3 },
      ],
      getWestsideLinkedPersonIds: async () => [4],
      getPeopleForEnrollment: async () => [
        { personId: 3, email: 'lee@x.com', name: 'Lee', tags: [] },
        { personId: 4, email: 'wes@x.com', name: 'Wes', tags: [] },
      ],
      bulkActivateSubscribers: bulk,
    })

    const r = await executeCohortEnrollment(deps, { dryRun: true, actorEmail: ACTOR })
    expect(r.ok).toBe(true)
    if (!r.ok || r.dryRun !== true) throw new Error('expected a dry-run result')

    expect(r.cohortSizes).toEqual({ pastClient: 2, engaged: 2, westside: 1 })
    // Unique emails: ada, grace, lee, wes → 4 eligible, 0 excluded.
    expect(r.counts.candidates).toBe(4)
    expect(r.counts.eligible).toBe(4)
    expect(r.counts.noEmail).toBe(0)
    expect(bulk).not.toHaveBeenCalled()

    const ada = r.sample.find((s) => s.email === 'ada@x.com')
    expect(ada).toBeTruthy()
    expect(new Set(ada!.cohorts)).toEqual(new Set(['past-client', 'engaged']))
  })
})

describe('executeCohortEnrollment — real run segment split', () => {
  it('activates past clients in the past-client segment and everyone else in general, and sends no issue', async () => {
    const calls: Array<{ emails: string[]; source: string; segment: string }> = []
    const bulk = vi.fn(async (emails: string[], source: string, segment: string) => {
      calls.push({ emails, source, segment })
      return emails.length
    })
    const deps = makeDeps({
      getAudienceEligiblePeople: async () => ({
        people: [
          { personId: 1, firstName: 'Ada', lastName: 'Byron', emails: ['ada@x.com'] },
          { personId: 2, firstName: 'Grace', lastName: 'Hopper', emails: ['grace@x.com'] },
        ],
        excludedSuppressed: 0,
        excludedRealtors: 0,
      }),
      getEngagedLeadEmailsSince: async () => [{ email: 'lee@x.com', personId: 3 }],
      getWestsideLinkedPersonIds: async () => [4],
      getPeopleForEnrollment: async () => [
        { personId: 3, email: 'lee@x.com', name: 'Lee', tags: [] },
        { personId: 4, email: 'wes@x.com', name: 'Wes', tags: [] },
      ],
      bulkActivateSubscribers: bulk,
    })

    const r = await executeCohortEnrollment(deps, { dryRun: false, confirmText: 'ENROLL', actorEmail: ACTOR })
    expect(r.ok).toBe(true)
    if (!r.ok || r.dryRun !== false) throw new Error('expected a real-run result')

    expect(r.enrolled).toBe(4)
    expect(calls).toHaveLength(2)
    const pastClient = calls.find((c) => c.segment === 'past-client')!
    const general = calls.find((c) => c.segment === 'general')!
    expect(pastClient.emails).toEqual(['ada@x.com', 'grace@x.com'])
    expect(general.emails).toEqual(['lee@x.com', 'wes@x.com'])
    // Source records the actor for the audit trail.
    expect(pastClient.source).toBe(`cohort-enroll:${ACTOR}`)
    expect(general.source).toBe(`cohort-enroll:${ACTOR}`)
  })
})

describe('executeCohortEnrollment — consent + suppression filters', () => {
  it('drops suppressed, already-active, and prior opt-out addresses (S-10), never resurrecting them', async () => {
    const bulk = vi.fn(async (emails: string[]) => emails.length)
    const deps = makeDeps({
      getEngagedLeadEmailsSince: async () => [
        { email: 'opted@x.com', personId: 11 },
        { email: 'active@x.com', personId: 12 },
        { email: 'suppressed@x.com', personId: 13 },
        { email: 'fresh@x.com', personId: 14 },
      ],
      getPeopleForEnrollment: async () => [
        { personId: 11, email: 'opted@x.com', name: 'O', tags: [] },
        { personId: 12, email: 'active@x.com', name: 'A', tags: [] },
        { personId: 13, email: 'suppressed@x.com', name: 'S', tags: [] },
        { personId: 14, email: 'fresh@x.com', name: 'F', tags: [] },
      ],
      getSubscribersByEmails: async () => [
        { id: 's1', email: 'opted@x.com', crm_person_id: 11, status: 'unsubscribed' },
        { id: 's2', email: 'active@x.com', crm_person_id: 12, status: 'active' },
      ],
      isSuppressedByEmail: async (email: string) => ({
        suppressed: email === 'suppressed@x.com',
        reasons: email === 'suppressed@x.com' ? ['bounce'] : [],
      }),
      bulkActivateSubscribers: bulk,
    })

    const r = await executeCohortEnrollment(deps, { dryRun: false, confirmText: 'ENROLL', actorEmail: ACTOR })
    expect(r.ok).toBe(true)
    if (!r.ok || r.dryRun !== false) throw new Error('expected a real-run result')

    expect(r.counts.optedOut).toBe(1)
    expect(r.counts.alreadySubscribed).toBe(1)
    expect(r.counts.suppressed).toBe(1)
    expect(r.counts.eligible).toBe(1)
    expect(r.enrolled).toBe(1)
    // Only the fresh address is ever passed to the activation RPC.
    expect(bulk).toHaveBeenCalledTimes(1)
    expect(bulk).toHaveBeenCalledWith(['fresh@x.com'], `cohort-enroll:${ACTOR}`, 'general')
  })

  it('excludes realtor-tagged engaged/westside members via their crm tags', async () => {
    const deps = makeDeps({
      getEngagedLeadEmailsSince: async () => [{ email: 'realtor@x.com', personId: 9 }],
      getPeopleForEnrollment: async () => [
        { personId: 9, email: 'realtor@x.com', name: 'Rae', tags: ['realtor'] },
      ],
    })
    const r = await executeCohortEnrollment(deps, { dryRun: true, actorEmail: ACTOR })
    expect(r.ok).toBe(true)
    if (!r.ok || r.dryRun !== true) throw new Error('expected a dry-run result')
    expect(r.counts.realtorExcluded).toBe(1)
    expect(r.counts.eligible).toBe(0)
  })

  it('counts westside members with no email as noEmail and enrolls nobody', async () => {
    const deps = makeDeps({
      getWestsideLinkedPersonIds: async () => [7],
      getPeopleForEnrollment: async () => [{ personId: 7, email: null, name: 'No Email', tags: [] }],
    })
    const r = await executeCohortEnrollment(deps, { dryRun: true, actorEmail: ACTOR })
    expect(r.ok).toBe(true)
    if (!r.ok || r.dryRun !== true) throw new Error('expected a dry-run result')
    expect(r.counts.noEmail).toBe(1)
    expect(r.counts.candidates).toBe(1)
    expect(r.counts.eligible).toBe(0)
  })
})

describe('executeCohortEnrollment — fail closed', () => {
  it('aborts as audience_build_failed if any cohort read throws (never a partial audience)', async () => {
    const deps = makeDeps({
      getWestsideLinkedPersonIds: async () => {
        throw new Error('westside read down')
      },
    })
    const r = await executeCohortEnrollment(deps, { dryRun: true, actorEmail: ACTOR })
    expect(r).toEqual({ ok: false, error: 'audience_build_failed' })
  })

  it('aborts as lookup_failed if the existing-subscriber read throws (S-10 fail-closed)', async () => {
    const deps = makeDeps({
      getEngagedLeadEmailsSince: async () => [{ email: 'a@x.com', personId: 1 }],
      getPeopleForEnrollment: async () => [{ personId: 1, email: 'a@x.com', name: 'A', tags: [] }],
      getSubscribersByEmails: async () => {
        throw new Error('subscriber lookup down')
      },
    })
    const r = await executeCohortEnrollment(deps, { dryRun: false, confirmText: 'ENROLL', actorEmail: ACTOR })
    expect(r).toEqual({ ok: false, error: 'lookup_failed' })
  })
})
