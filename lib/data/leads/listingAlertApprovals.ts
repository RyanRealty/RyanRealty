import 'server-only'

// Pending-approval groups (admin subscriptions hub). Lives in its OWN module
// (not listingAlertQueue.ts) so its reads go through the exported bindings of
// the queue/alerts modules — mockable in tests, and one module per concern.

import { listPendingAlertQueue } from '@/lib/data/leads/listingAlertQueue'
import { getListingAlertsByIds } from '@/lib/data/leads/listingAlerts'
import { normalizeEventToggles, type AlertEventToggles } from '@/lib/alerts/event-detection'
import { normalizeScheduleDays, normalizeStoredCadence } from '@/lib/saved-search-cadence'
import { getFiltersSummary } from '@/lib/search-filters'
import type { ListingAlertListing } from '@/lib/crm/listing-alert-email'

export type AlertEngineSettings = {
  id: string
  name: string
  email: string
  isActive: boolean
  frequency: string
  previewMode: boolean
  events: AlertEventToggles
  scheduleDays: number[] | null
}

export type PendingApprovalItem = {
  id: string
  listingKey: string
  eventType: string
  createdAt: string | null
  /** The listing card snapshot the engine queued (event_payload.card). */
  card: ListingAlertListing | null
}

export type PendingApprovalGroup = {
  alert: AlertEngineSettings & { filtersSummary: string }
  items: PendingApprovalItem[]
}

export function toAlertEngineSettings(row: {
  id: string
  name: string | null
  email: string
  is_active: boolean | null
  notification_frequency: string | null
  preview_mode?: boolean | null
  events?: Record<string, unknown> | null
  schedule_days?: number[] | null
}): AlertEngineSettings {
  return {
    id: row.id,
    name: row.name?.trim() || 'Saved search',
    email: row.email,
    isActive: row.is_active !== false,
    frequency: normalizeStoredCadence(row.notification_frequency),
    previewMode: row.preview_mode === true,
    events: normalizeEventToggles(row.events),
    scheduleDays: normalizeScheduleDays(row.schedule_days),
  }
}

/** Every pending queue row grouped by alert. Orphaned rows (alert deleted
 *  since queueing) are dropped: no subscriber left to send to. Authz is the
 *  caller's job (admin layout or getCrmAccess in the action wrapper). */
export async function listPendingAlertApprovalGroups(): Promise<PendingApprovalGroup[]> {
  const pending = await listPendingAlertQueue()
  if (pending.length === 0) return []
  const byAlert = new Map<string, typeof pending>()
  for (const row of pending) {
    const list = byAlert.get(row.alert_id) ?? []
    list.push(row)
    byAlert.set(row.alert_id, list)
  }
  const alerts = await getListingAlertsByIds([...byAlert.keys()])
  const alertById = new Map(alerts.map((a) => [a.id, a]))
  const groups: PendingApprovalGroup[] = []
  for (const [alertId, items] of byAlert) {
    const alert = alertById.get(alertId)
    if (!alert) continue
    groups.push({
      alert: {
        ...toAlertEngineSettings(alert),
        filtersSummary: getFiltersSummary((alert.filters ?? {}) as Record<string, unknown>),
      },
      items: items.map((row) => {
        const payload = (row.event_payload ?? {}) as { card?: ListingAlertListing }
        const card =
          payload.card && typeof payload.card === 'object' && typeof payload.card.detailUrl === 'string'
            ? payload.card
            : null
        return {
          id: row.id,
          listingKey: row.listing_key,
          eventType: row.event_type,
          createdAt: row.created_at,
          card,
        }
      }),
    })
  }
  return groups
}

