/**
 * Initial full sync: fetch ALL listings from Spark OData, process each page.
 * Section 7.2, 7.3. Resumable via sync_checkpoints.next_url; self-invokes with nextUrl for each page.
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

const PAGE_SIZE = 1000
const EXPAND_MEDIA = 'Media'

type SyncPayload = {
  nextUrl?: string | null
  checkpointId?: string
  processedCount?: number
  totalCount?: number | null
}

export const initialFullSync = inngest.createFunction(
  {
    id: 'sync/initial-full-sync',
    name: 'Initial full sync from Spark API',
    retries: 3,
    concurrency: { limit: 1 },
  },
  { event: 'sync/initial-full-sync', data: {} as SyncPayload },
  async ({ step, event }) => {
    const data = event.data as SyncPayload
    const supabase = getServiceSupabase()

    const checkpointId = await step.run('ensure-checkpoint', async () => {
      if (data.checkpointId) return data.checkpointId
      const { data: row, error } = await supabase
        .from('sync_checkpoints')
        .insert({
          sync_type: 'initial',
          status: 'running',
          total_count: null,
          processed_count: 0,
          next_url: null,
          error_log: [],
          metadata: {},
        })
        .select('id')
        .single()
      if (error) throw error
      return row?.id as string
    })

    const pageResult = await step.run('fetch-page', async () => {
      if (data.nextUrl) {
        return fetchListings({ nextUrl: data.nextUrl })
      }
      return fetchListings({
        top: PAGE_SIZE,
        select: SPARK_SELECT_FIELDS,
        expand: EXPAND_MEDIA,
        orderby: 'ModificationTimestamp asc',
      })
    })

    const totalCount = pageResult.totalCount ?? data.totalCount ?? null
    const records = pageResult.records
    const nextUrl = pageResult.nextUrl

    const processed = await step.run('process-page', async () => {
      const errorLog: Array<{ listing_key: string; error: string; timestamp: string }> = []
      for (const record of records) {
        try {
          await processSparkListing(record)
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e)
          errorLog.push({ listing_key: record.ListingKey ?? 'unknown', error: msg, timestamp: new Date().toISOString() })
          Sentry.captureException(e, { extra: { listingKey: record.ListingKey } })
        }
      }
      const prevCount = data.processedCount ?? 0
      const newCount = prevCount + records.length
      const lastKey = records[records.length - 1]?.ListingKey ?? null
      const { data: existing } = await supabase.from('sync_checkpoints').select('error_log').eq('id', checkpointId).single()
      const existingLog = (existing?.error_log as Array<{ listing_key: string; error: string; timestamp: string }>) ?? []
      await supabase
        .from('sync_checkpoints')
        .update({
          total_count: totalCount,
          processed_count: newCount,
          next_url: nextUrl,
          last_listing_key: lastKey,
          updated_at: new Date().toISOString(),
          error_log: [...existingLog, ...errorLog],
          speed_records_per_min: totalCount != null && totalCount > 0 ? newCount / (1 / 60) : null,
        })
        .eq('id', checkpointId)
      return { processed: records.length, totalProcessed: newCount, nextUrl }
    })

    if (processed.nextUrl) {
      await step.sendEvent('next-page', {
        name: 'sync/initial-full-sync',
        data: {
          nextUrl: processed.nextUrl,
          checkpointId,
          processedCount: processed.totalProcessed,
          totalCount,
        },
      })
      return { checkpointId, processed: processed.processed, totalProcessed: processed.totalProcessed, hasMore: true }
    }

    await step.run('complete-checkpoint', async () => {
      await supabase
        .from('sync_checkpoints')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', checkpointId)
      return { done: true }
    })

    return { checkpointId, totalProcessed: processed.totalProcessed, hasMore: false }
  }
)
