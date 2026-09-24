import 'server-only'

/**
 * Is the document reader reading? On 2026-09-24 the reader cron ran out of
 * memory on every run from 09:35 to 16:00 UTC and nothing noticed: 744
 * documents sat unread, among them the contracts the deal terms come from.
 * This check runs from /api/cron/tc-deal-terms: when readable documents wait
 * and nothing has been read for two hours, Matt gets one text (the CRM health
 * alert, at most every 12 hours).
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { queueBrokerHealthAlert } from '@/lib/crm/broker-alerts'
import { unreadDocumentIds } from '@/lib/tc/doc-read/run'
import { READER_VERSION } from '@/lib/tc/doc-read/vision-reading'

export const STALL_AFTER_MS = 2 * 60 * 60 * 1000

export type ReaderHealth = { ok: boolean; waiting: number; lastReadAt: string | null; stalled: boolean; alerted: boolean }

export async function checkReaderHealth(sb: SupabaseClient, now: Date = new Date()): Promise<ReaderHealth> {
  const waiting = (await unreadDocumentIds(sb, 50)).length
  const { data } = await sb
    .from('tc_document_readings')
    .select('created_at')
    .eq('reader_version', READER_VERSION)
    .eq('status', 'read')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  const lastReadAt = (data?.created_at as string | undefined) ?? null
  const stalled = waiting > 0 && (!lastReadAt || now.getTime() - Date.parse(lastReadAt) > STALL_AFTER_MS)
  let alerted = false
  if (stalled) {
    alerted = await queueBrokerHealthAlert({
      key: 'tc-document-reader-stalled',
      body: `Vault document reader: ${waiting >= 50 ? '50+' : waiting} documents are waiting and nothing has been read since ${lastReadAt ? lastReadAt.slice(0, 16).replace('T', ' ') + ' UTC' : 'the current reader version shipped'}. Check /api/cron/tc-document-read in Vercel.`,
      cooldownMinutes: 720,
    })
  }
  return { ok: !stalled, waiting, lastReadAt, stalled, alerted }
}
