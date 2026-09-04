/**
 * FSBO live-status HARD-SKIP (Matt 2026-09-03): same as expired.
 * MLS Active/Pending/Coming Soon at address OR parcel blocks; Closed after
 * detected_at blocks. Still-FSBO live probe blocks when status !== active.
 * No universal gate in sendCmaToLead — hard skip only on FSBO first-touch.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { isClosedStatus } from '@/lib/listing-status'
import {
  expiredOutreachListingHits,
  parcelFromEnrichmentNotes,
} from './compliance'

const BATCH_SRC = readFileSync(join(process.cwd(), 'lib/data/prospecting/batch.ts'), 'utf8')
const COMPLIANCE_SRC = readFileSync(join(process.cwd(), 'lib/data/prospecting/compliance.ts'), 'utf8')
const SEND_SRC = readFileSync(join(process.cwd(), 'app/actions/prospecting.ts'), 'utf8')

const DETECT = '2026-06-01T00:00:00Z'
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
    kind: 'fsbo',
    listing: listing(),
    namePrefix: 'SMITH',
    cityUpper: 'BEND',
    expiryComparator: DETECT,
    subjectParcel: PARCEL,
    ...over,
  })
}

describe('FSBO hard-skip — MLS relist', () => {
  it('blocks Active / Pending / Coming Soon at the same street + city', () => {
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

  it('blocks Active on the same parcel_number even when street spelling differs', () => {
    expect(
      hit({
        listing: listing({
          StreetName: 'SMITH RD',
          City: 'Redmond',
          StandardStatus: 'Active',
          CloseDate: null,
        }),
      }),
    ).toBe(true)
  })
})

describe('FSBO hard-skip — Closed after detect', () => {
  it('blocks a Closed sale after detected_at on the same street + city', () => {
    expect(
      hit({
        listing: listing({ parcel_number: null }),
        subjectParcel: null,
      }),
    ).toBe(true)
  })

  it('blocks a Closed sale after detect on the same parcel_number', () => {
    expect(
      hit({
        listing: listing({ StreetName: 'SMITH ROAD', City: 'Redmond' }),
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

  it('does not block a Closed sale before detect at the same address', () => {
    expect(
      hit({
        listing: listing({ CloseDate: BEFORE, status_change_timestamp: BEFORE, parcel_number: null }),
        subjectParcel: null,
      }),
    ).toBe(false)
  })

  it('isClosedStatus is the Closed classifier', () => {
    expect(isClosedStatus('Closed')).toBe(true)
    expect(isClosedStatus('Active')).toBe(false)
    expect(COMPLIANCE_SRC).toMatch(/isClosedStatus\(status\)/)
  })
})

describe('parcelFromEnrichmentNotes', () => {
  it('scrapes taxlot from owner-lookup enrichment_notes', () => {
    expect(
      parcelFromEnrichmentNotes(
        'Resolved via Deschutes County assessor records (taxlot 171219DB02100, account 129007).',
      ),
    ).toBe('171219DB02100')
    expect(parcelFromEnrichmentNotes('no taxlot here')).toBeNull()
    expect(parcelFromEnrichmentNotes(null)).toBeNull()
  })
})

describe('wiring — hard skip only on FSBO first-touch', () => {
  it('verifyNotRelisted uses Closed-inclusive OR for FSBO and loads fsbo taxlot', () => {
    expect(BATCH_SRC).toMatch(/export async function verifyNotRelisted/)
    expect(BATCH_SRC).toMatch(/EXPIRED_OUTREACH_STATUS_OR/)
    expect(BATCH_SRC).toMatch(/fsbo_url/)
    expect(BATCH_SRC).toMatch(/parcelFromEnrichmentNotes/)
    expect(BATCH_SRC).toMatch(/export async function verifyFsboStillActive/)
  })

  it('sendProspectingIntro / EmailIntro pass detectedAt and call still-FSBO + verifyNotRelisted', () => {
    const intro = SEND_SRC.indexOf('export async function sendProspectingIntro')
    const email = SEND_SRC.indexOf('export async function sendProspectingEmailIntro')
    expect(intro).toBeGreaterThan(-1)
    expect(email).toBeGreaterThan(-1)
    const introSrc = SEND_SRC.slice(intro, email)
    const emailSrc = SEND_SRC.slice(email)
    for (const src of [introSrc, emailSrc]) {
      expect(src).toMatch(/verifyNotRelisted/)
      expect(src).toMatch(/verifyFsboStillActive/)
      expect(src).toMatch(/detectedAt/)
      expect(src).toMatch(/fsbo_url:\s*kind === 'fsbo' \? prospect\.id/)
    }
    expect(SEND_SRC).not.toMatch(/sendCmaToLead\([\s\S]{0,200}verifyNotRelisted/)
  })

  it('resolveComplianceBatch paints FSBO with detected_at comparator + Closed OR', () => {
    expect(BATCH_SRC).toMatch(/kind === 'fsbo'[\s\S]{0,120}detected_at/)
    expect(BATCH_SRC).toMatch(/resolveComplianceBatch[\s\S]*EXPIRED_OUTREACH_STATUS_OR/)
  })
})
