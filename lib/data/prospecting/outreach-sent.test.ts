import { describe, expect, it } from 'vitest'
import { prospectOutreachAlreadySent } from './outreach-sent'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const BATCH_SRC = readFileSync(join(process.cwd(), 'lib/data/prospecting/batch.ts'), 'utf8')
const LIST_SRC = readFileSync(join(process.cwd(), 'lib/data/prospecting/list.ts'), 'utf8')

describe('prospectOutreachAlreadySent', () => {
  it('skips the listings relist probe once either channel has gone out', () => {
    expect(prospectOutreachAlreadySent({})).toBe(false)
    expect(prospectOutreachAlreadySent({ outreach_sms_sent_at: null, outreach_email_sent_at: null })).toBe(false)
    expect(prospectOutreachAlreadySent({ outreach_sms_sent_at: '2026-10-01T00:00:00Z' })).toBe(true)
    expect(prospectOutreachAlreadySent({ outreach_email_sent_at: '2026-10-01T00:00:00Z' })).toBe(true)
  })
})

describe('prospecting worklist read budget', () => {
  it('caps the default table read and paginates the listings probe', () => {
    expect(LIST_SRC).toMatch(/export const PROSPECTING_WORKLIST_READ_LIMIT = 800/)
    expect(LIST_SRC).toMatch(/\.limit\(PROSPECTING_WORKLIST_READ_LIMIT\)/)
    expect(BATCH_SRC).toMatch(/export const PROSPECTING_RELIST_IN_CHUNK = 80/)
    expect(BATCH_SRC).toMatch(/probeRows = rows\.filter\(\(r\) => !prospectOutreachAlreadySent\(r\)\)/)
    expect(BATCH_SRC).toMatch(/listingsInChunks/)
  })
})
