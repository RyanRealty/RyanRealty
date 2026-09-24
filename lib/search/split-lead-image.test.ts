import { describe, expect, it } from 'vitest'
import { splitLeadImageUrl } from './split-lead-image'

const SPARK = 'https://cdn.resize.sparkplatform.com/ore/1600x1200/true/20240101-abc.jpg'

describe('splitLeadImageUrl', () => {
  it('names the first card photo at the size the card renders', () => {
    expect(splitLeadImageUrl([{ PhotoURL: SPARK }, { PhotoURL: 'https://x/y.jpg' }])).toBe(
      'https://cdn.resize.sparkplatform.com/ore/320x240/true/20240101-abc.jpg',
    )
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
