import { describe, it, expect } from 'vitest'

import { parseContactAddress } from './contact-cma-address'

describe('parseContactAddress', () => {
  it('returns null for empty / whitespace input', () => {
    expect(parseContactAddress(null)).toBeNull()
    expect(parseContactAddress(undefined)).toBeNull()
    expect(parseContactAddress('   ')).toBeNull()
  })

  it('parses the canonical three-segment geocoder shape', () => {
    const r = parseContactAddress('123 NW Bond St, Bend, OR 97701')
    expect(r).not.toBeNull()
    expect(r!.parsedStreet).toBe('123 NW Bond St')
    expect(r!.parsedCity).toBe('Bend')
    expect(r!.parsedState).toBe('OR')
    expect(r!.parsedPostalCode).toBe('97701')
    expect(r!.rawAddress).toBe('123 NW Bond St, Bend, OR 97701')
  })

  it('drops a trailing country segment (USA)', () => {
    const r = parseContactAddress('19496 Tumalo Reservoir Rd, Bend, OR 97703, USA')
    expect(r!.parsedStreet).toBe('19496 Tumalo Reservoir Rd')
    expect(r!.parsedCity).toBe('Bend')
    expect(r!.parsedState).toBe('OR')
    expect(r!.parsedPostalCode).toBe('97703')
  })

  it('drops a trailing "United States" segment too', () => {
    const r = parseContactAddress('21042 Robin Ln, Bend, OR 97702, United States')
    expect(r!.parsedCity).toBe('Bend')
    expect(r!.parsedState).toBe('OR')
    expect(r!.parsedPostalCode).toBe('97702')
  })

  it('parses a two-segment "street, city state zip" shape', () => {
    const r = parseContactAddress('228 Soft Tail Dr, Sisters OR 97759')
    expect(r!.parsedStreet).toBe('228 Soft Tail Dr')
    expect(r!.parsedCity).toBe('Sisters')
    expect(r!.parsedState).toBe('OR')
    expect(r!.parsedPostalCode).toBe('97759')
  })

  it('handles a zip+4 in the tail', () => {
    const r = parseContactAddress('123 Main St, Redmond, OR 97756-1234')
    expect(r!.parsedPostalCode).toBe('97756')
    expect(r!.parsedState).toBe('OR')
    expect(r!.parsedCity).toBe('Redmond')
  })

  it('returns a null city for a single-segment address (no comma) so the action surfaces a clean error', () => {
    const r = parseContactAddress('123 NW Bond St Bend OR 97701')
    expect(r).not.toBeNull()
    expect(r!.parsedStreet).toBe('123 NW Bond St Bend OR 97701')
    expect(r!.parsedCity).toBeNull()
    expect(r!.parsedPostalCode).toBe('97701')
  })

  it('preserves original street casing (the matcher lowercases internally)', () => {
    const r = parseContactAddress('456 SE Reed Market Rd, Bend, OR 97702')
    expect(r!.parsedStreet).toBe('456 SE Reed Market Rd')
  })
})
