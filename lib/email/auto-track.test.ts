import { beforeEach, describe, expect, it, vi } from 'vitest'

const getPersonIdsByEmail = vi.fn()

vi.mock('@/lib/data/crm/getPersonIdsByEmail', () => ({
  getPersonIdsByEmail: (...args: unknown[]) => getPersonIdsByEmail(...args),
}))

import {
  instrumentLeadHtml,
  isInternalOutboundRecipient,
  resolveTrackablePersonId,
} from './auto-track'

describe('isInternalOutboundRecipient', () => {
  it('skips broker Workspace mailboxes', () => {
    expect(isInternalOutboundRecipient('matt@ryan-realty.com')).toBe(true)
    expect(isInternalOutboundRecipient('paul@ryan-realty.com')).toBe(true)
    expect(isInternalOutboundRecipient('rebeccapeterson@ryan-realty.com')).toBe(true)
  })

  it('does not skip lead and alias addresses', () => {
    expect(isInternalOutboundRecipient('alex@example.com')).toBe(false)
    expect(isInternalOutboundRecipient('marketing+blake@ryan-realty.com')).toBe(false)
  })
})

describe('resolveTrackablePersonId', () => {
  beforeEach(() => {
    getPersonIdsByEmail.mockReset()
  })

  it('returns null for an internal mailbox without looking up', async () => {
    await expect(resolveTrackablePersonId('matt@ryan-realty.com')).resolves.toBeNull()
    expect(getPersonIdsByEmail).not.toHaveBeenCalled()
  })

  it('returns the id when exactly one CRM person owns the address', async () => {
    getPersonIdsByEmail.mockResolvedValue([63425])
    await expect(resolveTrackablePersonId('marketing+blake@ryan-realty.com')).resolves.toBe(63425)
  })

  it('returns null when the address is shared across people', async () => {
    getPersonIdsByEmail.mockResolvedValue([1, 2])
    await expect(resolveTrackablePersonId('shared@example.com')).resolves.toBeNull()
  })
})

describe('instrumentLeadHtml', () => {
  beforeEach(() => {
    getPersonIdsByEmail.mockReset()
  })

  it('wraps links when personId is passed, with no lookup', async () => {
    const html = '<a href="https://ryan-realty.com/homes-for-sale">Browse</a>'
    const out = await instrumentLeadHtml(html, {
      to: 'lead@example.com',
      subject: 'Hello',
      personId: 42,
      emailKey: 'test:42',
      brokerSlug: 'matt',
    })
    expect(out).toContain('/api/track/e/click')
    expect(out).toContain('/api/track/e/open')
    expect(getPersonIdsByEmail).not.toHaveBeenCalled()
  })

  it('looks up a unique lead and wraps when the caller omitted personId', async () => {
    getPersonIdsByEmail.mockResolvedValue([99])
    const html = '<a href="https://ryan-realty.com/cma/sample">Open</a>'
    const out = await instrumentLeadHtml(html, {
      to: 'lead@example.com',
      subject: 'Sign',
    })
    expect(out).toContain('/api/track/e/click')
    expect(getPersonIdsByEmail).toHaveBeenCalledWith('lead@example.com')
  })

  it('leaves already-instrumented HTML untouched (no second wrap, no lookup)', async () => {
    const html = '<a href="https://ryan-realty.com/api/track/e/click?t=abc">x</a>'
    const out = await instrumentLeadHtml(html, { to: 'lead@example.com', subject: 'Hi', personId: 1 })
    expect(out).toBe(html)
    expect(getPersonIdsByEmail).not.toHaveBeenCalled()
  })

  it('does not wrap internal broker mail', async () => {
    const html = '<a href="https://ryan-realty.com/admin/crm">Open</a>'
    const out = await instrumentLeadHtml(html, {
      to: 'matt@ryan-realty.com',
      subject: 'Digest',
    })
    expect(out).toBe(html)
    expect(getPersonIdsByEmail).not.toHaveBeenCalled()
  })
})
