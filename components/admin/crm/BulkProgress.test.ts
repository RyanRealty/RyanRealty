import { describe, it, expect } from 'vitest'
import { summarizeBreakdown } from './BulkProgress'
import type { CrmBulkJobView } from '@/lib/data/crm/getCrmBulkJob'

function view(partial: Partial<CrmBulkJobView>): CrmBulkJobView {
  return {
    id: 1,
    kind: 'add_tag',
    status: 'running',
    total: 100,
    processed: 0,
    skipped: 0,
    breakdown: {},
    error: null,
    actorEmail: 'matt@ryan-realty.com',
    createdAt: '2026-06-25T00:00:00Z',
    startedAt: null,
    finishedAt: null,
    progress: 0,
    isTerminal: false,
    ...partial,
  }
}

describe('summarizeBreakdown', () => {
  it('falls back to processed/skipped when breakdown is empty', () => {
    expect(summarizeBreakdown(view({ processed: 50, skipped: 8, breakdown: {} }))).toBe('50 processed, 8 skipped')
  })

  it('renders non-zero breakdown counters with humanized keys', () => {
    const s = summarizeBreakdown(view({ breakdown: { tagged: 374, already_tagged: 12, suppressed: 38 } }))
    expect(s).toBe('374 tagged, 12 already tagged, 38 suppressed')
  })

  it('omits zero-valued counters', () => {
    const s = summarizeBreakdown(view({ breakdown: { tagged: 5, refused_protected_tag: 0 } }))
    expect(s).toBe('5 tagged')
  })

  it('falls back when every counter is zero', () => {
    const s = summarizeBreakdown(view({ processed: 3, skipped: 1, breakdown: { tagged: 0 } }))
    expect(s).toBe('3 processed, 1 skipped')
  })
})
