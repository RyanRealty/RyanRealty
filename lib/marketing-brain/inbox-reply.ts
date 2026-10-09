/**
 * marketing-brain: inbox-reply
 *
 * Sends a voice-validated confirmation reply on the original Gmail thread
 * after a successful (or even a failed) dispatch. The sender hears back
 * within the same minute the email arrived.
 *
 * Reply paths:
 *   - parsed_intent  — "Got it. Routing to <producer>. Brain will surface the draft."
 *   - unknown_triage — "Got it. I couldn't route this automatically. Matt will triage manually."
 *   - rejected_sender — polite bounce if the allowlist default is reject_and_alert
 *
 * Voice gate: every outbound body is passed through the local no-op
 * applyBrandVoice check below (the mechanical brand-voice check was
 * retired 2026-09-07; see validateReplyVoice). On a failure the row is
 * marked reply_status='failed' with the violation list and the reply
 * does NOT send.
 *
 * Auth: uses Gmail send via the service-account JWT (DWD path). Already
 * authorized in the Workspace allowlist as of 2026-05-14.
 */

import { google } from 'googleapis'
import { siteOrigin } from '@/lib/site-origin'
import type { JWT } from 'google-auth-library'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { MARKETING_INBOX_USER } from './inbox-auth'
import { answeredStatus } from '@/lib/google-deadline'

let _supabase: SupabaseClient | null = null

function getSupabase(): SupabaseClient {
  if (_supabase) return _supabase
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase service-role credentials not configured')
  _supabase = createClient(url, key)
  return _supabase
}

export type ReplyKind =
  | { kind: 'parsed_intent'; action_row_id: string; action_type: string; assigned_producer: string }
  | { kind: 'unknown_triage'; action_row_id: string; triage_reason: string }
  | { kind: 'rejected_sender'; reason: string }

export interface ReplyContext {
  to_email: string
  to_name: string | null
  original_subject: string | null
  thread_id: string
  in_reply_to_message_id: string         // RFC 822 Message-ID, not Gmail id
  inbox_event_id: string
  kind: ReplyKind
}

export interface ReplyOutcome {
  /** 'unconfirmed': the send left and Gmail never answered, so it may have gone out. */
  status: 'sent' | 'failed' | 'skipped' | 'unconfirmed'
  gmail_message_id?: string
  voice_violations?: string[]
  error?: string
}

/**
 * Per-request deadline for the confirmation send. app/api/cron/marketing-inbox-poll
 * (maxDuration 60) loops over up to 50 messages a tick, each able to reach this
 * send, so one stalled reply must fail fast and let the loop move on, not eat
 * the whole run the way a stalled call with no deadline did before.
 */
export const MARKETING_INBOX_REQUEST_TIMEOUT_MS = 15_000

// The override still folds a production host (the Vercel alias included) to
// https://ryan-realty.com: this link goes out in an email (lib/site-origin.ts).
const PRODUCTION_DASHBOARD_BASE_URL = siteOrigin(process.env.MARKETING_DASHBOARD_BASE_URL)

const REQUEST_PAGE_URL = `${PRODUCTION_DASHBOARD_BASE_URL}/marketing/request`

// Signature appended to every broker-facing reply. Keeps the
// "what can I ask for" surface one click away. Uses the RFC-822
// "-- " signature delimiter (dash-dash-space) so mail clients fold it.
const REPLY_SIGNATURE = [
  '',
  '-- ',
  'Ryan Realty marketing',
  `Here's what we can build for you: ${REQUEST_PAGE_URL}`,
].join('\n')

// ---------------------------------------------------------------------------
// Body composition — kept short, voice-compliant, broker-friendly.
// No internal jargon (no "brain queue", "action row", "producer", "routing").
// ---------------------------------------------------------------------------

function composeBody(ctx: ReplyContext): { subject: string; body: string } {
  const subject = ctx.original_subject
    ? `Re: ${ctx.original_subject}`
    : 'Re: your message to marketing'

  if (ctx.kind.kind === 'parsed_intent') {
    const body = [
      'Got it. Working on this now.',
      '',
      "We'll send an update on this thread as soon as we have a draft for you.",
      REPLY_SIGNATURE,
    ].join('\n')
    return { subject, body }
  }

  if (ctx.kind.kind === 'unknown_triage') {
    const body = [
      'Got it. We received your message and a team member will pick this up directly.',
      '',
      "We'll reply on this thread once we have a draft, or follow up with a clarifying question.",
      REPLY_SIGNATURE,
    ].join('\n')
    return { subject, body }
  }

  // rejected_sender
  const body = [
    'Thanks for the message.',
    '',
    'This inbox is reserved for the Ryan Realty brokerage team. Your sender address is not currently on the allowlist, so the request was not picked up.',
    '',
    'If you need to reach Ryan Realty, please use matt@ryan-realty.com or call 541.703.3095.',
  ].join('\n')
  return { subject: ctx.original_subject ? `Re: ${ctx.original_subject}` : 'Marketing inbox', body }
}

