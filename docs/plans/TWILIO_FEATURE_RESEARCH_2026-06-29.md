# Twilio features worth adding to the Ryan Realty CRM (research, 2026-06-29)

Grounded in current Twilio docs (Conversational Intelligence, Lookup v2, Branded
Calling, Messaging Services). Scoped to what we already run: A2P 10DLC verified, a
Twilio number per broker + a messaging service, native group MMS (Conversations),
inbound SMS webhook, voice forwarding to each broker's cell via `/api/twilio/voice`,
some call recording, and a `crm_timeline` that logs calls/texts/emails.

Tiers are by ROI-for-effort against the CRM we're building, not by Twilio's catalog.

---

## Tier 1 — high ROI, build next (directly serves the current asks)

### 1. Twilio Lookup v2 — Line Type Intelligence + Caller Name
- **What:** One GET per number returns line type (mobile / landline / VoIP),
  carrier, validity, and **caller name (CNAM)**. Also offers Reassigned-Number,
  Identity Match, and SMS-Pumping-Risk packages.
- **Why us:**
  - **Caller ID (the current ask):** resolve an inbound caller's *name* from their
    number when they're not a known contact, and stamp it on the `call` timeline row.
  - **Stop texting landlines:** before an SMS/blast, skip `landline` numbers — saves
    spend and avoids undeliverable sends. Run it on contact create + before blasts.
  - **Data quality:** flag bad numbers on the 18k-contact book; normalize to E.164.
  - **TCPA safety:** Reassigned-Number + SMS-Pumping-Risk reduce wrong-party and
    fraud exposure (pairs with our litigator/DNC suppression rules).
- **Effort:** Low. A `lib/crm/lookup.ts` wrapper + cache the result on the contact.
- **Cost:** per-lookup, fractions of a cent for line-type; caller-name slightly more.
- `GET https://lookups.twilio.com/v2/PhoneNumbers/{e164}?Fields=line_type_intelligence,caller_name`

### 2. Conversational Intelligence — auto transcribe + summarize calls AND voicemails
- **What:** An Intelligence Service transcribes recordings (post-call) or live calls,
  then runs **Language Operators** (GenAI) for summary, sentiment, intent, and
  **custom operators** (e.g. "extract the property address and price discussed",
  "did the client commit to a showing?"). Optional **PII redaction**.
- **Why us:** This is the killer CRM feature. Every recorded call + voicemail becomes
  a searchable transcript **and a one-line summary on the contact's timeline** —
  exactly the "VM transcripts in Comms" ask, extended to full calls. Sentiment +
  action items mean a broker can scan a contact's history in seconds.
- **Effort:** Medium. Create one Intelligence Service (en-US), enable Auto-Transcribe
  on our recordings, add a transcript-ready webhook → write `transcript` + `summary`
  into the `crm_timeline` payload for the `call`/`voicemail` row.
- **Cost:** per-minute transcription + per-operator. Meter it; start with Summary +
  Sentiment only.
- Covers the voicemail-transcript ask as a subset.

### 3. Voicemail capture + transcription (the specific ask)
- **What:** When a forwarded call isn't answered, TwiML `<Record>` the voicemail with
  a `recordingStatusCallback`; transcribe via #2 (or the lightweight classic
  `<Record transcribe transcribeCallback>` for short VMs).
- **Why us:** Today voicemail is effectively unimplemented (1 row, no recording/
  transcript). Brokers miss VM content unless they dial in.
- **Effort:** Low-Medium. Add the no-answer branch to `/api/twilio/voice`, a
  `recordingStatusCallback` route that writes a `voicemail` timeline row, then route
  the recording through #2 for the transcript. The Comms feed already renders
  `voicemail` rows + a recording player.

### 4. Message delivery-status callbacks
- **What:** `StatusCallback` per message → delivered / failed / undelivered (+ error).
- **Why us:** Today a sent text logs as "Text sent" with no delivery truth. A failed/
  undelivered status on the timeline tells a broker their text never landed (this is
  exactly what bit us on the Nichole group-text — Twilio said "delivered" but we had
  no in-CRM signal). Low effort, high trust.

