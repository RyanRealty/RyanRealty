/**
 * Auto-finalization when a listing status changes to Closed. Section 7.5b.
 * Fetches full listing with all fields, updates DB, sets finalized_at, triggers CMA recompute.
 */

import { inngest } from '@/lib/inngest'
import { createClient } from '@supabase/supabase-js'
import { fetchSingleListing } from '@/lib/spark-odata'
import { processSparkListing } from '@/lib/listing-processor'
import * as Sentry from '@sentry/nextjs'

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) throw new Error('Supabase service role not configured')
  return createClient(url, key)
}

export const finalizeListing = inngest.createFunction(
  {
    id: 'sync/finalize-listing',
    name: 'Finalize closed listing',
    retries: 2,
  },
  { event: 'sync/finalize-listing', data: { listingKey: '' } },
  async ({ step, event }) => {
    const listingKey = (event.data as { listingKey: string }).listingKey
    if (!listingKey) {
      Sentry.captureMessage('finalize-listing called without listingKey')
      return { ok: false, reason: 'missing listingKey' }
    }

    const fullListing = await step.run('fetch-full-listing', async () => {
      const row = await fetchSingleListing(listingKey)
      if (!row) return null
      return row
    })

    if (!fullListing) {
      Sentry.captureMessage('finalize-listing: listing not found', { extra: { listingKey } })
      return { ok: false, reason: 'not found' }
    }

    await step.run('upsert-final-data', async () => {
      await processSparkListing(fullListing)
      return { ok: true }
    })

    const supabase = getServiceSupabase()

    await step.run('set-final-and-metrics', async () => {
      const closePrice = fullListing.ClosePrice ?? null
      const closeDate = fullListing.CloseDate ?? null
      const listPrice = fullListing.ListPrice ?? null
      const { data: listing } = await supabase.from('listings').select('listing_contract_date, on_market_date').eq('listing_key', listingKey).single()
      const listDate = (listing as { listing_contract_date?: string; on_market_date?: string } | null)?.listing_contract_date ?? (listing as { on_market_date?: string } | null)?.on_market_date ?? fullListing.ListingContractDate ?? fullListing.OnMarketDate
      const closeDateParsed = closeDate ? new Date(closeDate) : null
      const listDateParsed = listDate ? new Date(listDate) : null
      const totalDom = closeDateParsed && listDateParsed ? Math.round((closeDateParsed.getTime() - listDateParsed.getTime()) / (24 * 60 * 60 * 1000)) : null
      const updates: Record<string, unknown> = {
        standard_status: 'Final',
        finalized_at: new Date().toISOString(),
        finalization_notes: 'Auto-finalized with complete data',
        is_finalized: true,
        close_price: closePrice,
        close_date: closeDate,
      }
      if (totalDom != null) updates.days_on_market = totalDom
      await supabase.from('listings').update(updates).eq('listing_key', listingKey)
      return { totalDom }
    })

    await step.run('trigger-cma-recompute', async () => {
      const { data: row } = await supabase.from('listings').select('subdivision_name').eq('listing_key', listingKey).single()
      const community = (row as { subdivision_name?: string } | null)?.subdivision_name
      if (!community) return { triggered: false }
      try {
        await inngest.send({
          name: 'reporting/compute-market-stats',
          data: { geoType: 'community', geoName: community },
        })
      } catch {
        // Event may not be registered
      }
      return { triggered: true }
    })

    return { ok: true, listingKey }
  }
)
