/**
 * deriveFallbackSendKey — the ledger key a send gets when the composer supplied
 * none (SmsComposer leaves the field blank until it hydrates, and a submit in
 * that window used to reach Twilio with no idempotency row at all).
 *
 * What these pin is the ONE property that matters on a send path: the same
 * message collapses, a different message never does. A false collapse silently
 * eats a real text to a client; a false miss sends it twice.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { deriveFallbackSendKey } from './idempotency'

const AT = (ms: number) => vi.setSystemTime(new Date(ms))

afterEach(() => vi.useRealTimers())

describe('deriveFallbackSendKey', () => {
  it('is stable for the same send inside one bucket — the double-submit case', () => {
    vi.useFakeTimers()
    AT(10_000) // bucket-ALIGNED; see the straddle test below for why that matters
    const a = deriveFallbackSendKey([11784, 'On my way', '', '', ''])
    AT(19_999) // last millisecond of the same 10s bucket
    expect(deriveFallbackSendKey([11784, 'On my way', '', '', ''])).toBe(a)
  })

  it('rolls to a new key in the next bucket — a deliberate re-send goes through', () => {
    vi.useFakeTimers()
    AT(0)
    const a = deriveFallbackSendKey([11784, 'On my way', '', '', ''])
    AT(10_000)
    expect(deriveFallbackSendKey([11784, 'On my way', '', '', ''])).not.toBe(a)
  })

  it('KNOWN LIMIT: submits straddling a bucket edge do NOT collapse', () => {
    // Documented in deriveFallbackSendKey, pinned here so it stays a known
    // trade-off rather than becoming a surprise. The residual failure is a
    // VISIBLE duplicate, which is the side of the trade we chose: a false
    // collapse would silently swallow a real message, because a ledger hit
    // replays the stored result and the broker sees success.
    vi.useFakeTimers()
    AT(9_999)
    const a = deriveFallbackSendKey([11784, 'On my way', '', '', ''])
    AT(10_001) // 2ms later, next bucket
    expect(deriveFallbackSendKey([11784, 'On my way', '', '', ''])).not.toBe(a)
  })

  it('separates a different BODY in the same bucket', () => {
    vi.useFakeTimers()
    AT(1_000_000)
    expect(deriveFallbackSendKey([11784, 'On my way', '', '', ''])).not.toBe(
      deriveFallbackSendKey([11784, 'Running late', '', '', '']),
    )
  })

  it('separates a different PERSON sent the identical body', () => {
    vi.useFakeTimers()
    AT(1_000_000)
    expect(deriveFallbackSendKey([11784, 'On my way', '', '', ''])).not.toBe(
      deriveFallbackSendKey([60863, 'On my way', '', '', '']),
    )
  })

  it('separates a different RECIPIENT SET — the group-thread case', () => {
    vi.useFakeTimers()
    AT(1_000_000)
    // Same primary contact and body, one extra member: a different carrier group.
    expect(deriveFallbackSendKey([11784, 'Meet at 4', '60863', '', ''])).not.toBe(
      deriveFallbackSendKey([11784, 'Meet at 4', '60863,60864', '', '']),
    )
  })

  it('separates a different ATTACHMENT set', () => {
    vi.useFakeTimers()
    AT(1_000_000)
    expect(deriveFallbackSendKey([11784, 'Photos', '', '', 'a.jpg'])).not.toBe(
      deriveFallbackSendKey([11784, 'Photos', '', '', 'a.jpg,b.jpg']),
    )
  })

  it('cannot be collided by shifting content across adjacent fields', () => {
    vi.useFakeTimers()
    AT(1_000_000)
    // Without a delimiter, ['ab',''] and ['a','b'] would hash identically and one
    // real send would silently swallow the other.
    expect(deriveFallbackSendKey([1, 'ab', '', '', ''])).not.toBe(
      deriveFallbackSendKey([1, 'a', 'b', '', '']),
    )
  })

  it('is namespaced so it can never be mistaken for a client-supplied key', () => {
    vi.useFakeTimers()
    AT(1_000_000)
    expect(deriveFallbackSendKey([11784, 'hi', '', '', ''])).toMatch(/^auto:[0-9a-f]{32}$/)
  })
})
