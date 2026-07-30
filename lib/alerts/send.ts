import 'server-only'
import { getAlertManageUrl } from '@/lib/alerts/manage-url'

/**
 * Alert send machinery — the per-alert fan-out half of the typed-event
 * listing-alert engine, extracted from app/actions/saved-search-alerts.ts so
 * the action file stays a thin cron/queue orchestration layer.
 *
 * Owns: event→card resolution and section grouping, recipient resolution with
 * per-recipient compliance (hard-stop + suppression on EVERY recipient), and
 * the one shared send path (per-recipient unsubscribe token, attribution,
 * Resend call, email_events row) used by BOTH the cron run and the
 * preview-queue release (approveAlertQueueItems).
 *
 * No decisions live here — planAlertDelivery (lib/alerts/delivery-plan.ts)
 * owns the branching; detection lives in lib/alerts/event-detection.ts.
 */

import { randomUUID } from 'crypto'
import { sendEmail } from '@/lib/resend'
import type { ListingTileRow } from '@/app/actions/listings'
import { listingDetailPath } from '@/lib/slug'
import { buildSearchUrlFromFilters, getFiltersSummary } from '@/lib/search-filters'
import {
  updateListingAlertRecipients,
  type ListingAlertRow,
  type ListingAlertRecipientEntry,
} from '@/lib/data/leads/listingAlerts'
import type { ListingAlertQueueRow } from '@/lib/data/leads/listingAlertQueue'
import type { ListingEventState } from '@/lib/data/listings/getListingEventStates'
import type {
  ListingEvent,
  ListingEventSource,
  ListingEventType,
} from '@/lib/alerts/event-detection'
import {
  normalizeRecipients,
  type AlertRecipient,
  type RecipientCompliance,
} from '@/lib/alerts/delivery-plan'
import { isHardStopped } from '@/lib/canonical-lead-tagger'
import { isSuppressedByEmail } from '@/lib/crm/suppressions'
import { attributeOutbound } from '@/lib/crm/attributed-links'
import { brokerSendIdentity } from '@/lib/email/broker-identity'
import { recordEmailEvent } from '@/lib/crm/email-events'
import {
  buildListingAlertEmail,
  type AlertEmailSection,
  type ListingAlertListing,
} from '@/lib/crm/listing-alert-email'
import { resolvePersonForTracking } from '@/lib/data/crm/resolvePersonForTracking'

/** Max listing cards in one alert email. Overflow becomes a "+N more" link. */
export const MAX_LISTINGS_PER_EMAIL = 12

/**
 * Default broker slug when the recipient has no assigned_broker — same desk
 * default as lib/crm/market-report-send.ts DEFAULT_BROKER.
 */
const DEFAULT_BROKER = 'matt'

/** Visible section labels per event type (§2: sentence case, no hype). */
const EVENT_SECTION_LABELS: Record<ListingEventType, string> = {
  new: 'New listings',
  price_change: 'Price changes',
  back_on_market: 'Back on market',
  open_house: 'Open house scheduled',
  status_change: 'Now pending',
  sold: 'Just sold',
}

/** Section display order: new inventory first, then changes, then exits. */
const EVENT_SECTION_ORDER: ListingEventType[] = [
  'new',
  'price_change',
  'back_on_market',
  'open_house',
  'status_change',
  'sold',
]

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

/** Card for a departed (sold / now-pending) listing, from the status lookup. */
function stateToAlertListing(state: ListingEventState, siteUrl: string): ListingAlertListing {
  const card = state.card
  const path = buildListingUrl({
    ListingKey: card.rawListingKey,
    ListNumber: card.listNumber,
    StreetNumber: card.streetNumber,
    StreetName: card.streetName,
    City: card.city,
    State: card.state,
    PostalCode: card.postalCode,
    SubdivisionName: card.subdivisionName,
  })
  const address = [card.streetNumber, card.streetName].filter(Boolean).join(' ').trim()
  return {
    address: address || 'Listing update',
    city: card.city,
    price: state.listPrice,
    beds: card.beds,
    baths: card.baths,
    sqft: card.sqft,
    photoUrl: card.photoUrl,
    detailUrl: withUtm(path ? `${siteUrl}${path}` : `${siteUrl}/homes-for-sale`),
    status: state.standardStatus,
  }
}

