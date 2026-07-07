'use server'

/**
 * Admin server actions for the unified Subscriptions hub
 * (/admin/crm/subscriptions). Thin, admin-gated wrappers over
 * lib/data/crm/subscriptionsAdmin.ts (the DAL owns every raw table read).
 *
 * Access: any CRM admin (getCrmAccess). These manage delivery PREFERENCES.
 * Actual sends stay suppression-gated at the cron chokepoints, and every
 * outbound email carries open/click tracking via attributeOutbound.
 */

import { getCrmAccess } from '@/app/actions/crm'
import {
  listGuestAlertSubscriptions,
  listUserSavedSearches,
  bulkUpdateAlertSubscriptions,
  bulkDeleteAlertSubscriptions,
  listReportSubscriptionsAdmin,
  bulkUpdateReportSubscriptions,
  getAlertSubscriptionById,
  updateAlertSubscription,
  getReportSubscriptionByPersonId,
  updateReportSubscription,
  deleteReportSubscription,
  setPersonAssignedBroker,
  type ListAlertSubscriptionsOptions,
  type ListAlertSubscriptionsResult,
  type ListReportSubscriptionsOptions,
  type AdminReportSubscriptionRow,
  type AlertSubscriptionKind,
} from '@/lib/data/crm/subscriptionsAdmin'
import { getCrmBrokers } from '@/lib/data/crm/getCrmBrokers'
import { getCrmReportAreas } from '@/lib/data/crm/getCrmReportAreas'
import { getMarketReportData } from '@/lib/data/crm/getMarketReportData'
import { renderMarketReportEmail } from '@/lib/crm/market-report-email'
import { buildUnsubscribeUrl } from '@/lib/email/unsubscribe-token'
import { buildListingAlertEmail, type ListingAlertListing } from '@/lib/crm/listing-alert-email'
import { getCachedSearchListings } from '@/app/actions/search-cache'
import type { ListingTileRow } from '@/app/actions/listings'
import { listingDetailPath } from '@/lib/slug'
import {
  normalizeSavedSearchFilters,
  getSavedSearchHash,
  buildSearchUrlFromFilters,
  getFiltersSummary,
} from '@/lib/search-filters'

const MAX_BULK_IDS = 500
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')

function cleanIds(ids: unknown): string[] {
  if (!Array.isArray(ids)) return []
  return [...new Set(ids.filter((v): v is string => typeof v === 'string' && v.trim().length > 0))].slice(0, MAX_BULK_IDS)
}

export async function listAlertSubscriptionsAction(
  opts: ListAlertSubscriptionsOptions & { kind: AlertSubscriptionKind },
): Promise<{ data: ListAlertSubscriptionsResult | null, error: string | null }> {
  try {
    const access = await getCrmAccess()
    if (!access) return { data: null, error: 'Unauthorized' }
    const data = opts.kind === 'guest'
      ? await listGuestAlertSubscriptions(opts)
      : await listUserSavedSearches(opts)
    return { data, error: null }
  } catch (err) {
    console.error('[listAlertSubscriptionsAction]', err)
    return { data: null, error: 'Could not load listing alerts' }
  }
}

export async function bulkUpdateAlertSubscriptionsAction(
  kind: AlertSubscriptionKind,
  ids: string[],
  patch: { active?: boolean, frequency?: 'daily' | 'weekly' },
): Promise<{ data: { updated: number } | null, error: string | null }> {
  try {
    const access = await getCrmAccess()
    if (!access) return { data: null, error: 'Unauthorized' }
    const clean = cleanIds(ids)
    if (clean.length === 0) return { data: null, error: 'Select at least one alert' }
    const sanitized: { active?: boolean, frequency?: 'daily' | 'weekly' } = {}
    if (typeof patch?.active === 'boolean') sanitized.active = patch.active
    if (patch?.frequency === 'daily' || patch?.frequency === 'weekly') sanitized.frequency = patch.frequency
    if (Object.keys(sanitized).length === 0) return { data: null, error: 'Nothing to change' }
    const { updated, error } = await bulkUpdateAlertSubscriptions(kind, clean, sanitized)
    if (error) return { data: null, error }
    return { data: { updated }, error: null }
  } catch (err) {
    console.error('[bulkUpdateAlertSubscriptionsAction]', err)
    return { data: null, error: 'Could not update those alerts' }
  }
}

