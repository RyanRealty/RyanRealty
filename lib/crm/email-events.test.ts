import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the two DAL modules recordEmailEvent dynamically imports so the
// orchestration is tested without standing up Supabase. The pure helpers
// (buildDedupeKey, normalizeEvent) are unaffected by these mocks.
const mockInsert = vi.fn()
const mockGetPersonIds = vi.fn()
const mockGetPrimaryEmail = vi.fn()
vi.mock('@/lib/data/crm/insertEmailEvent', () => ({
  insertEmailEvent: (...args: unknown[]) => mockInsert(...args),
}))
vi.mock('@/lib/data/crm/getPersonIdsByEmail', () => ({
  getPersonIdsByEmail: (...args: unknown[]) => mockGetPersonIds(...args),
}))
vi.mock('@/lib/data/crm/getPersonPrimaryEmail', () => ({
  getPersonPrimaryEmail: (...args: unknown[]) => mockGetPrimaryEmail(...args),
}))

import {
  buildDedupeKey,
  normalizeEvent,
  recordEmailEvent,
  resolvePersonIdByEmail,
  sendTypeFromEmailKey,
} from './email-events'

describe('buildDedupeKey (idempotency)', () => {
  it('is stable for the same (messageId, event, recipient)', () => {
    const a = buildDedupeKey({ messageId: 'm1', event: 'open', recipientEmail: 'a@b.com' })
    const b = buildDedupeKey({ messageId: 'm1', event: 'open', recipientEmail: 'a@b.com' })
    expect(a).toBe(b)
    expect(a).toBe('m1:open:a@b.com')
  })

  it('lowercases + trims the recipient so casing variants collapse', () => {
    const a = buildDedupeKey({ messageId: 'm1', event: 'open', recipientEmail: '  A@B.com ' })
    const b = buildDedupeKey({ messageId: 'm1', event: 'open', recipientEmail: 'a@b.com' })
    expect(a).toBe(b)
  })

  it('differs per event for the same message + recipient', () => {
    const open = buildDedupeKey({ messageId: 'm1', event: 'open', recipientEmail: 'a@b.com' })
    const click = buildDedupeKey({ messageId: 'm1', event: 'click', recipientEmail: 'a@b.com' })
    expect(open).not.toBe(click)
  })

  it('falls back to emailKey when no messageId is present (pixel-only open)', () => {
    const k = buildDedupeKey({ emailKey: 'manual:42:1700', event: 'open', recipientEmail: 'a@b.com' })
    expect(k).toBe('manual:42:1700:open:a@b.com')
  })

  it('falls back to "none" anchor when neither messageId nor emailKey exists', () => {
    const k = buildDedupeKey({ event: 'sent', recipientEmail: 'a@b.com' })
    expect(k).toBe('none:sent:a@b.com')
  })

  it('anchors on the person (p:<id>) when no recipient is known (Gmail rail)', () => {
    const k = buildDedupeKey({ emailKey: 'newsletter:42', event: 'open', personId: 42 })
    expect(k).toBe('newsletter:42:open:p:42')
  })

  it('keeps a person-anchored open idempotent across many pixel fires', () => {
    const a = buildDedupeKey({ emailKey: 'cma:deer', event: 'open', personId: 7 })
    const b = buildDedupeKey({ emailKey: 'cma:deer', event: 'open', personId: 7 })
    expect(a).toBe(b)
  })

  it('prefers the recipient over the person id when both are present', () => {
    const k = buildDedupeKey({ messageId: 'm1', event: 'open', recipientEmail: 'a@b.com', personId: 42 })
    expect(k).toBe('m1:open:a@b.com')
  })
})

describe('sendTypeFromEmailKey (emailKey prefix inference)', () => {
  it('maps each known prefix to its send type', () => {
    expect(sendTypeFromEmailKey('newsletter:2026-06')).toBe('newsletter')
    expect(sendTypeFromEmailKey('campaign:spring')).toBe('campaign')
    expect(sendTypeFromEmailKey('cma:cma-62285-deer')).toBe('cma')
    expect(sendTypeFromEmailKey('market-report:bend')).toBe('market-report')
    expect(sendTypeFromEmailKey('alert:new-listing')).toBe('alert')
    // The real alert send paths sign `listing-alert:<rowId>:<runDate>` — must
    // classify as 'alert', not fall through to 'other' (regression 2026-07-06).
    expect(sendTypeFromEmailKey('listing-alert:2b6a4c9e:2026-07-06')).toBe('alert')
    expect(sendTypeFromEmailKey('Listing-Alert:2b6a4c9e:2026-07-06')).toBe('alert')
    expect(sendTypeFromEmailKey('seq:69:2')).toBe('sequence')
    expect(sendTypeFromEmailKey('sequence:69:2')).toBe('sequence')
    expect(sendTypeFromEmailKey('manual:42:1700')).toBe('one-off')
  })

  it('is case-insensitive and whitespace-tolerant on the prefix', () => {
    expect(sendTypeFromEmailKey('  Newsletter:x ')).toBe('newsletter')
    expect(sendTypeFromEmailKey('CMA:y')).toBe('cma')
  })

  it('falls back to "other" for an unknown / prefix-less / empty key', () => {
    expect(sendTypeFromEmailKey('welcome:1')).toBe('other')
    expect(sendTypeFromEmailKey('justastring')).toBe('other')
    expect(sendTypeFromEmailKey('')).toBe('other')
    expect(sendTypeFromEmailKey(null)).toBe('other')
    expect(sendTypeFromEmailKey(undefined)).toBe('other')
  })
})

