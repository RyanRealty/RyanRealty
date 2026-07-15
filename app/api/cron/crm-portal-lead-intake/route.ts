/**
 * Portal lead intake (FUB cutover, 2026-06-29).
 *
 * Zillow Premier Agent + Realtor.com leads used to enter via FUB's portal
 * integrations. FUB disconnects 2026-06-30, so those feeds are re-pointed to
 * email matt@ryan-realty.com. This cron scans that mailbox for portal lead
 * emails and turns each into a native CRM lead (ensureNativeLead) so nothing
 * drops at cutover.
 *
 * Safety net: an email from a portal sender that parses to at least an email or
 * phone becomes a lead; one that yields neither alerts Matt with the raw body.
 * Idempotent: the per-message timeline note keys on the Gmail id, and
 * ensureNativeLead reuses an existing contact, so reprocessing never duplicates.
 */
import { NextResponse } from 'next/server'
import type { gmail_v1 } from 'googleapis'
import { createServiceClient } from '@/lib/supabase/service'
import { getGmailFor } from '@/lib/crm/gmail'
import { parsePortalLead, type Portal } from '@/lib/crm/portal-lead-parser'
import { ensureNativeLead } from '@/lib/data/crm/ensureNativeLead'
import { queueBrokerHealthAlert } from '@/lib/crm/broker-alerts'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

const MAILBOX = 'matt@ryan-realty.com'
const READONLY = ['https://www.googleapis.com/auth/gmail.readonly']
const SOURCE = 'portal-lead-intake'
/**
 * Page budget per run (50 messages/page = up to 500 messages). Gmail lists
 * newest-first, so if the budget is ever exhausted the UNFETCHED messages are
 * the OLDER ones — the cursor must NOT advance past them (see below) or they
 * would be permanently skipped.
 */
const MAX_LIST_PAGES = 10
// Broad Gmail filter; detectPortal() drops the consumer-marketing blasts.
const QUERY =
  '(from:zillow.com OR from:zillowgroup.com OR from:realtor.com OR from:move.com OR from:leads.realtor.com) -in:spam -in:trash'

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim()
  const isProd = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production'
  if (!secret) return !isProd
  return (request.headers.get('authorization') ?? '') === `Bearer ${secret}`
}

function headerOf(msg: gmail_v1.Schema$Message, name: string): string | undefined {
  return msg.payload?.headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? undefined
}

