import { NextResponse } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import {
  fetchSparkListingHistory,
  fetchSparkPriceHistory,
  type SparkListingHistoryItem,
} from '@/lib/spark'
import { syncAuxiliaryTablesForFinalization } from '@/app/api/admin/sync/_shared/listing-completeness'
import { sparkToListingRow, sparkHistoryItemToRow as mapHistoryItem } from '@/lib/listing-mapper'
import { processNewExpiredListings } from '@/lib/expired-listing-processor'

/**
 * Delta Sync Cron — runs every 15 minutes.
 *
 * SCOPE: NON-FINALIZED LISTINGS ONLY.
 *
 * This is the primary sync mechanism for keeping listings fresh.
 * It fetches only listings modified since the last run, which means:
 * - New listings appear within 15 minutes
 * - Price changes are captured with full history records
 * - Status changes are captured with full history records
 * - Listings reaching terminal status get finalized (never synced again)
 *
 * When a listing reaches terminal status (Closed, Expired, Withdrawn, Canceled):
 * - Fetches full listing history from Spark API
 * - Inserts listing_history records
 * - Sets history_finalized = true, is_finalized = true
 * - That listing is NEVER synced again
 *
 * Auth: Authorization: Bearer CRON_SECRET
 */

// VirtualTours added 2026-06-08: the feed keeps 3D / Matterport / Zillow-3D
// tours in a SEPARATE sub-resource from Videos. Without expanding it the sync
// stored only VirtualToursCount (a scalar) and never the tour URLs, so ~700
// active listings with a tour showed no media on the site. details.VirtualTours
// is now the canonical tour source (read by getListingVideos).
const SPARK_EXPAND = 'Photos,Videos,VirtualTours,OpenHouses'
const UPSERT_CHUNK = 25
const MAX_PAGES = 100
/** Max terminal listings to finalize per run (avoid timeout) */
const MAX_FINALIZE_PER_RUN = 30
/** Max photo fixes per run */
const MAX_PHOTO_FIXES = 20

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim()
  const isProd = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production'
  if (!secret) {
    if (isProd) return false
    return true
  }
  const auth = request.headers.get('authorization') ?? ''
  return auth === `Bearer ${secret}`
}

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) return null
  return createClient(url, key)
}

function isTerminalStatus(s: string | null | undefined): boolean {
  const t = String(s ?? '').toLowerCase()
  return /closed/.test(t) || /expired/.test(t) || /withdrawn/.test(t) || /cancel/.test(t)
}

async function fetchSparkDelta(accessToken: string, sinceIso: string, page: number) {
  const baseUrl = (process.env.SPARK_API_BASE_URL ?? 'https://replication.sparkapi.com/v1').replace(/\/$/, '')
  const filter = `ModificationTimestamp Gt ${sinceIso}`
  const url = `${baseUrl}/listings?_filter=${encodeURIComponent(filter)}&_orderby=+ModificationTimestamp&_expand=${SPARK_EXPAND}&_limit=200&_page=${page}`

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    console.error(`[sync-delta] Spark API error ${res.status}:`, text.substring(0, 300))
    return null
  }

  return res.json()
}

async function fetchPhotoForListing(accessToken: string, listingKey: string): Promise<string | null> {
  const baseUrl = (process.env.SPARK_API_BASE_URL ?? 'https://replication.sparkapi.com/v1').replace(/\/$/, '')
  try {
    const res = await fetch(`${baseUrl}/listings/${listingKey}?_expand=Photos`, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
    })
    if (!res.ok) return null
    const body = await res.json()
    const f = body?.D?.Results?.[0]?.StandardFields ?? {}
    const photos = f.Photos ?? []
    const first = photos.find((p: { Primary?: boolean }) => p.Primary) ?? photos[0]
    return first?.Uri1600 ?? first?.Uri1280 ?? first?.Uri1024 ?? first?.Uri800 ?? first?.Uri640 ?? first?.Uri300 ?? null
  } catch {
    return null
  }
}

// Local SparkStandardFields, mapSparkToRow, and sparkHistoryItemToRow removed —
// now imported from @/lib/listing-mapper (sparkToListingRow, sparkHistoryItemToRow)

/**
 * Fetch listing history from Spark and insert into listing_history table.
 * Tries /history first, falls back to /historical/pricehistory.
 * Returns number of rows inserted.
 */