describe('normalizeEvent (Resend + Gmail name mapping)', () => {
  it('maps Resend email.* names to the enum', () => {
    expect(normalizeEvent('email.delivered')).toBe('delivered')
    expect(normalizeEvent('email.opened')).toBe('open')
    expect(normalizeEvent('email.clicked')).toBe('click')
    expect(normalizeEvent('email.bounced')).toBe('bounce')
    expect(normalizeEvent('email.complained')).toBe('complaint')
  })

  it('maps Gmail tracker names to the enum', () => {
    expect(normalizeEvent('open')).toBe('open')
    expect(normalizeEvent('opened')).toBe('open')
    expect(normalizeEvent('click')).toBe('click')
    expect(normalizeEvent('clicked')).toBe('click')
  })

  it('maps spam/complaint + unsubscribe synonyms', () => {
    expect(normalizeEvent('spam')).toBe('complaint')
    expect(normalizeEvent('spamReport')).toBe('complaint')
    expect(normalizeEvent('unsubscribed')).toBe('unsubscribe')
    expect(normalizeEvent('opt-out')).toBe('unsubscribe')
  })

  it('passes already-normalized values through, case-insensitively', () => {
    expect(normalizeEvent('SENT')).toBe('sent')
    expect(normalizeEvent('  delivered ')).toBe('delivered')
  })

  it('returns null for an unknown or empty event', () => {
    expect(normalizeEvent('email.scheduled')).toBeNull()
    expect(normalizeEvent('')).toBeNull()
    expect(normalizeEvent(null)).toBeNull()
    expect(normalizeEvent(undefined)).toBeNull()
  })
})

describe('resolvePersonIdByEmail (fail-closed)', () => {
  beforeEach(() => {
    mockGetPersonIds.mockReset()
  })

  it('resolves a single unambiguous match', async () => {
    mockGetPersonIds.mockResolvedValue([42])
    expect(await resolvePersonIdByEmail('a@b.com')).toBe(42)
  })

  it('fails closed (null) when the email matches NO person', async () => {
    mockGetPersonIds.mockResolvedValue([])
    expect(await resolvePersonIdByEmail('nobody@x.com')).toBeNull()
  })

  it('fails closed (null) when the email is AMBIGUOUS (many matches)', async () => {
    mockGetPersonIds.mockResolvedValue([1, 2, 3])
    expect(await resolvePersonIdByEmail('shared@farm.com')).toBeNull()
  })

  it('returns null for an empty email without hitting the DAL', async () => {
    expect(await resolvePersonIdByEmail('   ')).toBeNull()
    expect(mockGetPersonIds).not.toHaveBeenCalled()
  })
})

