import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const src = readFileSync(new URL('./route.ts', import.meta.url), 'utf8')

describe('offline-conversions cron — GA4 Measurement Protocol', () => {
  it('sends qualify_lead / close_convert_lead through the shared MP helper', () => {
    expect(src).toContain('ga4EventForBuyerStage')
    expect(src).toContain('sendOfflineGa4Conversion')
    expect(src).toContain('readStoredGaClientId')
    expect(src).toContain('ga4MissingClientId')
    expect(src).toContain('no stored GA client_id')
  })

  it('does not mint a client_id when the contact has none', () => {
    expect(src).not.toMatch(/clientIdFromSessionId/)
    expect(src).not.toMatch(/randomUUID/)
  })

  it('keeps the Meta buyer upload', () => {
    expect(src).toContain('uploadOfflineConversion')
    expect(src).toContain('milestoneForStage')
  })
})
