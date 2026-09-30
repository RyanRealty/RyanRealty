'use server'

/**
 * Admin server actions for the unified Subscriptions hub
 * (/admin/crm/subscriptions). Thin, admin-gated wrappers over
 * lib/data/crm/subscriptionsAdmin.ts (the DAL owns every raw table read).
 *
 * Access: any CRM admin (getCrmAccess). These manage delivery PREFERENCES.
 * Actual sends stay suppression-gated at the cron chokepoints, and every
 * outbound email carries open/click tracking via attributeOutbound.
 *
 * Market reports (Matt's decisions 2026-09-29): every report-subscription
 * action here is ownership-checked (requirePersonInScope; a scoped broker only
 * lists and touches their own contacts), a report viewer changes nothing, and
 * every change writes a crm_timeline row naming the admin, through the same
 * planner the contact's own preferences page and the CRM record use
 * (lib/crm/market-report-admin.ts). Reassigning a contact's broker is an owner
 * operation, as it is on the person page.
 */

import { getAlertManageUrl } from '@/lib/alerts/manage-url'
import { getCrmAccess, requirePersonInScope, type CrmAccess } from '@/app/actions/crm'
import {
  listGuestAlertSubscriptions,
  listUserSavedSearches,
  bulkUpdateAlertSubscriptions,
  bulkDeleteAlertSubscriptions,
  listReportSubscriptionsAdmin,
  bulkUpdateReportSubscriptions,
  filterPersonIdsInBrokerScope,
  getAlertSubscriptionById,
  updateAlertSubscription,
  deleteReportSubscription,
  type ListAlertSubscriptionsOptions,
  type ListAlertSubscriptionsResult,
  type ListReportSubscriptionsOptions,
  type AdminReportSubscriptionRow,
  type AlertSubscriptionKind,
} from '@/lib/data/crm/subscriptionsAdmin'
import { getGlobalDeliverySummary, type GlobalDeliverySummary } from '@/lib/data/crm/emailDelivery'
import { getCrmBrokers } from '@/lib/data/crm/getCrmBrokers'
import { getCrmReportAreas } from '@/lib/data/crm/getCrmReportAreas'
import {
  getMarketReportContact,
  getReportSubscriptionRecord,
  logReportTimeline,
} from '@/lib/data/crm/marketReportSubscription'
import { adminUpdateReportSubscription } from '@/lib/crm/market-report-admin'
import { isContactHeld, isContactStopped } from '@/lib/crm/market-report-subscription-control'
import { renderMarketReportPreview } from '@/lib/crm/market-report-preview'
import { reportAreaLabel } from '@/lib/crm/market-report-areas'
import { scopeBroker } from '@/lib/crm/scope'
import { createServiceClient } from '@/lib/supabase/service'
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

