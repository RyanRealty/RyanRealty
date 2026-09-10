import { describe, expect, it } from 'vitest'
import type { ActivityFeedItem } from '@/app/actions/activity-feed-shared'
import { activityRows } from './activity-rows'

const ASSET = '20260501165710852242000000-o.jpg'

function item(partial: Partial<ActivityFeedItem> & { id: string; listing_key: string }): ActivityFeedItem {
  return {
    event_type: 'new_listing',
    event_at: '2026-09-09T12:00:00.000Z',
    ListPrice: 364_000,
    StreetNumber: '835',
    StreetName: 'Cherry',
    StreetSuffix: 'St',
    City: 'Medford',
    ListNumber: '220000001',
    ...partial,
  }
}

describe('activityRows', () => {
  it('asks Spark for the size the row draws, keeping this listing’s asset', () => {
    const spark = `https://cdn.resize.sparkplatform.com/ore/1600x1200/true/${ASSET}`
    const [row] = activityRows([item({ id: 'a', listing_key: 'k1', PhotoURL: spark })])
    expect(row?.media?.src).toBe(`https://cdn.resize.sparkplatform.com/ore/320x240/true/${ASSET}`)
    expect(row?.media?.src?.endsWith(ASSET)).toBe(true)
  })

  it('leaves a non-Spark host alone rather than guessing a resize path', () => {
    const other = 'https://photos.example-mls.com/1600x1200/abc.jpg'
    const [row] = activityRows([item({ id: 'b', listing_key: 'k2', PhotoURL: other })])
    expect(row?.media?.src).toBe(other)
  })

  it('gives a row with no photograph no img src', () => {
    const [none] = activityRows([item({ id: 'c', listing_key: 'k3', PhotoURL: null })])
    expect(none?.media).toBeUndefined()
    const [blank] = activityRows([item({ id: 'd', listing_key: 'k4', PhotoURL: '  ' })])
    expect(blank?.media).toBeUndefined()
  })
})
