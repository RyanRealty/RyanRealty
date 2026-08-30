import { describe, it, expect, beforeEach } from 'vitest'

// Give the module a browser-like window + sessionStorage in the node test env.
const store = new Map<string, string>()
const listeners = new Map<string, Array<EventListener>>()
;(globalThis as unknown as { window: unknown }).window = {
  sessionStorage: {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  },
  addEventListener: (type: string, fn: EventListener) => {
    const list = listeners.get(type) ?? []
    list.push(fn)
    listeners.set(type, list)
  },
  dispatchEvent: (event: Event) => {
    for (const fn of listeners.get(event.type) ?? []) fn(event)
    return true
  },
  location: { href: '/', pathname: '/', search: '' },
}

import { stashPendingSave, consumePendingSave, redirectToLoginForSave } from './pending-save'
import { RR_OPEN_SIGNIN, RR_OPEN_SIGNIN_FLAG } from './auth/google-gis'

describe('pending-save (RC7)', () => {
  beforeEach(() => store.clear())

  it('consumes a matching pending save exactly once', () => {
    stashPendingSave('LK-1')
    expect(consumePendingSave('LK-1')).toBe(true)
    // consumed → a second consume for the same key is false (fires once)
    expect(consumePendingSave('LK-1')).toBe(false)
  })

  it('does not consume a different listing and leaves the flag intact', () => {
    stashPendingSave('LK-1')
    expect(consumePendingSave('LK-2')).toBe(false)
    // the real listing still resumes afterward
    expect(consumePendingSave('LK-1')).toBe(true)
  })

  it('returns false when nothing is stashed', () => {
    expect(consumePendingSave('LK-1')).toBe(false)
  })

  it('a re-stash after a consume (the logged-out-return case) resumes on the next try', () => {
    stashPendingSave('LK-1')
    expect(consumePendingSave('LK-1')).toBe(true) // consumed by a resume that then hit needsAuth
    stashPendingSave('LK-1') // hook re-stashes because the session wasn't ready
    expect(consumePendingSave('LK-1')).toBe(true) // next return completes it
  })

  it('keeps the saver on this page and opens the Google continue sheet', () => {
    const events: string[] = []
    window.addEventListener(RR_OPEN_SIGNIN, () => events.push('open'))
    ;(window as unknown as { location: { href: string; pathname: string; search: string } }).location = {
      href: '/homes-for-sale/bend/x',
      pathname: '/homes-for-sale/bend/x',
      search: '',
    }
    redirectToLoginForSave('LK-1')
    expect(events).toEqual(['open'])
    expect(store.get(RR_OPEN_SIGNIN_FLAG)).toBe('1')
    expect(window.location.href).not.toContain('/login')
  })
})
