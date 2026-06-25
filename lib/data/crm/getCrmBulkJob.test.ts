import { describe, it, expect } from 'vitest'
import {
  normalizeBulkJobStatus,
  computeProgress,
  buildBulkJobView,
} from './getCrmBulkJob'

describe('normalizeBulkJobStatus', () => {
  it('passes through valid statuses', () => {
    expect(normalizeBulkJobStatus('running')).toBe('running')
    expect(normalizeBulkJobStatus('done')).toBe('done')
    expect(normalizeBulkJobStatus('failed')).toBe('failed')
    expect(normalizeBulkJobStatus('canceled')).toBe('canceled')
    expect(normalizeBulkJobStatus('queued')).toBe('queued')
  })
  it('defaults an unknown / empty value to queued', () => {
    expect(normalizeBulkJobStatus('garbage')).toBe('queued')
    expect(normalizeBulkJobStatus(null)).toBe('queued')
    expect(normalizeBulkJobStatus(undefined)).toBe('queued')
  })
})

describe('computeProgress', () => {
  it('null total -> null while in flight, 1 once terminal', () => {
    expect(computeProgress(null, 0, 'queued')).toBeNull()
    expect(computeProgress(null, 0, 'running')).toBeNull()
    expect(computeProgress(null, 0, 'done')).toBe(1)
    expect(computeProgress(null, 0, 'failed')).toBe(1)
  })
  it('0 total reads as fully done', () => {
    expect(computeProgress(0, 0, 'done')).toBe(1)
  })
  it('ratio in [0,1], clamped above 1', () => {
    expect(computeProgress(400, 100, 'running')).toBe(0.25)
    expect(computeProgress(400, 400, 'done')).toBe(1)
    expect(computeProgress(400, 500, 'running')).toBe(1) // clamp
  })
  it('floors negatives to 0', () => {
    expect(computeProgress(400, -10, 'running')).toBe(0)
  })
})

describe('buildBulkJobView', () => {
  const base = {
    id: 7,
    kind: 'add_tag',
    status: 'running',
    total: 412,
    processed: 100,
    skipped: 12,
    breakdown: { mutated: 88, suppressed: 12 },
    error: null,
    actor_email: 'matt@ryan-realty.com',
    created_at: '2026-06-25T00:00:00Z',
    started_at: '2026-06-25T00:00:01Z',
    finished_at: null,
  }

  it('maps every field and derives progress + isTerminal', () => {
    const v = buildBulkJobView(base)
    expect(v.id).toBe(7)
    expect(v.kind).toBe('add_tag')
    expect(v.status).toBe('running')
    expect(v.total).toBe(412)
    expect(v.processed).toBe(100)
    expect(v.skipped).toBe(12)
    expect(v.breakdown).toEqual({ mutated: 88, suppressed: 12 })
    expect(v.actorEmail).toBe('matt@ryan-realty.com')
    expect(v.progress).toBeCloseTo(100 / 412)
    expect(v.isTerminal).toBe(false)
  })

  it('a done job is terminal with progress 1', () => {
    const v = buildBulkJobView({ ...base, status: 'done', processed: 412, finished_at: '2026-06-25T00:05:00Z' })
    expect(v.isTerminal).toBe(true)
    expect(v.progress).toBe(1)
    expect(v.finishedAt).toBe('2026-06-25T00:05:00Z')
  })

  it('null total (unresolved ast job) -> null progress while queued', () => {
    const v = buildBulkJobView({ ...base, status: 'queued', total: null, processed: 0, started_at: null })
    expect(v.total).toBeNull()
    expect(v.progress).toBeNull()
  })

  it('coerces a null breakdown to {} and floors negative counters', () => {
    const v = buildBulkJobView({ ...base, breakdown: null, processed: -5, skipped: -3 })
    expect(v.breakdown).toEqual({})
    expect(v.processed).toBe(0)
    expect(v.skipped).toBe(0)
  })

  it('carries the error on a failed job', () => {
    const v = buildBulkJobView({ ...base, status: 'failed', error: 'handler threw' })
    expect(v.status).toBe('failed')
    expect(v.error).toBe('handler threw')
    expect(v.isTerminal).toBe(true)
  })
})
