/**
 * Stored GA4 client_id on a CRM contact.
 *
 * Lead attribution (fireLeadGenerated) reads the `_ga` cookie at submit and
 * used to send generate_lead with it, then drop it. Offline conversions run
 * later from cron and have no request cookies, so the cookie value has to live
 * on the contact. First-touch: the first valid client_id wins.
 *
 * A usable id is the last two numeric parts of `_ga` (`digits.digits`).
 * A uuid minted by fireGa4Event when the cookie is missing is not stored and
 * is not treated as usable — that user never existed in GA4.
 */
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/lib/supabase/service'

export const GA_CLIENT_ID_CUSTOM_KEY = 'gaClientId'

/** True `_ga` client_id (`1234567890.1700000000`). Rejects uuids and empty strings. */
export function parseGaClientId(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!/^\d+\.\d+$/.test(trimmed)) return null
  return trimmed
}

export function gaClientIdFromCustom(custom: unknown): string | null {
  if (!custom || typeof custom !== 'object' || Array.isArray(custom)) return null
  const bag = custom as Record<string, unknown>
  return parseGaClientId(bag[GA_CLIENT_ID_CUSTOM_KEY] ?? bag.ga_client_id ?? bag.client_id)
}

/** Persist the first valid client_id on the contact. Fail-soft: never throws. */
export async function rememberGaClientId(
  personId: number | null | undefined,
  clientId: string | null | undefined,
): Promise<void> {
  const parsed = parseGaClientId(clientId)
  const pid = Number(personId)
  if (!parsed || !Number.isFinite(pid) || pid <= 0) return
  try {
    const sb = createServiceClient()
    const { data, error } = await sb.from('crm_people').select('custom').eq('id', pid).maybeSingle()
    if (error || !data) return
    const existing = gaClientIdFromCustom(data.custom)
    if (existing) return
    const custom =
      data.custom && typeof data.custom === 'object' && !Array.isArray(data.custom)
        ? { ...(data.custom as Record<string, unknown>) }
        : {}
    custom[GA_CLIENT_ID_CUSTOM_KEY] = parsed
    await sb.from('crm_people').update({ custom, updated_at: new Date().toISOString() }).eq('id', pid)
  } catch (err) {
    console.warn('[gaClientId] remember failed:', err instanceof Error ? err.message : String(err))
  }
}

/** Read the stored client_id. Fail-soft: missing row or unreadable bag → null. */
export async function readStoredGaClientId(sb: SupabaseClient, personId: number): Promise<string | null> {
  try {
    const { data, error } = await sb.from('crm_people').select('custom').eq('id', personId).maybeSingle()
    if (error || !data) return null
    return gaClientIdFromCustom(data.custom)
  } catch {
    return null
  }
}
