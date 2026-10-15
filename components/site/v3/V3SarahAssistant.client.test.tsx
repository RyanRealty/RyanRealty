/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { trackEvent } from '@/lib/tracking'
import { SARAH_TEASER_COPY, SARAH_TEASER_DELAY_MS, SARAH_TEASER_SESSION_KEY } from '@/lib/sarah/teaser'
import { V3SarahAssistant } from './V3SarahAssistant.client'

const nav = { pathname: '/homes-for-sale/bend/20556-empire-220226741' }

vi.mock('next/navigation', () => ({ usePathname: () => nav.pathname }))
vi.mock('@/lib/tracking', () => ({ trackEvent: vi.fn() }))

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

function mount() {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => root!.render(React.createElement(V3SarahAssistant)))
}

function unmount() {
  act(() => root?.unmount())
  root = null
  container?.remove()
}

describe('V3SarahAssistant listing teaser behavior', () => {
  beforeEach(() => {
    nav.pathname = '/homes-for-sale/bend/20556-empire-220226741'
    wide = true
    vi.mocked(trackEvent).mockReset()
    sessionStorage.clear()
    stubMedia()
    vi.useFakeTimers()
    mount()
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

  it('shows only a launcher badge on a phone listing page', () => {
    unmount()
    wide = false
    stubMedia()
    mount()
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

  it('does not tease a city browse page', () => {
    unmount()
    nav.pathname = '/homes-for-sale/bend'
    mount()
    act(() => {
      vi.advanceTimersByTime(SARAH_TEASER_DELAY_MS)
    })
    expect(container.querySelector('[data-sarah-teaser]')).toBeNull()
    expect(trackEvent).not.toHaveBeenCalled()
  })
})
