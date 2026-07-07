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
  type ListAlertSubscriptionsOptions,
  type ListAlertSubscriptionsResult,
  type ListReportSubscriptionsOptions,
  type AdminReportSubscriptionRow,
  type AlertSubscriptionKind,
} from '@/lib/data/crm/subscriptionsAdmin'

const MAX_BULK_IDS = 500

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
