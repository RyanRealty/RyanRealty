import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { getAdminRoleForEmail } from '@/app/actions/admin-roles'
import { createClient } from '@supabase/supabase-js'
import { fetchSparkListingHistory, fetchSparkPriceHistory } from '@/lib/spark'
import type { SparkListingHistoryItem } from '@/lib/spark'

export const dynamic = 'force-dynamic'

const SAMPLE_SIZE = Math.max(1, Math.min(10, Number(process.env.SYNC_LIVE_YIELD_SAMPLE_SIZE ?? 1)))
const PROBE_TIMEOUT_MS = Math.max(5000, Math.min(30000, Number(process.env.SYNC_LIVE_YIELD_TIMEOUT_MS ?? 15000)))
const LOOKBACK_YEARS = Math.max(0, Math.min(20, Number(process.env.SYNC_TERMINAL_LOOKBACK_YEARS ?? 5)))

type ProbeRow = {
  ListingKey?: string | null
  ListNumber?: string | null
}

type YieldProbeItem = {
  listingKey: string
  reachable: boolean
  hasHistory: boolean
  historyEvents: number
  priceHistoryEvents: number
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), timeoutMs)
    promise
      .then((value) => resolve(value))
      .catch(() => resolve(fallback))
      .finally(() => clearTimeout(timer))
  })
}

export async function GET() {
  try {
    const supabaseAuth = await createServerClient()
    const { data: { user } } = await supabaseAuth.auth.getUser()
    if (!user?.email) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    }
    const role = await getAdminRoleForEmail(user.email)
    if (!role) {
      return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 })
    }

    const sparkToken = process.env.SPARK_API_KEY
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!sparkToken?.trim()) {
      return NextResponse.json({ ok: false, error: 'SPARK_API_KEY is not configured' }, { status: 503 })
    }
    if (!supabaseUrl?.trim() || !serviceKey?.trim()) {
      return NextResponse.json({ ok: false, error: 'Supabase service role is not configured' }, { status: 503 })
    }

    const supabase = createClient(supabaseUrl, serviceKey)
    void supabase
    const { selectHistorySyncCandidates } = await import('@/lib/data')
    const { rows: data, error } = await selectHistorySyncCandidates<{ ListingKey?: string; ListNumber?: string }>({
      columns: 'ListingKey, ListNumber',
      statusOr:
        'StandardStatus.ilike.%Closed%,StandardStatus.ilike.%Expired%,StandardStatus.ilike.%Withdrawn%,StandardStatus.ilike.%Cancel%',
      limit: SAMPLE_SIZE,
      orderBy: { column: 'ListNumber', ascending: true, nullsFirst: false },
    })
    void LOOKBACK_YEARS

    if (error) {
      return NextResponse.json({ ok: false, error }, { status: 500 })
    }

    const sampleRows = (data ?? []) as ProbeRow[]
    const sampleKeys = sampleRows
      .map((row) => String(row.ListingKey ?? row.ListNumber ?? '').trim())
      .filter((k) => k.length > 0)

    if (sampleKeys.length === 0) {
      return NextResponse.json(
        {
          ok: true,
          sampled: 0,
          reachableCount: 0,
          withHistoryCount: 0,
          yieldPct: 0,
          reachablePct: 0,
          checkedAt: new Date().toISOString(),
          note: 'No terminal listings left to sample.',
          samples: [],
        },
        {
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate',
          },
        }
      )
    }

    const probes = await Promise.all(
      sampleKeys.map(async (listingKey): Promise<YieldProbeItem> => {
        const history = await withTimeout(
          fetchSparkListingHistory(sparkToken, listingKey),
          PROBE_TIMEOUT_MS,
          { ok: false, items: [] as SparkListingHistoryItem[] }
        )

        let priceHistory = { ok: false, items: [] as unknown[] }
        if (!(history.ok && history.items.length > 0)) {
          priceHistory = await withTimeout(
            fetchSparkPriceHistory(sparkToken, listingKey),
            PROBE_TIMEOUT_MS,
            { ok: false, items: [] as SparkListingHistoryItem[] }
          )
        }

        const reachable = !!history.ok || !!priceHistory.ok
        const historyEvents = Array.isArray(history.items) ? history.items.length : 0
        const priceHistoryEvents = Array.isArray(priceHistory.items) ? priceHistory.items.length : 0
        const hasHistory = historyEvents > 0 || priceHistoryEvents > 0

        return {
          listingKey,
          reachable,
          hasHistory,
          historyEvents,
          priceHistoryEvents,
        }
      })
    )

    const sampled = probes.length
    const reachableCount = probes.filter((p) => p.reachable).length
    const withHistoryCount = probes.filter((p) => p.hasHistory).length
    const yieldPct = sampled > 0 ? Math.round((withHistoryCount / sampled) * 1000) / 10 : 0
    const reachablePct = sampled > 0 ? Math.round((reachableCount / sampled) * 1000) / 10 : 0

    return NextResponse.json(
      {
        ok: true,
        sampled,
        reachableCount,
        withHistoryCount,
        yieldPct,
        reachablePct,
        checkedAt: new Date().toISOString(),
        note:
          reachableCount > 0 && withHistoryCount === 0
            ? 'Spark is reachable, but this sample returned zero history events.'
            : null,
        samples: probes,
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
