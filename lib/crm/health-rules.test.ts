import { describe, it, expect } from 'vitest'
import {
  evaluateHealthRules,
  INBOUND_STALE_HOURS,
  DELTA_STALE_MINUTES,
  type HealthSignals,
} from './health-rules'

// A fully-healthy baseline. Each test mutates exactly the vital under test so a
// fired alarm can only have come from that vital, never an unintended one.
function healthy(): HealthSignals {
  return {
    mirrorEnabled: true,
    businessHours: true,
    hoursSinceLastInbound: 0.5,
    a2pStatus: 'VERIFIED',
    smsSendAttempts24h: 12,
    minutesSinceCleanDelta: 20,
    newLeads24h: 4,
  }
}

function keys(signals: HealthSignals): string[] {
  return evaluateHealthRules(signals).alarms.map((a) => a.key)
}

describe('evaluateHealthRules', () => {
  it('returns no alarms when every vital is healthy', () => {
    const { alarms } = evaluateHealthRules(healthy())
    expect(alarms).toEqual([])
  })

  describe('rule: mirror disabled', () => {
    it('fires critical when the mirror kill switch is off', () => {
      const { alarms } = evaluateHealthRules({ ...healthy(), mirrorEnabled: false })
      const alarm = alarms.find((a) => a.key === 'mirror-disabled')
      expect(alarm).toBeDefined()
      expect(alarm?.severity).toBe('critical')
    })
    it('clears when the mirror is enabled', () => {
      expect(keys({ ...healthy(), mirrorEnabled: true })).not.toContain('mirror-disabled')
    })
  })

  describe('rule: inbound webhook stale', () => {
    it('fires when inbound silence reaches the threshold during business hours', () => {
      const alarm = evaluateHealthRules({
        ...healthy(),
        businessHours: true,
        hoursSinceLastInbound: INBOUND_STALE_HOURS,
      }).alarms.find((a) => a.key === 'inbound-webhook-stale')
      expect(alarm).toBeDefined()
      expect(alarm?.severity).toBe('warning')
    })
    it('fires when there is no inbound contact at all (null) during business hours', () => {
      expect(
        keys({ ...healthy(), businessHours: true, hoursSinceLastInbound: null }),
      ).toContain('inbound-webhook-stale')
    })
    it('clears just under the threshold', () => {
      expect(
        keys({ ...healthy(), businessHours: true, hoursSinceLastInbound: INBOUND_STALE_HOURS - 0.1 }),
      ).not.toContain('inbound-webhook-stale')
    })
    it('NEVER fires outside business hours, even with long silence', () => {
      expect(
        keys({ ...healthy(), businessHours: false, hoursSinceLastInbound: 99 }),
      ).not.toContain('inbound-webhook-stale')
      expect(
        keys({ ...healthy(), businessHours: false, hoursSinceLastInbound: null }),
      ).not.toContain('inbound-webhook-stale')
    })
  })

  describe('rule: A2P not VERIFIED with sends attempted', () => {
    it('fires critical when sends were attempted and A2P is not VERIFIED', () => {
      for (const status of ['IN_PROGRESS', 'FAILED', 'PENDING', 'NONE'] as const) {
        const alarm = evaluateHealthRules({
          ...healthy(),
          a2pStatus: status,
          smsSendAttempts24h: 5,
        }).alarms.find((a) => a.key === 'a2p-not-verified')
        expect(alarm, `status ${status}`).toBeDefined()
        expect(alarm?.severity).toBe('critical')
      }
    })
    it('clears when A2P is VERIFIED even with sends attempted', () => {
      expect(
        keys({ ...healthy(), a2pStatus: 'VERIFIED', smsSendAttempts24h: 50 }),
      ).not.toContain('a2p-not-verified')
    })
    it('clears when no sends were attempted (pre-launch, not a regression)', () => {
      expect(
        keys({ ...healthy(), a2pStatus: 'IN_PROGRESS', smsSendAttempts24h: 0 }),
      ).not.toContain('a2p-not-verified')
    })
    it('clears when A2P status is unknown (null) — we cannot assert a regression', () => {
      expect(
        keys({ ...healthy(), a2pStatus: null, smsSendAttempts24h: 5 }),
      ).not.toContain('a2p-not-verified')
    })
    it('singularizes the message for a single send attempt', () => {
      const alarm = evaluateHealthRules({
        ...healthy(),
        a2pStatus: 'PENDING',
        smsSendAttempts24h: 1,
      }).alarms.find((a) => a.key === 'a2p-not-verified')
      expect(alarm?.message).toContain('1 outbound text was attempted')
    })
  })

  describe('rule: delta sync stale', () => {
    it('fires when the last clean delta is past the threshold', () => {
      const alarm = evaluateHealthRules({
        ...healthy(),
        minutesSinceCleanDelta: DELTA_STALE_MINUTES,
      }).alarms.find((a) => a.key === 'delta-stale')
      expect(alarm).toBeDefined()
      expect(alarm?.severity).toBe('warning')
    })
    it('fires when there is no clean delta run on record (null)', () => {
      expect(keys({ ...healthy(), minutesSinceCleanDelta: null })).toContain('delta-stale')
    })
    it('clears just under the threshold', () => {
      expect(
        keys({ ...healthy(), minutesSinceCleanDelta: DELTA_STALE_MINUTES - 1 }),
      ).not.toContain('delta-stale')
    })
  })

  describe('rule: lead volume cratered', () => {
    it('fires when zero new leads in 24h', () => {
      const alarm = evaluateHealthRules({ ...healthy(), newLeads24h: 0 }).alarms.find(
        (a) => a.key === 'lead-volume-cratered',
      )
      expect(alarm).toBeDefined()
      expect(alarm?.severity).toBe('warning')
    })
    it('clears with at least one new lead', () => {
      expect(keys({ ...healthy(), newLeads24h: 1 })).not.toContain('lead-volume-cratered')
    })
  })

  describe('composition', () => {
    it('fires multiple independent alarms at once and only those', () => {
      const result = evaluateHealthRules({
        mirrorEnabled: false,
        businessHours: true,
        hoursSinceLastInbound: null,
        a2pStatus: 'FAILED',
        smsSendAttempts24h: 3,
        minutesSinceCleanDelta: null,
        newLeads24h: 0,
      })
      expect(new Set(result.alarms.map((a) => a.key))).toEqual(
        new Set([
          'mirror-disabled',
          'inbound-webhook-stale',
          'a2p-not-verified',
          'delta-stale',
          'lead-volume-cratered',
        ]),
      )
    })
    it('every alarm carries a stable key, a known severity, and a non-empty message', () => {
      const { alarms } = evaluateHealthRules({
        mirrorEnabled: false,
        businessHours: true,
        hoursSinceLastInbound: null,
        a2pStatus: 'FAILED',
        smsSendAttempts24h: 3,
        minutesSinceCleanDelta: null,
        newLeads24h: 0,
      })
      for (const a of alarms) {
        expect(a.key.length).toBeGreaterThan(0)
        expect(['warning', 'critical']).toContain(a.severity)
        expect(a.message.trim().length).toBeGreaterThan(0)
      }
    })
  })
})
