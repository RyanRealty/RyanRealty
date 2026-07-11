'use server'

import { createServiceClient } from '@/lib/supabase/service'
import { sendEmail } from '@/lib/resend'
import { getCachedSearchListings } from '@/app/actions/search-cache'
import type { ListingTileRow } from '@/app/actions/listings'
import { listingDetailPath } from '@/lib/slug'
import { buildSearchUrlFromFilters, getFiltersSummary, normalizeSavedSearchFilters } from '@/lib/search-filters'
import {
  getActiveListingAlertsDue,
  markListingAlertNotified,
  type ListingAlertRow,
} from '@/lib/data/leads/listingAlerts'
import { isHardStopped } from '@/lib/canonical-lead-tagger'
import { isSuppressedByEmail } from '@/lib/crm/suppressions'
import { attributeOutbound } from '@/lib/crm/attributed-links'
import { brokerSendIdentity } from '@/lib/email/broker-identity'
import { recordEmailEvent } from '@/lib/crm/email-events'
import { buildListingAlertEmail, type ListingAlertListing } from '@/lib/crm/listing-alert-email'
import {
  resolvePersonForTracking,
  linkAlertRowToPerson,
} from '@/lib/data/crm/resolvePersonForTracking'
import { findPersonByEmail } from '@/lib/followupboss'

/**
 * The ONE listing-alert send engine, over the unified public.listing_alerts
 * table. Replaces the old dual scan (runSavedSearchAlerts over saved_searches +
 * runGuestSearchAlerts over guest_search_alerts), which meant two queues, a
 * guest-capped/user-uncapped send asymmetry, and no cross-table dedupe (audit
 * foot-guns #1 and #3). Now: one most-overdue-first queue, one overall send
 * cap, one unsubscribe-token namespace, and DB-level (email, filters_hash)
 * dedupe.
 */

type AlertRunSummary = {
  scanned: number
  sent: number
  skipped: number
  errors: Array<{ searchId: string; error: string }>
}

/** Max listing cards in one alert email. Overflow becomes a "+N more" link. */
const MAX_LISTINGS_PER_EMAIL = 12

/**
 * Max EMAILS one run may send, across ALL alerts (scans are cheap — the
 * neighborhood defaults collapse to a few dozen cached filter sets — but each
 * send is a Resend call). Bounds the first-send wave of a mass rollout to a
 * smooth drip instead of a single burst that hurts deliverability.
 */
const MAX_SENDS_PER_RUN = 200

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

