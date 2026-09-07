import { describe, expect, it } from 'vitest'
import {
  AUTO_SEND_LANES,
  normalizeLaneSettings,
  isAutoSendLane,
} from '@/lib/data/cma/lane-settings'

/**
 * §1 guard. Auto-send is the one switch in this mission that can put an email
 * in front of a real person without a broker touching it, and Matt ships it
 * OFF. Every path that answers "is this lane on?" has to fail CLOSED — a
 * missing row, an unreadable table, a lane nobody seeded, a lane that is not a
 * send lane at all. These tests are the mechanism that keeps it that way when
 * somebody refactors the read.
 */

describe('normalizeLaneSettings', () => {
  it('reads a lane with no row as OFF', () => {
    const s = normalizeLaneSettings([])
    for (const lane of AUTO_SEND_LANES) expect(s[lane].autoSend).toBe(false)
  })

  it('reads an empty table as every lane OFF', () => {
    // The read returns [] when Supabase credentials are absent or the table is
    // empty. Neither may ever read as "on".
    expect(normalizeLaneSettings([]).expired.autoSend).toBe(false)
    expect(normalizeLaneSettings([]).fsbo.autoSend).toBe(false)
  })

  it('carries a lane that is on, with who turned it on', () => {
    const s = normalizeLaneSettings([
      { origin: 'expired', auto_send: true, updated_at: '2026-09-07T00:00:00.000Z', updated_by: 'matt@ryan-realty.com' },
    ])
    expect(s.expired.autoSend).toBe(true)
    expect(s.expired.updatedBy).toBe('matt@ryan-realty.com')
    expect(s.expired.updatedAt).toBe('2026-09-07T00:00:00.000Z')
    // Everything else is untouched and still off.
    expect(s.fsbo.autoSend).toBe(false)
  })

  it('treats anything that is not literally true as off', () => {
    const s = normalizeLaneSettings([
      { origin: 'fsbo', auto_send: null, updated_at: null, updated_by: null },
      { origin: 'expired', auto_send: 'true', updated_at: null, updated_by: null },
    ])
    expect(s.fsbo.autoSend).toBe(false)
    expect(s.expired.autoSend).toBe(false)
  })

  it('ignores a row for an origin that is not a send lane', () => {
    // 'internal' and 'unknown' classify to sendMode 'manual'. A row that turned
    // one of them on would be a switch with nothing behind it — worse, it would
    // read as an armed lane on the screen.
    const s = normalizeLaneSettings([
      { origin: 'unknown', auto_send: true, updated_at: null, updated_by: null },
      { origin: 'internal', auto_send: true, updated_at: null, updated_by: null },
      { origin: 'nonsense', auto_send: true, updated_at: null, updated_by: null },
    ])
    expect(Object.keys(s).sort()).toEqual([...AUTO_SEND_LANES].sort())
    for (const lane of AUTO_SEND_LANES) expect(s[lane].autoSend).toBe(false)
  })
})

describe('isAutoSendLane', () => {
  it('accepts only the six seeded lanes', () => {
    expect(isAutoSendLane('expired')).toBe(true)
    expect(isAutoSendLane('fsbo')).toBe(true)
    expect(isAutoSendLane('seller-valuation')).toBe(true)
    expect(isAutoSendLane('lead-form')).toBe(true)
    expect(isAutoSendLane('bpo')).toBe(true)
    expect(isAutoSendLane('broker')).toBe(true)
    expect(isAutoSendLane('internal')).toBe(false)
    expect(isAutoSendLane('unknown')).toBe(false)
    expect(isAutoSendLane('')).toBe(false)
  })
})
