import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { FORM_PROFILES, OTHER_PROFILES, profileFor, type Party } from './profiles'

const REFERENCE = '.claude/skills/skyslope-form-compliance/references/oref-form-library.md'

const PARTY_FROM_REFERENCE: Record<string, Party | 'one_side' | 'reference'> = {
  buyer: 'buyer',
  seller: 'seller',
  buyer_broker: 'buyer_agent',
  seller_broker: 'seller_agent',
  acknowledger: 'one_side',
  single_party: 'one_side',
  not_applicable: 'reference',
}

/** Every `oref:` + `signers:` pair in the canonical library markdown. */
function referenceRows(): Array<{ oref: string; signers: string[] }> {
  const md = readFileSync(REFERENCE, 'utf8')
  const rows: Array<{ oref: string; signers: string[] }> = []
  for (const block of md.split(/^## /m).slice(1)) {
    const oref = block.match(/^oref:\s*(\d{3}[A-Z]?)/m)?.[1]
    const signers = block.match(/^signers:\s*\[([^\]]*)\]/m)?.[1]
    if (oref && signers) rows.push({ oref, signers: signers.split(',').map((s) => s.trim()).filter(Boolean) })
  }
  return rows
}

describe('reader signer profiles match the canonical form library', () => {
  const rows = referenceRows()

  it('reads the library', () => {
    expect(rows.length).toBeGreaterThanOrEqual(20)
  })

  for (const row of referenceRows()) {
    it(`OREF ${row.oref}: ${row.signers.join(', ')}`, () => {
      const profile = FORM_PROFILES.find((p) => p.oref.includes(row.oref))
      expect(profile, `no reader profile covers OREF ${row.oref}`).toBeTruthy()
      const mapped = row.signers.map((s) => PARTY_FROM_REFERENCE[s])
      const o = profile!.obligation
      if (mapped.includes('reference')) return expect(o.kind).toBe('reference')
      if (mapped.includes('one_side')) return expect(o.kind).toBe('one_side')
      expect(o.kind).toBe('all')
      if (o.kind === 'all') expect([...o.parties].sort()).toEqual([...(mapped as Party[])].sort())
    })
  }
})

describe('profileFor', () => {
  it('title and number agree: library match', () => {
    expect(profileFor({ title: 'RESIDENTIAL REAL ESTATE SALE AGREEMENT', formNumber: 'OREF 001' })).toMatchObject({ basis: 'library', profile: { key: 'oref-001-rsa' } })
  })

  it("the 2026 Buyer's Counteroffer (OREF 004) is the counteroffer profile", () => {
    const m = profileFor({ title: "BUYER'S COUNTEROFFER NO. 1", formNumber: 'OREF 004' })
    expect(m).toMatchObject({ basis: 'library', numberConflict: false, profile: { key: 'oref-003-counter' } })
  })

  it('a printed OREF number the title profile does not carry is a conflict (083A under an 083 title)', () => {
    const m = profileFor({ title: 'CONTINGENT RIGHT TO PURCHASE - NOTICE TO SELLER', formNumber: 'OREF 083A' })
    expect(m?.profile.key).toBe('oref-083-contingent-right')
    expect(m?.numberConflict).toBe(true)
  })

  it('flags a number that points at a different form than the title', () => {
    const m = profileFor({ title: 'ADVISORY REGARDING ELECTRONIC FUNDS', formNumber: 'OREF 001' })
    expect(m?.profile.key).toBe('oref-043-efa')
    expect(m?.numberConflict).toBe(true)
  })

  it('another publisher\'s addendum and counteroffer get the generic mutual profile', () => {
    expect(profileFor({ title: '2.2 GENERAL ADDENDUM TO REAL ESTATE PURCHASE AND SALE AGREEMENT', formNumber: null })?.basis).toBe('generic')
    expect(profileFor({ title: '2.1 COUNTEROFFER TO REAL ESTATE PURCHASE AND SALE AGREEMENT', formNumber: null })?.profile.key).toBe('oref-003-counter')
  })

  it('reports are references', () => {
    expect(profileFor({ title: 'Preliminary Title Report', formNumber: null })?.profile.obligation.kind).toBe('reference')
    expect(OTHER_PROFILES.find((p) => p.key === 'inspection-report')?.obligation.kind).toBe('reference')
  })

  it('a printed OREF number points at its own form even when the page header reads like another (000A guide)', () => {
    const m = profileFor({ title: 'OREF Residential Real Estate Sale Agreement', formNumber: '000A' })
    expect(m?.numberConflict).toBe(true)
  })

  it('an unknown title is unknown', () => {
    expect(profileFor({ title: 'AGREEMENT TO OCCUPY AFTER CLOSING', formNumber: null })).toBeNull()
  })
})
