import 'server-only'
import { createServiceClient } from '@/lib/data/client'
import { personIdsByEmailCi } from '@/lib/data/crm/personByEmailCi'

/**
 * DAL for the newsletter feature — public.newsletter_subscribers (the list) +
 * public.newsletters (managed sends). Both are service-role only (RLS on, no
 * policies), so these never run from the browser/anon client. Mirrors the
 * guest_search_alerts pattern: upsert by lower(email), random unsubscribe_token.
 */

const SUBS = 'newsletter_subscribers'
const LETTERS = 'newsletters'

export type NewsletterSegment = 'general' | 'buyer' | 'seller' | 'past-client'
export type SubscriberStatus = 'active' | 'unsubscribed' | 'bounced' | 'complained'

export type NewsletterSubscriber = {
  id: string
  email: string
  name: string | null
  status: SubscriberStatus
  source: string | null
  segment: NewsletterSegment
  crm_person_id: number | null
  fub_person_id: number | null
  unsubscribe_token: string
  last_sent_at: string | null
  created_at: string
  updated_at: string
}

/** Full lifecycle (matches the newsletters_status_check CHECK, spec §3.1). */
export type NewsletterStatus = 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed' | 'canceled'

export type NewsletterRow = {
  id: string
  subject: string
  preview_text: string | null
  body_html: string | null
  body_text: string | null
  status: NewsletterStatus
  audience: string
  recipient_count: number
  sent_count: number
  failed_count: number
  created_by: string | null
  sent_by: string | null
  scheduled_at: string | null
  sent_at: string | null
  send_started_at: string | null
  send_finished_at: string | null
  /** Circuit-breaker / manual pause flag — the drain skips a paused issue. */
  send_paused: boolean | null
  /** §0 verification trace, one entry per stat token (R-2). */
  citations: NewsletterCitationEntry[] | null
  created_at: string
  updated_at: string
}

const SUB_COLS =
  'id, email, name, status, source, segment, crm_person_id, fub_person_id, unsubscribe_token, last_sent_at, created_at, updated_at'

// ── Subscribe / list management ──────────────────────────────────────────────

/**
 * Subscribe an email (public signup OR admin/CRM assign). Upserts by
 * lower(email): a re-subscribe of a previously-unsubscribed email reactivates
 * the row. Returns the row.
 */
