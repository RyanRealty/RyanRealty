/**
 * `next build` static-generation phase.
 *
 * Geo pages fan out DAL reads (blog strip, activity, open houses, amenity
 * posts, chart rooms, boundary maps, subdivision ledgers) that ISR will
 * refill. Those rails must not run during SSG — and a skipped / timed-out
 * read must never publish as "0 homes". Hero inventory, MOS, and median stay
 * on the hot path.
 */
import {
  withTimeoutFallback,
  withTimeoutFallbackResult,
  type TimeoutFallbackResult,
} from '@/lib/with-timeout-fallback'

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

/**
 * skippableRail for reads that feed a published figure: a build-phase skip is
 * a degraded read (`ok: false`), never a measured empty (§0).
 */
export function skippableRailResult<T>(
  start: () => Promise<T>,
  fallback: T,
  timeoutMs: number,
  logLabel?: string,
): Promise<TimeoutFallbackResult<T>> {
  if (!buildTimeRails(true)) return Promise.resolve({ value: fallback, ok: false })
  return withTimeoutFallbackResult(start(), fallback, timeoutMs, logLabel)
}

/**
 * Timeout for hot-path rails (core figures that DO fetch during SSG). At
 * build, a timeout persists the fallback into the deployed HTML until the
 * first revalidate — so tolerate 3× the runtime latency there, where only
 * build minutes are at stake, not a user's request.
 */
export function hotRailTimeoutMs(runtimeMs: number): number {
  return isProductionBuildPhase() ? runtimeMs * 3 : runtimeMs
}
