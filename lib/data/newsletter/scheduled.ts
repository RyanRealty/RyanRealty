import 'server-only'
import { createServiceClient } from '@/lib/data/client'

/**
 * Scheduled-send support (spec §4.2 UC-R5 / §13 Phase 6). The admin "Schedule"
 * control sets a newsletter to status='scheduled' with a scheduled_at; this finds
 * the ones whose time has arrived so the send cron can enqueue them. Kept in its
 * own file (raw .from() → DAL boundary) so the send-queue orchestration stays clean.
 */
export async function getDueScheduledNewsletterIds(nowIso: string): Promise<string[]> {
  const sb = createServiceClient()
  const { data } = await sb
    .from('newsletters')
    .select('id')
    .eq('status', 'scheduled')
    .not('scheduled_at', 'is', null)
    .lte('scheduled_at', nowIso)
    .order('scheduled_at', { ascending: true })
    .limit(25)
  return (data ?? []).map((r) => (r as { id: string }).id)
}
