import { describe, expect, it } from 'vitest'
import { resolveCmaMarketTargets } from '@/lib/cma/market'

describe('resolveCmaMarketTargets', () => {
  it('uses the resort community cache, not the city, for Caldera Springs', () => {
    const { targets } = resolveCmaMarketTargets({
      city: 'Bend',
      subdivision: 'Caldera Springs',
    })
    expect(targets[0]).toEqual({ geoType: 'neighborhood', slugs: ['caldera-springs'] })
    expect(targets[1]?.geoType).toBe('city')
    expect(targets[1]?.slugs).toContain('bend')
  })

  it('still uses the city when the subdivision is not a resort', () => {
    const { targets } = resolveCmaMarketTargets({
      city: 'Redmond',
      subdivision: 'Obsidian',
    })
    expect(targets).toEqual([{ geoType: 'city', slugs: ['redmond'] }])
  })
})
