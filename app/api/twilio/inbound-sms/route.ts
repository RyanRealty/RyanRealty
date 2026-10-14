/**
 * Twilio inbound SMS webhook (blueprint §5.5) — the "right agent depending on
 * the client" router.
 *
 * Hot path (AGENTS.md — Twilio inbound ack): validate signature, persist the
 * raw payload, return TwiML/200. CRM, timeline, DNC auto-clear, and STOP/START
 * opt-out run after the ack (or via twilio-webhook-replay).
 */

import { NextResponse, after } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { DEFAULT_DESK_BROKER, brokerForTwilioNumber, brokerTwilioNumber, forwardCellForBroker, normalizeTo10, sendSms, MARKETING_NUMBER } from '@/lib/crm/twilio'
import {
  ackTwilioWebhook,
  smsKeywordReply,
  STOP_WORDS,
  START_WORDS,
  HELP_WORDS,
} from '@/lib/crm/twilio-webhook-ack'
import { getBrokerTelephony } from '@/lib/data/crm/getBrokerTelephony'
import { findOrCreatePersonByPhone } from '@/lib/data/crm/findOrCreatePersonByPhone'
import { markConversationUnreadOnInbound } from '@/app/actions/crm-inbox'
import { addSuppression, clearNonOptOutSuppressions, removeSuppression } from '@/lib/crm/suppressions'
import { newLeadAlertBody, queueBrokerAlert } from '@/lib/crm/broker-alerts'
import { hasSellerIntent } from '@/lib/crm/seller-intent'
import { sendCrmEmail } from '@/lib/crm/gmail'
import { mailboxForSlug } from '@/lib/data/brokers/directory'
import { classifyInboundReply, REPLY_INTENT_LABELS, type ReplyClassification } from '@/lib/crm/reply-intent'
import { prospectOutreachContext } from '@/lib/crm/prospect-context'
import { buildSuggestedReplyLink } from '@/components/admin/crm/composer-preload'
import { handleAgentInbound, processAfterDebounce } from '@/lib/agent/ingress'
import { isBrokerSmsAgentEnvEnabled } from '@/lib/data/agent/broker-agent-flags'
import { CRM_BROKER_DISPLAY } from '@/lib/crm/constants'
import { applyInboundMessageEnrichment } from '@/lib/data/crm/applyInboundMessageEnrichment'
import { applyInboundConsentClear } from '@/lib/data/crm/applyInboundConsentClear'
import { isSmsStopKeyword } from '@/lib/crm/inbound-consent-clear'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
// Raised from 60 (docs/plans/BROKER_SMS_AGENT_2026-07-31.md R1.2): the agent
// branch below schedules a 20s-debounce + 30-120s model turn via after(),
// which Vercel counts against this same function's execution budget. The
// webhook itself still acks in well under a second on every branch.
export const maxDuration = 300

/** Extract Twilio MMS media (mediaSid + contentType + url) from the webhook params so
 *  client-sent photos/docs are captured, not silently dropped. Capped at 10.
 *  Timeline stores {mediaSid, contentType} only — URLs expire. */
function parseMms(
  params: Record<string, string>,
): Array<{ mediaSid: string; contentType: string; url: string }> {
  const n = Number(params.NumMedia ?? 0)
  const out: Array<{ mediaSid: string; contentType: string; url: string }> = []
  for (let i = 0; i < n && i < 10; i++) {
    const url = params[`MediaUrl${i}`] ?? ''
    const m = url.match(/\/Media\/(ME[a-f0-9]{32})/)
    if (m) {
      out.push({
        mediaSid: m[1],
        contentType: params[`MediaContentType${i}`] ?? 'application/octet-stream',
        url,
      })
    }
  }
  return out
}

/** Raw Twilio Media URLs for the broker SMS agent branch. Vault auto-file
 *  fetches PDFs immediately via fetchTwilioMedia (URLs expire). */
