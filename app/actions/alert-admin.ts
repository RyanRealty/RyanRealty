'use server'

/**
 * Admin actions for the "Listings to approve" queue + per-alert engine
 * settings in the Alerts & reports hub (/admin/crm/subscriptions).
 *
 * Phase 4 item 1 (docs/plans/SEARCH_OPTIMIZATION_PLAN_2026-07-29.md §4):
 * preview-mode alerts hold their typed events in listing_alert_queue; a CRM
 * admin reviews them here. Approve/reject themselves live in
 * app/actions/saved-search-alerts.ts (approveAlertQueueItems /
 * rejectAlertQueueItems — the release re-runs compliance and sends through
 * the SAME path as the cron). This file owns the reads that feed the queue UI
 * and the broker-side engine-settings writes (preview_mode + events +
 * schedule_days).
 *
 * Access: any CRM admin (getCrmAccess), matching the sibling
 * app/actions/subscriptions-admin.ts. Inputs zod-validated.
 */

import { z } from 'zod'
import { getCrmAccess } from '@/app/actions/crm'
import {
  getListingAlertById,
  getListingAlertsByIds,
  updateListingAlertEngineSettings,
} from '@/lib/data/leads/listingAlerts'
import { listPendingAlertApprovalGroups, toAlertEngineSettings, type AlertEngineSettings, type PendingApprovalGroup, type PendingApprovalItem } from '@/lib/data/leads/listingAlertApprovals'
import {
  normalizeEventToggles,
  type AlertEventToggles,
} from '@/lib/alerts/event-detection'
import { normalizeScheduleDays, normalizeStoredCadence } from '@/lib/saved-search-cadence'
import { getFiltersSummary } from '@/lib/search-filters'
import type { ListingAlertListing } from '@/lib/crm/listing-alert-email'

// ── Types the queue tab renders ───────────────────────────────────────────────
//
// These types are NOT re-exported from here. This file carries 'use server', and
// Next emits a re-export from a server module as a RUNTIME binding — so
// `export type { AlertEngineSettings, ... }` compiled to a reference to a name
// that type-erasure had already removed, and the module threw
// "ReferenceError: AlertEngineSettings is not defined" at evaluation. That took
// /admin/crm/subscriptions to a 500 and the admin error boundary.
// Consumers import these three from lib/data/leads/listingAlertApprovals, which
// is where they are declared.

const toEngineSettings = toAlertEngineSettings

/**
 * Every pending queue row, grouped by alert (oldest events first inside each
 * group, groups ordered by their oldest pending event so the longest-waiting
 * alert leads).
 */
export async function listPendingAlertApprovalsAction(): Promise<{
  data: PendingApprovalGroup[] | null
  error: string | null
}> {
  try {
    const access = await getCrmAccess()
    if (!access) return { data: null, error: 'Unauthorized' }

    const groups = await listPendingAlertApprovalGroups()
    return { data: groups, error: null }
  } catch (err) {
    console.error('[listPendingAlertApprovalsAction]', err)
    return { data: null, error: 'Could not load the approval queue' }
  }
}

/** Engine settings for one alert (the settings dialog self-fetches by id). */
export async function getAlertEngineSettingsAction(id: string): Promise<{
  data: AlertEngineSettings | null
  error: string | null
}> {
  try {
    const access = await getCrmAccess()
    if (!access) return { data: null, error: 'Unauthorized' }
    const cleanId = String(id ?? '').trim()
    if (!cleanId) return { data: null, error: 'Missing alert id' }
    const row = await getListingAlertById(cleanId)
    if (!row) return { data: null, error: 'Alert not found' }
    return { data: toEngineSettings(row), error: null }
  } catch (err) {
    console.error('[getAlertEngineSettingsAction]', err)
    return { data: null, error: 'Could not load alert settings' }
  }
}

// Full six-key map required, mirroring the consumer action — the dialog
// renders all six switches, so a write always carries the complete map.
const eventTogglesSchema = z
  .object({
    new: z.boolean(),
    price_change: z.boolean(),
    status_change: z.boolean(),
    back_on_market: z.boolean(),
    sold: z.boolean(),
    open_house: z.boolean(),
  })
  .strict()

const patchSchema = z
  .object({
    previewMode: z.boolean().optional(),
    events: eventTogglesSchema.optional(),
    scheduleDays: z.array(z.number().int().min(0).max(6)).max(7).nullable().optional(),
  })
  .strict()

/**
 * Broker-side engine-settings write: preview_mode toggle, event toggles,
 * weekly schedule days. Any subset; at least one field must change.
 */
export async function updateAlertEngineSettingsAction(
  id: string,
  patch: unknown,
): Promise<{ data: { ok: true } | null; error: string | null }> {
  try {
    const access = await getCrmAccess()
    if (!access) return { data: null, error: 'Unauthorized' }
    const cleanId = String(id ?? '').trim()
    if (!cleanId) return { data: null, error: 'Missing alert id' }
    const parsed = patchSchema.safeParse(patch)
    if (!parsed.success) return { data: null, error: 'Those settings are not valid' }

    const fields: Parameters<typeof updateListingAlertEngineSettings>[1] = {}
    if (parsed.data.previewMode !== undefined) fields.previewMode = parsed.data.previewMode
    if (parsed.data.events !== undefined) fields.events = parsed.data.events
    if (parsed.data.scheduleDays !== undefined) {
      fields.scheduleDays = normalizeScheduleDays(parsed.data.scheduleDays)
    }
    if (Object.keys(fields).length === 0) return { data: null, error: 'Nothing to change' }

    const result = await updateListingAlertEngineSettings(cleanId, fields)
    if (!result.ok) return { data: null, error: 'Could not save those settings' }
    return { data: { ok: true }, error: null }
  } catch (err) {
    console.error('[updateAlertEngineSettingsAction]', err)
    return { data: null, error: 'Could not save those settings' }
  }
}
