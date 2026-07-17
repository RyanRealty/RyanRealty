/**
 * Twilio inbound SMS webhook (blueprint §5.5) — the "right agent depending on
 * the client" router.
 *
 * 1. Validate the Twilio signature (reject spoofed posts).
 * 2. Match the sender against crm_contact_points → known contact: write
 *    sms_in to their timeline, alert the ASSIGNED broker (email + task).
 * 3. Unknown sender → create a lead (source inbound-sms), alert immediately.
 * 4. STOP/UNSUBSCRIBE keywords → suppression chokepoint (sms channel).
 */

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { DEFAULT_DESK_BROKER, brokerForTwilioNumber, verifiedTwilioParams, brokerTwilioNumber, forwardCellForBroker, normalizeTo10, sendSms } from '@/lib/crm/twilio'
import { getBrokerTelephony } from '@/lib/data/crm/getBrokerTelephony'
import { findOrCreatePersonByPhone } from '@/lib/data/crm/findOrCreatePersonByPhone'
import { markConversationUnreadOnInbound } from '@/app/actions/crm-inbox'
import { addSuppression, removeSuppression } from '@/lib/crm/suppressions'
import { newLeadAlertBody, queueBrokerAlert } from '@/lib/crm/broker-alerts'
import { hasSellerIntent } from '@/lib/crm/seller-intent'
import { CRM_MAILBOXES, sendCrmEmail } from '@/lib/crm/gmail'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const STOP_WORDS = new Set(['stop', 'stopall', 'unsubscribe', 'cancel', 'end', 'quit'])
const START_WORDS = new Set(['start', 'unstop', 'yes', 'resubscribe'])
const HELP_WORDS = new Set(['help', 'info'])

/** Extract Twilio MMS media (mediaSid + contentType) from the webhook params so
 *  client-sent photos/docs are captured, not silently dropped. Capped at 10. */
