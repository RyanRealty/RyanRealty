import { describe, expect, it } from 'vitest'
import {
  FORM_PACKET_SEEDS,
  dealPacketNamesForKind,
  formNameMatchesNeedle,
  outdatedLibraryFormsMessage,
} from './form-packets'

describe('FORM_PACKET_SEEDS', () => {
  it('keeps the three SkySlope libraries Matt uses: OREF packets plus ODS MLS entry and change', () => {
    const names = FORM_PACKET_SEEDS.map((s) => s.name)
    expect(names).toContain('Residential — Standard')
    expect(names).toContain('Listing — Standard')
    expect(names).toContain('ODS — MLS Entry (Residential)')
    expect(names).toContain('ODS — MLS Change')
    expect(names).toContain('ODS — Exclusive Listing')
    const listing = FORM_PACKET_SEEDS.find((s) => s.name === 'Listing — Standard')
    expect(listing?.formNumbers).not.toContain('001')
    expect(listing?.nameIncludes?.some((n) => /Seller/i.test(n))).toBe(true)
  })
})

describe('dealPacketNamesForKind', () => {
  it('puts listing + ODS MLS entry and change on a listing file', () => {
    expect([...dealPacketNamesForKind('listing')]).toEqual([
      'Listing — Standard',
      'ODS — MLS Entry (Residential)',
      'ODS — MLS Change',
    ])
  })
  it('puts the sale packet on a sale file', () => {
    expect([...dealPacketNamesForKind('sale')]).toEqual(['Residential — Standard'])
  })
})

describe('formNameMatchesNeedle', () => {
  it('picks ORE Residential Input and not Residential Income Input', () => {
    expect(formNameMatchesNeedle('ORE Residential Input - ODS', 'ORE Residential Input')).toBe(true)
    expect(formNameMatchesNeedle('ORE Residential Income Input - ODS', 'ORE Residential Input')).toBe(
      false,
    )
  })
  it('picks the ODS change form', () => {
    expect(
      formNameMatchesNeedle(
        'Change Form for Status, Date, Price and Other Miscellaneous Changes - ODS',
        'Change Form for Status',
      ),
    ).toBe(true)
  })
})

describe('outdatedLibraryFormsMessage', () => {
  it('names one stale form and the pending version', () => {
    expect(
      outdatedLibraryFormsMessage([{ name: 'ORE Residential Input - ODS', pendingVersionLabel: '2026-05' }]),
    ).toMatch(/ORE Residential Input - ODS/)
    expect(
      outdatedLibraryFormsMessage([{ name: 'ORE Residential Input - ODS', pendingVersionLabel: '2026-05' }]),
    ).toMatch(/2026-05/)
  })
  it('counts several stale forms', () => {
    expect(
      outdatedLibraryFormsMessage([{ name: 'A' }, { name: 'B' }]),
    ).toMatch(/2 forms/)
  })
  it('is silent when every form is current', () => {
    expect(outdatedLibraryFormsMessage([])).toBeNull()
  })
})
