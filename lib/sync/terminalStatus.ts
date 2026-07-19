/**
 * isTerminalStatus — the single source of truth for whether a listing status is
 * terminal (Closed / Expired / Withdrawn / Canceled).
 *
 * Audit #1b: this exact classifier was copy-pasted into three sync entry points
 * (the delta-sync action lane, the delta-sync cron lane, and the history-verify
 * cron). It drives FINALIZATION — a listing is frozen only once it reaches a
 * terminal status — so the three copies drifting apart would mean the lanes
 * disagree on what counts as terminal. Sharing one function makes that drift
 * impossible. (The larger delta-sync core unification stays deferred behind a
 * shadow run per the audit; this is the correctness-critical piece that is safe
 * to share now because all three copies were already byte-identical.)
 */
export function isTerminalStatus(status: string | null | undefined): boolean {
  const t = String(status ?? '').toLowerCase()
  return /closed/.test(t) || /expired/.test(t) || /withdrawn/.test(t) || /cancel/.test(t)
}
