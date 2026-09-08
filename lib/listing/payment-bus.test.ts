import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  __resetPaymentBus,
  publishPayment,
  readPayment,
  readPaymentServer,
  subscribePayment,
  type PaymentSnapshot,
} from '@/lib/listing/payment-bus'

const snap = (over: Partial<PaymentSnapshot> = {}): PaymentSnapshot => ({
  listingKey: 'KEY1',
  price: 699900,
  downPct: 20,
  ratePct: 6.5,
  termYears: 30,
  insuranceAnnual: null,
  total: 4182,
  ...over,
})

describe('payment bus', () => {
  beforeEach(() => __resetPaymentBus())

  it('starts empty, and the server render always reads empty', () => {
    expect(readPayment()).toBeNull()
    publishPayment(snap())
    // useSyncExternalStore's server snapshot must not invent a client value.
    expect(readPaymentServer()).toBeNull()
  })

  it('notifies subscribers on a real change', () => {
    const seen = vi.fn()
    subscribePayment(seen)
    publishPayment(snap())
    expect(seen).toHaveBeenCalledTimes(1)
    expect(readPayment()?.total).toBe(4182)
    publishPayment(snap({ downPct: 25, total: 3900 }))
    expect(seen).toHaveBeenCalledTimes(2)
    expect(readPayment()?.downPct).toBe(25)
  })

  it('does NOT notify when nothing changed', () => {
    // The calculator publishes from an effect on every render. Without this the
    // subscriber re-renders forever.
    const seen = vi.fn()
    subscribePayment(seen)
    publishPayment(snap())
    publishPayment(snap())
    publishPayment(snap())
    expect(seen).toHaveBeenCalledTimes(1)
  })

  it('keeps snapshot identity stable between publishes', () => {
    publishPayment(snap())
    expect(readPayment()).toBe(readPayment())
  })

  it('unsubscribes cleanly', () => {
    const seen = vi.fn()
    const off = subscribePayment(seen)
    off()
    publishPayment(snap())
    expect(seen).not.toHaveBeenCalled()
  })

  it('carries the listing key so a stale snapshot cannot cross homes', () => {
    publishPayment(snap({ listingKey: 'KEY1' }))
    expect(readPayment()?.listingKey).toBe('KEY1')
    publishPayment(snap({ listingKey: 'KEY2', total: 5000 }))
    expect(readPayment()?.listingKey).toBe('KEY2')
  })
})
