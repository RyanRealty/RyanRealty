import { describe, it, expect } from 'vitest'
import { mergeFrozenMedia, type HeldMedia } from './frozenMedia'

const photos = (n: number) => Array.from({ length: n }, (_, i) => ({ Id: `p${i}`, Uri1600: `https://img/${i}.jpg` }))

function held(n: number): HeldMedia {
  return {
    PhotoURL: 'https://img/held.jpg',
    has_virtual_tour: true,
    OpenHouses: [{ Date: '2026-03-01' }],
    details: { Photos: photos(n), VirtualTours: [{ Uri: 'https://tour' }], OpenHouses: [{ Date: '2026-03-01' }] },
  }
}

function mapped(n: number): Record<string, unknown> {
  return {
    ListNumber: '220192362',
    PhotoURL: n > 0 ? 'https://img/mls.jpg' : null,
    has_virtual_tour: false,
    OpenHouses: null,
    media_finalized: true,
    details: { PropertySubType: 'Single Family Residence', Photos: photos(n), VirtualTours: [], OpenHouses: [] },
  }
}

describe('mergeFrozenMedia', () => {
  it('keeps the gallery we hold when the MLS now serves fewer photos', () => {
    const row = mergeFrozenMedia(mapped(1), held(48))
    const d = row.details as Record<string, unknown>
    expect((d.Photos as unknown[]).length).toBe(48)
    expect(row.PhotoURL).toBe('https://img/held.jpg')
    expect(row.has_virtual_tour).toBe(true)
    expect(row.OpenHouses).toEqual([{ Date: '2026-03-01' }])
    expect(d.PropertySubType).toBe('Single Family Residence')
  })

  it('takes the MLS gallery when it is at least as large', () => {
    const row = mergeFrozenMedia(mapped(48), held(5))
    expect(((row.details as Record<string, unknown>).Photos as unknown[]).length).toBe(48)
    expect(row.PhotoURL).toBe('https://img/mls.jpg')
  })

  it('never drops a column: the row keeps every media key it came with', () => {
    const before = Object.keys(mapped(0)).sort()
    const row = mergeFrozenMedia(mapped(0), held(3))
    expect(Object.keys(row).sort()).toEqual(before)
    expect(row.media_finalized).toBe(true)
  })
})
