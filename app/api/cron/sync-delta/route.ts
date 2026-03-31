import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * Delta Sync Cron — runs every 15 minutes.
 *
 * This is the primary sync mechanism for keeping listings fresh.
 * It fetches only listings modified since the last run, which means:
 * - New listings appear within 15 minutes
 * - Price changes are captured within 15 minutes
 * - Status changes (Active → Pending → Closed) are captured within 15 minutes
 * - Activity events are emitted for each change
 *
 * When a listing closes (StandardStatus = Closed + CloseDate set):
 * - is_finalized = true
 * - That listing is NEVER synced again
 *
 * For new listings that arrive without photos:
 * - Immediately fetches the photo from Spark and sets PhotoURL
 *
 * Auth: Authorization: Bearer CRON_SECRET
 */

const SPARK_EXPAND = 'Photos,Videos,OpenHouses'
const UPSERT_CHUNK = 25
const MAX_PAGES = 100

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (secret?.trim()) {
    return request.headers.get('authorization') === `Bearer ${secret}`
  }
  return true // No secret = allow (dev)
}

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) return null
  return createClient(url, key)
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

type SparkStandardFields = {
  ListingKey?: string
  ListNumber?: string
  ListingId?: string
  ListPrice?: number | null
  StandardStatus?: string | null
  MlsStatus?: string | null
  ModificationTimestamp?: string | null
  CloseDate?: string | null
  ClosePrice?: number | null
  OriginalListPrice?: number | null
  StreetNumber?: string | null
  StreetName?: string | null
  City?: string | null
  State?: string | null
  PostalCode?: string | null
  SubdivisionName?: string | null
  BedroomsTotal?: number | null
  BathroomsTotal?: number | null
  TotalLivingAreaSqFt?: number | null
  PropertyType?: string | null
  Latitude?: number | null
  Longitude?: number | null
  ListDate?: string | null
  OnMarketDate?: string | null
  ListOfficeName?: string | null
  ListAgentName?: string | null
  ListAgentFirstName?: string | null
  ListAgentLastName?: string | null
  OpenHouses?: Array<{ Date?: string; StartTime?: string; EndTime?: string }>
  Photos?: Array<{ Primary?: boolean; Uri1600?: string; Uri1280?: string; Uri1024?: string; Uri800?: string; Uri640?: string; Uri300?: string }>
  Videos?: Array<{ Uri?: string }>
  [key: string]: unknown
}

