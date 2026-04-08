import { NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
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

type ListingRow = {
  ListingKey?: string | null
  ListNumber?: string | null
  StandardStatus?: string | null
}

type OneResult = {
  processed: number
  markedVerified: number
  historyRowsInserted: number
  fetchFailures: number
}

async function verifyOneListing(
  supabase: SupabaseClient,
  token: string,
  row: ListingRow
): Promise<OneResult> {
  const key1 = String(row.ListingKey ?? '').trim()
  const key2 = String(row.ListNumber ?? '').trim()
  const keys = [...new Set([key1, key2].filter(Boolean))]
  if (keys.length === 0 || !row.ListNumber) {
    return { processed: 0, markedVerified: 0, historyRowsInserted: 0, fetchFailures: 0 }
  }
  const listingKey = keys[0]!

  let items: SparkListingHistoryItem[] = []
  let hadStrictSuccess = false

  try {
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
      return { processed: 1, markedVerified: 0, historyRowsInserted: 0, fetchFailures: 1 }
    }

    let historyRowsInserted = 0
    if (items.length > 0) {
      await supabase.from('listing_history').delete().eq('listing_key', listingKey)
      const historyRows = items.map((item) => sparkHistoryItemToRow(listingKey, item))
      const { error: insertError } = await supabase.from('listing_history').insert(historyRows as never[])
      if (!insertError) historyRowsInserted = historyRows.length
    }

    const { error: updateError } = await supabase
      .from('listings')
      .update({ history_verified_full: true, is_finalized: true } as never)
      .eq('ListNumber', row.ListNumber)

    return {
      processed: 1,
      markedVerified: updateError ? 0 : 1,
      historyRowsInserted,
      fetchFailures: 0,
    }
  } catch {
    return { processed: 1, markedVerified: 0, historyRowsInserted: 0, fetchFailures: 1 }
  }
}

function emptySum(): OneResult {
  return { processed: 0, markedVerified: 0, historyRowsInserted: 0, fetchFailures: 0 }
}

function addSum(a: OneResult, b: OneResult): OneResult {
  return {
    processed: a.processed + b.processed,
    markedVerified: a.markedVerified + b.markedVerified,
    historyRowsInserted: a.historyRowsInserted + b.historyRowsInserted,
    fetchFailures: a.fetchFailures + b.fetchFailures,
  }
}

async function runWithConcurrency(
  supabase: SupabaseClient,
  token: string,
  rows: ListingRow[],
  concurrency: number
): Promise<OneResult> {
  const queue = [...rows]
  const workers = Math.max(1, Math.min(concurrency, queue.length || 1))

  async function worker(): Promise<OneResult> {
    let local = emptySum()
    while (queue.length > 0) {
      const row = queue.shift()
      if (!row) break
      local = addSum(local, await verifyOneListing(supabase, token, row))
    }
    return local
  }

  const parts = await Promise.all(Array.from({ length: workers }, () => worker()))
  return parts.reduce(addSum, emptySum())
}

type TelemetryPayload = {
  startedAtIso: string
  ok: boolean
  querySucceeded: boolean
  processed: number
  markedVerified: number
  fetchFailures: number
  historyRowsInserted: number
  limitParam: number
  concurrencyParam: number
  yearFilter: number | null
  errorMessage: string | null
}

async function recordStrictVerifyRun(supabase: SupabaseClient, startedAtMs: number, row: TelemetryPayload) {
  const durationMs = Date.now() - startedAtMs
  const { error } = await supabase.from('strict_verify_runs').insert({
    started_at: row.startedAtIso,
    completed_at: new Date().toISOString(),
    ok: row.ok,
    query_succeeded: row.querySucceeded,
    processed: row.processed,
    marked_verified: row.markedVerified,
    fetch_failures: row.fetchFailures,
    history_rows_inserted: row.historyRowsInserted,
    limit_param: row.limitParam,
    concurrency_param: row.concurrencyParam,
    year_filter: row.yearFilter,
    duration_ms: durationMs,
    error_message: row.errorMessage,
  } as never)
  if (error) {
    console.error('[sync-verify-full-history] strict_verify_runs insert failed', error.message)
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const limit = Math.max(1, Math.min(500, Number.parseInt(searchParams.get('limit') ?? '200', 10) || 200))
  const envConc = Number.parseInt(process.env.STRICT_VERIFY_CONCURRENCY ?? '3', 10)
  const concRaw = Number.parseInt(searchParams.get('concurrency') ?? String(Number.isFinite(envConc) ? envConc : 3), 10)
  const concurrency = Math.max(1, Math.min(6, Number.isFinite(concRaw) ? concRaw : 3))
  const year = Number.parseInt(searchParams.get('year') ?? '0', 10)
  const hasYear = Number.isFinite(year) && year >= 1990 && year <= new Date().getUTCFullYear()
  const yearFilter = hasYear ? year : null

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

  const supabase = createClient(supabaseUrl, serviceKey)
  const startedAtMs = Date.now()
  const startedAtIso = new Date().toISOString()

  const fromIso = hasYear ? new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0)).toISOString() : null
  const toIso = hasYear ? new Date(Date.UTC(year + 1, 0, 1, 0, 0, 0, 0)).toISOString() : null

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

  try {
    const { data, error } = await query
    if (error) {
      await recordStrictVerifyRun(supabase, startedAtMs, {
        startedAtIso,
        ok: false,
        querySucceeded: false,
        processed: 0,
        markedVerified: 0,
        fetchFailures: 0,
        historyRowsInserted: 0,
        limitParam: limit,
        concurrencyParam: concurrency,
        yearFilter,
        errorMessage: error.message,
      })
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }

    const terminalRows = (data ?? []).filter((r) =>
      isTerminalStatus((r as { StandardStatus?: string | null }).StandardStatus)
    ) as ListingRow[]

    const { processed, markedVerified, historyRowsInserted, fetchFailures } = await runWithConcurrency(
      supabase,
      token,
      terminalRows,
      concurrency
    )

    await recordStrictVerifyRun(supabase, startedAtMs, {
      startedAtIso,
      ok: true,
      querySucceeded: true,
      processed,
      markedVerified,
      fetchFailures,
      historyRowsInserted,
      limitParam: limit,
      concurrencyParam: concurrency,
      yearFilter,
      errorMessage: null,
    })

    return NextResponse.json({
      ok: true,
      processed,
      markedVerified,
      historyRowsInserted,
      fetchFailures,
      year: yearFilter,
      limit,
      concurrency,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await recordStrictVerifyRun(supabase, startedAtMs, {
      startedAtIso,
      ok: false,
      querySucceeded: true,
      processed: 0,
      markedVerified: 0,
      fetchFailures: 0,
      historyRowsInserted: 0,
      limitParam: limit,
      concurrencyParam: concurrency,
      yearFilter,
      errorMessage: message,
    })
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
