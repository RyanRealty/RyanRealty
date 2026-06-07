import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'

/**
 * DAL for signed-in saved-search alert unsubscribe (one-click from the alert
 * email). Lives in lib/data so the /alerts/unsubscribe page satisfies G8.
 * Service-role only.
 */

/**
 * Pause a signed-in saved search by its email unsubscribe token (one-click).
 * Sets is_paused so the alert cron skips it; the user can resume from
 * /account/saved-searches. matched=false means the token was not a saved-search
 * token (it may be a guest token instead).
 */
export async function pauseSavedSearchByToken(token: string): Promise<{ ok: boolean; matched: boolean; error?: string }> {
  const trimmed = (token ?? '').trim()
  if (!trimmed) return { ok: true, matched: false }
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('saved_searches')
    .update({ is_paused: true })
    .eq('unsubscribe_token', trimmed)
    .select('id')
  if (error) {
    console.error('[pauseSavedSearchByToken]', error.message)
    return { ok: false, matched: false, error: 'pause_failed' }
  }
  return { ok: true, matched: (data?.length ?? 0) > 0 }
}
