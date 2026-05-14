/**
 * marketing-brain: inbox-dispatcher
 *
 * Turns a parsed inbox event into a `marketing_brain_actions` row.
 *
 * Confidence ≥ INBOX_PARSE_CONFIDENCE_THRESHOLD (default 0.70) → dispatch a
 * row mirroring the parsed intent. The matching producer picks it up.
 *
 * Confidence < threshold (or action_type='unknown') → dispatch a
 * `comms:matt_alert` row asking Matt to triage manually. The
 * comms-matt-alert producer routes that to iMessage + dashboard.
 *
 * Both paths return the inserted action_row_id so the caller can link it
 * back on the marketing_inbox_events row.
 *
 * Locked 2026-05-14.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { INBOX_PARSE_CONFIDENCE_THRESHOLD, type InboxParseResult } from './inbox-parser'
import producerRegistry from './inbox-producer-registry'

let _supabase: SupabaseClient | null = null

function getSupabase(): SupabaseClient {
  if (_supabase) return _supabase
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase service-role credentials not configured')
  _supabase = createClient(url, key)
  return _supabase
}

export interface InboxEvent {
  id: string
  gmail_message_id: string
  gmail_thread_id: string
  sender_email: string
  sender_name: string | null
  subject: string | null
  body_text: string | null
}

export interface DispatchResult {
  action_row_id: string
  action_type: string
  assigned_producer: string
  dispatched_as: 'parsed_intent' | 'unknown_triage'
  reason: string
}

/**
 * Resolve action_type → assigned_producer using the (small) static
 * registry table imported from inbox-producer-registry. The registry is
 * synced manually with producers/REGISTRY.md the same way action_types
 * are in inbox-parser.ts. If a future producer is added and the parser
 * emits its action_type before this registry is updated, dispatch falls
 * through to comms:matt_alert with an explanatory note.
 */
function resolveProducer(actionType: string): string | null {
  const entry = producerRegistry[actionType]
  return entry ?? null
}

