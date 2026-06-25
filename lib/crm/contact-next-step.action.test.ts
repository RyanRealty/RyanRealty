/**
 * Guard + branch tests for the Stream 3 server actions.
 *
 * Placed under lib/crm/ so the vitest `include` globs pick it up (app/actions is
 * not in the include set). The actions are imported with their heavy CRM/Supabase
 * dependencies mocked, so we exercise the access guard, the ownership branch, and
 * the never-throw contract without touching the real DB or network.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

// ── Shared mocks ────────────────────────────────────────────────────────────
const getCrmAccess = vi.fn()
const requirePersonInScope = vi.fn()
vi.mock('@/app/actions/crm', () => ({
  getCrmAccess: () => getCrmAccess(),
  requirePersonInScope: (...a: unknown[]) => requirePersonInScope(...a),
}))

const getOwnedHomeMatches = vi.fn()
vi.mock('@/lib/data/crm/getOwnedHome', () => ({
  getOwnedHomeMatches: (...a: unknown[]) => getOwnedHomeMatches(...a),
}))

// A tiny supabase query stub: every chain returns `this`, and the terminal
// `maybeSingle()` resolves to whatever the current scenario queued.
let personRow: unknown = null
let geoRow: unknown = null
function makeSb() {
  const builder = {
    select: () => builder,
    eq: () => builder,
    ilike: () => builder,
    order: () => builder,
    limit: () => builder,
    insert: () => Promise.resolve({ error: null }),
    maybeSingle: () => Promise.resolve({ data: nextRow }),
  }
  let nextRow: unknown = null
  return {
    from: (table: string) => {
      nextRow = table === 'fub_person_geo' ? geoRow : personRow
      return builder
    },
  }
}
vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => makeSb(),
}))

import { getContactNextStep } from '@/app/actions/contact-next-step'

afterEach(() => {
  vi.clearAllMocks()
  personRow = null
  geoRow = null
})

describe('getContactNextStep', () => {
  it('returns the newsletter default and ok:false when unauthorized', async () => {
    getCrmAccess.mockResolvedValue(null)
    const r = await getContactNextStep(123)
    expect(r.ok).toBe(false)
    expect(r.error).toBe('Unauthorized')
    expect(r.step.kind).toBe('newsletter')
    expect(r.ownsHome).toBe(false)
  })

  it('recommends the newsletter for a contact with no geocoded home', async () => {
    getCrmAccess.mockResolvedValue({ email: 'matt@ryan-realty.com', role: 'superuser', brokerSlug: 'matt' })
    requirePersonInScope.mockResolvedValue({ ok: true })
    personRow = { id: 1, fub_legacy_id: 999 }
    geoRow = null // no geo on file
    const r = await getContactNextStep(1)
    expect(r.ok).toBe(true)
    expect(r.ownsHome).toBe(false)
    expect(r.step.kind).toBe('newsletter')
  })

  it('recommends a CMA when an address-matched home is found', async () => {
    getCrmAccess.mockResolvedValue({ email: 'matt@ryan-realty.com', role: 'superuser', brokerSlug: 'matt' })
    requirePersonInScope.mockResolvedValue({ ok: true })
    personRow = { id: 2, fub_legacy_id: 1000 }
    geoRow = { latitude: 44.05, longitude: -121.3, formatted_address: '123 Main St, Bend OR' }
    getOwnedHomeMatches.mockResolvedValue([
      { listingKey: 'X1', address: '123 Main St', city: 'Bend', status: 'Closed', photoUrl: 'p.jpg', listPrice: null, closePrice: 600000, closeDate: '2024-01-01', beds: 3, baths: 2, sqft: 1800, yearBuilt: 2005, addressSlug: 's', addressMatched: true },
    ])
    const r = await getContactNextStep(2)
    expect(r.ok).toBe(true)
    expect(r.ownsHome).toBe(true)
    expect(r.step.kind).toBe('cma')
    expect(r.ownedHome?.closePrice).toBe(600000)
  })

  it('does NOT treat a proximity-only near miss as ownership', async () => {
    getCrmAccess.mockResolvedValue({ email: 'matt@ryan-realty.com', role: 'superuser', brokerSlug: 'matt' })
    requirePersonInScope.mockResolvedValue({ ok: true })
    personRow = { id: 3, fub_legacy_id: 1001 }
    geoRow = { latitude: 44.05, longitude: -121.3, source_address: '123 Main St' }
    getOwnedHomeMatches.mockResolvedValue([
      { listingKey: 'Y1', address: '125 Main St', city: 'Bend', status: 'Closed', photoUrl: null, listPrice: null, closePrice: 500000, closeDate: null, beds: null, baths: null, sqft: null, yearBuilt: null, addressSlug: null, addressMatched: false },
    ])
    const r = await getContactNextStep(3)
    expect(r.ok).toBe(true)
    expect(r.ownsHome).toBe(false)
    expect(r.step.kind).toBe('newsletter')
    expect(r.ownedHome).toBeNull()
  })

  it('never throws — bad personId returns the safe default', async () => {
    const r = await getContactNextStep(0)
    expect(r.ok).toBe(false)
    expect(r.step.kind).toBe('newsletter')
  })
})
