'use server'

import { createServiceClient } from '@/lib/supabase/service'
import { sendEmail } from '@/lib/resend'
import { getListingsWithAdvanced } from '@/app/actions/listings'
import { listingDetailPath } from '@/lib/slug'

type SavedSearchAlertRow = {
  id: string
  user_id: string
  name: string | null
  filters: Record<string, unknown> | null
  notification_frequency: string | null
  is_paused: boolean | null
  last_notified_at: string | null
}

type AlertRunSummary = {
  scanned: number
  sent: number
  skipped: number
  errors: Array<{ searchId: string; error: string }>
}

function normalizeFrequency(raw: string | null | undefined): 'instant' | 'daily' | 'weekly' {
  const value = (raw ?? '').trim().toLowerCase()
  if (value === 'instant') return 'instant'
  if (value === 'weekly') return 'weekly'
  return 'daily'
}

function shouldSendByFrequency(search: SavedSearchAlertRow, now: Date): boolean {
  const freq = normalizeFrequency(search.notification_frequency)
  if (!search.last_notified_at) return true
  const last = new Date(search.last_notified_at)
  const elapsedMs = now.getTime() - last.getTime()
  if (freq === 'instant') return elapsedMs >= 6 * 60 * 60 * 1000
  if (freq === 'weekly') return elapsedMs >= 7 * 24 * 60 * 60 * 1000
  return elapsedMs >= 24 * 60 * 60 * 1000
}

function parseNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return undefined
}

function parseString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed || undefined
}

function buildListingUrl(row: {
  ListingKey: string | null
  ListNumber?: string | null
  StreetNumber: string | null
  StreetName: string | null
  City: string | null
  State: string | null
  PostalCode: string | null
  SubdivisionName: string | null
}): string | null {
  const key = (row.ListingKey ?? row.ListNumber ?? '').toString().trim()
  if (!key) return null
  return listingDetailPath(
    key,
    {
      streetNumber: row.StreetNumber,
      streetName: row.StreetName,
      city: row.City,
      state: row.State,
      postalCode: row.PostalCode,
    },
    { city: row.City, subdivision: row.SubdivisionName },
    { mlsNumber: row.ListNumber ?? null }
  )
}

export async function runSavedSearchAlerts(options?: {
  maxSearches?: number
  dryRun?: boolean
}): Promise<AlertRunSummary> {
  const now = new Date()
  const maxSearches = Math.min(500, Math.max(1, options?.maxSearches ?? 120))
  const dryRun = options?.dryRun === true
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')

  const supabase = createServiceClient()
  const { data: searchesRaw, error: searchesError } = await supabase
    .from('saved_searches')
    .select('id, user_id, name, filters, notification_frequency, is_paused, last_notified_at')
    .order('created_at', { ascending: false })
    .limit(maxSearches)
  if (searchesError) {
    return {
      scanned: 0,
      sent: 0,
      skipped: 0,
      errors: [{ searchId: 'saved_searches', error: searchesError.message }],
    }
  }

  const searches = (searchesRaw ?? []) as SavedSearchAlertRow[]
  const summary: AlertRunSummary = { scanned: searches.length, sent: 0, skipped: 0, errors: [] }

  for (const search of searches) {
    try {
      if (search.is_paused) {
        summary.skipped += 1
        continue
      }
      if (!shouldSendByFrequency(search, now)) {
        summary.skipped += 1
        continue
      }

      const filters = (search.filters ?? {}) as Record<string, unknown>
      const results = await getListingsWithAdvanced({
        city: parseString(filters.city),
        subdivision: parseString(filters.subdivision),
        minPrice: parseNumber(filters.minPrice),
        maxPrice: parseNumber(filters.maxPrice),
        minBeds: parseNumber(filters.beds),
        minBaths: parseNumber(filters.baths),
        minSqFt: parseNumber(filters.minSqFt),
        propertyType: parseString(filters.propertyType),
        statusFilter: parseString(filters.statusFilter) as 'active' | 'pending' | 'closed' | 'all' | undefined,
        keywords: parseString(filters.keywords),
        postalCode: parseString(filters.postalCode),
        limit: 5,
        offset: 0,
        sort: 'newest',
      })
      if (!results.listings.length) {
        summary.skipped += 1
        continue
      }

      const profileResp = await supabase
        .from('profiles')
        .select('notification_preferences')
        .eq('user_id', search.user_id)
        .maybeSingle()
      const prefs = (profileResp.data as { notification_preferences?: { emailEnabled?: boolean } } | null)?.notification_preferences
      if (prefs?.emailEnabled === false) {
        summary.skipped += 1
        continue
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const userResp = await (supabase as any).auth.admin.getUserById(search.user_id)
      const toEmail = userResp?.data?.user?.email?.trim()
      if (!toEmail) {
        summary.skipped += 1
        continue
      }

      const topRows = results.listings.slice(0, 3)
      const bodyLines = topRows.map((row, index) => {
        const path = buildListingUrl(row)
        const url = path ? `${siteUrl}${path}` : `${siteUrl}/homes-for-sale`
        const address = [row.StreetNumber, row.StreetName, row.City].filter(Boolean).join(' ')
        const price = row.ListPrice != null ? `$${Math.round(Number(row.ListPrice)).toLocaleString()}` : 'Price on request'
        return `${index + 1}. ${address || 'Listing'} — ${price}\n${url}`
      })

      if (!dryRun) {
        const emailResult = await sendEmail({
          to: toEmail,
          subject: `New listings for ${search.name?.trim() || 'your saved search'}`,
          text: [
            `We found new listings matching ${search.name?.trim() || 'your saved search'}.`,
            '',
            ...bodyLines,
            '',
            `Manage alerts: ${siteUrl}/account/saved-searches`,
          ].join('\n'),
        })
        if (emailResult.error) {
          summary.errors.push({ searchId: search.id, error: emailResult.error })
          continue
        }

        const { error: updateError } = await supabase
          .from('saved_searches')
          .update({ last_notified_at: now.toISOString() })
          .eq('id', search.id)
        if (updateError) {
          summary.errors.push({ searchId: search.id, error: updateError.message })
          continue
        }
      }

      summary.sent += 1
    } catch (error) {
      summary.errors.push({
        searchId: search.id,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return summary
}
