/**
 * getClientPortalView — the broker's READ-ONLY mirror of what one client sees
 * when they are signed in to the site (search-optimization plan Phase 4.3:
 * "Matt can open any client's view read-only from the CRM person page").
 *
 * ── READ-ONLY IS THE CONTRACT, NOT A STYLE CHOICE ───────────────────────────
 * This module exposes ONE person's private data to a DIFFERENT user (a broker).
 * Every export here is a reader. There is deliberately no insert / update /
 * upsert / delete anywhere in this file, no server action wraps it, and the
 * admin route that renders it ships no form and no mutating control. The
 * invariant is pinned mechanically by lib/data/crm/clientPortalView.test.ts,
 * which greps this module AND the whole admin portal-view surface for write
 * verbs, action props, and `'use server'`. Adding a write here fails that test.
 *
 * ── WHY A DEDICATED READER ──────────────────────────────────────────────────
 * The person workspace already reads alerts, saved homes, and viewed homes for
 * its rail. Three portal stores had NO broker-side reader at all — named areas
 * (search_areas), hidden homes (hidden_listings), and the client's own site
 * activity (user_events) — and the alert rail collapses each alert to a
 * one-line label, dropping the event toggles, cadence schedule, recipients,
 * preview mode, and last-notified stamp the client can actually see. This
 * reader returns the full portal record so the broker view is a mirror rather
 * than a summary.
 *
 * ── IDENTITY CHAIN (crm person → auth user ids) ─────────────────────────────
 * Same chain getContactSavedHomes documents and the identity-join contract test
 * pins: visitor_identity_map (matched by crm_person_id / fub_person_id / email
 * via the shared, already-exported buildSavedHomesIdentityOrFilter) UNION
 * profiles.crm_person_id. Every consumer store below (search_areas,
 * hidden_listings, user_events) keys on the auth uuid only, so a contact with
 * no auth account resolves to zero rows — a normal state, never an error.
 *
 * DAL boundary (G1): the raw .from() reads live here, inside lib/data/.
 */
import 'server-only'
import { createServiceClient } from '@/lib/data/client'
import { getAreasByIds, listAreasForUser, type SearchAreaRow } from '@/lib/data/areas/searchAreas'
import {
  buildSavedHomesIdentityOrFilter,
  getContactSavedHomes,
  type ContactSavedHome,
} from '@/lib/data/crm/getContactSavedHomes'
import { getListingAlertsForLead, type ListingAlertRow } from '@/lib/data/leads/listingAlerts'
import { resolvePersonIdentity } from '@/lib/data/crm/resolvePersonIdentity'
import {
  normalizeEventToggles,
  EVENT_TYPES,
  type AlertEventToggles,
  type ListingEventType,
} from '@/lib/alerts/event-detection'
import {
  buildSearchUrlFromFilters,
  normalizeSavedSearchFilters,
  type SavedSearchFilters,
} from '@/lib/search-filters'
import { humanizeSearchCriteria } from '@/lib/data/crm/getContactListingAlerts'
import { ALL_SEARCH_URL_PARAMS } from '@/lib/search/field-registry'
import { labelForNeighborhoodSlug } from '@/lib/neighborhood-areas'
import type { AreaShape } from '@/lib/data/areas/validation'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** One human-readable chip. `detail` is the value half when there is one. */
export type PortalChip = { label: string; detail?: string }

export type ClientPortalAlert = {
  id: string
  /** The name the client gave the alert (or a humanized fallback). */
  name: string
  /** One-line criteria sentence, same wording the person rail already shows. */
  criteria: string
  /** Deep link that reproduces the search on the public site. */
  searchUrl: string
  /**
   * The alert's filters rendered as a URL-param map. Fed to
   * activeRegistryFilters (components/search/AllFiltersSheet) by the client
   * chip renderer so the broker reads the SAME labels the consumer
   * all-filters sheet prints. Serializable by construction.
   */
  registryParams: Record<string, string>
  /** Filters the field registry does not model (geography, status, sort). */
  otherChips: PortalChip[]
  /** instant | daily | weekly, exactly as stored. */
  cadence: string
  /** Weekly send days, 0 = Sunday. Null means every day. */
  scheduleDays: number[] | null
  /** Which listing events this alert fires on. */
  events: AlertEventToggles
  /** The subset of `events` that is on, as event keys. */
  eventsOn: ListingEventType[]
  active: boolean
  /** user | broker | system. */
  origin: string
  /** user | idx-registration | broker-assigned | system. */
  source: string
  /** Broker slug when the alert was assigned rather than self-created. */
  assignedBy: string | null
  /** True when sends are held for broker approval before delivery. */
  previewMode: boolean
  /** Extra household recipients on the same alert. */
  recipientCount: number
  lastNotifiedAt: string | null
  /**
   * The client's own "mark as seen" stamp for the new-since-last-visit
   * baseline (listing_alerts.last_viewed_at). Null until they mark it once, and
   * undefined on a database that predates the column.
   */
  lastViewedAt: string | null
  createdAt: string | null
}

