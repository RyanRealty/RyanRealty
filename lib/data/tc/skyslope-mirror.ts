/**
 * SkySlope inbound recon mirror — DAL.
 * reachability: /api/cron/skyslope-mirror-refresh, closings page, loop signals,
 * loop-health-check
 *
 * Vault (`tc_deals`) is the deal SoR. `skyslope_transactions` is a read-only
 * snapshot of SkySlope Files folders for recon + packet freshness. Writes here
 * never call SkySlope mutating verbs.
 */
import 'server-only'

import { createServiceClient } from '@/lib/supabase/service'
import {
  groupFoldersIntoProperties,
  isSkySlopeMirrorCurrent,
  SKYSLOPE_MIRROR_CURRENT_HOURS,
} from '@/lib/tc/skyslope-mirror-shape'
import {
  readSkySlopeMirrorFreshness,
  type SkySlopeMirrorFreshness,
} from '@/lib/tc/skyslope-mirror-freshness'
import { hasSkySlopeInboundCreds, pullSkySlopeInboundFolders } from '@/lib/tc/skyslope-inbound'

export { SKYSLOPE_MIRROR_CURRENT_HOURS, isSkySlopeMirrorCurrent }
export type { SkySlopeMirrorFreshness }

export type SkySlopeMirrorRefreshResult = {
  ok: boolean
  error: string | null
  blocker: string | null
  upserted: number
  removed: number
  saleFolders: number
  listingFolders: number
  syncedAt: string | null
}

export async function getSkySlopeMirrorFreshness(
  now: Date = new Date(),
): Promise<SkySlopeMirrorFreshness> {
  try {
    return await readSkySlopeMirrorFreshness(createServiceClient(), now)
  } catch (err) {
    console.error('[getSkySlopeMirrorFreshness]', err)
    return {
      status: 'unreadable',
      rowCount: 0,
      latestSyncedAt: null,
      ageHours: null,
      current: false,
      source: 'skyslope_transactions via getSkySlopeMirrorFreshness (inbound recon; Vault is SoR)',
    }
  }
}

export async function refreshSkySlopeMirrorInbound(): Promise<SkySlopeMirrorRefreshResult> {
  if (!hasSkySlopeInboundCreds()) {
    return {
      ok: false,
      error: 'SKYSLOPE inbound keys missing',
      blocker:
        'SKYSLOPE_ACCESS_KEY / SKYSLOPE_ACCESS_SECRET / SKYSLOPE_CLIENT_ID / SKYSLOPE_CLIENT_SECRET are not set in this environment. Add them to Vercel production (Files API HMAC — not a new OAuth grant) and re-run GET /api/cron/skyslope-mirror-refresh.',
      upserted: 0,
      removed: 0,
      saleFolders: 0,
      listingFolders: 0,
      syncedAt: null,
    }
  }

  try {
    const pulled = await pullSkySlopeInboundFolders()
    const properties = groupFoldersIntoProperties([...pulled.sales, ...pulled.listings])
    const syncedAt = new Date().toISOString()
    let sb
    try {
      sb = createServiceClient()
    } catch {
      return {
        ok: false,
        error: 'Supabase service role missing',
        blocker: 'NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing; cannot persist the inbound snapshot.',
        upserted: 0,
        removed: 0,
        saleFolders: pulled.sales.length,
        listingFolders: pulled.listings.length,
        syncedAt: null,
      }
    }
    const rows = properties.map((p) => ({
      property_key: p.property_key,
      address: p.address,
      broker: p.broker,
      stage: p.stage,
      stage_detail: p.stage_detail,
      zombie: p.zombie,
      compliance_state: p.compliance_state,
      headline: p.headline,
      cycles: p.cycles,
      rollup: p.rollup,
      synced_at: syncedAt,
    }))
    const { error: txError } = await sb.from('skyslope_transactions').upsert(rows, { onConflict: 'property_key' })
    if (txError) {
      return {
        ok: false,
        error: txError.message,
        blocker: null,
        upserted: 0,
        removed: 0,
        saleFolders: pulled.sales.length,
        listingFolders: pulled.listings.length,
        syncedAt: null,
      }
    }
    const keys = rows.map((r) => r.property_key)
    const { data: existing } = await sb.from('skyslope_transactions').select('property_key')
    const stale = (existing ?? []).map((r) => r.property_key as string).filter((k) => !keys.includes(k))
    if (stale.length) {
      await sb.from('skyslope_transactions').delete().in('property_key', stale)
    }
    const { error: metaError } = await sb.from('skyslope_dashboard_meta').upsert(
      {
        id: 1,
        totals: {
          properties: rows.length,
          saleFolders: pulled.sales.length,
          listingFolders: pulled.listings.length,
        },
        system_findings: [
          'Inbound-only Files API refresh. Vault (tc_deals) is the deal SoR. SkySlope is recon.',
        ],
        generated_at: syncedAt,
        synced_at: syncedAt,
      },
      { onConflict: 'id' },
    )
    if (metaError) {
      return {
        ok: false,
        error: metaError.message,
        blocker: null,
        upserted: rows.length,
        removed: stale.length,
        saleFolders: pulled.sales.length,
        listingFolders: pulled.listings.length,
        syncedAt,
      }
    }
    return {
      ok: true,
      error: null,
      blocker: null,
      upserted: rows.length,
      removed: stale.length,
      saleFolders: pulled.sales.length,
      listingFolders: pulled.listings.length,
      syncedAt,
    }
  } catch (err) {
    console.error('[refreshSkySlopeMirrorInbound]', err)
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'inbound refresh failed',
      blocker: null,
      upserted: 0,
      removed: 0,
      saleFolders: 0,
      listingFolders: 0,
      syncedAt: null,
    }
  }
}
