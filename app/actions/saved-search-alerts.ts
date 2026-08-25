'use server'

import { createServiceClient } from '@/lib/supabase/service'
import { getCachedSearchListings } from '@/app/actions/search-cache'
import { getAreaIdsFromFilters, resolveAreasToShapeSet } from '@/lib/alerts/area-resolve'
import { getAreasByIds, type SearchShapes } from '@/lib/data'
import type { ListingTileRow } from '@/app/actions/listings'
import { hasNarrowingFilter } from '@/lib/search-filters'
import {
  getActiveListingAlertsDue,
  getListingAlertsByIds,
  getListingAlertById,
  markListingAlertNotified,
  claimListingAlertSend,
  restoreListingAlertCursor,
  type ListingAlertRow,
} from '@/lib/data/leads/listingAlerts'
import {
  enqueueAlertQueueItems,
  getAlertQueueItemsByIds,
  markAlertQueueDecision,
  type ListingAlertQueueRow,
} from '@/lib/data/leads/listingAlertQueue'
import {
  getListingEventStatesByKeys,
  type ListingEventState,
} from '@/lib/data/listings/getListingEventStates'
import {
  detectListingEvents,
  normalizeEventToggles,
  parseNotifiedState,
  type ListingEventSource,
  type NotifiedEntry,
} from '@/lib/alerts/event-detection'
import { planAlertDelivery } from '@/lib/alerts/delivery-plan'
import {
  buildEventSections,
  eventToCard,
  payloadsToSections,
  resolveRecipientsWithCompliance,
  sendAlertEmailToRecipients,
  tileToEventSource,
} from '@/lib/alerts/send'
import { linkAlertRowToPerson } from '@/lib/data/crm/resolvePersonForTracking'
import { buildHiddenKeySet, excludeHiddenListings } from '@/components/search/hidden-exclusion'
import { getCrmAccess } from '@/app/actions/crm'

/**
 * The ONE listing-alert send engine, over the unified public.listing_alerts
 * table — upgraded (Phase 3, docs/plans/SEARCH_OPTIMIZATION_PLAN_2026-07-29.md)
 * from "new result-set keys" to TYPED EVENTS:
 *
 * - lib/alerts/event-detection.ts diffs the alert's per-key notified state
 *   against the current match set (+ a lightweight status lookup for departed
 *   keys) into new / price_change / status_change / back_on_market / sold /
 *   open_house events, filtered by the alert's per-row toggle map.
 * - One email per alert per run, all fired events grouped in labeled sections.
 * - Weekly cadence honors schedule_days (per-day-of-week, Flexmls model) via
 *   lib/saved-search-cadence.ts.
 * - preview_mode alerts queue their events in listing_alert_queue instead of
 *   sending; approveAlertQueueItems releases them through the SAME send path.
 * - Multi-recipient: primary + recipients[] household entries, each with its
 *   own unsubscribe token, each compliance-gated (hard-stop + suppression)
 *   individually — the fan-out machinery lives in lib/alerts/send.ts.
 */

type AlertRunSummary = {
  scanned: number
  sent: number
  skipped: number
  /** Preview-mode alerts whose events were held in listing_alert_queue. */
  queued: number
  errors: Array<{ searchId: string; error: string }>
}

/**
 * Max EMAILS one run may send, across ALL alerts (scans are cheap — the
 * neighborhood defaults collapse to a few dozen cached filter sets — but each
 * send is a Resend call). Bounds the first-send wave of a mass rollout to a
 * smooth drip instead of a single burst that hurts deliverability.
 */
const MAX_SENDS_PER_RUN = 200

// Cadence due-logic is shared with every write path (validators, /account
// Select, broker attach) so a stored 'monthly' can never be coerced to a
// faster cadence here — the exact bug this import replaced (a local
// normalizeFrequency defaulted unknown values to daily). Weekly schedule_days
// gating (0=Sunday..6=Saturday, America/Los_Angeles) lives in the same module.
import { isCadenceDue } from '@/lib/saved-search-cadence'

