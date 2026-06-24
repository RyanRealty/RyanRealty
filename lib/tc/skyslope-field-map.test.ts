import { describe, it, expect } from 'vitest'
import {
  deriveSignerRole,
  translateSkyslopeFields,
  summarizeMap,
  type MappedField,
} from './skyslope-field-map'
import { SIGN_FIELD_TYPES } from './signing'

// SkySlope -> envelope field mapping (TC docs). deriveSignerRole routes a signature
// field to the right recipient; agent-vs-principal precedence must hold or a
// signature lands on the wrong party on a legal doc. Audit p3.2.
describe('deriveSignerRole', () => {
  it('matches agent roles BEFORE plain buyer/seller (precedence)', () => {
    expect(deriveSignerRole("Buyer's Agent")).toBe('buyer_agent')
    expect(deriveSignerRole('BuyersAgent_Signature')).toBe('buyer_agent')
    expect(deriveSignerRole('Selling Agent')).toBe('buyer_agent') // selling agent = buyer side
    expect(deriveSignerRole('ListingAgentName')).toBe('listing_agent')
    expect(deriveSignerRole("Seller's Agent")).toBe('listing_agent')
  })
  it('falls through to principal buyer/seller', () => {
    expect(deriveSignerRole('Buyer1')).toBe('buyer')
    expect(deriveSignerRole('Seller2')).toBe('seller')
  })
  it('reads dataRef AND group, and returns null for neither', () => {
    expect(deriveSignerRole(undefined, 'BuyerGroup')).toBe('buyer')
    expect(deriveSignerRole('', '')).toBeNull()
    expect(deriveSignerRole()).toBeNull()
  })
})

describe('translateSkyslopeFields', () => {
  it('returns [] for null/empty input', () => {
    expect(translateSkyslopeFields(null, null)).toEqual([])
    expect(translateSkyslopeFields([], [])).toEqual([])
  })
  it('maps type + fractional top-left geometry + 1-based page + signerRole', () => {
    const [m] = translateSkyslopeFields(
      [{ type: 'Signature', dataRef: 'BuyerSig', group: 'Buyer', pageNumber: 0, xCoordinate: 306, yCoordinate: 396, width: 153, height: 79.2 }],
      [{ width: 612, height: 792 }],
    )
    expect(m).toMatchObject({ type: 'signature', page: 1, x: 0.5, y: 0.5, w: 0.25, h: 0.1, dataRef: 'BuyerSig', signerRole: 'buyer', optional: false })
  })
  it('falls back to the US-Letter default page, clamps coords to [0,1], unknown type -> text', () => {
    const [m] = translateSkyslopeFields([{ type: 'Mystery', xCoordinate: 1000, yCoordinate: -50 }], [])
    expect(m.type).toBe('text') // unknown
    expect(m.x).toBe(1) // 1000/612 clamped
    expect(m.y).toBe(0) // negative clamped
  })
})

describe('summarizeMap', () => {
  it('counts total + per-type', () => {
    const map = [
      { type: 'signature' },
      { type: 'signature' },
      { type: 'date_signed' },
      { type: 'text' },
      { type: 'checkbox' },
    ] as MappedField[]
    expect(summarizeMap(map)).toEqual({ total: 5, signature: 2, initials: 0, date_signed: 1, text: 1, checkbox: 1 })
  })
})

// C4 lock: the SkySlope mapper must ONLY emit canonical signing field types (the
// tc_envelope_fields.type CHECK / SIGN_FIELD_TYPES). Emitting 'date' was the bug
// that silently broke envelope creation from any OREF template with a date field.
describe('field-type canonical parity (C4)', () => {
  it('every mapped type is a canonical SignFieldType', () => {
    const skyslopeTypes = ['Signature', 'Initials', 'DateSigned', 'TimeSigned', 'Date', 'checkboxblock', 'Unknown']
    const mapped = translateSkyslopeFields(skyslopeTypes.map((t) => ({ type: t })), [])
    for (const m of mapped) expect(SIGN_FIELD_TYPES).toContain(m.type)
  })
  it('SkySlope date variants map to date_signed, never the rejected "date"', () => {
    const mapped = translateSkyslopeFields([{ type: 'DateSigned' }, { type: 'Date' }, { type: 'TimeSigned' }], [])
    expect(mapped.every((m) => m.type === 'date_signed')).toBe(true)
  })
})
