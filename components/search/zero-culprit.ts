/**
 * zero-culprit — leave-one-out planning for the sheet's zero-result state
 * (plan §7.1 rule 3: zero results name the culprit).
 *
 * When the live count hits 0, the sheet re-counts once per active filter
 * with that filter removed, then names the filter whose removal recovers the
 * most listings, with a one-tap remove showing the recovered count. A
 * suggestion that itself yields 0 is never made.
 *
 * Pure module: candidate enumeration and winner selection. The sheet owns
 * the debounce and the count calls (countSearchListings — the same endpoint
 * behind the live count).
 */

import { SEARCH_FIELDS, urlParamsForField } from '@/lib/search/field-registry'
import { propertyTypeDisplayLabel } from '@/lib/search/class-prevalence'

export interface CulpritCandidate {
  key: string
  label: string
  /** Draft params removed by the leave-one-out probe (and by the one-tap fix). */
  params: readonly string[]
}

export const CULPRIT_MAX_CANDIDATES = 8

/**
 * Enumerate the sheet-owned filters active in the draft, capped. propertyType
 * leads the list — class narrowing is the most common zeroer — followed by
 * registry fields in registry order.
 */
export function culpritCandidates(
  draft: Readonly<Record<string, string>>,
  cap: number = CULPRIT_MAX_CANDIDATES,
): CulpritCandidate[] {
  const out: CulpritCandidate[] = []
  const propertyType = draft.propertyType?.trim()
  if (propertyType) {
    out.push({
      key: 'propertyType',
      label: propertyTypeDisplayLabel(propertyType) ?? 'Property type',
      params: ['propertyType'],
    })
  }
  for (const def of SEARCH_FIELDS) {
    if (out.length >= cap) break
    const params = urlParamsForField(def)
    const active = params.filter((p) => (draft[p] ?? '').trim() !== '')
    if (active.length === 0) continue
    out.push({ key: def.key, label: def.label, params: active })
  }
  return out.slice(0, cap)
}

/** Draft with one candidate's params removed — the leave-one-out probe input. */
export function draftWithoutCandidate(
  draft: Readonly<Record<string, string>>,
  candidate: CulpritCandidate,
): Record<string, string> {
  const next = { ...draft }
  for (const param of candidate.params) delete next[param]
  return next
}

export interface CulpritProbeResult {
  candidate: CulpritCandidate
  /** Count with the candidate removed; null = probe unavailable (rate limit etc.). */
  count: number | null
}

/**
 * The winning culprit: the candidate whose removal recovers the most
 * listings. Returns null when no removal recovers anything — suggesting an
 * action that still yields 0 is forbidden.
 */
export function pickCulprit(
  results: readonly CulpritProbeResult[],
): { candidate: CulpritCandidate; recovered: number } | null {
  let best: { candidate: CulpritCandidate; recovered: number } | null = null
  for (const { candidate, count } of results) {
    if (count === null || count <= 0) continue
    if (!best || count > best.recovered) best = { candidate, recovered: count }
  }
  return best
}
