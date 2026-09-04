/**
 * Locks expired worklist city default: City of Bend only (not outskirts).
 * `city=all` clears the filter; FSBO has no city default.
 */
import { describe, expect, it } from 'vitest'
import {
  PROSPECT_EXPIRED_DEFAULT_CITY,
  resolveProspectListCity,
} from './types'

describe('prospect list city defaults', () => {
  it('defaults expired to City of Bend', () => {
    expect(PROSPECT_EXPIRED_DEFAULT_CITY).toBe('Bend')
    expect(resolveProspectListCity('expired')).toBe('Bend')
    expect(resolveProspectListCity('expired', null)).toBe('Bend')
    expect(resolveProspectListCity('expired', undefined)).toBe('Bend')
    expect(resolveProspectListCity('expired', '')).toBe('Bend')
    expect(resolveProspectListCity('expired', '  ')).toBe('Bend')
  })

  it('city=all clears expired filter; other cities pass through', () => {
    expect(resolveProspectListCity('expired', 'all')).toBeNull()
    expect(resolveProspectListCity('expired', 'ALL')).toBeNull()
    expect(resolveProspectListCity('expired', 'Redmond')).toBe('Redmond')
    expect(resolveProspectListCity('expired', 'Bend')).toBe('Bend')
  })

  it('FSBO has no city default', () => {
    expect(resolveProspectListCity('fsbo')).toBeNull()
    expect(resolveProspectListCity('fsbo', 'all')).toBeNull()
    expect(resolveProspectListCity('fsbo', 'Bend')).toBe('Bend')
  })
})