function rawMediaUrls(params: Record<string, string>): string[] {
  const n = Number(params.NumMedia ?? 0)
  const out: string[] = []
  for (let i = 0; i < n && i < 10; i++) {
    const url = params[`MediaUrl${i}`]
    if (url) out.push(url)
  }
  return out
}

function twiml(message?: string): NextResponse {
  const body = message
    ? `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${message}</Message></Response>`
    : `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`
  return new NextResponse(body, { status: 200, headers: { 'Content-Type': 'text/xml' } })
}

/**
 * Which broker owns this inbound number as their forward cell (null = not a
 * broker cell)? When we forward an inbound client text to a broker's cell
 * (below), the thread is the broker's business line — so if the broker taps
 * reply in their phone's Messages app, that reply lands back HERE as an inbound
 * from their cell. Guard it: a broker's own cell must never be turned into a
 * "lead" or re-forwarded. (True phone-native two-way reply is the Conversations
 * build on the roadmap; until then the forward body directs the broker to reply
 * in the app, which sends from the business line.)
 *
 * Also the branch point for the broker SMS agent (POST, below): the same
 * "this is a broker's own cell" fact that used to mean an unconditional silent
 * drop now ALSO means "maybe an agent turn" when the dialed number is the
 * marketing line and the agent is enabled for that broker.
 */
async function brokerForForwardCell(phone: string): Promise<string | null> {
  const ten = normalizeTo10(phone)
  if (!ten) return null
  try {
    const tel = await getBrokerTelephony()
    for (const [slug, e] of Object.entries(tel.bySlug)) {
      if (e?.forwardToCell && normalizeTo10(e.forwardToCell) === ten) return slug
    }
  } catch { /* fall through to env */ }
  const envCells: Record<string, string | undefined> = {
    matt: process.env.TWILIO_FORWARD_MATT,
    rebecca: process.env.TWILIO_FORWARD_REBECCA,
    paul: process.env.TWILIO_FORWARD_PAUL,
  }
  for (const [slug, v] of Object.entries(envCells)) {
    if (v && normalizeTo10(v) === ten) return slug
  }
  return null
}

/**
 * Forward an inbound text to a broker's own cell, sent FROM that broker's
 * A2P-verified business line so the phone thread is the business number. The
 * one send site for both forwards below (client text, and a colleague's text).
 * Skipped when the cell is the sender (no echo back to the person texting).
 *
 * AWAITED by callers, not fire-and-forget: on Vercel the function context is
 * frozen the instant we return the TwiML, so a `void sendSms(...)` in flight
 * gets killed and the forward only lands on Twilio's inbound RETRY minutes
 * later (verified 2026-07-15). Never throws: a forward failure must not 500 the
 * webhook (a non-2xx makes Twilio retry the whole inbound and double-log).
 */
async function forwardToBrokerCell(broker: string, senderPhone: string, body: string): Promise<InboundOutcome> {
  try {
    const [cell, line] = await Promise.all([forwardCellForBroker(broker), brokerTwilioNumber(broker)])
    if (!cell || !line) return { outcome: 'forward_failed', reason: `no forward cell or business line for ${broker}` }
    if (normalizeTo10(cell) === normalizeTo10(senderPhone)) return { outcome: 'dropped', reason: 'sender is the forward cell' }
    const r = await sendSms({ from: line, to: cell, body })
    if (!r.ok) {
      console.error('[twilio/inbound-sms] broker cell forward failed', r.error)
      return { outcome: 'forward_failed', reason: `forward to ${broker}`, forwardTo: cell, forwardError: r.error }
    }
    return { outcome: 'forwarded', reason: `forward to ${broker}`, forwardTo: cell, forwardSid: r.sid }
  } catch (err) {
    console.error('[twilio/inbound-sms] broker cell forward failed', err)
    return { outcome: 'forward_failed', reason: `forward to ${broker}`, forwardError: err instanceof Error ? err.message : String(err) }
  }
}