function mapSparkToRow(fields: SparkStandardFields) {
  const photos = fields.Photos ?? []
  const firstPhoto = photos.find(p => p.Primary) ?? photos[0]
  const photoUrl = firstPhoto?.Uri1600 ?? firstPhoto?.Uri1280 ?? firstPhoto?.Uri1024 ?? firstPhoto?.Uri800 ?? firstPhoto?.Uri640 ?? firstPhoto?.Uri300 ?? null

  const agentFirst = (fields.ListAgentFirstName ?? '').toString().trim()
  const agentLast = (fields.ListAgentLastName ?? '').toString().trim()
  const listAgentName = [agentFirst, agentLast].filter(Boolean).join(' ') || fields.ListAgentName || null

  const status = (fields.StandardStatus ?? fields.MlsStatus ?? '').toString()
  const isClosed = /closed/i.test(status)

  // Spark replication API uses ListingId as the MLS number (maps to ListNumber in our DB)
  const listNumber = fields.ListNumber ?? fields.ListingId ?? null

  return {
    ListingKey: fields.ListingKey ?? null,
    ListNumber: listNumber,
    ListPrice: fields.ListPrice ?? null,
    StandardStatus: fields.StandardStatus ?? null,
    StreetNumber: fields.StreetNumber ?? null,
    StreetName: fields.StreetName ?? null,
    City: fields.City ?? null,
    State: fields.State ?? null,
    PostalCode: fields.PostalCode ?? null,
    SubdivisionName: fields.SubdivisionName ?? null,
    BedroomsTotal: fields.BedroomsTotal ?? null,
    BathroomsTotal: fields.BathroomsTotal ?? null,
    TotalLivingAreaSqFt: fields.TotalLivingAreaSqFt ?? null,
    PropertyType: fields.PropertyType ?? null,
    Latitude: fields.Latitude ?? null,
    Longitude: fields.Longitude ?? null,
    PhotoURL: photoUrl,
    ModificationTimestamp: fields.ModificationTimestamp ?? null,
    ListDate: fields.ListDate ?? fields.OnMarketDate ?? null,
    OnMarketDate: fields.OnMarketDate ?? fields.ListDate ?? null,
    CloseDate: fields.CloseDate ?? null,
    ClosePrice: fields.ClosePrice ?? null,
    OriginalListPrice: fields.OriginalListPrice ?? null,
    ListOfficeName: fields.ListOfficeName ?? null,
    ListAgentName: listAgentName,
    OpenHouses: fields.OpenHouses ?? null,
    details: {
      Videos: fields.Videos ?? [],
      Photos: photos,
      OpenHouses: fields.OpenHouses ?? [],
    },
    // Media finalization: closed listings don't need media re-synced
    media_finalized: isClosed ? true : undefined,
    // NOTE: is_finalized is NOT set here. A listing is only fully finalized
    // when history_finalized=true (set by the history sync pipeline after
    // all historical listing data has been captured for accurate reports).
    // Setting is_finalized prematurely would skip history data collection.
  }
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
  const { data: stateRow } = await supabase
    .from('sync_state')
    .select('last_delta_sync_at')
    .eq('id', 'default')
    .maybeSingle()

  const lastAt = (stateRow as { last_delta_sync_at?: string } | null)?.last_delta_sync_at
  // Default: 30 minutes ago if no previous run
  const sinceIso = lastAt ?? new Date(Date.now() - 30 * 60 * 1000).toISOString()

  let totalFetched = 0
  let totalUpserted = 0
  let newListings = 0
  let priceChanges = 0
  let statusChanges = 0
  let finalized = 0
  let photosFixed = 0
  let page = 1
  let totalPages = 1

  try {
    while (page <= totalPages && page <= MAX_PAGES) {
      const response = await fetchSparkDelta(accessToken, sinceIso, page)
      if (!response?.D?.Results?.length) break

      if (response.D.Pagination) totalPages = response.D.Pagination.TotalPages
      const results = response.D.Results as Array<{ StandardFields: SparkStandardFields }>
      totalFetched += results.length

      // Get existing listings to detect changes
      const listNumbers = results
        .map(r => r.StandardFields?.ListNumber ?? r.StandardFields?.ListingId)
        .filter((n): n is string => !!n)

      const { data: existingRows } = await supabase
        .from('listings')
        .select('ListNumber, StandardStatus, ListPrice, is_finalized')
        .in('ListNumber', listNumbers)

      const existingByNum = new Map<string, { StandardStatus?: string | null; ListPrice?: number | null; is_finalized?: boolean }>()
      for (const r of (existingRows ?? []) as Array<{ ListNumber: string; StandardStatus?: string | null; ListPrice?: number | null; is_finalized?: boolean }>) {
        existingByNum.set(r.ListNumber, r)
      }

      // Process each listing
      const rowsToUpsert: Array<Record<string, unknown>> = []
      const activityEvents: Array<{ listing_key: string; event_type: string; payload: Record<string, unknown> }> = []

      for (const result of results) {
        const f = result.StandardFields
        const listNumber = f?.ListNumber ?? f?.ListingId
        if (!listNumber) continue

        const existing = existingByNum.get(listNumber)

        // Skip finalized listings — they're done forever
        if (existing?.is_finalized) continue

        const row = mapSparkToRow(f)
        // Remove undefined fields
        const cleanRow: Record<string, unknown> = {}
        for (const [k, v] of Object.entries(row)) {
          if (v !== undefined) cleanRow[k] = v
        }
        rowsToUpsert.push(cleanRow)

        const listingKey = (f.ListingKey ?? f.ListNumber ?? '').toString()
        const newStatus = (f.StandardStatus ?? '').toLowerCase()
        const oldStatus = (existing?.StandardStatus ?? '').toLowerCase()
        const newPrice = f.ListPrice ?? null
        const oldPrice = existing?.ListPrice ?? null

        // Detect changes and emit activity events
        if (!existing) {
          newListings++
          activityEvents.push({
            listing_key: listingKey,
            event_type: 'new_listing',
            payload: { ListNumber: f.ListNumber, City: f.City, SubdivisionName: f.SubdivisionName, ListPrice: newPrice },
          })
        } else {
          // Status change: Active → Pending
          if (!/pending/i.test(oldStatus) && /pending/i.test(newStatus)) {
            statusChanges++
            activityEvents.push({
              listing_key: listingKey,
              event_type: 'status_pending',
              payload: { ListNumber: f.ListNumber, previousStatus: existing.StandardStatus },
            })
          }

          // Status change: → Closed (finalize)
          if (!/closed/i.test(oldStatus) && /closed/i.test(newStatus)) {
            statusChanges++
            finalized++
            activityEvents.push({
              listing_key: listingKey,
              event_type: 'status_closed',
              payload: { ListNumber: f.ListNumber, ClosePrice: f.ClosePrice, ListPrice: newPrice },
            })
          }

          // Price drop
          if (newPrice != null && oldPrice != null && newPrice < oldPrice) {
            priceChanges++
            activityEvents.push({
              listing_key: listingKey,
              event_type: 'price_drop',
              payload: { ListNumber: f.ListNumber, previous_price: oldPrice, new_price: newPrice },
            })
          }

          // Price increase
          if (newPrice != null && oldPrice != null && newPrice > oldPrice) {
            priceChanges++
            activityEvents.push({
              listing_key: listingKey,
              event_type: 'price_increase',
              payload: { ListNumber: f.ListNumber, previous_price: oldPrice, new_price: newPrice },
            })
          }
        }
      }

      // Upsert listings in chunks
      for (let i = 0; i < rowsToUpsert.length; i += UPSERT_CHUNK) {
        const chunk = rowsToUpsert.slice(i, i + UPSERT_CHUNK)
        const { error } = await supabase.from('listings').upsert(chunk, { onConflict: 'ListNumber' })
        if (!error) totalUpserted += chunk.length
        else console.error('[sync-delta] upsert error:', error.message)
      }

      // Insert activity events
      if (activityEvents.length > 0) {
        const eventRows = activityEvents.map(e => ({
          ...e,
          event_at: new Date().toISOString(),
        }))
        await supabase.from('activity_events').insert(eventRows).then(() => {})
      }

      // Fix photos for listings that got upserted without PhotoURL
      const upsertedKeys = rowsToUpsert
        .filter(r => !r.PhotoURL && r.ListingKey)
        .map(r => r.ListingKey as string)
        .slice(0, 20) // Limit per batch to avoid timeout

      for (const key of upsertedKeys) {
        const photoUrl = await fetchPhotoForListing(accessToken, key)
        if (photoUrl) {
          await supabase.from('listings').update({ PhotoURL: photoUrl }).eq('ListingKey', key)
          photosFixed++
        }
      }

      page++
    }

    // Update last sync timestamp
    await supabase.from('sync_state').upsert(
      { id: 'default', last_delta_sync_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { onConflict: 'id' }
    )

    // Refresh market pulse after sync
    try {
      await supabase.rpc('refresh_market_pulse')
    } catch {
      // Non-critical
    }

    const summary = [
      `${totalUpserted} listings synced`,
      `${newListings} new`,
      `${priceChanges} price changes`,
      `${statusChanges} status changes`,
      `${finalized} finalized`,
      `${photosFixed} photos fixed`,
    ].join(', ')

    return NextResponse.json({
      ok: true,
      summary,
      totalFetched,
      totalUpserted,
      newListings,
      priceChanges,
      statusChanges,
      finalized,
      photosFixed,
      pages: page - 1,
      sinceIso,
    })
  } catch (err) {
    console.error('[sync-delta] Fatal error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Delta sync failed' },
      { status: 500 }
    )
  }
}
