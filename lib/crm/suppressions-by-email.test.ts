import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Unit coverage for isSuppressedByEmail — the person-id-less suppression check
 * used on send paths that only know a recipient email. Asserts the three
 * suppression sources (per-person suppression rows, protected compliance tags,
 * email-keyed suppression rows) and the fail-closed contract.
 */

// In-memory Supabase double. Per-table query results are set per test.
type People = Array<{ id: number; tags: string[] }>
let peopleResult: { data: People | null; error: { message: string } | null } = { data: [], error: null }
let perPersonSuppression: Record<number, { channel: string; reason: string }[]> = {}
let perPersonTags: Record<number, string[]> = {}
let emailSuppressionRows: { data: Array<{ channel: string; reason: string }> | null; error: { message: string } | null } = {
  data: [],
  error: null,
}

function makeSb() {
  return {
    from(table: string) {
      // crm_people contains('emails', ...) → returns a thenable (no maybeSingle)
      if (table === 'crm_people') {
        const chain: Record<string, unknown> = {}
        chain.select = () => chain
        // .contains resolves the multi-row people query for isSuppressedByEmail
        chain.contains = () => Promise.resolve(peopleResult)
        // .eq + .maybeSingle is the isSuppressed per-person tag read
        let pendingId = 0
        chain.eq = (_c: string, id: number) => {
          pendingId = id
          return chain
        }
        chain.maybeSingle = () => Promise.resolve({ data: { tags: perPersonTags[pendingId] ?? [] }, error: null })
        return chain
      }
      if (table === 'crm_suppressions') {
        const chain: Record<string, unknown> = {}
        let mode: 'person' | 'email' = 'email'
        let pid = 0
        chain.select = () => chain
        chain.eq = (col: string, val: number | string) => {
          if (col === 'person_id') {
            mode = 'person'
            pid = val as number
          } else if (col === 'value') {
            mode = 'email'
          }
          return chain
        }
        // isSuppressed: .in('channel', ['all', channel]) resolves the per-person
        // suppression rows, honoring the channel filter the real query applies.
        // isSuppressedByEmail email read: .in resolves the email-keyed rows.
        chain.in = (_col: string, channels: string[]) => {
          if (mode === 'person') {
            const allowed = new Set(channels)
            const rows = (perPersonSuppression[pid] ?? []).filter((r) => allowed.has(r.channel))
            return Promise.resolve({ data: rows, error: null })
          }
          return Promise.resolve(emailSuppressionRows)
        }
        return chain
      }
      return { select: () => ({}) }
    },
  }
}

vi.mock('@/lib/supabase/service', () => ({ createServiceClient: () => makeSb() }))
// enqueueAudienceRemoval is dynamically imported by addSuppression only; never hit here.

import { isSuppressedByEmail } from '@/lib/crm/suppressions'

beforeEach(() => {
  peopleResult = { data: [], error: null }
  perPersonSuppression = {}
  perPersonTags = {}
  emailSuppressionRows = { data: [], error: null }
})
afterEach(() => vi.clearAllMocks())

describe('isSuppressedByEmail', () => {
  it('fails closed on an empty email', async () => {
    const r = await isSuppressedByEmail('', 'email')
    expect(r.suppressed).toBe(true)
    expect(r.reasons).toContain('no-email')
  })

  it('fails closed when the people read errors', async () => {
    peopleResult = { data: null, error: { message: 'db down' } }
    const r = await isSuppressedByEmail('a@b.com', 'email')
    expect(r.suppressed).toBe(true)
    expect(r.reasons.some((x) => x.includes('email-suppression-check-failed'))).toBe(true)
  })

  it('fails closed when the email-keyed suppression read errors', async () => {
    peopleResult = { data: [], error: null }
    emailSuppressionRows = { data: null, error: { message: 'timeout' } }
    const r = await isSuppressedByEmail('a@b.com', 'email')
    expect(r.suppressed).toBe(true)
    expect(r.reasons.some((x) => x.includes('email-suppression-check-failed'))).toBe(true)
  })

  it('is NOT suppressed for a brand-new email with no person and no rows', async () => {
    const r = await isSuppressedByEmail('fresh@lead.com', 'email')
    expect(r.suppressed).toBe(false)
    expect(r.reasons).toHaveLength(0)
  })

  it('suppresses on a protected compliance tag on a matched person', async () => {
    peopleResult = { data: [{ id: 7, tags: ['compliance:hard-stop'] }], error: null }
    perPersonTags[7] = ['compliance:hard-stop']
    const r = await isSuppressedByEmail('opted@out.com', 'email')
    expect(r.suppressed).toBe(true)
    expect(r.reasons).toContain('tag:compliance:hard-stop')
  })

  it('suppresses do-not-call on the sms channel (TCPA: a text is a call)', async () => {
    peopleResult = { data: [{ id: 9, tags: ['contact:do-not-call'] }], error: null }
    perPersonTags[9] = ['contact:do-not-call']
    const r = await isSuppressedByEmail('x@y.com', 'sms')
    expect(r.suppressed).toBe(true)
    expect(r.reasons).toContain('tag:contact:do-not-call')
  })

  it('a protected compliance tag blocks regardless of channel (spec blocker 1)', async () => {
    // contact:do-not-text is a protected compliance tag — per the contract it
    // suppresses on ANY channel, even though TAG_CHANNEL maps it to sms only.
    // The protected-tag scan is the belt-and-suspenders that makes a person who
    // carries any protected tag un-mailable by this email-keyed check.
    peopleResult = { data: [{ id: 3, tags: ['contact:do-not-text'] }], error: null }
    perPersonTags[3] = ['contact:do-not-text']
    const r = await isSuppressedByEmail('emailer@ok.com', 'email')
    expect(r.suppressed).toBe(true)
    expect(r.reasons).toContain('tag:contact:do-not-text')
  })

  it('honors the channel for non-protected suppression sources (no false block)', async () => {
    // A person with NO protected tag and only an sms-channel suppression row is
    // not blocked from email. (Proves the channel filter still applies to the
    // per-person isSuppressed read.)
    peopleResult = { data: [{ id: 4, tags: [] }], error: null }
    perPersonSuppression[4] = [{ channel: 'sms', reason: 'manual' }]
    // isSuppressed reads crm_suppressions filtered .in(['all','email']); the sms
    // row is excluded by that filter, so the double here returns it only when the
    // channel matches. Simulate the channel filter by keying on the requested
    // channel: for 'email' the sms row must not surface.
    const r = await isSuppressedByEmail('ok@email.com', 'email')
    expect(r.suppressed).toBe(false)
  })

  it('suppresses on a per-person suppression row for the channel', async () => {
    peopleResult = { data: [{ id: 11, tags: [] }], error: null }
    perPersonSuppression[11] = [{ channel: 'email', reason: 'unsubscribed' }]
    const r = await isSuppressedByEmail('unsub@x.com', 'email')
    expect(r.suppressed).toBe(true)
    expect(r.reasons.some((x) => x.includes('person:11'))).toBe(true)
  })

  it('suppresses on an email-keyed suppression row with no person', async () => {
    peopleResult = { data: [], error: null }
    emailSuppressionRows = { data: [{ channel: 'all', reason: 'bounced' }], error: null }
    const r = await isSuppressedByEmail('bounced@x.com', 'email')
    expect(r.suppressed).toBe(true)
    expect(r.reasons).toContain('email:all:bounced')
  })
})