type InboundOutcome = {
  outcome: 'forwarded' | 'dropped' | 'forward_failed' | 'agent'
  reason: string
  forwardTo?: string
  forwardSid?: string
  forwardError?: string
}

/**
 * Record what happened to an inbound text (crm_sms_inbound_log). The
 * crm-health-check cron reads it against Twilio's received messages, so a text
 * that was never processed or never reached a broker's phone pages instead of
 * vanishing. Never throws: a log failure must not 500 the webhook.
 */
async function logInbound(sid: string, from: string, to: string, o: InboundOutcome): Promise<void> {
  try {
    const { error } = await createServiceClient().from('crm_sms_inbound_log').upsert(
      {
        message_sid: sid,
        from_number: from,
        to_number: to,
        outcome: o.outcome,
        reason: o.reason,
        forward_to: o.forwardTo ?? null,
        forward_sid: o.forwardSid ?? null,
        forward_error: o.forwardError ?? null,
      },
      { onConflict: 'message_sid' },
    )
    if (error) console.error('[twilio/inbound-sms] inbound log write failed', error.message)
  } catch (err) {
    console.error('[twilio/inbound-sms] inbound log write failed', err)
  }
}

// prospectOutreachContext moved to @/lib/crm/prospect-context (W5.3) so the
// crm-gmail-sync email path can classify inbound EMAIL replies the same way.

export async function POST(request: Request) {
  return ackTwilioWebhook({
    request,
    kind: 'inbound-sms',
    process: processInboundSms,
    respond: (params) => twiml(smsKeywordReply(params.Body)),
  })
}

