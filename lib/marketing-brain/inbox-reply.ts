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
 * Voice gate: every outbound body is passed through applyBrandVoice from
 * generate-briefs. On a failure the row is marked reply_status='failed'
 * with the violation list and the reply does NOT send.
 *
 * Auth: uses Gmail send via the service-account JWT (DWD path). Already
 * authorized in the Workspace allowlist as of 2026-05-14.
 */

import { google } from 'googleapis'
import type { JWT } from 'google-auth-library'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { applyBrandVoice } from './generate-briefs'
import { MARKETING_INBOX_USER } from './inbox-auth'

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
  status: 'sent' | 'failed' | 'skipped'
  gmail_message_id?: string
  voice_violations?: string[]
  error?: string
}

const PRODUCTION_DASHBOARD_BASE_URL =
  process.env.MARKETING_DASHBOARD_BASE_URL?.replace(/\/$/, '') || 'https://ryanrealty.vercel.app'

// ---------------------------------------------------------------------------
// Body composition — kept short, voice-compliant, and skimmable.
// ---------------------------------------------------------------------------

function composeBody(ctx: ReplyContext): { subject: string; body: string } {
  const subject = ctx.original_subject
    ? `Re: ${ctx.original_subject}`
    : 'Re: your message to the marketing brain'

  if (ctx.kind.kind === 'parsed_intent') {
    const link = `${PRODUCTION_DASHBOARD_BASE_URL}/marketing/actions/${ctx.kind.action_row_id}`
    const body = [
      'Got it. Adding this to the brain queue now.',
      '',
      `Action type:    ${ctx.kind.action_type}`,
      `Routed to:      ${ctx.kind.assigned_producer}`,
      `Action row id:  ${ctx.kind.action_row_id}`,
      `Track it here:  ${link}`,
      '',
      'Next step: the producer will assemble a draft and surface it for review. You will get a follow-up when it is ready.',
    ].join('\n')
    return { subject, body }
  }

  if (ctx.kind.kind === 'unknown_triage') {
    const link = `${PRODUCTION_DASHBOARD_BASE_URL}/marketing/actions/${ctx.kind.action_row_id}`
    const body = [
      'Got it. The brain logged your message and flagged it for human triage.',
      '',
      `Reason:         ${ctx.kind.triage_reason}`,
      `Action row id:  ${ctx.kind.action_row_id}`,
      `Track it here:  ${link}`,
      '',
      'Matt will review and either dispatch the right producer or reply with a clarifying question.',
    ].join('\n')
    return { subject, body }
  }

  // rejected_sender
  const body = [
    'Thanks for the message.',
    '',
    'This inbox is reserved for the Ryan Realty brokerage team. Your sender address is not currently on the allowlist, so the request was not routed.',
    '',
    'If you need to reach Ryan Realty, please use matt@ryan-realty.com or call 541.213.6706.',
  ].join('\n')
  return { subject: ctx.original_subject ? `Re: ${ctx.original_subject}` : 'Marketing inbox', body }
}

// ---------------------------------------------------------------------------
// Voice gate
// ---------------------------------------------------------------------------

function validateReplyVoice(body: string): { passed: boolean; violations: string[] } {
  // applyBrandVoice expects { hook, body, cta }; we send body in hook so
  // every sentence is checked. The phone-number rule in BANNED_PHRASES does
  // not strip dotted numbers like 541.213.6706.
  const result = applyBrandVoice({ hook: body, body: undefined, cta: undefined })
  return { passed: result.passed, violations: result.violations }
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

  const gmail = google.gmail({ version: 'v1', auth: authClient })
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
    await supabase
      .from('marketing_inbox_events')
      .update({
        replied_at: new Date().toISOString(),
        reply_status: 'failed',
        reply_error: msg,
      })
      .eq('id', ctx.inbox_event_id)
    return { status: 'failed', error: msg }
  }
}
