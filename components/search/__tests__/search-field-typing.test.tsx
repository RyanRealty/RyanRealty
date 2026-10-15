/**
 * @vitest-environment jsdom
 * @vitest-environment-options {"url": "https://ryan-realty.com/homes-for-sale"}
 *
 * The /homes-for-sale search field, driven through the real SearchFilters and
 * the real MorphingSearch. From 2026-09-10 to 2026-10-14 the field could not be
 * typed in: its `open` waited for suggestions, suggestions waited for typed
 * words, and MorphingSearch clears its words each time it opens. Every search
 * there was lost, and so was every search event (search-field-rows.ts).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'

const pushed = vi.hoisted(() => [] as string[])
vi.mock('next/navigation', () => ({
  ReadonlyURLSearchParams: URLSearchParams,
  usePathname: () => '/homes-for-sale',
  useRouter: () => ({ push: (href: string) => pushed.push(href), replace: (href: string) => pushed.push(href), refresh: () => {} }),
  useSearchParams: () => new URLSearchParams(),
}))
vi.mock('next/dynamic', () => ({ default: () => () => null }))
vi.mock('@/components/SaveSearchButton', () => ({ default: () => null }))
vi.mock('@/components/VoiceSearchButton', () => ({ default: () => null }))
vi.mock('@/components/search/use-viewer-listing-state', () => ({
  useViewerListingState: () => ({ signedIn: false, savedKeys: [], likedKeys: [], hiddenKeys: [] }),
}))
vi.mock('@/components/search/search-events.client', () => ({ fireSearchEvent: vi.fn() }))
const searches = vi.hoisted(() => [] as unknown[])
vi.mock('@/components/search/track-site-search', () => ({
  trackSiteSearch: (search: unknown) => searches.push(search),
}))
;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

import SearchFilters from '@/components/search/SearchFilters'

const EMPTY = { addresses: [], cities: [], subdivisions: [], neighborhoods: [], zips: [], brokers: [], reports: [], pages: [] }

let root: Root | null = null
const original = {
  matchMedia: window.matchMedia,
  fetch: globalThis.fetch,
  ResizeObserver: globalThis.ResizeObserver,
  scrollIntoView: Element.prototype.scrollIntoView,
}

beforeEach(() => {
  pushed.length = 0
  searches.length = 0
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
  globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)
    const q = new URL(url, 'https://ryan-realty.com').searchParams.get('q') ?? ''
    const body = /^be/i.test(q) ? { ...EMPTY, cities: [{ city: 'Bend', count: 1044 }] } : EMPTY
    return { ok: true, json: async () => body } as Response
  }) as unknown as typeof fetch
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
  // MorphingSearch draws its panel only over a trigger it can measure.
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
    x: 0, y: 0, top: 0, left: 0, right: 300, bottom: 48, width: 300, height: 48, toJSON: () => ({}),
  } as DOMRect)
  Element.prototype.scrollIntoView = () => {}
  vi.spyOn(console, 'error').mockImplementation(() => {})
  const host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  act(() => root!.render(<SearchFilters initialFilters={{}} />))
})

afterEach(() => {
  act(() => root?.unmount())
  root = null
  document.body.innerHTML = ''
  vi.restoreAllMocks()
  window.matchMedia = original.matchMedia
  globalThis.fetch = original.fetch
  globalThis.ResizeObserver = original.ResizeObserver
  Element.prototype.scrollIntoView = original.scrollIntoView
})

const trigger = () => document.querySelector<HTMLInputElement>('[data-v3-morph="trigger"] input')
const dialog = () => document.querySelector<HTMLElement>('[data-v3-morph="dialog"]')
const dialogInput = () => dialog()?.querySelector<HTMLInputElement>('input') ?? null
const rowTitles = () =>
  [...(dialog()?.querySelectorAll<HTMLButtonElement>('[role="option"]') ?? [])].map((b) => b.textContent ?? '')

async function flush(ms = 200) {
  await act(async () => {
    await new Promise((r) => setTimeout(r, ms))
  })
}

function type(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
  act(() => {
    setter.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

// Real SearchFilters + framer-motion in jsdom: allow a loaded machine its time.
describe('the /homes-for-sale search field takes typing', { timeout: 30_000 }, () => {
  it('opens on focus, onto the city seeds', async () => {
    expect(trigger()).not.toBeNull()
    act(() => trigger()!.focus())
    await flush()
    expect(dialog()).not.toBeNull()
    expect(rowTitles().some((t) => t.startsWith('Bend'))).toBe(true)
  })

  it('keeps the typed words and shows the server match', async () => {
    act(() => trigger()!.focus())
    await flush()
    type(dialogInput()!, 'Be')
    await flush()
    expect(dialog()).not.toBeNull()
    expect(dialogInput()!.value).toBe('Be')
    expect(rowTitles().some((t) => t.startsWith('Bend'))).toBe(true)
  })

  it('records one search per pick, as a search-page typeahead', async () => {
    act(() => trigger()!.focus())
    await flush()
    type(dialogInput()!, 'Be')
    await flush()
    const bend = [...dialog()!.querySelectorAll<HTMLButtonElement>('[role="option"]')].find((b) =>
      (b.textContent ?? '').startsWith('Bend'),
    )!
    act(() => bend.click())
    await flush(20)
    expect(searches).toEqual([
      { surface: 'search_page', source: 'typeahead', query: 'Bend', term: 'Be', city: 'Bend', subdivision: undefined },
    ])
  })

  it('applies a sentence of filter words on Enter', async () => {
    act(() => trigger()!.focus())
    await flush()
    type(dialogInput()!, '3 bed under 800k')
    await flush()
    expect(rowTitles().some((t) => t.startsWith('3 bed under 800k'))).toBe(true)
    act(() => {
      dialog()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    })
    await flush(20)
    expect(searches).toHaveLength(1)
    expect(searches[0]).toMatchObject({ surface: 'search_page', source: 'natural_language', query: '3 bed under 800k' })
  })
})
