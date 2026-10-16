/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { captureSarahLead } from '@/app/actions/sarah-capture'
import { answerSarahChat } from '@/app/actions/sarah-chat'
import { mintSarahVoiceToken } from '@/app/actions/sarah-voice'
import { startSarahVoiceSession } from '@/lib/sarah/web-voice'
import { trackEvent } from '@/lib/tracking'
import { WEB_HELP_EN, WEB_VOICE_NOTICE_EN } from '@/lib/sarah/scripts'
import { WEB_BRINGS_YOU_HERE_EN, WEB_DISCLOSURE_LINE_EN } from '@/lib/sarah/intent-flow'
import { SARAH_TEASER_COPY, SARAH_TEASER_DELAY_MS, SARAH_TEASER_SESSION_KEY } from '@/lib/sarah/teaser'
import { V3SarahAssistant } from './V3SarahAssistant.client'

const nav = {
  pathname: '/homes-for-sale/bend/20556-empire-220226741',
  push: vi.fn(),
}

vi.mock('next/navigation', () => ({
  usePathname: () => nav.pathname,
  useRouter: () => ({ push: nav.push }),
}))
vi.mock('@/lib/tracking', () => ({ trackEvent: vi.fn() }))
vi.mock('@/app/actions/sarah-capture', () => ({
  captureSarahLead: vi.fn(async () => ({ data: { personId: 1, cmaSlug: null, stage: 'Lead' }, error: null })),
}))
vi.mock('@/app/actions/sarah-chat', () => ({
  answerSarahChat: vi.fn(async () => ({
    data: {
      reply:
        "The listing does not give the shop's build year. The home was built in 2020. The remarks describe a 20x30 powered shop with loft, epoxy floors, and partial insulation/sheetrock. I can have Matt find out.",
      listNumber: '220222095',
    },
    error: null,
  })),
}))
const voiceHandle = { stop: vi.fn(), speakExact: vi.fn(), underruns: () => 0 }

