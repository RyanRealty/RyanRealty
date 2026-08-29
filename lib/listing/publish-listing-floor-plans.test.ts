import { describe, expect, it } from 'vitest'
import {
  isListingFloorPlanCaption,
  publishListingFloorPlans,
} from './publish-listing-floor-plans'

describe('publishListingFloorPlans', () => {
  it('1564 Elgin: one Spark FloorPlans URI becomes one still', () => {
    const plans = publishListingFloorPlans({
      sparkFloorPlans: [
        {
          Uri: 'https://cdn.photos.sparkplatform.com/ore/20260723144810522398000000-o.png',
          Caption: '',
        },
      ],
    })
    expect(plans).toEqual([
      {
        url: 'https://cdn.photos.sparkplatform.com/ore/20260723144810522398000000-o.png',
        caption: null,
        order: 0,
      },
    ])
  })

  it('1415 Elgin: FloorPlansCount without a URI does not invent a plan', () => {
    expect(publishListingFloorPlans({ sparkFloorPlans: [] })).toEqual([])
    expect(publishListingFloorPlans({ sparkFloorPlans: [{ Caption: 'Plan' }] })).toEqual([])
  })

  it('keeps a still whose caption names a floor plan', () => {
    const plans = publishListingFloorPlans({
      photos: [
        { url: 'https://cdn.example.com/living.jpg', caption: 'Living room' },
        { url: 'https://cdn.example.com/plan.png', caption: 'Floor plan' },
      ],
    })
    expect(plans.map((p) => p.url)).toEqual(['https://cdn.example.com/plan.png'])
  })
})

describe('isListingFloorPlanCaption', () => {
  it('matches floor plan copy and classification only', () => {
    expect(isListingFloorPlanCaption('Floor plan')).toBe(true)
    expect(isListingFloorPlanCaption(null, 'floor_plan')).toBe(true)
    expect(isListingFloorPlanCaption('Kitchen')).toBe(false)
  })
})
