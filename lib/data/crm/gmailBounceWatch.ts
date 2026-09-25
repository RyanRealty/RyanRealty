import 'server-only'

/**
 * Reads the `sent` rows the Gmail bounce-watch cron matches against, and the
 * lifecycle flags it needs to stay idempotent. Raw table access stays here
 * (G1). The runner in lib/crm/gmail-bounce-watch.ts never calls .from().
 */

import { createServiceClient } from '@/lib/supabase/service'

export type WatchedSentRow = {
  message_id: string | null
  recipient_email: string
  person_id: number | null
  email_key: string | null
  broker: string | null
  subject: string | null
  send_type: string | null
  occurred_at: string
  meta: Record<string, unknown>
}

function asRow(r: Record<string, unknown>): WatchedSentRow {
  const meta =
    r.meta && typeof r.meta === 'object' && !Array.isArray(r.meta)
      ? (r.meta as Record<string, unknown>)
      : {}
  return {
    message_id: typeof r.message_id === 'string' ? r.message_id : null,
    recipient_email: String(r.recipient_email ?? '').trim().toLowerCase(),
    person_id: typeof r.person_id === 'number' ? r.person_id : r.person_id == null ? null : Number(r.person_id),
    email_key: typeof r.email_key === 'string' ? r.email_key : null,
    broker: typeof r.broker === 'string' ? r.broker : null,
    subject: typeof r.subject === 'string' ? r.subject : null,
    send_type: typeof r.send_type === 'string' ? r.send_type : null,
    occurred_at: String(r.occurred_at ?? ''),
    meta,
  }
}

/** CMA (and other Gmail) `sent` rows since `sinceIso`, newest first. */
export async function listWatchedSentEvents(sinceIso: string): Promise<WatchedSentRow[]> {
  const sb = createServiceClient()
  const { data, error } = await sb
    .from('email_events')
    .select('message_id, recipient_email, person_id, email_key, broker, subject, send_type, occurred_at, meta')
    .eq('event', 'sent')
    .gte('occurred_at', sinceIso)
    .order('occurred_at', { ascending: false })
    .limit(2000)
  if (error) {
    console.error('[gmailBounceWatch] sent read failed:', error.message)
    return []
  }
  return ((data ?? []) as Record<string, unknown>[]).map(asRow)
}

export type EmailKeyFlags = {
  bounced: boolean
  delivered: boolean
  opened: boolean
  clicked: boolean
}

/**
 * Lifecycle flags for a set of email_keys — used so a second cron tick does
 * not rewrite bounce/delivered, and so an open/click can infer delivered.
 */
export async function getEmailKeyFlags(emailKeys: string[]): Promise<Map<string, EmailKeyFlags>> {
  const out = new Map<string, EmailKeyFlags>()
  const keys = [...new Set(emailKeys.map((k) => k.trim()).filter(Boolean))]
  if (keys.length === 0) return out
  const sb = createServiceClient()
  for (let i = 0; i < keys.length; i += 100) {
    const chunk = keys.slice(i, i + 100)
    const { data, error } = await sb
      .from('email_events')
      .select('email_key, event')
      .in('email_key', chunk)
      .in('event', ['bounce', 'delivered', 'open', 'click'])
    if (error) {
      console.error('[gmailBounceWatch] flags read failed:', error.message)
      continue
    }
    for (const row of data ?? []) {
      const key = String(row.email_key ?? '')
      if (!key) continue
      const flags = out.get(key) ?? { bounced: false, delivered: false, opened: false, clicked: false }
      switch (String(row.event ?? '')) {
        case 'bounce':
          flags.bounced = true
          break
        case 'delivered':
          flags.delivered = true
          break
        case 'open':
          flags.opened = true
          break
        case 'click':
          flags.clicked = true
          break
        default:
          break
      }
      out.set(key, flags)
    }
  }
  return out
}

/** Best-effort timeline row for a bounce. Deduped so a re-scan is a no-op. */
export async function insertEmailBounceTimeline(input: {
  personId: number
  title: string
  body: string
  broker: string | null
  dedupeKey: string
  payload: Record<string, unknown>
}): Promise<void> {
  if (!Number.isFinite(input.personId) || input.personId <= 0) return
  try {
    const sb = createServiceClient()
    const { error } = await sb.from('crm_timeline').upsert(
      {
        person_id: input.personId,
        kind: 'email_bounce',
        title: input.title,
        body: input.body,
        broker: input.broker,
        source: 'gmail-dsn',
        payload: input.payload,
        dedupe_key: input.dedupeKey,
      },
      { onConflict: 'dedupe_key', ignoreDuplicates: true },
    )
    if (error) console.warn('[gmailBounceWatch] timeline upsert failed:', error.message)
  } catch (e) {
    console.warn('[gmailBounceWatch] timeline threw:', e instanceof Error ? e.message : e)
  }
}