export type ClientPortalNamedArea = {
  id: string
  name: string
  /** Count of include shapes and exclude shapes, e.g. "2 areas, 1 excluded". */
  shapeSummary: string
  polygonCount: number
  circleCount: number
  excludeCount: number
  isPublic: boolean
  updatedAt: string | null
}

export type ClientPortalHiddenHome = {
  listingKey: string
  address: string
  city: string | null
  status: string | null
  listPrice: number | null
  addressSlug: string | null
  hiddenAt: string
}

export type ClientPortalActivityEvent = {
  id: string
  eventType: string
  /** Sentence-case label for the raw event_type, e.g. "Saved a search". */
  label: string
  eventAt: string
  pagePath: string | null
  listingKey: string | null
}

export type ClientPortalView = {
  crmPersonId: number
  /** Display name off crm_people, null when the row carries none. */
  personName: string | null
  /** Normalized emails the identity resolver found for this person. */
  emails: string[]
  /** Auth user ids linked to this person. Empty means no site account yet. */
  authUserIds: string[]
  /** True when at least one auth account is linked (the portal is reachable). */
  hasSiteAccount: boolean
  alerts: ClientPortalAlert[]
  namedAreas: ClientPortalNamedArea[]
  savedHomes: ContactSavedHome[]
  hiddenHomes: ClientPortalHiddenHome[]
  activity: ClientPortalActivityEvent[]
}

// ---------------------------------------------------------------------------
// Pure helpers (unit-tested directly, no DB access)
// ---------------------------------------------------------------------------

/** Registry URL params, resolved once. Used to split registry vs other keys. */
const REGISTRY_PARAM_SET: ReadonlySet<string> = new Set(ALL_SEARCH_URL_PARAMS)

/**
 * PURE: render a saved-filter object as the URL-param map the consumer search
 * surfaces read. Mirrors buildSearchUrlFromFilters's emit rules exactly
 * (booleans emit '1', registry multis emit CSV, scalars stringify) so the chip
 * labels a broker reads match the chips the client sees on /homes-for-sale.
 * Unlike the URL builder this KEEPS city/subdivision/neighborhoodSlug, which
 * the URL builder folds into the path.
 */
export function filtersToParamMap(filters: SavedSearchFilters): Record<string, string> {
  const normalized = normalizeSavedSearchFilters(filters ?? {})
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(normalized)) {
    if (value == null) continue
    if (typeof value === 'boolean') {
      if (value) out[key] = '1'
      continue
    }
    if (Array.isArray(value)) {
      const joined = value.filter((v) => typeof v === 'string' && v.trim()).join(',')
      if (joined) out[key] = joined
      continue
    }
    if (typeof value === 'string' || typeof value === 'number') {
      const text = String(value).trim()
      if (text) out[key] = text
    }
  }
  return out
}

/** Human labels for the filter keys the field registry does not model. */
const OTHER_FILTER_LABELS: Record<string, string> = {
  city: 'City',
  cities: 'Cities',
  subdivision: 'Subdivision',
  neighborhoodSlug: 'Neighborhood',
  postalCode: 'ZIP code',
  propertyType: 'Property type',
  propertySubType: 'Property sub type',
  statusFilter: 'Status',
  keywords: 'Keywords',
  viewContains: 'View',
  viewContainsAny: 'View',
  includeClosed: 'Includes sold listings',
  excludeSoldSince: 'Excludes recent sales',
  offMarketWithinDays: 'Off market within',
  newListingsDays: 'Listed within',
  garageMin: 'Garage spaces',
  sort: 'Sort',
  view: 'Result view',
  poly: 'Drawn map area',
  areaIds: 'Named areas',
}

/** Keys that carry no reader value on a broker mirror. */
const OTHER_FILTER_SKIP = new Set(['sort', 'view'])

/**
 * PURE: chips for every filter key the registry does not own, so nothing a
 * client saved is silently dropped from the broker's mirror. `poly` renders as
 * a label only (a raw coordinate string is not information), and `areaIds`
 * resolves through the caller-supplied name map when one is available.
 */
