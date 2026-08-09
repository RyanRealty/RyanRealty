import { describe, it, expect } from 'vitest'
import { applyAdminOverridesToListingRow } from './listingEdit'

describe('applyAdminOverridesToListingRow', () => {
  it('re-applies broker-owned price, status, and public remarks after a Spark row', () => {
    const spark = {
      ListNumber: '123',
      ListPrice: 500000,
      StandardStatus: 'Active',
      details: { PublicRemarks: 'MLS remarks', Beds: 3 },
    }
    const existing = {
      admin_overrides: {
        list_price_set: true,
        list_price: 525000,
        standard_status_set: true,
        standard_status: 'Pending',
        public_remarks_set: true,
        public_remarks: 'Broker remarks survive sync',
        admin_notes: 'internal',
      },
    }
    const out = applyAdminOverridesToListingRow(spark, existing)
    expect(out.ListPrice).toBe(525000)
    expect(out.StandardStatus).toBe('Pending')
    const details = out.details as { PublicRemarks?: string; admin_overrides?: { admin_notes?: string } }
    expect(details.PublicRemarks).toBe('Broker remarks survive sync')
    expect(details.admin_overrides?.admin_notes).toBe('internal')
  })

  it('is a no-op when no admin_overrides exist', () => {
    const spark = { ListNumber: '1', ListPrice: 1, details: {} }
    expect(applyAdminOverridesToListingRow(spark, null)).toEqual(spark)
  })
})
