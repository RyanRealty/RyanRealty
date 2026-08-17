import { describe, expect, it } from 'vitest'
import { pulseOnlyCitySnapshot } from './pulse-only-city-snapshot'

describe('pulseOnlyCitySnapshot', () => {
  it('builds a Tumalo city door from pulse without borrowing Bend', () => {
    const snap = pulseOnlyCitySnapshot('tumalo', {
      geo_slug: 'tumalo',
      geo_label: 'Tumalo',
      active_count: 0,
      pending_count: 0,
      median_list_price: null,
      updated_at: '2026-08-17T00:00:00.000Z',
    })
    expect(snap.geoKey).toBe('tumalo')
    expect(snap.geoLabel).toBe('Tumalo')
    expect(snap.activeSfrCount).toBe(0)
    expect(snap.medianListPrice).toBeNull()
  })
})
