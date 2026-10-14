import { describe, expect, it } from 'vitest'
import {
  CLOSE_AFTER_STALE_MS,
  CLOSED_BRANCH_GRACE_MS,
  HOLD_LABEL,
  KEEP_BRANCH_LABEL,
  REQUIRED_CHECK_NAMES,
  STALE_AFTER_MS,
  STALE_LABEL,
  hasLabel,
  headBranchCleanupDecision,
  mergeAction,
  requiredChecksStatus,
  shouldQueueAutoMerge,
  staleDecision,
  titleLooksLikeHold,
} from '../lib/pr-housekeeping.mjs'

const NOW = Date.parse('2026-10-14T00:00:00.000Z')

describe('titleLooksLikeHold', () => {
  it('matches HOLD and Matt-OK titles', () => {
    expect(titleLooksLikeHold('feat(sell): rebuild (HOLD for Matt\'s phone check)')).toBe(true)
    expect(titleLooksLikeHold('Bend neighborhoods (do not merge without Matt\'s OK)')).toBe(true)
    expect(titleLooksLikeHold('FAQ (do not merge until Matt OKs)')).toBe(true)
    expect(titleLooksLikeHold('fix: hold opt-out suppressions')).toBe(false)
  })
})

describe('shouldQueueAutoMerge', () => {
  it('queues a ready PR', () => {
    expect(shouldQueueAutoMerge({ draft: false, labels: [], title: 'fix: something' })).toBe(true)
  })

  it('skips drafts, labeled holds, and hold titles', () => {
    expect(shouldQueueAutoMerge({ draft: true, labels: [], title: 'fix: something' })).toBe(false)
    expect(shouldQueueAutoMerge({ draft: false, labels: [HOLD_LABEL], title: 'fix: something' })).toBe(
      false,
    )
    expect(shouldQueueAutoMerge({ draft: false, labels: [], title: 'WIP HOLD for Matt' })).toBe(false)
  })
})

describe('staleDecision', () => {
  it('skips holds and young PRs', () => {
    expect(
      staleDecision({
        createdAt: NOW - STALE_AFTER_MS - 1,
        labels: [HOLD_LABEL],
        now: NOW,
      }),
    ).toBe('skip-hold')
    expect(
      staleDecision({
        createdAt: NOW - STALE_AFTER_MS + 1000,
        labels: [],
        title: 'fix: something',
        now: NOW,
      }),
    ).toBe('none')
  })

  it('marks stale at 3 days, then closes after 2 more', () => {
    expect(
      staleDecision({
        createdAt: NOW - STALE_AFTER_MS,
        labels: [],
        title: 'fix: something',
        now: NOW,
      }),
    ).toBe('mark-stale')
    expect(
      staleDecision({
        createdAt: NOW - STALE_AFTER_MS,
        labels: [STALE_LABEL],
        title: 'fix: something',
        now: NOW,
        staleLabeledAt: NOW - CLOSE_AFTER_STALE_MS + 1000,
      }),
    ).toBe('wait-stale')
    expect(
      staleDecision({
        createdAt: NOW - STALE_AFTER_MS,
        labels: [STALE_LABEL],
        title: 'fix: something',
        now: NOW,
        staleLabeledAt: NOW - CLOSE_AFTER_STALE_MS,
      }),
    ).toBe('close')
  })
})

