import { describe, it, expect } from 'vitest'
import {
  canUserResubscribe,
  computeEnrollmentPlan,
  dedupeCandidatesByEmail,
  type EnrollmentCandidate,
} from './perLead'

// ── canUserResubscribe — the /account/notifications toggle decision ──────────

describe('canUserResubscribe', () => {
  it('allows a clean address', () => {
    expect(canUserResubscribe([], null).allowed).toBe(true)
    expect(canUserResubscribe([], 'unsubscribed').allowed).toBe(true)
  })

  it('allows the owner to clear ONLY their own soft email unsubscribe', () => {
    const r = canUserResubscribe([{ channel: 'email', reason: 'unsubscribe' }], 'unsubscribed')
    expect(r.allowed).toBe(true)
  })

  it('refuses over a hard bounce suppression', () => {
    const r = canUserResubscribe([{ channel: 'email', reason: 'bounce' }], 'unsubscribed')
    expect(r.allowed).toBe(false)
  })

  it('refuses over a spam complaint suppression', () => {
    const r = canUserResubscribe([{ channel: 'email', reason: 'complaint' }], null)
    expect(r.allowed).toBe(false)
  })

  it('refuses over an all-channel compliance hard-stop', () => {
    const r = canUserResubscribe([{ channel: 'all', reason: 'hard-stop' }], null)
    expect(r.allowed).toBe(false)
  })

  it('refuses over tag-derived email suppressions (never self-clearable)', () => {
    expect(canUserResubscribe([{ channel: 'email', reason: 'tag:do_not_email' }], null).allowed).toBe(false)
    expect(canUserResubscribe([{ channel: 'email', reason: 'tag:unsubscribed' }], null).allowed).toBe(false)
    expect(canUserResubscribe([{ channel: 'email', reason: 'tag:bounced' }], null).allowed).toBe(false)
  })

  it('refuses when the mix contains a hard stop even beside a soft unsubscribe', () => {
    const r = canUserResubscribe(
      [
        { channel: 'email', reason: 'unsubscribe' },
        { channel: 'email', reason: 'bounce' },
      ],
      'unsubscribed',
    )
    expect(r.allowed).toBe(false)
  })

  it('refuses when the subscriber row itself is terminal (bounced or complained)', () => {
    expect(canUserResubscribe([], 'bounced').allowed).toBe(false)
    expect(canUserResubscribe([], 'complained').allowed).toBe(false)
    // Even a soft-only suppression footprint cannot override a terminal row.
    expect(canUserResubscribe([{ channel: 'email', reason: 'unsubscribe' }], 'bounced').allowed).toBe(false)
  })

  it('ignores suppressions on other channels (an SMS stop never blocks email)', () => {
    const r = canUserResubscribe([{ channel: 'sms', reason: 'stop-keyword' }], null)
    expect(r.allowed).toBe(true)
  })

  it('treats an unknown suppression reason as a hard stop (fail closed)', () => {
    const r = canUserResubscribe([{ channel: 'email', reason: 'mystery-new-reason' }], null)
    expect(r.allowed).toBe(false)
  })
})

// ── dedupeCandidatesByEmail ──────────────────────────────────────────────────

function cand(partial: Partial<EnrollmentCandidate>): EnrollmentCandidate {
  return { email: null, personId: null, name: null, tags: [], cohorts: [], ...partial }
}

describe('dedupeCandidatesByEmail', () => {
  it('drops and counts entries with no usable email (filter 1: has-email)', () => {
    const { deduped, noEmail } = dedupeCandidatesByEmail([
      cand({ email: null, cohorts: ['westside'] }),
      cand({ email: '   ', cohorts: ['engaged'] }),
      cand({ email: 'not-an-email', cohorts: ['past-client'] }),
      cand({ email: 'a@example.com', cohorts: ['engaged'] }),
    ])
    expect(noEmail).toBe(3)
    expect(deduped).toHaveLength(1)
    expect(deduped[0]!.email).toBe('a@example.com')
  })

  it('merges duplicate emails case-insensitively, unioning cohorts and tags', () => {
    const { deduped, noEmail } = dedupeCandidatesByEmail([
      cand({ email: 'Jane@Example.com', personId: 7, name: 'Jane', tags: ['past-client'], cohorts: ['past-client'] }),
      cand({ email: 'jane@example.com', personId: null, tags: ['westside'], cohorts: ['westside'] }),
    ])
    expect(noEmail).toBe(0)
    expect(deduped).toHaveLength(1)
    const j = deduped[0]!
    expect(j.email).toBe('jane@example.com')
    expect(j.personId).toBe(7)
    expect(j.cohorts.sort()).toEqual(['past-client', 'westside'])
    expect(j.tags.sort()).toEqual(['past-client', 'westside'])
  })
})

