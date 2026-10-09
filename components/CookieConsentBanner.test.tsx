/**
 * @vitest-environment jsdom
 *
 * First layer is the memo bar: Decline, Accept all, Choose what to allow.
 * Scroll and the close X never write consent. /lp stays free of the bar.
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
  COOKIE_NOTICE_HEADING,
  CONTEXTUAL_CONSENT_ASK_EVENT,
  OPEN_COOKIE_SETTINGS_EVENT,
  getStoredConsent,
  hasAnalyticsConsent,
  hasMarketingConsent,
} from './CookieConsentBanner'
import { CONSENT_PROMPT_DISMISS_KEY, CONSENT_PURPOSES_VERSION, shouldShowConsentPrompt } from '@/lib/identity/consent-prompt'
import { resetSessionMemory } from '@/lib/analytics/visitor-session'

vi.mock('next/navigation', () => ({
  usePathname: () => (globalThis as { __consentPath?: string }).__consentPath ?? '/',
}))

function setConsentPath(path: string) {
  ;(globalThis as { __consentPath?: string }).__consentPath = path
}

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

describe('CookieConsentBanner first layer', () => {
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
    setConsentPath('/')
    vi.useFakeTimers()
  })

  afterEach(() => {
    unmount()
    vi.useRealTimers()
    cookies.clear()
    localStorage.clear()
    sessionStorage.clear()
    setGpc(false)
    setConsentPath('/')
  })

  it('publishes the bar height so the phone dock sits above Decline', async () => {
    await mount()
    expect(document.documentElement.style.getPropertyValue('--v3-cookie-bar-h')).toBe('0px')
  })

  it('shows the memo bar on mount, Decline then Accept all, without a chip', async () => {
    await mount()
    const bar = container.querySelector('[data-cookie-notice="bar"]')
    expect(bar).not.toBeNull()
    expect(container.querySelector('[data-cookie-notice="chip"]')).toBeNull()
    expect(container.textContent).toContain(COOKIE_NOTICE_HEADING)
    expect(container.textContent).toContain(COOKIE_NOTICE_BODY)
    expect(container.textContent).toContain('Choose what to allow')
    expect(container.innerHTML).toContain('/privacy')
    expect(container.innerHTML).toContain('/privacy#donotsell')
    expect(container.textContent).not.toContain('Essential only')
    expect(container.textContent).not.toContain('Preferences')
    const decline = container.querySelector('[data-consent-action="decline"]')
    const accept = container.querySelector('[data-consent-action="accept"]')
    expect(decline!.compareDocumentPosition(accept!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(bar?.getAttribute('data-consent-region')).toBe('restricted')
  })

  it('scrolling never writes consent and never hides the bar', async () => {
    await mount()
    await act(async () => {
      window.dispatchEvent(new Event('scroll'))
    })
    expect(getStoredConsent()).toBeNull()
    expect(document.cookie).not.toContain('ryan_realty_cookie_consent=')
    expect(container.querySelector('[data-cookie-notice="bar"]')).not.toBeNull()
  })

  it('Accept all writes the consent cookie', async () => {
    await mount()
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
    expect(container.querySelector('[data-cookie-notice]')).toBeNull()
    expect(container.textContent).not.toContain('Accept all')
  })

  it('hides when a later cookie-consent event records a choice', async () => {
    await mount()
    expect(container.querySelector('[data-cookie-notice="bar"]')).not.toBeNull()
    document.cookie = `ryan_realty_cookie_consent=${encodeURIComponent(JSON.stringify({ analytics: true, marketing: true }))}`
    await act(async () => {
      window.dispatchEvent(new CustomEvent('cookie-consent', { detail: 'all' }))
    })
    expect(container.querySelector('[data-cookie-notice]')).toBeNull()
  })

  it('after X, scrolling does not bring the bar back and writes no consent', async () => {
    await mount()
    const close = container.querySelector('button[aria-label="Close cookie notice"]')
    await act(async () => {
      close?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    await act(async () => {
      window.dispatchEvent(new Event('scroll'))
    })
    expect(container.querySelector('[data-cookie-notice]')).toBeNull()
    expect(getStoredConsent()).toBeNull()
  })

  it('closing with X writes no consent cookie', async () => {
    await mount()
    const close = container.querySelector('button[aria-label="Close cookie notice"]')
    expect(close).not.toBeNull()
    await act(async () => {
      close?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(getStoredConsent()).toBeNull()
    expect(document.cookie).not.toContain('ryan_realty_cookie_consent=')
    expect(container.querySelector('[data-cookie-notice]')).toBeNull()
  })

  it('stays off /lp while Cookie settings still opens the second layer', async () => {
    setConsentPath('/lp/seller-home-value')
    await mount()
    expect(container.querySelector('[data-cookie-notice]')).toBeNull()
    await act(async () => {
      window.dispatchEvent(new CustomEvent(OPEN_COOKIE_SETTINGS_EVENT))
    })
    expect(document.body.textContent).toContain('Choose what to allow')
    expect(document.body.textContent).toContain('Essential (always on)')
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

  it('GPC overrides a stored accept for analytics and marketing', async () => {
    document.cookie = `ryan_realty_cookie_consent=${encodeURIComponent(JSON.stringify({ analytics: true, marketing: true, v: CONSENT_PURPOSES_VERSION }))}`
    expect(hasAnalyticsConsent()).toBe(false)
    expect(hasMarketingConsent()).toBe(false)
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
    for (const token of CONSENT_CHOICE_BUTTON_CLASS.split(' ')) {
      expect(decline!.className).toContain(token)
      expect(accept!.className).toContain(token)
    }
    expect(decline!.className).not.toContain('h-9')
    expect(accept!.className).not.toContain('h-9')
    expect(decline!.className).not.toContain('h-8')
    expect(accept!.className).not.toContain('h-8')
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
    for (const token of CONSENT_CHOICE_BUTTON_CLASS.split(' ')) {
      expect(usDecline!.className).toContain(token)
      expect(usAccept!.className).toContain(token)
    }
  })

  it('US Accept all uses the primary token, which is the brand navy', () => {
    const css = readFileSync(GLOBALS, 'utf8')
    const primary = /--primary:\s*oklch\(([\d.]+)\s+([\d.]+)\s+([\d.]+)\)/.exec(css)
    expect(primary).toBeTruthy()
    const [r, g, b] = oklchToSrgb(+primary![1], +primary![2], +primary![3]).map((c) => Math.round(c * 255))
    expect([r, g, b]).toEqual([16, 39, 66])
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

  it('fires once for US no-answer, not for restricted, not after an answer', async () => {
    document.cookie = 'rr_cr=0; path=/'
    sessionStorage.setItem(CONSENT_PROMPT_DISMISS_KEY, '1')
    await mount()
    expect(container.querySelector('[data-cookie-notice]')).toBeNull()
    await act(async () => {
      window.dispatchEvent(new CustomEvent(CONTEXTUAL_CONSENT_ASK_EVENT))
    })
    const bar = container.querySelector('[data-cookie-notice="bar"]')
    expect(bar).not.toBeNull()
    expect(bar?.textContent).toContain('Decline')
    expect(bar?.textContent).toContain('Accept all')
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
    sessionStorage.setItem(CONSENT_PROMPT_DISMISS_KEY, '1')
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

describe('Choose what to allow', () => {
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

  async function openChooser() {
    await mount()
    const open = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Choose what to allow')
    await act(async () => {
      open?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
  }

  beforeEach(() => {
    cookies.clear()
    localStorage.clear()
    sessionStorage.clear()
    setGpc(false)
    setConsentPath('/')
  })

  afterEach(() => {
    unmount()
    cookies.clear()
    localStorage.clear()
    sessionStorage.clear()
    setGpc(false)
    setConsentPath('/')
  })

  it('US: analytics on, marketing off, essential has no toggle, third parties named', async () => {
    document.cookie = 'rr_cr=0; path=/'
    await openChooser()
    const analytics = document.body.querySelector('[data-consent-toggle="analytics"]')
    const marketing = document.body.querySelector('[data-consent-toggle="marketing"]')
    expect(analytics?.getAttribute('aria-checked')).toBe('true')
    expect(marketing?.getAttribute('aria-checked')).toBe('false')
    expect(document.body.querySelector('[data-consent-essential="always"] [data-slot="switch"]')).toBeNull()
    expect(document.body.textContent).toContain('Google Analytics')
    expect(document.body.textContent).toContain('Facebook')
    expect(document.body.textContent).toContain('Google Ads')
    expect(document.body.textContent).toContain('Save choices')
  })

  it('restricted region: analytics and marketing both start off', async () => {
    document.cookie = 'rr_cr=1; path=/'
    await openChooser()
    expect(document.body.querySelector('[data-consent-toggle="analytics"]')?.getAttribute('aria-checked')).toBe('false')
    expect(document.body.querySelector('[data-consent-toggle="marketing"]')?.getAttribute('aria-checked')).toBe('false')
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

  it('paints the bar itself, not a chip, and never auto-grants on scroll', () => {
    expect(src).toContain('data-cookie-notice="bar"')
    expect(src).not.toContain('data-cookie-notice="chip"')
    expect(src).not.toContain('autoGrantConsentForAdTraffic')
    expect(src).not.toMatch(/if \(consent === null\) setVisible\(true\)/)
  })

  it('uses shadcn controls and tokens, not a raw button or a filled chip', () => {
    expect(src).toContain('from "@/components/ui/button"')
    expect(src).toContain('from "@/components/ui/dialog"')
    expect(src).toContain('from "@/components/ui/switch"')
    expect(src).toContain('from "@/components/ui/label"')
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