/** A report-subscription write: signed in, not a read-only role, and the contact is in the caller's book. */
async function reportWriteGuard(
  personId: number,
): Promise<{ ok: true; access: CrmAccess } | { ok: false; error: string }> {
  const access = await getCrmAccess()
  if (!access) return { ok: false, error: 'Unauthorized' }
  if (access.role === 'report_viewer') return { ok: false, error: 'Your role can read the CRM but not change it.' }
  if (!Number.isInteger(personId) || personId <= 0) return { ok: false, error: 'Missing contact' }
  const scoped = await requirePersonInScope(personId, access)
  if (!scoped.ok) return scoped
  return { ok: true, access }
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
  patch: { active?: boolean, frequency?: 'instant' | 'daily' | 'weekly' },
): Promise<{ data: { updated: number } | null, error: string | null }> {
  try {
    const access = await getCrmAccess()
    if (!access) return { data: null, error: 'Unauthorized' }
    const clean = cleanIds(ids)
    if (clean.length === 0) return { data: null, error: 'Select at least one alert' }
    const sanitized: { active?: boolean, frequency?: 'instant' | 'daily' | 'weekly' } = {}
    if (typeof patch?.active === 'boolean') sanitized.active = patch.active
    if (patch?.frequency === 'instant' || patch?.frequency === 'daily' || patch?.frequency === 'weekly') sanitized.frequency = patch.frequency
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
    // A scoped broker lists only their own contacts; the owner lists every one.
    const data = await listReportSubscriptionsAdmin({ ...opts, scopeBroker: scopeBroker(access) })
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
    frequency?: 'instant' | 'daily' | 'weekly' | 'monthly'
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
    if (patch?.frequency === 'instant' || patch?.frequency === 'daily' || patch?.frequency === 'weekly') sanitized.frequency = patch.frequency
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
  patch: { areas?: string[], frequency?: 'weekly' | 'monthly' | 'quarterly', active?: boolean, consentNote?: string | null },
): Promise<{ data: { ok: true } | null, error: string | null }> {
  try {
    const guard = await reportWriteGuard(personId)
    if (!guard.ok) return { data: null, error: guard.error }

    let areas: string[] | undefined
    let validAreas: ReadonlySet<string> | undefined
    if (Array.isArray(patch?.areas)) {
      areas = patch.areas.filter((a): a is string => typeof a === 'string' && a.trim().length > 0)
      if (areas.length === 0) return { data: null, error: 'Pick at least one area' }
      // This dialog offers the crm_report_areas config table, so that list is
      // the authority here (an unknown key is refused by name, never dropped).
      // An unreadable table reads as empty: fall back to the report registry.
      const configured = new Set((await getCrmReportAreas()).map((a) => a.key))
      validAreas = configured.size > 0 ? configured : undefined
    }
    const frequency =
      patch?.frequency === 'weekly' || patch?.frequency === 'monthly' || patch?.frequency === 'quarterly'
        ? patch.frequency
        : undefined
    const active = typeof patch?.active === 'boolean' ? patch.active : undefined
    if (!areas && !frequency && active === undefined) return { data: null, error: 'Nothing to change' }

    // The shared planner: every change in one write with one timeline row
    // naming the admin, and a contact who stopped her own reports only
    // restarts with a consent note.
    const r = await adminUpdateReportSubscription({
      personId,
      admin: { email: guard.access.email, brokerSlug: guard.access.brokerSlug },
      areas,
      validAreas,
      frequency,
      active,
      consentNote: patch?.consentNote ?? null,
    })
    if (!r.ok) return { data: null, error: r.error }
    return { data: { ok: true }, error: null }
  } catch (err) {
    console.error('[updateReportSubscriptionAction]', err)
    return { data: null, error: 'Could not save those changes' }
  }
}

/**
 * Delete a contact's market report subscription. Refused when the contact
 * stopped the reports herself: the stopped row IS her opt-out on record, and
 * deleting it would let a later "subscribe" silently start them again.
 */
export async function deleteReportSubscriptionAction(
  personId: number,
): Promise<{ data: { ok: true } | null, error: string | null }> {
  try {
    const guard = await reportWriteGuard(personId)
    if (!guard.ok) return { data: null, error: guard.error }
    const rec = await getReportSubscriptionRecord({ personId })
    if (!rec) return { data: null, error: 'Subscription not found' }
    // Her stop or her pause is her choice on record: deleting the row would
    // let a later "subscribe" silently start the reports again.
    if (isContactHeld(rec)) {
      return {
        data: null,
        error: isContactStopped(rec)
          ? 'This contact stopped these reports themselves. Keep the stopped subscription: it is their opt-out on record.'
          : 'This contact paused these reports themselves. Keep the paused subscription: it is their choice on record.',
      }
    }
    const { ok, error } = await deleteReportSubscription(personId)
    if (!ok) return { data: null, error: error ?? 'Could not delete that subscription' }
    await logReportTimeline(personId, {
      title: `Market report subscription deleted by ${guard.access.email}`,
      body: rec.areas.length ? `Areas were ${rec.areas.map(reportAreaLabel).join(', ')}, ${rec.frequency}.` : null,
      payload: { via: 'admin', change: 'delete' },
      broker: guard.access.brokerSlug,
      source: 'app',
    })
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
    // Reassigning a contact is an OWNER operation, as on the person page
    // (app/actions/crm.ts assignCrmBrokerAction): a scoped broker is refused,
    // so no one can move another broker's contact into their own book.
    if (scopeBroker(access) !== null) return { data: null, error: 'Only an owner can reassign a contact' }
    if (!Number.isInteger(personId) || personId <= 0) return { data: null, error: 'This subscription has no linked contact' }
    const slug = String(brokerSlug ?? '').trim()
    const roster = await getCrmBrokers()
    if (!roster.some((b) => b.slug === slug && b.crmActive)) return { data: null, error: 'Unknown broker' }
    // The canonical setter: cascades open tasks and deals and records the move.
    const { setPersonAssignedBroker } = await import('@/lib/crm/assigned-broker')
    const result = await setPersonAssignedBroker(createServiceClient(), personId, slug, {
      actorEmail: access.email ?? null,
      source: 'app',
    })
    if (!result.ok) return { data: null, error: result.error ?? 'Could not assign that broker' }
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
      manageUrl: kind === 'user' ? getAlertManageUrl(sub.id, SITE_URL) : null,
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
 * Render the market-report email one contact would get for her current areas,
 * built exactly as a send builds it (lib/crm/market-report-preview.ts): her
 * assigned broker's card and identity, her greeting, the report's own links
 * signed as a read-only preview, the same prepare footer pass, and no
 * tracking. Says when a real send would be held for stale data.
 */
export async function previewReportEmailAction(
  personId: number,
  personName?: string | null,
): Promise<{ data: { subject: string, html: string, note: string | null } | null, error: string | null }> {
  try {
    const access = await getCrmAccess()
    if (!access) return { data: null, error: 'Unauthorized' }
    if (!Number.isInteger(personId) || personId <= 0) return { data: null, error: 'Missing contact' }
    const scoped = await requirePersonInScope(personId, access)
    if (!scoped.ok) return { data: null, error: scoped.error }
    const [sub, contact] = await Promise.all([
      getReportSubscriptionRecord({ personId }),
      getMarketReportContact(personId),
    ])
    if (!sub) return { data: null, error: 'Subscription not found' }

    const res = await renderMarketReportPreview({
      areaSlugs: sub.areas,
      contactName: contact?.firstName ?? contact?.name ?? (typeof personName === 'string' ? personName : null),
      brokerSlug: contact?.assignedBroker ?? access.brokerSlug ?? 'matt',
      personId,
      subscriptionId: sub.id,
    })
    if (!res.ok) return { data: null, error: res.error }
    const omitted = res.preview.omittedAreas.length
    const notes = [
      omitted > 0
        ? `${omitted} subscribed ${omitted === 1 ? 'area has' : 'areas have'} no verified data right now and ${omitted === 1 ? 'is' : 'are'} omitted, exactly as a real send would.`
        : null,
      res.preview.heldNote,
    ].filter(Boolean)
    return { data: { subject: res.preview.subject, html: res.preview.html, note: notes.length ? notes.join(' ') : null }, error: null }
  } catch (err) {
    console.error('[previewReportEmailAction]', err)
    return { data: null, error: 'Could not render the email preview' }
  }
}

export async function bulkUpdateReportSubscriptionsAction(
  personIds: number[],
  patch: { active?: boolean, frequency?: 'weekly' | 'monthly' | 'quarterly' },
): Promise<{
  data: { updated: number, skippedContactStopped: number, skippedNoAreas: number } | null
  error: string | null
}> {
  try {
    const access = await getCrmAccess()
    if (!access) return { data: null, error: 'Unauthorized' }
    if (access.role === 'report_viewer') return { data: null, error: 'Your role can read the CRM but not change it.' }
    const requested = [...new Set((Array.isArray(personIds) ? personIds : []).filter((n) => Number.isInteger(n) && n > 0))].slice(0, MAX_BULK_IDS)
    if (requested.length === 0) return { data: null, error: 'Select at least one contact' }
    const sanitized: { active?: boolean, frequency?: 'weekly' | 'monthly' | 'quarterly' } = {}
    if (typeof patch?.active === 'boolean') sanitized.active = patch.active
    if (patch?.frequency === 'weekly' || patch?.frequency === 'monthly' || patch?.frequency === 'quarterly') sanitized.frequency = patch.frequency
    if (Object.keys(sanitized).length === 0) return { data: null, error: 'Nothing to change' }
    // Ownership: a scoped broker's bulk change only reaches their own book
    // (the requirePersonInScope rule, checked for the whole selection at once).
    const scoped = await filterPersonIdsInBrokerScope(requested, scopeBroker(access))
    if (scoped.error) return { data: null, error: scoped.error }
    if (scoped.ids.length === 0) return { data: null, error: 'None of those contacts are in your book' }
    const { updated, skippedContactStopped, skippedNoAreas, error } = await bulkUpdateReportSubscriptions(
      scoped.ids,
      sanitized,
      { email: access.email, brokerSlug: access.brokerSlug },
    )
    if (error) return { data: null, error }
    return { data: { updated, skippedContactStopped, skippedNoAreas }, error: null }
  } catch (err) {
    console.error('[bulkUpdateReportSubscriptionsAction]', err)
    return { data: null, error: 'Could not update those subscriptions' }
  }
}

// ── Delivery observability (the Delivery tab, WS4) ────────────────────────────

/**
 * The Delivery tab's rollup: per-stream sends/opens/clicks/failures, the
 * "needs attention" list with plain-English fixes, and the recent-sends table.
 * Read-only; same CRM-admin gate as the sibling list actions.
 */
export async function getGlobalDeliverySummaryAction(
  days: number,
): Promise<{ data: GlobalDeliverySummary | null, error: string | null }> {
  try {
    const access = await getCrmAccess()
    if (!access) return { data: null, error: 'Unauthorized' }
    const data = await getGlobalDeliverySummary({ days })
    if (data.unreadable) return { data: null, error: 'Could not load delivery data' }
    return { data, error: null }
  } catch (err) {
    console.error('[getGlobalDeliverySummaryAction]', err)
    return { data: null, error: 'Could not load delivery data' }
  }
}
