import 'server-only'
import { unstable_cache } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'
import type { EmailEvent } from '@/lib/crm/email-events'
import {
  inheritEmailKeys,
  summarizeCampaign,
  type CampaignEngagement,
  type RawEmailEventRow,
} from './getEmailReporting'
import { readLastSiteByPerson } from './getVisitorLastSeen'

const EVENT_SELECT =
  'message_id,recipient_email,person_id,broker,send_type,event,email_key,subject,occurred_at,meta'
const PAGE = 1000
const IN_CHUNK = 200

type EventRow = RawEmailEventRow & { meta?: { url?: string; clickUrl?: string } | null }

/** PostgREST caps a select at 1000 rows. A 2,714-person send is more than that. */
async function readEventPages(
  apply: (from: number, to: number) => Promise<{ data: EventRow[] | null; error: { message: string } | null }>,
): Promise<{ rows: EventRow[]; unreadable: boolean }> {
  const out: EventRow[] = []
  for (let from = 0; from < 80_000; from += PAGE) {
    const { data, error } = await apply(from, from + PAGE - 1)
    if (error) return { rows: [], unreadable: true }
    const page = (data ?? []) as EventRow[]
    out.push(...page)
    if (page.length < PAGE) break
  }
  return { rows: out, unreadable: false }
}

async function eventsForEmailKeys(
  sb: ReturnType<typeof createServiceClient>,
  keys: string[],
): Promise<{ rows: EventRow[]; unreadable: boolean }> {
  if (keys.length === 0) return { rows: [], unreadable: false }
  const keyed: EventRow[] = []
  for (let i = 0; i < keys.length; i += IN_CHUNK) {
    const slice = keys.slice(i, i + IN_CHUNK)
    const page = await readEventPages(async (from, to) => {
      const r = await sb
        .from('email_events')
        .select(EVENT_SELECT)
        .in('email_key', slice)
        .order('occurred_at', { ascending: true })
        .order('id', { ascending: true })
        .range(from, to)
      return { data: r.data as EventRow[] | null, error: r.error }
    })
    if (page.unreadable) return page
    keyed.push(...page.rows)
  }

  const keyByMessageId = new Map<string, string>()
  for (const r of keyed) {
    const mid = (r.message_id ?? '').trim()
    const key = (r.email_key ?? '').trim()
    if (mid && key) keyByMessageId.set(mid, key)
  }
  const messageIds = [...keyByMessageId.keys()]
  const extras: EventRow[] = []
  for (let i = 0; i < messageIds.length; i += IN_CHUNK) {
    const slice = messageIds.slice(i, i + IN_CHUNK)
    const page = await readEventPages(async (from, to) => {
      const r = await sb
        .from('email_events')
        .select(EVENT_SELECT)
        .in('message_id', slice)
        .is('email_key', null)
        .order('occurred_at', { ascending: true })
        .order('id', { ascending: true })
        .range(from, to)
      return { data: r.data as EventRow[] | null, error: r.error }
    })
    if (page.unreadable) return page
    extras.push(...page.rows)
  }
  return { rows: inheritEmailKeys([...keyed, ...extras]), unreadable: false }
}

const LATEST_RANK: Record<string, number> = {
  sent: 0,
  delivered: 1,
  open: 2,
  click: 3,
  unsubscribe: 4,
  complaint: 5,
  bounce: 6,
}

export type CampaignRecipient = {
  email: string
  personId: number | null
  name: string | null
  subject: string | null
  sentAt: string | null
  deliveredAt: string | null
  openedAt: string | null
  clickedAt: string | null
  bouncedAt: string | null
  unsubscribedAt: string | null
  latestEvent: EmailEvent
  clickUrl: string | null
  lastSiteAt: string | null
  visitedAfterSend: boolean
}

/**
 * One row per recipient for a campaign's event fan. PURE. Site visits and
 * display names are joined after this, so those fields stay empty here.
 */
