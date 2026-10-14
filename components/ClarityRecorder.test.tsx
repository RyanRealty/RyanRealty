/**
 * @vitest-environment jsdom
 *
 * ClarityRecorder through the real consent helpers (hasAnalyticsConsent, the
 * rule GA4's consent update uses): the tag loads only for a consenting outside
 * visitor on a public page, and a withdrawal stops it without a reload.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'

const nav = vi.hoisted(() => ({ path: '/homes-for-sale/bend', search: '', projectId: 'abc123def4' as string | null }))

vi.mock('next/navigation', () => ({
  usePathname: () => nav.path,
  useSearchParams: () => new URLSearchParams(nav.search),
}))

vi.mock('@/lib/analytics/clarity', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/analytics/clarity')>()
  return {
    ...mod,
    get CLARITY_PROJECT_ID() {
      return nav.projectId
    },
  }
})

import ClarityRecorder from './ClarityRecorder'
import { resetClarityRuntime } from '@/lib/analytics/clarity'

;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const CHROME_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36'

let root: Root | null = null
let host: HTMLDivElement | null = null

function clearCookies() {
  for (const part of document.cookie.split(';')) {
    const name = part.split('=')[0]?.trim()
    if (name) document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`
  }
}

function setPage(path: string, search = '') {
  nav.path = path
  nav.search = search
  vi.stubGlobal('location', new URL(`https://ryan-realty.com${path}${search}`))
}

function consentCookie(analytics: boolean, marketing: boolean) {
  document.cookie = `ryan_realty_cookie_consent=${encodeURIComponent(JSON.stringify({ analytics, marketing, v: 2 }))}; path=/`
}

async function mount() {
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  await act(async () => {
    root!.render(<ClarityRecorder />)
  })
}

async function rerender() {
  await act(async () => {
    root!.render(<ClarityRecorder />)
  })
}

function tag(): HTMLScriptElement | null {
  return document.querySelector('script#clarity-script')
}

function queue(): unknown[][] {
  const fn = (window as { clarity?: { q?: ArrayLike<unknown>[] } }).clarity
  return (fn?.q ?? []).map((a) => Array.from(a))
}

beforeEach(() => {
  resetClarityRuntime()
  clearCookies()
  delete (window as { clarity?: unknown }).clarity
  document.head.innerHTML = ''
  nav.projectId = 'abc123def4'
  setPage('/homes-for-sale/bend')
  Object.defineProperty(navigator, 'userAgent', { configurable: true, value: CHROME_UA })
  Object.defineProperty(navigator, 'globalPrivacyControl', { configurable: true, value: undefined })
})

afterEach(async () => {
  if (root) {
    await act(async () => {
      root!.unmount()
    })
  }
  root = null
  host?.remove()
  host = null
  vi.unstubAllGlobals()
  resetClarityRuntime()
})

describe('ClarityRecorder: when the tag loads', () => {
  it('loads nothing while CLARITY_PROJECT_ID is null', async () => {
    nav.projectId = null
    document.cookie = 'rr_cr=0; path=/'
    await mount()
    expect(tag()).toBeNull()
    expect((window as { clarity?: unknown }).clarity).toBeUndefined()
  })

  it('loads for a US visitor with no banner answer (analytics on by default)', async () => {
    document.cookie = 'rr_cr=0; path=/'
    await mount()
    expect(tag()?.src).toBe('https://www.clarity.ms/tag/abc123def4')
    expect(queue()[0]).toEqual(['consentv2', { ad_Storage: 'denied', analytics_Storage: 'granted' }])
  })

  it('does not load in a restricted region, or with no region cookie, until the visitor accepts', async () => {
    document.cookie = 'rr_cr=1; path=/'
    await mount()
    expect(tag()).toBeNull()
    document.cookie = 'rr_cr=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/'
    await rerender()
    expect(tag()).toBeNull()
    document.cookie = 'rr_cr=1; path=/'
    consentCookie(true, true)
    await act(async () => {
      window.dispatchEvent(new CustomEvent('cookie-consent', { detail: 'all' }))
    })
    expect(tag()).not.toBeNull()
    expect(queue()[0]).toEqual(['consentv2', { ad_Storage: 'granted', analytics_Storage: 'granted' }])
  })

  it('does not load after a decline', async () => {
    document.cookie = 'rr_cr=0; path=/'
    consentCookie(false, false)
    await mount()
    expect(tag()).toBeNull()
  })

  it('does not load under Global Privacy Control, even after an accept', async () => {
    Object.defineProperty(navigator, 'globalPrivacyControl', { configurable: true, value: true })
    document.cookie = 'rr_cr=0; path=/'
    consentCookie(true, true)
    await mount()
    expect(tag()).toBeNull()
  })

  it("does not load in a broker's browser", async () => {
    document.cookie = 'rr_cr=0; path=/'
    document.cookie = 'rr_internal=1; path=/'
    await mount()
    expect(tag()).toBeNull()
  })

  it('does not load on a private page or a personal area', async () => {
    document.cookie = 'rr_cr=0; path=/'
    for (const path of ['/sign/abcdefgh12345', '/account/profile', '/dashboard', '/admin/crm']) {
      setPage(path)
      resetClarityRuntime()
      await mount()
      expect(tag(), path).toBeNull()
      await act(async () => {
        root!.unmount()
      })
      root = null
    }
  })

  it('waits until the person token is gone from the address', async () => {
    document.cookie = 'rr_cr=0; path=/'
    setPage('/homes-for-sale/bend', '?_pid=12.email.abcdef')
    await mount()
    expect(tag()).toBeNull()
    setPage('/homes-for-sale/bend')
    await rerender()
    expect(tag()).not.toBeNull()
  })
})

describe('ClarityRecorder: after it loads', () => {
  it('a decline sends the denial and a stop, and the page is not reloaded', async () => {
    document.cookie = 'rr_cr=0; path=/'
    await mount()
    consentCookie(false, false)
    await act(async () => {
      window.dispatchEvent(new CustomEvent('cookie-consent', { detail: 'essential' }))
    })
    const q = queue()
    expect(q.slice(-2)).toEqual([['consentv2', { ad_Storage: 'denied', analytics_Storage: 'denied' }], ['stop']])
    expect(document.querySelectorAll('script#clarity-script')).toHaveLength(1)
    // Accepting again on the same page does not restart it; the next page load decides.
    consentCookie(true, true)
    await act(async () => {
      window.dispatchEvent(new CustomEvent('cookie-consent', { detail: 'all' }))
    })
    expect(queue()).toHaveLength(q.length)
  })

  it('halts on a personal area and starts again on a public page', async () => {
    document.cookie = 'rr_cr=0; path=/'
    await mount()
    setPage('/account/saved-homes')
    await rerender()
    expect(queue().at(-1)).toEqual(['stop'])
    setPage('/homes-for-sale/redmond')
    await rerender()
    expect(queue().slice(-2)).toEqual([['start'], ['consentv2', { ad_Storage: 'denied', analytics_Storage: 'granted' }]])
  })

  it('stops when it unmounts (a walk into /admin)', async () => {
    document.cookie = 'rr_cr=0; path=/'
    await mount()
    await act(async () => {
      root!.unmount()
    })
    root = null
    expect(queue().at(-1)).toEqual(['stop'])
  })
})
