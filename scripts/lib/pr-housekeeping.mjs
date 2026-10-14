/**
 * pr-housekeeping.mjs — auto-merge, stale-PR, and head-branch cleanup decisions
 * (Matt 2026-10-14).
 *
 * Pure functions. Workflows call scripts/pr-auto-merge.mjs,
 * scripts/pr-stale.mjs, and scripts/pr-head-branch-cleanup.mjs, which import
 * these. Tests import them directly.
 */

export const HOLD_LABEL = 'hold-for-matt'
export const STALE_LABEL = 'stale'
export const KEEP_BRANCH_LABEL = 'keep-branch'

export const STALE_AFTER_MS = 3 * 24 * 60 * 60 * 1000
export const CLOSE_AFTER_STALE_MS = 2 * 24 * 60 * 60 * 1000
export const CLOSED_BRANCH_GRACE_MS = 7 * 24 * 60 * 60 * 1000
export const PROTECTED_HEAD_BRANCHES = Object.freeze(['main', 'master'])
/** Closed-unmerged heads the earlier cleanup kept with a written reason. */
export const KEEP_HEAD_BRANCHES = Object.freeze([
  'claude/market-report-subscription',
  'fix/fsbo-zillow-mapped-output',
])

/** Checks that may block a merge. Lighthouse and content-floor stay out. */
export const REQUIRED_CHECK_NAMES = Object.freeze([
  'lint',
  'gates',
  'unit (1)',
  'unit (2)',
  'unit (3)',
  'merge-gate',
  'security-scan',
])

export const HOLD_LABEL_COLOR = '8B1E1E'
export const HOLD_LABEL_DESCRIPTION = 'Do not auto-merge. Wait for Matt.'
export const STALE_LABEL_COLOR = 'BDBDBD'
export const STALE_LABEL_DESCRIPTION =
  'Open PR older than 3 days. Rebase and merge, or it will close and keep the branch for 7 days.'
export const KEEP_BRANCH_LABEL_COLOR = '0E4429'
export const KEEP_BRANCH_LABEL_DESCRIPTION =
  'Keep this closed or merged PR head branch. The daily cleanup will not delete it.'

/** @param {unknown} labels */
export function normalizeLabels(labels) {
  if (!Array.isArray(labels)) return []
  return labels
    .map((item) => (typeof item === 'string' ? item : item && typeof item === 'object' ? item.name : null))
    .filter((name) => typeof name === 'string' && name.length > 0)
}

/** @param {unknown} labels @param {string} name */
export function hasLabel(labels, name) {
  const needle = String(name).toLowerCase()
  return normalizeLabels(labels).some((label) => label.toLowerCase() === needle)
}

/** @param {unknown} title */
export function titleLooksLikeHold(title) {
  const text = String(title ?? '')
  return (
    /\bHOLD\b/.test(text) ||
    /do not merge without Matt/i.test(text) ||
    /do not merge until Matt/i.test(text) ||
    /hold for Matt/i.test(text)
  )
}

/**
 * @param {{ draft?: boolean, labels?: unknown, title?: unknown }} pr
 */
export function shouldQueueAutoMerge(pr) {
  if (pr?.draft) return false
  if (hasLabel(pr?.labels, HOLD_LABEL)) return false
  if (titleLooksLikeHold(pr?.title) && !hasLabel(pr?.labels, HOLD_LABEL)) {
    // Title already holds for Matt even when the label is missing.
    return false
  }
  return true
}

/**
 * @param {{
 *   createdAt: string | number | Date,
 *   labels?: unknown,
 *   now?: number,
 *   staleLabeledAt?: string | number | Date | null,
 * }} input
 * @returns {'skip-hold' | 'none' | 'mark-stale' | 'wait-stale' | 'close'}
 */
