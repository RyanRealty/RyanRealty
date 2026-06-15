import 'server-only'
import { createServiceClient } from '@/lib/data/client'

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

export type NewsletterRow = {
  id: string
  subject: string
  preview_text: string | null
  body_html: string | null
  body_text: string | null
  status: 'draft' | 'sending' | 'sent' | 'failed'
  audience: string
  recipient_count: number
  sent_count: number
  failed_count: number
  created_by: string | null
  scheduled_at: string | null
  sent_at: string | null
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
        crm_person_id: input.crmPersonId ?? undefined,
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
    crm_person_id: input.crmPersonId ?? null,
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
    .select('id')
  if (error) return { ok: false, matched: false }
  return { ok: true, matched: (data?.length ?? 0) > 0 }
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

/** Active recipients for a send, optionally filtered to a segment. Capped for safety. */
export async function getActiveSubscribersForSend(args: { segment?: NewsletterSegment; limit?: number }): Promise<
  Array<Pick<NewsletterSubscriber, 'id' | 'email' | 'name' | 'crm_person_id' | 'unsubscribe_token'>>
> {
  const sb = createServiceClient()
  let query = sb.from(SUBS).select('id, email, name, crm_person_id, unsubscribe_token').eq('status', 'active')
  if (args.segment && args.segment !== 'general') query = query.eq('segment', args.segment)
  const { data } = await query.limit(Math.min(10000, args.limit ?? 5000))
  return (data ?? []) as Array<Pick<NewsletterSubscriber, 'id' | 'email' | 'name' | 'crm_person_id' | 'unsubscribe_token'>>
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

export async function updateNewsletter(id: string, fields: Partial<Pick<NewsletterRow, 'subject' | 'preview_text' | 'body_html' | 'body_text' | 'audience' | 'status' | 'recipient_count' | 'sent_count' | 'failed_count' | 'sent_at' | 'scheduled_at'>>): Promise<{ ok: boolean }> {
  const sb = createServiceClient()
  const { error } = await sb.from(LETTERS).update({ ...fields, updated_at: new Date().toISOString() }).eq('id', id)
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
