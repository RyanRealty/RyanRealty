/**
 * @vitest-environment jsdom
 * @vitest-environment-options {"url": "https://ryan-realty.com/subdivisions"}
 *
 * The hook's page-level listeners (scroll depth, dwell, exit intent) were
 * module-level and never removed, so after a visitor left /subdivisions
 * client-side they kept firing on every later page, stamped page_type
 * 'subdivision' (2026-10-14 audit). Now: one install per page, removed when the
 * page's last section unmounts. Its scroll_depth goes to the first-party store
 * only; GA4's comes from V3SectionTracker.
 */
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const spies = vi.hoisted(() => ({ trackEvent: vi.fn(), fireFirstPartyEvent: vi.fn() }))
vi.mock('next/navigation', () => ({ usePathname: () => '/subdivisions' }))
vi.mock('@/lib/tracking', () => ({ trackEvent: spies.trackEvent }))
vi.mock('@/components/VisitTracker', () => ({ fireFirstPartyEvent: spies.fireFirstPartyEvent }))

import { useEngagementTracking } from './useEngagementTracking'

;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

function Section({ id }: { id: string }) {
  useEngagementTracking(id, { pageType: 'subdivision' })
  return null
}

let root: Root | null = null

async function mount(ids: string[]) {
  const node = document.createElement('div')
  document.body.appendChild(node)
  root = createRoot(node)
  await act(async () => {
    root!.render(React.createElement(React.Fragment, null, ids.map((id) => React.createElement(Section, { key: id, id }))))
  })
}

function scrollTo(pct: number) {
  Object.defineProperty(document.documentElement, 'scrollHeight', { configurable: true, value: 2000 })
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 1000 })
  Object.defineProperty(window, 'scrollY', { configurable: true, value: (1000 * pct) / 100 })
  window.dispatchEvent(new Event('scroll'))
}

beforeEach(() => {
  vi.useFakeTimers()
  spies.trackEvent.mockReset()
  spies.fireFirstPartyEvent.mockReset()
})

afterEach(async () => {
  await act(async () => root?.unmount())
  root = null
  vi.useRealTimers()
})

describe('useEngagementTracking page-level listeners', () => {
  it('installs once for many sections: one dwell per threshold, scroll depth first-party only', async () => {
    await mount(['a', 'b', 'c'])
    scrollTo(30)
    expect(spies.fireFirstPartyEvent).toHaveBeenCalledTimes(1)
    expect(spies.trackEvent.mock.calls.some(([name]) => name === 'scroll_depth')).toBe(false)
    await act(async () => {
      vi.advanceTimersByTime(15_000)
    })
    expect(spies.trackEvent.mock.calls.filter(([name]) => name === 'dwell')).toEqual([
      ['dwell', expect.objectContaining({ seconds: 15, page_type: 'subdivision' })],
    ])
  })

  it('stops firing after the page unmounts (a client-side navigation away)', async () => {
    await mount(['a', 'b'])
    await act(async () => root!.unmount())
    root = null
    spies.trackEvent.mockReset()
    spies.fireFirstPartyEvent.mockReset()
    scrollTo(100)
    vi.advanceTimersByTime(130_000)
    document.dispatchEvent(new MouseEvent('mouseleave', { clientY: 0 }))
    expect(spies.trackEvent).not.toHaveBeenCalled()
    expect(spies.fireFirstPartyEvent).not.toHaveBeenCalled()
  })
})