export async function subscribeToNewsletter(input: {
  email: string
  name?: string | null
  source: string
  segment?: NewsletterSegment
  crmPersonId?: number | null
  fubPersonId?: number | null
}): Promise<{ ok: boolean; reactivated?: boolean; error?: string }> {
  const email = input.email.trim().toLowerCase()
  if (!email || !email.includes('@')) return { ok: false, error: 'invalid_email' }
  const sb = createServiceClient()

  // Resolve the CRM link when the caller did not pass one. A subscriber row
  // without crm_person_id renders UN-instrumented newsletters (attributeOutbound
  // skips the open pixel + click wrapper with no person to attribute to), so
  // opens/clicks silently vanish — found live 2026-07-10 when a one-off to a
  // known contact recorded zero engagement. Unambiguous email match only.
  let crmPersonId = input.crmPersonId ?? null
  if (crmPersonId == null) {
    const matches = await personIdsByEmailCi(sb, email).catch(() => [] as number[])
    if (matches.length === 1) crmPersonId = matches[0]!
  }

  // Existing row (case-insensitive)?
  const { data: existing } = await sb.from(SUBS).select('id, status').ilike('email', email).maybeSingle()
  if (existing) {
    const reactivated = existing.status !== 'active'
    const { error } = await sb
      .from(SUBS)
      .update({
        status: 'active',
        name: input.name ?? undefined,
        segment: input.segment ?? undefined,
        crm_person_id: crmPersonId ?? undefined,
        fub_person_id: input.fubPersonId ?? undefined,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
    if (error) { console.error('[subscribeToNewsletter:update]', error.message); return { ok: false, error: 'persist_failed' } }
    return { ok: true, reactivated }
  }

  const { error } = await sb.from(SUBS).insert({
    email,
    name: input.name ?? null,
    source: input.source,
    segment: input.segment ?? 'general',
    crm_person_id: crmPersonId,
    fub_person_id: input.fubPersonId ?? null,
  })
  if (error) { console.error('[subscribeToNewsletter:insert]', error.message); return { ok: false, error: 'persist_failed' } }
  return { ok: true }
}

/** Admin/public unsubscribe by the token in the URL. matched=false = bad token. */
export async function unsubscribeNewsletterByToken(token: string): Promise<{ ok: boolean; matched: boolean }> {
  const trimmed = (token ?? '').trim()
  if (!trimmed) return { ok: true, matched: false }
  const sb = createServiceClient()
  const { data, error } = await sb
    .from(SUBS)
    .update({ status: 'unsubscribed', updated_at: new Date().toISOString() })
    .eq('unsubscribe_token', trimmed)
    .select('id, email, crm_person_id')
  if (error) return { ok: false, matched: false }
  const row = (data ?? [])[0] as { id: string; email: string; crm_person_id: number | null } | undefined
  if (!row) return { ok: true, matched: false }

  // NL-M1: unsubscribing the newsletter opts the person out of marketing email
  // GENERALLY (distinct from a single per-search alert). Flipping only the
  // newsletter_subscribers row leaves other surfaces (CMA, market-report, one-off
  // sends) that gate on the global suppression chokepoint unaware. Write the SAME
  // durable global signal /api/email/unsubscribe writes, so isSuppressed /
  // isSuppressedByEmail honor it everywhere. Best-effort: a suppression-write
  // failure must never make the unsubscribe itself report failure (the status
  // flip above is the load-bearing opt-out).
  try {
    const email = (row.email || '').trim().toLowerCase()
    // Dynamic import mirrors how lib/crm/suppressions defers its own Meta side
    // effect — keeps the crm/suppressions graph out of the @/lib/data barrel that
    // the edge /api/og route pulls in.
    const { addSuppression } = await import('@/lib/crm/suppressions')
    if (row.crm_person_id != null) {
      // Person-keyed (also enqueues Meta audience removal) + email value so an
      // email-keyed check catches it too.
      await addSuppression({
        personId: row.crm_person_id,
        channel: 'email',
        reason: 'unsubscribe',
        source: 'newsletter',
        value: email || null,
      })
    } else if (email) {
      // No linked CRM person — write an email-keyed suppression row directly
      // (isSuppressedByEmail path 3). Raw table access is allowed inside lib/data.
      await sb.from('crm_suppressions').insert({
        channel: 'email',
        reason: 'unsubscribe',
        source: 'newsletter',
        value: email,
      })
    }
  } catch (e) {
    console.warn('[unsubscribeNewsletterByToken] global-suppression write failed:', e instanceof Error ? e.message : String(e))
  }

  return { ok: true, matched: true }
}

/** Admin-toggle a subscriber's status (e.g. remove = unsubscribed, re-add = active). */
export async function setSubscriberStatus(id: string, status: SubscriberStatus): Promise<{ ok: boolean }> {
  const sb = createServiceClient()
  const { error } = await sb.from(SUBS).update({ status, updated_at: new Date().toISOString() }).eq('id', id)
  return { ok: !error }
}

/** Paginated subscriber list for the admin manage screen. */
export async function listNewsletterSubscribers(args: {
  status?: SubscriberStatus
  segment?: NewsletterSegment
  q?: string
  page?: number
  pageSize?: number
}): Promise<{ rows: NewsletterSubscriber[]; total: number; page: number; pageSize: number }> {
  const sb = createServiceClient()
  const pageSize = Math.min(100, Math.max(10, args.pageSize ?? 50))
  const page = Math.max(1, args.page ?? 1)
  let query = sb.from(SUBS).select(SUB_COLS, { count: 'exact' })
  if (args.status) query = query.eq('status', args.status)
  if (args.segment) query = query.eq('segment', args.segment)
  const q = args.q?.trim()
  if (q) query = query.or(`email.ilike.%${q}%,name.ilike.%${q}%`)
  const from = (page - 1) * pageSize
  const { data, count } = await query.order('created_at', { ascending: false }).range(from, from + pageSize - 1)
  return { rows: (data ?? []) as NewsletterSubscriber[], total: count ?? 0, page, pageSize }
}

/** Counts by status for the KPI band. */
export async function newsletterSubscriberCounts(): Promise<{ active: number; unsubscribed: number; total: number }> {
  const sb = createServiceClient()
  const [{ count: total }, { count: active }, { count: unsubscribed }] = await Promise.all([
    sb.from(SUBS).select('id', { count: 'exact', head: true }),
    sb.from(SUBS).select('id', { count: 'exact', head: true }).eq('status', 'active'),
    sb.from(SUBS).select('id', { count: 'exact', head: true }).eq('status', 'unsubscribed'),
  ])
  return { active: active ?? 0, unsubscribed: unsubscribed ?? 0, total: total ?? 0 }
}

/**
 * Active recipients for a send, optionally filtered to a segment. PAGINATED over
 * ALL active subscribers (NL-M2): the prior single-shot `.limit(5000)` silently
 * dropped every active subscriber past the cap — a mass issue would under-send with
 * no signal. We now page in 1,000-row ranges until the list is exhausted (this also
 * defeats the PostgREST server-side max-rows ceiling, which a bare `.limit(5000)`
 * can quietly truncate to). An explicit `limit` caller cap is still honored; when the
 * hard ceiling is actually reached we log loudly rather than under-send in silence.
 */
export async function getActiveSubscribersForSend(args: { segment?: NewsletterSegment; limit?: number }): Promise<
  Array<Pick<NewsletterSubscriber, 'id' | 'email' | 'name' | 'crm_person_id' | 'unsubscribe_token'>>
> {
  const sb = createServiceClient()
  type Row = Pick<NewsletterSubscriber, 'id' | 'email' | 'name' | 'crm_person_id' | 'unsubscribe_token'>
  const PAGE = 1000
  // No caller cap = send to EVERYONE active. The default is a very high safety
  // ceiling, not the old 5,000 silent truncation.
  const hardCap = Math.max(1, args.limit ?? 200000)
  const out: Row[] = []
  for (let from = 0; from < hardCap; from += PAGE) {
    const to = Math.min(from + PAGE, hardCap) - 1
    let query = sb.from(SUBS).select('id, email, name, crm_person_id, unsubscribe_token').eq('status', 'active')
    // A targeted send filters to its segment — INCLUDING 'general'. Audience 'all'
    // passes segment=undefined (everyone); only that reaches every subscriber. (Was
    // leaking: 'general' previously skipped the filter and went to buyer/seller too.)
    if (args.segment) query = query.eq('segment', args.segment)
    // Stable, gap-free pagination needs a deterministic order (created_at + id tiebreak).
    const { data, error } = await query
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .range(from, to)
    if (error) throw new Error(`getActiveSubscribersForSend: ${error.message}`)
    const rows = (data ?? []) as Row[]
    out.push(...rows)
    if (rows.length < PAGE) break // last page reached
  }
  if (out.length >= hardCap) {
    console.error(
      `[newsletter] getActiveSubscribersForSend hit the ${hardCap}-row ceiling — additional active subscribers were NOT loaded for this send. Raise the cap or split the audience so the issue does not under-send.`,
    )
  }
  return out
}

/**
 * Mirror a hard bounce / spam complaint onto the subscriber row so counts and
 * the admin view reflect reality (the suppression table already stops sends;
 * this keeps subscriber status honest). Only ever moves an ACTIVE subscriber to
 * a terminal status — never reactivates.
 */
export async function setSubscriberStatusByEmail(email: string, status: 'bounced' | 'complained' | 'unsubscribed'): Promise<void> {
  const e = email.trim().toLowerCase()
  if (!e) return
  const sb = createServiceClient()
  const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() }
  if (status === 'bounced') patch.bounced_at = new Date().toISOString()
  if (status === 'complained') patch.complained_at = new Date().toISOString()
  // Only ever move an ACTIVE subscriber to a terminal state — never reactivate.
  await sb.from(SUBS).update(patch).eq('email', e).eq('status', 'active')
}

/** Stamp last_sent_at for a batch after a send. */
export async function markSubscribersSent(ids: string[], iso: string): Promise<void> {
  if (ids.length === 0) return
  const sb = createServiceClient()
  await sb.from(SUBS).update({ last_sent_at: iso }).in('id', ids)
}

// ── Newsletters (drafts + sent history) ──────────────────────────────────────

export async function createNewsletterDraft(input: {
  subject: string
  preview_text?: string | null
  body_html?: string | null
  body_text?: string | null
  audience?: string
  created_by?: string | null
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  const sb = createServiceClient()
  const { data, error } = await sb
    .from(LETTERS)
    .insert({
      subject: input.subject,
      preview_text: input.preview_text ?? null,
      body_html: input.body_html ?? null,
      body_text: input.body_text ?? null,
      audience: input.audience ?? 'all',
      created_by: input.created_by ?? null,
    })
    .select('id')
    .maybeSingle()
  if (error) { console.error('[createNewsletterDraft]', error.message); return { ok: false, error: 'persist_failed' } }
  return { ok: true, id: data?.id as string | undefined }
}

export async function updateNewsletter(id: string, fields: Partial<Pick<NewsletterRow, 'subject' | 'preview_text' | 'body_html' | 'body_text' | 'audience' | 'status' | 'recipient_count' | 'sent_count' | 'failed_count' | 'sent_at' | 'scheduled_at' | 'sent_by'>>): Promise<{ ok: boolean }> {
  const sb = createServiceClient()
  const { error } = await sb.from(LETTERS).update({ ...fields, updated_at: new Date().toISOString() }).eq('id', id)
  return { ok: !error }
}

/** One §8 verification-trace entry stored in newsletters.citations (jsonb array). */
export type NewsletterCitationEntry = {
  figure: string
  source: string
  filter: string
  value: string | number
  fetched_at: string
}

/**
 * Attach the §0 verification trace to a draft (newsletters.citations jsonb).
 * Separate from updateNewsletter because citations is a structured audit column,
 * not a form field — the curation producer sets it right after createNewsletterDraft.
 */
export async function setNewsletterCitations(id: string, citations: NewsletterCitationEntry[]): Promise<{ ok: boolean }> {
  const sb = createServiceClient()
  const { error } = await sb.from(LETTERS).update({ citations, updated_at: new Date().toISOString() }).eq('id', id)
  return { ok: !error }
}

export async function listNewsletters(limit = 50): Promise<NewsletterRow[]> {
  const sb = createServiceClient()
  const { data } = await sb.from(LETTERS).select('*').order('created_at', { ascending: false }).limit(limit)
  return (data ?? []) as NewsletterRow[]
}

export async function getNewsletter(id: string): Promise<NewsletterRow | null> {
  const sb = createServiceClient()
  const { data } = await sb.from(LETTERS).select('*').eq('id', id).maybeSingle()
  return (data as NewsletterRow | null) ?? null
}

export async function deleteNewsletterDraft(id: string): Promise<{ ok: boolean }> {
  const sb = createServiceClient()
  const { error } = await sb.from(LETTERS).delete().eq('id', id).eq('status', 'draft')
  return { ok: !error }
}

// ── Per-recipient tracking (opens / clicks / delivery) ──────────────────────

const RECIPIENTS = 'newsletter_recipients'

export type NewsletterRecipient = {
  id: string
  newsletter_id: string
  email: string
  /** Queue lifecycle (queued/sending/skipped) + delivery outcomes — matches the DB CHECK. */
  status: 'queued' | 'sending' | 'skipped' | 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'complained' | 'failed'
  open_count: number
  last_opened_at: string | null
  click_count: number
  last_clicked_at: string | null
  clicked_links: Array<{ url: string; count: number; last: string }>
}

export type NewsletterStats = {
  sent: number
  delivered: number
  opened: number
  clicked: number
  bounced: number
  deliveryRate: number // delivered / sent
  openRate: number     // opened / delivered
  clickRate: number    // clicked / delivered
}

/** Record one recipient at send time (the Resend message id ties webhook events back). */
export async function recordRecipientSend(input: {
  newsletterId: string
  subscriberId?: string | null
  email: string
  resendMessageId?: string | null
  failed?: boolean
}): Promise<void> {
  const sb = createServiceClient()
  await sb.from(RECIPIENTS).upsert(
    {
      newsletter_id: input.newsletterId,
      subscriber_id: input.subscriberId ?? null,
      email: input.email.trim().toLowerCase(),
      resend_message_id: input.resendMessageId ?? null,
      status: input.failed ? 'failed' : 'sent',
    },
    { onConflict: 'newsletter_id,email' },
  )
}

/** Status rank — opens/clicks only advance, never regress. Bounce/complaint win. */
const STATUS_RANK: Record<string, number> = { sent: 0, delivered: 1, opened: 2, clicked: 3, bounced: 4, complained: 5, failed: 4 }

/**
 * Apply a Resend webhook event to the matching recipient (by resend_message_id).
 * Handles delivered / opened / clicked (with the clicked URL) / bounced / complained.
 */
export async function recordNewsletterEvent(input: {
  resendMessageId: string
  type: 'delivered' | 'opened' | 'clicked' | 'bounced' | 'complained'
  url?: string | null
  isoTs?: string | null
}): Promise<{ ok: boolean; matched: boolean }> {
  const sb = createServiceClient()
  const { data: row } = await sb
    .from(RECIPIENTS)
    .select('id, status, open_count, click_count, clicked_links, first_opened_at, first_clicked_at')
    .eq('resend_message_id', input.resendMessageId)
    .maybeSingle()
  if (!row) return { ok: true, matched: false }

  const ts = input.isoTs ?? new Date().toISOString()
  const patch: Record<string, unknown> = {}
  const nextStatus = ({ delivered: 'delivered', opened: 'opened', clicked: 'clicked', bounced: 'bounced', complained: 'complained' } as const)[input.type]
  if ((STATUS_RANK[nextStatus] ?? 0) >= (STATUS_RANK[row.status as string] ?? 0)) patch.status = nextStatus

  if (input.type === 'opened') {
    patch.open_count = (row.open_count as number) + 1
    patch.last_opened_at = ts
    if (!row.first_opened_at) patch.first_opened_at = ts
  } else if (input.type === 'clicked') {
    patch.click_count = (row.click_count as number) + 1
    patch.last_clicked_at = ts
    if (!row.first_clicked_at) patch.first_clicked_at = ts
    const links = (row.clicked_links as Array<{ url: string; count: number; last: string }>) ?? []
    const url = (input.url ?? '').trim()
    if (url) {
      const existing = links.find((l) => l.url === url)
      if (existing) { existing.count += 1; existing.last = ts } else { links.push({ url, count: 1, last: ts }) }
      patch.clicked_links = links
    }
    // A click implies an open.
    if (!row.first_opened_at) { patch.first_opened_at = ts; patch.open_count = Math.max(1, (row.open_count as number) || 0) }
  }
  await sb.from(RECIPIENTS).update(patch).eq('id', row.id)
  return { ok: true, matched: true }
}

/** Aggregate delivery / open / click stats for a newsletter (computed from recipients). */
export async function getNewsletterStats(newsletterId: string): Promise<NewsletterStats> {
  const sb = createServiceClient()
  const base = () => sb.from(RECIPIENTS).select('id', { count: 'exact', head: true }).eq('newsletter_id', newsletterId)
  const [{ count: sent }, { count: badCount }, { count: opened }, { count: clicked }, { count: bounced }] = await Promise.all([
    base(),
    base().in('status', ['bounced', 'complained', 'failed']),
    base().gt('open_count', 0),
    base().gt('click_count', 0),
    base().in('status', ['bounced', 'complained']),
  ])
  const total = sent ?? 0
  const delivered = Math.max(0, total - (badCount ?? 0))
  const o = opened ?? 0
  const c = clicked ?? 0
  return {
    sent: total,
    delivered,
    opened: o,
    clicked: c,
    bounced: bounced ?? 0,
    deliveryRate: total ? delivered / total : 0,
    openRate: delivered ? o / delivered : 0,
    clickRate: delivered ? c / delivered : 0,
  }
}

/** Recipient breakdown for the broker view — engaged first (clicked, then opened). */
export async function getNewsletterRecipients(newsletterId: string, args?: { limit?: number; engagedOnly?: boolean }): Promise<NewsletterRecipient[]> {
  const sb = createServiceClient()
  let query = sb
    .from(RECIPIENTS)
    .select('id, newsletter_id, email, status, open_count, last_opened_at, click_count, last_clicked_at, clicked_links')
    .eq('newsletter_id', newsletterId)
  if (args?.engagedOnly) query = query.gt('open_count', 0)
  const { data } = await query
    .order('click_count', { ascending: false })
    .order('open_count', { ascending: false })
    .order('email', { ascending: true })
    .limit(Math.min(2000, args?.limit ?? 500))
  return (data ?? []) as NewsletterRecipient[]
}

/** Is this lead on the newsletter list? Matched by crm_person_id OR any email. */
export async function getNewsletterMembershipForLead(args: { crmPersonId?: number | null; emails?: string[] }): Promise<{ subscribed: boolean; status: SubscriberStatus | null; segment: NewsletterSegment | null }> {
  const sb = createServiceClient()
  const emails = (args.emails ?? []).map((e) => e.trim().toLowerCase()).filter(Boolean)
  const ors: string[] = []
  if (args.crmPersonId) ors.push(`crm_person_id.eq.${args.crmPersonId}`)
  for (const e of emails) ors.push(`email.eq.${e}`)
  if (ors.length === 0) return { subscribed: false, status: null, segment: null }
  const { data } = await sb.from(SUBS).select('status, segment').or(ors.join(',')).limit(1).maybeSingle()
  if (!data) return { subscribed: false, status: null, segment: null }
  return { subscribed: data.status === 'active', status: data.status as SubscriberStatus, segment: data.segment as NewsletterSegment }
}

/** Resolve a CRM person's primary email + name, for "assign to newsletter". */
export async function getCrmPersonContact(personId: number): Promise<{ email: string; name: string | null } | null> {
  const sb = createServiceClient()
  const { data } = await sb.from('crm_people').select('name, emails').eq('id', personId).maybeSingle()
  if (!data) return null
  const emails = (data.emails ?? []) as Array<{ value?: string; isPrimary?: number | boolean }>
  const email = emails.find((e) => e.isPrimary)?.value ?? emails[0]?.value ?? null
  if (!email) return null
  return { email, name: (data.name as string | null) ?? null }
}
