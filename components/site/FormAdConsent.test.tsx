/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import React, { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import {
  FormAdConsentNotice,
  FormAdCookieBox,
  formAdNoticeText,
  useFormConsentRestricted,
} from '@/components/site/FormAdConsent'
import {
  CONSENT_COOKIE,
} from '@/lib/identity/consent'
import {
  FORM_AD_COOKIE_LABEL,
  FORM_AD_MATCH_LABEL,
  FORM_AD_NOTICE_HASHED,
  FORM_AD_NOTICE_US,
  formAdConsentCookieValue,
  writeFormAdConsent,
} from '@/lib/identity/form-ad-consent'

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

function mount(node: React.ReactNode) {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root: Root = createRoot(host)
  act(() => {
    root.render(node)
  })
  return {
    host,
    unmount() {
      act(() => root.unmount())
      host.remove()
    },
  }
}

function RegionProbe() {
  const restricted = useFormConsentRestricted()
  return (
    <FormAdConsentNotice restricted={restricted} adMatchChecked={false} onAdMatchCheckedChange={() => {}} />
  )
}

function SubmitHarness() {
  const [adCookies, setAdCookies] = useState(false)
  const [sent, setSent] = useState(0)
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        writeFormAdConsent(adCookies)
        setSent((n) => n + 1)
      }}
    >
      <FormAdCookieBox checked={adCookies} onCheckedChange={setAdCookies} />
      <button type="submit">Send</button>
      <p data-testid="sent">{sent}</p>
    </form>
  )
}

describe('form ad consent box', () => {
  beforeEach(() => {
    cookies.clear()
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('is unchecked and not required', () => {
    const { host, unmount } = mount(
      <FormAdCookieBox checked={false} onCheckedChange={() => {}} />,
    )
    const box = host.querySelector('[data-testid="ad-cookie-consent"] [role="checkbox"]')
    expect(box).not.toBeNull()
    expect(box?.getAttribute('aria-checked')).toBe('false')
    expect(box?.hasAttribute('required')).toBe(false)
    expect(host.textContent).toContain(FORM_AD_COOKIE_LABEL)
    unmount()
  })

  it('writes analytics and marketing true when checked at submit', () => {
    const seen: string[] = []
    const onEvent = (event: Event) => seen.push(String((event as CustomEvent).detail))
    window.addEventListener('cookie-consent', onEvent)
    writeFormAdConsent(true)
    window.removeEventListener('cookie-consent', onEvent)
    expect(document.cookie).toContain(`${CONSENT_COOKIE}=${formAdConsentCookieValue()}`)
    expect(decodeURIComponent(document.cookie)).toContain('"analytics":true')
    expect(decodeURIComponent(document.cookie)).toContain('"marketing":true')
    expect(seen).toEqual(['all'])
  })

  it('writes nothing when the box is unchecked', () => {
    document.cookie = 'rr_cr=0'
    const seen: string[] = []
    window.addEventListener('cookie-consent', (event) => {
      seen.push(String((event as CustomEvent).detail))
    })
    writeFormAdConsent(false)
    expect(document.cookie).toContain('rr_cr=0')
    expect(document.cookie).not.toContain(CONSENT_COOKIE)
    expect(seen).toEqual([])
  })

  it('still sends when every box is unchecked', () => {
    const { host, unmount } = mount(<SubmitHarness />)
    const form = host.querySelector('form')
    act(() => {
      form?.requestSubmit()
    })
    expect(host.querySelector('[data-testid="sent"]')?.textContent).toBe('1')
    expect(document.cookie).not.toContain(CONSENT_COOKIE)
    unmount()
  })

  it('writes the grant when the box is checked and the form sends', () => {
    const { host, unmount } = mount(<SubmitHarness />)
    const box = host.querySelector('[role="checkbox"]') as HTMLButtonElement
    act(() => {
      box.click()
    })
    expect(box.getAttribute('aria-checked')).toBe('true')
    const form = host.querySelector('form')
    act(() => {
      form?.requestSubmit()
    })
    expect(host.querySelector('[data-testid="sent"]')?.textContent).toBe('1')
    expect(decodeURIComponent(document.cookie)).toContain('"analytics":true')
    expect(decodeURIComponent(document.cookie)).toContain('"marketing":true')
    unmount()
  })
})

describe('form ad notice by region', () => {
  beforeEach(() => {
    cookies.clear()
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('shows the US sentence and no second box when the region is unrestricted', () => {
    const { host, unmount } = mount(
      <FormAdConsentNotice restricted={false} adMatchChecked={false} onAdMatchCheckedChange={() => {}} />,
    )
    expect(host.querySelector('[data-form-ad-notice]')?.getAttribute('data-form-ad-notice')).toBe('us')
    expect(host.textContent).toContain(FORM_AD_NOTICE_US)
    expect(host.textContent).toContain(FORM_AD_NOTICE_HASHED)
    expect(host.querySelector('[data-testid="ad-match-consent"]')).toBeNull()
    expect(host.querySelector('a')?.getAttribute('href')).toBe('/privacy#donotsell')
    expect(host.querySelector('a')?.textContent).toBe('ryan-realty.com/privacy#donotsell')
    expect(formAdNoticeText(false)).toBe(FORM_AD_NOTICE_US)
    unmount()
  })

  it('replaces the hashed sentence with the second box for EU/UK', () => {
    const { host, unmount } = mount(
      <FormAdConsentNotice restricted adMatchChecked={false} onAdMatchCheckedChange={() => {}} />,
    )
    expect(host.querySelector('[data-form-ad-notice]')?.getAttribute('data-form-ad-notice')).toBe('eu')
    const box = host.querySelector('[data-testid="ad-match-consent"] [role="checkbox"]')
    expect(box?.getAttribute('aria-checked')).toBe('false')
    expect(box?.hasAttribute('required')).toBe(false)
    expect(host.textContent).toContain(FORM_AD_MATCH_LABEL)
    expect(host.textContent).not.toContain(FORM_AD_NOTICE_HASHED)
    expect(host.textContent).toContain('ryan-realty.com/privacy#donotsell')
    unmount()
  })

  it('reads rr_cr: 0 is the US notice, missing or 1 is the EU box', () => {
    document.cookie = 'rr_cr=0'
    const us = mount(<RegionProbe />)
    expect(us.host.querySelector('[data-form-ad-notice]')?.getAttribute('data-form-ad-notice')).toBe('us')
    us.unmount()

    cookies.clear()
    const unknown = mount(<RegionProbe />)
    expect(unknown.host.querySelector('[data-form-ad-notice]')?.getAttribute('data-form-ad-notice')).toBe('eu')
    unknown.unmount()

    cookies.clear()
    document.cookie = 'rr_cr=1'
    const eu = mount(<RegionProbe />)
    expect(eu.host.querySelector('[data-form-ad-notice]')?.getAttribute('data-form-ad-notice')).toBe('eu')
    expect(eu.host.querySelector('[data-testid="ad-match-consent"]')).not.toBeNull()
    eu.unmount()
  })

  it('hides the notice until the region is known', () => {
    const { host, unmount } = mount(
      <FormAdConsentNotice restricted={null} adMatchChecked={false} onAdMatchCheckedChange={() => {}} />,
    )
    expect(host.querySelector('[data-form-ad-notice]')?.getAttribute('data-form-ad-notice')).toBe('pending')
    expect(host.textContent).not.toContain(FORM_AD_NOTICE_HASHED)
    unmount()
  })
})