// ── computeEnrollmentPlan — all four filters proven with fixture people ──────

describe('computeEnrollmentPlan', () => {
  const fixtures: EnrollmentCandidate[] = [
    // Eligible: past client, clean.
    cand({ email: 'pastclient@example.com', personId: 1, name: 'Pat Client', tags: ['past-client'], cohorts: ['past-client'] }),
    // Filter 2: realtor tag — targeting exclusion, never enrolled.
    cand({ email: 'agent@example.com', personId: 2, name: 'Ann Agent', tags: ['industry:realtor'], cohorts: ['engaged'] }),
    // Filter 3: suppressed (isSuppressedByEmail said no — any reason).
    cand({ email: 'optedout@example.com', personId: 3, name: 'Oscar Out', tags: [], cohorts: ['westside'] }),
    // Filter 4a: already an active subscriber — no-op.
    cand({ email: 'already@example.com', personId: 4, name: 'Al Ready', tags: [], cohorts: ['past-client'] }),
    // Filter 4b: prior opt-out on the subscriber row — never resurrected (S-10).
    cand({ email: 'unsubbed@example.com', personId: 5, name: 'Una Subbed', tags: [], cohorts: ['engaged'] }),
    cand({ email: 'bounced@example.com', personId: 6, name: 'Bo Unced', tags: [], cohorts: ['westside'] }),
    // Eligible: westside cohort, clean, no subscriber row.
    cand({ email: 'westside@example.com', personId: 7, name: 'Wes Side', tags: [], cohorts: ['westside'] }),
  ]

  const { deduped, noEmail } = dedupeCandidatesByEmail([
    ...fixtures,
    // Filter 1: has-email — a westside person with no address on file.
    cand({ email: null, personId: 8, name: 'No Email', cohorts: ['westside'] }),
  ])

  const plan = computeEnrollmentPlan(deduped, {
    noEmail,
    suppressedEmails: new Set(['optedout@example.com']),
    existingSubscriberStatusByEmail: new Map([
      ['already@example.com', 'active'],
      ['unsubbed@example.com', 'unsubscribed'],
      ['bounced@example.com', 'bounced'],
    ]),
  })

  it('keeps only the clean, unsubscribed, non-realtor, has-email people', () => {
    expect(plan.eligible.map((c) => c.email).sort()).toEqual(['pastclient@example.com', 'westside@example.com'])
  })

  it('counts every exclusion bucket and the buckets add up', () => {
    expect(plan.counts).toEqual({
      candidates: 8,
      noEmail: 1,
      realtorExcluded: 1,
      suppressed: 1,
      alreadySubscribed: 1,
      optedOut: 2,
      eligible: 2,
    })
    const c = plan.counts
    expect(c.noEmail + c.realtorExcluded + c.suppressed + c.alreadySubscribed + c.optedOut + c.eligible).toBe(c.candidates)
  })

  it('never resurrects a prior opt-out even when the address is not otherwise suppressed', () => {
    expect(plan.eligible.some((c) => c.email === 'unsubbed@example.com')).toBe(false)
    expect(plan.eligible.some((c) => c.email === 'bounced@example.com')).toBe(false)
  })

  it('matches realtor tags case-insensitively and on substrings like the audience read', () => {
    const { deduped: d2 } = dedupeCandidatesByEmail([
      cand({ email: 'r1@example.com', tags: ['Realtor'] , cohorts: ['engaged'] }),
      cand({ email: 'r2@example.com', tags: ['industry:REALTOR'], cohorts: ['engaged'] }),
    ])
    const p2 = computeEnrollmentPlan(d2, {
      noEmail: 0,
      suppressedEmails: new Set(),
      existingSubscriberStatusByEmail: new Map(),
    })
    expect(p2.counts.realtorExcluded).toBe(2)
    expect(p2.eligible).toHaveLength(0)
  })
})