export function foldCampaignRecipients(rows: EventRow[]): CampaignRecipient[] {
  const byEmail = new Map<string, CampaignRecipient>()
  for (const r of rows) {
    const email = (r.recipient_email ?? '').trim().toLowerCase()
    if (!email) continue
    const ev = r.event as EmailEvent
    if (!(ev in LATEST_RANK)) continue
    let rec = byEmail.get(email)
    if (!rec) {
      rec = {
        email,
        personId: r.person_id,
        name: null,
        subject: r.subject,
        sentAt: null,
        deliveredAt: null,
        openedAt: null,
        clickedAt: null,
        bouncedAt: null,
        unsubscribedAt: null,
        latestEvent: ev,
        clickUrl: null,
        lastSiteAt: null,
        visitedAfterSend: false,
      }
      byEmail.set(email, rec)
    }
    rec.personId = rec.personId ?? r.person_id
    rec.subject = rec.subject ?? r.subject
    const at = r.occurred_at
    if (ev === 'sent' && (!rec.sentAt || at < rec.sentAt)) rec.sentAt = at
    if (ev === 'delivered' && (!rec.deliveredAt || at < rec.deliveredAt)) rec.deliveredAt = at
    if (ev === 'open' && (!rec.openedAt || at < rec.openedAt)) rec.openedAt = at
    if (ev === 'click' && (!rec.clickedAt || at < rec.clickedAt)) rec.clickedAt = at
    if (ev === 'bounce' && (!rec.bouncedAt || at < rec.bouncedAt)) rec.bouncedAt = at
    if (ev === 'unsubscribe' && (!rec.unsubscribedAt || at < rec.unsubscribedAt)) rec.unsubscribedAt = at
    if (ev === 'click') {
      const url = r.meta?.url || r.meta?.clickUrl
      if (url) rec.clickUrl = url
    }
    const better =
      LATEST_RANK[ev] > LATEST_RANK[rec.latestEvent] ||
      (LATEST_RANK[ev] === LATEST_RANK[rec.latestEvent] && at >= (rec.clickedAt || rec.openedAt || rec.deliveredAt || rec.sentAt || ''))
    if (better) rec.latestEvent = ev
  }
  return [...byEmail.values()].sort((a, b) => a.email.localeCompare(b.email))
}

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
  const fetched = await eventsForEmailKeys(sb, keys)
  if (fetched.unreadable) return { rows: [], unreadable: true }

  const keyByMessageId = new Map<string, string>()
  for (const r of fetched.rows) {
    const k = (r.email_key ?? '').trim()
    const mid = (r.message_id ?? '').trim()
    if (k && mid) keyByMessageId.set(mid, k)
  }
  const buckets = new Map<string, RawEmailEventRow[]>()
  for (const r of fetched.rows) {
    const key =
      (r.email_key ?? '').trim() || keyByMessageId.get((r.message_id ?? '').trim()) || ''
    if (!key) continue
    const arr = buckets.get(key)
    if (arr) arr.push(r)
    else buckets.set(key, [r])
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

export type BulkEmailCampaignDetail =
  | { unreadable: true }
  | { unreadable: false; campaign: BulkEmailCampaign; recipients: CampaignRecipient[] }

async function readNamesByPerson(
  sb: ReturnType<typeof createServiceClient>,
  personIds: number[],
): Promise<Map<number, string>> {
  const out = new Map<number, string>()
  if (personIds.length === 0) return out
  for (let i = 0; i < personIds.length; i += IN_CHUNK) {
    const slice = personIds.slice(i, i + IN_CHUNK)
    const { data, error } = await sb.from('crm_people').select('id,name').in('id', slice)
    if (error) continue
    for (const r of (data ?? []) as Array<{ id: number; name: string | null }>) {
      const name = (r.name ?? '').trim()
      if (name) out.set(r.id, name)
    }
  }
  return out
}

async function readBulkEmailCampaignDetail(
  jobId: number,
  brokerScope: string | null,
): Promise<BulkEmailCampaignDetail | null> {
  const sb = createServiceClient()
  let jobQuery = sb
    .from('crm_bulk_jobs')
    .select('id,params,actor_email,broker_scope,status,total,processed,created_at,finished_at')
    .eq('id', jobId)
    .eq('kind', 'email-cohort')
  if (brokerScope) jobQuery = jobQuery.eq('broker_scope', brokerScope)
  const { data: job, error: jobErr } = await jobQuery.maybeSingle()
  if (jobErr) return { unreadable: true }
  if (!job) return null
  const j = job as JobRow
  const emailKey = cohortEmailKeyForJob(j.id)
  const fetched = await eventsForEmailKeys(sb, [emailKey])
  if (fetched.unreadable) return { unreadable: true }
  const campaign: BulkEmailCampaign = {
    jobId: j.id,
    emailKey,
    subject: j.params?.subject?.trim() || null,
    actorEmail: j.actor_email,
    brokerScope: j.broker_scope,
    status: j.status,
    createdAtIso: j.created_at,
    finishedAtIso: j.finished_at,
    total: j.total ?? j.processed,
    engagement: summarizeCampaign(fetched.rows),
  }
  const recipients = foldCampaignRecipients(fetched.rows)
  const personIds = [...new Set(recipients.map((r) => r.personId).filter((id): id is number => id != null && id > 0))]
  const [names, sites] = await Promise.all([readNamesByPerson(sb, personIds), readLastSiteByPerson(sb, personIds)])
  for (const rec of recipients) {
    if (rec.personId != null) {
      rec.name = names.get(rec.personId) ?? null
      rec.lastSiteAt = sites.get(rec.personId) ?? null
      rec.visitedAfterSend = Boolean(
        rec.lastSiteAt && rec.sentAt && rec.lastSiteAt >= rec.sentAt,
      )
    }
  }
  return { unreadable: false, campaign, recipients }
}

export async function getBulkEmailCampaignDetail(
  jobId: number,
  brokerScope: string | null = null,
): Promise<BulkEmailCampaignDetail | null> {
  const id = Math.floor(jobId)
  if (!Number.isFinite(id) || id <= 0) return null
  const cached = unstable_cache(
    () => readBulkEmailCampaignDetail(id, brokerScope),
    ['crm-bulk-email-campaign-detail', String(id), brokerScope ?? 'all'],
    { tags: ['crm-email-reporting'], revalidate: 60 },
  )
  return cached()
}
