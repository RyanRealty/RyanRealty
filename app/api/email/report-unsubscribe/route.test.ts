import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const applyReportPreference = vi.fn()
vi.mock('@/lib/crm/market-report-preferences', () => ({
  applyReportPreference: (...a: unknown[]) => applyReportPreference(...a),
}))

import { GET, POST } from './route'
import { signReportLinkToken, verifyReportLinkToken } from '@/lib/email/report-link-token'

function req(qs: string, method: 'GET' | 'POST' = 'POST') {
  return new NextRequest(`https://ryan-realty.com/api/email/report-unsubscribe${qs}`, {
    method,
    ...(method === 'POST'
      ? { body: 'List-Unsubscribe=One-Click', headers: { 'content-type': 'application/x-www-form-urlencoded' } }
      : {}),
  })
}

beforeEach(() => applyReportPreference.mockReset())

describe('POST /api/email/report-unsubscribe (RFC 8058 one-click, report only)', () => {
  it('stops the market report with the one-click link and answers 200', async () => {
    applyReportPreference.mockResolvedValue({ ok: true, changed: true, done: 'stopped' })
    const res = await POST(req('?t=stop.tok'))
    expect(res.status).toBe(200)
    expect(applyReportPreference).toHaveBeenCalledWith('stop.tok', { kind: 'stop' }, 'one-click')
    expect(await res.text()).toContain('Other email from Ryan Realty is not affected')
    expect(res.headers.get('cache-control')).toContain('no-store')
    expect(res.headers.get('x-robots-tag')).toContain('noindex')
  })

  it('a bad link is a 400 and a misconfigured secret a 503, never a silent 200', async () => {
    applyReportPreference.mockResolvedValue({ ok: false, error: 'link' })
    expect((await POST(req('?t=bad'))).status).toBe(400)
    applyReportPreference.mockResolvedValue({ ok: false, error: 'unavailable' })
    expect((await POST(req('?t=x'))).status).toBe(503)
  })
})

describe('GET /api/email/report-unsubscribe (a scanner prefetch never stops anything)', () => {
  it('sends the reader to the preferences page, opened on "Stop these reports"', async () => {
    const stop = signReportLinkToken({ personId: 64138, subscriptionId: 9016, purpose: 'stop', emailKey: 'k1' })
    const res = await GET(req(`?t=${encodeURIComponent(stop)}`, 'GET'))
    expect(applyReportPreference).not.toHaveBeenCalled()
    expect(res.status).toBe(303)
    const to = new URL(res.headers.get('location') ?? '')
    expect(to.pathname).toBe('/email-preferences')
    expect(to.searchParams.get('stop')).toBe('1')
    expect(verifyReportLinkToken(to.searchParams.get('t'))).toMatchObject({ personId: 64138, subscriptionId: 9016, purpose: 'manage', emailKey: 'k1' })
  })

  it('a manage or view token does not pass for a stop link', async () => {
    const manage = signReportLinkToken({ personId: 1, purpose: 'manage' })
    const res = await GET(req(`?t=${encodeURIComponent(manage)}`, 'GET'))
    expect(new URL(res.headers.get('location') ?? '').searchParams.get('error')).toBe('link')
  })
})