/**
 * Hidden homes for one signed-in subscriber ("Hide homes I don't want to
 * see"). Runs on the service client (cron context — no user session).
 * Fail-soft by design: any error, INCLUDING the hidden_listings table not
 * being migrated yet, returns an empty set so alerts keep flowing — the
 * user just is not shielded until the table exists.
 */
async function fetchHiddenKeysForUser(userId: string): Promise<Set<string>> {
  try {
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('hidden_listings')
      .select('listing_key')
      .eq('user_id', userId)
    if (error) return new Set()
    return buildHiddenKeySet((data ?? []).map((r: { listing_key: string }) => r.listing_key))
  } catch {
    return new Set()
  }
}

export async function runListingAlerts(options?: {
  maxAlerts?: number
  dryRun?: boolean
  /**
   * Send these specific alert rows NOW, ignoring the cadence gate.
   *
   * The buyer LP promises "your first batch of matches in 30 minutes", and
   * before 2026-08-25 nothing delivered it: the submission minted the row and
   * left it to the hourly cron, so the real wait was up to a full cadence
   * period. The LP now calls this straight after minting so the first batch
   * goes out while the buyer is still on the page.
   *
   * Deliberately routed through THIS function rather than a second sender —
   * compliance stops, event toggles, ODS/VOW rules, preview-mode queuing and
   * the notified-key cursor all have exactly one implementation. Advancing the
   * cursor on the way out is what stops the next cron run resending the batch.
   */
  alertIds?: string[]
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
  // A targeted first send reads its rows by id; is_active is re-checked here
  // because getListingAlertsByIds has no status filter of its own, and a row
  // born muted by the resurrection guard must stay muted.
  const targeted = (options?.alertIds ?? []).filter(Boolean)
  const rows: ListingAlertRow[] = targeted.length
    ? (await getListingAlertsByIds(targeted)).filter((r) => r.is_active !== false)
    : await getActiveListingAlertsDue(maxAlerts)
  const summary: AlertRunSummary = { scanned: rows.length, sent: 0, skipped: 0, queued: 0, errors: [] }

  // Per-run memo of each signed-in subscriber's hidden homes — one user can
  // hold several alert rows, and the set is stable within a single run.
  const hiddenByUser = new Map<string, Set<string>>()
  const hiddenSetFor = async (userId: string): Promise<Set<string>> => {
    const cached = hiddenByUser.get(userId)
    if (cached) return cached
    const fetched = await fetchHiddenKeysForUser(userId)
    hiddenByUser.set(userId, fetched)
    return fetched
  }

  for (const row of rows) {
    try {
      // Send budget spent — stop scanning; the next cron run resumes with the
      // most-overdue rows (getActiveListingAlertsDue orders by last_notified_at).
      if (summary.sent >= MAX_SENDS_PER_RUN) break

      // Cadence gate — includes the weekly schedule_days day-of-week filter
      // (0=Sunday..6=Saturday, America/Los_Angeles). A targeted first send
      // skips it: the row was created seconds ago and has never been due.
      if (targeted.length === 0 && !isCadenceDue(row, now)) {
        summary.skipped += 1
        continue
      }

      // Every due row that we DECIDE not to email (no events, prefs off,
      // stops, preview hold) still advances last_notified_at. The scan is
      // ordered most-overdue-first, so a due row that never advances would sit
      // at the front of every run and starve the rest of the queue. Advancing
      // on an empty check is also semantically right: "checked through <now>,
      // nothing new" — the next check only looks for changes after this stamp.
      const advanceCursor = async (nextState?: NotifiedEntry[]) => {
        if (!dryRun) await markListingAlertNotified(row.id, now.toISOString(), nextState)
        summary.skipped += 1
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
      if (!hasNarrowingFilter(filters)) {
        console.error('[runListingAlerts] skipping alert with empty filters', { searchId: row.id })
        await advanceCursor()
        continue
      }
      // Named areas: areaIds resolve to their stored shape sets. A null resolve
      // (deleted/empty areas) means "matches nothing". Skip + advance, never
      // widen to an unshaped search (same guard class as empty filters).
      const areaIds = getAreaIdsFromFilters(filters)
      let areaShapes: SearchShapes | undefined
      if (areaIds.length > 0) {
        const resolved = resolveAreasToShapeSet(await getAreasByIds(areaIds))
        if (!resolved) {
          console.error('[runListingAlerts] areaIds resolved to no shapes, skipping', { searchId: row.id, areaIds })
          await advanceCursor()
          continue
        }
        areaShapes = resolved
      }
      const results = await getCachedSearchListings(filters, 1, 15, areaShapes)
      // Hidden homes ("Hide homes I don't want to see"): excluded from the
      // matched set BEFORE the event diff below, so a hidden home never fires
      // an event, never lands in an email, and never enters the notified
      // state. Guest rows (no user_id) have no hidden set.
      const hiddenSet = row.user_id ? await hiddenSetFor(row.user_id) : null
      const matchedListings =
        hiddenSet && hiddenSet.size > 0
          ? excludeHiddenListings(results.listings, hiddenSet)
          : results.listings
      const listingKeyOf = (l: ListingTileRow): string =>
        String(l.ListNumber ?? l.ListingKey ?? '').trim()

      const tileByKey = new Map<string, ListingTileRow>()
      for (const tile of matchedListings) {
        const key = listingKeyOf(tile)
        if (key && !tileByKey.has(key)) tileByKey.set(key, tile)
      }
      const currentKeys = [...tileByKey.keys()]

      // Previously-notified state (typed entries + legacy plain keys).
      const { entries: prevEntries } = parseNotifiedState(
        row.notified_listing_keys,
        row.last_notified_at,
      )

      // ONE lightweight listings lookup covers both needs: event-history
      // columns for the current matches AND sold/pending classification for
      // previously-notified keys that left the match window.
      const lookupKeys = [...new Set([...currentKeys, ...prevEntries.keys()])]
      const stateByKey = lookupKeys.length
        ? await getListingEventStatesByKeys(lookupKeys, now)
        : new Map<string, ListingEventState>()

      const currentSources: ListingEventSource[] = currentKeys.map((key) => {
        const state = stateByKey.get(key)
        // Fail-soft: a lookup miss still classifies "new vs seen" correctly
        // from the tile row; the history-based deltas just stay silent.
        return state ?? tileToEventSource(tileByKey.get(key) as ListingTileRow, key)
      })
      const departedLookup: ListingEventState[] = []
      for (const key of prevEntries.keys()) {
        if (tileByKey.has(key)) continue
        const state = stateByKey.get(key)
        if (state) departedLookup.push(state)
      }

      const detection = detectListingEvents({
        prevRaw: row.notified_listing_keys,
        lastNotifiedAt: row.last_notified_at,
        currentMatches: currentSources,
        departedLookup,
        now,
      })

      // Back-compat seeding: rows written before the notified-keys column
      // (no stored keys but a last_notified_at) would classify EVERY current
      // match as "new". Keep the old timestamp heuristic for exactly that
      // case — only listings on-market/modified since the last notify fire;
      // the rest are absorbed into the new typed state without an event.
      let events = detection.events
      if (prevEntries.size === 0 && row.last_notified_at) {
        const sinceMs = Date.parse(row.last_notified_at)
        if (Number.isFinite(sinceMs)) {
          events = events.filter((event) => {
            if (event.type !== 'new') return true
            const tile = tileByKey.get(event.listingKey)
            const stamp = tile?.OnMarketDate ?? tile?.ModificationTimestamp
            const onMarket = stamp ? Date.parse(stamp) : NaN
            return !Number.isFinite(onMarket) || onMarket > sinceMs
          })
        }
      }

      const toggles = normalizeEventToggles(row.events)
      const previewMode = row.preview_mode === true

      // Recipient set + per-recipient compliance (hard-stop + suppression on
      // EVERY recipient — §1: a later opt-out always wins over the opt-in).
      const { recipients, compliance, primaryPerson } = await resolveRecipientsWithCompliance(
        row,
        dryRun,
      )

      const plan = planAlertDelivery({
        events,
        toggles,
        previewMode,
        recipients,
        compliance,
        // ODS: sold data is VOW-only. A guest capture row (no user_id) never
        // gets sold events, whatever the stored toggle says.
        vowEligible: Boolean(row.user_id),
      })

      if (plan.action === 'skip') {
        // P12: durable gate-drop on admin_actions (Matt lock: no new table).
        if (!dryRun) {
          void import('@/app/actions/log-admin-action')
            .then(({ logAdminAction }) =>
              logAdminAction({
                adminEmail: 'system:listing-alerts',
                role: 'system',
                actionType: 'alert_gate_drop',
                resourceType: 'listing_alert',
                resourceId: row.id,
                details: {
                  reason: plan.reason ?? 'skip',
                  action: 'skip',
                  events: plan.events?.length ?? 0,
                },
              }),
            )
            .catch(() => {})
        }
        // A compliance stop is not proof the subscriber SAW these listings.
        // isSuppressedByEmail fails CLOSED, so one transient DB blip would
        // otherwise persist nextState and permanently absorb those events —
        // the listings would never be mentioned again (audit 2026-07-30).
        // Advance the cursor only; keep the notified state untouched so a real
        // stop stays quiet while a transient one recovers on the next run.
        if (plan.reason === 'all_recipients_stopped') await advanceCursor()
        else await advanceCursor(detection.nextState)
        continue
      }

      // Write back an email-match resolution so the next send is pre-linked
      // (person was resolved once, above, before the compliance gates).
      // Unresolved sends untracked (attribution only) by design.
      if (!dryRun && primaryPerson.personId && primaryPerson.resolvedBy === 'email') {
        await linkAlertRowToPerson(row.id, primaryPerson.personId)
      }

      if (plan.action === 'queue') {
        // Preview mode: hold every event for broker approval instead of
        // sending. The notified cursor still advances — an approved release
        // sends from the queued payload, and a rejection means the subscriber
        // simply never hears about that event.
        if (!dryRun) {
          const items = plan.events
            .map((event) => {
              const card = eventToCard(event, tileByKey, stateByKey, siteUrl)
              if (!card) return null
              return {
                alertId: row.id,
                listingKey: event.listingKey,
                eventType: event.type,
                eventPayload: { event, card } as unknown as Record<string, unknown>,
              }
            })
            .filter((item): item is NonNullable<typeof item> => item != null)
          const queueResult = await enqueueAlertQueueItems(items)
          if (!queueResult.ok) {
            summary.errors.push({ searchId: row.id, error: queueResult.error ?? 'queue failed' })
            continue
          }
        }
        summary.queued += 1
        await advanceCursor(detection.nextState)
        continue
      }

      // plan.action === 'send'
      const { sections, totalEvents } = buildEventSections({
        events: plan.events,
        tileByKey,
        stateByKey,
        siteUrl,
      })
      if (sections.length === 0) {
        // Every fired event failed card resolution — nothing renderable.
        await advanceCursor(detection.nextState)
        continue
      }
      const deliverEmails = new Set(plan.deliverTo.map((r) => r.email))
      const deliverTo = recipients.filter((r) => deliverEmails.has(r.email))

      // Claim-before-send (P12): stamp the cursor BEFORE Resend so a successful
      // delivery can never re-blast when a post-send mark fails. On total
      // failure we restore the previous cursor so a true retry remains due.
      const claimIso = now.toISOString()
      const prevNotifiedAt = row.last_notified_at
      const prevKeys = row.notified_listing_keys
      if (!dryRun) {
        const claimed = await claimListingAlertSend(
          row.id,
          prevNotifiedAt,
          claimIso,
          detection.nextState,
        )
        if (!claimed.ok) {
          summary.errors.push({
            searchId: row.id,
            error: claimed.error ?? 'claim failed',
          })
          continue
        }
      }

      const sendResult = await sendAlertEmailToRecipients({
        row,
        deliverTo,
        sections,
        totalCount: totalEvents,
        siteUrl,
        runDate,
        dryRun,
      })
      for (const error of sendResult.errors) {
        summary.errors.push({ searchId: row.id, error })
      }
      if (sendResult.sent === 0) {
        // Every Resend call failed — restore the prior cursor so the next run
        // can retry (claim already advanced last_notified_at).
        if (!dryRun) {
          const restored = await restoreListingAlertCursor(row.id, prevNotifiedAt, prevKeys)
          if (!restored.ok) {
            console.error('[runListingAlerts] failed to restore cursor after send failure', {
              searchId: row.id,
              error: restored.error,
            })
            summary.errors.push({
              searchId: row.id,
              error: restored.error ?? 'restore after send failure failed',
            })
          }
        }
        continue
      }

      summary.sent += sendResult.sent
    } catch (error) {
      summary.errors.push({
        searchId: row.id,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return summary
}

// ── Preview-queue admin actions ───────────────────────────────────────────────

type QueueDecisionSummary = {
  ok: boolean
  /** Queue rows whose status actually transitioned. */
  decided: number
  /** Emails delivered (approve path only). */
  sent: number
  error?: string
}

/**
 * Approve held preview-mode queue items and send them IMMEDIATELY through the
 * same send path the cron uses (compliance gates re-run per recipient at
 * release time — a stop that landed while the item waited still blocks).
 * Admin-gated like the sibling subscriptions-hub actions (getCrmAccess).
 */
export async function approveAlertQueueItems(ids: string[]): Promise<QueueDecisionSummary> {
  const access = await getCrmAccess()
  if (!access) return { ok: false, decided: 0, sent: 0, error: 'Unauthorized' }

  const moved = await markAlertQueueDecision(ids, 'approved', access.email)
  if (!moved.ok) return { ok: false, decided: 0, sent: 0, error: moved.error }
  if (moved.ids.length === 0) return { ok: true, decided: 0, sent: 0 }

  const items = await getAlertQueueItemsByIds(moved.ids, 'approved')
  const byAlert = new Map<string, ListingAlertQueueRow[]>()
  for (const item of items) {
    const list = byAlert.get(item.alert_id) ?? []
    list.push(item)
    byAlert.set(item.alert_id, list)
  }

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
  const runDate = new Date().toISOString().slice(0, 10)
  let sent = 0
  const errors: string[] = []

  for (const [alertId, alertItems] of byAlert) {
    const row = await getListingAlertById(alertId)
    if (!row || row.is_active === false) {
      errors.push(`alert ${alertId} missing or inactive`)
      continue
    }
    const { sections, totalCount } = payloadsToSections(alertItems)
    if (sections.length === 0) {
      errors.push(`alert ${alertId}: no renderable cards in queue payload`)
      continue
    }
    const { recipients, compliance } = await resolveRecipientsWithCompliance(row, false)
    const deliverTo = recipients.filter((r) => {
      const c = compliance.get(r.email)
      return c ? !c.hardStopped && !c.suppressed : false
    })
    if (deliverTo.length === 0) {
      errors.push(`alert ${alertId}: every recipient is compliance-stopped`)
      continue
    }
    const result = await sendAlertEmailToRecipients({
      row,
      deliverTo,
      sections,
      totalCount,
      siteUrl,
      runDate,
      dryRun: false,
    })
    errors.push(...result.errors)
    if (result.sent > 0) {
      sent += result.sent
      await markAlertQueueDecision(
        alertItems.map((i) => i.id),
        'sent',
        access.email,
        'approved',
      )
    }
  }

  return {
    ok: errors.length === 0,
    decided: moved.ids.length,
    sent,
    ...(errors.length > 0 ? { error: errors.join('; ') } : {}),
  }
}

/** Reject held preview-mode queue items (they simply never send). Admin-gated. */
export async function rejectAlertQueueItems(ids: string[]): Promise<QueueDecisionSummary> {
  const access = await getCrmAccess()
  if (!access) return { ok: false, decided: 0, sent: 0, error: 'Unauthorized' }
  const moved = await markAlertQueueDecision(ids, 'rejected', access.email)
  if (!moved.ok) return { ok: false, decided: 0, sent: 0, error: moved.error }
  return { ok: true, decided: moved.ids.length, sent: 0 }
}
