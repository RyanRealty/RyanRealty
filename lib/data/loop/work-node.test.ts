import { describe, it, expect } from 'vitest'
import {
  assertTransition,
  assertWorkNodeDraft,
  isLegalTransition,
  isStaleInProgress,
} from './work-node'

describe('work-node contract (a node is a bounded job)', () => {
  const ok = {
    domain: 'nurture',
    title: 'Alerts coverage',
    objective: 'Enroll path from account/LP into listing_alerts',
    output: 'Enroll path live; alert count rises past 6',
    accept: 'A real saved search produces a listing_alerts row with crm_person_id',
  }

  it('accepts a full contract', () => {
    expect(() => assertWorkNodeDraft(ok)).not.toThrow()
  })

  it('refuses a node without an accept test — it cannot be audited', () => {
    expect(() => assertWorkNodeDraft({ ...ok, accept: ' ' })).toThrow(/accept/i)
  })

  it('refuses a node without an output artifact', () => {
    expect(() => assertWorkNodeDraft({ ...ok, output: '' })).toThrow(/output/i)
  })

  it('refuses an unknown domain — company work names a closed domain', () => {
    expect(() => assertWorkNodeDraft({ ...ok, domain: 'growth' })).toThrow(/unknown company domain/i)
  })
})

describe('work-node state machine (audited transitions)', () => {
  it('allows the working path open -> in_progress -> done', () => {
    expect(isLegalTransition('open', 'in_progress')).toBe(true)
    expect(isLegalTransition('in_progress', 'done')).toBe(true)
  })

  it('allows blocking and unblocking', () => {
    expect(isLegalTransition('in_progress', 'blocked')).toBe(true)
    expect(isLegalTransition('blocked', 'in_progress')).toBe(true)
    expect(isLegalTransition('blocked', 'open')).toBe(true)
  })

  it('done and killed are terminal', () => {
    expect(() => assertTransition('done', 'open')).toThrow(/terminal/i)
    expect(() => assertTransition('killed', 'in_progress')).toThrow(/terminal/i)
  })

  it('open cannot jump straight to done — work is claimed before it is finished', () => {
    expect(isLegalTransition('open', 'done')).toBe(false)
  })
})

describe('stale in_progress detection (stranded work surfaces on the packet)', () => {
  it('flags an in_progress node untouched past the stale window', () => {
    const node = { state: 'in_progress' as const, updatedAt: '2026-08-01T00:00:00Z' }
    expect(isStaleInProgress(node, new Date('2026-08-15T00:00:00Z'))).toBe(true)
  })

  it('does not flag fresh in_progress work', () => {
    const node = { state: 'in_progress' as const, updatedAt: '2026-08-14T00:00:00Z' }
    expect(isStaleInProgress(node, new Date('2026-08-15T00:00:00Z'))).toBe(false)
  })

  it('never flags open or done nodes', () => {
    expect(
      isStaleInProgress({ state: 'open' as const, updatedAt: '2026-08-01T00:00:00Z' }, new Date('2026-08-15T00:00:00Z')),
    ).toBe(false)
  })
})
