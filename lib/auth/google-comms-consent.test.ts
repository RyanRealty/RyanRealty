import { describe, expect, it } from 'vitest'
import {
  emptyGoogleCommsConsent,
  googleCommsEnrichmentCustom,
  hasGoogleCommsConsentRecorded,
  parseGoogleCommsConsent,
  serializeGoogleCommsConsent,
  usableGoogleCommsPhone,
} from './google-comms-consent'

describe('google-comms-consent cookie helpers', () => {
  it('round-trips unchecked boxes and no phone (the default tap)', () => {
    const raw = serializeGoogleCommsConsent(emptyGoogleCommsConsent())
    const parsed = parseGoogleCommsConsent(raw)
    expect(parsed).toEqual({ emailOpt: false, smsOpt: false, phone: '' })
    expect(hasGoogleCommsConsentRecorded(raw)).toBe(true)
  })

  it('round-trips checked boxes and a phone', () => {
    const raw = serializeGoogleCommsConsent({
      emailOpt: true,
      smsOpt: true,
      phone: '(541) 703-3095',
    })
    expect(parseGoogleCommsConsent(raw)).toEqual({
      emailOpt: true,
      smsOpt: true,
      phone: '5417033095',
    })
  })

  it('treats missing or garbage cookie as not recorded', () => {
    expect(hasGoogleCommsConsentRecorded(null)).toBe(false)
    expect(hasGoogleCommsConsentRecorded('')).toBe(false)
    expect(hasGoogleCommsConsentRecorded('not-json')).toBe(false)
    expect(parseGoogleCommsConsent('%7B%7D')).toBeNull()
  })

  it('only treats a complete last-10 as a usable phone', () => {
    expect(usableGoogleCommsPhone('5417033095')).toBe('5417033095')
    expect(usableGoogleCommsPhone('+1 541 703 3095')).toBe('5417033095')
    expect(usableGoogleCommsPhone('541-703')).toBeNull()
    expect(usableGoogleCommsPhone('')).toBeNull()
  })

  it('marks CMA consent recorded without requiring an opt-in', () => {
    expect(googleCommsEnrichmentCustom(emptyGoogleCommsConsent())).toEqual({
      cmaConsent: true,
      googleCommsEmail: 0,
      googleCommsSms: 0,
    })
    expect(
      googleCommsEnrichmentCustom({ emailOpt: true, smsOpt: true, phone: '5417033095' }),
    ).toEqual({
      cmaConsent: true,
      googleCommsEmail: 1,
      googleCommsSms: 1,
    })
    expect(
      googleCommsEnrichmentCustom({ emailOpt: false, smsOpt: true, phone: '' }),
    ).toEqual({
      cmaConsent: true,
      googleCommsEmail: 0,
      googleCommsSms: 0,
    })
  })
})
