/**
 * @vitest-environment jsdom
 *
 * The floating disc shows the attributed broker's existing headshot.
 * Unattributed visits stay on Matt.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { V3DogFloater } from './V3DogFloater.client'

vi.mock('next/navigation', () => ({ usePathname: () => '/' }))
vi.mock('@/lib/tracking', () => ({ trackEvent: vi.fn() }))
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) =>
    React.createElement('a', { href, ...props }, children),
}))
;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let container: HTMLDivElement
let root: Root | null = null

function stubMedia() {
  window.matchMedia = ((query: string) => ({
    matches: query.includes('prefers-reduced-motion'),
    media: query,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
}

function mount() {
  stubMedia()
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => root!.render(React.createElement(V3DogFloater)))
}

function iconSrc() {
  return container.querySelector<HTMLImageElement>('.v3-dog-floater__broker')?.getAttribute('src')
}

afterEach(() => {
  if (root) {
    const current = root
    root = null
    act(() => current.unmount())
    container.remove()
  }
  document.cookie = 'rr_agent_attribution=; path=/; max-age=0'
  window.history.replaceState({}, '', '/')
})

describe('V3DogFloater broker icon', () => {
  it('defaults to Matt when the visit is not attributed', () => {
    mount()
    expect(iconSrc()).toBe('/images/brokers/ryan-matt.png')
    expect(container.querySelector('[data-v3-floater-broker="matt"]')).toBeTruthy()
  })

  it('shows Rebecca from ?agent=', () => {
    window.history.replaceState({}, '', '/?agent=rebecca')
    mount()
    expect(iconSrc()).toBe('/images/brokers/peterson-rebecca.png')
    expect(container.querySelector('[data-v3-floater-broker="rebecca"]')).toBeTruthy()
  })

  it('shows Paul from the attribution cookie', () => {
    document.cookie = `rr_agent_attribution=${encodeURIComponent(JSON.stringify({ slug: 'paul' }))}; path=/`
    mount()
    expect(iconSrc()).toBe('/images/brokers/stevenson-paul.png')
  })
})
