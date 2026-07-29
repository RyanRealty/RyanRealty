/**
 * @vitest-environment jsdom
 *
 * F5 regression lock — /account/notifications silently discarded the market
 * report block.
 *
 * The page header promises "Changes save automatically" and every other control
 * on it writes on change. The market-report block did not: flipping the switch
 * on and picking areas wrote NOTHING unless the user also found a separate
 * "Save market report preferences" button. Reload, and the subscription was
 * gone with no error, no toast, no failed request.
 *
 * These tests drive the real component (React + jsdom, server actions mocked)
 * and assert the persistence behavior, not the markup:
 *
 *   1. switch on + four chips  -> exactly ONE write carrying all four areas
 *   2. switch on + zero chips  -> NO write (the DAL refuses that row) and the
 *      intent stays on screen with a visible prompt instead of vanishing
 *   3. switch off              -> writes the off state
 *
 * Test 1 and 3 both fail against the pre-fix component (zero writes).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'

type SetInput = { areas: string[], frequency: string, isActive: boolean }

const AREAS = [
  { slug: 'river-west', label: 'River West' },
  { slug: 'old-bend', label: 'Old Bend' },
  { slug: 'bend', label: 'Bend' },
  { slug: 'redmond', label: 'Redmond' },
]

/** What getMyReportSubscriptionAction returns for the next mount. */
let currentSubscription: SetInput | null = null

const setSpy = vi.fn(async (input: SetInput) => ({
  data: { areas: input.areas, frequency: input.frequency, isActive: input.isActive },
  error: null as string | null,
}))

vi.mock('@/app/actions/market-report-optin', () => ({
  getMyReportSubscriptionAction: async () => ({
    data: { subscription: currentSubscription, areas: AREAS },
    error: null,
  }),
  setMyReportSubscriptionAction: (input: SetInput) => setSpy(input),
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => {} }) }))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))
vi.mock('@/app/actions/profile', () => ({ updateProfile: async () => ({ error: null }) }))
vi.mock('@/app/actions/saved-searches', () => ({
  setSavedSearchFrequencyForUser: async () => ({ error: null }),
}))

import DashboardNotificationPrefs, {
  planMarketReportSave,
  sameReportAreas,
  MARKET_REPORT_AUTOSAVE_MS,
  type MarketReportDraft,
} from '@/components/dashboard/DashboardNotificationPrefs'

// jsdom ships neither of these and radix touches both on mount paths.
class NoopResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
;(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver ??= NoopResizeObserver
;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let container: HTMLDivElement
let root: Root | null = null

async function mount() {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  await act(async () => {
    root!.render(React.createElement(DashboardNotificationPrefs, { initialPrefs: {} }))
  })
  // Flush the mount fetch of the subscription + area options.
  await act(async () => {})
}

/**
 * Always torn down in afterEach. A tree left in the document keeps its
 * duplicate #market-report-switch id, and jsdom resolves an id selector against
 * the document before scoping, so the next test would query the stale node.
 */
function unmount() {
  if (!root) return
  const r = root
  root = null
  act(() => r.unmount())
  container.remove()
}

/** Wait past the autosave debounce and let the write settle. */
async function settle() {
  await act(async () => {
    vi.advanceTimersByTime(MARKET_REPORT_AUTOSAVE_MS + 50)
  })
  await act(async () => {})
}

function marketSwitch(): HTMLButtonElement {
  const el = container.querySelector<HTMLButtonElement>('#market-report-switch')
  if (!el) throw new Error('market report switch not rendered')
  return el
}

function chip(label: string): HTMLButtonElement {
  const el = Array.from(container.querySelectorAll<HTMLButtonElement>('button[aria-pressed]')).find(
    (b) => b.textContent?.trim() === label,
  )
  if (!el) throw new Error(`area chip not rendered: ${label}`)
  return el
}

async function click(el: HTMLElement) {
  await act(async () => {
    el.click()
  })
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  setSpy.mockClear()
  currentSubscription = null
})

