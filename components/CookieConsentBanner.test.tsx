/**
 * @vitest-environment jsdom
 *
 * Cookie notice occupancy — first-screen 390 must show the page's thing.
 * Accept all is never a first-viewport filled primary. The legal contract
 * (Decline / Accept all / Choose what to allow, privacy links,
 * ryan_realty_cookie_consent) stays intact after the visitor has seen the thing.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import CookieConsentBanner, {
  CONSENT_CHOICE_BUTTON_CLASS,
  COOKIE_GPC_SETTINGS_COPY,
  COOKIE_NOTICE_BODY,
  COOKIE_NOTICE_FOLD_DELAY_MS,
  COOKIE_NOTICE_HEADING,
  COOKIE_NOTICE_SCROLL_PX,
  CONTEXTUAL_CONSENT_ASK_EVENT,
  OPEN_COOKIE_SETTINGS_EVENT,
  getStoredConsent,
  hasAnalyticsConsent,
  nextCookieNoticeSurface,
} from './CookieConsentBanner'
import { CONSENT_PURPOSES_VERSION, shouldShowConsentPrompt } from '@/lib/identity/consent-prompt'
import { resetSessionMemory } from '@/lib/analytics/visitor-session'

const SRC = join(process.cwd(), 'components/CookieConsentBanner.tsx')
const GLOBALS = join(process.cwd(), 'app/globals.css')

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

function setGpc(on: boolean) {
  Object.defineProperty(navigator, 'globalPrivacyControl', {
    configurable: true,
    value: on ? true : undefined,
  })
}

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

  it('a choice or a recorded consent hides every surface', () => {
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
    localStorage.clear()
    sessionStorage.clear()
    setGpc(false)
    vi.useFakeTimers()
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 0, writable: true })
  })

  afterEach(() => {
    unmount()
    vi.useRealTimers()
    cookies.clear()
    localStorage.clear()
    sessionStorage.clear()
    setGpc(false)
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

  it('chip expands to the legal contract: Decline, Accept all, Choose what to allow, privacy links', async () => {
    await mount()
    await act(async () => {
      vi.advanceTimersByTime(COOKIE_NOTICE_FOLD_DELAY_MS)
    })
    const chip = container.querySelector('[data-cookie-notice="chip"] button')
    expect(chip?.textContent).toBe('Cookies')
    await act(async () => {
      chip?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(container.querySelector('[data-cookie-notice="bar"]')).not.toBeNull()
    expect(container.textContent).toContain('Accept all')
    expect(container.textContent).toContain('Decline')
    expect(container.textContent).toContain('Choose what to allow')
    expect(container.textContent).toContain(COOKIE_NOTICE_HEADING)
    expect(container.textContent).toContain(COOKIE_NOTICE_BODY)
    expect(container.innerHTML).toContain('/privacy')
    expect(container.innerHTML).toContain('/privacy#donotsell')
    expect(container.textContent).not.toContain('Essential only')
    expect(container.textContent).not.toContain('Preferences')
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
    expect(document.cookie).toContain('ryan_realty_cookie_consent=')
    expect(decodeURIComponent(document.cookie)).toContain('"v":')
    expect(container.querySelector('[data-cookie-notice]')).toBeNull()
    expect(container.querySelector('[data-cookie-settings="icon"]')).not.toBeNull()
  })

  it('Decline writes a declined cookie and hides the notice', async () => {
    await mount()
    Object.defineProperty(window, 'scrollY', { configurable: true, value: COOKIE_NOTICE_SCROLL_PX, writable: true })
    await act(async () => {
      window.dispatchEvent(new Event('scroll'))
    })
    const decline = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Decline')
    await act(async () => {
      decline?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(getStoredConsent()).toEqual({ analytics: false, marketing: false })
    expect(container.querySelector('[data-cookie-notice]')).toBeNull()
  })

  it('stays hidden when ryan_realty_cookie_consent is already stored', async () => {
    document.cookie = `ryan_realty_cookie_consent=${encodeURIComponent(JSON.stringify({ analytics: true, marketing: true, v: CONSENT_PURPOSES_VERSION }))}`
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

  it('after X the delay timer does not bring the chip back', async () => {
    await mount()
    Object.defineProperty(window, 'scrollY', { configurable: true, value: COOKIE_NOTICE_SCROLL_PX, writable: true })
    await act(async () => {
      window.dispatchEvent(new Event('scroll'))
    })
    const close = container.querySelector('button[aria-label="Close cookie notice"]')
    await act(async () => {
      close?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    await act(async () => {
      vi.advanceTimersByTime(COOKIE_NOTICE_FOLD_DELAY_MS)
      window.dispatchEvent(new Event('scroll'))
    })
    expect(container.querySelector('[data-cookie-notice]')).toBeNull()
    expect(getStoredConsent()).toBeNull()
  })

  it('closing with X writes no consent cookie', async () => {
    await mount()
    Object.defineProperty(window, 'scrollY', { configurable: true, value: COOKIE_NOTICE_SCROLL_PX, writable: true })
    await act(async () => {
      window.dispatchEvent(new Event('scroll'))
    })
    const close = container.querySelector('button[aria-label="Close cookie notice"]')
    expect(close).not.toBeNull()
    await act(async () => {
      close?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(getStoredConsent()).toBeNull()
    expect(document.cookie).not.toContain('ryan_realty_cookie_consent=')
    expect(container.querySelector('[data-cookie-notice]')).toBeNull()
  })
})

describe('ad click is not consent', () => {
  beforeEach(() => {
    cookies.clear()
    resetSessionMemory()
  })

  afterEach(() => {
    cookies.clear()
    vi.unstubAllGlobals()
  })

  it('does not write the consent cookie on a US gclid or fbclid arrival', () => {
    document.cookie = 'rr_cr=0; path=/'
    vi.stubGlobal('location', new URL('https://ryan-realty.com/?gclid=1&utm_source=google'))
    expect(getStoredConsent()).toBeNull()
    expect(document.cookie).not.toContain('ryan_realty_cookie_consent=')
    vi.stubGlobal('location', new URL('https://ryan-realty.com/?fbclid=TEST'))
    expect(getStoredConsent()).toBeNull()
  })

  it('hasAnalyticsConsent follows the region default when there is no stored answer', () => {
    document.cookie = 'rr_cr=0; path=/'
    expect(hasAnalyticsConsent()).toBe(true)
    document.cookie = 'rr_cr=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/'
    document.cookie = 'rr_cr=1; path=/'
    expect(hasAnalyticsConsent()).toBe(false)
  })

  it('hasAnalyticsConsent is false under GPC even with rr_cr=0', () => {
    Object.defineProperty(navigator, 'globalPrivacyControl', { configurable: true, value: true })
    document.cookie = 'rr_cr=0; path=/'
    expect(hasAnalyticsConsent()).toBe(false)
    Object.defineProperty(navigator, 'globalPrivacyControl', { configurable: true, value: undefined })
  })

  it('never writes a consent cookie for a browser sending Global Privacy Control on an ad click', () => {
    Object.defineProperty(navigator, 'globalPrivacyControl', { configurable: true, value: true })
    const heard = vi.fn()
    window.addEventListener('cookie-consent', heard)
    try {
      vi.stubGlobal('location', new URL('https://ryan-realty.com/?utm_source=facebook&fbclid=TEST'))
      expect(getStoredConsent()).toBeNull()
      expect(heard).not.toHaveBeenCalled()
    } finally {
      window.removeEventListener('cookie-consent', heard)
      Object.defineProperty(navigator, 'globalPrivacyControl', { configurable: true, value: undefined })
    }
  })
})

describe('GPC suppression', () => {
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
    localStorage.clear()
    sessionStorage.clear()
    setGpc(true)
    document.cookie = 'rr_cr=0; path=/'
    vi.useFakeTimers()
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 0, writable: true })
  })

  afterEach(() => {
    unmount()
    vi.useRealTimers()
    cookies.clear()
    localStorage.clear()
    sessionStorage.clear()
    setGpc(false)
  })

  it('never renders the first layer under GPC, including after the contextual-ask event', async () => {
    await mount()
    await act(async () => {
      vi.advanceTimersByTime(COOKIE_NOTICE_FOLD_DELAY_MS)
      Object.defineProperty(window, 'scrollY', { configurable: true, value: COOKIE_NOTICE_SCROLL_PX, writable: true })
      window.dispatchEvent(new Event('scroll'))
      window.dispatchEvent(new CustomEvent(CONTEXTUAL_CONSENT_ASK_EVENT))
    })
    expect(container.querySelector('[data-cookie-notice]')).toBeNull()
    expect(container.textContent).not.toContain('Accept all')
  })

  it('Cookie settings shows the GPC line instead of toggles', async () => {
    await mount()
    await act(async () => {
      window.dispatchEvent(new CustomEvent(OPEN_COOKIE_SETTINGS_EVENT))
    })
    expect(document.body.textContent).toContain(COOKIE_GPC_SETTINGS_COPY)
    expect(document.body.textContent).not.toContain('Analytics: Google')
    expect(document.body.textContent).not.toContain('Save choices')
  })
})

describe('equal button sizing', () => {
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

  async function revealBar() {
    await mount()
    Object.defineProperty(window, 'scrollY', { configurable: true, value: COOKIE_NOTICE_SCROLL_PX, writable: true })
    await act(async () => {
      window.dispatchEvent(new Event('scroll'))
    })
  }

  beforeEach(() => {
    cookies.clear()
    localStorage.clear()
    sessionStorage.clear()
    setGpc(false)
    vi.useFakeTimers()
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 0, writable: true })
  })

  afterEach(() => {
    unmount()
    vi.useRealTimers()
    cookies.clear()
    localStorage.clear()
    sessionStorage.clear()
  })

  it('Decline is first, both share the same size classes, restricted regions are identical, US Decline is a solid fill', async () => {
    await revealBar()
    const decline = container.querySelector('[data-consent-action="decline"]')
    const accept = container.querySelector('[data-consent-action="accept"]')
    expect(decline).not.toBeNull()
    expect(accept).not.toBeNull()
    expect(decline!.compareDocumentPosition(accept!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(decline!.className).toContain(CONSENT_CHOICE_BUTTON_CLASS.split(' ')[0])
    expect(accept!.className).toContain(CONSENT_CHOICE_BUTTON_CLASS.split(' ')[0])
    expect(decline!.className).toContain('w-full')
    expect(accept!.className).toContain('w-full')
    expect(decline!.getAttribute('data-variant')).toBe(accept!.getAttribute('data-variant'))
    expect(decline!.getAttribute('data-variant')).toBe('secondary')
    unmount()

    cookies.clear()
    localStorage.clear()
    sessionStorage.clear()
    document.cookie = 'rr_cr=0; path=/'
    await revealBar()
    const usDecline = container.querySelector('[data-consent-action="decline"]')
    const usAccept = container.querySelector('[data-consent-action="accept"]')
    expect(usDecline!.getAttribute('data-variant')).toBe('secondary')
    expect(usAccept!.getAttribute('data-variant')).toBe('default')
    expect(usDecline!.className).toContain('w-full')
    expect(usAccept!.className).toContain('w-full')
  })

  it('US Decline secondary tokens meet WCAG 4.5:1', () => {
    const css = readFileSync(GLOBALS, 'utf8')
    const secondary = /--secondary:\s*oklch\(([\d.]+)\s+([\d.]+)\s+([\d.]+)\)/.exec(css)
    const secondaryFg = /--secondary-foreground:\s*oklch\(([\d.]+)\s+([\d.]+)\s+([\d.]+)\)/.exec(css)
    expect(secondary).toBeTruthy()
    expect(secondaryFg).toBeTruthy()
    const ratio = contrastRatio(
      oklchToSrgb(+secondaryFg![1], +secondaryFg![2], +secondaryFg![3]),
      oklchToSrgb(+secondary![1], +secondary![2], +secondary![3]),
    )
    expect(ratio).toBeGreaterThanOrEqual(4.5)
  })
})

describe('contextual ask', () => {
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
    localStorage.clear()
    sessionStorage.clear()
    setGpc(false)
    vi.useFakeTimers()
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 0, writable: true })
  })

  afterEach(() => {
    unmount()
    vi.useRealTimers()
    cookies.clear()
    localStorage.clear()
    sessionStorage.clear()
    setGpc(false)
  })

  it('fires once for US no-answer, not for restricted, not under GPC, not after an answer', async () => {
    document.cookie = 'rr_cr=0; path=/'
    await mount()
    await act(async () => {
      window.dispatchEvent(new CustomEvent(CONTEXTUAL_CONSENT_ASK_EVENT))
    })
    expect(container.querySelector('[data-cookie-notice="bar"]')).not.toBeNull()
    const close = container.querySelector('button[aria-label="Close cookie notice"]')
    await act(async () => {
      close?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(container.querySelector('[data-cookie-notice]')).toBeNull()
    await act(async () => {
      window.dispatchEvent(new CustomEvent(CONTEXTUAL_CONSENT_ASK_EVENT))
    })
    expect(container.querySelector('[data-cookie-notice]')).toBeNull()
    unmount()

    cookies.clear()
    localStorage.clear()
    sessionStorage.clear()
    document.cookie = 'rr_cr=1; path=/'
    await mount()
    await act(async () => {
      window.dispatchEvent(new CustomEvent(CONTEXTUAL_CONSENT_ASK_EVENT))
    })
    expect(container.querySelector('[data-cookie-notice]')).toBeNull()
    unmount()

    cookies.clear()
    localStorage.clear()
    sessionStorage.clear()
    document.cookie = 'rr_cr=0; path=/'
    document.cookie = `ryan_realty_cookie_consent=${encodeURIComponent(JSON.stringify({ analytics: true, marketing: true, v: CONSENT_PURPOSES_VERSION }))}`
    await mount()
    await act(async () => {
      window.dispatchEvent(new CustomEvent(CONTEXTUAL_CONSENT_ASK_EVENT))
    })
    expect(container.querySelector('[data-cookie-notice]')).toBeNull()
  })
})

describe('CookieConsentBanner source contract', () => {
  const src = readFileSync(SRC, 'utf8')

  it('keeps the stored cookie key and the two equal first-layer actions', () => {
    expect(src).toContain("const COOKIE_CONSENT_KEY = 'ryan_realty_cookie_consent'")
    expect(src).toContain('Accept all')
    expect(src).toContain('Decline')
    expect(src).toContain('Choose what to allow')
    expect(src).toContain('href="/privacy"')
    expect(src).toContain('href="/privacy#donotsell"')
    expect(src).not.toContain('autoGrantConsentForAdTraffic')
    expect(src).not.toContain('Essential only')
    expect(src).not.toContain('Preferences')
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
    expect(src).toContain('from "@/components/ui/switch"')
    expect(src).toContain('from "@/components/ui/label"')
    expect(src).toContain("from '@/lib/utils'")
    expect(src).toContain('variant="secondary"')
    expect(src).not.toMatch(/<button/)
    expect(src).not.toMatch(/#[0-9a-fA-F]{3,8}/)
  })

  it('re-exports the prompt timing function used by the tests', () => {
    expect(typeof shouldShowConsentPrompt).toBe('function')
    expect(src).toContain('OPEN_COOKIE_SETTINGS_EVENT')
  })

  it('hooks the contextual ask from trackEvent without editing form files', () => {
    const tracking = readFileSync(join(process.cwd(), 'lib/tracking.ts'), 'utf8')
    expect(tracking).toContain('CONTEXTUAL_CONSENT_ASK_EVENT')
    expect(tracking).toContain('isContextualConsentEvent')
  })
})

/** Convert OKLCH (L 0-1, C, H degrees) to sRGB 0-1. */
function oklchToSrgb(L: number, C: number, Hdeg: number): [number, number, number] {
  const Hr = (Hdeg * Math.PI) / 180
  const a = C * Math.cos(Hr)
  const b = C * Math.sin(Hr)
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b
  const l = l_ ** 3
  const m = m_ ** 3
  const s = s_ ** 3
  const rLin = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s
  const gLin = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s
  const bLin = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
  const toSrgb = (c: number) => {
    const x = Math.max(0, Math.min(1, c))
    return x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055
  }
  return [toSrgb(rLin), toSrgb(gLin), toSrgb(bLin)]
}

function relativeLuminance([r, g, b]: [number, number, number]) {
  const f = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}

function contrastRatio(fg: [number, number, number], bg: [number, number, number]) {
  const L1 = relativeLuminance(fg)
  const L2 = relativeLuminance(bg)
  const [hi, lo] = L1 > L2 ? [L1, L2] : [L2, L1]
  return (hi + 0.05) / (lo + 0.05)
}