/** Minimal event source when the listings lookup missed a current match. */
export function tileToEventSource(row: ListingTileRow, key: string): ListingEventSource {
  return {
    listingKey: key,
    standardStatus: row.StandardStatus ?? null,
    listPrice: row.ListPrice != null ? Number(row.ListPrice) : null,
    closeDate: null,
    lastPriceChangeDate: null,
    lastPriceChangeAmount: null,
    lastPriceChangePct: null,
    pendingTimestamp: null,
    backOnMarketTimestamp: null,
    statusChangeTimestamp: null,
    hasOpenHouse: false,
  }
}

/** Resolve the email card for one event (tile row first, lookup fallback). */
export function eventToCard(
  event: ListingEvent,
  tileByKey: Map<string, ListingTileRow>,
  stateByKey: Map<string, ListingEventState>,
  siteUrl: string,
): ListingAlertListing | null {
  const tile = tileByKey.get(event.listingKey)
  const state = stateByKey.get(event.listingKey)
  const card = tile
    ? toAlertListing(tile, siteUrl)
    : state
      ? stateToAlertListing(state, siteUrl)
      : null
  if (!card) return null
  if (event.type === 'price_change') card.previousPrice = event.oldPrice ?? null
  if (event.type === 'status_change' && event.newStatus) card.status = event.newStatus
  if (event.type === 'sold') card.status = 'Sold'
  return card
}

/**
 * Group toggled events into ordered, labeled email sections with cards. Caps
 * the total card count at MAX_LISTINGS_PER_EMAIL (overflow surfaces as the
 * "+N more" link via totalNewCount).
 */
export function buildEventSections(args: {
  events: ListingEvent[]
  tileByKey: Map<string, ListingTileRow>
  stateByKey: Map<string, ListingEventState>
  siteUrl: string
}): { sections: AlertEmailSection[]; totalEvents: number } {
  const byType = new Map<ListingEventType, ListingEvent[]>()
  for (const event of args.events) {
    const list = byType.get(event.type) ?? []
    list.push(event)
    byType.set(event.type, list)
  }

  const sections: AlertEmailSection[] = []
  let shown = 0
  let totalEvents = 0
  for (const type of EVENT_SECTION_ORDER) {
    const events = byType.get(type) ?? []
    totalEvents += events.length
    if (events.length === 0) continue
    const listings: ListingAlertListing[] = []
    for (const event of events) {
      if (shown >= MAX_LISTINGS_PER_EMAIL) break
      const card = eventToCard(event, args.tileByKey, args.stateByKey, args.siteUrl)
      if (!card) continue
      listings.push(card)
      shown += 1
    }
    if (listings.length > 0) {
      sections.push({ kind: type, label: EVENT_SECTION_LABELS[type], listings })
    }
  }
  return { sections, totalEvents }
}

/** Rebuild email sections from held preview-queue payloads ({event, card}). */
export function payloadsToSections(rows: ListingAlertQueueRow[]): {
  sections: AlertEmailSection[]
  totalCount: number
} {
  const byType = new Map<string, ListingAlertListing[]>()
  for (const row of rows) {
    const payload = (row.event_payload ?? {}) as { card?: ListingAlertListing }
    const card = payload.card
    if (!card || typeof card.detailUrl !== 'string') continue
    const list = byType.get(row.event_type) ?? []
    list.push(card)
    byType.set(row.event_type, list)
  }
  const sections: AlertEmailSection[] = []
  let totalCount = 0
  for (const type of EVENT_SECTION_ORDER) {
    const listings = byType.get(type)
    if (!listings?.length) continue
    totalCount += listings.length
    sections.push({ kind: type, label: EVENT_SECTION_LABELS[type], listings })
  }
  return { sections, totalCount }
}