function parseMms(params: Record<string, string>): Array<{ mediaSid: string; contentType: string }> {
  const n = Number(params.NumMedia ?? 0)
  const out: Array<{ mediaSid: string; contentType: string }> = []
  for (let i = 0; i < n && i < 10; i++) {
    const url = params[`MediaUrl${i}`] ?? ''
    const m = url.match(/\/Media\/(ME[a-f0-9]{32})/)
    if (m) out.push({ mediaSid: m[1], contentType: params[`MediaContentType${i}`] ?? 'application/octet-stream' })
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
 * Is this inbound number one of our brokers' own forward cells? When we forward
 * an inbound client text to a broker's cell (below), the thread is the broker's
 * business line — so if the broker taps reply in their phone's Messages app,
 * that reply lands back HERE as an inbound from their cell. Guard it: a broker's
 * own cell must never be turned into a "lead" or re-forwarded. (True phone-native
 * two-way reply is the Conversations build on the roadmap; until then the forward
 * body directs the broker to reply in the app, which sends from the business line.)
 */
async function isBrokerForwardCell(phone: string): Promise<boolean> {
  const ten = normalizeTo10(phone)
  if (!ten) return false
  try {
    const tel = await getBrokerTelephony()
    for (const e of Object.values(tel.bySlug)) {
      if (e?.forwardToCell && normalizeTo10(e.forwardToCell) === ten) return true
    }
  } catch { /* fall through to env */ }
  for (const v of [process.env.TWILIO_FORWARD_MATT, process.env.TWILIO_FORWARD_REBECCA, process.env.TWILIO_FORWARD_PAUL]) {
    if (v && normalizeTo10(v) === ten) return true
  }
  return false
}

export async function POST(request: Request) {
  const verified = await verifiedTwilioParams(request)
  if (!verified.ok) return NextResponse.json({ error: 'invalid signature' }, { status: 403 })
  const params = verified.params

  const from = params.From ?? ''
  // Block gate: a blocked/spam number's texts are dropped silently (no log, no
  // alert, empty 200 so Twilio doesn't retry).
  const { isNumberBlocked } = await import('@/lib/data/crm/getBlockedNumber')
  if (await isNumberBlocked(from)) return twiml()
  // Reply-loop guard: a text FROM a broker's own forward cell is that broker
  // replying (or testing) in the forwarded phone thread — never a lead, never a
  // re-forward. Drop it silently so it can't create a self-lead. (Real client
  // replies come from the broker via the CRM composer, which sends from the
  // business line.)
  if (await isBrokerForwardCell(from)) return twiml()
  const to = params.To ?? ''
  const body = (params.Body ?? '').trim()
  const sid = params.MessageSid ?? `unknown-${Date.now()}`
  const firstToken = body.toLowerCase().split(/\s+/)[0] ?? ''
  const media = parseMms(params)
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
        payload: { fromNumber: from, toNumber: to, sid, ...(media.length ? { media, messageSid: sid } : {}) },
        broker: match.broker,
        source: 'twilio',
        dedupe_key: `twilio:${sid}:p${match.personId}`,
      },
      { onConflict: 'dedupe_key', ignoreDuplicates: true },
    )

    // Shadow-write into the conversation model (RC1). Non-fatal: the timeline is
    // still the source of truth until the inbox read path flips. The message-insert
    // trigger sets needs_reply + reopens a closed thread to unread.
    try {
      const { recordConversationMessage } = await import('@/lib/crm/record-message')
      await recordConversationMessage({
        sb, direction: 'in', channel: media.length ? 'mms' : 'sms', body: displayBody,
        providerSid: sid, primaryPersonId: match.personId, assignedBroker: match.broker,
        media: media.length ? media : [],
        participants: [{ personId: match.personId, address: from }],
      })
    } catch (e) { console.warn('[twilio/inbound-sms] conversation shadow-write failed', e) }

    // Reset the inbox conversation to "unread" so the new inbound surfaces in the
    // triage queue (Wave 7). Idempotent; never sends a message.
    await markConversationUnreadOnInbound(match.personId)

    // HELP keyword → carrier-required help reply (does not change subscription).
    if (HELP_WORDS.has(firstToken)) {
      return twiml('Ryan Realty. Reply STOP to opt out. Msg and data rates may apply. For help visit ryan-realty.com/contact.')
    }

    // STOP handling (leading-token match) → suppression chokepoint
    if (STOP_WORDS.has(firstToken)) {
      await addSuppression({ personId: match.personId, channel: 'sms', reason: 'stop-keyword', source: 'twilio' })
      await sb.from('crm_timeline').insert({
        person_id: match.personId, kind: 'system',
        title: 'SMS opt-out (STOP) — sms channel suppressed', source: 'twilio',
      })
      return twiml('You have been unsubscribed and will not receive further texts. Reply START to resubscribe.')
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
      return twiml('You are resubscribed and will receive texts again. Reply STOP to opt out.')
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

    // Alert the assigned broker: open a task + email notification. Upsert on a
    // per-message dedupe_key so a Twilio inbound RETRY (non-2xx/timeout) can't
    // stack duplicate "reply to text" tasks for the same inbound message.
    await sb.from('crm_tasks').upsert(
      {
        person_id: match.personId,
        name: `Reply to text from ${match.name ?? from}`,
        type: 'Text',
        due_at: new Date(Date.now() + 15 * 60000).toISOString(),
        assigned_broker: alertBroker,
        origin: 'twilio',
        dedupe_key: `twilio-task:${sid}:p${match.personId}`,
      },
      { onConflict: 'dedupe_key', ignoreDuplicates: true },
    )
    const mailbox = CRM_MAILBOXES.find((m) => m.slug === alertBroker) ?? CRM_MAILBOXES[0]
    // AWAITED: a bare void is dropped when Vercel freezes the invocation on
    // response, so the broker's new-text email alert silently never sends.
    // try/catch keeps a mail failure from 500-ing the webhook (Twilio retry).
    try {
      await sendCrmEmail({
        fromMailbox: mailbox.email,
        to: mailbox.email,
        subject: `New text from ${match.name ?? from}`,
        // Link the CANONICAL command-center URL — /admin/crm/{id} since the
        // 2026-07-15 route consolidation (the old /admin/console/leads/{id} is
        // now the redirect stub). Never link through a redirecting route: a 307
        // DROPS the #comms fragment (verified 2026-07-13), so the tab never
        // opens. Linking direct keeps the hash → the mobile Comms tab opens on
        // the thread.
        bodyText: `${body}\n\nFrom ${from} to ${to}\nOpen the conversation: https://ryan-realty.com/admin/crm/${match.personId}#comms`,
      })
    } catch (err) {
      console.error('[inbound-sms] alert email failed', err)
    }

    // Real-time forward to the assigned broker's cell — parity with the inbound
    // VOICE call-forward, which already rings the cell (the reason a client's
    // CALL reaches the broker's phone but their TEXT did not). Sends FROM the
    // broker's own A2P-verified business line so the phone thread is the business
    // number, and deep-links to the CRM thread where a reply also sends from the
    // business line. Auto-replies (STOP/HELP/START) are handled above and never
    // forwarded.
    //
    // AWAITED, not fire-and-forget: on Vercel the function context is frozen the
    // instant we return the TwiML, so a `void sendSms(...)` in flight gets killed
    // and the forward only lands on Twilio's inbound RETRY minutes later (verified
    // 2026-07-15 — a client reply logged to the CRM at 19:36 but did not reach the
    // broker's phone until 19:48). Awaiting the single fast Twilio POST guarantees
    // it completes; the try/catch keeps a forward failure from 500-ing the webhook
    // (a non-2xx makes Twilio retry the whole inbound and double-log).
    if (!HELP_WORDS.has(firstToken) && !STOP_WORDS.has(firstToken) && !START_WORDS.has(firstToken)) {
      const [brokerCell, brokerLine] = await Promise.all([
        forwardCellForBroker(alertBroker),
        brokerTwilioNumber(alertBroker),
      ])
      if (brokerCell && brokerLine && normalizeTo10(brokerCell) !== normalizeTo10(from)) {
        const fwd = `Text from ${match.name ?? from} (${from}):\n${displayBody.slice(0, 400)}\n\nReply (sends from your business line): ryan-realty.com/admin/crm/${match.personId}#comms`
        try {
          await sendSms({ from: brokerLine, to: brokerCell, body: fwd })
        } catch (err) {
          console.error('inbound-sms: broker cell forward failed', err)
        }
      }
    }
  }

  return twiml()
}
