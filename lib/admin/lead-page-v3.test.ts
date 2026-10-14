import { describe, expect, it } from 'vitest'
import { isLeadPageV3Enabled, personPageHeaderActions } from './lead-page-v3'

describe('isLeadPageV3Enabled', () => {
  it('is off by default', () => {
    expect(isLeadPageV3Enabled({})).toBe(false)
    expect(isLeadPageV3Enabled({ searchParams: {}, cookie: null })).toBe(false)
  })

  it('turns on with ?v=3 or ?lead-page-v3=1', () => {
    expect(isLeadPageV3Enabled({ searchParams: { v: '3' } })).toBe(true)
    expect(isLeadPageV3Enabled({ searchParams: { 'lead-page-v3': '1' } })).toBe(true)
    expect(isLeadPageV3Enabled({ searchParams: { 'lead-page-v3': 'on' } })).toBe(true)
  })

  it('turns on from the persist cookie when the query is absent', () => {
    expect(isLeadPageV3Enabled({ cookie: '1' })).toBe(true)
  })

  it('lets ?v=2 / ?lead-page-v3=0 force the current layout over the cookie', () => {
    expect(isLeadPageV3Enabled({ searchParams: { v: '2' }, cookie: '1' })).toBe(false)
    expect(isLeadPageV3Enabled({ searchParams: { 'lead-page-v3': '0' }, cookie: '1' })).toBe(false)
  })
})

describe('personPageHeaderActions', () => {
  it('keeps the six current header buttons when the flag is off', () => {
    expect(personPageHeaderActions(false)).toEqual([
      'text',
      'message',
      'call',
      'email',
      'cma',
      'tools',
    ])
  })

  it('keeps Call plus the overflow when the flag is on', () => {
    expect(personPageHeaderActions(true)).toEqual(['call', 'more'])
  })
})
