'use server'

import { createClient } from '@supabase/supabase-js'
import { getSession } from '@/app/actions/auth'
import { getAdminRoleForEmail } from '@/app/actions/admin-roles'
import { fetchListings, SPARK_SELECT_FIELDS } from '@/lib/spark-odata'
import { upsertExpiredListingFromSpark } from '@/lib/listing-processor'

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) throw new Error('Supabase service role not configured')
  return createClient(url, key)
}

/** Ensure current user is superuser. */
async function requireSuperuser(): Promise<void> {
  const session = await getSession()
  const role = session?.user?.email ? (await getAdminRoleForEmail(session.user.email))?.role ?? null : null
  if (role !== 'superuser') throw new Error('Only the superuser can access expired listings.')
}

export type ExpiredListingRow = {
  id: string
  listing_key: string
  full_address: string
  city: string | null
  state: string | null
  postal_code: string | null
  owner_name: string | null
  list_agent_name: string | null
  list_office_name: string | null
  list_price: number | null
  original_list_price: number | null
  days_on_market: number | null
  expired_at: string | null
  standard_status: string | null
  contact_phone: string | null
  contact_email: string | null
  contact_source: string | null
  enrichment_notes: string | null
  created_at: string
  updated_at: string
}

/** List all expired listings (superuser only). */
export async function listExpiredListings(options?: {
  limit?: number
  offset?: number
  city?: string
}): Promise<{ rows: ExpiredListingRow[]; total: number }> {
  await requireSuperuser()
  void getServiceSupabase
  const limit = Math.min(Math.max(options?.limit ?? 100, 1), 500)
  const offset = Math.max(options?.offset ?? 0, 0)
  const { listExpiredListingsForAdmin } = await import('@/lib/data')
  const { rows, total } = await listExpiredListingsForAdmin({ limit, offset, city: options?.city ?? null })
  return { rows: rows as unknown as ExpiredListingRow[], total }
}

/** Update contact/enrichment fields (superuser only). */
export async function updateExpiredListingContact(
  id: string,
  updates: {
    owner_name?: string | null
    contact_phone?: string | null
    contact_email?: string | null
    contact_source?: string | null
    enrichment_notes?: string | null
  }
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireSuperuser()
  void getServiceSupabase
  const { updateExpiredListingById } = await import('@/lib/data')
  const res = await updateExpiredListingById(id, {
    ...updates,
    updated_at: new Date().toISOString(),
  })
  if (!res.ok) return { ok: false, error: res.error ?? 'update failed' }
  return { ok: true }
}

const EXPIRED_SELECT = `${SPARK_SELECT_FIELDS},OriginalListPrice,DaysOnMarket`.replace(/,,/g, ',')

/** Fetch expired/withdrawn listings from Spark and upsert into expired_listings. */
export async function fetchExpiredFromSpark(options?: {
  /** Fetch listings expired in the last N days (default 180 = ~6 months for backfill). */
  lastDays?: number
  /** Max pages to fetch (default 50). */
  maxPages?: number
}): Promise<{ ok: true; message: string; fetched: number; upserted: number } | { ok: false; error: string }> {
  await requireSuperuser()
  const lastDays = options?.lastDays ?? 180
  const maxPages = options?.maxPages ?? 50
  const since = new Date()
  since.setDate(since.getDate() - lastDays)
  const sinceStr = since.toISOString()

  const filter = `(StandardStatus eq 'Expired' or StandardStatus eq 'Withdrawn' or StandardStatus eq 'Cancelled' or StandardStatus eq 'Canceled') and ModificationTimestamp ge ${sinceStr}`
  const supabase = getServiceSupabase()
  let totalFetched = 0
  let nextUrl: string | null = null
  let pageCount = 0

  try {
    do {
      const result: Awaited<ReturnType<typeof fetchListings>> = nextUrl
        ? await fetchListings({ nextUrl, select: EXPIRED_SELECT })
        : await fetchListings({
            top: 200,
            filter,
            select: EXPIRED_SELECT,
            orderby: 'ModificationTimestamp asc',
          })
      const records = result.records ?? []
      for (const record of records) {
        await upsertExpiredListingFromSpark(supabase, record)
        totalFetched += 1
      }
      nextUrl = result.nextUrl
      pageCount += 1
    } while (nextUrl && pageCount < maxPages)

    return {
      ok: true,
      message: `Fetched ${totalFetched} expired/withdrawn listings from Spark (last ${lastDays} days) and upserted into expired_listings.`,
      fetched: totalFetched,
      upserted: totalFetched,
    }
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e)
    return { ok: false, error }
  }
}