export async function bulkDeleteAlertSubscriptionsAction(
  kind: AlertSubscriptionKind,
  ids: string[],
): Promise<{ data: { deleted: number } | null, error: string | null }> {
  try {
    const access = await getCrmAccess()
    if (!access) return { data: null, error: 'Unauthorized' }
    const clean = cleanIds(ids)
    if (clean.length === 0) return { data: null, error: 'Select at least one alert' }
    const { deleted, error } = await bulkDeleteAlertSubscriptions(kind, clean)
    if (error) return { data: null, error }
    return { data: { deleted }, error: null }
  } catch (err) {
    console.error('[bulkDeleteAlertSubscriptionsAction]', err)
    return { data: null, error: 'Could not delete those alerts' }
  }
}

export async function listReportSubscriptionsAdminAction(
  opts: ListReportSubscriptionsOptions,
): Promise<{ data: { rows: AdminReportSubscriptionRow[], total: number } | null, error: string | null }> {
  try {
    const access = await getCrmAccess()
    if (!access) return { data: null, error: 'Unauthorized' }
    const data = await listReportSubscriptionsAdmin(opts)
    return { data, error: null }
  } catch (err) {
    console.error('[listReportSubscriptionsAdminAction]', err)
    return { data: null, error: 'Could not load market report subscriptions' }
  }
}

// ── Per-row mutations (edit / assign / pause / delete) ───────────────────────

export async function updateAlertSubscriptionAction(
  kind: AlertSubscriptionKind,
  id: string,
  patch: {
    name?: string
    frequency?: 'daily' | 'weekly'
    filters?: Record<string, unknown>
    active?: boolean
  },
): Promise<{ data: { ok: true } | null, error: string | null }> {
  try {
    const access = await getCrmAccess()
    if (!access) return { data: null, error: 'Unauthorized' }
    const cleanId = String(id ?? '').trim()
    if (!cleanId) return { data: null, error: 'Missing subscription id' }

    const sanitized: Parameters<typeof updateAlertSubscription>[2] = {}
    if (typeof patch?.name === 'string') sanitized.name = patch.name.trim().slice(0, 120)
    if (patch?.frequency === 'daily' || patch?.frequency === 'weekly') sanitized.frequency = patch.frequency
    if (typeof patch?.active === 'boolean') sanitized.active = patch.active
    if (patch?.filters && typeof patch.filters === 'object') {
      // Normalize through the canonical filter model so the stored JSON is
      // exactly what the alert engine + search cache understand, and keep the
      // guest table's (email, filters_hash) unique index in sync.
      const normalized = normalizeSavedSearchFilters(patch.filters)
      sanitized.filters = normalized
      sanitized.filtersHash = getSavedSearchHash(normalized)
    }
    if (Object.keys(sanitized).length === 0) return { data: null, error: 'Nothing to change' }

    const { ok, error } = await updateAlertSubscription(kind, cleanId, sanitized)
    if (!ok) return { data: null, error: error ?? 'Could not save those changes' }
    return { data: { ok: true }, error: null }
  } catch (err) {
    console.error('[updateAlertSubscriptionAction]', err)
    return { data: null, error: 'Could not save those changes' }
  }
}

export async function updateReportSubscriptionAction(
  personId: number,
  patch: { areas?: string[], frequency?: 'weekly' | 'monthly' | 'quarterly', active?: boolean },
): Promise<{ data: { ok: true } | null, error: string | null }> {
  try {
    const access = await getCrmAccess()
    if (!access) return { data: null, error: 'Unauthorized' }
    if (!Number.isInteger(personId) || personId <= 0) return { data: null, error: 'Missing contact' }

    const sanitized: { areas?: string[], frequency?: 'weekly' | 'monthly' | 'quarterly', active?: boolean } = {}
    if (Array.isArray(patch?.areas)) {
      // Only known report-area keys survive (the config table is the registry).
      const valid = new Set((await getCrmReportAreas()).map((a) => a.key))
      const areas = [...new Set(patch.areas.filter((a) => typeof a === 'string' && valid.has(a)))]
      if (areas.length === 0) return { data: null, error: 'Pick at least one area' }
      sanitized.areas = areas
    }
    if (patch?.frequency === 'weekly' || patch?.frequency === 'monthly' || patch?.frequency === 'quarterly') {
      sanitized.frequency = patch.frequency
    }
    if (typeof patch?.active === 'boolean') sanitized.active = patch.active
    if (Object.keys(sanitized).length === 0) return { data: null, error: 'Nothing to change' }

    const { ok, error } = await updateReportSubscription(personId, sanitized)
    if (!ok) return { data: null, error: error ?? 'Could not save those changes' }
    return { data: { ok: true }, error: null }
  } catch (err) {
    console.error('[updateReportSubscriptionAction]', err)
    return { data: null, error: 'Could not save those changes' }
  }
}

