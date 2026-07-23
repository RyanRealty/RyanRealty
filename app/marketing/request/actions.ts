'use server'

/**
 * submitMarketingRequest — the SECOND intake into the marketing queue (W10.1).
 *
 * "Two intakes, one queue": a broker can either email marketing@ryan-realty.com
 * (the Gmail poll in lib/marketing-brain/inbox-poll.ts) or submit this form.
 * Both land in the SAME places and take the SAME path, so nothing about the
 * downstream brain has to know which door a request came through:
 *
 *   marketing_inbox_events  (the intake record, one row per request)
 *     -> parseInboxEmail    (the same parser — deliverables.ts prompts are
 *                            written in the present-tense verb form it reads)
 *     -> dispatchParsedEmail(the same queue writer -> marketing_brain_actions)
 *
 * The page itself stays public (it is linked from an email signature), but the
 * WRITE is gated twice: a signed-in session AND the same sender allowlist the
 * email door enforces (config/marketing-brain/inbox-senders.json). A session
 * alone is not enough — this site has public self-serve signup, so "any logged
 * in user" would let a member of the public enqueue real work. Two intakes, one
 * queue, one authorization policy.
 *
 * Known asymmetry: dispatchParsedEmail stamps generated_by
 * 'marketing_brain:inbox-poll' on every row, so the action row itself does not
 * record which door it came from. The `form:` prefix on the intake row's
 * gmail_message_id is what distinguishes a form request in the audit trail.
 */

import { randomUUID } from 'node:crypto'
import { getSession } from '@/app/actions/auth'
import { createServiceClient } from '@/lib/supabase/service'
import { isSenderAllowed } from '@/lib/marketing-brain/inbox-allowlist'
import { parseInboxEmail } from '@/lib/marketing-brain/inbox-parser'
import { dispatchParsedEmail, type InboxEvent } from '@/lib/marketing-brain/inbox-dispatcher'

export interface SubmitMarketingRequestInput {
  subject: string
  body: string
}

export type SubmitMarketingRequestResult =
  | { ok: true; actionRowId: string; actionType: string }
  | { ok: false; error: string }

export async function submitMarketingRequest(
  input: SubmitMarketingRequestInput,
): Promise<SubmitMarketingRequestResult> {
  // 1. Auth — a write into the brain's queue is never anonymous.
  const session = await getSession()
  const senderEmail = session?.user?.email
  if (!senderEmail) {
    return { ok: false, error: 'Sign in first so we know who the request is from.' }
  }

  // 2. AUTHORIZATION — being signed in is NOT enough. ryan-realty.com has public
  // self-serve signup (saved searches / alerts), so "any session" would let any
  // member of the public enqueue real work, burn an Anthropic call per submit,
  // and put a producer row in front of Matt. Enforce the SAME allowlist the
  // email door enforces (config/marketing-brain/inbox-senders.json) so both
  // intakes share one authorization policy, not just one queue.
  const allow = isSenderAllowed(senderEmail)
  if (!allow.allowed) {
    return {
      ok: false,
      error: 'This form is for Ryan Realty staff. Email marketing@ryan-realty.com and the team will pick it up.',
    }
  }

  const senderName =
    (session?.user as { name?: string | null } | undefined)?.name ?? null

  const subject = (input.subject ?? '').trim().slice(0, 300) || 'Marketing request'
  const body = (input.body ?? '').trim()
  if (!body) return { ok: false, error: 'Pick at least one thing before sending.' }
  // Synthetic ids: gmail_message_id / gmail_thread_id are NOT NULL on the shared
  // intake table, and a form request has no Gmail thread. The `form:` prefix is
  // what distinguishes a form intake from an email one.
  const formRef = `form:${randomUUID()}`

  try {
    const supabase = createServiceClient()
    // 3. Intake row — the same table the email door writes.
    const { data: event, error: insertError } = await supabase
      .from('marketing_inbox_events')
      .insert({
        gmail_message_id: formRef,
        gmail_thread_id: formRef,
        sender_email: senderEmail,
        sender_name: senderName,
        subject,
        body_text: body,
        status: 'received',
      })
      .select('id')
      .single()
    if (insertError || !event?.id) {
      return { ok: false, error: 'Could not record the request. Try again.' }
    }

    // 4. Parse — the same parser the inbox cron runs.
    const parse = await parseInboxEmail({ from: senderEmail, subject, body_text: body })
    await supabase
      .from('marketing_inbox_events')
      .update({
        parsed_at: new Date().toISOString(),
        parsed_intent: parse.action_type,
        parsed_target: parse.target,
        parsed_payload: parse.payload,
        parser_confidence: parse.confidence,
        parser_model: parse.model,
        parser_rationale: parse.rationale,
        status: 'parsed',
      })
      .eq('id', event.id)

    // 5. Dispatch — the same queue writer the inbox cron uses.
    const dispatch = await dispatchParsedEmail(
      {
        id: event.id,
        gmail_message_id: formRef,
        gmail_thread_id: formRef,
        sender_email: senderEmail,
        sender_name: senderName,
        subject,
        body_text: body,
      } as InboxEvent,
      parse,
    )

    await supabase
      .from('marketing_inbox_events')
      .update({ action_row_id: dispatch.action_row_id, status: 'dispatched' })
      .eq('id', event.id)

    return { ok: true, actionRowId: dispatch.action_row_id, actionType: dispatch.action_type }
  } catch (err) {
    console.error('[marketing/request] submit failed:', err)
    return { ok: false, error: 'Something broke on our side. Email marketing@ryan-realty.com instead.' }
  }
}
