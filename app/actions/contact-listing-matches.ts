'use server'

/**
 * Send a CRM contact the current listings that match a saved search, and set up
 * the recurring alert in the same step (Matt's "attach + send matches now").
 *
 * One explicit action:
 *   1. Upsert a broker-origin saved search on public.listing_alerts (idempotent)
 *      so the contact keeps getting matches on cadence (the existing cron rail).
 *   2. Email the current top matches right now through the branded listing-alert
 *      template, suppression-gated (fails closed), attributed + instrumented,
 *      logged as email_out on the contact's timeline.
 *
 * If nothing matches today, the search is still saved and nothing is emailed.
 */

import { revalidatePath } from 'next/cache'
import { getCrmAccess, requirePersonInScope } from '@/app/actions/crm'
import { getContactSendTarget } from '@/lib/data/crm/getContactSendTarget'
import { getCachedSearchListings } from '@/app/actions/search-cache'
import { listingDetailPath } from '@/lib/slug'
import {
  normalizeSavedSearchFilters,
  getSavedSearchHash,
  getFilterNameFallback,
  getFiltersSummary,
  buildSearchUrlFromFilters,
} from '@/lib/search-filters'
import {
  createListingAlertForLead,
  getListingAlertsForLead,
  markListingAlertNotified,
} from '@/lib/data/leads/listingAlerts'
import { buildListingAlertEmail, type ListingAlertListing } from '@/lib/crm/listing-alert-email'
import { attributeOutbound } from '@/lib/crm/attributed-links'
import { isSuppressed } from '@/lib/crm/suppressions'
import { prepareDeliverableEmail } from '@/lib/email/prepare'
import { sendEmail } from '@/lib/resend'
import { logCmaTimelineEvent } from '@/lib/data'

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')

export type SendListingMatchesResult =
  | { ok: true; sentCount: number; message: string }
  | { ok: false; error: string }

