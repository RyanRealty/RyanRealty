import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ASK_SOURCE_KEY,
  clearAskSource,
  isAskSource,
  markAskSource,
  peekAskSource,
  readAskSource,
  withAskSource,
} from './ask-source'

/**
 * The tests run in the `node` environment, so there is no sessionStorage until
 * one is installed. That is the point: every case below also proves the module
 * survives the environment where storage is missing or throws, which is the
 * real-world case (Safari private mode, blocked site data) that would otherwise
 * take down the form this instruments.
 */
function installStorage(): Map<string, string> {
  const map = new Map<string, string>()
  const store: Storage = {
    get length() {
      return map.size
    },
    clear: () => map.clear(),
    getItem: (k: string) => map.get(k) ?? null,
    key: (i: number) => [...map.keys()][i] ?? null,
    removeItem: (k: string) => void map.delete(k),
    setItem: (k: string, v: string) => void map.set(k, v),
  }
  Object.defineProperty(globalThis, 'sessionStorage', {
    value: store,
    configurable: true,
    writable: true,
  })
  return map
}

function installThrowingStorage() {
  Object.defineProperty(globalThis, 'sessionStorage', {
    get() {
      throw new DOMException('The operation is insecure.', 'SecurityError')
    },
    configurable: true,
  })
}

function removeStorage() {
  Reflect.deleteProperty(globalThis as object, 'sessionStorage')
}

afterEach(() => {
  removeStorage()
  vi.restoreAllMocks()
})

describe('ask-source · the stamp', () => {
  beforeEach(() => {
    installStorage()
  })

  it('writes the source under the documented key', () => {
    markAskSource('sticky')
    expect(sessionStorage.getItem(ASK_SOURCE_KEY)).toBe('sticky')
    expect(ASK_SOURCE_KEY).toBe('rr_ask_source')
  })

  it('peek returns the stamp and LEAVES it', () => {
    markAskSource('sticky')
    expect(peekAskSource()).toBe('sticky')
    expect(peekAskSource()).toBe('sticky')
  })

  it('read returns the stamp and CLEARS it — one click, one attributed submit', () => {
    markAskSource('sticky')
    expect(readAskSource()).toBe('sticky')
    expect(readAskSource()).toBeNull()
    expect(sessionStorage.getItem(ASK_SOURCE_KEY)).toBeNull()
  })

  it('refuses a value outside the closed union, so GA4 never sees free text', () => {
    sessionStorage.setItem(ASK_SOURCE_KEY, 'wherever')
    expect(peekAskSource()).toBeNull()
    expect(isAskSource('wherever')).toBe(false)
    expect(isAskSource('sticky')).toBe(true)
  })

  it('clear is safe with nothing stored', () => {
    expect(() => clearAskSource()).not.toThrow()
    expect(readAskSource()).toBeNull()
  })

  it('the last control to stamp wins', () => {
    markAskSource('hero')
    markAskSource('sticky')
    expect(readAskSource()).toBe('sticky')
  })
})

describe('ask-source · the payload', () => {
  beforeEach(() => {
    installStorage()
  })

  it('merges the stamp into a GA4 payload', () => {
    markAskSource('sticky')
    expect(withAskSource({ form: 'sell' })).toEqual({ form: 'sell', source: 'sticky' })
  })

  it('leaves an unattributed payload untouched — no source: undefined key', () => {
    const payload = { form: 'sell' }
    const merged = withAskSource(payload)
    expect(merged).toEqual({ form: 'sell' })
    expect('source' in merged).toBe(false)
  })

  it('does NOT consume, so one read can feed the event and the metadata', () => {
    markAskSource('sticky')
    const source = readAskSource()
    expect(withAskSource({ a: 1 }, source)).toEqual({ a: 1, source: 'sticky' })
    expect(withAskSource({ b: 2 }, source)).toEqual({ b: 2, source: 'sticky' })
  })

  it('an explicit null beats what is in storage', () => {
    markAskSource('sticky')
    expect(withAskSource({ a: 1 }, null)).toEqual({ a: 1 })
  })
})

describe('ask-source · hostile environments', () => {
  it('is inert with no sessionStorage at all (SSR, node)', () => {
    removeStorage()
    expect(() => markAskSource('sticky')).not.toThrow()
    expect(peekAskSource()).toBeNull()
    expect(readAskSource()).toBeNull()
    expect(withAskSource({ a: 1 })).toEqual({ a: 1 })
  })

  it('survives an accessor that THROWS (private mode / blocked site data)', () => {
    installThrowingStorage()
    expect(() => markAskSource('sticky')).not.toThrow()
    expect(() => clearAskSource()).not.toThrow()
    expect(readAskSource()).toBeNull()
    expect(withAskSource({ a: 1 })).toEqual({ a: 1 })
  })

  it('survives setItem throwing (quota)', () => {
    installStorage()
    vi.spyOn(sessionStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError')
    })
    expect(() => markAskSource('sticky')).not.toThrow()
    expect(readAskSource()).toBeNull()
  })
})
