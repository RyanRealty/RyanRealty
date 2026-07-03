import 'server-only'
import { randomUUID } from 'node:crypto'
import { createServiceClient } from '@/lib/data/client'

/**
 * Newsletter send-queue DATA LAYER (spec §6 / §6.5). Raw table access lives here
 * (DAL boundary, gate G1); the orchestration — render, send, circuit-breaker —
 * lives in lib/newsletter/send-queue.ts and calls these.
 *
 * The queue exists because the old path sent up to 5,000 emails in one server
 * action: a Vercel timeout stranded the newsletter in status='sending' forever,
 * and per-broker rendering made it slower. Now: approve ENQUEUES recipient rows
 * (status='queued', frozen broker + engagement tier) under a compare-and-swap
 * lock, and cron DRAINS them tier-by-tier over the tranche window, claiming each
 * batch atomically (queued -> sending) so concurrent ticks never double-send.
 */

const LETTERS = 'newsletters'
const RECIPIENTS = 'newsletter_recipients'
const SCHEDULE = 'newsletter_send_schedule'
const EVENTS = 'newsletter_recipient_events'
const SUBS = 'newsletter_subscribers'

export type QueuedRecipient = {
  id: string
  subscriber_id: string | null
  email: string
  broker: string | null
  tier: number | null
}

export type ScheduleRow = { day_index: number; tier: number; cap: number; sent_count: number }

/**
 * Compare-and-swap lock (spec §6 step 1, edge case S-1). Flips a newsletter from
 * draft/scheduled to sending in ONE conditional UPDATE and returns the lock token
 * only if THIS call won. A second concurrent approve sees status='sending' and
 * gets null → it must abort. Never a read-then-write.
 */
export async function claimNewsletterForSending(newsletterId: string): Promise<string | null> {
  const sb = createServiceClient()
  const token = randomUUID()
  const { data, error } = await sb
    .from(LETTERS)
    .update({ status: 'sending', lock_token: token, send_started_at: new Date().toISOString() })
    .eq('id', newsletterId)
    .in('status', ['draft', 'scheduled'])
    .select('id')
  if (error) throw new Error(`claimNewsletterForSending: ${error.message}`)
  return data && data.length > 0 ? token : null
}

/** Release the lock back to draft (used when enqueue finds 0 real recipients — S-14). */
export async function releaseNewsletterLock(newsletterId: string, status: 'draft' | 'failed' = 'draft'): Promise<void> {
  const sb = createServiceClient()
  await sb.from(LETTERS).update({ status, lock_token: null, send_started_at: null }).eq('id', newsletterId)
}

/**
 * The engagement inputs for tier assignment (§6.5 rule 2): the set of subscriber
 * emails that OPENED or CLICKED any of the last `lookback` sent issues (Tier 1),
 * and the set of emails that have EVER been sent to (to tell new/Tier 2 from
 * cold/Tier 3). Emails are lowercased. One query each, so tiering a 12k list is
 * two reads, not 12k.
 */
export async function getEngagementSets(lookback = 2): Promise<{ engaged: Set<string>; everSent: Set<string> }> {
  const sb = createServiceClient()
  // The last N newsletters that actually sent, newest first.
  const { data: recent } = await sb
    .from(LETTERS)
    .select('id')
    .eq('status', 'sent')
    .order('sent_at', { ascending: false })
    .limit(lookback)
  const recentIds = (recent ?? []).map((r) => (r as { id: string }).id)

  const engaged = new Set<string>()
  if (recentIds.length > 0) {
    const { data: ev } = await sb
      .from(EVENTS)
      .select('email, event')
      .in('newsletter_id', recentIds)
      .in('event', ['open', 'click'])
    for (const row of ev ?? []) engaged.add(((row as { email: string }).email || '').toLowerCase())
  }

  const everSent = new Set<string>()
  const { data: prior } = await sb.from(RECIPIENTS).select('email').limit(100000)
  for (const row of prior ?? []) everSent.add(((row as { email: string }).email || '').toLowerCase())

  return { engaged, everSent }
}

/**
 * Batch-resolve crm_people.assigned_broker for a set of person ids → Map(id → short
 * slug). One query, so freezing broker on a 12k enqueue is a single read, not 12k.
 * Soft-deleted people are skipped (edge case D-2). Callers default null → 'matt'.
 */
export async function getAssignedBrokersByPersonId(personIds: number[]): Promise<Map<number, string>> {
  const map = new Map<number, string>()
  const ids = [...new Set(personIds.filter((n) => Number.isFinite(n)))]
  if (ids.length === 0) return map
  const sb = createServiceClient()
  const CHUNK = 1000
  for (let i = 0; i < ids.length; i += CHUNK) {
    const { data } = await sb
      .from('crm_people')
      .select('id, assigned_broker, deleted')
      .in('id', ids.slice(i, i + CHUNK))
    for (const row of data ?? []) {
      const r = row as { id: number; assigned_broker: string | null; deleted: boolean | null }
      if (r.deleted) continue // skip soft-deleted (D-2)
      if (r.assigned_broker) map.set(r.id, r.assigned_broker)
    }
  }
  return map
}