export async function sendListingMatchesForContactAction(
  personId: number,
  filtersJson: string,
  opts?: { name?: string | null; frequency?: 'daily' | 'weekly' },
): Promise<SendListingMatchesResult> {
  try {
    if (!Number.isFinite(personId) || personId <= 0) return { ok: false, error: 'A valid contact id is required' }
    const access = await getCrmAccess()
    if (!access) return { ok: false, error: 'Unauthorized' }
    const scoped = await requirePersonInScope(personId, access)
    if (!scoped.ok) return { ok: false, error: scoped.error }

    const target = await getContactSendTarget(personId)
    if (!target?.email) return { ok: false, error: 'No email on file for this contact. Add one before sending.' }

    let raw: Record<string, unknown> = {}
    try {
      raw = JSON.parse(filtersJson || '{}')
    } catch {
      raw = {}
    }
    const filters = normalizeSavedSearchFilters(raw)
    if (Object.keys(filters).length === 0) {
      return { ok: false, error: 'Add at least one filter (city, price, or beds) so the search is not the whole MLS.' }
    }
    const filtersHash = getSavedSearchHash(filters)
    const name = opts?.name?.trim() || getFilterNameFallback(filters)
    const frequency = opts?.frequency === 'daily' ? ('daily' as const) : ('weekly' as const)

    // 1. Attach (idempotent) — mints the row + unsubscribe token, keeps cadence.
    const attach = await createListingAlertForLead({
      email: target.email,
      fubPersonId: target.fubPersonId,
      crmPersonId: personId,
      name,
      filters,
      filtersHash,
      origin: 'broker',
      assignedBy: access.email,
      frequency,
    })
    if (!attach.ok) return { ok: false, error: `Could not save the search: ${attach.error ?? 'unknown error'}` }

    const rows = await getListingAlertsForLead({ crmPersonId: personId, emails: [target.email] })
    const alertRow = rows.find((r) => r.filters_hash === filtersHash) ?? null

    // 2. Current matches.
    const results = await getCachedSearchListings(filters, 1, 12)
    const listings: ListingAlertListing[] = results.listings.map((row) => {
      const path = listingDetailPath(String(row.ListingKey ?? ''), {
        streetNumber: row.StreetNumber,
        streetName: row.StreetName,
        city: row.City,
        state: row.State,
      })
      const address = [row.StreetNumber, row.StreetName].filter(Boolean).join(' ').trim()
      return {
        address: address || 'New listing',
        city: row.City,
        price: row.ListPrice != null ? Number(row.ListPrice) : null,
        beds: row.BedroomsTotal,
        baths: row.BathroomsTotal,
        sqft: row.TotalLivingAreaSqFt ?? null,
        photoUrl: row.PhotoURL,
        detailUrl: path ? `${SITE_URL}${path}` : `${SITE_URL}/homes-for-sale`,
        status: row.StandardStatus ?? null,
      }
    })

    if (listings.length === 0) {
      revalidatePath(`/admin/console/leads/${personId}`)
      revalidatePath(`/admin/crm/${personId}`)
      return {
        ok: true,
        sentCount: 0,
        message: `Saved search "${name}" is set up. Nothing matches right now, so no email went out. Matches will send on the ${frequency} cadence.`,
      }
    }

    // Suppression (fails closed).
    const sup = await isSuppressed(personId, 'email')
    if (sup.suppressed) {
      return {
        ok: false,
        error: `Search saved, but the contact has opted out of email (${sup.reasons.join(', ')}), so matches were not sent.`,
      }
    }

    const token = alertRow?.unsubscribe_token ?? null
    const unsubscribeUrl = token
      ? `${SITE_URL}/alerts/unsubscribe?token=${encodeURIComponent(token)}`
      : `${SITE_URL}/account/saved-searches`
    const oneClickUrl = token ? `${SITE_URL}/api/alerts/unsubscribe?token=${encodeURIComponent(token)}` : null

    const built = buildListingAlertEmail({
      searchName: name,
      filtersSummary: getFiltersSummary(filters),
      listings,
      totalNewCount: listings.length,
      browseAllUrl: `${SITE_URL}${buildSearchUrlFromFilters(filters)}`,
      unsubscribeUrl,
      manageUrl: null,
    })

    const brokerSlug = target.assignedBroker ?? access.brokerSlug ?? 'matt'
    const finalHtml = attributeOutbound(built.html, {
      brokerSlug,
      personId,
      fubPersonId: target.fubPersonId ?? undefined,
      emailKey: `listing-alert:sendnow:${filtersHash}`,
      label: built.subject,
      broker: brokerSlug,
    })

    // CAN-SPAM preflight: multipart + postal footer + deliverability scoring,
    // with the saved-search-specific unsubscribe page as the footer target.
    const prepared = prepareDeliverableEmail({
      subject: built.subject,
      html: finalHtml,
      text: built.text,
      personId,
      unsubscribeUrl,
    })
    const emailResult = await sendEmail({
      to: target.email,
      subject: prepared.subject,
      // RFC 8058 one-click POST endpoint wins the header over the page URL.
      headers: oneClickUrl
        ? { ...prepared.headers, 'List-Unsubscribe': `<${oneClickUrl}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' }
        : prepared.headers,
      html: prepared.html,
      text: prepared.text,
    })
    if (emailResult.error) return { ok: false, error: `Search saved, but the email failed: ${emailResult.error}` }

    if (alertRow?.id) await markListingAlertNotified(alertRow.id, new Date().toISOString()).catch(() => {})
    await logCmaTimelineEvent(personId, {
      kind: 'email_out',
      title: built.subject,
      body: `Sent ${listings.length} listing match${listings.length === 1 ? '' : 'es'} for "${name}" to ${target.email}.`,
      broker: brokerSlug,
      dedupeKey: `listing-sendnow:${filtersHash}:${new Date().toISOString().slice(0, 10)}`,
      payload: { filtersHash, count: listings.length },
    })

    revalidatePath(`/admin/console/leads/${personId}`)
    revalidatePath(`/admin/crm/${personId}`)
    return {
      ok: true,
      sentCount: listings.length,
      message: `Saved search "${name}" set up, and ${listings.length} current match${listings.length === 1 ? '' : 'es'} emailed to ${target.email}.`,
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unexpected error sending listing matches' }
  }
}
