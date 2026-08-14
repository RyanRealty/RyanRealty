/**
 * @vitest-environment jsdom
 *
 * Cookie notice occupancy — first-screen 390 must show the page's thing.
 * Accept all is never a first-viewport filled primary. The legal contract
 * (Accept all / Essential only / Preferences, privacy links, ad auto-grant,
 * ryan_realty_cookie_consent) stays intact after the visitor has seen the thing.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import CookieConsentBanner, {
  COOKIE_NOTICE_FOLD_DELAY_MS,
  COOKIE_NOTICE_SCROLL_PX,
  autoGrantConsentForAdTraffic,
  getStoredConsent,
  nextCookieNoticeSurface,
} from './CookieConsentBanner'

const SRC = join(process.cwd(), 'components/CookieConsentBanner.tsx')

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string
    children: React.ReactNode
    className?: string
  }) => React.createElement('a', { href, ...props }, children),
}))

class NoopResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
;(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver ??= NoopResizeObserver
;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

function installCookieJar() {
  let jar = ''
  Object.defineProperty(document, 'cookie', {
    configurable: true,
    get: () => jar,
    set: (value: string) => {
      const name = value.split('=')[0]
      const parts = jar.split('; ').filter((part) => part && !part.startsWith(`${name}=`))
      if (!/expires=Thu, 01 Jan 1970/i.test(value)) {
        parts.push(value.split(';')[0])
      }
      jar = parts.filter(Boolean).join('; ')
    },
  })
  return {
    clear() {
      jar = ''
    },
  }
}

const cookies = installCookieJar()

describe('nextCookieNoticeSurface', () => {
  it('keeps the first screen empty on mount', () => {
    expect(nextCookieNoticeSurface('hidden', 'mount', false)).toBe('hidden')
  })

  it('never shows a surface when consent is already stored', () => {
    expect(nextCookieNoticeSurface('hidden', 'delay', true)).toBe('hidden')
    expect(nextCookieNoticeSurface('hidden', 'scroll', true)).toBe('hidden')
    expect(nextCookieNoticeSurface('chip', 'open-bar', true)).toBe('hidden')
  })

  it('delay without scroll earns only the chip, not the filled bar', () => {
    expect(nextCookieNoticeSurface('hidden', 'delay', false)).toBe('chip')
  })

  it('first scroll earns the legal bar after the thing has been seen', () => {
    expect(nextCookieNoticeSurface('hidden', 'scroll', false)).toBe('bar')
    expect(nextCookieNoticeSurface('chip', 'scroll', false)).toBe('bar')
  })

  it('opening the chip expands to the legal bar', () => {
    expect(nextCookieNoticeSurface('chip', 'open-bar', false)).toBe('bar')
  })

  it('a choice or an auto-grant hides every surface', () => {
    expect(nextCookieNoticeSurface('bar', 'chosen', false)).toBe('hidden')
    expect(nextCookieNoticeSurface('chip', 'consent-recorded', false)).toBe('hidden')
  })

  it('delay after scroll does not demote the bar back to a chip', () => {
    expect(nextCookieNoticeSurface('bar', 'delay', false)).toBe('bar')
  })
})

describe('CookieConsentBanner occupancy', () => {
  let container: HTMLDivElement
  let root: Root | null = null

  async function mount() {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    await act(async () => {
      root!.render(React.createElement(CookieConsentBanner))
    })
  }

  function unmount() {
    if (!root) return
    const current = root
    root = null
    act(() => current.unmount())
    container.remove()
  }

  beforeEach(() => {
    cookies.clear()
    vi.useFakeTimers()
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 0, writable: true })
  })

  afterEach(() => {
    unmount()
    vi.useRealTimers()
    cookies.clear()
  })

  it('renders nothing on the first screen before scroll or delay', async () => {
    await mount()
    expect(container.querySelector('[data-cookie-notice]')).toBeNull()
    expect(container.textContent).not.toContain('Accept all')
    expect(container.textContent).not.toContain('Cookies')
  })

  it('after 3s without scroll shows a chip, not a filled Accept all', async () => {
    await mount()
    await act(async () => {
      vi.advanceTimersByTime(COOKIE_NOTICE_FOLD_DELAY_MS)
    })
    const notice = container.querySelector('[data-cookie-notice="chip"]')
    expect(notice).not.toBeNull()
    expect(container.querySelector('[data-cookie-notice="bar"]')).toBeNull()
    expect(container.textContent).toContain('Cookies')
    expect(container.textContent).not.toContain('Accept all')
  })

  it('chip expands to the legal contract: Accept all, Essential only, Preferences, privacy links', async () => {
    await mount()
    await act(async () => {
      vi.advanceTimersByTime(COOKIE_NOTICE_FOLD_DELAY_MS)
    })
    const chip = container.querySelector('button')
    expect(chip?.textContent).toBe('Cookies')
    await act(async () => {
      chip?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(container.querySelector('[data-cookie-notice="bar"]')).not.toBeNull()
    expect(container.textContent).toContain('Accept all')
    expect(container.textContent).toContain('Essential only')
    expect(container.textContent).toContain('Preferences')
    expect(container.innerHTML).toContain('/privacy')
    expect(container.innerHTML).toContain('/privacy#donotsell')
  })

  it('first scroll reveals the legal bar and Accept all writes the consent cookie', async () => {
    await mount()
    Object.defineProperty(window, 'scrollY', { configurable: true, value: COOKIE_NOTICE_SCROLL_PX, writable: true })
    await act(async () => {
      window.dispatchEvent(new Event('scroll'))
    })
    expect(container.querySelector('[data-cookie-notice="bar"]')).not.toBeNull()
    const accept = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Accept all')
    expect(accept).toBeTruthy()
    await act(async () => {
      accept?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(getStoredConsent()).toEqual({ analytics: true, marketing: true })
    expect(container.querySelector('[data-cookie-notice]')).toBeNull()
  })

  it('Essential only writes a declined cookie and hides the notice', async () => {
    await mount()
    Object.defineProperty(window, 'scrollY', { configurable: true, value: COOKIE_NOTICE_SCROLL_PX, writable: true })
    await act(async () => {
      window.dispatchEvent(new Event('scroll'))
    })
    const essential = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Essential only')
    await act(async () => {
      essential?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(getStoredConsent()).toEqual({ analytics: false, marketing: false })
    expect(container.querySelector('[data-cookie-notice]')).toBeNull()
  })

  it('stays hidden when ryan_realty_cookie_consent is already stored', async () => {
    document.cookie = `ryan_realty_cookie_consent=${encodeURIComponent(JSON.stringify({ analytics: true, marketing: true }))}`
    await mount()
    await act(async () => {
      vi.advanceTimersByTime(COOKIE_NOTICE_FOLD_DELAY_MS)
      window.dispatchEvent(new Event('scroll'))
    })
    expect(container.querySelector('[data-cookie-notice]')).toBeNull()
    expect(container.textContent).not.toContain('Accept all')
  })

  it('hides when a later cookie-consent event records a choice', async () => {
    await mount()
    await act(async () => {
      vi.advanceTimersByTime(COOKIE_NOTICE_FOLD_DELAY_MS)
    })
    expect(container.querySelector('[data-cookie-notice="chip"]')).not.toBeNull()
    document.cookie = `ryan_realty_cookie_consent=${encodeURIComponent(JSON.stringify({ analytics: true, marketing: true }))}`
    await act(async () => {
      window.dispatchEvent(new CustomEvent('cookie-consent', { detail: 'all' }))
    })
    expect(container.querySelector('[data-cookie-notice]')).toBeNull()
  })
})

describe('autoGrantConsentForAdTraffic', () => {
  beforeEach(() => {
    cookies.clear()
  })

  afterEach(() => {
    cookies.clear()
    vi.unstubAllGlobals()
  })

  it('grants analytics and marketing on utm traffic with no prior choice', () => {
    vi.stubGlobal('location', new URL('https://ryan-realty.com/?utm_source=facebook'))
    expect(autoGrantConsentForAdTraffic()).toBe(true)
    expect(getStoredConsent()).toEqual({ analytics: true, marketing: true })
  })

  it('does not override an explicit essential-only choice', () => {
    document.cookie = `ryan_realty_cookie_consent=${encodeURIComponent(JSON.stringify({ analytics: false, marketing: false }))}`
    vi.stubGlobal('location', new URL('https://ryan-realty.com/?fbclid=TEST'))
    expect(autoGrantConsentForAdTraffic()).toBe(false)
    expect(getStoredConsent()).toEqual({ analytics: false, marketing: false })
  })
})

describe('CookieConsentBanner source contract', () => {
  const src = readFileSync(SRC, 'utf8')

  it('keeps the stored cookie key and the three legal actions', () => {
    expect(src).toContain("const COOKIE_CONSENT_KEY = 'ryan_realty_cookie_consent'")
    expect(src).toContain('Accept all')
    expect(src).toContain('Essential only')
    expect(src).toContain('Preferences')
    expect(src).toContain('href="/privacy"')
    expect(src).toContain('href="/privacy#donotsell"')
    expect(src).toContain('export function autoGrantConsentForAdTraffic')
  })

  it('does not paint the bar on mount and delays the chip past the first screen', () => {
    expect(COOKIE_NOTICE_FOLD_DELAY_MS).toBe(3000)
    expect(COOKIE_NOTICE_SCROLL_PX).toBe(24)
    expect(src).toContain("useState<CookieNoticeSurface>('hidden')")
    expect(src).toContain("data-cookie-notice=\"chip\"")
    expect(src).toContain("data-cookie-notice=\"bar\"")
    expect(src).not.toMatch(/if \(consent === null\) setVisible\(true\)/)
  })

  it('uses shadcn controls and tokens, not a raw button or a filled chip', () => {
    expect(src).toContain('from "@/components/ui/button"')
    expect(src).toContain('from "@/components/ui/dialog"')
    expect(src).toContain('from "@/components/ui/checkbox"')
    expect(src).toContain('from "@/components/ui/label"')
    expect(src).toContain("from '@/lib/utils'")
    expect(src).toContain('variant="outline"')
    expect(src).not.toMatch(/<button/)
    expect(src).not.toMatch(/#[0-9a-fA-F]{3,8}/)
  })
})
