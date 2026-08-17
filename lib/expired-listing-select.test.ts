import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CAPTURE_MIN_LIST_PRICE, CAPTURE_SERVICE_AREA_CITIES } from '@/lib/prospecting/capture-scope'
import {
  EXPIRED_CAPTURE_PRICE_OP,
  SCHEDULED_EXPIRED_CAPTURE,
  expiredListingSeenKeyFilter,
} from './expired-listing-select'

const SELECT_SRC = readFileSync(join(process.cwd(), 'lib/data/sync/expiredSelect.ts'), 'utf8')
const DELTA_SRC = readFileSync(join(process.cwd(), 'lib/sync/deltaSync.ts'), 'utf8')
const PROCESSOR_SRC = readFileSync(join(process.cwd(), 'lib/expired-listing-processor.ts'), 'utf8')

function bodyOf(src: string, fnName: string, span = 2400): string {
  const start = src.indexOf(`export async function ${fnName}`)
  expect(start, `${fnName} not found`).toBeGreaterThan(-1)
  return src.slice(start, start + span)
}

describe('expired capture select filters', () => {
  it('includes any list price via gte against CAPTURE_MIN_LIST_PRICE', () => {
    expect(CAPTURE_MIN_LIST_PRICE).toBe(0)
    expect(EXPIRED_CAPTURE_PRICE_OP).toBe('gte')
    const body = bodyOf(SELECT_SRC, 'selectNewExpiredListings')
    expect(body).toMatch(/\.gte\(\s*'ListPrice',\s*options\.minListPrice\s*\)/)
    expect(body).not.toMatch(/\.gt\(\s*'ListPrice'/)
    expect(body).not.toMatch(/500_000|500000/)
  })

  it('selects a $250k expired in Bend (six cities, any price)', () => {
    const listPrice = 250_000
    expect(CAPTURE_SERVICE_AREA_CITIES).toEqual([
      'Bend',
      'Redmond',
      'Sisters',
      'Sunriver',
      'Tumalo',
      'La Pine',
    ])
    expect(CAPTURE_SERVICE_AREA_CITIES).toContain('Bend')
    expect(listPrice >= CAPTURE_MIN_LIST_PRICE).toBe(true)
    expect(500_000 >= CAPTURE_MIN_LIST_PRICE).toBe(true)
    const body = bodyOf(SELECT_SRC, 'selectNewExpiredListings')
    expect(body).toMatch(/\.gte\(\s*'ListPrice',\s*options\.minListPrice\s*\)/)
    expect(PROCESSOR_SRC).toMatch(/minListPrice:\s*MIN_LIST_PRICE/)
  })

  it('excludes keys already in expired_listings in SQL before limit', () => {
    const body = bodyOf(SELECT_SRC, 'selectNewExpiredListings')
    expect(SELECT_SRC).toMatch(/from\('expired_listings'\)/)
    const seenIdx = body.indexOf('listAllExpiredListingKeys')
    const notInIdx = body.search(/\.not\(\s*'ListingKey',\s*'in'/)
    const limitIdx = body.search(/\.limit\(\s*options\.limit\s*\)/)
    expect(seenIdx).toBeGreaterThan(-1)
    expect(notInIdx).toBeGreaterThan(seenIdx)
    expect(limitIdx).toBeGreaterThan(notInIdx)
    expect(expiredListingSeenKeyFilter([])).toBeNull()
    expect(expiredListingSeenKeyFilter(['KEY-A', 'KEY-B'])).toBe('("KEY-A","KEY-B")')
  })

  it('scheduled sync-delta lookback is 24 hours and maxPerRun is 30', () => {
    expect(SCHEDULED_EXPIRED_CAPTURE.lookbackHours).toBe(24)
    expect(SCHEDULED_EXPIRED_CAPTURE.maxPerRun).toBe(30)
    expect(DELTA_SRC).toMatch(/processNewExpiredListings\(\s*sb,\s*SCHEDULED_EXPIRED_CAPTURE\s*\)/)
    expect(DELTA_SRC).not.toMatch(/lookbackHours:\s*2\b/)
  })

  it('loads listing_history (and Spark finalize helper when empty) before the CRM note', () => {
    expect(PROCESSOR_SRC).toMatch(/selectListingHistoryForKey/)
    expect(PROCESSOR_SRC).toMatch(/fetchAndInsertHistoryCore/)
    expect(PROCESSOR_SRC).toMatch(/buildListingNote\([\s\S]*loadHistoryForExpiredNote/)
  })
})
