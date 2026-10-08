import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { encodeConsent } from '@/test/consent-fixtures'

const send = vi.hoisted(() => vi.fn(async () => ({ ok: true })))

vi.mock('@/lib/meta-capi', () => ({
  sendServerEvent: (...args: unknown[]) => send(...args),
}))
vi.mock('@/lib/data/crm/getPersonIdsByEmail', () => ({ getPersonIdsByEmail: vi.fn(async () => []) }))
vi.mock('@/lib/data/crm/getPersonSuppressions', () => ({ getPersonSuppressions: vi.fn(async () => []) }))
vi.mock('@/lib/data/crm/getStitchedCrmPersonId', () => ({ getStitchedCrmPersonId: vi.fn(async () => null) }))

import { POST } from './route'

function req(opts: { cookie?: string; secGpc?: string; body?: Record<string, unknown> }) {
  const headers: Record<string, string> = { 'content-type': 'application/json', origin: 'https://ryan-realty.com' }
  if (opts.cookie) headers.cookie = opts.cookie
  if (opts.secGpc) headers['sec-gpc'] = opts.secGpc
  return new NextRequest('https://ryan-realty.com/api/meta-capi', {
    method: 'POST',
    headers,
    body: JSON.stringify({ eventName: 'Lead', ...(opts.body ?? {}) }),
  })
}

describe('POST /api/meta-capi marketing gate', () => {
  beforeEach(() => {
    send.mockClear()
  })

  it('does not send without an explicit marketing grant', async () => {
    const res = await POST(req({}))
    const json = await res.json()
    expect(json.skipped).toBe('no-marketing-consent')
    expect(send).not.toHaveBeenCalled()
  })

  it('does not send on a US-style analytics-only cookie', async () => {
    const res = await POST(
      req({ cookie: `ryan_realty_cookie_consent=${encodeConsent({ analytics: true, marketing: false })}` }),
    )
    expect((await res.json()).skipped).toBe('no-marketing-consent')
    expect(send).not.toHaveBeenCalled()
  })

  it('does not send under Sec-GPC even with a stored marketing accept', async () => {
    const res = await POST(
      req({
        cookie: `ryan_realty_cookie_consent=${encodeConsent({ analytics: true, marketing: true })}`,
        secGpc: '1',
      }),
    )
    expect((await res.json()).skipped).toBe('no-marketing-consent')
    expect(send).not.toHaveBeenCalled()
  })

  it('sends when marketing is granted and GPC is off', async () => {
    const res = await POST(
      req({ cookie: `ryan_realty_cookie_consent=${encodeConsent({ analytics: true, marketing: true })}` }),
    )
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.skipped).toBeUndefined()
    expect(send).toHaveBeenCalledOnce()
  })
})
