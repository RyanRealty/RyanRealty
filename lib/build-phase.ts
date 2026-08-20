/**
 * `next build` static-generation phase.
 *
 * Geo pages fan out DAL reads (blog strip, activity, open houses, amenity
 * posts) that ISR will refill. Those rails must not run during SSG — and a
 * skipped / timed-out read must never publish as "0 homes". Hero inventory,
 * MOS, and median stay on the hot path.
 */
import { withTimeoutFallback } from '@/lib/with-timeout-fallback'

export function isProductionBuildPhase(): boolean {
  return process.env.NEXT_PHASE === 'phase-production-build'
}

/**
 * Below-the-fold rails ISR will fill. Pass `true` to fetch; during
 * `next build` this is always false so SSG does not wait on them.
 */
export function buildTimeRails(enabled: boolean): boolean {
  return enabled && !isProductionBuildPhase()
}

/**
 * Start `start()` only when `buildTimeRails(true)`. The thunk is the point:
 * calling the DAL at the call site would still hit the network.
 */
export function skippableRail<T>(
  start: () => Promise<T>,
  fallback: T,
  timeoutMs: number,
  logLabel?: string,
): Promise<T> {
  if (!buildTimeRails(true)) return Promise.resolve(fallback)
  return withTimeoutFallback(start(), fallback, timeoutMs, logLabel)
}
