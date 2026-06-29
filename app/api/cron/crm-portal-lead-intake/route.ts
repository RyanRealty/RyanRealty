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
import { queueBrokerAlert } from '@/lib/crm/broker-alerts'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

const MAILBOX = 'matt@ryan-realty.com'
const READONLY = ['https://www.googleapis.com/auth/gmail.readonly']
const SOURCE = 'portal-lead-intake'
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
    const list = await gmail.users.messages.list({ userId: 'me', q: `${QUERY} after:${afterSec}`, maxResults: 50 })
    for (const ref of list.data.messages ?? []) {
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
        // Safety net: can't anchor a lead — alert Matt with the raw subject so it's never silently lost.
        needsReview++
        await queueBrokerAlert({
          broker: 'matt', personId: 0, kind: 'portal-lead-unparsed',
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

    await sb.from('crm_imports').update({
      finished_at: new Date().toISOString(), status: 'done',
      counts: { processed, created, needsReview }, cursor: { after_ms: maxInternal },
    }).eq('id', imp?.id)

    return NextResponse.json({ ok: true, processed, created, needsReview })
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
