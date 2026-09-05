import { describe, it, expect } from 'vitest'
import {
  assertTransition,
  assertWorkNodeDraft,
  fleetNodePriority,
  isCloudAgentSession,
  isLegalTransition,
  isStaleInProgress,
  shouldAutoRelease,
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

describe('queue priority (fleet + Matt steering outrank planned gaps)', () => {
  it('serves Matt ADD/CHANGE with fleet majors, ahead of planned G-rows', () => {
    expect(fleetNodePriority('Fleet finding [p0]: money path')).toBe(0)
    expect(fleetNodePriority('Fleet finding [p0]: review punch list')).toBe(0)
    expect(fleetNodePriority('Fleet finding [major]: review punch list')).toBe(1)
    expect(fleetNodePriority('Matt ADD [major]: xAI-only image, video, voice, and content gen')).toBe(1)
    expect(fleetNodePriority('Matt CHANGE [major]: rebuild on xAI')).toBe(1)
    expect(fleetNodePriority('CMA/pricing production residual')).toBe(2)
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

describe('orphan auto-release (dead cloud sessions never hold the floor)', () => {
  const now = new Date('2026-08-16T12:00:00Z')
  const orphan = {
    state: 'in_progress' as const,
    ownerSession: 'bc-13c50db8-d7f2-4c5a-9b18-61ba7166475b',
    updatedAt: '2026-08-16T11:00:00Z', // 60 min old — past the grace window
  }

  it('recognizes cloud-agent owner sessions and nothing else', () => {
    expect(isCloudAgentSession('bc-13c50db8-d7f2-4c5a-9b18-61ba7166475b')).toBe(true)
    expect(isCloudAgentSession('cursor-cloud-bc-f9ff79aa-2026-08-19t14-11')).toBe(true)
    expect(isCloudAgentSession('cursor-cma-douglas-2026-08-17')).toBe(false)
    expect(isCloudAgentSession('grok-2026-08-15')).toBe(false)
    expect(isCloudAgentSession('DISARM-HOLD (Matt: planning mode)')).toBe(false)
    expect(isCloudAgentSession(null)).toBe(false)
  })

  it('releases when the owner run is terminal and grace has passed', () => {
    expect(shouldAutoRelease(orphan, true, now)).toBe(true)
  })

  it('never releases while the owner run is still active', () => {
    expect(shouldAutoRelease(orphan, false, now)).toBe(false)
  })

  it('never releases inside the grace window — a completion may be mid-write', () => {
    const justUpdated = { ...orphan, updatedAt: '2026-08-16T11:55:00Z' } // 5 min old
    expect(shouldAutoRelease(justUpdated, true, now)).toBe(false)
  })

  it('never releases human-session claims — they age out via staleness instead', () => {
    const human = { ...orphan, ownerSession: 'grok-session-2026-08-16' }
    expect(shouldAutoRelease(human, true, now)).toBe(false)
  })

  it('only in_progress nodes are candidates', () => {
    expect(shouldAutoRelease({ ...orphan, state: 'open' as const }, true, now)).toBe(false)
  })
})