export type ResolvedRecipient = AlertRecipient & {
  personId: number | null
  fubPersonId: number | null
  assignedBroker: string | null
}

/**
 * Resolve the alert's full recipient set (primary + household entries),
 * backfilling missing per-recipient unsubscribe tokens (persisted so the
 * token in the sent email always matches the row), then run the compliance
 * gates — isHardStopped + isSuppressedByEmail — for EVERY recipient
 * individually. A lookup failure fails closed (recipient dropped).
 */
export async function resolveRecipientsWithCompliance(
  row: ListingAlertRow,
  dryRun: boolean,
): Promise<{
  recipients: ResolvedRecipient[]
  compliance: Map<string, RecipientCompliance>
  primaryPerson: Awaited<ReturnType<typeof resolvePersonForTracking>>
}> {
  // Token backfill for household entries created without one.
  let rawRecipients: ListingAlertRecipientEntry[] = Array.isArray(row.recipients)
    ? row.recipients
    : []
  let tokensAdded = false
  rawRecipients = rawRecipients.map((entry) => {
    if (
      entry &&
      typeof entry === 'object' &&
      typeof entry.email === 'string' &&
      entry.email.trim() &&
      !(entry.unsubscribe_token ?? '').trim()
    ) {
      tokensAdded = true
      return { ...entry, unsubscribe_token: randomUUID() }
    }
    return entry
  })
  if (tokensAdded && !dryRun) {
    await updateListingAlertRecipients(row.id, rawRecipients)
  }

  const base = normalizeRecipients({
    email: row.email,
    unsubscribe_token: row.unsubscribe_token,
    recipients: rawRecipients,
  })

  // Primary identity: the row's crm_person_id when present, else a
  // case-insensitive email match (native replacement for the dead FUB
  // findPersonByEmail fallback — FUB decommissioned 2026-06-24).
  const primaryPerson = await resolvePersonForTracking({
    crmPersonId: row.crm_person_id,
    email: row.email,
  })

  const recipients: ResolvedRecipient[] = []
  const compliance = new Map<string, RecipientCompliance>()
  for (const recipient of base) {
    try {
      const person =
        recipient.kind === 'primary'
          ? primaryPerson
          : await resolvePersonForTracking({ email: recipient.email })
      const compliancePersonId =
        person.personId ?? (recipient.kind === 'primary' ? row.fub_person_id : null)
      const hardStopped = compliancePersonId ? await isHardStopped(compliancePersonId) : false
      const suppressed = (await isSuppressedByEmail(recipient.email, 'email')).suppressed
      recipients.push({
        ...recipient,
        personId: person.personId,
        fubPersonId: person.fubPersonId ?? (recipient.kind === 'primary' ? row.fub_person_id : null),
        assignedBroker: person.assignedBroker,
      })
      compliance.set(recipient.email, { hardStopped, suppressed })
    } catch (err) {
      // Fail closed: an unverifiable recipient does not receive.
      console.error('[resolveRecipientsWithCompliance] recipient resolution failed', {
        searchId: row.id,
        error: err instanceof Error ? err.message : String(err),
      })
      recipients.push({ ...recipient, personId: null, fubPersonId: null, assignedBroker: null })
      compliance.set(recipient.email, { hardStopped: true, suppressed: true })
    }
  }
  return { recipients, compliance, primaryPerson }
}

/**
 * Send ONE alert email to a set of resolved recipients — the shared send path
 * for the cron run AND the preview-queue release. Per recipient: own
 * unsubscribe token, own attribution/tracking identity, own Resend call, own
 * email_events row. Returns the number of emails delivered.
 */