vi.mock('@/app/actions/sarah-voice', () => ({
  mintSarahVoiceToken: vi.fn(async () => ({ data: null, error: 'skip' })),
}))
vi.mock('@/lib/sarah/web-voice', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/sarah/web-voice')>()
  return {
    ...actual,
    startSarahVoiceSession: vi.fn(async () => voiceHandle),
  }
})
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
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: {
      getUserMedia: vi.fn(async () => ({ getTracks: () => [] })),
    },
  })
  Object.defineProperty(navigator, 'sendBeacon', {
    configurable: true,
    value: vi.fn(() => true),
  })
  vi.stubGlobal(
    'AudioContext',
    class {
      state = 'running'
      sampleRate = 48_000
      destination = {}
      resume = vi.fn(async () => undefined)
      close = vi.fn(async () => undefined)
      createMediaStreamDestination = () => ({ stream: { getTracks: () => [] } })
    },
  )
  HTMLMediaElement.prototype.play = vi.fn(async () => undefined)
  HTMLMediaElement.prototype.pause = vi.fn()
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
    nav.push.mockReset()
    voiceHandle.stop.mockReset()
    voiceHandle.speakExact.mockReset()
    wide = true
    vi.mocked(trackEvent).mockReset()
    vi.mocked(captureSarahLead).mockClear()
    vi.mocked(answerSarahChat).mockClear()
    sessionStorage.clear()
    stubMedia()
    vi.useFakeTimers()
    await mount()
  })

  afterEach(() => {
    unmount()
    vi.unstubAllGlobals()
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
    expect(container.querySelector('.v3-sarah__panel-role')).toBeNull()
    const chips = [...container.querySelectorAll<HTMLButtonElement>('[data-sarah="intent-chips"] [data-sarah-chip]')].map(
      (btn) => ({ id: btn.getAttribute('data-sarah-chip'), text: btn.textContent }),
    )
    expect(chips).toEqual([
      { id: 'buyer', text: "I'm looking for a home" },
      { id: 'seller', text: 'Thinking of selling' },
      { id: 'home-worth', text: "What's my home worth?" },
      { id: 'question', text: 'I have a question' },
    ])
    expect(container.querySelector('.v3-sarah__desk-actions')).toBeNull()
    expect(container.querySelector('[data-sarah="mic"]')).not.toBeNull()
    expect(container.querySelector('[data-sarah="voice-stage"]')).not.toBeNull()
    expect(container.querySelector('[data-sarah="voice-hint"]')?.textContent).toContain('Just start talking')
    expect(container.querySelector('.v3-sarah__ai-tag')).toBeNull()
    expect(container.querySelector('[data-sarah="panel"]')?.getAttribute('data-sarah-surface')).toBe('card')
    expect(container.querySelector('[data-sarah="panel"]')?.textContent).toContain(WEB_BRINGS_YOU_HERE_EN)
    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-sarah="mic"]')?.click()
      await Promise.resolve()
    })
    expect(container.querySelector('[data-sarah="panel"]')?.textContent).toContain(WEB_VOICE_NOTICE_EN)
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

  it('opens by asking what brings them here, with one disclosure line and no broker chrome', () => {
    act(() => {
      container.querySelector<HTMLButtonElement>('[data-sarah="launcher"]')?.click()
    })
    const panel = container.querySelector('[data-sarah="panel"]')
    expect(panel?.textContent).toContain(WEB_BRINGS_YOU_HERE_EN)
    expect(panel?.querySelector('[data-sarah="saved-notice"]')?.textContent).toBe(WEB_DISCLOSURE_LINE_EN)
    expect(panel?.querySelectorAll('.v3-sarah__msg--sarah').length).toBe(1)
    expect(panel?.querySelector('.v3-sarah__panel-role')).toBeNull()
    expect(panel?.querySelector('.v3-sarah__desk-who')).toBeNull()
    expect(WEB_DISCLOSURE_LINE_EN).not.toMatch(/not a licensed broker/i)
    expect(container.querySelector('[data-sarah="launcher"] img')?.getAttribute('srcset')).toContain('2x')
  })

  it('starts the buyer flow from Hi I would like to look at homes here', async () => {
    act(() => {
      container.querySelector<HTMLButtonElement>('[data-sarah="launcher"]')?.click()
    })
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
    const panel = container.querySelector('[data-sarah="panel"]')
    expect(panel?.textContent).toMatch(/Which area/)
    expect(container.querySelector('[data-sarah="intent-chips"]')).toBeNull()
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

  it('answers a listing-page shop question from listing data, not WEB_HELP_EN', async () => {
    unmount()
    nav.pathname = '/homes-for-sale/redmond/josie-meadows/4722-zenith-ave-220222095'
    await mount()
    act(() => {
      container.querySelector<HTMLButtonElement>('[data-sarah="launcher"]')?.click()
    })
    const input = container.querySelector<HTMLInputElement>('input[name="sarah-message"]')
    await act(async () => {
      const proto = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')
      proto?.set?.call(input, 'when was the shop built')
      input!.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await act(async () => {
      container.querySelector('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    })
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })
    const panel = container.querySelector('[data-sarah="panel"]')
    expect(answerSarahChat).toHaveBeenCalledWith({
      pagePath: '/homes-for-sale/redmond/josie-meadows/4722-zenith-ave-220222095',
      question: 'when was the shop built',
    })
    expect(panel?.textContent).toMatch(/20x30 powered shop/)
    expect(panel?.textContent).not.toContain(WEB_HELP_EN)
  })

  it('navigates to Sisters search and keeps the panel open', async () => {
    act(() => {
      container.querySelector<HTMLButtonElement>('[data-sarah="launcher"]')?.click()
    })
    const input = container.querySelector<HTMLInputElement>('input[name="sarah-message"]')
    await act(async () => {
      const proto = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')
      proto?.set?.call(input, 'show me homes in Sisters')
      input!.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await act(async () => {
      container.querySelector('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    })
    expect(nav.push).toHaveBeenCalledWith('/homes-for-sale/sisters')
    expect(container.querySelector('[data-sarah="panel"]')).not.toBeNull()
    expect(container.querySelector('[data-sarah="panel"]')?.textContent).toMatch(/Taking you there now/)
    expect(container.querySelector('[data-sarah="messages"]')?.textContent).toMatch(/show me homes in Sisters/)
  })

  it('keeps the voice session when she navigates to Sisters', async () => {
    vi.mocked(mintSarahVoiceToken).mockResolvedValueOnce({
      data: {
        secret: 'test-secret',
        expiresAt: Date.now() + 60_000,
        model: 'grok',
        voice: 'eve',
        brokerFirstName: 'Matt',
      },
      error: null,
    })
    act(() => {
      container.querySelector<HTMLButtonElement>('[data-sarah="launcher"]')?.click()
    })
    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-sarah="mic"]')?.click()
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(startSarahVoiceSession).toHaveBeenCalled()
    const input = container.querySelector<HTMLInputElement>('input[name="sarah-message"]')
    await act(async () => {
      const proto = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')
      proto?.set?.call(input, 'show me homes in Sisters')
      input!.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await act(async () => {
      container.querySelector('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    })
    expect(nav.push).toHaveBeenCalledWith('/homes-for-sale/sisters')
    expect(voiceHandle.speakExact).toHaveBeenCalledWith('Taking you there now')
    expect(voiceHandle.stop).not.toHaveBeenCalled()
    expect(container.querySelector('[data-sarah="panel"]')).not.toBeNull()
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