/**
 * Per-subscriber send metadata for a claimed batch, in one query: the live status
 * (re-checked at drain so an unsubscribe DURING the send is honored, S-8) and the
 * unsubscribe token (needed to render the one-click unsubscribe URL per recipient).
 */
export async function getSubscriberSendMeta(
  subscriberIds: string[],
): Promise<Map<string, { status: string; unsubscribe_token: string; crm_person_id: number | null }>> {
  const map = new Map<string, { status: string; unsubscribe_token: string; crm_person_id: number | null }>()
  const ids = subscriberIds.filter(Boolean)
  if (ids.length === 0) return map
  const sb = createServiceClient()
  const { data } = await sb.from(SUBS).select('id, status, unsubscribe_token, crm_person_id').in('id', ids)
  for (const row of data ?? []) {
    const r = row as { id: string; status: string; unsubscribe_token: string; crm_person_id: number | null }
    map.set(r.id, { status: r.status, unsubscribe_token: r.unsubscribe_token, crm_person_id: r.crm_person_id })
  }
  return map
}

/** True if any newsletter has ever been sent (used to decide warm-up ramp vs steady caps). */
export async function anyNewsletterEverSent(): Promise<boolean> {
  const sb = createServiceClient()
  const { count } = await sb.from(LETTERS).select('id', { count: 'exact', head: true }).eq('status', 'sent')
  return (count ?? 0) > 0
}

/** Pause / resume flag for the circuit-breaker (§6.5 rule 4). */
export async function setNewsletterPaused(newsletterId: string, paused: boolean): Promise<void> {
  const sb = createServiceClient()
  await sb.from(LETTERS).update({ send_paused: paused }).eq('id', newsletterId)
}

export async function isNewsletterPaused(newsletterId: string): Promise<boolean> {
  const sb = createServiceClient()
  const { data } = await sb.from(LETTERS).select('send_paused').eq('id', newsletterId).maybeSingle()
  return Boolean((data as { send_paused: boolean } | null)?.send_paused)
}

/** Insert queued recipient rows in chunks; idempotent via onConflict (newsletter_id,email). */
export async function insertQueuedRecipients(
  newsletterId: string,
  rows: Array<{ subscriber_id: string | null; email: string; broker: string; tier: number }>,
): Promise<number> {
  const sb = createServiceClient()
  let inserted = 0
  const CHUNK = 500
  for (let i = 0; i < rows.length; i += CHUNK) {
    const batch = rows.slice(i, i + CHUNK).map((r) => ({
      newsletter_id: newsletterId,
      subscriber_id: r.subscriber_id,
      email: r.email.trim().toLowerCase(),
      broker: r.broker,
      tier: r.tier,
      status: 'queued' as const,
    }))
    const { data, error } = await sb
      .from(RECIPIENTS)
      .upsert(batch, { onConflict: 'newsletter_id,email', ignoreDuplicates: true })
      .select('id')
    if (error) throw new Error(`insertQueuedRecipients: ${error.message}`)
    inserted += data?.length ?? 0
  }
  return inserted
}

/** Write the per-issue tranche schedule (§6.5). Idempotent via onConflict. */
export async function writeSendSchedule(
  newsletterId: string,
  rows: Array<{ day_index: number; tier: number; cap: number }>,
): Promise<void> {
  const sb = createServiceClient()
  const payload = rows.map((r) => ({ newsletter_id: newsletterId, ...r }))
  const { error } = await sb.from(SCHEDULE).upsert(payload, { onConflict: 'newsletter_id,day_index,tier', ignoreDuplicates: true })
  if (error) throw new Error(`writeSendSchedule: ${error.message}`)
}

export async function getSendSchedule(newsletterId: string): Promise<ScheduleRow[]> {
  const sb = createServiceClient()
  const { data } = await sb.from(SCHEDULE).select('day_index, tier, cap, sent_count').eq('newsletter_id', newsletterId)
  return (data ?? []) as ScheduleRow[]
}

export async function bumpScheduleSent(newsletterId: string, dayIndex: number, tier: number, by: number): Promise<void> {
  if (by <= 0) return
  const sb = createServiceClient()
  const { data } = await sb
    .from(SCHEDULE)
    .select('sent_count')
    .eq('newsletter_id', newsletterId)
    .eq('day_index', dayIndex)
    .eq('tier', tier)
    .maybeSingle()
  const current = (data as { sent_count: number } | null)?.sent_count ?? 0
  await sb
    .from(SCHEDULE)
    .update({ sent_count: current + by })
    .eq('newsletter_id', newsletterId)
    .eq('day_index', dayIndex)
    .eq('tier', tier)
}

