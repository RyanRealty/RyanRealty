/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { trackEvent } from '@/lib/tracking'
import { WEB_GREETING_EN, WEB_SAVED_NOTICE_EN } from '@/lib/sarah/scripts'
import { SARAH_TEASER_COPY, SARAH_TEASER_DELAY_MS, SARAH_TEASER_SESSION_KEY } from '@/lib/sarah/teaser'
import { V3SarahAssistant } from './V3SarahAssistant.client'

const nav = { pathname: '/homes-for-sale/bend/20556-empire-220226741' }

vi.mock('next/navigation', () => ({ usePathname: () => nav.pathname }))
vi.mock('@/lib/tracking', () => ({ trackEvent: vi.fn() }))
vi.mock('@/app/actions/sarah-desk', () => ({
  getSarahDeskBroker: vi.fn(async () => ({
    data: {
      slug: 'matt',
      firstName: 'Matt',
      fullName: 'Matt Ryan',
      photoSrc: '/images/brokers/ryan-matt.png',
      photoAlt: 'Matt Ryan',
      phoneDisplay: '541.703.3095',
      phoneTel: '+15417033095',
      email: 'matt@ryan-realty.com',
      contactHref: '/contact?agent=matt',
    },
    error: null,
  })),
}))

;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const mediaListeners = new Set<(ev?: MediaQueryListEvent) => void>()
let wide = true

function stubMedia() {
  mediaListeners.clear()
  window.matchMedia = ((query: string) => ({
    get matches() {
      if (query === '(min-width: 64rem)') return wide
      return false
    },
    media: query,
    onchange: null,
    addEventListener: (_type: string, fn: (ev?: MediaQueryListEvent) => void) => mediaListeners.add(fn),
    removeEventListener: (_type: string, fn: (ev?: MediaQueryListEvent) => void) => mediaListeners.delete(fn),
    addListener() {},
    removeListener() {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
}

let container: HTMLDivElement
let root: Root | null = null

async function mount() {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => root!.render(React.createElement(V3SarahAssistant)))
  await act(async () => {
    await Promise.resolve()
  })
}

function unmount() {
  act(() => root?.unmount())
  root = null
  container?.remove()
}

describe('V3SarahAssistant listing teaser behavior', () => {
  beforeEach(async () => {
    nav.pathname = '/homes-for-sale/bend/20556-empire-220226741'
    wide = true
    vi.mocked(trackEvent).mockReset()
    sessionStorage.clear()
    stubMedia()
    vi.useFakeTimers()
    await mount()
  })

  afterEach(() => {
    unmount()
    vi.useRealTimers()
  })

  it('does not show a teaser or open the panel before 30s', () => {
    expect(container.querySelector('[data-sarah-teaser]')).toBeNull()
    expect(container.querySelector('[data-sarah="panel"]')).toBeNull()
    act(() => {
      vi.advanceTimersByTime(SARAH_TEASER_DELAY_MS - 1)
    })
    expect(container.querySelector('[data-sarah-teaser]')).toBeNull()
    expect(container.querySelector('[data-sarah="panel"]')).toBeNull()
  })

  it('shows a photo bubble on a wide listing page after 30s, not the panel', () => {
    act(() => {
      vi.advanceTimersByTime(SARAH_TEASER_DELAY_MS)
    })
    const bubble = container.querySelector('[data-sarah-teaser="bubble"]')
    expect(bubble).not.toBeNull()
    expect(bubble?.textContent).toContain(SARAH_TEASER_COPY)
    expect(bubble?.querySelector('img')).not.toBeNull()
    expect(container.querySelector('[data-sarah-teaser="badge"]')).toBeNull()
    expect(container.querySelector('[data-sarah="panel"]')).toBeNull()
    expect(trackEvent).toHaveBeenCalledWith('sarah_teaser_shown', { surface: 'listing', cta: 'bubble' })
  })

  it('shows only a launcher badge on a phone listing page', async () => {
    unmount()
    wide = false
    stubMedia()
    await mount()
    act(() => {
      vi.advanceTimersByTime(SARAH_TEASER_DELAY_MS)
    })
    expect(container.querySelector('[data-sarah-teaser="bubble"]')).toBeNull()
    expect(container.querySelector('[data-sarah-teaser="badge"]')).not.toBeNull()
    expect(container.querySelector('[data-sarah="panel"]')).toBeNull()
    expect(trackEvent).toHaveBeenCalledWith('sarah_teaser_shown', { surface: 'listing', cta: 'badge' })
  })

  it('opens the panel from the bubble, tracks the click, and stays dismissed', () => {
    act(() => {
      vi.advanceTimersByTime(SARAH_TEASER_DELAY_MS)
    })
    const open = container.querySelector<HTMLButtonElement>('.v3-sarah__teaser-open')
    act(() => {
      open?.click()
    })
    expect(trackEvent).toHaveBeenCalledWith('sarah_teaser_clicked', { surface: 'listing', cta: 'bubble' })
    expect(container.querySelector('[data-sarah="panel"]')).not.toBeNull()
    expect(container.querySelector('[data-sarah="desk"]')?.getAttribute('data-sarah-broker')).toBe('matt')
    expect(container.querySelector('[data-sarah="desk-line"]')?.textContent).toBe('Your broker is Matt Ryan')
    const deskLinks = [...container.querySelectorAll<HTMLAnchorElement>('.v3-sarah__desk-actions a')].map((a) => ({
      href: a.getAttribute('href'),
      text: a.textContent,
    }))
    expect(deskLinks).toEqual([
      { href: 'tel:+15417033095', text: 'Call' },
      { href: 'sms:+15417033095', text: 'Text' },
      { href: '/contact?agent=matt', text: 'Message' },
    ])
    expect(container.querySelector('[data-sarah-teaser]')).toBeNull()
    expect(sessionStorage.getItem(SARAH_TEASER_SESSION_KEY)).toBe('1')

    act(() => {
      container.querySelector<HTMLButtonElement>('[aria-label="Close chat"]')?.click()
    })
    expect(container.querySelector('[data-sarah="panel"]')).toBeNull()
    act(() => {
      vi.advanceTimersByTime(SARAH_TEASER_DELAY_MS)
    })
    expect(container.querySelector('[data-sarah-teaser]')).toBeNull()
  })

  it('opens with Matt\'s short intro and the saved-chats notice, not the Counsel unlicensed line', () => {
    act(() => {
      container.querySelector<HTMLButtonElement>('[data-sarah="launcher"]')?.click()
    })
    const panel = container.querySelector('[data-sarah="panel"]')
    expect(panel?.textContent).toContain(WEB_GREETING_EN)
    expect(panel?.querySelector('[data-sarah="saved-notice"]')?.textContent).toBe(WEB_SAVED_NOTICE_EN)
    expect(panel?.querySelector('.v3-sarah__panel-role')?.textContent).toBe('AI assistant')
    expect(WEB_GREETING_EN).not.toMatch(/not a licensed broker/i)
    expect(panel?.querySelector('.v3-sarah__panel-role')?.textContent).not.toMatch(/not a licensed broker/i)
  })

  it('does not tease a city browse page', async () => {
    unmount()
    nav.pathname = '/homes-for-sale/bend'
    await mount()
    act(() => {
      vi.advanceTimersByTime(SARAH_TEASER_DELAY_MS)
    })
    expect(container.querySelector('[data-sarah-teaser]')).toBeNull()
    expect(trackEvent).not.toHaveBeenCalled()
  })
})