---

## Tier 2 — trust + answer rates (calls actually get picked up)

### 5. Branded Calling (Basic → Enhanced) + Voice Integrity
- **What:** Display a verified **name** (Basic) or **name + logo + call reason**
  (Enhanced) on the recipient's mobile during outbound calls. Requires an approved
  Business Profile + a **Voice Integrity** instance (registers numbers with analytics
  vendors to cut "Spam Likely" labeling). US public beta on T-Mobile + Verizon.
- **Why us:** Real estate lives on outbound calls to leads. "Ryan Realty" + reason on
  the screen materially lifts answer rates and protects the numbers' reputation.
- **Effort:** Medium (registration/approval, up to ~7 days), little code.

### 6. CNAM registration
- **What:** Register the business name on each broker line so caller ID shows
  "Ryan Realty" (covers landlines, where Branded Calling doesn't reach).
- **Why us:** Cheap, complements #5, improves the *outbound* caller-ID story alongside
  the inbound-name resolution from Lookup (#1).

### 7. Advanced Opt-Out (messaging compliance)
- **What:** Messaging-Service-level STOP/HELP/START handling with custom keywords +
  confirmations, per-language/country, and an `OptOutType` on the inbound webhook.
- **Why us:** Automated, auditable TCPA/CTIA opt-out that feeds our suppression system
  (`contact:do-not-text`). Note: incompatible with phone-number redaction, and once
  enabled it can only be disabled via Twilio support — configure carefully first.

---

## Tier 3 — channel + engagement expansion

### 8. Twilio Voice SDK (WebRTC) — click-to-call in the CRM
- **What:** In-browser calling from the contact page; no desk phone or cell needed.
- **Why us:** A broker clicks a number on the contact-360 page and talks from the
  laptop; the call auto-records + logs + (with #2) transcribes. Removes the "call from
  your cell, manually log it" gap.
- **Effort:** Medium-High (token endpoint + a softphone UI component).

### 9. Conversation Orchestrator (Conversations v2) + Conversation Memory
- **What:** Auto-capture SMS + voice + WhatsApp into **one thread per customer**
  (`GROUP_BY_PROFILE`), with identity resolution + post-conversation memory/summary.
- **Why us:** The long-term home for the Comms tab — every channel for a contact in
  one true thread, and the cleanest path to **inbound group-reply logging** (the
  pending item on native group MMS). Bigger lift; revisit once group MMS is proven.

### 10. Scheduled Messaging + Link Shortening with click tracking
- **What:** `SendAt` to schedule sends; messaging-service link shortening emits
  per-recipient **click** events.
- **Why us:** Send at sane hours (pairs with our quiet-hours rule) and see which
  contact clicked the listing/CMA link — real engagement signal on the timeline.

### 11. WhatsApp / RCS senders
- **What:** Add WhatsApp and/or RCS to the messaging service sender pool.
- **Why us:** Some clients prefer WhatsApp; RCS gives branded, read-receipted, richer
  texts. Future channel growth, not urgent.

---

## Tier 4 — optional / future

- **Verify API** — phone OTP if/when we add a client-portal login or want to confirm a
  lead's number before nurture.
- **Answering Machine Detection (AMD)** — only if we build an outbound power-dialer.
- **Event Streams** — single firehose of all Twilio events into analytics/Supabase if
  we outgrow per-webhook logging.

---

## Recommended sequencing

1. **Lookup (#1)** + **delivery-status callbacks (#4)** — small, immediate, feed the
   caller-ID ask and message-trust.
2. **Voicemail (#3)** → **Conversational Intelligence (#2)** — the VM-transcript ask,
   then extend transcription/summary to all calls.
3. **Branded Calling + CNAM + Voice Integrity (#5/#6)** — start the registration clock
   early (approval latency).
4. **Advanced Opt-Out (#7)** — fold into the suppression system.
5. Later: **Voice SDK (#8)**, **Conversation Orchestrator (#9)** for the unified thread
   + inbound group-reply logging.

The two that directly close the current asks: **Lookup → caller ID/name**, and
**Conversational Intelligence → voicemail + call transcripts in Comms**.
