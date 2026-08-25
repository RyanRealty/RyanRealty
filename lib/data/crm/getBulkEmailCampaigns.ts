import 'server-only'
import { unstable_cache } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'
import {
  summarizeCampaign,
  type CampaignEngagement,
  type RawEmailEventRow,
} from './getEmailReporting'

/**
 * Batch emails sent from the CRM People list, for the Batch Emails report.
 *
 * The report was built around `email_campaigns`, which only the one-off email
 * admin (app/actions/admin-email.ts) writes. A batch sent from the People list
 * runs through the bulk-job pipeline instead: it records a crm_bulk_jobs row and
 * a full email_events fan (sent / delivered / open / click) keyed on
 * `bulk:email-cohort:<jobId>`, and never touches email_campaigns. So the report
 * said "No batch emails found" while every one of those sends was fully tracked
 * one table over. This reader is the missing half.
 *
 * The job row is the campaign record: it holds the un-merged subject the broker
 * typed (each recipient's delivered subject has their own name merged into it,
 * so no single event subject is "the" campaign subject), who sent it, and the
 * cohort size. Engagement still comes from email_events, tallied with the same
 * summarizeCampaign the email_campaigns path uses — one honest-rate rule, not a
 * second copy.
 *
 * DAL boundary (G1): the raw crm_bulk_jobs / email_events reads live here.
 */

/** email_key every email-cohort job stamps on its events. */
export function cohortEmailKeyForJob(jobId: number): string {
  return `bulk:email-cohort:${jobId}`
}

export type BulkEmailCampaign = {
  jobId: number
  emailKey: string
  /** The subject as typed, merge tokens intact. Null when the job used a template. */
  subject: string | null
  /** Signed-in broker who ran the batch. */
  actorEmail: string
  /** Broker slug the job was scoped to, when the sender was a restricted broker. */
  brokerScope: string | null
  status: string
  createdAtIso: string
  finishedAtIso: string | null
  /** Cohort size frozen on the job. */
  total: number
  engagement: CampaignEngagement
}

type JobRow = {
  id: number
  params: { subject?: string | null; templateId?: number | null } | null
  actor_email: string
  broker_scope: string | null
  status: string
  total: number | null
  processed: number
  created_at: string
  finished_at: string | null
}

async function readBulkEmailCampaigns(
  limit: number,
  brokerScope: string | null,
): Promise<{ rows: BulkEmailCampaign[]; unreadable: boolean }> {
  const sb = createServiceClient()

  let jobQuery = sb
    .from('crm_bulk_jobs')
    .select('id,params,actor_email,broker_scope,status,total,processed,created_at,finished_at')
    .eq('kind', 'email-cohort')
    .order('created_at', { ascending: false })
    .limit(limit)
  // A restricted broker sees only the batches run under their own scope.
  if (brokerScope) jobQuery = jobQuery.eq('broker_scope', brokerScope)

  const { data: jobs, error: jobErr } = await jobQuery
  // Fail SOFT but HONEST: an unreadable table is reported as unreadable, never
  // as "no campaigns" (a swallowed error here would read as a clean empty state).
  if (jobErr) return { rows: [], unreadable: true }
  const jobRows = (jobs ?? []) as JobRow[]
  if (jobRows.length === 0) return { rows: [], unreadable: false }

  const keys = jobRows.map((j) => cohortEmailKeyForJob(j.id))
  const SELECT = 'message_id,recipient_email,person_id,broker,send_type,event,email_key,subject,occurred_at'

  // Pass 1 — everything the send path and the trackers wrote, which all carry
  // the campaign's email_key: sent, open, click.
  const { data: keyed, error: evErr } = await sb
    .from('email_events')
    .select(SELECT)
    .in('email_key', keys)
  if (evErr) return { rows: [], unreadable: true }
  const keyedRows = (keyed ?? []) as RawEmailEventRow[]

  const buckets = new Map<string, RawEmailEventRow[]>()
  const keyByMessageId = new Map<string, string>()
  for (const r of keyedRows) {
    const key = (r.email_key ?? '').trim()
    if (!key) continue
    const arr = buckets.get(key)
    if (arr) arr.push(r)
    else buckets.set(key, [r])
    const mid = (r.message_id ?? '').trim()
    if (mid) keyByMessageId.set(mid, key)
  }

  // Pass 2 — the provider webhooks. Resend posts delivered / bounce / complaint
  // keyed on the message id ONLY: those rows have a null email_key, so pass 1
  // cannot see them and a campaign would read zero deliveries (and therefore a
  // "—" open rate, since the denominator is deliveries). The sent rows carry the
  // message id, so they are the bridge back to the campaign.
  const messageIds = [...keyByMessageId.keys()]
  if (messageIds.length > 0) {
    const { data: byMid, error: midErr } = await sb
      .from('email_events')
      .select(SELECT)
      .in('message_id', messageIds)
      .is('email_key', null)
    if (midErr) return { rows: [], unreadable: true }
    for (const r of (byMid ?? []) as RawEmailEventRow[]) {
      const key = keyByMessageId.get((r.message_id ?? '').trim())
      if (!key) continue
      // summarizeEngagement keys a send on (message_id) when present, so these
      // rows tally per recipient exactly like the keyed ones.
      const arr = buckets.get(key)
      if (arr) arr.push(r)
      else buckets.set(key, [r])
    }
  }

  const rows = jobRows.map((j): BulkEmailCampaign => {
    const emailKey = cohortEmailKeyForJob(j.id)
    return {
      jobId: j.id,
      emailKey,
      subject: j.params?.subject?.trim() || null,
      actorEmail: j.actor_email,
      brokerScope: j.broker_scope,
      status: j.status,
      createdAtIso: j.created_at,
      finishedAtIso: j.finished_at,
      total: j.total ?? j.processed,
      engagement: summarizeCampaign(buckets.get(emailKey) ?? []),
    }
  })

  return { rows, unreadable: false }
}

/** Cached (60s, same TTL as the rest of the email reporting DAL). */
export async function getBulkEmailCampaigns(
  limit = 50,
  brokerScope: string | null = null,
): Promise<{ rows: BulkEmailCampaign[]; unreadable: boolean }> {
  const cap = Math.min(Math.max(1, Math.trunc(limit)), 100)
  const cached = unstable_cache(
    () => readBulkEmailCampaigns(cap, brokerScope),
    ['crm-bulk-email-campaigns', String(cap), brokerScope ?? 'all'],
    { tags: ['crm-email-reporting'], revalidate: 60 },
  )
  return cached()
}