describe('requiredChecksStatus', () => {
  it('requires the non-flaky set and ignores lighthouse', () => {
    expect(REQUIRED_CHECK_NAMES).not.toContain('lighthouse (1)')
    expect(REQUIRED_CHECK_NAMES).not.toContain('content-floor (1)')
    const ready = REQUIRED_CHECK_NAMES.map((name) => ({ name, state: 'SUCCESS' }))
    expect(requiredChecksStatus(ready)).toBe('ready')
    expect(requiredChecksStatus([...ready, { name: 'lighthouse (1)', state: 'FAILURE' }])).toBe(
      'ready',
    )
    expect(requiredChecksStatus(ready.filter((c) => c.name !== 'merge-gate'))).toBe('pending')
    expect(
      requiredChecksStatus(ready.map((c) => (c.name === 'lint' ? { ...c, state: 'FAILURE' } : c))),
    ).toBe('failed')
  })

  it('does not squash while required checks are pending unless auto-merge can queue', () => {
    expect(mergeAction({ requiredStatus: 'pending', allowAutoMerge: false })).toBe('wait')
    expect(mergeAction({ requiredStatus: 'pending', allowAutoMerge: true })).toBe('queue-auto')
    expect(mergeAction({ requiredStatus: 'ready', allowAutoMerge: false })).toBe('squash-now')
    expect(mergeAction({ requiredStatus: 'failed', allowAutoMerge: true })).toBe('failed')
  })

  it('reads gh bucket names', () => {
    expect(hasLabel([{ name: HOLD_LABEL }], HOLD_LABEL)).toBe(true)
    const pending = REQUIRED_CHECK_NAMES.map((name) => ({ name, bucket: 'pending' }))
    expect(requiredChecksStatus(pending)).toBe('pending')
  })
})

describe('headBranchCleanupDecision', () => {
  const closedWeekAgo = NOW - CLOSED_BRANCH_GRACE_MS - 1
  const closedYesterday = NOW - 24 * 60 * 60 * 1000

  it('never deletes main or a branch with an open PR', () => {
    expect(headBranchCleanupDecision({ branchName: 'main', hasOpenPr: false, latestClosedPr: { merged: true } })).toBe(
      'keep-protected',
    )
    expect(
      headBranchCleanupDecision({
        branchName: 'cursor/open-work',
        hasOpenPr: true,
        latestClosedPr: { merged: true },
      }),
    ).toBe('keep-open-pr')
  })

  it('deletes a merged PR head the same day', () => {
    expect(
      headBranchCleanupDecision({
        branchName: 'fix/landed',
        hasOpenPr: false,
        latestClosedPr: { merged: true, closedAt: NOW, labels: [] },
        now: NOW,
      }),
    ).toBe('delete-merged')
  })

  it('waits 7 days after a closed-unmerged PR, then deletes', () => {
    expect(
      headBranchCleanupDecision({
        branchName: 'fix/closed',
        hasOpenPr: false,
        latestClosedPr: { merged: false, closedAt: closedYesterday, labels: [] },
        now: NOW,
      }),
    ).toBe('keep-recent-closed')
    expect(
      headBranchCleanupDecision({
        branchName: 'fix/closed',
        hasOpenPr: false,
        latestClosedPr: { merged: false, closedAt: closedWeekAgo, labels: [] },
        now: NOW,
      }),
    ).toBe('delete-closed')
  })

  it('keeps labeled and no-PR branches', () => {
    expect(
      headBranchCleanupDecision({
        branchName: 'claude/market-report-subscription',
        hasOpenPr: false,
        latestClosedPr: { merged: false, closedAt: closedWeekAgo, labels: [] },
        now: NOW,
      }),
    ).toBe('keep-named')
    expect(
      headBranchCleanupDecision({
        branchName: 'fix/fsbo-zillow-mapped-output',
        hasOpenPr: false,
        latestClosedPr: { merged: false, closedAt: closedWeekAgo, labels: [] },
        now: NOW,
      }),
    ).toBe('keep-named')
    expect(
      headBranchCleanupDecision({
        branchName: 'fix/kept-by-label',
        hasOpenPr: false,
        latestClosedPr: { merged: false, closedAt: closedWeekAgo, labels: [KEEP_BRANCH_LABEL] },
        now: NOW,
      }),
    ).toBe('keep-label')
    expect(
      headBranchCleanupDecision({
        branchName: 'fix/held',
        hasOpenPr: false,
        latestClosedPr: { merged: true, labels: [HOLD_LABEL] },
        now: NOW,
      }),
    ).toBe('keep-label')
    expect(headBranchCleanupDecision({ branchName: 'tip/sell-landing-rebuild', hasOpenPr: false })).toBe('keep-no-pr')
  })
})
