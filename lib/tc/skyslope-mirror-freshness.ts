/**
 * SkySlope recon-mirror freshness math (no Next server-only).
 * Used by the DAL and by loop-brief / scoreboard (tsx).
 */
import type { SupabaseClient } from '@supabase/supabase-js'

import { isSkySlopeMirrorCurrent } from './skyslope-mirror-shape'

export const SKYSLOPE_MIRROR_FRESHNESS_SOURCE =
  'skyslope_transactions via readSkySlopeMirrorFreshness (inbound recon; Vault is SoR)'

export type SkySlopeMirrorFreshness = {
  status: 'ok' | 'unreadable'
  rowCount: number
  latestSyncedAt: string | null
  ageHours: number | null
  current: boolean
  source: string
}

function unread(): SkySlopeMirrorFreshness {
  return {
    status: 'unreadable',
    rowCount: 0,
    latestSyncedAt: null,
    ageHours: null,
    current: false,
    source: SKYSLOPE_MIRROR_FRESHNESS_SOURCE,
  }
}

export async function readSkySlopeMirrorFreshness(
  sb: SupabaseClient,
  now: Date = new Date(),
): Promise<SkySlopeMirrorFreshness> {
  try {
    const [{ count, error: countErr }, { data: newest, error: newestErr }] = await Promise.all([
      sb.from('skyslope_transactions').select('property_key', { count: 'exact', head: true }),
      sb.from('skyslope_transactions').select('synced_at').order('synced_at', { ascending: false }).limit(1),
    ])
    if (countErr || newestErr) return unread()
    const latestSyncedAt = (newest?.[0]?.synced_at as string | null) ?? null
    const ageHours =
      latestSyncedAt && Number.isFinite(new Date(latestSyncedAt).getTime())
        ? (now.getTime() - new Date(latestSyncedAt).getTime()) / 3_600_000
        : null
    return {
      status: 'ok',
      rowCount: count ?? 0,
      latestSyncedAt,
      ageHours,
      current: isSkySlopeMirrorCurrent(latestSyncedAt, now),
      source: SKYSLOPE_MIRROR_FRESHNESS_SOURCE,
    }
  } catch {
    return unread()
  }
}
