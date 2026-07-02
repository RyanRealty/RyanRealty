import { describe, it, expect } from 'vitest'
import {
  computeStrip,
  isStampedAddress,
  streetKey,
  backgroundIsStampedTemplate,
  STRIP_TAG_PREFIXES,
  STRIP_EXACT_TAGS,
  STRIP_CUSTOM_KEYS,
  SKIP_IDS,
} from '../_westside-strip-rules.mjs'

// Reconstructed shape of a wrong-household westside-stamped contact (Allyson
// Crowe #9828 pattern): real out-of-state identity + stamped parcel data.
function stampedContact(overrides = {}) {
  return {
    id: 9828,
    name: 'Allyson Crowe',
    first_name: 'Allyson',
    last_name: 'Crowe',
    stage: 'Seller Prospect',
    tags: [
      // REAL (keep):
      'Import', 'Bend', 'city:bend', 'state:out-of-state', 'audience:seller', 'seller:nurture',
      'contact:has-email', 'contact:has-phone', 'email:valid', '1M', 'enrich:batchdata-matched',
      // COUNTY-STAMPED (strip):
      'import:westside-2026-05', 'source:county-assessor', 'area:bend-westside',
      'fb-audience:westside-all', 'source:farm-merge-2026-06', 'owner:absentee-outofstate',
      'owner-occupied', 'equity:high', 'high-equity', 'tenure:9-12yr', 'long-term',
      'seller-score:warm', 'neighborhood:bend-river-west', 'subdivision:northwest-townsite',
      'geo:out-of-state', 'lifecycle:rate-locked',
    ],
    custom: {
      // COUNTY-STAMPED (strip):
      customAPN: '102225', customYearBuilt: '2012', customSellerPropertyAddress: '1447 Nw Newport Ave, Bend, OR 97703',
      customEstimatedMarketValue: '1258810', customSellerScore: '63', customEnrichmentProvider: 'batchdata',
      // an unexpected NON-county key must be KEPT (fail-safe toward preservation):
      customMattNote: 'call about the lake house',
    },
    addresses: [
      { street: '134 Santa Rosa Pl', city: 'Santa Barbara', state: 'CA', type: '', zpid: '15896054' }, // REAL identity (keep)
      { street: '1447 Nw Newport Ave', city: 'Bend', state: 'OR', type: 'Property', zpid: '60578340' }, // stamped (strip)
    ],
    background:
      'WESTSIDE HOMEOWNER · WARM\n1447 Nw Newport Ave, Bend OR 97703\n\nPROPERTY\n3 bd\n\nNEXT STEPS\n• mailer',
    ...overrides,
  }
}