export async function deleteReportSubscriptionAction(
  personId: number,
): Promise<{ data: { ok: true } | null, error: string | null }> {
  try {
    const access = await getCrmAccess()
    if (!access) return { data: null, error: 'Unauthorized' }
    if (!Number.isInteger(personId) || personId <= 0) return { data: null, error: 'Missing contact' }
    const { ok, error } = await deleteReportSubscription(personId)
    if (!ok) return { data: null, error: error ?? 'Could not delete that subscription' }
    return { data: { ok: true }, error: null }
  } catch (err) {
    console.error('[deleteReportSubscriptionAction]', err)
    return { data: null, error: 'Could not delete that subscription' }
  }
}

/**
 * Assign the CRM person behind a subscription to a broker. Attribution and the
 * report send engine resolve the broker from crm_people.assigned_broker, so
 * this is the one write that redirects every future send for that contact.
 */
export async function assignSubscriptionBrokerAction(
  personId: number,
  brokerSlug: string,
): Promise<{ data: { ok: true } | null, error: string | null }> {
  try {
    const access = await getCrmAccess()
    if (!access) return { data: null, error: 'Unauthorized' }
    if (!Number.isInteger(personId) || personId <= 0) return { data: null, error: 'This subscription has no linked contact' }
    const slug = String(brokerSlug ?? '').trim()
    const roster = await getCrmBrokers()
    if (!roster.some((b) => b.slug === slug && b.crmActive)) return { data: null, error: 'Unknown broker' }
    const { ok, error } = await setPersonAssignedBroker(personId, slug)
    if (!ok) return { data: null, error: error ?? 'Could not assign that broker' }
    return { data: { ok: true }, error: null }
  } catch (err) {
    console.error('[assignSubscriptionBrokerAction]', err)
    return { data: null, error: 'Could not assign that broker' }
  }
}

/** Options for the hub's edit/assign dialogs: broker roster + report areas. */
export async function getSubscriptionEditOptionsAction(): Promise<{
  data: {
    brokers: Array<{ slug: string, name: string }>
    areas: Array<{ key: string, label: string }>
  } | null
  error: string | null
}> {
  try {
    const access = await getCrmAccess()
    if (!access) return { data: null, error: 'Unauthorized' }
    const [brokers, areas] = await Promise.all([getCrmBrokers(), getCrmReportAreas()])
    return {
      data: {
        brokers: brokers.filter((b) => b.crmActive).map((b) => ({ slug: b.slug, name: b.name || b.slug })),
        areas: areas.filter((a) => a.isActive).map((a) => ({ key: a.key, label: a.label })),
      },
      error: null,
    }
  } catch (err) {
    console.error('[getSubscriptionEditOptionsAction]', err)
    return { data: null, error: 'Could not load options' }
  }
}

// ── Rendered email previews ───────────────────────────────────────────────────

/** Map a search-cache listing row to the alert email's card shape (preview). */
function toPreviewListing(row: ListingTileRow): ListingAlertListing {
  const path = listingDetailPath(
    (row.ListingKey ?? row.ListNumber ?? '').toString().trim(),
    {
      streetNumber: row.StreetNumber,
      streetName: row.StreetName,
      city: row.City,
      state: row.State,
      postalCode: row.PostalCode,
    },
    { city: row.City, subdivision: row.SubdivisionName },
    { mlsNumber: row.ListNumber ?? null },
  )
  const address = [row.StreetNumber, row.StreetName].filter(Boolean).join(' ').trim()
  return {
    address: address || 'New listing',
    city: row.City,
    price: row.ListPrice != null ? Number(row.ListPrice) : null,
    beds: row.BedroomsTotal,
    baths: row.BathroomsTotal,
    sqft: row.TotalLivingAreaSqFt ?? null,
    photoUrl: row.PhotoURL,
    detailUrl: `${SITE_URL}${path || '/homes-for-sale'}`,
    status: row.StandardStatus ?? null,
  }
}

/**
 * Render the ACTUAL listing-alert email for one subscription's current data —
 * the same builder the send path uses (buildListingAlertEmail), fed by the same
 * search cache the alert engine matches against. The preview shows the current
 * top matches (a real send diffs against last_notified_at).
 */
