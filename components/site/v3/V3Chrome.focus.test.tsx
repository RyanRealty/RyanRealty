/**
 * @vitest-environment jsdom
 *
 * Where focus goes when the reader leaves the bar, driven through the real
 * V3Chrome. Keyboard focus in the sticky bar drops the page's scroll padding
 * (V3Chrome.css), so every move that scrolls the page to an anchor must take
 * focus out of the bar first, and nothing else may (code review, 2026-09-30):
 * a followed anchor link gives its focus up, Back or a hash change onto an
 * anchor closes the menu without handing focus back, and a step that keeps
 * the page, or a link to the page already showing, leaves the menu's own
 * focus return alone.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'

let renderedPath = '/homes-for-sale/bend'
vi.mock('next/navigation', () => ({ usePathname: () => renderedPath, useRouter: () => ({ push: vi.fn() }) }))
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) =>
    React.createElement('a', { href, ...props }, children),
}))
vi.mock('./V3ChromeSearch.client', () => ({ V3ChromeSearch: () => null }))
;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

import { V3Chrome } from './V3Chrome'

let root: Root | null = null
const stopNavigation = (event: Event) => event.preventDefault()

function mount(path: string, url: string = path) {
  renderedPath = path
  window.history.replaceState(null, '', url)
  // The root layout mounts the chrome directly on <body> (V3Chrome.css reads
  // `body > .v3-chrome`), so the test does too.
  root = createRoot(document.body)
  act(() => root!.render(<V3Chrome />))
}

beforeEach(() => {
  globalThis.fetch = vi.fn(() => Promise.resolve({ ok: false, json: async () => null })) as unknown as typeof fetch
  document.addEventListener('click', stopNavigation)
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  act(() => root?.unmount())
  root = null
  document.removeEventListener('click', stopNavigation)
  vi.restoreAllMocks()
})

const menuButton = () => document.querySelector<HTMLButtonElement>('.v3-chrome__menu-btn')!
const overlay = () => document.querySelector<HTMLElement>('.v3-chrome__overlay')!
const closeButton = () => document.querySelector<HTMLButtonElement>('.v3-chrome__close')!
const openMenu = () => {
  menuButton().focus()
  act(() => menuButton().click())
  expect(overlay().hidden).toBe(false)
  expect(document.activeElement).toBe(closeButton())
}
const escape = () => act(() => void document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
const inBar = () => Boolean((document.activeElement as HTMLElement | null)?.closest('body > .v3-chrome'))

describe('the menu hands focus back only when the reader stayed', () => {
  it('returns focus to Menu on Escape', () => {
    mount('/homes-for-sale/bend')
    openMenu()
    escape()
    expect(overlay().hidden).toBe(true)
    expect(document.activeElement).toBe(menuButton())
  })

  it('returns focus to Menu after a link to the page already showing', () => {
    mount('/')
    openMenu()
    const home = overlay().querySelector<HTMLAnchorElement>('a.v3-chrome__mark[href="/"]')!
    home.focus()
    act(() => home.click())
    expect(overlay().hidden).toBe(true)
    expect(document.activeElement).toBe(menuButton())
  })

  it('keeps focus out of the bar after a link to an anchor', () => {
    mount('/homes-for-sale/bend')
    openMenu()
    const value = overlay().querySelector<HTMLAnchorElement>('a[href="/sell#get-value"]')!
    value.focus()
    act(() => value.click())
    expect(overlay().hidden).toBe(true)
    expect(document.activeElement).not.toBe(value)
    expect(document.activeElement).not.toBe(menuButton())
  })
})

describe('a history step moves focus out of the bar only when it moves the reader', () => {
  it('leaves the open menu and its focus alone on a step that keeps the page', () => {
    mount('/homes-for-sale/bend', '/homes-for-sale/bend?beds=3')
    openMenu()
    window.history.replaceState(null, '', '/homes-for-sale/bend?beds=2')
    act(() => void window.dispatchEvent(new PopStateEvent('popstate', { state: null })))
    expect(overlay().hidden).toBe(false)
    expect(document.activeElement).toBe(closeButton())
    escape()
    expect(document.activeElement).toBe(menuButton())
  })

  it('closes the menu and takes focus out of the bar on a step onto an anchor', () => {
    mount('/homes-for-sale/bend')
    openMenu()
    window.history.replaceState(null, '', '/homes-for-sale/bend#map')
    act(() => void window.dispatchEvent(new PopStateEvent('popstate', { state: null })))
    expect(overlay().hidden).toBe(true)
    expect(inBar()).toBe(false)
  })

  it('takes focus out of the bar on a hash change', () => {
    mount('/homes-for-sale/bend')
    menuButton().focus()
    expect(inBar()).toBe(true)
    window.history.replaceState(null, '', '/homes-for-sale/bend#map')
    act(() => void window.dispatchEvent(new HashChangeEvent('hashchange')))
    expect(inBar()).toBe(false)
  })
})