function decodeBody(payload: gmail_v1.Schema$MessagePart | undefined): string {
  if (!payload) return ''
  let text = ''
  let html = ''
  const walk = (p: gmail_v1.Schema$MessagePart) => {
    if (p.mimeType === 'text/plain' && p.body?.data) text += Buffer.from(p.body.data, 'base64url').toString('utf8')
    if (p.mimeType === 'text/html' && p.body?.data) html += Buffer.from(p.body.data, 'base64url').toString('utf8')
    for (const c of p.parts ?? []) walk(c)
  }
  walk(payload)
  if (text.trim()) return text
  // Strip tags from HTML as a fallback so the field regexes still work.
  return html.replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })

  const gmail = getGmailFor(MAILBOX, READONLY)
  if (!gmail) return NextResponse.json({ ok: false, error: 'gmail service account not configured' }, { status: 500 })

  const sb = createServiceClient()
  const { data: cursorRow } = await sb
    .from('crm_imports').select('cursor').eq('source', SOURCE).order('id', { ascending: false }).limit(1).maybeSingle()
  const cursor = (cursorRow?.cursor ?? {}) as { after_ms?: number }
  // First run: only look back 2 days (avoid reprocessing old marketing). Then advance.
  const afterMs = Number(cursor.after_ms ?? Date.now() - 2 * 86400_000)
  const afterSec = Math.floor(afterMs / 1000)

  const { data: imp } = await sb.from('crm_imports').insert({ source: SOURCE, status: 'running' }).select('id').single()

  let processed = 0
  let created = 0
  let needsReview = 0
  let maxInternal = afterMs
  const errors: string[] = []

  try {
    // Drain the full window via nextPageToken (bounded by MAX_LIST_PAGES). The
    // old single 50-message list + advance-to-newest cursor permanently skipped
    // messages 51+ in a burst (first run's 2-day lookback, or after a Gmail-auth
    // outage): Gmail lists newest-first, so everything beyond the first page was
    // older than the new cursor and never seen again.
    const refs: gmail_v1.Schema$Message[] = []
    let pageToken: string | undefined
    let pages = 0
    do {
      const list = await gmail.users.messages.list({
        userId: 'me', q: `${QUERY} after:${afterSec}`, maxResults: 50, pageToken,
      })
      refs.push(...(list.data.messages ?? []))
      pageToken = list.data.nextPageToken ?? undefined
      pages++
    } while (pageToken && pages < MAX_LIST_PAGES)
    // Budget exhausted with more pages remaining -> the remaining (older)
    // messages were not processed this run.
    const truncated = Boolean(pageToken)

    for (const ref of refs) {
      const full = await gmail.users.messages.get({ userId: 'me', id: ref.id!, format: 'full' })
      const internal = Number(full.data.internalDate ?? 0)
      if (internal > maxInternal) maxInternal = internal
      const from = headerOf(full.data, 'From')
      const replyTo = headerOf(full.data, 'Reply-To') ?? null
      const subject = headerOf(full.data, 'Subject') ?? ''
      const body = decodeBody(full.data.payload)

      const lead = parsePortalLead({ from, replyTo, subject, body })
      if (!lead) continue // marketing / non-lead from a portal domain — skip
      processed++
      const portal: Portal = lead.portal
      const gmailId = full.data.id ?? ref.id!

      if (!lead.email && !lead.phone) {
        // Safety net: can't anchor a lead — alert Matt with the raw subject so it's
        // never silently lost. Uses the HEALTH alert path (not queueBrokerAlert):
        // there is no crm_people row yet, and the person-scoped path's dedupe row
        // has a NOT NULL FK on person_id — passing personId:0 failed the insert on
        // EVERY call, so the old alert never fired even once. The per-gmailId key
        // makes each unparsed message alert exactly once (within the cooldown).
        needsReview++
        await queueBrokerHealthAlert({
          key: `portal-lead-unparsed:${gmailId}`,
          body: `Unparsed ${portal} lead in Gmail — review: "${subject.slice(0, 80)}"`,
        }).catch(() => {})
        continue
      }

      const res = await ensureNativeLead({
        name: lead.name, email: lead.email, phone: lead.phone,
        source: portal, tags: [`source:${portal}`, 'intent:portal-lead'], assignedBroker: 'matt',
      })
      if (res.created) created++

      // Per-lead timeline note carrying the full portal payload (idempotent on gmailId).
      if (res.personId > 0) {
        const noteBody = [
          `New ${portal} lead`,
          lead.name ? `Name: ${lead.name}` : null,
          lead.email ? `Email: ${lead.email}` : null,
          lead.phone ? `Phone: ${lead.phone}` : null,
          lead.property ? `Property: ${lead.property}` : null,
          lead.message ? `Message: ${lead.message}` : null,
        ].filter(Boolean).join('\n')
        await sb.from('crm_timeline').upsert(
          {
            person_id: res.personId, kind: 'note', title: `${portal} lead`, body: noteBody,
            payload: { portal, gmailId, source: 'portal-lead-intake' }, broker: 'matt',
            source: 'portal-intake', dedupe_key: `portal:${gmailId}`,
          },
          { onConflict: 'dedupe_key', ignoreDuplicates: true },
        )
      }
    }

    // Cursor discipline: only advance past the window when it was fully drained.
    // On a truncated run the unprocessed messages are OLDER than everything
    // fetched (newest-first listing), so advancing to maxInternal would skip
    // them forever — hold the cursor and let the next run re-list the window
    // (reprocessing is idempotent: timeline notes dedupe on gmailId,
    // ensureNativeLead reuses the contact, health alerts dedupe per key).
    await sb.from('crm_imports').update({
      finished_at: new Date().toISOString(), status: 'done',
      counts: { processed, created, needsReview },
      cursor: { after_ms: truncated ? afterMs : maxInternal },
    }).eq('id', imp?.id)

    return NextResponse.json({ ok: true, processed, created, needsReview, truncated })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    errors.push(msg)
    await sb.from('crm_imports').update({
      finished_at: new Date().toISOString(), status: 'failed',
      counts: { processed, created, needsReview }, notes: msg.slice(0, 400),
    }).eq('id', imp?.id)
    return NextResponse.json({ ok: false, error: msg, processed, created }, { status: 500 })
  }
}