/**
 * Atomically CLAIM up to `limit` queued rows of a given tier (queued -> sending in
 * one UPDATE ... RETURNING), so a concurrent drain tick can never grab the same
 * row. Returns the claimed rows for this drain to send. (Edge cases S-1/S-3.)
 */
export async function claimQueuedBatch(newsletterId: string, tier: number, limit: number): Promise<QueuedRecipient[]> {
  const sb = createServiceClient()
  // Select candidate ids first (PostgREST can't UPDATE ... LIMIT directly), then
  // claim exactly those ids that are still 'queued' in one conditional update.
  const { data: candidates } = await sb
    .from(RECIPIENTS)
    .select('id')
    .eq('newsletter_id', newsletterId)
    .eq('tier', tier)
    .eq('status', 'queued')
    .limit(limit)
  const ids = (candidates ?? []).map((r) => (r as { id: string }).id)
  if (ids.length === 0) return []
  const { data: claimed, error } = await sb
    .from(RECIPIENTS)
    .update({ status: 'sending' })
    .in('id', ids)
    .eq('status', 'queued') // only claim rows still queued (loser of a race gets fewer)
    .select('id, subscriber_id, email, broker, tier')
  if (error) throw new Error(`claimQueuedBatch: ${error.message}`)
  return (claimed ?? []) as QueuedRecipient[]
}

/** Set the final per-recipient status after a send attempt (sending -> sent|failed|skipped). */
export async function finalizeRecipient(
  recipientId: string,
  status: 'sent' | 'failed' | 'skipped',
  resendMessageId: string | null,
): Promise<void> {
  const sb = createServiceClient()
  await sb.from(RECIPIENTS).update({ status, resend_message_id: resendMessageId }).eq('id', recipientId)
}

/** Count remaining rows per status for a newsletter — drives finalize + stall detection. */
export async function recipientStatusCounts(newsletterId: string): Promise<Record<string, number>> {
  const sb = createServiceClient()
  const counts: Record<string, number> = {}
  for (const status of ['queued', 'sending', 'sent', 'failed', 'skipped']) {
    const { count } = await sb
      .from(RECIPIENTS)
      .select('id', { count: 'exact', head: true })
      .eq('newsletter_id', newsletterId)
      .eq('status', status)
    counts[status] = count ?? 0
  }
  return counts
}

/** Reset rows stuck in 'sending' longer than `staleMs` back to 'queued' (crash recovery). */
export async function requeueStaleClaims(newsletterId: string, staleMs: number): Promise<number> {
  const sb = createServiceClient()
  const cutoff = new Date(Date.now() - staleMs).toISOString()
  // created_at is the row's insert time; a claimed row that never finalized and is
  // older than the cutoff is a crashed claim. (Claims are short-lived in practice.)
  const { data } = await sb
    .from(RECIPIENTS)
    .update({ status: 'queued' })
    .eq('newsletter_id', newsletterId)
    .eq('status', 'sending')
    .lt('created_at', cutoff)
    .select('id')
  return data?.length ?? 0
}

/** The newsletters currently mid-send (status='sending'), oldest first. */
export async function getSendingNewsletters(): Promise<Array<{ id: string; send_started_at: string | null }>> {
  const sb = createServiceClient()
  const { data } = await sb
    .from(LETTERS)
    .select('id, send_started_at')
    .eq('status', 'sending')
    .order('send_started_at', { ascending: true })
  return (data ?? []) as Array<{ id: string; send_started_at: string | null }>
}

/** Finalize a fully-drained newsletter to sent|failed (§6 step 3). */
export async function finalizeNewsletter(newsletterId: string): Promise<'sent' | 'failed' | null> {
  const counts = await recipientStatusCounts(newsletterId)
  if ((counts.queued ?? 0) > 0 || (counts.sending ?? 0) > 0) return null // still draining
  const sb = createServiceClient()
  const status = (counts.sent ?? 0) > 0 ? 'sent' : 'failed'
  await sb
    .from(LETTERS)
    .update({
      status,
      send_finished_at: new Date().toISOString(),
      sent_count: counts.sent ?? 0,
      failed_count: counts.failed ?? 0,
    })
    .eq('id', newsletterId)
  return status
}

/** Bounce/complaint counts within THIS send window — feeds the circuit-breaker (§6.5 rule 4). */
export async function sendWindowHealth(newsletterId: string): Promise<{ sent: number; bounced: number; complained: number }> {
  const sb = createServiceClient()
  const one = async (event: string) => {
    const { count } = await sb
      .from(EVENTS)
      .select('id', { count: 'exact', head: true })
      .eq('newsletter_id', newsletterId)
      .eq('event', event)
    return count ?? 0
  }
  const [bounced, complained] = await Promise.all([one('bounce'), one('complaint')])
  const counts = await recipientStatusCounts(newsletterId)
  return { sent: counts.sent ?? 0, bounced, complained }
}