export function staleDecision(input) {
  if (hasLabel(input?.labels, HOLD_LABEL)) return 'skip-hold'
  if (titleLooksLikeHold(input?.title)) return 'skip-hold'
  const now = input?.now ?? Date.now()
  const created = new Date(input.createdAt).getTime()
  if (!Number.isFinite(created)) return 'none'
  if (now - created < STALE_AFTER_MS) return 'none'
  if (!hasLabel(input?.labels, STALE_LABEL)) return 'mark-stale'
  if (input?.staleLabeledAt == null) return 'wait-stale'
  const labeled = new Date(input.staleLabeledAt).getTime()
  if (!Number.isFinite(labeled)) return 'wait-stale'
  if (now - labeled >= CLOSE_AFTER_STALE_MS) return 'close'
  return 'wait-stale'
}

/**
 * @param {Array<{ name?: string, state?: string, bucket?: string }>} checks
 * @returns {'ready' | 'pending' | 'failed'}
 */
/**
 * @param {{ requiredStatus: 'ready' | 'pending' | 'failed', allowAutoMerge: boolean }} input
 * @returns {'squash-now' | 'queue-auto' | 'wait' | 'failed'}
 */
export function mergeAction(input) {
  if (input.requiredStatus === 'failed') return 'failed'
  if (input.requiredStatus === 'ready') return 'squash-now'
  if (input.allowAutoMerge) return 'queue-auto'
  return 'wait'
}

export function requiredChecksStatus(checks) {
  const byName = new Map()
  for (const check of checks ?? []) {
    if (check?.name) byName.set(check.name, check)
  }
  let pending = false
  for (const name of REQUIRED_CHECK_NAMES) {
    const check = byName.get(name)
    if (!check) {
      pending = true
      continue
    }
    const state = String(check.state || check.bucket || '').toLowerCase()
    if (state === 'success' || state === 'pass' || state === 'neutral' || state === 'skipped') {
      if (name === 'merge-gate' && (state === 'skipped' || state === 'neutral')) {
        pending = true
      }
      continue
    }
    if (
      state === 'pending' ||
      state === 'queued' ||
      state === 'in_progress' ||
      state === 'expected'
    ) {
      pending = true
      continue
    }
    return 'failed'
  }
  return pending ? 'pending' : 'ready'
}

/**
 * Whether a daily cleanup may delete a remote head branch.
 *
 * Never main. Never a branch that still has an open PR. Merged PR heads delete
 * the same day. Closed-unmerged heads wait 7 days, then delete unless labeled
 * keep-branch or hold-for-matt. A branch with no PR is out of scope.
 *
 * @param {{
 *   branchName: string,
 *   hasOpenPr: boolean,
 *   latestClosedPr?: {
 *     merged?: boolean,
 *     closedAt?: string | number | Date | null,
 *     labels?: unknown,
 *   } | null,
 *   now?: number,
 * }} input
 * @returns {'delete-merged' | 'delete-closed' | 'keep-protected' | 'keep-open-pr' | 'keep-named' | 'keep-label' | 'keep-recent-closed' | 'keep-no-pr'}
 */
export function headBranchCleanupDecision(input) {
  const name = String(input?.branchName ?? '').trim()
  if (!name || PROTECTED_HEAD_BRANCHES.includes(name)) return 'keep-protected'
  if (KEEP_HEAD_BRANCHES.includes(name)) return 'keep-named'
  if (input?.hasOpenPr) return 'keep-open-pr'
  const pr = input?.latestClosedPr
  if (!pr) return 'keep-no-pr'
  if (hasLabel(pr.labels, KEEP_BRANCH_LABEL) || hasLabel(pr.labels, HOLD_LABEL)) {
    return 'keep-label'
  }
  if (pr.merged) return 'delete-merged'
  const now = input?.now ?? Date.now()
  const closed = new Date(pr.closedAt ?? '').getTime()
  if (!Number.isFinite(closed)) return 'keep-recent-closed'
  if (now - closed < CLOSED_BRANCH_GRACE_MS) return 'keep-recent-closed'
  return 'delete-closed'
}
