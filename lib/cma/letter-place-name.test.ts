import { describe, expect, it } from 'vitest'
import {
  applyRecordedPlaceNames,
  letterPlaceName,
  nameFromPlatSlug,
} from '@/lib/cma/letter-place-name'

describe('letter place names', () => {
  it('turns a bare MLS code into the recorded plat and leaves a real name alone', () => {
    expect(nameFromPlatSlug('tara-view-estates')).toBe('Tara View Estates')
    expect(letterPlaceName('CLAB', 'Tara View Estates')).toBe('Tara View Estates')
    expect(letterPlaceName('CLAB', nameFromPlatSlug('tara-view-estates'))).toBe('Tara View Estates')
    expect(letterPlaceName('Foxborough', nameFromPlatSlug('foxborough-phase-3'))).toBe('Foxborough')
    expect(letterPlaceName('Northwest Townsite Co 2nd Addt', 'Northwest Townsite Second Addition')).toBe(
      'Northwest Townsite Co 2nd Addt',
    )
  })

  it('replaces the code in finished HTML and does not touch a real subdivision', () => {
    const html = applyRecordedPlaceNames(
      '<p>We searched listings in Larkspur, Chloe Estates and CLAB. 20606 Songbird is in Foxborough.</p>',
      [
        { subdivision: 'CLAB', subdivisionSlug: 'tara-view-estates' },
        { subdivision: 'Foxborough', subdivisionSlug: 'foxborough-phase-3' },
      ],
    )
    expect(html).toContain('Chloe Estates and Tara View Estates')
    expect(html).not.toContain('CLAB')
    expect(html).toContain('in Foxborough')
    expect(html).not.toContain('Foxborough Phase 3')
  })
})
