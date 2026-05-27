/**
 * Client-only Supabase Realtime subscription on `public.activity_events`.
 *
 * Pairs with `getRecentActivity` for the homepage feed: server renders the
 * initial 12 rows, this hook opens a Realtime channel and prepends new
 * events as they land. Returns an unsubscribe handle for cleanup on
 * unmount.
 *
 * IMPORTANT: this is the only function in the DAL that takes a callback.
 * It runs in the browser, not on the server. Do not import from RSC
 * trees.
 *
 * @stub Wave 1.8 — schema + Realtime channel exist; full implementation
 * lands when the canonical activity feed migrates off
 * app/actions/activity-feed.ts.
 */

import type { ActivityEvent } from '../types/activity'

export type ActivitySubscription = {
  unsubscribe: () => void
}

export function subscribeActivity(
  _callback: (event: ActivityEvent) => void,
): ActivitySubscription {
  throw new Error(
    '[subscribeActivity] NotImplementedError. Wave 1.8 — see docs/EXECUTION_PLAN.md §9.',
  )
}
