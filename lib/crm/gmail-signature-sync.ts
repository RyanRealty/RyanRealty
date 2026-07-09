import 'server-only'

/**
 * Gmail signature sync — keeps brokers.gmail_signature_html equal to each
 * broker's REAL Gmail signature (Matt directive 2026-07-09: every CRM email
 * carries a signature and it must match the corresponding Gmail signature).
 *
 * Source of truth: Gmail users.settings.sendAs (primary alias) via the same
 * DWD service account the mailbox sync uses. sendAs.list accepts the
 * `gmail.readonly` scope (verified live 2026-07-09 across all three broker
 * mailboxes) — the SAME scope the mailbox sync already holds, so no
 * domain-wide-delegation change is needed. Do NOT switch to
 * `gmail.settings.basic`: that scope is not in the DWD grant and fails with
 * unauthorized_client.
 *
 * Runs: piggybacked on the crm-gmail-sync cron (staleness-gated, every ~6h)
 * + on demand from §9 My Settings ("Sync from Gmail").
 */

import { createServiceClient } from '@/lib/supabase/service'
import { CRM_MAILBOXES, getGmailFor } from '@/lib/crm/gmail'

const READONLY_SCOPE = ['https://www.googleapis.com/auth/gmail.readonly']

export const GMAIL_SIGNATURE_SCOPE_HELP =
  'Gmail access not authorized for this mailbox. Verify the service account DWD grant (client 116585568564644399058) still carries https://www.googleapis.com/auth/gmail.readonly'

export type GmailSignatureFetch =
  | { ok: true; signatureHtml: string | null }
  | { ok: false; error: string }

/** The primary sendAs signature for one mailbox (null = broker has none set in Gmail). */
export async function fetchGmailSignature(mailboxEmail: string): Promise<GmailSignatureFetch> {
  const gmail = getGmailFor(mailboxEmail, READONLY_SCOPE)
  if (!gmail) return { ok: false, error: 'service account not configured' }
  try {
    const res = await gmail.users.settings.sendAs.list({ userId: 'me' })
    const sendAs = res.data.sendAs ?? []
    const primary =
      sendAs.find((s) => s.isPrimary) ?? sendAs.find((s) => s.isDefault) ?? sendAs[0]
    const sig = (primary?.signature ?? '').trim()
    return { ok: true, signatureHtml: sig || null }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    // A revoked/edited DWD grant surfaces as unauthorized_client.
    if (/unauthorized_client|access_denied|insufficient/i.test(msg)) {
      return { ok: false, error: GMAIL_SIGNATURE_SCOPE_HELP }
    }
    return { ok: false, error: msg }
  }
}

export type GmailSignatureSyncResult = {
  mailbox: string
  ok: boolean
  signatureChars: number
  error?: string
}

/**
 * Sync Gmail signatures into public.brokers for every CRM mailbox (or one,
 * when `onlyMailbox` is set). A mailbox whose Gmail signature is empty stores
 * null (→ falls back to custom/generated). Callers revalidate the brokers
 * cache tag after a successful sync.
 */
export async function syncGmailSignatures(onlyMailbox?: string): Promise<GmailSignatureSyncResult[]> {
  const sb = createServiceClient()
  const results: GmailSignatureSyncResult[] = []
  const targets = CRM_MAILBOXES.filter(
    (m) => !onlyMailbox || m.email.toLowerCase() === onlyMailbox.toLowerCase(),
  )
  for (const mb of targets) {
    const fetched = await fetchGmailSignature(mb.email)
    if (!fetched.ok) {
      results.push({ mailbox: mb.email, ok: false, signatureChars: 0, error: fetched.error })
      continue
    }
    const { error } = await sb
      .from('brokers')
      .update({
        gmail_signature_html: fetched.signatureHtml,
        gmail_signature_synced_at: new Date().toISOString(),
      })
      .ilike('email', mb.email)
    if (error) {
      results.push({ mailbox: mb.email, ok: false, signatureChars: 0, error: error.message })
      continue
    }
    results.push({ mailbox: mb.email, ok: true, signatureChars: fetched.signatureHtml?.length ?? 0 })
  }
  return results
}

/**
 * Cron helper: sync only when the newest successful sync is older than
 * maxAgeHours (3 Gmail API calls — cheap, but no reason to run every 15 min).
 */
export async function syncGmailSignaturesIfStale(maxAgeHours = 6): Promise<{ ran: boolean; results?: GmailSignatureSyncResult[] }> {
  const sb = createServiceClient()
  const { data } = await sb
    .from('brokers')
    .select('gmail_signature_synced_at')
    .not('gmail_signature_synced_at', 'is', null)
    .order('gmail_signature_synced_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  const newest = data?.gmail_signature_synced_at ? new Date(data.gmail_signature_synced_at as string).getTime() : 0
  if (Date.now() - newest < maxAgeHours * 3600_000) return { ran: false }
  return { ran: true, results: await syncGmailSignatures() }
}
