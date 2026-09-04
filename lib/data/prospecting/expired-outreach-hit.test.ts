/**
 * Locks the expired-outreach MLS hit: the existing StreetNumber + first-word
 * StreetName + City match, plus parcel_number when both sides have one, and
 * the sold-after-expire extend (Closed + CloseDate/status_change after
 * expiryComparator). Relist (Active/Pending/Coming Soon) must keep working.
 * This is the SAME `relisted` flag verifyNotRelisted / isRelistedNow /
 * resolveComplianceBatch already return — not a new gate.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { isClosedStatus } from '@/lib/listing-status'
import {
  expiredOutreachListingHits,
  normalizeParcelNumber,
} from './compliance'

const BATCH_SRC = readFileSync(join(process.cwd(), 'lib/data/prospecting/batch.ts'), 'utf8')
const COMPLIANCE_SRC = readFileSync(join(process.cwd(), 'lib/data/prospecting/compliance.ts'), 'utf8')
const SEND_SRC = readFileSync(join(process.cwd(), 'app/actions/prospecting.ts'), 'utf8')

const EXPIRE = '2026-06-01T00:00:00Z'
const AFTER = '2026-07-15T00:00:00Z'
const BEFORE = '2025-12-01T00:00:00Z'
const PARCEL = '171219DB02100'

function listing(over: Partial<Parameters<typeof expiredOutreachListingHits>[0]['listing']> = {}) {
  return {
    StreetName: 'SMITH',
    City: 'Bend',
    StandardStatus: 'Closed',
    CloseDate: AFTER,
    status_change_timestamp: AFTER,
    parcel_number: PARCEL,
    ...over,
  }
}

function hit(over: Partial<Parameters<typeof expiredOutreachListingHits>[0]> = {}) {
  return expiredOutreachListingHits({
    kind: 'expired',
    listing: listing(),
    namePrefix: 'SMITH',
    cityUpper: 'BEND',
    expiryComparator: EXPIRE,
    subjectParcel: PARCEL,
    ...over,
  })
}

describe('expiredOutreachListingHits — sold after expire', () => {
  it('blocks a Closed sale after expire on the same street + city', () => {
    expect(
      hit({
        listing: listing({ parcel_number: null }),
        subjectParcel: null,
      }),
    ).toBe(true)
  })

  it('blocks a Closed sale after expire on the same parcel_number even when the street spelling differs', () => {
    expect(
      hit({
        listing: listing({ StreetName: 'SMITH RD', City: 'Redmond' }),
      }),
    ).toBe(true)
  })

  it('uses status_change_timestamp when CloseDate is missing', () => {
    expect(
      hit({
        listing: listing({ CloseDate: null, status_change_timestamp: AFTER, parcel_number: null }),
        subjectParcel: null,
      }),
    ).toBe(true)
  })

  it('does not block a Closed sale before expire at the same address', () => {
    expect(
      hit({
        listing: listing({ CloseDate: BEFORE, status_change_timestamp: BEFORE, parcel_number: null }),
        subjectParcel: null,
      }),
    ).toBe(false)
  })

  it('does not block a Closed sale after expire at a different address and parcel', () => {
    expect(
      hit({
        listing: listing({ StreetName: 'OAK', City: 'Redmond', parcel_number: '999999999' }),
        subjectParcel: PARCEL,
      }),
    ).toBe(false)
  })
})

describe('expiredOutreachListingHits — relist still blocks', () => {
  it('blocks an Active listing after expire on the same street + city (new MLS number)', () => {
    expect(
      hit({
        listing: listing({
          StandardStatus: 'Active',
          CloseDate: null,
          status_change_timestamp: AFTER,
          parcel_number: null,
        }),
        subjectParcel: null,
      }),
    ).toBe(true)
  })

  it('blocks Pending / Coming Soon after expire', () => {
    expect(
      hit({
        listing: listing({ StandardStatus: 'Pending', CloseDate: null, parcel_number: null }),
        subjectParcel: null,
      }),
    ).toBe(true)
    expect(
      hit({
        listing: listing({ StandardStatus: 'Coming Soon', CloseDate: null, parcel_number: null }),
        subjectParcel: null,
      }),
    ).toBe(true)
  })
})

describe('isClosedStatus is the Closed classifier', () => {
  it('treats Closed and Closed-like Spark strings as closed', () => {
    expect(isClosedStatus('Closed')).toBe(true)
    expect(isClosedStatus('Closed Sale')).toBe(true)
    expect(isClosedStatus('Active')).toBe(false)
  })

  it('the prospecting probe imports isClosedStatus from lib/listing-status', () => {
    expect(COMPLIANCE_SRC).toMatch(/import \{ isClosedStatus \} from '@\/lib\/listing-status'/)
    expect(COMPLIANCE_SRC).toMatch(/isClosedStatus\(status\)/)
  })
})

describe('normalizeParcelNumber', () => {
  it('keeps a real APN and drops junk', () => {
    expect(normalizeParcelNumber(' 171219DB02100 ')).toBe('171219DB02100')
    expect(normalizeParcelNumber('n/a')).toBeNull()
    expect(normalizeParcelNumber('')).toBeNull()
    expect(normalizeParcelNumber(null)).toBeNull()
  })
})

describe('existing-path wiring (no new gate)', () => {
  it('verifyNotRelisted is still the send probe and now selects CloseDate + parcel_number', () => {
    expect(BATCH_SRC).toMatch(/export async function verifyNotRelisted/)
    expect(BATCH_SRC).toMatch(/EXPIRED_OUTREACH_LISTING_SELECT/)
    expect(BATCH_SRC).toMatch(/CloseDate/)
    expect(BATCH_SRC).toMatch(/parcel_number/)
    expect(BATCH_SRC).toMatch(/expiredOutreachListingHits/)
  })

  it('isRelistedNow and resolveComplianceBatch use the same hit helper', () => {
    expect(COMPLIANCE_SRC).toMatch(/expiredOutreachListingHits/)
    expect(BATCH_SRC).toMatch(/resolveComplianceBatch[\s\S]*expiredOutreachListingHits/)
  })

  it('sendProspectingIntro and sendProspectingEmailIntro still call verifyNotRelisted', () => {
    const intro = SEND_SRC.indexOf('export async function sendProspectingIntro')
    const email = SEND_SRC.indexOf('export async function sendProspectingEmailIntro')
    expect(intro).toBeGreaterThan(-1)
    expect(email).toBeGreaterThan(-1)
    expect(SEND_SRC.slice(intro, email)).toMatch(/verifyNotRelisted/)
    expect(SEND_SRC.slice(email)).toMatch(/verifyNotRelisted/)
    expect(SEND_SRC).not.toMatch(/sendCmaToLead\([\s\S]{0,200}verifyNotRelisted/)
    // FSBO Closed-since-detect: send passes detectedAt as expiryComparator.
    expect(SEND_SRC).toMatch(/expiryComparator: kind === 'fsbo' \? prospect\.detectedAt : prospect\.expiredAt/)
  })
})

describe('expiredOutreachListingHits — FSBO Closed-since-detect', () => {
  const DETECT = '2026-07-15T00:00:00Z'
  const AFTER = '2026-08-01T00:00:00Z'
  const BEFORE = '2026-06-01T00:00:00Z'

  it('blocks Active / Pending / Coming Soon at the FSBO address', () => {
    expect(
      expiredOutreachListingHits({
        kind: 'fsbo',
        listing: listing({ StandardStatus: 'Active', CloseDate: null, parcel_number: null }),
        namePrefix: 'SMITH',
        cityUpper: 'BEND',
        expiryComparator: DETECT,
        subjectParcel: null,
      }),
    ).toBe(true)
  })

  it('blocks Closed with CloseDate after detected_at', () => {
    expect(
      expiredOutreachListingHits({
        kind: 'fsbo',
        listing: listing({
          StandardStatus: 'Closed',
          CloseDate: AFTER,
          status_change_timestamp: AFTER,
          parcel_number: null,
        }),
        namePrefix: 'SMITH',
        cityUpper: 'BEND',
        expiryComparator: DETECT,
        subjectParcel: null,
      }),
    ).toBe(true)
  })

  it('does not block Closed before detected_at', () => {
    expect(
      expiredOutreachListingHits({
        kind: 'fsbo',
        listing: listing({
          StandardStatus: 'Closed',
          CloseDate: BEFORE,
          status_change_timestamp: BEFORE,
          parcel_number: null,
        }),
        namePrefix: 'SMITH',
        cityUpper: 'BEND',
        expiryComparator: DETECT,
        subjectParcel: null,
      }),
    ).toBe(false)
  })
})
