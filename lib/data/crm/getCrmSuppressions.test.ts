import { describe, it, expect } from 'vitest'
import {
  isComplianceReason,
  normalizeSuppressionChannel,
  clampLimit,
  clampOffset,
  resolveSuppressionValue,
  buildSuppressionRows,
  COMPLIANCE_REASON_MARKERS,
} from './getCrmSuppressions'

describe('isComplianceReason', () => {
  it('flags every compliance / litigator marker (case-insensitive substring)', () => {
    expect(isComplianceReason('compliance:hard-stop')).toBe(true)
    expect(isComplianceReason('tcpa-hard-stop')).toBe(true)
    expect(isComplianceReason('LITIGATOR')).toBe(true)
    expect(isComplianceReason('contact:do-not-call')).toBe(true)
    expect(isComplianceReason('do_not_text')).toBe(true)
    expect(isComplianceReason('TCPA risk')).toBe(true)
  })
  it('does NOT flag ordinary opt-out reasons', () => {
    expect(isComplianceReason('unsubscribed')).toBe(false)
    expect(isComplianceReason('bounced')).toBe(false)
    expect(isComplianceReason('complained')).toBe(false)
    expect(isComplianceReason('manual')).toBe(false)
  })
  it('fail-safe: empty / null / undefined is not compliance', () => {
    expect(isComplianceReason('')).toBe(false)
    expect(isComplianceReason(null)).toBe(false)
    expect(isComplianceReason(undefined)).toBe(false)
  })
  it('every documented marker actually trips the check', () => {
    for (const m of COMPLIANCE_REASON_MARKERS) expect(isComplianceReason(`x ${m} y`)).toBe(true)
  })
})

describe('normalizeSuppressionChannel', () => {
  it('passes through the real channels', () => {
    expect(normalizeSuppressionChannel('email')).toBe('email')
    expect(normalizeSuppressionChannel('sms')).toBe('sms')
    expect(normalizeSuppressionChannel('call')).toBe('call')
    expect(normalizeSuppressionChannel('all')).toBe('all')
  })
  it('defaults anything unknown to all (never silently drops a block)', () => {
    expect(normalizeSuppressionChannel('voice')).toBe('all')
    expect(normalizeSuppressionChannel('')).toBe('all')
    expect(normalizeSuppressionChannel(null)).toBe('all')
    expect(normalizeSuppressionChannel(undefined)).toBe('all')
    expect(normalizeSuppressionChannel(7)).toBe('all')
  })
  it('is case + whitespace tolerant', () => {
    expect(normalizeSuppressionChannel(' EMAIL ')).toBe('email')
  })
})

describe('clampLimit / clampOffset', () => {
  it('clampLimit defaults and caps', () => {
    expect(clampLimit(undefined)).toBe(50)
    expect(clampLimit(0)).toBe(50)
    expect(clampLimit(-5)).toBe(50)
    expect(clampLimit(25)).toBe(25)
    expect(clampLimit(9999)).toBe(200)
    expect(clampLimit(Number.NaN)).toBe(50)
    expect(clampLimit(33.7)).toBe(33)
  })
  it('clampOffset floors at zero', () => {
    expect(clampOffset(undefined)).toBe(0)
    expect(clampOffset(-10)).toBe(0)
    expect(clampOffset(100)).toBe(100)
    expect(clampOffset(Number.NaN)).toBe(0)
    expect(clampOffset(20.9)).toBe(20)
  })
})

describe('resolveSuppressionValue', () => {
  it('prefers the row value when present', () => {
    expect(resolveSuppressionValue('block@x.com', [{ value: 'p@x.com', isPrimary: 1 }], [])).toBe('block@x.com')
  })
  it('falls back to the primary email, then the primary phone', () => {
    expect(
      resolveSuppressionValue(null, [{ value: 'a@x.com' }, { value: 'p@x.com', isPrimary: true }], []),
    ).toBe('p@x.com')
    expect(resolveSuppressionValue('', [], [{ value: '5551112222', isPrimary: 1 }])).toBe('5551112222')
  })
  it('returns null when there is nothing usable', () => {
    expect(resolveSuppressionValue(null, null, undefined)).toBeNull()
    expect(resolveSuppressionValue('', [], [])).toBeNull()
    expect(resolveSuppressionValue('  ', [{ foo: 'bar' }], [{}])).toBeNull()
  })
})

describe('buildSuppressionRows', () => {
  const people = new Map<number, { id: number; name: string | null; emails: unknown; phones: unknown }>([
    [1, { id: 1, name: 'Jane Doe', emails: [{ value: 'jane@x.com', isPrimary: 1 }], phones: [] }],
  ])
  it('joins person name + value and classifies compliance', () => {
    const rows = buildSuppressionRows(
      [
        { id: 10, person_id: 1, channel: 'sms', value: null, reason: 'contact:do-not-text', source: 'import', created_at: '2026-06-01T00:00:00Z' },
        { id: 11, person_id: null, channel: 'email', value: 'lawyer@y.com', reason: 'litigator', source: 'manual', created_at: '2026-06-02T00:00:00Z' },
        { id: 12, person_id: 1, channel: 'email', value: null, reason: 'unsubscribed', source: 'app', created_at: '2026-06-03T00:00:00Z' },
      ],
      people,
    )
    expect(rows[0]).toMatchObject({ id: 10, personId: 1, personName: 'Jane Doe', value: 'jane@x.com', channel: 'sms', isCompliance: true })
    expect(rows[1]).toMatchObject({ id: 11, personId: null, personName: null, value: 'lawyer@y.com', channel: 'email', isCompliance: true })
    expect(rows[2]).toMatchObject({ id: 12, personId: 1, value: 'jane@x.com', isCompliance: false })
  })
  it('normalizes an unknown channel to all and survives a missing person', () => {
    const rows = buildSuppressionRows(
      [{ id: 20, person_id: 999, channel: 'weird', value: null, reason: 'bounced', source: 'import', created_at: '2026-06-01T00:00:00Z' }],
      people,
    )
    expect(rows[0]).toMatchObject({ id: 20, personName: null, value: null, channel: 'all', isCompliance: false })
  })
})
