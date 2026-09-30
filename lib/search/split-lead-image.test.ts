import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { splitLeadImageUrl } from './split-lead-image'

const SPARK = 'https://cdn.resize.sparkplatform.com/ore/1600x1200/true/20240101-abc.jpg'

describe('splitLeadImageUrl', () => {
  it('names the first card photo at the size the card renders', () => {
    expect(splitLeadImageUrl([{ PhotoURL: SPARK }, { PhotoURL: 'https://x/y.jpg' }])).toBe(
      'https://cdn.resize.sparkplatform.com/ore/800x600/true/20240101-abc.jpg',
    )
  })
  it('uses the size SplitCardMedia paints, so JSON-LD names the exact <img> src', () => {
    const media = readFileSync('components/site/v3/SplitCardMedia.tsx', 'utf8')
    expect(media).toMatch(/listingRowPhotoSrc\(url, LISTING_FIELD_LEAD_PHOTO_SIZE\)/)
  })
  it('prefers photoUrls[0], as the card does', () => {
    expect(splitLeadImageUrl([{ PhotoURL: 'https://a/b.jpg', photoUrls: ['https://c/d.jpg'] }])).toBe('https://c/d.jpg')
  })
  it('is null when the page shows no card or the first card has no photo', () => {
    expect(splitLeadImageUrl([])).toBeNull()
    expect(splitLeadImageUrl([{ PhotoURL: null }, { PhotoURL: SPARK }])).toBeNull()
    expect(splitLeadImageUrl([{ PhotoURL: '  ' }])).toBeNull()
  })
})