describe('computeStrip', () => {
  it('removes every county tag and keeps every real tag', () => {
    const s = computeStrip(stampedContact())
    // real tags kept
    for (const t of ['Import', 'Bend', 'city:bend', 'state:out-of-state', 'audience:seller', 'seller:nurture', 'contact:has-email', 'email:valid', '1M', 'enrich:batchdata-matched']) {
      expect(s.tags).toContain(t)
    }
    // county tags stripped
    for (const t of ['import:westside-2026-05', 'source:county-assessor', 'area:bend-westside', 'fb-audience:westside-all', 'source:farm-merge-2026-06', 'owner:absentee-outofstate', 'owner-occupied', 'equity:high', 'high-equity', 'tenure:9-12yr', 'long-term', 'seller-score:warm', 'neighborhood:bend-river-west', 'subdivision:northwest-townsite', 'geo:out-of-state', 'lifecycle:rate-locked']) {
      expect(s.tags).not.toContain(t)
    }
  })

  it('removes county custom keys but keeps a non-county (Matt-authored) key', () => {
    const s = computeStrip(stampedContact())
    expect(Object.keys(s.custom)).toEqual(['customMattNote'])
    expect(s.custom.customMattNote).toBe('call about the lake house')
    for (const k of ['customAPN', 'customYearBuilt', 'customSellerPropertyAddress', 'customEstimatedMarketValue', 'customSellerScore', 'customEnrichmentProvider']) {
      expect(s.custom).not.toHaveProperty(k)
    }
  })

  it('removes both stamped address shapes and keeps the real out-of-state identity address', () => {
    const s = computeStrip(stampedContact())
    expect(s.addresses).toHaveLength(1)
    expect(s.addresses[0].street).toBe('134 Santa Rosa Pl')
    expect(s.addresses[0].state).toBe('CA')
    expect(s.removed.addresses.map((a) => a.street)).toContain('1447 Nw Newport Ave')
  })

  it('removes a type:"Property" row even when its street differs from customSellerPropertyAddress', () => {
    const c = stampedContact({
      addresses: [
        { street: '2111 Nw Awbrey Rd', state: 'OR', type: 'Property' }, // stamped Zillow-enrich, different street
        { street: '95 S 16th St', state: 'PA', type: '' }, // real identity
      ],
      custom: { customSellerPropertyAddress: '1134 Nw Baltimore Ave, Bend, OR 97703' },
    })
    const s = computeStrip(c)
    expect(s.addresses.map((a) => a.street)).toEqual(['95 S 16th St'])
  })

  it('removes the stamped template background', () => {
    const s = computeStrip(stampedContact())
    expect(s.background).toBeNull()
    expect(s.removed.backgroundRemoved).toBe(true)
  })

  it('KEEPS a non-template (Matt-written) background and flags it for review', () => {
    const c = stampedContact({ background: "Talked to Allyson at the open house. She's motivated, wants to list in spring." })
    const s = computeStrip(c)
    expect(s.background).toBe(c.background)
    expect(s.removed.backgroundRemoved).toBe(false)
    expect(s.removed.backgroundKeptForReview).toBe(true)
  })

  it('is idempotent — a second strip of already-clean data is a no-op', () => {
    const first = computeStrip(stampedContact())
    const clean = { tags: first.tags, custom: first.custom, addresses: first.addresses, background: first.background }
    const second = computeStrip(clean)
    expect(second.changed).toBe(false)
    expect(second.tags).toEqual(first.tags)
    expect(second.custom).toEqual(first.custom)
    expect(second.addresses).toEqual(first.addresses)
  })

  it('reports changed=false for a contact with no county data', () => {
    const s = computeStrip({ tags: ['Import', 'Buyer'], custom: { customMattNote: 'x' }, addresses: [{ street: '1 Main St', type: '' }], background: 'hand-written' })
    expect(s.changed).toBe(false)
  })
})

describe('helpers', () => {
  it('isStampedAddress: type:Property always stamped; blank matches stamped street', () => {
    const stamp = streetKey('1447 Nw Newport Ave')
    expect(isStampedAddress({ street: '1447 Nw Newport Ave', type: '' }, stamp)).toBe(true)
    expect(isStampedAddress({ street: 'anything', type: 'Property' }, stamp)).toBe(true)
    expect(isStampedAddress({ street: '134 Santa Rosa Pl', type: '' }, stamp)).toBe(false)
  })

  it('backgroundIsStampedTemplate matches the brief header + NEXT STEPS, not free prose', () => {
    expect(backgroundIsStampedTemplate('WESTSIDE HOMEOWNER · WARM\n...\nNEXT STEPS\n• x')).toBe(true)
    expect(backgroundIsStampedTemplate('INDUSTRY REALTOR\n...\nNEXT STEPS\n• x')).toBe(true)
    expect(backgroundIsStampedTemplate('Talked to her at the open house.')).toBe(false)
    expect(backgroundIsStampedTemplate('')).toBe(false)
    expect(backgroundIsStampedTemplate(null)).toBe(false)
  })

  it('strip sets are the expected shape', () => {
    expect(STRIP_EXACT_TAGS.has('import:westside-2026-05')).toBe(true)
    expect(STRIP_TAG_PREFIXES).toContain('seller-score:')
    expect(STRIP_CUSTOM_KEYS.has('customSellerPropertyAddress')).toBe(true)
    expect(STRIP_CUSTOM_KEYS.has('customMattNote')).toBe(false)
    // the 8 manual-review skips are locked
    expect([...SKIP_IDS].sort((a, b) => a - b)).toEqual([2401, 5173, 6729, 8036, 8161, 11727, 12099, 12362])
  })
})
