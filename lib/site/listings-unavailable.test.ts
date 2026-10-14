import { describe, expect, it, vi } from 'vitest'
import {
  ListingsUnavailableError,
  readOrRefuseListings,
  refuseEmptyFailedListings,
  refuseUnavailableListings,
} from './listings-unavailable'

describe('refuseUnavailableListings', () => {
  it('lets a successful read through', () => {
    expect(() => refuseUnavailableListings(true, 'comm:list')).not.toThrow()
  })

  it('throws a typed error when the read did not answer', () => {
    expect(() => refuseUnavailableListings(false, 'comm:body-community tetherow')).toThrow(
      ListingsUnavailableError,
    )
    try {
      refuseUnavailableListings(false, 'comm:body-community tetherow')
    } catch (err) {
      expect(err).toBeInstanceOf(ListingsUnavailableError)
      expect((err as ListingsUnavailableError).message).toBe(
        '[listings-unavailable] comm:body-community tetherow',
      )
      expect((err as ListingsUnavailableError).code).toBe('LISTINGS_UNAVAILABLE')
    }
  })
})

describe('refuseEmptyFailedListings', () => {
  it('allows a genuine empty market (the read finished)', () => {
    expect(() => refuseEmptyFailedListings({ complete: true, tiles: [] }, 'comm:population')).not.toThrow()
  })

  it('allows a partial read that still has homes', () => {
    expect(() =>
      refuseEmptyFailedListings({ complete: false, tiles: [{ listingKey: '1' }] }, 'comm:population'),
    ).not.toThrow()
  })

  it('refuses a timed-out read that produced no homes', () => {
    expect(() => refuseEmptyFailedListings({ complete: false, tiles: [] }, 'comm:population sunriver')).toThrow(
      /comm:population sunriver/,
    )
  })
})

describe('readOrRefuseListings', () => {
  it('returns the first successful value', async () => {
    const start = vi.fn(async () => ({ ok: true as const, value: { slug: 'tetherow' } }))
    await expect(readOrRefuseListings(start, 'comm:body-community')).resolves.toEqual({ slug: 'tetherow' })
    expect(start).toHaveBeenCalledTimes(1)
  })

  it('retries once after a miss and returns the second value', async () => {
    const start = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, value: null })
      .mockResolvedValueOnce({ ok: true, value: { slug: 'sunriver' } })
    await expect(readOrRefuseListings(start, 'comm:body-community')).resolves.toEqual({ slug: 'sunriver' })
    expect(start).toHaveBeenCalledTimes(2)
  })

  it('throws after a miss and a missed retry so the failure is not cached', async () => {
    const start = vi.fn(async () => ({ ok: false as const, value: null }))
    await expect(readOrRefuseListings(start, 'comm:population bend')).rejects.toBeInstanceOf(
      ListingsUnavailableError,
    )
    expect(start).toHaveBeenCalledTimes(2)
  })
})
