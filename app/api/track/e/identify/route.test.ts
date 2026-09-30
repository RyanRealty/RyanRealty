/**
 * GET /api/track/e/identify, the identify ping public/rr-doc-tracker.js sends
 * from a client document. A GET carries no body, so a scripted browser with an
 * ordinary user agent could not say what it is: the script now adds
 * `webdriver=1` when navigator.webdriver is set, and the route passes it to the
 * identify action, which refuses the request (review of 2026-09-30). The action's
 * own refusal is pinned in app/actions/identity-bridge.test.ts.
 */
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const actions = vi.hoisted(() => ({
  native: vi.fn(async () => ({ ok: true })),
  legacy: vi.fn(async () => ({ ok: false })),
}))
vi.mock('@/app/actions/identity-bridge', () => ({
  identifyPersonFromEmailClickNative: actions.native,
  identifyPersonFromEmailClick: actions.legacy,
}))

import { GET } from './route'

const SID = '3f1c2d4e-5a6b-4c7d-8e9f-0a1b2c3d4e5f'
const get = (qs: string) => GET(new NextRequest(`https://ryan-realty.com/api/track/e/identify?${qs}`))

beforeEach(() => {
  actions.native.mockClear()
  actions.legacy.mockClear()
})

describe('/api/track/e/identify', () => {
  it('passes the browser automation signal to the identify action', async () => {
    const res = await get(`_pid=64115.document.sig&sid=${SID}&webdriver=1`)
    expect(res.status).toBe(204)
    expect(actions.native).toHaveBeenCalledWith('64115.document.sig', SID, { webdriver: true })
  })

  it('a ping without the flag is a browser that did not report one', async () => {
    await get(`_pid=64115.document.sig&sid=${SID}`)
    expect(actions.native).toHaveBeenCalledWith('64115.document.sig', SID, { webdriver: false })
    await get(`_pid=64115.document.sig&sid=${SID}&webdriver=0`)
    expect(actions.native).toHaveBeenLastCalledWith('64115.document.sig', SID, { webdriver: false })
  })

  it('always answers 204, and a retired _fuid still goes to the action that refuses it', async () => {
    const res = await get(`_fuid=22288&sid=${SID}&webdriver=1`)
    expect(res.status).toBe(204)
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(actions.legacy).toHaveBeenCalledWith('22288', SID)
    expect(actions.native).not.toHaveBeenCalled()
  })
})
