import { describe, it, expect, beforeEach } from 'vitest'

// Give the module a browser-like window + sessionStorage in the node test env.
const store = new Map<string, string>()
;(globalThis as unknown as { window: unknown }).window = {
  sessionStorage: {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  },
}

import { stashPendingSave, consumePendingSave } from './pending-save'

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
})
