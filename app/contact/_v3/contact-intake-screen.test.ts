/**
 * FUNNEL-1 / FUNNEL-4 (visibility audit 2026-09-22): the contact form carries a
 * honeypot, writes its door as the source, and a submit the intake screen flags
 * gets a person row and nothing else. Mocks only: no CRM write, no send.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  afterCallbacks: [] as Array<() => Promise<void> | void>,
  sendEvent: vi.fn(),
  ensureNativeLead: vi.fn(),
  sendContactNotification: vi.fn(),
  canonicallyTagLead: vi.fn(),
  autoEnrollByPersonId: vi.fn(),
  sendContactConfirmation: vi.fn(),
  stitchFormSubmitIdentity: vi.fn(),
  fireLeadGenerated: vi.fn(),
  recordJoinConversion: vi.fn(),
  tagRecruitJoin: vi.fn(),
  fetch: vi.fn(),
}))

vi.mock('next/server', () => ({ after: (fn: () => Promise<void> | void) => h.afterCallbacks.push(fn) }))
vi.mock('next/headers', () => ({
  cookies: () => Promise.resolve({ get: () => undefined }),
  headers: () => Promise.resolve({ get: () => null }),
}))
vi.mock('@/lib/meta-pixel-helpers', () => ({ generateEventId: () => 'evt-1' }))
vi.mock('@/lib/crm/send-event', () => ({ sendEvent: (...a: unknown[]) => h.sendEvent(...a) }))
vi.mock('@/lib/data/crm/ensureNativeLead', () => ({ ensureNativeLead: (...a: unknown[]) => h.ensureNativeLead(...a) }))
vi.mock('@/lib/resend', () => ({ sendContactNotification: (...a: unknown[]) => h.sendContactNotification(...a) }))
vi.mock('@/lib/canonical-lead-tagger', () => ({ canonicallyTagLead: (...a: unknown[]) => h.canonicallyTagLead(...a) }))
vi.mock('@/lib/referral-geo', () => ({ classifyPropertyGeo: () => 'local', referralIntakeTags: () => [] }))
vi.mock('@/lib/visitor-backfill', () => ({ stitchFormSubmitIdentity: (...a: unknown[]) => h.stitchFormSubmitIdentity(...a) }))
vi.mock('@/lib/lead-tracking', () => ({ fireLeadGenerated: (...a: unknown[]) => h.fireLeadGenerated(...a) }))
vi.mock('@/lib/crm/enroll', () => ({ autoEnrollByPersonId: (...a: unknown[]) => h.autoEnrollByPersonId(...a) }))
vi.mock('@/lib/comms/site-confirmations', () => ({
  sendContactConfirmation: (...a: unknown[]) => h.sendContactConfirmation(...a),
}))
vi.mock('@/lib/data/loop/join-conversion', () => ({
  isJoinInquiry: (t: string) => t === 'Join the team',
  recordJoinConversion: (...a: unknown[]) => h.recordJoinConversion(...a),
  tagRecruitJoin: (...a: unknown[]) => h.tagRecruitJoin(...a),
}))

import { submitContactForm } from '../actions'
import { CONTACT_TRAP } from './contact-constants'

function form(fields: Record<string, string>): FormData {
  const fd = new FormData()
  for (const [k, v] of Object.entries(fields)) fd.set(k, v)
  return fd
}

const PERSON = { name: 'Hannah Melotto', email: 'h.melotto@melottogroup.com', message: 'Looking in NW Bend', inquiryType: 'Buying' }

async function drainAfter() {
  for (const fn of h.afterCallbacks.splice(0)) await fn()
}

beforeEach(() => {
  h.afterCallbacks.length = 0
  for (const fn of [
    h.sendEvent,
    h.ensureNativeLead,
    h.sendContactNotification,
    h.canonicallyTagLead,
    h.autoEnrollByPersonId,
    h.sendContactConfirmation,
    h.stitchFormSubmitIdentity,
    h.fireLeadGenerated,
    h.recordJoinConversion,
    h.tagRecruitJoin,
    h.fetch,
  ]) {
    fn.mockReset()
    fn.mockResolvedValue(undefined)
  }
  h.sendEvent.mockResolvedValue({ ok: true, status: 200, personId: 77, suspect: false })
  h.autoEnrollByPersonId.mockResolvedValue({ enrolled: true, sequence: 'Buyer' })
  h.sendContactConfirmation.mockResolvedValue({ ok: true, via: 'unit' })
  h.fetch.mockResolvedValue({ ok: true })
  vi.stubGlobal('fetch', h.fetch)
})

describe('contact form intake', () => {
  it('writes the door as source and screens with an empty trap', async () => {
    const res = await submitContactForm(form({ ...PERSON, [CONTACT_TRAP.name]: '' }))
    expect(res).toEqual({ success: true, eventId: 'evt-1' })
    expect(h.sendEvent.mock.calls[0][0]).toMatchObject({ source: 'contact-form', screen: { honeypot: false } })
    await drainAfter()
    expect(h.canonicallyTagLead).toHaveBeenCalledTimes(1)
    expect(h.autoEnrollByPersonId).toHaveBeenCalledWith(77, { smsConsent: false })
    expect(h.sendContactConfirmation).toHaveBeenCalledTimes(1)
    expect(h.fireLeadGenerated).toHaveBeenCalledTimes(1)
  })

  it("a join inquiry's door is 'join'", async () => {
    await submitContactForm(form({ ...PERSON, inquiryType: 'Join the team' }))
    expect(h.sendEvent.mock.calls[0][0]).toMatchObject({ source: 'join' })
  })

  it('passes a filled trap to the screen', async () => {
    await submitContactForm(form({ ...PERSON, [CONTACT_TRAP.name]: 'Acme Bot Farm' }))
    expect(h.sendEvent.mock.calls[0][0]).toMatchObject({ screen: { honeypot: true } })
  })

  it('a flagged submit gets the same answer and nothing else', async () => {
    h.sendEvent.mockResolvedValueOnce({ ok: true, status: 200, personId: 78, suspect: true })
    const res = await submitContactForm(form({ ...PERSON, name: 'bJSKIwsurKTralgVeDiGblO' }))
    await drainAfter()
    expect(res).toEqual({ success: true })
    expect(h.canonicallyTagLead).not.toHaveBeenCalled()
    expect(h.autoEnrollByPersonId).not.toHaveBeenCalled()
    expect(h.sendContactConfirmation).not.toHaveBeenCalled()
    expect(h.stitchFormSubmitIdentity).not.toHaveBeenCalled()
    expect(h.recordJoinConversion).not.toHaveBeenCalled()
    expect(h.fireLeadGenerated).not.toHaveBeenCalled()
    expect(h.fetch).not.toHaveBeenCalled() // no Meta CAPI Lead
    // The office still sees it, marked.
    expect(h.sendContactNotification.mock.calls[0][0].inquiryType).toMatch(/^Likely script, tagged quality:suspect/)
  })

  it('the capture fallback screens too', async () => {
    h.sendEvent.mockResolvedValueOnce({ ok: false, error: 'db down' })
    h.ensureNativeLead.mockResolvedValueOnce({ personId: 79, created: true, quality: { suspect: true, signals: ['honeypot'] } })
    const res = await submitContactForm(form({ ...PERSON, [CONTACT_TRAP.name]: 'x' }))
    expect(h.ensureNativeLead.mock.calls[0][0]).toMatchObject({
      source: 'contact-form',
      screen: { honeypot: true, note: PERSON.message },
    })
    expect(res).toEqual({ success: true })
  })
})
