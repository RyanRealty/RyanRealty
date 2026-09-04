import { describe, expect, it } from 'vitest'
import {
  canOpenProspectSend,
  prospectDripBlockedReason,
  shouldHideProspectEnroll,
} from './enroll-ui'

const openCompliance = {
  relisted: false,
  offMarket: false,
  allChannelsBlocked: false,
}

describe('shouldHideProspectEnroll', () => {
  it('hides enroll when FSBO/expired is relisted (Aberdeen class) and not enrolled', () => {
    expect(
      shouldHideProspectEnroll({
        compliance: { relisted: true, offMarket: false },
        drip: { enrolled: false },
      }),
    ).toBe(true)
  })

  it('hides enroll when off market', () => {
    expect(
      shouldHideProspectEnroll({
        compliance: { relisted: false, offMarket: true },
        drip: { enrolled: false },
      }),
    ).toBe(true)
  })

  it('keeps In drip visible when already enrolled even if relisted', () => {
    expect(
      shouldHideProspectEnroll({
        compliance: { relisted: true, offMarket: false },
        drip: { enrolled: true },
      }),
    ).toBe(false)
  })

  it('does not hide when market is clear', () => {
    expect(
      shouldHideProspectEnroll({
        compliance: { relisted: false, offMarket: false },
        drip: { enrolled: false },
      }),
    ).toBe(false)
  })

  it('hides enroll when no CRM person (Pine Vista / owner-attach)', () => {
    expect(
      shouldHideProspectEnroll({
        compliance: { relisted: false, offMarket: false },
        drip: { enrolled: false },
        personId: null,
      }),
    ).toBe(true)
  })

  it('does not hide enroll when personId omitted (backward compatible)', () => {
    expect(
      shouldHideProspectEnroll({
        compliance: { relisted: false, offMarket: false },
        drip: { enrolled: false },
      }),
    ).toBe(false)
  })
})

describe('prospectDripBlockedReason', () => {
  it('fail-closes on relisted before channel reasons', () => {
    expect(
      prospectDripBlockedReason({
        compliance: { ...openCompliance, relisted: true },
        drip: { enrolled: false, sequenceId: 1, sequenceName: 'FSBO' },
        personId: 9,
      }),
    ).toBe('Relisted or sold — never enroll.')
  })

  it('asks for a CRM link when person is missing', () => {
    expect(
      prospectDripBlockedReason({
        compliance: openCompliance,
        drip: { enrolled: false, sequenceId: 1, sequenceName: 'Expired' },
        personId: null,
      }),
    ).toBe('Link a CRM contact before enrolling.')
  })
})

describe('canOpenProspectSend', () => {
  it('requires a linked person (Nugget/Covina owner-unknown class)', () => {
    expect(canOpenProspectSend({ compliance: openCompliance, personId: null })).toBe(false)
    expect(canOpenProspectSend({ compliance: openCompliance, personId: 18198 })).toBe(true)
  })

  it('matches send hard-skip on relisted', () => {
    expect(
      canOpenProspectSend({
        compliance: { ...openCompliance, relisted: true },
        personId: 1,
      }),
    ).toBe(false)
  })
})
