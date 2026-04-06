import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { fetchSparkListingHistory, fetchSparkPriceHistory, type SparkListingHistoryItem } from '@/lib/spark'

/** Spark history per listing can exceed default serverless limits; raise on Vercel Pro+. */
export const maxDuration = 300

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (secret?.trim()) {
    const auth = request.headers.get('authorization')
    return auth === `Bearer ${secret}`
  }
  return true
}

function isTerminalStatus(status: string | null | undefined): boolean {
  const t = String(status ?? '').toLowerCase()
  return /closed/.test(t) || /expired/.test(t) || /withdrawn/.test(t) || /cancel/.test(t)
}

function sparkHistoryItemToRow(listingKey: string, item: SparkListingHistoryItem) {
  const dateRaw = item.ModificationTimestamp ?? item.Date
  const eventDate = dateRaw && !Number.isNaN(new Date(String(dateRaw)).getTime()) ? String(dateRaw) : null
  const priceNum =
    typeof item.Price === 'number'
      ? item.Price
      : typeof item.PriceAtEvent === 'number'
        ? item.PriceAtEvent
        : typeof item.PriceAtEvent === 'string'
          ? Number(item.PriceAtEvent)
          : null
  return {
    listing_key: listingKey,
    event_date: eventDate,
    event: typeof item.Event === 'string' ? item.Event : null,
    description: typeof item.Description === 'string' ? item.Description : null,
    price: Number.isFinite(priceNum as number) ? Number(priceNum) : null,
    price_change: typeof item.PriceChange === 'number' ? item.PriceChange : null,
    raw: item as unknown as Record<string, unknown>,
  }
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const token = process.env.SPARK_API_KEY
  if (!supabaseUrl?.trim() || !serviceKey?.trim()) {
    return NextResponse.json({ ok: false, error: 'Supabase not configured' }, { status: 503 })
  }
  if (!token?.trim()) {
    return NextResponse.json({ ok: false, error: 'SPARK_API_KEY not configured' }, { status: 503 })
  }

  const { searchParams } = new URL(request.url)
  const limit = Math.max(1, Math.min(500, Number.parseInt(searchParams.get('limit') ?? '200', 10) || 200))
  const year = Number.parseInt(searchParams.get('year') ?? '0', 10)
  const hasYear = Number.isFinite(year) && year >= 1990 && year <= new Date().getUTCFullYear()
  const fromIso = hasYear ? new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0)).toISOString() : null
  const toIso = hasYear ? new Date(Date.UTC(year + 1, 0, 1, 0, 0, 0, 0)).toISOString() : null

  const supabase = createClient(supabaseUrl, serviceKey)

  let query = supabase
    .from('listings')
    .select('ListingKey, ListNumber, StandardStatus, OnMarketDate')
    .eq('history_finalized', true)
    .eq('history_verified_full', false)
    .order('OnMarketDate', { ascending: false, nullsFirst: false })
    .limit(limit)
  if (hasYear && fromIso && toIso) {
    query = query.gte('OnMarketDate', fromIso).lt('OnMarketDate', toIso)
  }

  const { data, error } = await query
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  const rows =
    (data ?? []).filter((r) => isTerminalStatus((r as { StandardStatus?: string | null }).StandardStatus)) as Array<{
      ListingKey?: string | null
      ListNumber?: string | null
      StandardStatus?: string | null
    }>

  let processed = 0
  let markedVerified = 0
  let historyRowsInserted = 0
  let fetchFailures = 0

  for (const row of rows) {
    const key1 = String(row.ListingKey ?? '').trim()
    const key2 = String(row.ListNumber ?? '').trim()
    const keys = [...new Set([key1, key2].filter(Boolean))]
    if (keys.length === 0 || !row.ListNumber) continue
    const listingKey = keys[0]!
    processed += 1

    let items: SparkListingHistoryItem[] = []
    let hadStrictSuccess = false

    for (const key of keys) {
      const h = await fetchSparkListingHistory(token, key)
      if (h.ok && h.partial !== true) hadStrictSuccess = true
      if (h.ok && h.partial !== true && h.items.length > 0) {
        items = h.items
        break
      }
    }

    if (items.length === 0) {
      for (const key of keys) {
        const p = await fetchSparkPriceHistory(token, key)
        if (p.ok && p.partial !== true) hadStrictSuccess = true
        if (p.ok && p.partial !== true && p.items.length > 0) {
          items = p.items
          break
        }
      }
    }

    if (!hadStrictSuccess) {
      fetchFailures += 1
      continue
    }

    if (items.length > 0) {
      await supabase.from('listing_history').delete().eq('listing_key', listingKey)
      const historyRows = items.map((item) => sparkHistoryItemToRow(listingKey, item))
      const { error: insertError } = await supabase.from('listing_history').insert(historyRows)
      if (!insertError) historyRowsInserted += historyRows.length
    }

    const { error: updateError } = await supabase
      .from('listings')
      .update({ history_verified_full: true, is_finalized: true })
      .eq('ListNumber', row.ListNumber)
    if (!updateError) markedVerified += 1
  }

  return NextResponse.json({
    ok: true,
    processed,
    markedVerified,
    historyRowsInserted,
    fetchFailures,
    year: hasYear ? year : null,
    limit,
  })
}