/** CRM / timeline / opt-out / DNC-clear. Runs after the TwiML ack. */
export async function processInboundSms(params: Record<string, string>): Promise<void> {
  const from = params.From ?? ''
  const to = params.To ?? ''
  const body = (params.Body ?? '').trim()
  const sid = params.MessageSid ?? `unknown-${Date.now()}`

  // Block gate: a blocked/spam number's texts are dropped (no timeline, no
  // alert, empty 200 so Twilio doesn't retry), recorded in the inbound log only.
  const { isNumberBlocked } = await import('@/lib/data/crm/getBlockedNumber')
  if (await isNumberBlocked(from)) {
    await logInbound(sid, from, to, { outcome: 'dropped', reason: 'blocked number' })
    return
  }

  // Reply-loop guard / broker SMS agent branch (docs/plans/BROKER_SMS_AGENT_2026-07-31.md
  // R1.1). A text FROM a broker's own forward cell TO the shared marketing
  // line is either (a) the broker SMS agent, when BROKER_SMS_AGENT_ENABLED is
  // 'true' AND that broker's own sms_agent_enabled flag is on, or (b) the
  // broker replying/testing in the forwarded phone thread — never a lead,
  // never a re-forward, dropped silently exactly as before the agent existed.
  // (Real client replies come from the broker via the CRM composer, which
  // sends from the business line.) Broker→their OWN business line (not the
  // marketing line) is untouched by the agent branch and always drops here.
  // Broker→a COLLEAGUE's business line is relayed to that colleague's cell.
  const senderBroker = await brokerForForwardCell(from)
  const isBrokerCell = senderBroker !== null
  if (
    isBrokerCell &&
    normalizeTo10(to) === normalizeTo10(MARKETING_NUMBER) &&
    isBrokerSmsAgentEnvEnabled()
  ) {
    const result = await handleAgentInbound({ from, to, body, messageSid: sid, mediaUrls: rawMediaUrls(params) })
    if (result.status === 'queued') {
      after(() => processAfterDebounce(result.sessionId, result.messageSid, result.ctx))
    }
    // 'queued' work continues after this response via after(); 'not-agent'
    // (per-broker pilot flag off) and 'duplicate' (Twilio webhook retry) are
    // silent no-ops — every outcome here acks Twilio the same way the
    // pre-agent guard below did.
    await logInbound(sid, from, to, { outcome: 'agent', reason: `broker sms agent: ${result.status}` })
    return
  }
  // A broker texting a COLLEAGUE's business line (Matt's cell → Paul's line) is
  // an internal message, not a lead and not a reply loop: relay it to the
  // colleague's cell. The colleague's reply in that phone thread lands on their
  // own line from their own cell and drops here, so the body points them back
  // to the sender's cell.
  if (senderBroker) {
    const dialedLineOwner = await brokerForTwilioNumber(to)
    if (dialedLineOwner && dialedLineOwner !== senderBroker) {
      const media = parseMms(params)
      const relayBody = body || (media.length ? `[${media.length} attachment${media.length > 1 ? 's' : ''}]` : '')
      const name = CRM_BROKER_DISPLAY[senderBroker] ?? senderBroker
      const relayed = await forwardToBrokerCell(
        dialedLineOwner,
        from,
        `Text from ${name} (${from}):\n${relayBody.slice(0, 400)}\n\nReply to ${name} at ${from}.`,
      )
      await logInbound(sid, from, to, relayed)
    } else {
      await logInbound(sid, from, to, {
        outcome: 'dropped',
        reason: dialedLineOwner ? `${senderBroker} texted own business line` : `${senderBroker} texted the shared marketing line`,
      })
    }
    return
  }

  const firstToken = body.toLowerCase().split(/\s+/)[0] ?? ''
  const media = parseMms(params)
  const mediaMeta = media.map(({ mediaSid, contentType }) => ({ mediaSid, contentType }))
  const displayBody = body || (media.length ? `[${media.length} attachment${media.length > 1 ? 's' : ''}]` : '')
  const sb = createServiceClient()

  // Route by the DIALED Twilio line: a text to Paul's line creates a
  // Paul-assigned lead and alerts Paul. The shared marketing line (null) falls
  // back to the default desk. Unknown sender → create a lead (a text is a hot
  // signal). Shared find-or-create so the shape matches the inbound-voice path.
  const dialedBroker = await brokerForTwilioNumber(to)
  const { match, created } = await findOrCreatePersonByPhone({
    phone: from,
    source: 'inbound-sms',
    assignBroker: dialedBroker ?? DEFAULT_DESK_BROKER,
  })

  if (match) {
    await sb.from('crm_timeline').upsert(
      {
        person_id: match.personId,
        kind: 'sms_in',
        body: displayBody,
        payload: { fromNumber: from, toNumber: to, sid, ...(mediaMeta.length ? { media: mediaMeta, messageSid: sid } : {}) },
        broker: match.broker,
        source: 'twilio',
        dedupe_key: `twilio:${sid}:p${match.personId}`,
      },
      { onConflict: 'dedupe_key', ignoreDuplicates: true },
    )

    // A recorded sms_in lifts import / non-opt-out suppressions (mark, never
    // delete). STOP/START/HELP still run after this; real opt-outs stay.
    // TCPA: an explicit STOP keyword must never clear DNC / no-SMS flags.
    if (!isSmsStopKeyword(body)) {
      try {
        await clearNonOptOutSuppressions({
          personId: match.personId,
          clearedBy: 'inbound-sms',
          clearedReason: `inbound sms_in ${sid}`,
        })
      } catch (e) {
        console.warn('[twilio/inbound-sms] clear non-opt-out suppressions failed', e)
      }
      try {
        await applyInboundConsentClear({
          personId: match.personId,
          event: 'sms',
          eventId: sid,
          smsBody: body,
          broker: match.broker,
        })
      } catch (e) {
        console.warn('[twilio/inbound-sms] inbound consent clear failed', e)
      }
    }

    // Shadow-write into the conversation model (RC1). Non-fatal: the timeline is
    // still the source of truth until the inbox read path flips. The message-insert
    // trigger sets needs_reply + reopens a closed thread to unread.
    try {
      const { recordConversationMessage } = await import('@/lib/crm/record-message')
      await recordConversationMessage({
        sb, direction: 'in', channel: media.length ? 'mms' : 'sms', body: displayBody,
        providerSid: sid, primaryPersonId: match.personId, assignedBroker: match.broker,
        media: mediaMeta.length ? mediaMeta : [],
        participants: [{ personId: match.personId, address: from }],
      })
    } catch (e) { console.warn('[twilio/inbound-sms] conversation shadow-write failed', e) }

    // Reset the inbox conversation to "unread" so the new inbound surfaces in the
    // triage queue (Wave 7). Idempotent; never sends a message.
    await markConversationUnreadOnInbound(match.personId)

    // A human replied: advance the stage, stop any running automation, task the
    // broker and tell them. Non-blocking by construction — the inbound message
    // is already recorded above and must never be lost to a failure in here.
    try {
      const { handleInboundReply } = await import('@/lib/crm/on-reply')
      await handleInboundReply({
        personId: match.personId,
        broker: match.broker,
        channel: 'sms',
        preview: displayBody,
      })
    } catch (e) {
      console.warn('[twilio/inbound-sms] reply handler failed', e)
    }

    try {
      const { pdfMmsParts } = await import('@/lib/tc/file-comms')
      const { fileCommsToVault } = await import('@/lib/tc/file-comms-write')
      const pdfs = pdfMmsParts(media)
      const attachments: Array<{ sourceDocId: string; name: string; bytes: Buffer; contentType: string }> = []
      if (pdfs.length) {
        const { fetchTwilioMedia } = await import('@/lib/agent/assets')
        for (const part of pdfs) {
          try {
            const got = await fetchTwilioMedia(part.url)
            attachments.push({
              sourceDocId: `twilio:${sid}:${part.mediaSid}`.slice(0, 180),
              name: `${part.mediaSid}.pdf`,
              bytes: got.buffer,
              contentType: got.contentType || 'application/pdf',
            })
          } catch (fetchErr) {
            console.warn('[twilio/inbound-sms] MMS PDF fetch failed', fetchErr)
          }
        }
      }
      await fileCommsToVault({
        personIds: [match.personId],
        fromPhones: [from],
        channel: 'sms',
        actor: `twilio:${match.broker ?? 'desk'}`,
        title: null,
        body: displayBody,
        filenames: [
          ...media.map((m) => m.contentType),
          ...attachments.map((a) => a.name),
        ],
        attachments,
        dedupeKey: `sms:${sid}`,
      })
    } catch (err) {
      console.warn('[twilio/inbound-sms] vault auto-file failed', err)
    }

    // HELP keyword → carrier-required help reply (does not change subscription).
    if (HELP_WORDS.has(firstToken)) {
      await logInbound(sid, from, to, { outcome: 'dropped', reason: 'HELP keyword' })
      return
    }

    // STOP handling (leading-token match) → suppression chokepoint
    if (STOP_WORDS.has(firstToken)) {
      await addSuppression({ personId: match.personId, channel: 'sms', reason: 'stop-keyword', source: 'twilio' })
      await sb.from('crm_timeline').insert({
        person_id: match.personId, kind: 'system',
        title: 'SMS opt-out (STOP) — sms channel suppressed', source: 'twilio',
      })
      await logInbound(sid, from, to, { outcome: 'dropped', reason: 'STOP keyword' })
      return
    }

    // START handling (audit p0.3): the STOP reply promises "Reply START to
    // resubscribe", so honor it. Only clears the user's own sms stop-keyword
    // opt-out — never a compliance do-not-text/hard-stop suppression we set.
    if (START_WORDS.has(firstToken)) {
      await removeSuppression({ personId: match.personId, channel: 'sms', reason: 'stop-keyword' })
      await sb.from('crm_timeline').insert({
        person_id: match.personId, kind: 'system',
        title: 'SMS opt-in (START) — sms stop-keyword suppression removed', source: 'twilio',
      })
      await logInbound(sid, from, to, { outcome: 'dropped', reason: 'START keyword' })
      return
    }

    // Route the alert to the dialed line's broker (the contact's assignment for
    // the shared marketing line), then the default desk.
    const alertBroker = dialedBroker ?? match.broker ?? 'matt'

    // New-lead alert — only on a real create, so a known texter never re-alerts.
    // An inbound text from an unknown number is the hottest signal there is.
    if (created) {
      await queueBrokerAlert({
        broker: alertBroker,
        personId: match.personId,
        kind: 'new-lead',
        body: newLeadAlertBody({
          name: match.name,
          source: 'inbound-sms',
          stage: 'Lead',
          personId: match.personId,
          detail: `Texting now from ${from}: ${body.slice(0, 120)}`,
          // "What's my home worth" → land the broker one tap from the CMA
          // kick-off (D8 litmus: notification → pre-filled build in ≤3 taps).
          intent: hasSellerIntent(body) ? 'cma' : undefined,
        }),
      })
    }

    // Reply-intent classification (prospecting pipelines only). Runs AFTER the
    // STOP/START/HELP keyword handling and suppression writes above — those
    // branches already returned. Strictly additive + fail-open: any error (or
    // the CRM_REPLY_INTENT_DISABLED=1 kill switch) leaves replyIntel null and
    // every write below byte-identical to pre-classifier behavior. Intent
    // 'other' (bare ack) is treated as no-signal — no enrichment, no note.
    let replyIntel: ReplyClassification | null = null
    if (body) {
      try {
        const prospect = await prospectOutreachContext(sb, match.personId)
        if (prospect) {
          replyIntel = await classifyInboundReply({
            body,
            context: { kind: prospect.kind, personName: match.name, address: prospect.address },
          })
          if (replyIntel?.intent === 'other') replyIntel = null
        }
      } catch (err) {
        console.warn('[inbound-sms] reply-intent classification failed (fail-open)', err)
        replyIntel = null
      }
    }

    // System note with the classification so the thread carries the "why"
    // behind the enriched task. Same retry-safe dedupe pattern as sms_in.
    if (replyIntel) {
      try {
        await sb.from('crm_timeline').upsert(
          {
            person_id: match.personId,
            kind: 'system',
            title: `Text reply classified: ${REPLY_INTENT_LABELS[replyIntel.intent]}`,
            body: replyIntel.recommendedReply ? `Suggested reply: ${replyIntel.recommendedReply}` : null,
            payload: {
              intent: replyIntel.intent,
              confidence: replyIntel.confidence,
              recommendedReply: replyIntel.recommendedReply,
              classifierSource: replyIntel.source,
              ...(replyIntel.model ? { model: replyIntel.model } : {}),
              messageSid: sid,
            },
            source: 'twilio',
            dedupe_key: `twilio-intent:${sid}:p${match.personId}`,
          },
          { onConflict: 'dedupe_key', ignoreDuplicates: true },
        )
      } catch (err) {
        console.warn('[inbound-sms] reply-intent timeline note failed', err)
      }
    }

    const intentLabel = replyIntel ? REPLY_INTENT_LABELS[replyIntel.intent] : null
    const baseTaskName = `Reply to text from ${match.name ?? from}`
    const taskName = replyIntel && intentLabel
      ? `${baseTaskName} (${intentLabel.toLowerCase()})${replyIntel.recommendedReply ? `. Suggested: ${replyIntel.recommendedReply.slice(0, 160)}` : ''}`
      : baseTaskName

    // Alert the assigned broker: open a task + email notification. Upsert on a
    // per-message dedupe_key so a Twilio inbound RETRY (non-2xx/timeout) can't
    // stack duplicate "reply to text" tasks for the same inbound message.
    await sb.from('crm_tasks').upsert(
      {
        person_id: match.personId,
        name: taskName,
        type: 'Text',
        due_at: new Date(Date.now() + 15 * 60000).toISOString(),
        assigned_broker: alertBroker,
        origin: 'twilio',
        dedupe_key: `twilio-task:${sid}:p${match.personId}`,
      },
      { onConflict: 'dedupe_key', ignoreDuplicates: true },
    )
    const mailbox = await mailboxForSlug(alertBroker)
    // AWAITED: a bare void is dropped when Vercel freezes the invocation on
    // response, so the broker's new-text email alert silently never sends.
    // try/catch keeps a mail failure from 500-ing the webhook (Twilio retry).
    try {
      // With a classification, the alert leads with "They said / Suggested
      // reply" so the broker can one-tap copy the draft. Without one, the body
      // is byte-identical to the pre-classifier alert.
      // Conversation link preloads the composer with the §0-sanitized suggested
      // reply (?reply=…) when the classifier produced one, so the broker taps the
      // email link and the SMS composer opens already filled (never sends — G50
      // suppression still gates the send). No reply -> plain #comms link.
      const convoLink = buildSuggestedReplyLink(
        `https://ryan-realty.com/admin/people/${match.personId}`,
        replyIntel?.recommendedReply ? { channel: 'sms', body: replyIntel.recommendedReply } : null,
      )
      const alertBodyText = replyIntel && intentLabel
        ? `They said: ${body}\n\nIntent: ${intentLabel} (${Math.round(replyIntel.confidence * 100)}% confident)${replyIntel.recommendedReply ? `\nSuggested reply: ${replyIntel.recommendedReply}` : ''}\n\nFrom ${from} to ${to}\nOpen the conversation: ${convoLink}`
        : `${body}\n\nFrom ${from} to ${to}\nOpen the conversation: ${convoLink}`
      await sendCrmEmail({
        fromMailbox: mailbox.email,
        to: mailbox.email,
        subject: `New text from ${match.name ?? from}`,
        // Link the CANONICAL person page — /admin/people/{id} (Phase 11B/B3
        // repoint off the /admin/crm/{id} bridge route). Never link through a
        // redirecting route: a 307 DROPS the #comms fragment (verified
        // 2026-07-13), so the tab never opens. Linking direct keeps the hash →
        // the mobile Comms tab opens on the thread.
        bodyText: alertBodyText,
      })
    } catch (err) {
      console.error('[inbound-sms] alert email failed', err)
    }

    // Name / intent / area from the text. Placeholder names only. Never replies
    // to the sender. after() so Twilio gets TwiML before the Claude call.
    if (displayBody) {
      const enrichArgs = {
        personId: match.personId,
        body: displayBody,
        channel: 'sms' as const,
        fromNumber: from,
        messageSid: sid,
        broker: match.broker,
      }
      const runEnrich = () =>
        applyInboundMessageEnrichment(enrichArgs).catch((e) => {
          console.warn('[twilio/inbound-sms] inbound enrich failed', e)
        })
      try {
        after(() => {
          void runEnrich()
        })
      } catch {
        void runEnrich()
      }
    }

    // Real-time forward to the assigned broker's cell — parity with the inbound
    // VOICE call-forward, which already rings the cell (the reason a client's
    // CALL reaches the broker's phone but their TEXT did not). Deep-links to the
    // CRM thread where a reply also sends from the business line. Auto-replies
    // (STOP/HELP/START) are handled above and never forwarded.
    const forwarded = await forwardToBrokerCell(
      alertBroker,
      from,
      `Text from ${match.name ?? from} (${from}):\n${displayBody.slice(0, 400)}\n\nReply (sends from your business line): ryan-realty.com/admin/people/${match.personId}#comms`,
    )
    await logInbound(sid, from, to, forwarded)
    return
  }

  await logInbound(sid, from, to, { outcome: 'forward_failed', reason: 'no CRM person for sender' })
}
