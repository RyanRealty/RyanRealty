/**
 * Public newsletter signup — identity stitch (A12 / D4).
 *
 * Doubles: DAL, stitch, cookies, rate-limit. Never hits production CRM.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const subscribeToNewsletter = vi.fn()
vi.mock('@/lib/data', () => ({
  subscribeToNewsletter: (...args: unknown[]) => subscribeToNewsletter(...args),
}))

const ensureNativeLead = vi.fn()
vi.mock('@/lib/data/crm/ensureNativeLead', () => ({
  ensureNativeLead: (...args: unknown[]) => ensureNativeLead(...args),
}))

const tagNativeLead = vi.fn()
vi.mock('@/lib/canonical-lead-tagger', () => ({
  tagNativeLead: (...args: unknown[]) => tagNativeLead(...args),
}))

const stitchFormSubmitIdentity = vi.fn()
vi.mock('@/lib/visitor-backfill', () => ({
  stitchFormSubmitIdentity: (...args: unknown[]) => stitchFormSubmitIdentity(...args),
}))

const cookieGet = vi.fn()
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: cookieGet }),
  headers: async () => ({
    get: () => null,
  }),
}))

vi.mock('@/lib/rate-limit', () => ({
  getAuthLimiter: () => null,
}))

import { subscribeNewsletterAction } from './newsletter-subscribe'

const EMAIL = 'buyer@example.com'
const PERSON_ID = 4242
const SESSION_V4 = '550e8400-e29b-41d4-a716-446655440000'
const RR_VID = 'vid-abc-rr'

function fd(fields: Record<string, string>): FormData {
  const form = new FormData()
  for (const [key, value] of Object.entries(fields)) form.set(key, value)
  return form
}

beforeEach(() => {
  subscribeToNewsletter.mockReset().mockResolvedValue({ ok: true })
  ensureNativeLead.mockReset().mockResolvedValue({ personId: PERSON_ID, created: true })
  tagNativeLead.mockReset().mockResolvedValue({ ok: true })
  stitchFormSubmitIdentity.mockReset().mockResolvedValue(undefined)
  cookieGet.mockReset().mockImplementation((name: string) =>
    name === 'rr_vid' ? { value: RR_VID } : undefined,
  )
})

describe('subscribeNewsletterAction identity stitch', () => {
  it('reuses an existing person on email match and links that crm_person_id', async () => {
    ensureNativeLead.mockResolvedValueOnce({ personId: PERSON_ID, created: false })

    const result = await subscribeNewsletterAction(fd({ email: EMAIL, source: 'site-footer' }))

    expect(result).toEqual({ ok: true })
    expect(ensureNativeLead).toHaveBeenCalledTimes(1)
    expect(ensureNativeLead).toHaveBeenCalledWith(
      expect.objectContaining({ email: EMAIL, source: 'newsletter' }),
    )
    expect(subscribeToNewsletter).toHaveBeenCalledTimes(1)
    expect(subscribeToNewsletter).toHaveBeenCalledWith(
      expect.objectContaining({ email: EMAIL, crmPersonId: PERSON_ID }),
    )
  })

  it('creates a new person once and links that crm_person_id', async () => {
    ensureNativeLead.mockResolvedValueOnce({ personId: 99, created: true })

    const result = await subscribeNewsletterAction(fd({ email: 'new@example.com', source: 'site-footer' }))

    expect(result).toEqual({ ok: true })
    expect(ensureNativeLead).toHaveBeenCalledTimes(1)
    expect(subscribeToNewsletter).toHaveBeenCalledTimes(1)
    expect(subscribeToNewsletter).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'new@example.com', crmPersonId: 99 }),
    )
  })

  it('honeypot short-circuits with ok:true and no writes', async () => {
    const result = await subscribeNewsletterAction(
      fd({ email: EMAIL, company: 'Acme Bot Farm', source: 'site-footer' }),
    )

    expect(result).toEqual({ ok: true })
    expect(ensureNativeLead).not.toHaveBeenCalled()
    expect(subscribeToNewsletter).not.toHaveBeenCalled()
    expect(stitchFormSubmitIdentity).not.toHaveBeenCalled()
    expect(tagNativeLead).not.toHaveBeenCalled()
  })

  it('calls stitchFormSubmitIdentity with rr_vid and the person id', async () => {
    await subscribeNewsletterAction(fd({ email: EMAIL, source: 'site-footer' }))

    expect(stitchFormSubmitIdentity).toHaveBeenCalledTimes(1)
    expect(stitchFormSubmitIdentity).toHaveBeenCalledWith({
      personId: PERSON_ID,
      email: EMAIL,
      rrVid: RR_VID,
      sessionId: null,
    })
  })

  it('passes a valid uuid v4 sessionId through to stitch', async () => {
    await subscribeNewsletterAction(
      fd({ email: EMAIL, source: 'site-footer', sessionId: SESSION_V4 }),
    )

    expect(stitchFormSubmitIdentity).toHaveBeenCalledTimes(1)
    expect(stitchFormSubmitIdentity).toHaveBeenCalledWith({
      personId: PERSON_ID,
      email: EMAIL,
      rrVid: RR_VID,
      sessionId: SESSION_V4,
    })
  })

  it('does not pass an invalid sessionId through to stitch', async () => {
    await subscribeNewsletterAction(
      fd({ email: EMAIL, source: 'site-footer', sessionId: 'not-a-uuid' }),
    )

    expect(stitchFormSubmitIdentity).toHaveBeenCalledWith({
      personId: PERSON_ID,
      email: EMAIL,
      rrVid: RR_VID,
      sessionId: null,
    })
  })

  it('rejects an invalid email without creating a person', async () => {
    const result = await subscribeNewsletterAction(fd({ email: 'not-an-email', source: 'site-footer' }))

    expect(result).toEqual({ ok: false, error: 'invalid_email' })
    expect(ensureNativeLead).not.toHaveBeenCalled()
    expect(subscribeToNewsletter).not.toHaveBeenCalled()
    expect(stitchFormSubmitIdentity).not.toHaveBeenCalled()
  })
})