export async function previewAlertEmailAction(
  kind: AlertSubscriptionKind,
  id: string,
): Promise<{ data: { subject: string, html: string, note: string | null } | null, error: string | null }> {
  try {
    const access = await getCrmAccess()
    if (!access) return { data: null, error: 'Unauthorized' }
    const sub = await getAlertSubscriptionById(kind, String(id ?? '').trim())
    if (!sub) return { data: null, error: 'Subscription not found' }

    const filters = (sub.filters ?? {}) as Record<string, unknown>
    const results = await getCachedSearchListings(filters, 1, 15)
    const listings = results.listings.slice(0, 12).map(toPreviewListing)
    const label = sub.name?.trim() || 'your saved search'
    const built = buildListingAlertEmail({
      searchName: label,
      filtersSummary: getFiltersSummary(filters),
      listings,
      totalNewCount: Math.max(results.listings.length, listings.length),
      browseAllUrl: `${SITE_URL}${buildSearchUrlFromFilters(filters)}`,
      unsubscribeUrl: `${SITE_URL}/alerts/unsubscribe?token=${encodeURIComponent(sub.unsubscribeToken ?? '')}`,
      manageUrl: kind === 'user' ? `${SITE_URL}/account/saved-searches` : null,
    })
    const note = listings.length === 0
      ? 'No listings currently match this search, so the rendered email shows an empty state. A real send is skipped when nothing matches.'
      : `Preview uses the ${listings.length} current top ${listings.length === 1 ? 'match' : 'matches'}. A real send only includes listings that are new since the last notification.`
    return { data: { subject: built.subject, html: built.html, note }, error: null }
  } catch (err) {
    console.error('[previewAlertEmailAction]', err)
    return { data: null, error: 'Could not render the email preview' }
  }
}

/**
 * Render the ACTUAL market-report email for one subscription's current areas —
 * the same renderMarketReportEmail + getMarketReportData pair the send engine
 * uses, so what Matt sees is what the contact receives.
 */
export async function previewReportEmailAction(
  personId: number,
  personName?: string | null,
): Promise<{ data: { subject: string, html: string, note: string | null } | null, error: string | null }> {
  try {
    const access = await getCrmAccess()
    if (!access) return { data: null, error: 'Unauthorized' }
    if (!Number.isInteger(personId) || personId <= 0) return { data: null, error: 'Missing contact' }
    const sub = await getReportSubscriptionByPersonId(personId)
    if (!sub) return { data: null, error: 'Subscription not found' }

    const areas = await getMarketReportData(sub.areas)
    if (areas.length === 0) {
      return { data: null, error: 'No verified market data is available for the subscribed areas, so there is no email to preview (a real send skips too)' }
    }
    const rendered = renderMarketReportEmail({
      contactName: typeof personName === 'string' ? personName : null,
      areas,
      unsubscribeUrl: buildUnsubscribeUrl(personId),
    })
    const omitted = sub.areas.length - areas.length
    const note = omitted > 0
      ? `${omitted} subscribed ${omitted === 1 ? 'area has' : 'areas have'} no verified cache data right now and ${omitted === 1 ? 'is' : 'are'} omitted, exactly as a real send would.`
      : null
    return { data: { subject: rendered.subject, html: rendered.html, note }, error: null }
  } catch (err) {
    console.error('[previewReportEmailAction]', err)
    return { data: null, error: 'Could not render the email preview' }
  }
}

export async function bulkUpdateReportSubscriptionsAction(
  personIds: number[],
  patch: { active?: boolean, frequency?: 'weekly' | 'monthly' | 'quarterly' },
): Promise<{ data: { updated: number } | null, error: string | null }> {
  try {
    const access = await getCrmAccess()
    if (!access) return { data: null, error: 'Unauthorized' }
    const clean = [...new Set((Array.isArray(personIds) ? personIds : []).filter((n) => Number.isInteger(n) && n > 0))].slice(0, MAX_BULK_IDS)
    if (clean.length === 0) return { data: null, error: 'Select at least one contact' }
    const sanitized: { active?: boolean, frequency?: 'weekly' | 'monthly' | 'quarterly' } = {}
    if (typeof patch?.active === 'boolean') sanitized.active = patch.active
    if (patch?.frequency === 'weekly' || patch?.frequency === 'monthly' || patch?.frequency === 'quarterly') sanitized.frequency = patch.frequency
    if (Object.keys(sanitized).length === 0) return { data: null, error: 'Nothing to change' }
    const { updated, error } = await bulkUpdateReportSubscriptions(clean, sanitized)
    if (error) return { data: null, error }
    return { data: { updated }, error: null }
  } catch (err) {
    console.error('[bulkUpdateReportSubscriptionsAction]', err)
    return { data: null, error: 'Could not update those subscriptions' }
  }
}