describe('recordEmailEvent', () => {
  beforeEach(() => {
    mockInsert.mockReset()
    mockGetPersonIds.mockReset()
    mockGetPrimaryEmail.mockReset()
  })

  it('writes a normalized row and reports inserted=true (the new-row path)', async () => {
    mockGetPersonIds.mockResolvedValue([7])
    mockInsert.mockResolvedValue({ ok: true, inserted: true })
    const res = await recordEmailEvent({
      messageId: 'resend_abc',
      recipientEmail: 'Lead@Example.com',
      broker: 'matthew-ryan',
      sendType: 'newsletter',
      event: 'email.opened',
      subject: 'June market update',
    })
    expect(res).toEqual({ ok: true, inserted: true, event: 'open', personId: 7 })
    expect(mockInsert).toHaveBeenCalledOnce()
    const row = mockInsert.mock.calls[0][0]
    expect(row.recipient_email).toBe('lead@example.com')
    expect(row.event).toBe('open')
    expect(row.person_id).toBe(7)
    expect(row.dedupe_key).toBe('resend_abc:open:lead@example.com')
  })

  it('reports inserted=false on the ON CONFLICT DO NOTHING path (redelivery)', async () => {
    mockGetPersonIds.mockResolvedValue([7])
    mockInsert.mockResolvedValue({ ok: true, inserted: false })
    const res = await recordEmailEvent({
      messageId: 'resend_abc',
      recipientEmail: 'lead@example.com',
      sendType: 'newsletter',
      event: 'opened',
    })
    expect(res).toEqual({ ok: true, inserted: false, event: 'open', personId: 7 })
  })

  it('stores person_id null when the recipient resolves ambiguously (fail-closed)', async () => {
    mockGetPersonIds.mockResolvedValue([1, 2])
    mockInsert.mockResolvedValue({ ok: true, inserted: true })
    await recordEmailEvent({ recipientEmail: 'shared@farm.com', sendType: 'campaign', event: 'click', emailKey: 'k1' })
    const row = mockInsert.mock.calls[0][0]
    expect(row.person_id).toBeNull()
    expect(row.event).toBe('click')
    expect(row.dedupe_key).toBe('k1:click:shared@farm.com')
  })

  it('uses a caller-supplied personId without re-resolving from the email', async () => {
    mockInsert.mockResolvedValue({ ok: true, inserted: true })
    await recordEmailEvent({ recipientEmail: 'a@b.com', personId: 99, sendType: 'sequence', event: 'sent', messageId: 'm9' })
    expect(mockGetPersonIds).not.toHaveBeenCalled()
    expect(mockInsert.mock.calls[0][0].person_id).toBe(99)
  })

  it('rejects an unrecognized event before touching the DAL', async () => {
    const res = await recordEmailEvent({ recipientEmail: 'a@b.com', sendType: 'other', event: 'email.scheduled' })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toContain('unrecognized event')
    expect(mockInsert).not.toHaveBeenCalled()
  })

  it('rejects a missing recipient when no personId is supplied', async () => {
    const res = await recordEmailEvent({ recipientEmail: '  ', sendType: 'other', event: 'sent' })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toContain('recipientEmail or personId required')
  })

  it('Gmail rail: accepts a personId with NO recipient, resolves the email best-effort', async () => {
    mockGetPrimaryEmail.mockResolvedValue('lead@example.com')
    mockInsert.mockResolvedValue({ ok: true, inserted: true })
    const res = await recordEmailEvent({
      personId: 42,
      sendType: 'newsletter',
      event: 'open',
      emailKey: 'newsletter:2026-06',
      subject: 'June market update',
    })
    expect(res).toEqual({ ok: true, inserted: true, event: 'open', personId: 42 })
    // Person resolved by id, never re-resolved from an email.
    expect(mockGetPersonIds).not.toHaveBeenCalled()
    const row = mockInsert.mock.calls[0][0]
    expect(row.person_id).toBe(42)
    expect(row.recipient_email).toBe('lead@example.com')
    // Recipient known -> dedupe anchored on the email.
    expect(row.dedupe_key).toBe('newsletter:2026-06:open:lead@example.com')
  })

  it('Gmail rail: still records (recipient empty) when the person has no email on file', async () => {
    mockGetPrimaryEmail.mockResolvedValue(null)
    mockInsert.mockResolvedValue({ ok: true, inserted: true })
    const res = await recordEmailEvent({ personId: 7, sendType: 'cma', event: 'click', emailKey: 'cma:deer' })
    expect(res.ok).toBe(true)
    const row = mockInsert.mock.calls[0][0]
    expect(row.person_id).toBe(7)
    expect(row.recipient_email).toBe('')
    // No recipient -> dedupe anchored on the person.
    expect(row.dedupe_key).toBe('cma:deer:click:p:7')
  })

  it('Gmail rail: a pixel firing twice dedupes to ONE open row (same key)', async () => {
    mockGetPrimaryEmail.mockResolvedValue('a@b.com')
    mockInsert.mockResolvedValueOnce({ ok: true, inserted: true }).mockResolvedValueOnce({ ok: true, inserted: false })
    const first = await recordEmailEvent({ personId: 9, sendType: 'newsletter', event: 'open', emailKey: 'newsletter:x' })
    const second = await recordEmailEvent({ personId: 9, sendType: 'newsletter', event: 'open', emailKey: 'newsletter:x' })
    expect(first.ok && first.inserted).toBe(true)
    expect(second.ok && (second as { inserted: boolean }).inserted).toBe(false)
    expect(mockInsert.mock.calls[0][0].dedupe_key).toBe(mockInsert.mock.calls[1][0].dedupe_key)
  })

  it('propagates a DAL write failure as a result flag (never throws)', async () => {
    mockGetPersonIds.mockResolvedValue([7])
    mockInsert.mockResolvedValue({ ok: false, error: 'db down' })
    const res = await recordEmailEvent({ recipientEmail: 'a@b.com', sendType: 'alert', event: 'bounce' })
    expect(res).toEqual({ ok: false, error: 'db down' })
  })
})
