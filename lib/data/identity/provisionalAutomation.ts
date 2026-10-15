/**
 * Clear a PROVISIONAL automation flag (lib/analytics/automation.ts
 * PROVISIONAL_AUTOMATION_REASONS: a cold arrival that read as a machine) once
 * the session shows it is a person: an event that is person evidence
 * (isPersonEvidence, the track route) or identification (every identify path).
 *
 * Only rows carrying a provisional reason match, so a flag from the user agent,
 * navigator.webdriver, our marker or a broker's browser is never touched. DAL
 * boundary (G1): the raw .from() lives here, shared by the track route
 * (lib/data/identity/sessionIdentity.ts) and the identify paths
 * (lib/visitor-backfill.ts). Never throws: tracking and identification must not
 * break on it; a flag left on only drops one session from the counts.
 */
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { PROVISIONAL_AUTOMATION_REASONS } from '@/lib/analytics/automation'

const MISSING_AUTOMATION_COLUMNS = /is_automated|automation_reason|does not exist|schema cache/i

/** Clear provisional flags on one session (`session_id`) or every session of one browser (`rr_vid`). */
export async function clearProvisionalFlags(
  sb: SupabaseClient,
  match: { column: 'session_id' | 'rr_vid'; value: string },
): Promise<void> {
  if (!match.value) return
  try {
    const res = await sb
      .from('visitor_sessions')
      .update({ is_automated: false, automation_reason: null })
      .eq(match.column, match.value)
      .in('automation_reason', [...PROVISIONAL_AUTOMATION_REASONS])
    if (res?.error && !MISSING_AUTOMATION_COLUMNS.test(res.error.message ?? '')) {
      console.warn('[provisional-automation] clear failed:', res.error.message)
    }
  } catch (e) {
    console.warn('[provisional-automation] clear failed:', e instanceof Error ? e.message : String(e))
  }
}