export function otherFilterChips(
  params: Record<string, string>,
  areaNamesById?: ReadonlyMap<string, string>,
): PortalChip[] {
  const out: PortalChip[] = []
  for (const [key, raw] of Object.entries(params)) {
    if (REGISTRY_PARAM_SET.has(key)) continue
    if (OTHER_FILTER_SKIP.has(key)) continue
    const label = OTHER_FILTER_LABELS[key] ?? key
    if (key === 'poly') {
      out.push({ label: 'Drawn map area' })
      continue
    }
    if (key === 'areaIds') {
      const ids = raw.split(',').map((v) => v.trim()).filter(Boolean)
      const names = ids.map((id) => areaNamesById?.get(id) ?? 'Saved area')
      out.push({ label, detail: names.join(', ') })
      continue
    }
    if (key === 'neighborhoodSlug') {
      out.push({ label, detail: labelForNeighborhoodSlug(raw) || raw })
      continue
    }
    if (raw === '1') {
      out.push({ label })
      continue
    }
    if (key === 'offMarketWithinDays' || key === 'newListingsDays') {
      out.push({ label, detail: `${raw} days` })
      continue
    }
    out.push({ label, detail: raw })
  }
  out.sort((a, b) => a.label.localeCompare(b.label))
  return out
}

/** PURE: which event toggles are on, in canonical order. */
export function enabledEventTypes(events: AlertEventToggles): ListingEventType[] {
  return EVENT_TYPES.filter((t) => events[t] === true)
}

/** PURE: shape counts for a named area, plus a one-line summary. */
export function summarizeAreaShapes(shapes: unknown): {
  polygonCount: number
  circleCount: number
  excludeCount: number
  shapeSummary: string
} {
  const list = Array.isArray(shapes) ? (shapes as AreaShape[]) : []
  let polygonCount = 0
  let circleCount = 0
  let excludeCount = 0
  for (const shape of list) {
    if (!shape || typeof shape !== 'object') continue
    if (shape.type === 'circle') circleCount += 1
    else if (shape.type === 'polygon') polygonCount += 1
    if ((shape as { exclude?: boolean }).exclude === true) excludeCount += 1
  }
  const parts: string[] = []
  if (polygonCount > 0) parts.push(`${polygonCount} drawn ${polygonCount === 1 ? 'shape' : 'shapes'}`)
  if (circleCount > 0) parts.push(`${circleCount} ${circleCount === 1 ? 'radius' : 'radii'}`)
  if (excludeCount > 0) parts.push(`${excludeCount} excluded`)
  return {
    polygonCount,
    circleCount,
    excludeCount,
    shapeSummary: parts.length > 0 ? parts.join(', ') : 'No shapes',
  }
}

/** Site-activity event_type → reader label. Source: app/actions/track-user-event.ts. */
const ACTIVITY_LABELS: Record<string, string> = {
  page_view: 'Viewed a page',
  listing_view: 'Viewed a listing',
  listing_click: 'Opened a listing',
  listing_save: 'Saved a home',
  listing_unsave: 'Unsaved a home',
  listing_like: 'Liked a home',
  listing_unlike: 'Unliked a home',
  search: 'Ran a search',
  share_click: 'Shared a listing',
  search_filter_apply: 'Changed search filters',
  search_map_draw: 'Drew a map area',
  search_save: 'Saved a search',
  alert_create: 'Created an alert',
  search_zero_results: 'Hit a zero-result search',
}

/** PURE: reader label for a raw user_events.event_type. */
export function activityLabel(eventType: string): string {
  const known = ACTIVITY_LABELS[eventType]
  if (known) return known
  const words = String(eventType || '').replace(/[_-]+/g, ' ').trim()
  if (!words) return 'Site activity'
  return words.charAt(0).toUpperCase() + words.slice(1)
}

/**
 * PURE: map a listing_alerts row to the portal record. Split from the read so
 * the mapping is unit-testable without a live client.
 */
export function toClientPortalAlert(
  row: ListingAlertRow,
  areaNamesById?: ReadonlyMap<string, string>,
): ClientPortalAlert {
  const filters = (row.filters ?? {}) as SavedSearchFilters
  const registryParams = filtersToParamMap(filters)
  const events = normalizeEventToggles(row.events)
  const name = String(row.name ?? '').trim()
  return {
    id: String(row.id),
    name: name || humanizeSearchCriteria(filters as Record<string, unknown>),
    criteria: humanizeSearchCriteria(filters as Record<string, unknown>),
    searchUrl: buildSearchUrlFromFilters(filters),
    registryParams,
    otherChips: otherFilterChips(registryParams, areaNamesById),
    cadence: String(row.notification_frequency ?? 'daily'),
    scheduleDays: Array.isArray(row.schedule_days)
      ? row.schedule_days.map((d) => Number(d)).filter((d) => Number.isFinite(d))
      : null,
    events,
    eventsOn: enabledEventTypes(events),
    active: row.is_active === true,
    origin: String(row.origin ?? 'user'),
    source: String(row.source ?? 'user'),
    assignedBy: (row.assigned_by ?? null) || null,
    previewMode: row.preview_mode === true,
    recipientCount: Array.isArray(row.recipients) ? row.recipients.length : 0,
    lastNotifiedAt: row.last_notified_at ?? null,
    lastViewedAt: row.last_viewed_at ?? null,
    createdAt: row.created_at ?? null,
  }
}

