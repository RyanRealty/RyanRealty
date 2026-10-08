import { describe, expect, it } from 'vitest'
import { fullBaths, printedBaths, wholeBathPair } from '@/lib/pricing/bath-count'
import { roomCountsDecision } from '@/lib/pricing/room-ground'
import { closedCompWeight } from '@/lib/pricing/closed-comp-weight'
import { propertyDescription } from '@/lib/cma/render-blocks'

/**
 * Audit row reads, listings, 2026-10-07 (BathroomsTotal / baths_full / baths_half):
 *   915 Saginaw (subject, 220221268) ... 3 / 2 / 1  remarks: two full baths and a powder room
 *   1335 12th (220204747) .............. 3 / 2 / 1  remarks: "3 bedroom, 2.5 bath"
 *   628 Portland (220205658) ........... 3 / 2 / 1
 *   2003 4th (220220312) ............... 3 / 2 / 1
 *   1168 Federal (220206576) ........... 3 / 3 / 0
 *   1279 Vicksburg (220201610) ......... 2 / 2 / 0
 * BathroomsTotal counts the half bath whole; sale_pricing_facts.baths copies it.
 */
const SAGINAW = { baths: 3, bathsFull: 2, bathsHalf: 1 }
const TWELFTH = { baths: 3, bathsFull: 2, bathsHalf: 1 }
const FEDERAL = { baths: 3, bathsFull: 3, bathsHalf: 0 }
const VICKSBURG = { baths: 2, bathsFull: 2, bathsHalf: 0 }

describe('bath counts — a powder room is not a whole bath', () => {
  it('prints the MLS reading: 2 full and a half is 2.5, not 3', () => {
    expect(printedBaths(SAGINAW)).toBe(2.5)
    expect(printedBaths(TWELFTH)).toBe(2.5)
    expect(printedBaths(FEDERAL)).toBe(3)
    expect(printedBaths(VICKSBURG)).toBe(2)
  })

  it('without the split, the recorded total is printed and compared, nothing guessed', () => {
    expect(fullBaths({ baths: 3 })).toBeNull()
    expect(printedBaths({ baths: 3 })).toBe(3)
    expect(wholeBathPair(SAGINAW, { baths: 3 })).toEqual({ subject: 3, sale: 3 })
    expect(wholeBathPair({ baths: 3 }, TWELFTH)).toEqual({ subject: 3, sale: 3 })
  })

  it('compares full baths when both homes carry the split', () => {
    expect(wholeBathPair(SAGINAW, TWELFTH)).toEqual({ subject: 2, sale: 2 })
    expect(wholeBathPair(SAGINAW, FEDERAL)).toEqual({ subject: 2, sale: 3 })
    expect(wholeBathPair(SAGINAW, VICKSBURG)).toEqual({ subject: 2, sale: 2 })
  })
})

describe('one-room rule (rule 4) on whole baths, 915 Saginaw shape', () => {
  const subject = { ...SAGINAW, beds: 4, marketArea: 'bend-river-west' }

  it('1335 12th (2.5) is the same whole bath count as Saginaw (2.5)', () => {
    const d = roomCountsDecision(subject, { ...TWELFTH, beds: 3, marketArea: 'bend-river-west' })
    expect(d.ok).toBe(true)
    expect(d.notes).toEqual(['beds'])
  })

  it('1279 Vicksburg (2 full) matches on baths; the totals called it one apart', () => {
    const d = roomCountsDecision(subject, { ...VICKSBURG, beds: 4, marketArea: 'bend-river-west' })
    expect(d).toMatchObject({ ok: true, notes: [] })
    const totalsOnly = roomCountsDecision({ beds: 4, baths: 3 }, { beds: 4, baths: 2, marketArea: null })
    expect(totalsOnly.ok).toBe(false)
  })

  it('1168 Federal (3 full) is one whole bath apart: kept and disclosed in River West, refused off it', () => {
    const home = roomCountsDecision(subject, { ...FEDERAL, beds: 4, marketArea: 'bend-river-west' })
    expect(home).toMatchObject({ ok: true, notes: ['baths'] })
    const away = roomCountsDecision(subject, { ...FEDERAL, beds: 4, marketArea: 'bend-awbrey-butte' })
    expect(away.ok).toBe(false)
  })
})

describe('closed-sale weight reads whole baths too', () => {
  const base = {
    subjectSqft: 2085,
    saleSqft: 2085,
    monthsSinceClose: 1,
    subjectBeds: 4,
    saleBeds: 4,
    locationMatch: 'neighborhood-or-community' as const,
    setsPrice: true,
  }
  it('a 2.5 sale weighs as a bath match for a 2.5 subject, and a 3-full sale one apart', () => {
    const twelfth = closedCompWeight({
      ...base,
      subjectBaths: 3,
      subjectBathsFull: 2,
      saleBaths: 3,
      saleBathsFull: 2,
    })
    const federal = closedCompWeight({
      ...base,
      subjectBaths: 3,
      subjectBathsFull: 2,
      saleBaths: 3,
      saleBathsFull: 3,
    })
    const vicksburg = closedCompWeight({
      ...base,
      subjectBaths: 3,
      subjectBathsFull: 2,
      saleBaths: 2,
      saleBathsFull: 2,
    })
    expect(vicksburg).toBe(twelfth)
    expect(federal).toBeLessThan(twelfth)
  })
})

describe('the letter prints baths the way the MLS does', () => {
  it('Saginaw reads 2.5 bathrooms, not 3', () => {
    const text = propertyDescription({
      streetAddress: '915 Saginaw',
      city: 'Bend',
      postalCode: '97703',
      beds: 4,
      ...SAGINAW,
      sqft: 2085,
      lotAcres: null,
      yearBuilt: null,
    })
    expect(text).toContain('2.5 bathrooms')
    expect(text).not.toContain('3 bathrooms')
  })
})
