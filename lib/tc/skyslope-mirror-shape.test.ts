import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  groupFoldersIntoProperties,
  isSkySlopeMirrorCurrent,
  skySlopePropertyKey,
  stageFromCycles,
  type SkySlopeFolderSummary,
} from './skyslope-mirror-shape'
import { assertInboundRequest, SKYSLOPE_FILES_BASE } from './skyslope-inbound'

const ROOT = resolve(__dirname, '../..')

function folder(partial: Partial<SkySlopeFolderSummary> & Pick<SkySlopeFolderSummary, 'kind' | 'guid' | 'status'>): SkySlopeFolderSummary {
  return {
    guid8: partial.guid.slice(0, 8),
    address: '19496 Tumalo Reservoir Rd, Bend, OR, 97703',
    broker: 'Matt Ryan',
    mlsNumber: null,
    salePrice: 1000000,
    listingPrice: null,
    officeGross: 30000,
    commissionPercent: 3,
    escrowNumber: null,
    sellers: ['Seller'],
    buyers: ['Buyer'],
    contractAcceptanceDate: '2026-03-01',
    escrowClosingDate: '2026-03-20',
    actualClosingDate: partial.status === 'Closed' ? '2026-03-16' : null,
    expirationDate: null,
    createdOn: '2026-02-01',
    requiredOpen: [],
    activityCount: 4,
    filledCount: 4,
    ...partial,
  }
}

describe('skySlopePropertyKey', () => {
  it('matches the master-file street-number + next-token key', () => {
    expect(skySlopePropertyKey('19496 Tumalo Reservoir Rd, Bend, OR, 97703')).toBe('19496-tumalo')
    expect(skySlopePropertyKey('5663 Impala Avenue, Redmond, OR, 97756')).toBe('5663-impala')
  })
  it('falls back to guid when address is blank', () => {
    expect(skySlopePropertyKey('', 'f261f38e-aaaa')).toBe('guid-f261f38e')
  })
})

describe('stageFromCycles', () => {
  it('prefers pending over closed listing leftovers', () => {
    const staged = stageFromCycles([
      folder({ kind: 'sales', guid: 'aaa', status: 'Pending' }),
      folder({ kind: 'listings', guid: 'bbb', status: 'Active' }),
    ])
    expect(staged.stage).toBe('pending')
  })
  it('uses active_listing when no sale is in contract', () => {
    const staged = stageFromCycles([folder({ kind: 'listings', guid: 'ccc', status: 'Active' })])
    expect(staged.stage).toBe('active_listing')
  })
  it('marks a pre-contract + closed pair as a zombie', () => {
    const staged = stageFromCycles([
      folder({ kind: 'sales', guid: 'closed01', status: 'Closed' }),
      folder({ kind: 'sales', guid: 'precon01', status: 'Pre-Contract' }),
    ])
    expect(staged.stage).toBe('closed')
    expect(staged.zombie).toMatch(/zombie/)
  })
})

describe('groupFoldersIntoProperties', () => {
  it('collapses two folders at the same address onto one property_key', () => {
    const rows = groupFoldersIntoProperties([
      folder({ kind: 'sales', guid: 'sale-1', status: 'Closed', address: '17130 Mayfield Drive, Bend, OR, 97707' }),
      folder({ kind: 'listings', guid: 'list-1', status: 'Closed', address: '17130 Mayfield Drive, Bend, OR, 97707' }),
    ])
    expect(rows).toHaveLength(1)
    expect(rows[0].property_key).toBe('17130-mayfield')
    expect(rows[0].cycles).toHaveLength(2)
  })
})

describe('isSkySlopeMirrorCurrent', () => {
  const now = new Date('2026-08-16T08:00:00Z')
  it('is current inside the 36h slack window', () => {
    expect(isSkySlopeMirrorCurrent('2026-08-15T12:00:00Z', now)).toBe(true)
  })
  it('is stale at the June 10 founding sample', () => {
    expect(isSkySlopeMirrorCurrent('2026-06-10T00:35:10.142Z', now)).toBe(false)
  })
})

describe('inbound request allowlist', () => {
  it('allows login POST and folder GETs', () => {
    expect(() => assertInboundRequest('POST', `${SKYSLOPE_FILES_BASE}/auth/login`)).not.toThrow()
    expect(() => assertInboundRequest('GET', `${SKYSLOPE_FILES_BASE}/api/files/sales`)).not.toThrow()
    expect(() => assertInboundRequest('GET', `${SKYSLOPE_FILES_BASE}/api/files/listings/abc`)).not.toThrow()
  })
  it('refuses mutating verbs and off-host calls', () => {
    expect(() => assertInboundRequest('PUT', `${SKYSLOPE_FILES_BASE}/api/files/sales/abc`)).toThrow(/refused/)
    expect(() => assertInboundRequest('PATCH', `${SKYSLOPE_FILES_BASE}/api/files/sales/abc`)).toThrow(/refused/)
    expect(() => assertInboundRequest('DELETE', `${SKYSLOPE_FILES_BASE}/api/files/sales/abc`)).toThrow(/refused/)
    expect(() => assertInboundRequest('POST', `${SKYSLOPE_FILES_BASE}/api/files/sales`)).toThrow(/refused/)
    expect(() => assertInboundRequest('GET', 'https://evil.example/api/files/sales')).toThrow(/host/)
  })
})

describe('inbound source never mutates SkySlope files', () => {
  it('client + cron contain no PUT/PATCH/DELETE and POST only login', () => {
    const inbound = readFileSync(resolve(ROOT, 'lib/tc/skyslope-inbound.ts'), 'utf8')
    const cron = readFileSync(resolve(ROOT, 'app/api/cron/skyslope-mirror-refresh/route.ts'), 'utf8')
    expect(inbound).not.toMatch(/method:\s*'PUT'|method:\s*'PATCH'|method:\s*'DELETE'/)
    expect(cron).toMatch(/refreshSkySlopeMirrorInbound/)
    expect(cron).toMatch(/requireCronAuth/)
    expect(cron).not.toMatch(/method:\s*'PUT'|method:\s*'PATCH'|method:\s*'DELETE'/)
  })
})
