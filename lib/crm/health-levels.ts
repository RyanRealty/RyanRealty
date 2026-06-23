/**
 * CRM health-board level helpers (CONTACT360 Phase 9.5).
 *
 * The /admin/crm/health board renders one status tile per vital sign, each with
 * a green / amber / red dot. The COLOR decision for every tile flows through the
 * PURE helpers in this module: no I/O, no env, no Date.now() — the caller passes
 * the already-measured value, the helper returns the level. That keeps the
 * thresholds unit-testable and identical across every tile (one mapping, never a
 * per-tile copy that drifts).
 *
 * `HealthLevel` maps to the console StatusPill tones at the call site:
 *   ok -> success (green) · warn -> warning (amber) · stale/alarm -> danger (red)
 */

export type HealthLevel = 'ok' | 'warn' | 'stale'

/**
 * Freshness of an inbound signal, by AGE in minutes against two thresholds.
 *
 * The thresholds are the boundaries between bands, in minutes:
 *   age <= warnAfter            -> 'ok'    (recent — the channel is alive)
 *   warnAfter < age <= staleAfter -> 'warn'  (quiet — worth a glance)
 *   age > staleAfter            -> 'stale' (cold — the inbound path may be broken)
 *
 * A null age (the signal kind has NEVER been seen) is treated as 'stale' — a
 * webhook that has produced zero events is exactly the silent-failure case the
 * board exists to surface.
 *
 * Pure: no Date, no I/O. The caller computes ageMinutes from a timestamp it owns
 * (so tests pin the clock) and passes it in.
 */
export function freshnessLevel(
  ageMinutes: number | null,
  thresholds: { warnAfter: number; staleAfter: number },
): HealthLevel {
  if (ageMinutes === null || !Number.isFinite(ageMinutes)) return 'stale'
  // A negative age (a clock-skewed future timestamp) is still "recent".
  if (ageMinutes <= thresholds.warnAfter) return 'ok'
  if (ageMinutes <= thresholds.staleAfter) return 'warn'
  return 'stale'
}

/**
 * Suppression-rate band: what share of contacts are suppressed on a channel.
 *
 * A large opt-out footprint is not itself a fault, but a SPIKE is a deliverability
 * signal (bounces / complaints / STOPs climbing). The board flags the share so a
 * broker notices before the mailable audience collapses. `rate` is a fraction
 * 0..1 (suppressed / total).
 *
 *   rate <= warnAbove            -> 'ok'
 *   warnAbove < rate <= staleAbove -> 'warn'
 *   rate > staleAbove            -> 'stale' (treated as the red band)
 *
 * Defaults: 25% warn, 40% red — a quarter of the book opted out is worth a look,
 * forty percent is a problem. A zero-total list reads 'ok' (nothing to suppress).
 */
export function suppressionRateLevel(
  rate: number,
  thresholds: { warnAbove: number; staleAbove: number } = { warnAbove: 0.25, staleAbove: 0.4 },
): HealthLevel {
  if (!Number.isFinite(rate) || rate <= thresholds.warnAbove) return 'ok'
  if (rate <= thresholds.staleAbove) return 'warn'
  return 'stale'
}

/**
 * A2P 10DLC campaign status -> health level. Outbound SMS is blocked by carriers
 * until the campaign is VERIFIED, so anything short of VERIFIED is at least a
 * warning, and an explicit FAILED / NONE is the red band.
 *
 *   VERIFIED                 -> 'ok'
 *   IN_PROGRESS / PENDING    -> 'warn' (will clear, but SMS is held meanwhile)
 *   FAILED / NONE / null     -> 'stale' (SMS cannot send)
 */
export function a2pLevel(status: string | null | undefined): HealthLevel {
  if (status === 'VERIFIED') return 'ok'
  if (status === 'IN_PROGRESS' || status === 'PENDING') return 'warn'
  return 'stale'
}

/** Map a HealthLevel to the console StatusPill tone (single source for the dot color). */
export function levelTone(level: HealthLevel): 'success' | 'warning' | 'danger' {
  if (level === 'ok') return 'success'
  if (level === 'warn') return 'warning'
  return 'danger'
}

/**
 * The worst level across a set of tiles, for a roll-up "overall" signal.
 * Order of severity: ok < warn < stale.
 */
export function worstLevel(levels: ReadonlyArray<HealthLevel>): HealthLevel {
  if (levels.includes('stale')) return 'stale'
  if (levels.includes('warn')) return 'warn'
  return 'ok'
}

/**
 * Whole-minutes age between a past ISO timestamp and a reference `now` (ms).
 * Returns null for a missing/invalid timestamp (the "never seen" case). Pure:
 * the caller supplies `nowMs` so the value is deterministic in tests.
 */
export function ageMinutesSince(iso: string | null | undefined, nowMs: number): number | null {
  if (!iso) return null
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return null
  return Math.floor((nowMs - t) / 60000)
}
