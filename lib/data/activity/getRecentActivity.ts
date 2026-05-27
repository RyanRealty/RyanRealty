/**
 * Recent activity for the homepage live feed.
 *
 * Source: `public.activity_events` (append-only event log of listing changes).
 *
 * Wired into `<ActivityFeed>` on the homepage. Server-rendered on first paint,
 * then `subscribeActivity` (client-only) opens a Supabase Realtime channel for
 * append updates without a refetch.
 *
 * Caching: 60s `unstable_cache` window. The Realtime subscription is what
 * keeps the feed warm for live viewers; the cache exists for first-byte
 * latency and to absorb bursts.
 *
 * @stub Wave 1.8 — schema + Realtime channel exist; full implementation
 * lands when the activity_events writer cron is wired (see
 * `docs/EXECUTION_PLAN.md` §9 WAVE 1).
 */

import { z } from 'zod'
import type { ActivityEvent } from '../types/activity'

const InputSchema = z.object({
  limit: z.number().int().min(1).max(50).default(12),
})

export async function getRecentActivity(
  limit: number = 12,
): Promise<ActivityEvent[]> {
  InputSchema.parse({ limit })
  throw new Error(
    '[getRecentActivity] NotImplementedError. Wave 1.8 — see docs/EXECUTION_PLAN.md §9.',
  )
}
