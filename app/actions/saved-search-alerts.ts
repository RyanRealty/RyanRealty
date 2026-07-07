'use server'

import { createServiceClient } from '@/lib/supabase/service'
import { sendEmail } from '@/lib/resend'
import { getCachedSearchListings } from '@/app/actions/search-cache'
import type { ListingTileRow } from '@/app/actions/listings'
import { listingDetailPath } from '@/lib/slug'
import { buildSearchUrlFromFilters, getFiltersSummary } from '@/lib/search-filters'
import { getActiveGuestSearchAlerts, markGuestAlertNotified } from '@/lib/data/leads/guestSearchAlerts'
import { isHardStopped } from '@/lib/canonical-lead-tagger'
import { isSuppressedByEmail } from '@/lib/crm/suppressions'
import { attributeOutbound } from '@/lib/crm/attributed-links'
import { buildListingAlertEmail, type ListingAlertListing } from '@/lib/crm/listing-alert-email'
import {
  resolvePersonForTracking,
  getGuestAlertPersonLinks,
  linkAlertRowToPerson,
} from '@/lib/data/crm/resolvePersonForTracking'
import { findPersonByEmail } from '@/lib/followupboss'

type SavedSearchAlertRow = {
  id: string
  user_id: string
  name: string | null
  filters: Record<string, unknown> | null
  notification_frequency: string | null
  is_paused: boolean | null
  last_notified_at: string | null
  unsubscribe_token: string | null
  crm_person_id: number | null
}

type AlertRunSummary = {
  scanned: number
  sent: number
  skipped: number
  errors: Array<{ searchId: string; error: string }>
}

/** Max listing cards in one alert email. Overflow becomes a "+N more" link. */
const MAX_LISTINGS_PER_EMAIL = 12

/**
 * Max EMAILS one guest-alert run may send (scans are cheap — the neighborhood
 * defaults collapse to a few dozen cached filter sets — but each send is a
 * Resend call). Bounds the first-send wave of a mass rollout to a smooth
 * drip instead of a single burst that hurts deliverability.
 */
const MAX_GUEST_SENDS_PER_RUN = 200

/**
 * Default broker slug when the recipient has no assigned_broker — same desk
 * default as lib/crm/market-report-send.ts DEFAULT_BROKER.
 */
const DEFAULT_BROKER = 'matt'

function normalizeFrequency(raw: string | null | undefined): 'instant' | 'daily' | 'weekly' {
  const value = (raw ?? '').trim().toLowerCase()
  if (value === 'instant') return 'instant'
  if (value === 'weekly') return 'weekly'
  return 'daily'
}