async function fetchAndInsertHistory(
  supabase: SupabaseClient,
  accessToken: string,
  listingKey: string
): Promise<{ inserted: number; ok: boolean; items: SparkListingHistoryItem[] }> {
  // Try /history endpoint first
  let response = await fetchSparkListingHistory(accessToken, listingKey)

  // Fallback to /historical/pricehistory if /history returned empty or failed
  if (response.items.length === 0) {
    const fallback = await fetchSparkPriceHistory(accessToken, listingKey)
    if (fallback.items.length > 0) {
      response = fallback
    }
  }

  const hadSuccessfulFetch = response.ok && response.partial !== true

  if (response.items.length > 0) {
    void supabase
    const rows = response.items.map(item => mapHistoryItem(listingKey, item))
    const { replaceListingHistoryForKey } = await import('@/lib/data')
    const result = await replaceListingHistoryForKey(listingKey, rows)
    if (!result.ok) {
      console.error(`[sync-delta] listing_history replace error for ${listingKey}:`, result.error)
      return { inserted: 0, ok: hadSuccessfulFetch, items: response.items }
    }
    return { inserted: result.inserted, ok: hadSuccessfulFetch, items: response.items }
  }

  return { inserted: 0, ok: hadSuccessfulFetch, items: response.items }
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const accessToken = process.env.SPARK_API_KEY?.trim()
  if (!accessToken) {
    return NextResponse.json({ error: 'SPARK_API_KEY not set' }, { status: 503 })
  }

  const supabase = getSupabase()
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 })
  }

  // Get last delta sync timestamp
  const { getSyncState } = await import('@/lib/data')
  const stateRow = await getSyncState()
  const lastAt = stateRow?.last_delta_sync_at
  // Default: 30 minutes ago if no previous run
  const sinceIso = lastAt ?? new Date(Date.now() - 30 * 60 * 1000).toISOString()

  let totalFetched = 0
  let totalUpserted = 0
  let newListings = 0
  let priceChanges = 0
  let statusChanges = 0
  let listingsFinalized = 0
  let historyRowsInserted = 0
  let photosFixed = 0
  let skippedFinalized = 0
  let page = 1
  let totalPages = 1

  try {
    while (page <= totalPages && page <= MAX_PAGES) {
      const response = await fetchSparkDelta(accessToken, sinceIso, page)
      if (!response?.D?.Results?.length) break

      if (response.D.Pagination) totalPages = response.D.Pagination.TotalPages
      const results = response.D.Results as Array<{ StandardFields: Record<string, unknown> }>
      totalFetched += results.length

      // Get existing listings to detect changes
      const listNumbers = results
        .map(r => r.StandardFields?.ListNumber ?? r.StandardFields?.ListingId)
        .filter((n): n is string => !!n)

      const { getExistingListingsByListNumbers } = await import('@/lib/data')
      const existingRows = await getExistingListingsByListNumbers(listNumbers)

      const existingByNum = new Map<string, {
        ListNumber: string
        ListingKey?: string | null
        StandardStatus?: string | null
        ListPrice?: number | null
        is_finalized?: boolean
      }>()
      for (const r of (existingRows ?? []) as Array<{
        ListNumber: string
        ListingKey?: string | null
        StandardStatus?: string | null
        ListPrice?: number | null
        is_finalized?: boolean
      }>) {
        existingByNum.set(r.ListNumber, r)
      }

      // Process each listing
      const rowsToUpsert: Array<Record<string, unknown>> = []
      const activityEvents: Array<{ listing_key: string; event_type: string; payload: Record<string, unknown> }> = []
      const priceHistoryRows: Array<{
        listing_key: string
        old_price: number | null
        new_price: number | null
        change_pct: number | null
        changed_at: string
      }> = []
      const statusHistoryRows: Array<{
        listing_key: string
        old_status: string | null
        new_status: string | null
        changed_at: string
      }> = []
      // Track terminal listings that need finalization
      const toFinalize: Array<{ listingKey: string; listNumber: string }> = []
      const queuedForFinalization = new Set<string>()

      for (const result of results) {
        const f = result.StandardFields as Record<string, unknown> & {
          ListingKey?: string; ListNumber?: string; ListingId?: string
          ListPrice?: number | null; StandardStatus?: string | null
          ClosePrice?: number | null; City?: string; SubdivisionName?: string
        }
        const listNumber = f?.ListNumber ?? f?.ListingId
        if (!listNumber) continue

        const existing = existingByNum.get(listNumber)

        // Skip finalized listings — they're done forever
        if (existing?.is_finalized) {
          skippedFinalized++
          continue
        }

        const row = sparkToListingRow(f)
        // Remove undefined fields
        const cleanRow: Record<string, unknown> = {}
        for (const [k, v] of Object.entries(row)) {
          if (v !== undefined) cleanRow[k] = v
        }
        rowsToUpsert.push(cleanRow)

        const listingKey = (f.ListingKey ?? f.ListNumber ?? '').toString()
        const newStatus = (f.StandardStatus ?? '').toString()
        const oldStatus = (existing?.StandardStatus ?? '').toString()
        const newPrice = f.ListPrice ?? null
        const oldPrice = existing?.ListPrice ?? null
        const now = new Date().toISOString()

        // === Detect changes and create history records ===

        if (!existing) {
          // Brand new listing
          newListings++
          activityEvents.push({
            listing_key: listingKey,
            event_type: 'new_listing',
            payload: { ListNumber: f.ListNumber, City: f.City, SubdivisionName: f.SubdivisionName, ListPrice: newPrice },
          })
        } else {
          // --- Status changes ---
          const oldStatusLower = oldStatus.toLowerCase()
          const newStatusLower = newStatus.toLowerCase()

          if (oldStatusLower !== newStatusLower && newStatus) {
            statusChanges++

            // Insert status_history record
            statusHistoryRows.push({
              listing_key: listingKey,
              old_status: oldStatus || null,
              new_status: newStatus,
              changed_at: now,
            })

            // Specific activity events
            if (/pending/i.test(newStatus) && !/pending/i.test(oldStatus)) {
              activityEvents.push({
                listing_key: listingKey,
                event_type: 'status_pending',
                payload: { ListNumber: f.ListNumber, previousStatus: oldStatus },
              })
            }

            if (isTerminalStatus(newStatus) && !isTerminalStatus(oldStatus)) {
              activityEvents.push({
                listing_key: listingKey,
                event_type: `status_${newStatusLower.replace(/\s+/g, '_')}`,
                payload: { ListNumber: f.ListNumber, ClosePrice: f.ClosePrice, ListPrice: newPrice },
              })
            }
          }

          // --- Price changes ---
          if (newPrice != null && oldPrice != null && newPrice !== oldPrice) {
            priceChanges++

            const changePct = oldPrice > 0 ? Math.round(((newPrice - oldPrice) / oldPrice) * 10000) / 100 : null

            // Insert price_history record
            priceHistoryRows.push({
              listing_key: listingKey,
              old_price: oldPrice,
              new_price: newPrice,
              change_pct: changePct,
              changed_at: now,
            })

            // Activity event
            activityEvents.push({
              listing_key: listingKey,
              event_type: newPrice < oldPrice ? 'price_drop' : 'price_increase',
              payload: { ListNumber: f.ListNumber, previous_price: oldPrice, new_price: newPrice },
            })
          }
        }

        // Tighten terminal handling:
        // if a listing is currently terminal and not finalized, queue it now.
        // This catches cases where the terminal transition event was missed.
        if (listingKey && isTerminalStatus(newStatus) && !queuedForFinalization.has(listNumber)) {
          queuedForFinalization.add(listNumber)
          toFinalize.push({ listingKey, listNumber })
        }
      }

      // === Persist everything ===

      // 1. Upsert listings in chunks
      const {
        upsertListingRows,
        insertPriceHistoryRows,
        insertStatusHistoryRows,
        insertActivityEventRows,
      } = await import('@/lib/data')
      for (let i = 0; i < rowsToUpsert.length; i += UPSERT_CHUNK) {
        const chunk = rowsToUpsert.slice(i, i + UPSERT_CHUNK)
        const result = await upsertListingRows(chunk)
        if (result.ok) totalUpserted += chunk.length
        else console.error('[sync-delta] upsert error:', result.error)
      }

      // 2. Insert price_history records
      if (priceHistoryRows.length > 0) {
        const result = await insertPriceHistoryRows(priceHistoryRows)
        if (!result.ok) console.error('[sync-delta] price_history insert error:', result.error)
      }

      // 3. Insert status_history records
      if (statusHistoryRows.length > 0) {
        const result = await insertStatusHistoryRows(statusHistoryRows)
        if (!result.ok) console.error('[sync-delta] status_history insert error:', result.error)
      }

      // 4. Insert activity events
      if (activityEvents.length > 0) {
        const eventRows = activityEvents.map(e => ({
          ...e,
          event_at: new Date().toISOString(),
        }))
        const result = await insertActivityEventRows(eventRows)
        if (!result.ok) console.error('[sync-delta] activity_events insert error:', result.error)
      }

      // 5. Finalize terminal listings — fetch full history, then mark finalized
      const finalizeSlice = toFinalize.slice(0, MAX_FINALIZE_PER_RUN - listingsFinalized)
      const rowByListNumber = new Map<string, Record<string, unknown>>(
        rowsToUpsert
          .filter((row): row is Record<string, unknown> & { ListNumber: string } => typeof row.ListNumber === 'string')
          .map((row) => [row.ListNumber, row])
      )
      for (const { listingKey, listNumber } of finalizeSlice) {
        if (listingsFinalized >= MAX_FINALIZE_PER_RUN) break

        const { inserted, ok: hadSuccessfulFetch, items } = await fetchAndInsertHistory(
          supabase,
          accessToken,
          listingKey
        )
        historyRowsInserted += inserted

        const sourceRow = rowByListNumber.get(listNumber)
        const auxSync = await syncAuxiliaryTablesForFinalization(
          supabase,
          {
            listingKey,
            photoUrl: typeof sourceRow?.PhotoURL === 'string' ? sourceRow.PhotoURL : null,
            details: sourceRow?.details ?? null,
            listAgentName: typeof sourceRow?.ListAgentName === 'string' ? sourceRow.ListAgentName : null,
            listAgentFirstName: typeof sourceRow?.ListAgentFirstName === 'string' ? sourceRow.ListAgentFirstName : null,
            listAgentLastName: typeof sourceRow?.ListAgentLastName === 'string' ? sourceRow.ListAgentLastName : null,
            listOfficeName: typeof sourceRow?.ListOfficeName === 'string' ? sourceRow.ListOfficeName : null,
          },
          items,
          { accessToken }
        )

        // Strict finalization: only finalize when history fetch succeeded and auxiliary tables are synced.
        if (hadSuccessfulFetch && auxSync.ok) {
          const result = await upsertListingRows([
            {
              ListNumber: listNumber,
              history_finalized: true,
              history_verified_full: true,
              is_finalized: true,
            },
          ])
          if (result.ok) {
            listingsFinalized++
          } else {
            console.error(`[sync-delta] finalization error for ${listNumber}:`, result.error)
          }
        }
      }

      // 6. Fix photos for listings that got upserted without PhotoURL
      const { updateListingPhotoUrl } = await import('@/lib/data')
      const upsertedKeys = rowsToUpsert
        .filter(r => !r.PhotoURL && r.ListingKey)
        .map(r => r.ListingKey as string)
        .slice(0, MAX_PHOTO_FIXES)

      for (const key of upsertedKeys) {
        const photoUrl = await fetchPhotoForListing(accessToken, key)
        if (photoUrl) {
          const result = await updateListingPhotoUrl(key, photoUrl)
          if (result.ok) photosFixed++
        }
      }

      page++
    }

    // Update last sync timestamp
    const { updateSyncStateLastDelta } = await import('@/lib/data')
    await updateSyncStateLastDelta(new Date().toISOString())

    // Refresh market pulse after sync
    try {
      await supabase.rpc('refresh_market_pulse')
    } catch {
      // Non-critical
    }

    // After Spark deltas land in `listings`, run the expired-listing pipeline
    // against anything that just transitioned to Expired / Canceled / Withdrawn
    // within our service area. This wires in the work that detect-expired-
    // listings used to do as a standalone hourly cron (removed 2026-05-22 per
    // Matt's directive — sync-delta is the natural trigger because it owns
    // the Spark hop). Smaller per-run cap than the legacy cron because
    // sync-delta fires every 10 min and the table dedupes on listing_key.
    // Soft-fail: a downstream error here must never break the MLS sync.
    let expiredStats: {
      scanned: number
      new_processed: number
      alert_emails_sent: number
      errors: number
    } | null = null
    try {
      const result = await processNewExpiredListings(supabase, {
        maxPerRun: 10,
        lookbackHours: 2,
      })
      expiredStats = {
        scanned: result.scanned,
        new_processed: result.new_processed,
        alert_emails_sent: result.alert_emails_sent,
        errors: result.errors,
      }
    } catch (err) {
      console.error(
        '[sync-delta] processNewExpiredListings failed (non-fatal):',
        err instanceof Error ? err.message : err,
      )
    }

    // Note: DAL materialized view refresh (listing_tile_mv + geo_snapshot_mv)
    // runs on its own /api/cron/refresh-mvs schedule (every 15 min). The
    // refresh is ~35s per MV CONCURRENTLY, too long to inline here without
    // pushing sync-delta past its serverless timeout.

    const summary = [
      `${totalUpserted} listings synced`,
      `${newListings} new`,
      `${priceChanges} price changes`,
      `${statusChanges} status changes`,
      `${listingsFinalized} finalized`,
      `${historyRowsInserted} history rows`,
      `${photosFixed} photos fixed`,
      skippedFinalized > 0 ? `${skippedFinalized} skipped (already finalized)` : null,
      expiredStats && expiredStats.new_processed > 0
        ? `${expiredStats.new_processed} expired listings processed (${expiredStats.alert_emails_sent} alerts)`
        : null,
    ].filter(Boolean).join(', ')

    return NextResponse.json({
      ok: true,
      summary,
      totalFetched,
      totalUpserted,
      newListings,
      priceChanges,
      statusChanges,
      listingsFinalized,
      historyRowsInserted,
      photosFixed,
      skippedFinalized,
      pages: page - 1,
      sinceIso,
      expired: expiredStats,
    })
  } catch (err) {
    console.error('[sync-delta] Fatal error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Delta sync failed' },
      { status: 500 }
    )
  }
}
