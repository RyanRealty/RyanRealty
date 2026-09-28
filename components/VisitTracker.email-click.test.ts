/**
 * @vitest-environment jsdom
 *
 * A tracked email click landing on /sell with no banner answer ('essential')
 * must still post page_view: location.href (utm kept; _pid already stripped
 * by PersonIdentityBridge) plus identityToken from takeArrivalToken.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

vi.mock('next/navigation', () => ({
  usePathname: () => '/sell',
}))
vi.mock('@/app/actions/track-user-event', () => ({
  trackUserEvent: vi.fn(),
}))

import { fireFirstPartyEvent } from './VisitTracker'

const SRC = readFileSync(join(process.cwd(), 'components/VisitTracker.tsx'), 'utf8')
const SELL =
  '/sell?from=cma&utm_source=cma&utm_medium=email&utm_campaign=cma-zz-postland-20260928&utm_content=agent-matt&agent=matt'
const TOKEN = '13168.document.abcdefghijklmnopqrstuv'
const SID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'

describe('VisitTracker source — essential consent still posts', () => {
  it('treats a missing banner answer as essential, not declined', () => {
    expect(SRC).toContain("if (stored === null) return 'essential'")
    expect(SRC).toContain("if (consent === 'declined') return")
    expect(SRC).toContain('pageUrl: window.location.href')
    expect(SRC).toContain('identityToken: takeArrivalToken()')
    expect(SRC).toContain("if (consentLevel() !== 'declined'")
  })
})

describe('VisitTracker — essential email click on /sell', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) })
    vi.stubGlobal('fetch', fetchMock)
    document.cookie.split(';').forEach((c) => {
      const name = c.split('=')[0]?.trim()
      if (name) document.cookie = `${name}=; path=/; max-age=0`
    })
    localStorage.clear()
    sessionStorage.clear()
    localStorage.setItem('rr_session_id', SID)
    sessionStorage.setItem('rr_pid_token', TOKEN)
    window.history.replaceState({}, '', SELL)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    localStorage.clear()
    sessionStorage.clear()
    window.history.replaceState({}, '', '/')
  })

  it('posts page_view with href (utm kept) and identityToken from the stash', () => {
    fireFirstPartyEvent('page_view')
    expect(fetchMock).toHaveBeenCalled()
    const call = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(call[0]).toBe('/api/visitors/track')
    const body = JSON.parse(String(call[1].body)) as Record<string, unknown>
    expect(body.consent).toBe('essential')
    expect(body.eventType).toBe('page_view')
    const pageUrl = String(body.pageUrl)
    expect(pageUrl).toContain('/sell')
    expect(pageUrl).toContain('from=cma')
    expect(pageUrl).toContain('utm_source=cma')
    expect(pageUrl).toContain('utm_medium=email')
    expect(pageUrl).toContain('utm_campaign=cma-zz-postland-20260928')
    expect(pageUrl).not.toContain('_pid=')
    expect(body.identityToken).toBe(TOKEN)
    expect(body.campaign).toMatchObject({
      source: 'cma',
      medium: 'email',
      campaign: 'cma-zz-postland-20260928',
    })
  })

  it('does not post when the banner answer is an explicit decline', () => {
    document.cookie = `ryan_realty_cookie_consent=${encodeURIComponent(JSON.stringify({ analytics: false, marketing: false }))}; path=/`
    fireFirstPartyEvent('page_view')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
