import { describe, expect, it } from 'vitest'
import { isPlanRenderingCaption, publishListingPhotoCaption } from './listing-photo-caption'

describe('publishListingPhotoCaption', () => {
  it('labels a plan rendering as a plan, not listed condition', () => {
    expect(isPlanRenderingCaption('rendering of approved house plan')).toBe(true)
    expect(publishListingPhotoCaption('rendering of approved house plan')).toBe(
      'Plan. Approved house plan. Not listed condition.',
    )
  })

  it('leaves a lot photo caption alone', () => {
    expect(publishListingPhotoCaption('View west from the lot')).toBe('View west from the lot')
    expect(isPlanRenderingCaption('View west from the lot')).toBe(false)
  })

  it('does not invent a caption when the feed has none', () => {
    expect(publishListingPhotoCaption(null)).toBeNull()
    expect(publishListingPhotoCaption('  ')).toBeNull()
  })
})
