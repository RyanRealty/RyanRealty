import { describe, it, expect } from 'vitest'
import { buildNativePersonRow, nativeCreateGaps, NATIVE_DEFAULT_BROKER } from './nativeCreate'

// CONTACT360 Phase 0.4 — no thin native-create paths. Both native-create helpers
// (ensureNativeLead, findOrCreatePersonByPhone) build their crm_people insert row
// through buildNativePersonRow. These tests lock the create-completeness contract
// the two paths share: a real source, stage 'Lead', an owner, a source:<x> tag,
// and (asserted via nativeCreateGaps) a contactable point — so a native lead can
// never land incomplete or invisible to the workflow, and the two paths can't
// drift. Pure (no Supabase); the .from().insert() lives in the DAL helpers.

describe('buildNativePersonRow (canonical native-create shape)', () => {
  it('stamps stage Lead, the trimmed source, the default owner, and a source tag', () => {
    const row = buildNativePersonRow({
      name: 'Jane Seller',
      first_name: 'Jane',
      last_name: 'Seller',
      source: 'seller-lp',
    })
    expect(row.stage).toBe('Lead')
    expect(row.source).toBe('seller-lp')
    expect(row.assigned_broker).toBe(NATIVE_DEFAULT_BROKER)
    expect(row.tags).toContain('source:seller-lp')
    expect(nativeCreateGaps({ ...row, emails: [{ value: 'j@x.com', type: 'Primary', isPrimary: 1 }] })).toEqual([])
  })

  it('falls back to a generic source so the row is always attributable', () => {
    const row = buildNativePersonRow({
      name: 'Call lead 5415550100',
      first_name: null,
      last_name: null,
      source: '   ',
      phones: [{ value: '+15415550100', type: 'Mobile', isPrimary: 1 }],
    })
    expect(row.source).toBe('native-lead')
    expect(row.tags).toContain('source:native-lead')
    // a phone-only inbound lead is complete (a contactable point exists)
    expect(nativeCreateGaps(row)).toEqual([])
  })

  it('merges + dedupes caller tags after the canonical source tag, in order', () => {
    const row = buildNativePersonRow({
      name: 'Jane Seller',
      first_name: 'Jane',
      last_name: 'Seller',
      source: 'fsbo-lp',
      tags: ['audience:seller', 'seller:hot', 'source:fsbo-lp', 'intent:fsbo'],
    })
    // source tag first, no duplicate even though the caller also passed it
    expect(row.tags).toEqual([
      'source:fsbo-lp',
      'audience:seller',
      'seller:hot',
      'intent:fsbo',
    ])
  })

  it('lets the caller staff a non-default broker', () => {
    const row = buildNativePersonRow({
      name: 'Buyer Lead',
      first_name: 'Buyer',
      last_name: 'Lead',
      source: 'inbound-call',
      assignedBroker: 'rebecca',
    })
    expect(row.assigned_broker).toBe('rebecca')
  })

  it('defaults emails/phones to empty arrays (matches the crm_people column defaults)', () => {
    const row = buildNativePersonRow({
      name: 'No Contact',
      first_name: null,
      last_name: null,
      source: 'inbound-call',
    })
    expect(row.emails).toEqual([])
    expect(row.phones).toEqual([])
  })
})

describe('nativeCreateGaps (create-completeness contract)', () => {
  const completeEmailRow = buildNativePersonRow({
    name: 'Jane',
    first_name: 'Jane',
    last_name: null,
    source: 'seller-lp',
    emails: [{ value: 'jane@example.com', type: 'Primary', isPrimary: 1 }],
  })

  it('reports zero gaps for a complete person (source + stage + owner + tag + contact point)', () => {
    expect(nativeCreateGaps(completeEmailRow)).toEqual([])
  })

  it('flags a row with no contactable point as incomplete', () => {
    expect(nativeCreateGaps(completeEmailRow)).not.toContain('no contactable point (email or phone)')
    const noContact = { ...completeEmailRow, emails: [], phones: [] }
    expect(nativeCreateGaps(noContact)).toContain('no contactable point (email or phone)')
  })

  it('flags a missing owner', () => {
    // assigned_broker is typed non-null, but a future refactor could drop it —
    // the contract still catches it.
    const orphan = { ...completeEmailRow, assigned_broker: '' as never }
    expect(nativeCreateGaps(orphan)).toContain('missing assigned_broker')
  })

  it('flags a row whose tags lost the source tag', () => {
    const untagged = { ...completeEmailRow, tags: ['audience:seller'] }
    expect(nativeCreateGaps(untagged)).toContain('missing source:<source> tag')
  })
})
