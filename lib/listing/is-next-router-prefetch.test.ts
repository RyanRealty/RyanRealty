import { describe, expect, it } from 'vitest'
import {
  NEXT_ROUTER_PREFETCH_HEADER,
  isFlightSearchParams,
  isNextRouterPrefetchFromHeaders,
} from './is-next-router-prefetch'

function headers(map: Record<string, string | null>) {
  return (name: string) => map[name] ?? null
}

describe('isNextRouterPrefetchFromHeaders', () => {
  it('is false on a browser document navigation (Accept includes text/html)', () => {
    expect(
      isNextRouterPrefetchFromHeaders(
        headers({
          accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        }),
      ),
    ).toBe(false)
    expect(isNextRouterPrefetchFromHeaders(headers({}))).toBe(false)
  })

  it('is true for loading-boundary and PPR runtime prefetch headers when they survive', () => {
    expect(
      isNextRouterPrefetchFromHeaders(
        headers({
          [NEXT_ROUTER_PREFETCH_HEADER]: '1',
          rsc: '1',
        }),
      ),
    ).toBe(true)
    expect(
      isNextRouterPrefetchFromHeaders(
        headers({
          [NEXT_ROUTER_PREFETCH_HEADER]: '2',
        }),
      ),
    ).toBe(true)
  })

  it('is true for Flight fetches even when Next has stripped rsc (Accept is */* or text/x-component)', () => {
    expect(
      isNextRouterPrefetchFromHeaders(
        headers({
          accept: '*/*',
        }),
      ),
    ).toBe(true)
    expect(
      isNextRouterPrefetchFromHeaders(
        headers({
          accept: 'text/x-component',
        }),
      ),
    ).toBe(true)
  })
})

describe('isFlightSearchParams', () => {
  it('is true when Next appended the _rsc cache-busting param', () => {
    expect(isFlightSearchParams({ _rsc: 'wxbjl' })).toBe(true)
    expect(isFlightSearchParams({ city: 'medford' })).toBe(false)
    expect(isFlightSearchParams(undefined)).toBe(false)
  })
})
