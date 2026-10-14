/**
 * getListingMlsVideosByKeys with the database stubbed: the ODS / suppression
 * flags drop a listing, a mail-scanner link is unwrapped, and a single
 * sentinel-stamped record takes its date from listing_history.
 */
import { describe, expect, it, vi } from 'vitest'

const { LISTINGS, HISTORY, PLACES, calls } = vi.hoisted(() => {
  const EPOCH = '1970-01-01T00:00:00Z'
  const vimeo = (id: string) => `<iframe src="https://player.vimeo.com/video/${id}" width="640"></iframe>`
  const row = (key: string, over: Record<string, unknown> = {}) => ({
    ListingKey: key,
    PhotoURL: `https://cdn.resize.sparkplatform.com/ore/320x240/true/${key}-o.jpg`,
    media_suppressed: false,
    permit_internet_yn: true,
    permit_address_internet_yn: null,
    idx_participant: true,
    virtual_tour_url: null,
    Videos: [{ ObjectHtml: vimeo(key.slice(-3)), ModificationTimestamp: '2025-02-02T02:02:02Z' }],
    VirtualTours: null,
    ...over,
  })
  return {
    calls: [] as string[],
    LISTINGS: [
      row('k100'),
      row('k200', { media_suppressed: true }),
      row('k300', { permit_internet_yn: false }),
      row('k400', { idx_participant: false }),
      row('k500', { permit_address_internet_yn: false }),
      row('k600', { Videos: [{ ObjectHtml: vimeo('600'), ModificationTimestamp: EPOCH }] }),
      row('k700', {
        Videos: null,
        virtual_tour_url:
          'https://nam12.safelinks.protection.outlook.com/?url=https%3A%2F%2Fmy.matterport.com%2Fshow%2F%3Fm%3Dabc&data=05%7C02%7Cbroker%40example.com&reserved=0',
      }),
    ],
    PLACES: [
      {
        ListingKey: 'k100',
        StreetNumber: '2750',
        StreetName: 'Great Horned',
        City: 'Bend',
        ListOfficeName: 'Example Realty',
        StreetDirPrefix: 'NE',
        StreetSuffix: 'Place',
        StreetDirSuffix: null,
      },
    ],
    HISTORY: [
      { listing_key: 'k600', event: 'Video', event_date: '2026-09-09T00:12:13Z' },
      { listing_key: 'k600', event: 'Video', event_date: '2026-09-10T19:57:14Z' },
    ],
  }
})

vi.mock('@/lib/data/client', () => {
  const builder = (table: string) => {
    let columns = ''
    const result = () =>
      table === 'listing_history'
        ? { data: HISTORY, error: null }
        : columns.includes('StreetDirPrefix')
          ? { data: PLACES, error: null }
          : { data: LISTINGS, error: null }
    const chain: Record<string, unknown> = {}
    for (const m of ['in', 'or', 'eq', 'order', 'limit']) chain[m] = () => chain
    chain.select = (cols: string) => {
      columns = cols
      return chain
    }
    chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result()).then(resolve)
    return chain
  }
  return {
    supabaseAnon: () => ({
      from: (table: string) => {
        calls.push(table)
        return builder(table)
      },
    }),
  }
})

import { getListingMlsVideosByKeys, getListingVideoPlacesByKeys } from './getListingMlsVideos'

describe('getListingMlsVideosByKeys', () => {
  it('drops suppressed, internet opt-out, address opt-out and non-IDX listings', async () => {
    const out = await getListingMlsVideosByKeys(LISTINGS.map((r) => r.ListingKey))
    for (const key of ['k200', 'k300', 'k400', 'k500']) expect(out.has(key)).toBe(false)
    expect(out.get('k100')?.videos[0]).toMatchObject({
      embedType: 'iframe',
      url: expect.stringContaining('player.vimeo.com/video/100'),
      uploadDate: '2025-02-02T02:02:02.000Z',
    })
  })

  it('dates the single sentinel-stamped video from the latest Video history event', async () => {
    const out = await getListingMlsVideosByKeys(['k600'])
    expect(out.get('k600')?.videos[0].uploadDate).toBe('2026-09-10T19:57:14.000Z')
    expect(calls).toContain('listing_history')
  })

  it('unwraps a SafeLinks tour stored in virtual_tour_url', async () => {
    const out = await getListingMlsVideosByKeys(['k700'])
    const json = JSON.stringify(out.get('k700'))
    expect(json).toContain('https://my.matterport.com/show/?m=abc')
    expect(json).not.toMatch(/safelinks|example\.com|%40/)
  })

  it('names the street line the listing page prints, with the MLS directional and suffix, and the brokerage', async () => {
    const places = await getListingVideoPlacesByKeys(['k100'])
    expect(places.get('k100')).toEqual({ street: '2750 NE Great Horned Place', city: 'Bend', listOfficeName: 'Example Realty' })
  })
})
