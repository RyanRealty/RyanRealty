/**
 * pr-housekeeping.mjs — auto-merge and stale-PR decisions (Matt 2026-10-14).
 *
 * Pure functions. Workflows call scripts/pr-auto-merge.mjs and
 * scripts/pr-stale.mjs, which import these. Tests import them directly.
 */

export const HOLD_LABEL = 'hold-for-matt'
export const APPROVED_LABEL = 'approved-by-matt'
export const STALE_LABEL = 'stale'

export const STALE_AFTER_MS = 3 * 24 * 60 * 60 * 1000
export const CLOSE_AFTER_STALE_MS = 2 * 24 * 60 * 60 * 1000

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
export const APPROVED_LABEL_COLOR = '1B7A4F'
export const APPROVED_LABEL_DESCRIPTION =
  'Matt approved. Remove hold-for-matt and auto-merge when checks pass.'
export const APPROVED_PRS_PATH = '.github/approved-prs'
export const STALE_LABEL_COLOR = 'BDBDBD'
export const STALE_LABEL_DESCRIPTION =
  'Open PR older than 3 days. Rebase and merge, or it will close and keep the branch.'

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
 * Optional `.github/approved-prs` list: one positive integer per line.
 * `#` starts a comment. Preferred source of truth is the approved-by-matt label.
 * @param {unknown} text
 * @returns {number[]}
 */
export function parseApprovedPrList(text) {
  if (typeof text !== 'string') return []
  const out = []
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.replace(/#.*$/, '').trim()
    if (!trimmed) continue
    const n = Number(trimmed)
    if (Number.isInteger(n) && n > 0) out.push(n)
  }
  return out
}

/**
 * @param {{
 *   labels?: unknown,
 *   number?: unknown,
 *   approvedNumbers?: unknown,
 * }} pr
 */
export function isApprovedByMatt(pr) {
  if (hasLabel(pr?.labels, APPROVED_LABEL)) return true
  const number = Number(pr?.number)
  if (!Number.isInteger(number) || number <= 0) return false
  if (!Array.isArray(pr?.approvedNumbers)) return false
  return pr.approvedNumbers.some((item) => Number(item) === number)
}

/**
 * @param {{
 *   title?: unknown,
 *   labels?: unknown,
 *   number?: unknown,
 *   approvedNumbers?: unknown,
 * }} pr
 */
export function shouldApplyTitleHold(pr) {
  if (isApprovedByMatt(pr)) return false
  return titleLooksLikeHold(pr?.title)
}

/**
 * @param {{
 *   labels?: unknown,
 *   number?: unknown,
 *   approvedNumbers?: unknown,
 * }} pr
 */
export function shouldRemoveHoldLabel(pr) {
  return isApprovedByMatt(pr) && hasLabel(pr?.labels, HOLD_LABEL)
}

/**
 * @param {{
 *   draft?: boolean,
 *   labels?: unknown,
 *   title?: unknown,
 *   number?: unknown,
 *   approvedNumbers?: unknown,
 * }} pr
 */
export function shouldQueueAutoMerge(pr) {
  if (pr?.draft) return false
  if (isApprovedByMatt(pr)) return true
  if (hasLabel(pr?.labels, HOLD_LABEL)) return false
  if (titleLooksLikeHold(pr?.title)) return false
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
  if (!isApprovedByMatt(input) && hasLabel(input?.labels, HOLD_LABEL)) return 'skip-hold'
  if (!isApprovedByMatt(input) && titleLooksLikeHold(input?.title)) return 'skip-hold'
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
