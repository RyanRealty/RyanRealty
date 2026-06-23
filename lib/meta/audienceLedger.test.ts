import { describe, it, expect } from 'vitest'
import { summarizeAudienceRun, META_MIN_AUDIENCE_SIZE } from './audienceLedger'
import type { SyncCrmAudienceResult } from './audienceUpload'
import type { RemoveFromCrmAudienceResult } from './audienceRemove'

const dryAdd: SyncCrmAudienceResult = {
  dryRun: true,
  dryRunReason: 'flag-disabled',
  wouldUpload: 12,
  excludedSuppressed: 4,
  excludedRealtors: 0,
  skippedUnhashable: 1,
  sampleHash: [],
  audienceName: 'Ryan Realty CRM Leads',
}

const dryRemove: RemoveFromCrmAudienceResult = {
  dryRun: true,
  dryRunReason: 'flag-disabled',
  requested: 3,
  wouldRemove: 2,
  skippedUnhashable: 1,
  sampleHash: [],
  audienceName: 'Ryan Realty CRM Leads',
}

describe('summarizeAudienceRun (pure)', () => {
  it('marks the run dry only when BOTH legs are dry', () => {
    const s = summarizeAudienceRun(dryAdd, dryRemove)
    expect(s.dryRun).toBe(true)
    expect(s.add.wouldUpload).toBe(12)
    expect(s.add.excludedSuppressed).toBe(4)
    expect(s.remove.requested).toBe(3)
    expect(s.remove.wouldRemove).toBe(2)
    expect(s.errors).toEqual([])
    expect(s.message).toContain('DRY')
    expect(s.message).toContain('would-upload 12')
    expect(s.message).toContain('would-remove 2 of 3')
  })

  it('reports LIVE when both legs pushed, and flattens errors from both', () => {
    const liveAdd: SyncCrmAudienceResult = {
      dryRun: false,
      wouldUpload: 10,
      excludedSuppressed: 0,
      excludedRealtors: 0,
      skippedUnhashable: 0,
      sampleHash: [],
      audienceId: 'aud-1',
      numReceived: 10,
      numInvalid: 0,
      errors: ['batch@0: 500 oops'],
    }
    const liveRemove: RemoveFromCrmAudienceResult = {
      dryRun: false,
      requested: 2,
      wouldRemove: 2,
      skippedUnhashable: 0,
      sampleHash: [],
      audienceId: 'aud-1',
      numRemoved: 2,
      errors: ['audience-not-found'],
    }
    const s = summarizeAudienceRun(liveAdd, liveRemove)
    expect(s.dryRun).toBe(false)
    expect(s.errors).toEqual(['batch@0: 500 oops', 'audience-not-found'])
    expect(s.add.numReceived).toBe(10)
    expect(s.remove.numRemoved).toBe(2)
    expect(s.message).toContain('LIVE')
    expect(s.message).toContain('received 10')
    expect(s.message).toContain('removed 2 of 2')
    expect(s.message).toContain('2 error(s)')
  })

  it('is LIVE when only one leg pushed (not both dry)', () => {
    const liveRemove: RemoveFromCrmAudienceResult = {
      dryRun: false,
      requested: 1,
      wouldRemove: 1,
      skippedUnhashable: 0,
      sampleHash: [],
      audienceId: 'aud-1',
      numRemoved: 1,
    }
    const s = summarizeAudienceRun(dryAdd, liveRemove)
    expect(s.dryRun).toBe(false)
  })

  describe('<1k-match monitor (Phase 5.2)', () => {
    it('flags a dry run under the match floor (uses would-upload as the proxy)', () => {
      // dryAdd.wouldUpload = 12, well under META_MIN_AUDIENCE_SIZE
      const s = summarizeAudienceRun(dryAdd, dryRemove)
      expect(s.matchCount).toBe(12)
      expect(s.belowMinimumMatch).toBe(true)
      expect(s.message).toContain(`< ${META_MIN_AUDIENCE_SIZE} match floor`)
      expect(s.message).toContain('not targetable')
    })

    it('does NOT flag a dry run at or above the floor', () => {
      const bigAdd: SyncCrmAudienceResult = { ...dryAdd, wouldUpload: META_MIN_AUDIENCE_SIZE }
      const s = summarizeAudienceRun(bigAdd, dryRemove)
      expect(s.matchCount).toBe(META_MIN_AUDIENCE_SIZE)
      expect(s.belowMinimumMatch).toBe(false)
      expect(s.message).not.toContain('match floor')
    })

    it('on a live push, gauges the floor by Meta accepted count, not would-upload', () => {
      // would-upload looks healthy, but Meta only accepted 4 -> below floor.
      const liveAdd: SyncCrmAudienceResult = {
        dryRun: false,
        wouldUpload: 5000,
        excludedSuppressed: 0,
        excludedRealtors: 0,
        skippedUnhashable: 0,
        sampleHash: [],
        audienceId: 'aud-1',
        numReceived: 4,
        numInvalid: 0,
      }
      const liveRemove: RemoveFromCrmAudienceResult = {
        dryRun: false,
        requested: 0,
        wouldRemove: 0,
        skippedUnhashable: 0,
        sampleHash: [],
        audienceId: 'aud-1',
        numRemoved: 0,
      }
      const s = summarizeAudienceRun(liveAdd, liveRemove)
      expect(s.matchCount).toBe(4)
      expect(s.belowMinimumMatch).toBe(true)
    })
  })
})