export async function dispatchParsedEmail(
  event: InboxEvent,
  parse: InboxParseResult,
): Promise<DispatchResult> {
  const supabase = getSupabase()
  const senderLabel = event.sender_name
    ? `${event.sender_name} <${event.sender_email}>`
    : event.sender_email

  const isConfident = parse.confidence >= INBOX_PARSE_CONFIDENCE_THRESHOLD
  const producer = resolveProducer(parse.action_type)
  const dispatchAsConfident = isConfident && parse.action_type !== 'unknown' && !!producer

  if (dispatchAsConfident) {
    const payload: Record<string, unknown> = {
      ...parse.payload,
      inbox_event_id: event.id,
      inbox_thread_id: event.gmail_thread_id,
      inbox_message_id: event.gmail_message_id,
      sender_email: event.sender_email,
      sender_name: event.sender_name,
      raw_subject: event.subject,
    }

    const dataEvidence = {
      audit_source: 'marketing-inbox',
      trigger_metric: 'inbox_email',
      parser_confidence: parse.confidence,
      parser_rationale: parse.rationale,
      parser_model: parse.model,
    }

    const generationReason =
      `inbox_email from ${event.sender_email}: "${(event.subject ?? '').slice(0, 80)}". ` +
      `Parsed as ${parse.action_type} for ${parse.target} (confidence ${parse.confidence.toFixed(2)}).`

    const insert = await supabase
      .from('marketing_brain_actions')
      .insert({
        action_type: parse.action_type,
        target: parse.target,
        assigned_producer: producer,
        payload,
        data_evidence: dataEvidence,
        topic: `Inbox: ${(event.subject ?? parse.action_type).slice(0, 100)}`,
        format: parse.action_type.replace(/^[^:]+:/, ''),
        platforms: [],
        hook: '',
        body: null,
        cta: null,
        target_audience: 'brand_default',
        data_sources: [
          {
            type: 'marketing-inbox',
            evidence: `Email from ${senderLabel} on ${new Date().toISOString().slice(0, 10)}.`,
          },
        ],
        predicted_outcome: {},
        status: 'pending',
        generated_by: 'marketing_brain:inbox-poll',
        generation_reason: generationReason,
      })
      .select('id')
      .single()

    if (insert.error || !insert.data) {
      throw new Error(`Failed to insert action row: ${insert.error?.message ?? 'no row returned'}`)
    }

    return {
      action_row_id: insert.data.id as string,
      action_type: parse.action_type,
      assigned_producer: producer,
      dispatched_as: 'parsed_intent',
      reason: `Confident parse (${parse.confidence.toFixed(2)}) routed to ${producer}.`,
    }
  }

  // Low confidence OR unknown action_type OR no registered producer → triage to Matt.
  const triageReason = parse.action_type === 'unknown'
    ? `Parser flagged email as unknown intent. Rationale: ${parse.rationale || 'none provided'}`
    : !producer
    ? `Parser returned ${parse.action_type} but no producer is registered for it.`
    : `Parser confidence ${parse.confidence.toFixed(2)} is below threshold ${INBOX_PARSE_CONFIDENCE_THRESHOLD}.`

  const alertBodyLines = [
    `An email arrived at marketing@ryan-realty.com that the brain could not auto-route.`,
    ``,
    `From:    ${senderLabel}`,
    `Subject: ${event.subject ?? '(no subject)'}`,
    ``,
    `Parser read:`,
    `  action_type: ${parse.action_type}`,
    `  target:      ${parse.target}`,
    `  confidence:  ${parse.confidence.toFixed(2)}`,
    `  rationale:   ${parse.rationale || '(none)'}`,
    ``,
    `Why this needs you:`,
    `  ${triageReason}`,
    ``,
    `Original message excerpt:`,
    (event.body_text ?? '').slice(0, 600),
    ``,
    `Inbox event id: ${event.id}`,
  ]

  const alertPayload = {
    urgency: 'medium',
    channel: 'email',
    subject: `Inbox triage: ${(event.subject ?? 'unparseable email').slice(0, 50)}`,
    body: alertBodyLines.join('\n'),
    body_short: `Inbox triage needed from ${event.sender_email}: ${(event.subject ?? '').slice(0, 100)}`,
    action_required: 'Open the marketing dashboard, find the inbox event, decide which producer should run, and re-dispatch.',
    related_inbox_event_id: event.id,
  }

  const insert = await supabase
    .from('marketing_brain_actions')
    .insert({
      action_type: 'comms:matt_alert',
      target: `recipient:matt:inbox_triage:${event.id}`,
      assigned_producer: 'marketing_brain_skills/producers/comms-matt-alert',
      payload: alertPayload,
      data_evidence: {
        audit_source: 'marketing-inbox',
        trigger_metric: 'inbox_parse_low_confidence',
        parser_confidence: parse.confidence,
        parser_action_type: parse.action_type,
        parser_rationale: parse.rationale,
        parser_model: parse.model,
      },
      topic: `Inbox triage — ${(event.subject ?? 'unknown').slice(0, 60)}`,
      format: 'comms_matt_alert',
      platforms: ['email'],
      hook: alertPayload.body_short,
      body: alertPayload.body,
      cta: null,
      target_audience: 'matt',
      data_sources: [
        {
          type: 'marketing-inbox',
          evidence: `Unparseable email from ${senderLabel}. Confidence ${parse.confidence.toFixed(2)}.`,
        },
      ],
      predicted_outcome: {
        primary_metric: 'queue_review_latency',
        expected_value: 'Matt manually triages within 1 working day',
        rationale: 'Low-confidence inbox parses are rare enough that manual triage is acceptable.',
      },
      status: 'pending',
      generated_by: 'marketing_brain:inbox-poll',
      generation_reason: `inbox_email triage. ${triageReason}`,
    })
    .select('id')
    .single()

  if (insert.error || !insert.data) {
    throw new Error(`Failed to insert triage action row: ${insert.error?.message ?? 'no row returned'}`)
  }

  return {
    action_row_id: insert.data.id as string,
    action_type: 'comms:matt_alert',
    assigned_producer: 'marketing_brain_skills/producers/comms-matt-alert',
    dispatched_as: 'unknown_triage',
    reason: triageReason,
  }
}