function shouldSendByFrequency(
  search: { notification_frequency: string | null; last_notified_at: string | null },
  now: Date,
): boolean {
  const freq = normalizeFrequency(search.notification_frequency)
  if (!search.last_notified_at) return true
  const last = new Date(search.last_notified_at)
  const elapsedMs = now.getTime() - last.getTime()
  if (freq === 'instant') return elapsedMs >= 6 * 60 * 60 * 1000
  if (freq === 'weekly') return elapsedMs >= 7 * 24 * 60 * 60 * 1000
  return elapsedMs >= 24 * 60 * 60 * 1000
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

/**
 * Plain UTM stamping so GA4 attributes the session to the alert email as a
 * traffic source. Broker attribution (?agent=) and ?_fuid= are NOT added here —
 * attributeOutbound stamps them on the final HTML, and stamping twice would
 * double-encode. Unsubscribe links never pass through this.
 */
function withUtm(url: string): string {
  const params = new URLSearchParams({
    utm_source: 'ryan-realty',
    utm_medium: 'email',
    utm_campaign: 'listing-alerts',
  })
  return `${url}${url.includes('?') ? '&' : '?'}${params.toString()}`
}

/** Map a search-cache listing row to the email builder's card shape. */
function toAlertListing(row: ListingTileRow, siteUrl: string): ListingAlertListing {
  const path = buildListingUrl(row)
  const address = [row.StreetNumber, row.StreetName].filter(Boolean).join(' ').trim()
  return {
    address: address || 'New listing',
    city: row.City,
    price: row.ListPrice != null ? Number(row.ListPrice) : null,
    beds: row.BedroomsTotal,
    baths: row.BathroomsTotal,
    sqft: row.TotalLivingAreaSqFt ?? null,
    photoUrl: row.PhotoURL,
    detailUrl: withUtm(path ? `${siteUrl}${path}` : `${siteUrl}/homes-for-sale`),
    status: row.StandardStatus ?? null,
  }
}

export async function runSavedSearchAlerts(options?: {
  maxSearches?: number
  dryRun?: boolean
}): Promise<AlertRunSummary> {
  const now = new Date()
  const maxSearches = Math.min(500, Math.max(1, options?.maxSearches ?? 120))
  const dryRun = options?.dryRun === true
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
  const runDate = now.toISOString().slice(0, 10)

  const supabase = createServiceClient()
  // Paused rows are excluded in the DB (null counts as not paused) — the cron
  // never spends its scan budget on rows that could not send.
  const { data: searchesRaw, error: searchesError } = await supabase
    .from('saved_searches')
    .select('id, user_id, name, filters, notification_frequency, is_paused, last_notified_at, unsubscribe_token, crm_person_id')
    .or('is_paused.is.null,is_paused.eq.false')
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
      if (!shouldSendByFrequency(search, now)) {
        summary.skipped += 1
        continue
      }

      const filters = (search.filters ?? {}) as Record<string, unknown>
      // Full stored filters (getCachedSearchListings re-normalizes + honors every key).
      const results = await getCachedSearchListings(filters, 1, 15)
      if (!results.listings.length) {
        summary.skipped += 1
        continue
      }

      // Only NEW listings since the last send (first send includes current matches).
      const sinceMs = search.last_notified_at ? Date.parse(search.last_notified_at) : 0
      const fresh = sinceMs
        ? results.listings.filter((l) => {
            const onMarket = l.OnMarketDate ? Date.parse(l.OnMarketDate) : NaN
            return Number.isFinite(onMarket) && onMarket > sinceMs
          })
        : results.listings
      if (!fresh.length) {
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

      // Resolve the FUB id (by account email) so email-click links log
      // "Visited Website" + "Viewed Property" on their FUB timeline. This is
      // also the recipient id used for the compliance check below.
      const fuid = (await findPersonByEmail(toEmail))?.id ?? null

      // Compliance (mirror the guest path): skip anyone hard-stopped or
      // suppressed for email. The signed-in account opted in, but a later
      // opt-out / suppression / protected compliance tag wins. Fails closed.
      if (fuid && (await isHardStopped(fuid))) {
        summary.skipped += 1
        continue
      }
      if ((await isSuppressedByEmail(toEmail, 'email')).suppressed) {
        summary.skipped += 1
        continue
      }

      // Open/click tracking identity: the row's crm_person_id when present,
      // else a case-insensitive email match (then write the link back so the
      // next send is pre-linked). Unresolved sends untracked by design.
      const person = await resolvePersonForTracking({
        crmPersonId: search.crm_person_id,
        email: toEmail,
      })
      if (!dryRun && person.personId && person.resolvedBy === 'email') {
        await linkAlertRowToPerson('saved_searches', search.id, person.personId)
      }

      const topRows = fresh.slice(0, MAX_LISTINGS_PER_EMAIL)
      const label = search.name?.trim() || 'your saved search'
      const browseAllUrl = withUtm(`${siteUrl}${buildSearchUrlFromFilters(filters)}`)
      const unsubscribeUrl = `${siteUrl}/alerts/unsubscribe?token=${encodeURIComponent(search.unsubscribe_token ?? '')}`
      // RFC 8058 one-click target for the List-Unsubscribe header (route handler
      // POST), separate from the page link above so a provider's one-click POST
      // gets a 2xx instead of the page Server Action's 403.
      const oneClickUrl = `${siteUrl}/api/alerts/unsubscribe?token=${encodeURIComponent(search.unsubscribe_token ?? '')}`

      const built = buildListingAlertEmail({
        searchName: label,
        filtersSummary: getFiltersSummary(filters),
        listings: topRows.map((row) => toAlertListing(row, siteUrl)),
        totalNewCount: fresh.length,
        browseAllUrl,
        unsubscribeUrl,
        manageUrl: `${siteUrl}/account/saved-searches`,
      })

      // Broker attribution (?agent= / ?_fuid=) + open/click instrumentation on
      // the FINAL HTML — exactly once, after the body is fully built. When no
      // person resolved, attributeOutbound applies attribution only (no
      // tracking wrapper) by design. Unsubscribe links stay unwrapped.
      const brokerSlug = person.assignedBroker ?? DEFAULT_BROKER
      const finalHtml = attributeOutbound(built.html, {
        brokerSlug,
        personId: person.personId,
        fubPersonId: person.fubPersonId ?? fuid,
        emailKey: `listing-alert:${search.id}:${runDate}`,
        label: built.subject,
        broker: brokerSlug,
      })

      if (!dryRun) {
        // Final suppression gate in the send scope (fails closed). Redundant
        // with the skip above, kept so the send is gated in its own scope.
        if ((await isSuppressedByEmail(toEmail, 'email')).suppressed) {
          summary.skipped += 1
          continue
        }
        const emailResult = await sendEmail({
          to: toEmail,
          subject: built.subject,
          headers: search.unsubscribe_token
            ? { 'List-Unsubscribe': `<${oneClickUrl}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' }
            : undefined,
          html: finalHtml,
          text: built.text,
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

/**
 * Guest (anonymous) listing-alert sender — the public-capture counterpart to
 * runSavedSearchAlerts. Reads guest_search_alerts (via the DAL) and emails the
 * stored address directly (there is no auth user), with a token unsubscribe
 * link. The signed-in path above is untouched; this reuses the same listings-
 * match + email helpers.
 */
export async function runGuestSearchAlerts(options?: {
  maxAlerts?: number
  dryRun?: boolean
}): Promise<AlertRunSummary> {
  const now = new Date()
  const maxAlerts = Math.min(1000, Math.max(1, options?.maxAlerts ?? 120))
  const dryRun = options?.dryRun === true
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
  const runDate = now.toISOString().slice(0, 10)

  const rows = await getActiveGuestSearchAlerts(maxAlerts)
  const summary: AlertRunSummary = { scanned: rows.length, sent: 0, skipped: 0, errors: [] }

  // The DAL's cron projection predates the crm_person_id bridge column — fetch
  // the linkage for this batch in one DAL query.
  const personLinkByRowId = await getGuestAlertPersonLinks(rows.map((r) => r.id))

  for (const row of rows) {
    try {
      // Send budget spent — stop scanning; the next cron run resumes with the
      // most-overdue rows (getActiveGuestSearchAlerts orders by last_notified_at).
      if (summary.sent >= MAX_GUEST_SENDS_PER_RUN) break

      if (!shouldSendByFrequency(row, now)) {
        summary.skipped += 1
        continue
      }

      // Every due row that we DECIDE not to email (no new listings, hard-stop,
      // suppression) still advances last_notified_at. The scan is ordered
      // most-overdue-first, so a due row that never advances would sit at the
      // front of every run and starve the rest of the queue. Advancing on an
      // empty check is also semantically right: "checked through <now>, nothing
      // new" — the next check only looks for listings after this stamp.
      const advanceCursor = async () => {
        if (!dryRun) await markGuestAlertNotified(row.id, now.toISOString())
        summary.skipped += 1
      }

      // Compliance: skip anyone hard-stopped in FUB (do_not_email, unsubscribed,
      // bounced, realtor). The guest opted in, but a later FUB opt-out wins.
      if (row.fub_person_id && (await isHardStopped(row.fub_person_id))) {
        await advanceCursor()
        continue
      }

      // Pass the FULL stored filters — getCachedSearchListings re-normalizes and
      // savedFiltersToAdvanced honors every key (amenities + ranges), so the match
      // is exactly the guest's search, not an over-broad subset.
      const filters = (row.filters ?? {}) as Record<string, unknown>
      const results = await getCachedSearchListings(filters, 1, 15)
      if (!results.listings.length) {
        await advanceCursor()
        continue
      }

      // Only email listings that are NEW since the last send so a standing search
      // never re-sends the same homes. First send (no last_notified_at) includes
      // the current top matches.
      const sinceMs = row.last_notified_at ? Date.parse(row.last_notified_at) : 0
      const fresh = sinceMs
        ? results.listings.filter((l) => {
            const onMarket = l.OnMarketDate ? Date.parse(l.OnMarketDate) : NaN
            return Number.isFinite(onMarket) && onMarket > sinceMs
          })
        : results.listings
      if (!fresh.length) {
        await advanceCursor()
        continue
      }

      // Open/click tracking identity: the row's crm_person_id when present,
      // else a case-insensitive email match with write-back. Unresolved sends
      // untracked (attribution only) by design.
      const person = await resolvePersonForTracking({
        crmPersonId: personLinkByRowId.get(row.id) ?? null,
        email: row.email,
      })
      if (!dryRun && person.personId && person.resolvedBy === 'email') {
        await linkAlertRowToPerson('guest_search_alerts', row.id, person.personId)
      }

      const topRows = fresh.slice(0, MAX_LISTINGS_PER_EMAIL)
      const label = row.name?.trim() || 'your search'
      const browseAllUrl = withUtm(`${siteUrl}${buildSearchUrlFromFilters(filters)}`)
      const unsubscribeUrl = `${siteUrl}/alerts/unsubscribe?token=${encodeURIComponent(row.unsubscribe_token)}`
      // One-click List-Unsubscribe target (see runSavedSearchAlerts note above).
      const oneClickUrl = `${siteUrl}/api/alerts/unsubscribe?token=${encodeURIComponent(row.unsubscribe_token)}`

      const built = buildListingAlertEmail({
        searchName: label,
        filtersSummary: getFiltersSummary(filters),
        listings: topRows.map((listing) => toAlertListing(listing, siteUrl)),
        totalNewCount: fresh.length,
        browseAllUrl,
        unsubscribeUrl,
      })

      const brokerSlug = person.assignedBroker ?? DEFAULT_BROKER
      const finalHtml = attributeOutbound(built.html, {
        brokerSlug,
        personId: person.personId,
        fubPersonId: person.fubPersonId ?? row.fub_person_id,
        emailKey: `listing-alert:${row.id}:${runDate}`,
        label: built.subject,
        broker: brokerSlug,
      })

      if (!dryRun) {
        // Suppression gate in the send scope (fails closed) — alongside the
        // isHardStopped check above, covers email-keyed opt-outs + protected tags.
        if ((await isSuppressedByEmail(row.email, 'email')).suppressed) {
          await advanceCursor()
          continue
        }
        const emailResult = await sendEmail({
          to: row.email,
          subject: built.subject,
          headers: {
            'List-Unsubscribe': `<${oneClickUrl}>`,
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
          },
          html: finalHtml,
          text: built.text,
        })
        if (emailResult.error) {
          summary.errors.push({ searchId: row.id, error: emailResult.error })
          continue
        }
        const marked = await markGuestAlertNotified(row.id, now.toISOString())
        if (!marked.ok) {
          summary.errors.push({ searchId: row.id, error: marked.error ?? 'mark failed' })
          continue
        }
      }

      summary.sent += 1
    } catch (error) {
      summary.errors.push({
        searchId: row.id,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return summary
}