/** PURE: every areaId referenced across a set of alerts, deduped. */
export function collectAreaIds(alerts: ReadonlyArray<{ filters: unknown }>): string[] {
  const out = new Set<string>()
  for (const alert of alerts) {
    const filters = (alert?.filters ?? {}) as Record<string, unknown>
    const raw = filters.areaIds
    if (!Array.isArray(raw)) continue
    for (const id of raw) {
      const text = String(id ?? '').trim()
      if (text) out.add(text)
    }
  }
  return [...out]
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/**
 * Every auth user id linked to a CRM person. Same two-source chain
 * getContactSavedHomes walks, reusing its already-exported pure or-filter
 * builder so the two readers can never drift apart.
 */
async function resolveAuthUserIdsForPerson(params: {
  crmPersonId: number
  fubLegacyId?: number | null
  emails?: string[]
}): Promise<string[]> {
  const sb = createServiceClient()
  const orFilter = buildSavedHomesIdentityOrFilter(
    params.crmPersonId,
    params.fubLegacyId,
    params.emails,
  )
  const [idmapRes, profileRes] = await Promise.all([
    sb.from('visitor_identity_map').select('user_id').or(orFilter).not('user_id', 'is', null).limit(50),
    sb.from('profiles').select('user_id').eq('crm_person_id', params.crmPersonId).limit(10),
  ])
  return [
    ...new Set(
      [...(idmapRes.data ?? []), ...(profileRes.data ?? [])]
        .map((r) => (r.user_id ? String(r.user_id) : ''))
        .filter(Boolean),
    ),
  ]
}

/** The client's named map areas (search_areas), across every linked auth id. */
async function readNamedAreas(userIds: string[]): Promise<ClientPortalNamedArea[]> {
  if (userIds.length === 0) return []
  const batches = await Promise.all(userIds.map((id) => listAreasForUser(id)))
  const seen = new Set<string>()
  const rows: SearchAreaRow[] = []
  for (const batch of batches) {
    for (const row of batch) {
      const id = String(row.id)
      if (seen.has(id)) continue
      seen.add(id)
      rows.push(row)
    }
  }
  return rows.map((row) => {
    const counts = summarizeAreaShapes(row.shapes)
    return {
      id: String(row.id),
      name: String(row.name ?? 'Untitled area'),
      shapeSummary: counts.shapeSummary,
      polygonCount: counts.polygonCount,
      circleCount: counts.circleCount,
      excludeCount: counts.excludeCount,
      isPublic: row.is_public === true,
      updatedAt: (row.updated_at as string | null) ?? null,
    }
  })
}

/** Homes the client hid from their own results, joined to live tiles. */
async function readHiddenHomes(userIds: string[]): Promise<ClientPortalHiddenHome[]> {
  if (userIds.length === 0) return []
  const sb = createServiceClient()
  const { data: hidden } = await sb
    .from('hidden_listings')
    .select('listing_key,created_at')
    .in('user_id', userIds)
    .order('created_at', { ascending: false })
    .limit(100)
  const rows = hidden ?? []
  if (rows.length === 0) return []

  const keys = [...new Set(rows.map((r) => String(r.listing_key ?? '')).filter(Boolean))]
  if (keys.length === 0) return []

  const { data: live } = await sb
    .from('listing_tile_mv')
    .select('listing_key,street_number,street_name,city,standard_status,list_price,address_slug')
    // @canonical-key — hidden_listings keys share the tile MV's ListingKey
    // space; a stale one misses the join, never maps to another listing.
    .in('listing_key', keys)
  const liveByKey = new Map((live ?? []).map((r) => [String(r.listing_key), r]))

  const firstHiddenAt = new Map<string, string>()
  for (const r of rows) {
    const key = String(r.listing_key ?? '')
    if (!key || firstHiddenAt.has(key)) continue
    firstHiddenAt.set(key, String(r.created_at ?? ''))
  }

  return keys.map((key) => {
    const r = liveByKey.get(key)
    return {
      listingKey: key,
      // Off-market homes drop out of the tile MV. Keep the row with the same
      // fallback label the saved-homes reader uses.
      address: r ? [r.street_number, r.street_name].filter(Boolean).join(' ') : 'Listing',
      city: (r?.city as string | null) ?? null,
      status: (r?.standard_status as string | null) ?? null,
      listPrice: r && r.list_price !== null ? Number(r.list_price) : null,
      addressSlug: (r?.address_slug as string | null) ?? null,
      hiddenAt: firstHiddenAt.get(key) ?? '',
    }
  })
}

/** The client's own site activity feed (user_events), newest first. */
async function readSiteActivity(userIds: string[], limit: number): Promise<ClientPortalActivityEvent[]> {
  if (userIds.length === 0) return []
  const sb = createServiceClient()
  const { data } = await sb
    .from('user_events')
    .select('id,event_type,event_at,page_path,listing_key')
    .in('user_id', userIds)
    .order('event_at', { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 200))
  return (data ?? []).map((r) => ({
    id: String(r.id),
    eventType: String(r.event_type ?? ''),
    label: activityLabel(String(r.event_type ?? '')),
    eventAt: String(r.event_at ?? ''),
    pagePath: (r.page_path as string | null) ?? null,
    listingKey: (r.listing_key as string | null) ?? null,
  }))
}

/** The person's display name off crm_people. Null when the row is gone. */
async function readPersonName(crmPersonId: number): Promise<{ found: boolean; name: string | null }> {
  const sb = createServiceClient()
  const { data } = await sb
    .from('crm_people')
    .select('id,name,first_name,last_name')
    .eq('id', crmPersonId)
    .maybeSingle()
  if (!data) return { found: false, name: null }
  const full = String(data.name ?? '').trim()
  if (full) return { found: true, name: full }
  const parts = [data.first_name, data.last_name]
    .map((v) => String(v ?? '').trim())
    .filter(Boolean)
  return { found: true, name: parts.length > 0 ? parts.join(' ') : null }
}

/**
 * One call, everything the client's signed-in portal holds. Returns null only
 * when the CRM person does not exist (so the route can 404) — a person with no
 * site account returns a populated shell with empty collections, which is the
 * honest answer rather than an error.
 *
 * READ-ONLY: every branch below is a select. See the file header.
 */
export async function getClientPortalView(params: {
  crmPersonId: number
  /** How many site-activity rows to return. Clamped to 1..200. */
  activityLimit?: number
}): Promise<ClientPortalView | null> {
  const { crmPersonId } = params
  if (!Number.isFinite(crmPersonId) || crmPersonId <= 0) return null

  const [person, identity] = await Promise.all([
    readPersonName(crmPersonId),
    resolvePersonIdentity(crmPersonId),
  ])
  if (!person.found) return null

  const authUserIds = await resolveAuthUserIdsForPerson({
    crmPersonId,
    fubLegacyId: identity.fubLegacyId,
    emails: identity.emails,
  })

  const [alertRows, namedAreas, savedHomes, hiddenHomes, activity] = await Promise.all([
    getListingAlertsForLead({
      userId: identity.authUserId,
      crmPersonId,
      fubPersonId: identity.fubLegacyId,
      emails: identity.emails,
    }),
    readNamedAreas(authUserIds),
    getContactSavedHomes({
      crmPersonId,
      fubLegacyId: identity.fubLegacyId,
      emails: identity.emails,
    }),
    readHiddenHomes(authUserIds),
    readSiteActivity(authUserIds, params.activityLimit ?? 40),
  ])

  // Named areas referenced by an alert may belong to a broker or a public area,
  // so resolve every referenced id rather than only the client's own list.
  const referencedAreaIds = collectAreaIds(alertRows)
  const areaNamesById = new Map<string, string>()
  for (const area of namedAreas) areaNamesById.set(area.id, area.name)
  const missing = referencedAreaIds.filter((id) => !areaNamesById.has(id))
  if (missing.length > 0) {
    for (const row of await getAreasByIds(missing)) {
      areaNamesById.set(String(row.id), String(row.name ?? 'Saved area'))
    }
  }

  return {
    crmPersonId,
    personName: person.name,
    emails: identity.emails,
    authUserIds,
    hasSiteAccount: authUserIds.length > 0,
    alerts: alertRows.map((row) => toClientPortalAlert(row, areaNamesById)),
    namedAreas,
    savedHomes,
    hiddenHomes,
    activity,
  }
}
