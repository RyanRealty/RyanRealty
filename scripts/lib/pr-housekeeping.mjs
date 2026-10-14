/**
 * pr-housekeeping.mjs — auto-merge and stale-PR decisions (Matt 2026-10-14).
 *
 * Pure functions. Workflows call scripts/pr-auto-merge.mjs and
 * scripts/pr-stale.mjs, which import these. Tests import them directly.
 */

export const HOLD_LABEL = 'hold-for-matt'
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