// ---------------------------------------------------------------------------
// Voice gate
// ---------------------------------------------------------------------------

/**
 * The mechanical brand-voice checker (formerly generate-briefs.ts's
 * applyBrandVoice) was retired 2026-09-07 along with the rest of the
 * producer-brief synthesis layer — it was already a no-op pass-through by
 * then. Kept here as a local no-op so the reply pipeline's shape (a
 * validation step that can fail and block a send) survives without a
 * second copy of a retired mechanical check living in a deleted file.
 */
function validateReplyVoice(_body: string): { passed: boolean; violations: string[] } {
  return { passed: true, violations: [] }
}

// ---------------------------------------------------------------------------
// RFC 822 + Gmail send
// ---------------------------------------------------------------------------

function buildRawMime(opts: {
  to: string
  toName: string | null
  from: string
  subject: string
  body: string
  inReplyTo: string
  references: string
}): string {
  const toHeader = opts.toName ? `"${opts.toName}" <${opts.to}>` : opts.to
  const lines = [
    `From: ${opts.from}`,
    `To: ${toHeader}`,
    `Subject: ${opts.subject}`,
    `In-Reply-To: ${opts.inReplyTo}`,
    `References: ${opts.references}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: 7bit',
    '',
    opts.body,
  ]
  return Buffer.from(lines.join('\r\n')).toString('base64url')
}

/**
 * Send a confirmation reply. Persists reply_status / reply_message_id /
 * reply_error onto the inbox event row. Idempotent in that calling it
 * twice for the same event simply records the latest outcome.
 */
export async function sendInboxReply(
  authClient: JWT,
  ctx: ReplyContext,
): Promise<ReplyOutcome> {
  const supabase = getSupabase()
  const { subject, body } = composeBody(ctx)
  const voice = validateReplyVoice(body)

  if (!voice.passed) {
    await supabase
      .from('marketing_inbox_events')
      .update({
        replied_at: new Date().toISOString(),
        reply_status: 'failed',
        reply_error: `voice_violation: ${voice.violations.join('; ')}`,
        status: 'dispatched', // keep at dispatched — failure to reply is not a kill
      })
      .eq('id', ctx.inbox_event_id)
    return { status: 'failed', voice_violations: voice.violations, error: 'voice_validation_failed' }
  }

  const gmail = google.gmail({ version: 'v1', auth: authClient, timeout: MARKETING_INBOX_REQUEST_TIMEOUT_MS })
  const raw = buildRawMime({
    to: ctx.to_email,
    toName: ctx.to_name,
    from: MARKETING_INBOX_USER,
    subject,
    body,
    inReplyTo: ctx.in_reply_to_message_id,
    references: ctx.in_reply_to_message_id,
  })

  try {
    const res = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw,
        threadId: ctx.thread_id,
      },
    })
    await supabase
      .from('marketing_inbox_events')
      .update({
        replied_at: new Date().toISOString(),
        reply_status: 'sent',
        reply_message_id: res.data.id ?? null,
        status: 'replied',
      })
      .eq('id', ctx.inbox_event_id)

    return { status: 'sent', gmail_message_id: res.data.id ?? undefined }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    // No HTTP status back means the send left and Gmail never answered
    // (timeout, dropped connection): it may already be in the thread, so the
    // row reads 'unconfirmed', never a confirmed failure a retry would resend.
    const unconfirmed = answeredStatus(e) == null
    const reply_error = unconfirmed
      ? `Gmail did not confirm this reply (${msg.replace(/\.$/, '')}). It may have gone out: check Sent in ${MARKETING_INBOX_USER} before treating it as unsent.`
      : msg
    const status = unconfirmed ? 'unconfirmed' : 'failed'
    await supabase
      .from('marketing_inbox_events')
      .update({
        replied_at: new Date().toISOString(),
        reply_status: status,
        reply_error,
      })
      .eq('id', ctx.inbox_event_id)
    return { status, error: reply_error }
  }
}