export async function sendAlertEmailToRecipients(args: {
  row: ListingAlertRow
  deliverTo: ResolvedRecipient[]
  sections: AlertEmailSection[]
  totalCount: number
  siteUrl: string
  runDate: string
  dryRun: boolean
}): Promise<{ sent: number; errors: string[] }> {
  const { row, siteUrl } = args
  const errors: string[] = []
  let sent = 0

  const filters = (row.filters ?? {}) as Record<string, unknown>
  const label = row.name?.trim() || 'your search'
  const browseAllUrl = withUtm(`${siteUrl}${buildSearchUrlFromFilters(filters)}`)

  for (let i = 0; i < args.deliverTo.length; i += 1) {
    const recipient = args.deliverTo[i]
    const token = recipient.unsubscribeToken || row.unsubscribe_token
    const unsubscribeUrl = `${siteUrl}/alerts/unsubscribe?token=${encodeURIComponent(token)}`
    // RFC 8058 one-click target for the List-Unsubscribe header (route handler
    // POST), separate from the page link above so a provider's one-click POST
    // gets a 2xx instead of the page Server Action's 403.
    const oneClickUrl = `${siteUrl}/api/alerts/unsubscribe?token=${encodeURIComponent(token)}`

    const built = buildListingAlertEmail({
      searchName: label,
      filtersSummary: getFiltersSummary(filters),
      listings: [],
      sections: args.sections,
      totalNewCount: args.totalCount,
      browseAllUrl,
      unsubscribeUrl,
      // Signed-in subscribers manage their alerts from /account; household
      // recipients and guests only have the token unsubscribe link.
      manageUrl:
        recipient.kind === 'primary' && row.user_id ? getAlertManageUrl(row.id, siteUrl) : null,
    })

    // Broker attribution (?agent= / ?_fuid=) + open/click instrumentation on
    // the FINAL HTML — exactly once, after the body is fully built. When no
    // person resolved, attributeOutbound applies attribution only (no
    // tracking wrapper) by design. Unsubscribe links stay unwrapped.
    const brokerSlug = recipient.assignedBroker ?? DEFAULT_BROKER
    const emailKey =
      recipient.kind === 'primary'
        ? `listing-alert:${row.id}:${args.runDate}`
        : `listing-alert:${row.id}:${args.runDate}:r${i}`
    const finalHtml = attributeOutbound(built.html, {
      brokerSlug,
      personId: recipient.personId,
      fubPersonId: recipient.fubPersonId,
      emailKey,
      label: built.subject,
      broker: brokerSlug,
    })

    if (args.dryRun) {
      sent += 1
      continue
    }

    // Suppression re-check at the send chokepoint (defense-in-depth: the
    // recipient list arrives pre-filtered by resolveRecipientsWithCompliance,
    // but a suppression recorded between resolve and send must still win).
    const finalGate = await isSuppressedByEmail(recipient.email, 'email')
    if (finalGate.suppressed) continue

    // Named broker sender + monitored reply-to (lib/email/broker-identity):
    // a reply to an alert must reach the assigned broker, never noreply@.
    const identity = brokerSendIdentity(brokerSlug)
    const emailResult = await sendEmail({
      to: recipient.email,
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
      errors.push(emailResult.error)
      continue
    }
    sent += 1
    // Measurement, mirror of the market-report send path: one 'sent' row in
    // email_events per send, keyed on the SAME emailKey the tracker signs
    // into the open/click tokens so per-subscription engagement aggregates.
    // Best-effort: a reporting-side failure (even a throw) must NEVER abort
    // the caller's notified stamp, or the row stays due and re-sends.
    try {
      await recordEmailEvent({
        messageId: emailResult.id ?? null,
        recipientEmail: recipient.email,
        personId: recipient.personId,
        broker: brokerSlug,
        sendType: 'alert',
        event: 'sent',
        emailKey,
        subject: built.subject,
      })
    } catch (recErr) {
      console.error('[sendAlertEmailToRecipients] recordEmailEvent failed (send already went out)', {
        searchId: row.id,
        error: recErr instanceof Error ? recErr.message : String(recErr),
      })
    }
  }

  return { sent, errors }
}
