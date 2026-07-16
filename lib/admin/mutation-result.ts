/**
 * The shared server-action result contract for the admin rebuild (§4.2 of
 * docs/plans/ADMIN_REBUILD/00-REASONING-AND-ARCHITECTURE.md).
 *
 * Every mutating admin action returns a MutationResult<T> instead of `void` +
 * redirect/router.refresh. The client patches its local state from `data` — no
 * full-page refetch (kills the RC2 render-per-tap tax). `code` lets the client
 * distinguish an auth failure, a validation failure, or an in-flight duplicate so
 * it can show the right affordance (sign-in, inline error, or "already sending").
 *
 * Isomorphic (no 'server-only') so both the action and the client hook import it.
 */
export type MutationErrorCode =
  | 'unauthenticated'
  | 'forbidden'
  | 'validation'
  | 'in_flight'
  | 'blocked' // compliance gate (suppression / quiet hours)
  | 'error'

export type MutationResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; code: MutationErrorCode }

/** A fresh idempotency key for one logical submission (reused across retries). */
export function newIdempotencyKey(): string {
  // crypto.randomUUID is available in the browser and in the Node/Edge runtimes
  // Next server actions run on.
  return crypto.randomUUID()
}