export async function runListingAlerts(options?: {
  maxAlerts?: number
  dryRun?: boolean
}): Promise<AlertRunSummary> {
  const now = new Date()
  const maxAlerts = Math.min(1000, Math.max(1, options?.maxAlerts ?? 120))
  const dryRun = options?.dryRun === true
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
  const runDate = now.toISOString().slice(0, 10)

  const supabase = createServiceClient()

  // Inactive rows are excluded in the DB — the cron never spends its scan
  // budget on rows that could not send. Most-overdue first (never-notified rows
  // lead) so the queue drains fairly across runs instead of newest-created rows
  // starving the rest.
  const rows: ListingAlertRow[] = await getActiveListingAlertsDue(maxAlerts)
  const summary: AlertRunSummary = { scanned: rows.length, sent: 0, skipped: 0, errors: [] }

  for (const row of rows) {
    try {
      // Send budget spent — stop scanning; the next cron run resumes with the
      // most-overdue rows (getActiveListingAlertsDue orders by last_notified_at).
      if (summary.sent >= MAX_SENDS_PER_RUN) break

      if (!shouldSendByFrequency(row, now)) {
        summary.skipped += 1
        continue
      }

      // Every due row that we DECIDE not to email (no new listings, prefs off,
      // hard-stop, suppression) still advances last_notified_at. The scan is
      // ordered most-overdue-first, so a due row that never advances would sit
      // at the front of every run and starve the rest of the queue. Advancing
      // on an empty check is also semantically right: "checked through <now>,
      // nothing new" — the next check only looks for listings after this stamp.
      const advanceCursor = async () => {
        if (!dryRun) await markListingAlertNotified(row.id, now.toISOString())
        summary.skipped += 1
      }

      // Compliance: skip anyone hard-stopped in FUB (do_not_email, unsubscribed,
      // bounced, realtor). The subscriber opted in, but a later FUB opt-out
      // wins. The row's fub_person_id is the strongest link; fall back to an
      // email lookup so signed-in rows without the legacy id still get the
      // check (this also resolves the ?_fuid stamp for click attribution).
      const fubPersonId = row.fub_person_id ?? (await findPersonByEmail(row.email))?.id ?? null
      if (fubPersonId && (await isHardStopped(fubPersonId))) {
        await advanceCursor()
        continue
      }

      // Signed-in subscribers can turn alert email off globally from
      // /account/notifications — honor profiles.notification_preferences.
      if (row.user_id) {
        const profileResp = await supabase
          .from('profiles')
          .select('notification_preferences')
          .eq('user_id', row.user_id)
          .maybeSingle()
        const prefs = (profileResp.data as { notification_preferences?: { emailEnabled?: boolean } } | null)?.notification_preferences
        if (prefs?.emailEnabled === false) {
          await advanceCursor()
          continue
        }
      }

      // Pass the FULL stored filters — getCachedSearchListings re-normalizes and
      // savedFiltersToAdvanced honors every key (amenities + ranges), so the match
      // is exactly the subscriber's search, not an over-broad subset.
      const filters = (row.filters ?? {}) as Record<string, unknown>
      // Empty-filter guard: a saved search whose normalized filters are empty
      // would match the whole feed and email every active listing. Skip + advance
      // (never blast) and log loudly so the bad row is visible.
      if (Object.keys(normalizeSavedSearchFilters(filters)).length === 0) {
        console.error('[runListingAlerts] skipping alert with empty filters', { searchId: row.id })
        await advanceCursor()
        continue
      }
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
            // The fast (listing_tile_mv) path carries OnMarketDate. The advanced
            // + keyword RPC paths do NOT return it, but DO return
            // ModificationTimestamp (spread onto the row), which is a sound
            // "new or materially changed since last send" proxy — so advanced
            // searches keep alerting incrementally instead of stopping or
            // re-blasting the whole set every run.
            const stamp = l.OnMarketDate ?? l.ModificationTimestamp
            const onMarket = stamp ? Date.parse(stamp) : NaN
            // FAIL-SAFE: if neither timestamp is present/parseable, treat the
            // listing as FRESH so the alert never goes permanently silent.
            // Worst case is a rare duplicate card, never a dead search.
            return !Number.isFinite(onMarket) || onMarket > sinceMs
          })
        : results.listings
      if (!fresh.length) {
        await advanceCursor()
        continue
      }

      // Open/click tracking identity: the row's crm_person_id when present,
      // else a case-insensitive email match with write-back (so the next send
      // is pre-linked). Unresolved sends untracked (attribution only) by design.
      const person = await resolvePersonForTracking({
        crmPersonId: row.crm_person_id,
        email: row.email,
      })
      if (!dryRun && person.personId && person.resolvedBy === 'email') {
        await linkAlertRowToPerson(row.id, person.personId)
      }

      const topRows = fresh.slice(0, MAX_LISTINGS_PER_EMAIL)
      const label = row.name?.trim() || 'your search'
      const browseAllUrl = withUtm(`${siteUrl}${buildSearchUrlFromFilters(filters)}`)
      const unsubscribeUrl = `${siteUrl}/alerts/unsubscribe?token=${encodeURIComponent(row.unsubscribe_token)}`
      // RFC 8058 one-click target for the List-Unsubscribe header (route handler
      // POST), separate from the page link above so a provider's one-click POST
      // gets a 2xx instead of the page Server Action's 403.
      const oneClickUrl = `${siteUrl}/api/alerts/unsubscribe?token=${encodeURIComponent(row.unsubscribe_token)}`

      const built = buildListingAlertEmail({
        searchName: label,
        filtersSummary: getFiltersSummary(filters),
        listings: topRows.map((listing) => toAlertListing(listing, siteUrl)),
        totalNewCount: fresh.length,
        browseAllUrl,
        unsubscribeUrl,
        // Signed-in subscribers manage their alerts from /account; guests only
        // have the token unsubscribe link.
        manageUrl: row.user_id ? `${siteUrl}/account/saved-searches` : null,
      })

      // Broker attribution (?agent= / ?_fuid=) + open/click instrumentation on
      // the FINAL HTML — exactly once, after the body is fully built. When no
      // person resolved, attributeOutbound applies attribution only (no
      // tracking wrapper) by design. Unsubscribe links stay unwrapped.
      const brokerSlug = person.assignedBroker ?? DEFAULT_BROKER
      const emailKey = `listing-alert:${row.id}:${runDate}`
      const finalHtml = attributeOutbound(built.html, {
        brokerSlug,
        personId: person.personId,
        fubPersonId: person.fubPersonId ?? fubPersonId,
        emailKey,
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
        // Named broker sender + monitored reply-to (lib/email/broker-identity):
        // a reply to an alert must reach the assigned broker, never noreply@.
        const identity = brokerSendIdentity(brokerSlug)
        const emailResult = await sendEmail({
          to: row.email,
          from: identity.from,
          replyTo: identity.replyTo,
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
        // Measurement, mirror of the market-report send path: one 'sent' row in
        // email_events per send, keyed on the SAME emailKey the tracker signs
        // into the open/click tokens so per-subscription engagement aggregates.
        // Best-effort: a reporting-side failure (even a throw) must NEVER abort
        // the notified stamp below, or the row stays due and re-sends every tick.
        try {
          await recordEmailEvent({
            messageId: emailResult.id ?? null,
            recipientEmail: row.email,
            personId: person.personId,
            broker: brokerSlug,
            sendType: 'alert',
            event: 'sent',
            emailKey,
            subject: built.subject,
          })
        } catch (recErr) {
          console.error('[runListingAlerts] recordEmailEvent failed (send already went out)', {
            searchId: row.id,
            error: recErr instanceof Error ? recErr.message : String(recErr),
          })
        }
        const marked = await markListingAlertNotified(row.id, now.toISOString())
        if (!marked.ok) {
          // The email already went out. If we cannot stamp last_notified_at the
          // row stays due and would re-blast the SAME email next tick. We cannot
          // repair the DB from here, but we log loudly, record the error, and
          // still advance the in-run cursor (count the send below) so this run
          // does not compound the duplicate risk.
          console.error('[runListingAlerts] markListingAlertNotified failed AFTER a successful send (duplicate risk next run)', {
            searchId: row.id,
            error: marked.error ?? 'mark failed',
          })
          summary.errors.push({ searchId: row.id, error: marked.error ?? 'mark failed' })
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
