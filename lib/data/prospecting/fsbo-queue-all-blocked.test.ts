/**
 * FSBO queue "76 of 76 BLOCKED" (FSBO Desk 2026-10-09).
 *
 * Root cause was data, not a new gate: every FSBO row on prod was either
 * status=off_market (the processor's 7-day not-seen writer) or a Craigslist
 * placeholder with no address and no contact. This pins the gate both ways:
 * a clean, active FSBO row (653 NE 12th shape) is NOT blocked, and the real
 * blocks (off market, MLS relist, litigator, no open channel) still hold.
 * It also pins the plain-words off-market reason and the header count.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

type Row = Record<string, unknown>

let listingsRows: Row[] = []
let peopleRows: Row[] = []

function chain(table: string) {
  const q = {
    select: () => q,
    in: () => q,
    eq: () => q,
    or: () => q,
    order: () => q,
    limit: () => q,
    then(resolve: (v: { data: Row[]; error: null }) => void) {
      if (table === 'listings') return resolve({ data: listingsRows, error: null })
      if (table === 'crm_people') return resolve({ data: peopleRows, error: null })
      return resolve({ data: [], error: null })
    },
  }
  return q
}

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({ from: (t: string) => chain(t) }),
}))

import { resolveComplianceBatch } from './batch'
import { classifyProspect } from './classify'
import { fsboOffMarketReason, type ProspectDocState } from './types'

const finalized: ProspectDocState = { state: 'ready', slug: 'cma-653-ne-12th', docType: 'cma', status: 'finalized', recommendedList: 650000 }
const draft: ProspectDocState = { state: 'ready', slug: 'cma-653-ne-12th', docType: 'cma', status: 'draft', recommendedList: 650000 }

function fsbo(over: Row = {}): Row {
  return {
    fsbo_url: 'https://www.zillow.com/homedetails/653-NE-12th-St-Bend-OR-97701/60581204_zpid',
    street_address: '653 NE 12th St',
    city: 'Bend',
    status: 'active',
    detected_at: '2026-07-15T00:56:11Z',
    last_seen_at: '2026-10-09T09:35:36Z',
    contact_phone: '5415550100',
    contact_email: 'owner@example.com',
    outreach_crm_person_id: null,
    fub_person_id: 57336,
    compliance_hard_stop: false,
    compliance_flags: [],
    enrichment_notes: null,
    ...over,
  }
}

async function bucketOf(row: Row, doc: ProspectDocState = finalized) {
  const map = await resolveComplianceBatch('fsbo', [row])
  const c = map.get(String(row.fsbo_url))
  if (!c) throw new Error('no compliance entry')
  const personId = (row.outreach_crm_person_id as number | null) ?? (row.fub_person_id as number | null) ?? null
  return { bucket: classifyProspect(doc, c, false, personId), compliance: c }
}

beforeEach(() => {
  listingsRows = []
  peopleRows = [{ id: 57336, tags: [] }]
})

describe('FSBO queue gate — a clean row is not blocked', () => {
  it('active 653 NE 12th with phone, email, person, no flags and a finalized CMA is ready, not blocked', async () => {
    const { bucket, compliance } = await bucketOf(fsbo())
    expect(compliance.offMarket).toBe(false)
    expect(compliance.relisted).toBe(false)
    expect(compliance.allChannelsBlocked).toBe(false)
    expect(compliance.reasons).toEqual([])
    expect(bucket).toBe('sendable')
  })

  it('the same clean row with a DRAFT CMA needs an audit — still not blocked', async () => {
    const { bucket } = await bucketOf(fsbo(), draft)
    expect(bucket).toBe('needs-audit')
  })

  it('an unrelated MLS listing on the same street number does not block it', async () => {
    listingsRows = [{ StreetNumber: '653', StreetName: 'NW Elm', City: 'Redmond', StandardStatus: 'Active', status_change_timestamp: '2026-09-01T00:00:00Z' }]
    const { bucket } = await bucketOf(fsbo())
    expect(bucket).toBe('sendable')
  })
})

describe('FSBO queue gate — real blocks still hold', () => {
  it('off_market blocks and says when the ad was last seen', async () => {
    const { bucket, compliance } = await bucketOf(fsbo({ status: 'off_market', last_seen_at: '2026-07-30T09:36:13Z' }))
    expect(bucket).toBe('excluded')
    expect(compliance.reasons).toContain('Off market (FSBO ad not seen since Jul 30, 2026)')
  })

  it('MLS Active at the same address blocks (20308 Aberdeen class)', async () => {
    listingsRows = [{ StreetNumber: '653', StreetName: 'NE 12th', City: 'Bend', StandardStatus: 'Active', status_change_timestamp: '2026-08-04T22:19:56Z' }]
    const { bucket, compliance } = await bucketOf(fsbo())
    expect(compliance.relisted).toBe(true)
    expect(bucket).toBe('excluded')
  })

  it('a litigator flag blocks every channel', async () => {
    const { bucket } = await bucketOf(fsbo({ compliance_flags: ['litigator'] }))
    expect(bucket).toBe('excluded')
  })

  it('an opt-out on every channel blocks', async () => {
    peopleRows = [{ id: 57336, tags: ['compliance:hard-stop'] }]
    const { bucket } = await bucketOf(fsbo())
    expect(bucket).toBe('excluded')
  })

  it('a placeholder row with no address, phone or email has no open channel', async () => {
    const { bucket } = await bucketOf(
      fsbo({ fsbo_url: 'https://bend.craigslist.org/reo/x.html', street_address: '', contact_phone: null, contact_email: null, fub_person_id: null }),
      { state: 'none' },
    )
    expect(bucket).toBe('excluded')
  })
})

describe('fsboOffMarketReason', () => {
  it('falls back when last_seen_at is missing', () => {
    expect(fsboOffMarketReason(null)).toBe('Off market (FSBO ad no longer seen)')
  })
})

describe('queue header shows the blocked count', () => {
  const PAGE = readFileSync(join(process.cwd(), 'app/admin/(protected)/prospecting/page.tsx'), 'utf8')
  it('renders summary.excluded next to ready / audit / sent, not only in the filter dropdown', () => {
    const verdict = PAGE.slice(PAGE.indexOf('<VerdictLine'), PAGE.indexOf('</VerdictLine>'))
    expect(verdict).toContain('{summary.sendable} ready to send')
    expect(verdict).toContain('{summary.excluded} blocked')
  })
})