afterEach(() => {
  unmount()
  vi.useRealTimers()
})

describe('market report emails — autosave', () => {
  it('flipping the switch on and picking four areas writes once, with all four', async () => {
    await mount()

    await click(marketSwitch())
    await click(chip('River West'))
    await click(chip('Old Bend'))
    await click(chip('Bend'))
    await click(chip('Redmond'))
    await settle()

    // The whole point of the debounce: four chips is ONE write.
    expect(setSpy).toHaveBeenCalledTimes(1)
    const written = setSpy.mock.calls[0]![0]
    expect(written.isActive).toBe(true)
    expect([...written.areas].sort()).toEqual(['bend', 'old-bend', 'redmond', 'river-west'])
  })

  it('switching on with no area picked writes nothing and keeps the intent visible', async () => {
    await mount()

    await click(marketSwitch())
    await settle()

    // An active subscription with zero areas is refused by the DAL. Do not send it.
    expect(setSpy).not.toHaveBeenCalled()
    // The switch stays on and the user is told what is missing. Not silent loss.
    expect(marketSwitch().getAttribute('data-state')).toBe('checked')
    expect(container.textContent).toContain('Pick at least one area')

    // Picking an area resolves the hold and the write lands.
    await click(chip('Bend'))
    await settle()
    expect(setSpy).toHaveBeenCalledTimes(1)
    expect(setSpy.mock.calls[0]![0]).toMatchObject({ isActive: true, areas: ['bend'] })
    expect(container.textContent).not.toContain('Pick at least one area')
  })

  it('switching an existing subscription off persists the off state', async () => {
    currentSubscription = { areas: ['bend'], frequency: 'monthly', isActive: true }
    await mount()

    // Loading an existing subscription must not write on its own.
    await settle()
    expect(setSpy).not.toHaveBeenCalled()

    await click(marketSwitch())
    await settle()
    expect(setSpy).toHaveBeenCalledTimes(1)
    expect(setSpy.mock.calls[0]![0]).toMatchObject({ isActive: false, areas: ['bend'] })
  })

  it('unmounting inside the debounce window still lands the write', async () => {
    await mount()

    await click(marketSwitch())
    await click(chip('Redmond'))
    // No settle: navigate away while the debounce timer is still counting.
    unmount()
    await act(async () => {})

    expect(setSpy).toHaveBeenCalledTimes(1)
    expect(setSpy.mock.calls[0]![0]).toMatchObject({ isActive: true, areas: ['redmond'] })
  })
})

describe('planMarketReportSave', () => {
  const off: MarketReportDraft = { areas: [], frequency: 'monthly', isActive: false }

  it('is idle when nothing changed', () => {
    expect(planMarketReportSave(off, off).kind).toBe('idle')
  })

  it('holds an active draft with no areas rather than writing a broken row', () => {
    expect(planMarketReportSave({ ...off, isActive: true }, off).kind).toBe('hold')
  })

  it('writes an active draft that has areas', () => {
    expect(planMarketReportSave({ areas: ['bend'], frequency: 'monthly', isActive: true }, off).kind)
      .toBe('write')
  })

  it('writes when only the frequency changed', () => {
    const saved: MarketReportDraft = { areas: ['bend'], frequency: 'monthly', isActive: true }
    expect(planMarketReportSave({ ...saved, frequency: 'weekly' }, saved).kind).toBe('write')
  })

  it('treats area order as meaningless, so a reorder is not a write', () => {
    const saved: MarketReportDraft = { areas: ['bend', 'redmond'], frequency: 'weekly', isActive: true }
    expect(planMarketReportSave({ ...saved, areas: ['redmond', 'bend'] }, saved).kind).toBe('idle')
    expect(sameReportAreas(['a', 'b'], ['b', 'a'])).toBe(true)
    expect(sameReportAreas(['a'], ['a', 'b'])).toBe(false)
  })
})
