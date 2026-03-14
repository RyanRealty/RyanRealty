/**
 * Delta sync: fetch listings modified since last run. Section 7.5.
 * Cron every 2 minutes. 30-second buffer to avoid caching issues.
 */

import { inngest } from '@/lib/inngest'
import { createClient } from '@supabase/supabase-js'
import { fetchListings, SPARK_SELECT_FIELDS } from '@/lib/spark-odata'
import { processSparkListing } from '@/lib/listing-processor'
import * as Sentry from '@sentry/nextjs'

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) throw new Error('Supabase service role not configured')
  return createClient(url, key)
}

const PAGE_SIZE = 200
const EXPAND_MEDIA = 'Media'
const BUFFER_SECONDS = 30

export const deltaSync = inngest.createFunction(
  {
    id: 'sync/delta-sync',
    name: 'Delta sync (modified listings)',
    retries: 2,
    concurrency: { limit: 1 },
  },
  [
    { event: 'sync/delta-sync' },
    { cron: '*/2 * * * *' },
  ],
  async ({ step }) => {
    const supabase = getServiceSupabase()

    const lastSync = await step.run('get-last-sync', async () => {
      const { data } = await supabase
        .from('sync_checkpoints')
        .select('last_modification_ts')
        .eq('sync_type', 'delta')
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      return (data as { last_modification_ts?: string } | null)?.last_modification_ts ?? null
    })

    const windowEnd = new Date()
    windowEnd.setSeconds(windowEnd.getSeconds() - BUFFER_SECONDS)
    const windowEndStr = windowEnd.toISOString()
    // When there was no previous delta run (e.g. right after the original full sync), use 24h ago as window start so the first ingest still fetches recent changes.
    const windowStartStr = lastSync ?? new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    const filter = `ModificationTimestamp gt ${windowStartStr} and ModificationTimestamp lt ${windowEndStr} and (StandardStatus eq 'Active' or StandardStatus eq 'Pending' or StandardStatus eq 'ActiveUnderContract')`

    const result = await step.run('fetch-delta', async () => {
      return fetchListings({
        top: PAGE_SIZE,
        filter,
        select: SPARK_SELECT_FIELDS,
        expand: EXPAND_MEDIA,
        orderby: 'ModificationTimestamp asc',
      })
    })

    const listingsCreated: string[] = []
    const listingsUpdated: string[] = []
    const listingsStatusChanged: Array<{ listing_key: string; old_status: string | null; new_status: string | null }> = []
    const listingsPriceChanged: Array<{ listing_key: string; old_price: number | null; new_price: number | null }> = []
    const listingsClosed: string[] = []

    await step.run('process-delta', async () => {
      for (const record of result.records) {
        try {
          const existing = await supabase.from('listings').select('standard_status, list_price').eq('listing_key', record.ListingKey ?? '').maybeSingle()
          const oldStatus = (existing.data as { standard_status?: string } | null)?.standard_status ?? null
          const oldPrice = (existing.data as { list_price?: number } | null)?.list_price ?? null
          const res = await processSparkListing(record)
          if (res.isNew) listingsCreated.push(record.ListingKey ?? '')
          else listingsUpdated.push(record.ListingKey ?? '')
          if (res.hasStatusChange) {
            listingsStatusChanged.push({ listing_key: record.ListingKey ?? '', old_status: oldStatus, new_status: record.StandardStatus ?? null })
            if (record.StandardStatus === 'Closed') listingsClosed.push(record.ListingKey ?? '')
          }
          if (res.hasPriceChange) listingsPriceChanged.push({ listing_key: record.ListingKey ?? '', old_price: oldPrice, new_price: record.ListPrice ?? null })
        } catch (e) {
          Sentry.captureException(e, { extra: { listingKey: record.ListingKey } })
        }
      }
      return { processed: result.records.length }
    })

    for (const listingKey of listingsClosed) {
      await step.sendEvent(`finalize-${listingKey}`, {
        name: 'sync/finalize-listing',
        data: { listingKey },
      })
    }

    const checkpointId = await step.run('upsert-checkpoint', async () => {
      const { data: row, error } = await supabase
        .from('sync_checkpoints')
        .insert({
          sync_type: 'delta',
          status: 'completed',
          total_count: result.records.length,
          processed_count: result.records.length,
          next_url: null,
          last_modification_ts: windowEndStr,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          error_log: [],
          metadata: {
            listingsCreated,
            listingsUpdated,
            listingsStatusChanged,
            listingsPriceChanged,
            listingsClosed,
          },
        })
        .select('id')
        .single()
      if (error) throw error
      return row?.id as string
    })

    if (listingsCreated.length > 0 || listingsUpdated.length > 0) {
      await step.sendEvent('post-sync-match-searches', {
        name: 'sync/match-saved-searches',
        data: { listingKeys: [...listingsCreated, ...listingsUpdated] },
      })
    }
    if (listingsPriceChanged.length > 0) {
      await step.sendEvent('post-sync-price-drops', {
        name: 'sync/queue-price-drop-notifications',
        data: { listings: listingsPriceChanged },
      })
    }
    if (listingsStatusChanged.length > 0) {
      await step.sendEvent('post-sync-status-changes', {
        name: 'sync/queue-status-change-notifications',
        data: { listings: listingsStatusChanged },
      })
    }
    await step.sendEvent('post-sync-engagement', {
      name: 'sync/update-engagement-metrics',
      data: { listingKeys: [...listingsCreated, ...listingsUpdated] },
    })
    await step.sendEvent('post-sync-sitemap', {
      name: 'seo/regenerate-sitemap',
      data: {},
    })
    if (listingsClosed.length > 0) {
      await step.sendEvent('post-sync-cma', {
        name: 'cma/precompute-all',
        data: {},
      })
      await step.sendEvent('post-sync-market-stats', {
        name: 'reporting/compute-market-stats',
        data: {},
      })
    }

    return { checkpointId, processed: result.records.length, closed: listingsClosed.length }
  }
)
