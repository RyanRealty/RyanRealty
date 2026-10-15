/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { captureSarahLead } from '@/app/actions/sarah-capture'
import { trackEvent } from '@/lib/tracking'
import { WEB_GREETING_EN, WEB_SAVED_NOTICE_EN } from '@/lib/sarah/scripts'
import { primeSarahMicrophone, startSarahVoiceSession } from '@/lib/sarah/web-voice'
import { WEB_BRINGS_YOU_HERE_EN } from '@/lib/sarah/intent-flow'
import { SARAH_TEASER_COPY, SARAH_TEASER_DELAY_MS, SARAH_TEASER_SESSION_KEY } from '@/lib/sarah/teaser'
import { V3SarahAssistant } from './V3SarahAssistant.client'

const nav = { pathname: '/homes-for-sale/bend/20556-empire-220226741' }

vi.mock('next/navigation', () => ({ usePathname: () => nav.pathname }))
vi.mock('@/lib/tracking', () => ({ trackEvent: vi.fn() }))
vi.mock('@/app/actions/sarah-capture', () => ({
  captureSarahLead: vi.fn(async () => ({ data: { personId: 1, cmaSlug: null, stage: 'Lead' }, error: null })),
}))
vi.mock('@/app/actions/sarah-voice', () => ({
  mintSarahVoiceToken: vi.fn(async () => ({
    data: {
      secret: 'tok_test',
      expiresAt: null,
      model: 'grok-voice-latest',
      voice: 'eve',
      brokerFirstName: 'Matt',
    },
    error: null,
  })),
}))
vi.mock('@/lib/sarah/web-voice', () => ({
  primeSarahMicrophone: vi.fn(async () => ({ getTracks: () => [{ stop: vi.fn() }] })),
  startSarahVoiceSession: vi.fn(async ({ onStatus }: { onStatus: (s: string) => void }) => {
    onStatus('listening')
    return { stop: vi.fn() }
  }),
}))
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
    vi.mocked(captureSarahLead).mockClear()
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

  it('opens as a bottom sheet on a phone listing page', async () => {
    unmount()
    wide = false
    stubMedia()
    await mount()
    act(() => {
      container.querySelector<HTMLButtonElement>('[data-sarah="launcher"]')?.click()
    })
    expect(container.querySelector('[data-sarah="root"]')?.getAttribute('data-sarah-open')).toBe('1')
    expect(container.querySelector('[data-sarah="panel"]')?.getAttribute('data-sarah-surface')).toBe('sheet')
    expect(container.querySelector('[data-sarah="scrim"]')).not.toBeNull()
    expect(container.querySelector('[data-sarah="mic"]')).not.toBeNull()
  })

  it('opens the panel from the bubble, tracks the click, and stays dismissed', async () => {
    act(() => {
      vi.advanceTimersByTime(SARAH_TEASER_DELAY_MS)
    })
    const open = container.querySelector<HTMLButtonElement>('.v3-sarah__teaser-open')
    act(() => {
      open?.click()
    })
    expect(trackEvent).toHaveBeenCalledWith('sarah_teaser_clicked', { surface: 'listing', cta: 'bubble' })
    expect(container.querySelector('[data-sarah="panel"]')).not.toBeNull()
    expect(container.querySelector('[data-sarah="panel"]')?.getAttribute('data-sarah-broker')).toBe('matt')
    expect(container.querySelector('.v3-sarah__panel-role')?.textContent).toBe('AI assistant')
    const chips = [...container.querySelectorAll<HTMLButtonElement>('[data-sarah="intent-chips"] [data-sarah-chip]')].map(
      (btn) => ({ id: btn.getAttribute('data-sarah-chip'), text: btn.textContent }),
    )
    expect(chips).toEqual([
      { id: 'buyer', text: "I'm looking for a home" },
      { id: 'seller', text: "I'm thinking of selling" },
      { id: 'home-worth', text: "What's my home worth?" },
      { id: 'question', text: 'I have a question' },
    ])
    expect(container.querySelector('.v3-sarah__desk-actions')).toBeNull()
    const mic = container.querySelector<HTMLButtonElement>('[data-sarah="mic"]')
    expect(mic).not.toBeNull()
    expect(mic?.textContent).not.toMatch(/\bMic\b/)
    expect(container.querySelector('[data-sarah="panel"]')?.getAttribute('data-sarah-surface')).toBe('card')
    expect(container.querySelector('[data-sarah="panel"]')?.textContent).toContain(WEB_BRINGS_YOU_HERE_EN)
    await act(async () => {
      mic?.click()
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(primeSarahMicrophone).toHaveBeenCalled()
    expect(startSarahVoiceSession).toHaveBeenCalled()
    expect(container.querySelector('[data-sarah="mic"]')?.getAttribute('data-sarah-voice')).toBe('listening')
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

  it('runs the buyer qualifying flow and writes the CRM capture', async () => {
    act(() => {
      container.querySelector<HTMLButtonElement>('[data-sarah="launcher"]')?.click()
    })
    const panel = container.querySelector('[data-sarah="panel"]')
    expect(panel?.textContent).toContain(WEB_BRINGS_YOU_HERE_EN)
    act(() => {
      container.querySelector<HTMLButtonElement>('[data-sarah-chip="buyer"]')?.click()
    })
    expect(panel?.textContent).toMatch(/Which area/)

    async function typeAndSend(text: string) {
      const input = container.querySelector<HTMLInputElement>('input[name="sarah-message"]')
      expect(input).not.toBeNull()
      await act(async () => {
        const proto = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')
        proto?.set?.call(input, text)
        input!.dispatchEvent(new Event('input', { bubbles: true }))
      })
      await act(async () => {
        container.querySelector('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
      })
    }

    await typeAndSend('Bend')
    await typeAndSend('around 700k')
    await typeAndSend('this year')
    await typeAndSend('Alex Rivera')
    await typeAndSend('alex@example.com')
    await act(async () => {
      await Promise.resolve()
    })
    expect(captureSarahLead).toHaveBeenCalledWith({
      intent: 'buyer',
      answers: expect.objectContaining({
        area: 'Bend',
        budget: 'around 700k',
        timeline: 'this year',
        name: 'Alex Rivera',
        email: 'alex@example.com',
      }),
      startCma: false,
    })
    expect(panel?.textContent).toMatch(/saved that/)
    expect(container.querySelector('[data-sarah-chip="handoff-call"]')?.textContent).toBe('Call')
  })

  it('starts the buyer flow for Hi I would like to look at homes here', async () => {
    act(() => {
      container.querySelector<HTMLButtonElement>('[data-sarah="launcher"]')?.click()
    })
    const panel = container.querySelector('[data-sarah="panel"]')
    const input = container.querySelector<HTMLInputElement>('input[name="sarah-message"]')
    expect(input).not.toBeNull()
    await act(async () => {
      const proto = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')
      proto?.set?.call(input, 'Hi I would like to look at homes here')
      input!.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await act(async () => {
      container.querySelector('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    })
    expect(panel?.textContent).toMatch(/Which area/)
    expect(panel?.textContent).not.toMatch(/I can share what the listing shows/)
    const launcher = container.querySelector<HTMLImageElement>('button[data-sarah="launcher"] img')
    expect(launcher?.getAttribute('srcset')).toContain('sarah-headshot@2x.jpg')
    expect(launcher?.getAttribute('srcset')).toContain('sarah-headshot@3x.jpg')
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
