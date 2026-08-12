# Process: broker-direct-call-text — Direct call or text to a broker line

## 0. Meta

- Status: **deepened**
- Cadence: **event-driven** (a tap or an off-site dial, any hour; the capture plane is
  always-on webhooks)
- Verdict (**PROPOSAL, not a lock — P3 decides**): **KEEP** — this is the only process whose
  completion is a live human conversation, and the only one whose capture plane is
  webhook-driven telephony rather than a form action. It shares the person-create substrate
  with the form processes (`findOrCreatePersonByPhone` mirrors `ensureNativeLead`'s shape by
  design — `lib/data/crm/findOrCreatePersonByPhone.ts:7-23`) but shares no pipeline, no
  route, and no completion contract with `contact-form-inquiry`; merging there would bury
  the highest-intent channel inside a form process it never touches. Keep standalone. P3
  should also rule where the `mailto:` sub-channel lands (§9 — it rides the same page
  sections but completes in the email-ingest plane).
- Last evidence pass: **2026-08-11** (every file:line below opened this run)

## 1. Purpose

A visitor who wants a human — about a listing, a valuation, or anything — reaches the right
broker's real line in one tap and is talking to that broker (or leaving a voicemail that
gets called back) instead of filling out a form and waiting. The machine outcome is
**contact made, attributed, and durable**: because every published number is a Twilio line
that forwards to the broker's cell (cutover 2026-06-24, `lib/brand/contact.ts:76-80`),
serving the visitor's "talk to a person now" need automatically creates/finds the CRM
person, logs the call or text on their timeline, and alerts the owning broker — the
conversation itself becomes the CRM record instead of escaping it.

## 2. Inception (what starts it)

Trigger: a tap on a `tel:` / `sms:` link on any site surface, or a dial/text of a published
Ryan Realty number from off-site. Channels: any site page (direct, organic, paid — the links
are in shared chrome and page bodies) plus fully off-site (GBP listing, signage, print — the
webhook plane captures ANY inbound to the lines regardless of where the caller found the
number).

Concrete on-site entry surfaces (all verified this run):

- **`/contact` office block** — "Call or text" + `tel:` on the brand line
  (`app/contact/page.tsx:214-225`, `CONTACT.phoneFubTel`); `mailto:matt@ryan-realty.com`
  below it (`:226-237`); the visible promise "A broker replies within one business day.
  Calling or texting gets you an answer sooner." (`:244-247`).
- **`/team/[slug]` "Direct line" section** — per-broker `tel:` + `sms:` + `mailto:` built
  from the broker's PUBLIC line (`app/team/[slug]/page.tsx:263-267,460-493`); the phone also
  rendered as a tappable fact row (`:288-294`).
- **Listing detail** — the sticky sidebar card's Call/Text buttons
  (`components/site/listing-detail/TextMattCTA.tsx:103,131-137`) and the mobile sticky bar's
  call/text icons (`components/site/listing-detail/ListingMobileContactBar.client.tsx:37-67`),
  both on the resolved contact broker's line (resolution:
  `app/listing/[listingKey]/page.tsx:274-283` — Ryan Realty listing agent when known, else
  principal).
- **Footers + section CTAs sitewide** — `components/site/kb/KbFooter.client.tsx:94`,
  `app/sell/page.tsx:211,298`, `app/join/page.tsx:418`,
  `app/communities/[slug]/page.tsx:805`, and every `/lp/*` page (e.g.
  `app/lp/seller-home-value/page.tsx:41,213` — `BROKER_PHONE_TEL = CONTACT.phoneFubTel`).

Number model (`lib/brand/contact.ts:75-91,100-147` + `lib/crm/twilio.ts:100-141`): the
ported brand line **541.703.3095** is Matt's broker line; Paul **541.502.3436**; Rebecca
**541.250.3380**; the legacy/spare **541.224.5025** (`MARKETING_NUMBER`,
`lib/crm/twilio.ts:109`) stays webhooked with no single owner. Live values come from
`public.brokers.twilio_number` (`lib/data/brokers/getBrokers.ts:201-206,301-312` — the
public display phone IS the Twilio line), env vars are the resilience fallback.

Preconditions: the broker row has a non-null `twilio_number` + `forward_to_cell`
(`lib/data/crm/getBrokerTelephony.ts:30-59`); Twilio webhooks point at the canonical origin
(`TWILIO_PUBLIC_ORIGIN = 'https://ryan-realty.com'`, `lib/crm/twilio.ts:44`); `tel:`/`sms:`
schemes need a telephony-capable device — this process is mobile-native by construction.

## 3. Actors

- **Visitor segments:** every segment — buyer on a listing, seller sizing up the shop,
  owner with a question, out-of-market caller who found the GBP listing. Audience is
  genuinely unknown at first contact, so the create deliberately stamps NO audience tag
  (`lib/data/crm/findOrCreatePersonByPhone.ts:80-92`). Device reality: `tel:`/`sms:` taps
  only exist on phones; the GA4 device split for tap-through was NOT pulled this session and
  no client event fires on tap at all (named gap, §11).
- **Automated actors:** the four Twilio webhooks (`voice`, `voice-complete`, `recording`,
  `inbound-sms` under `app/api/twilio/`); Twilio Lookup caller-ID enrichment deferred via
  `after()` (`app/api/twilio/voice/route.ts:153-172`); ElevenLabs scribe transcription
  (`app/api/twilio/recording/route.ts:21-40`); the reply-intent classifier
  (`app/api/twilio/inbound-sms/route.ts:250-265`); the `crm-alert-drain` cron
  (`vercel.json`, `* * * * *`) delivering queued broker alert texts/push; the delivery-receipt
  webhook (`app/api/twilio/status/route.ts:1-19`) for the outbound forwards.
- **Accountable for completion:** the broker who OWNS THE DIALED LINE — routing, the new-lead
  alert, the forwarded call/text, and the follow-up task all land on them
  (`app/api/twilio/voice/route.ts:88-111`; `app/api/twilio/inbound-sms/route.ts:155-160,222`).
  The shared/legacy line and any unresolved case fall to the default desk, Matt
  (`DEFAULT_DESK_BROKER`, `lib/crm/twilio.ts:112`).

## 4. Systems of record

| Artifact | SoR |
|---|---|
| The interaction (call, voicemail, inbound text, transcript) | `crm_timeline` — kinds `call` / `voicemail` / `sms_in`, idempotent on `dedupe_key` (`app/api/twilio/voice/route.ts:116-130`; `voice-complete/route.ts:44-56`; `inbound-sms/route.ts:162-174`; transcript attached in place, `recording/route.ts:96-105`) |
| The person (identity, assignment, source) | `crm_people` + `crm_contact_points` via the ONE shared find-or-create keyed on normalized last-10 (`lib/data/crm/findOrCreatePersonByPhone.ts:61-118`; lookup `lib/crm/twilio.ts:160-179`) |
| Telephony truth (which line is whose, forwards to which cell) | `public.brokers` (`twilio_number`, `forward_to_cell`, `notify_sms`) read through `getBrokerTelephony` (`lib/data/crm/getBrokerTelephony.ts:30-59`); env vars fallback only (`lib/crm/twilio.ts:114-158`) |
| Consent / opt-out | `crm_suppressions` + authoritative person tags through the single chokepoint (`lib/crm/suppressions.ts:18-57` — fail-CLOSED on read error); STOP writes land here (`inbound-sms/route.ts:199-206`) |
| Broker notification | `crm_broker_alerts` queue (`lib/crm/broker-alerts.ts:141-193`), drained serverless every minute (`app/api/cron/crm-alert-drain/route.ts:25`) |
| Follow-up obligation | `crm_tasks` upsert per inbound message (`inbound-sms/route.ts:304-315`) |
| Office hours + recording master switch | `crm_company_settings` (`app/api/twilio/voice/route.ts:183-199`; policy `lib/crm/office-hours.ts:1-14`) |

Explicitly NOT a SoR: Twilio's own console logs (carrier truth for delivery state, but the
process record is the timeline; on-demand reconcile exists —
`lib/crm/twilio.ts:399-418`); the `crm_conversations` shadow-write (RC1 — "the timeline is
still the source of truth until the inbox read path flips",
`inbound-sms/route.ts:179-187`); the broker's phone-native call log/Messages thread; GA4
(no tap event even exists — §11).

## 5. End-to-end path (inception → completion)

Shared entry:

1. **Tap or dial** · visitor · taps `tel:`/`sms:` on any §2 surface, or dials the number
   from GBP/signage · a published Twilio line · carrier connects to Twilio · no app code
   runs on tap (plain anchors, zero JS) · a desktop visitor without telephony hits a dead
   scheme (§10) · mobile.
2. **Webhook + signature gate** · Twilio → app · POST to the voice or SMS webhook; form
   body parsed and X-Twilio-Signature HMAC-verified in one shared helper; forged or
   malformed posts get 403 · request · verified params ·
   `lib/crm/twilio.ts:52-92` (enforced in ALL environments when a token exists) · a
   signature mismatch terminates the process invisibly to the caller (Twilio-side error) ·
   server.

**Voice leg** (`app/api/twilio/voice/route.ts`):

3. **Spam/block gate** · webhook · manually-blocked numbers are `<Reject>`ed before ringing
   anyone; SHAKEN/STIR low-attestation flagged, optionally auto-rejected
   (`CRM_AUTO_BLOCK_SPAM_CALLS`) · `params.From` + `StirVerstat` · reject TwiML or continue
   · `:71-86` · block lookup fails OPEN — a DB error never drops a live caller (`:78-85`) ·
   server.
4. **Resolve the dialed line's broker** · webhook · reverse-map `params.To` last-10 →
   owning broker; the shared/legacy line returns null · dialed number · broker slug or null
   · `lib/crm/twilio.ts:129-141` (DB truth, env fallback) · unrecognized number behaves
   like the shared line · server.
5. **Find-or-create the caller** · webhook · phone-keyed lookup in `crm_contact_points`; on
   miss, create `crm_people` ("Call lead <ten>", source `inbound-call`) assigned to the
   dialed broker (else default desk) + the phone contact point ·
   `lib/data/crm/findOrCreatePersonByPhone.ts:61-118` · person row + `created` flag ·
   wrapped so a DB failure STILL RINGS the broker (`voice/route.ts:93-106`) · server.
6. **Log + alert** · webhook · upsert timeline `call` row (dedupe
   `twilio:call:<CallSid>:p<personId>` — retry-safe); on a real create, queue the new-lead
   broker alert ("Calling now from …") · `:116-148` · crash-safe: a logging failure never
   blocks the TwiML · alert delivery is gated by the broker's `notify_sms` opt-in, falling
   to web-push-only (`lib/crm/broker-alerts.ts:160-186`) · server.
7. **Enrich after answer** · `after()` · Twilio Lookup CNAM + line type replaces the
   placeholder name post-response, never delaying the dial ·
   `voice/route.ts:153-172` · server.
8. **Route the call** · webhook · office-hours check (outside configured blocks →
   voicemail, `:183-191`; empty blocks = always open); no forward cell resolved →
   voicemail, never a dropped call (`:174-178`); else `<Say>` the recording announcement
   (two-party-consent posture, header comment `:15-18`) and `<Dial timeout="25">` the
   broker's cell dual-channel-recorded, caller's number as caller ID so the broker can call
   back directly · `:197-208` · recording switchable off by env AND admin master switch
   (`:197-199`) · **← happy-path completion: visitor and broker are talking** · server.
9. **No-answer → voicemail** · `/api/twilio/voice-complete` · `DialCallStatus !==
   'completed'` → announcement + `<Record maxLength="180">`; find-or-create again (an
   unknown caller who only leaves a voicemail still becomes a lead) + `voicemail` timeline
   row (dedupe `twilio:vm:<CallSid>:…`) · `app/api/twilio/voice-complete/route.ts:21-68` ·
   server.
10. **Transcribe + notify** · `/api/twilio/recording` · fetch the audio, ElevenLabs scribe
    transcript onto the matching timeline row (voicemail row preferred), email the owning
    broker transcript + listen/contact links; idempotent on `recordingSid`; a
    row-not-ready race returns 503 so Twilio redelivers instead of dropping the voicemail ·
    `app/api/twilio/recording/route.ts:42-125` · server.

**SMS leg** (`app/api/twilio/inbound-sms/route.ts`):

11. **Block + loop guards** · webhook · blocked numbers dropped silently (`:116-117`); a
    text FROM a broker's own forward cell is never a lead — it is either the broker SMS
    agent branch (marketing line + flags on, `:128-143`) or a silent drop (`:144`) ·
    server.
12. **Resolve + find-or-create** · webhook · same dialed-line broker resolution and the
    SAME shared find-or-create (source `inbound-sms`, "Text lead <ten>") so voice and SMS
    create shapes never drift · `:155-160` · server.
13. **Record** · webhook · `sms_in` timeline upsert (dedupe `twilio:<MessageSid>:p<id>`),
    MMS media captured (capped 10, `:41-50`), conversation shadow-write (non-fatal), inbox
    conversation flipped to unread · `:162-191` · server.
14. **Keyword compliance** · webhook · leading token HELP → carrier help reply (`:194-196`);
    STOP/UNSUBSCRIBE/… → `addSuppression(sms, stop-keyword)` + system timeline row +
    confirmation (`:199-206`); START → remove ONLY the user's own stop-keyword suppression,
    never a compliance hard-stop (`:211-217`) · these branches return before any alert or
    forward · server.
15. **Alert + task** · webhook · on create, new-lead alert to the dialed broker with
    seller-intent detection routing "what's my home worth" straight at the CMA kick-off
    (`:226-242`, `lib/crm/seller-intent.ts`); reply-intent classification for prospecting
    contacts (fail-open, additive, `:250-293`); per-message deduped `crm_tasks` row due in
    15 minutes (`:304-315`); alert email with pre-filled suggested-reply composer link
    (`:316-348`) · server.
16. **Real-time forward** · webhook · the text is forwarded to the assigned broker's cell
    FROM that broker's own A2P-verified business line, deep-linking the CRM thread for
    reply; AWAITED (a `void` send gets killed at response-freeze — verified incident
    2026-07-15 in the comment) and outbound is A2P fail-closed
    (`lib/crm/twilio.ts:229-235,310-326`) · `:350-378` · **← completion: broker's phone has
    the text, CRM has the record** · server.

## 6. Decision points

- **Signature verification** (`lib/crm/twilio.ts:52-79`): unverifiable POST → 403; the
  process only runs on authentic Twilio traffic.
- **Blocked/spam caller** — voice: fail-OPEN lookup, `<Reject>` on match, optional
  STIR-based auto-reject behind `CRM_AUTO_BLOCK_SPAM_CALLS` (`voice/route.ts:71-86`); SMS:
  silent drop, empty 200 so Twilio never retries (`inbound-sms/route.ts:116-117`). The
  asymmetry is deliberate (a wrongly-dropped call is expensive; a wrongly-dropped text is
  retried by the human).
- **Which broker** — dialed line owns it; shared/legacy line → caller's existing assignment
  (voice) → default desk (`voice/route.ts:111`; `inbound-sms/route.ts:222`).
- **Office hours** (`voice/route.ts:189-191`): outside configured blocks → voicemail
  instead of ringing; empty config = always open.
- **Recording on/off** (`voice/route.ts:197-203`): env kill-switch AND admin master switch;
  when on, the consent announcement always precedes the connect (compliance posture for
  two-party-consent states, header `:15-18`).
- **Broker's own cell as sender** (`inbound-sms/route.ts:86-99,128-144`): never a lead,
  never re-forwarded — the reply-loop guard that keeps the forwarding model from eating
  itself; doubles as the broker-SMS-agent branch point.
- **STOP/START/HELP** → the suppression chokepoint (`lib/crm/suppressions.ts:18-57`), the
  same fail-closed table every outbound send path checks; a STOP here immediately gates
  every CRM send channel mapped to sms.
- **A2P gate on the outbound forwards** (`lib/crm/twilio.ts:229-235`): fail-closed — an
  unverified campaign blocks the broker-cell forward rather than risking carrier 30034.
- **§0/voice-canon note:** the pages carry no market stats in these sections; the one
  claim, "A broker replies within one business day" (`app/contact/page.tsx:244-247`), is a
  Matt-approved promise, not a data figure.

## 7. Completion

Done-when (observable): the visitor is **talking to the owning broker** (answered `<Dial>`
to the forward cell) or has **left a captured voicemail**, or their **text sits on the
broker's phone** — and in every one of those cases `crm_timeline` holds the interaction
(`call` / `voicemail` / `sms_in`) attached to a `crm_people` row resolvable by the caller's
last-10, assigned to the dialed line's broker.

Artifacts at completion: person + phone contact point; timeline entry (with recording SID +
transcript once `/api/twilio/recording` lands); queued/delivered broker alert (create
only); `crm_tasks` reply task (SMS); alert email; unread inbox conversation.

Terminal states:

- **(a) Answered call** — live conversation, dual-channel recording + transcript emailed to
  the broker afterward (`recording/route.ts:111-122`).
- **(b) Voicemail** — recorded, transcribed, broker emailed; caller promised a call-back
  ("we will call you right back", `voice/route.ts:56`).
- **(c) Text delivered** — CRM record + broker's cell forward + 15-min reply task.
- **(d) Opt-out** — STOP: sms suppression live instantly, confirmation sent; the process for
  this person ends and every automated sms path is gated.
- **(e) Rejected** — blocked/spam callers never reach a broker; nothing is written.
- **(f) Abandoned tap** — visitor cancels the dial sheet; nothing observable anywhere
  (the untracked top of the funnel — §11).

## 8. Time & performance

- **Time-to-answer budget:** the visitor's question ("get me a person") is answered in
  seconds of real time — one tap → announcement → ringing cell with `timeout="25"`
  (`voice/route.ts:207`), then voicemail. Nothing in the pipeline may delay the dial: the
  person-create is wrapped non-blocking (`:93-106`), caller-ID enrichment is deferred to
  `after()` (`:153-172`), and the block lookup fails open (`:78-85`).
- **Webhook budgets:** voice/voice-complete `maxDuration 60`; recording 300 (STT);
  inbound-sms 300 solely for the agent branch — the webhook itself "acks in well under a
  second on every branch" (`inbound-sms/route.ts:29-33`).
- **Durability over latency on the SMS tail:** the alert email and the cell forward are
  AWAITED, not fire-and-forget — Vercel freezes the invocation at response time and a
  `void` send silently dies (documented incidents 2026-07-13/15 in
  `inbound-sms/route.ts:317-319,358-364`).
- **Page side:** entry links are static anchors — zero JS, zero layout cost; no CWV story
  specific to this process. What "slow" means here: a broker's cell ringing 25 s
  unanswered; the visitor still terminates in a captured voicemail, never a dead line
  (`voice/route.ts:174-178` — even a config failure routes to voicemail).

## 9. Variants

- **Per-broker line vs brand line vs legacy spare:** one code path; only the resolved
  broker differs (`lib/crm/twilio.ts:129-141`). No split.
- **Call vs text:** two webhook legs, one identity substrate and one completion contract
  (timeline + owning broker) — this PDS covers both; the create shapes are deliberately
  mirrored (`findOrCreatePersonByPhone.ts:10-15`).
- **MMS:** same SMS leg with media captured to the timeline (`inbound-sms/route.ts:41-50`).
- **Off-site inception (GBP, signage, print):** identical from step 2 onward — the plane
  captures the number, not the referrer. Attribution to a page is impossible for these.
- **Email (`mailto:`) sub-channel:** rides the same page sections
  (`app/contact/page.tsx:226-237`; `app/team/[slug]/page.tsx:267`) but has NO on-platform
  capture at tap; completion is observable only in the email-ingest plane (`crm-gmail-sync`
  cron, `vercel.json` `9,24,39,54 * * * *`). P3 call: either fold it here as a documented
  degraded variant or move it to the contact process.
- **NOT this process:** broker-initiated click-to-call from the CRM
  (`app/api/twilio/outbound-bridge/route.ts`, `lib/crm/twilio.ts:344-376`) and broker
  texting via composer — outbound machine processes; the Conversations events route
  (`app/api/twilio/conversations-events/route.ts`) is the roadmap two-way build; the broker
  SMS agent branch (`inbound-sms/route.ts:128-143`) is an internal tool on the same wire.

## 10. Current implementation map

- **Routes (webhook plane):** `app/api/twilio/voice/route.ts`, `voice-complete/route.ts`,
  `recording/route.ts`, `inbound-sms/route.ts`, `status/route.ts` (delivery receipts for
  the outbound forwards), cron `app/api/cron/crm-alert-drain/route.ts` (`* * * * *`).
- **Entry surfaces (render plane):** §2 list. Registers: kb (`/contact`, `/team/[slug]`,
  KbFooter), primitives (`TextMattCTA` builds from `components/site/primitives`), legacy
  flat (`SiteFooter`), plus raw LP pages — the links are register-agnostic facts.
- **Libraries:** `lib/crm/twilio.ts` (signature, number model, sends, A2P),
  `lib/data/crm/getBrokerTelephony.ts`, `lib/data/crm/findOrCreatePersonByPhone.ts`,
  `lib/crm/suppressions.ts`, `lib/crm/broker-alerts.ts`, `lib/crm/office-hours.ts`,
  `lib/brand/contact.ts` (G38-locked canonical literals).
- **Tests on main:** `lib/data/crm/findOrCreatePersonByPhone.test.ts`,
  `lib/crm/office-hours.test.ts`, `lib/crm/seller-intent.test.ts`.
- **Known defects / observations (evidence, this run):**
  1. **Hardcoded phone literals (G38-class drift):** `app/lp/sell-your-home/page.tsx:30`
     (`const BROKER_PHONE_TEL = '+15417033095'`) and
     `app/lp/seller-home-value/SellerLPForm.tsx:241,262` (`href="tel:+15417033095"`) bypass
     `lib/brand/contact.ts`. Same digits today, so behavior is identical — but these are
     exactly the stale-copy risk the module exists to kill (`lib/brand/contact.ts:1-10`).
  2. **"Call or text" renders call-only:** the `/contact` office block promises text but
     ships only a `tel:` href (`app/contact/page.tsx:214-225`) — a text-intent visitor
     lands in the dialer. `/team/[slug]` and listing detail do ship `sms:`.
  3. **Top of funnel is invisible:** no analytics event fires on any `tel:`/`sms:` tap
     (plain anchors everywhere — e.g. `ListingMobileContactBar.client.tsx:58-67`). Taps,
     cancels, and desktop dead-clicks are unmeasured; only the Twilio side is observable.
  4. **Listing contact broker ignores attribution:** the listing card resolves listing
     agent → principal (`app/listing/[listingKey]/page.tsx:274-283`); the
     `rr_agent_attribution` cookie plays no part, so a Rebecca-attributed visitor may be
     calling Matt's line. Same class of gap the registry flagged on `/contact`'s form.
     Cross-process product question for P3/P5, not a webhook bug.
  5. **Broker alert delivery is opt-in-gated:** `notify_sms=false` downgrades the new-lead
     alert to web-push-only or nothing (`lib/crm/broker-alerts.ts:160-186`) — the call still
     forwards (that path is unconditional), but the "hottest signal" text alert depends on
     per-broker settings. Config fact to keep visible, not a defect.
  6. **Naming residue:** `CONTACT.phoneDirect*` and `CONTACT.phoneFub*` are the same number
     under two FUB-era names (`lib/brand/contact.ts:75-91`), and pages pick one arbitrarily.
     Consolidation candidate; naming itself is P5's domain.
- **Duplicate/parallel paths that should die:** none in the webhook plane — one voice
  chain, one SMS chain, one shared find-or-create. The scattered per-LP `BROKER_PHONE_TEL`
  constants plus defect 1 are the render-plane consolidation list.

## 11. Target shape (process-level, not pixels)

**Should this exist? Yes — unconditionally.** It is the highest-intent conversion channel
the site has and the north star's purest case: the visitor objective ("talk to a human
now") and the machine objective (contact made) are the same event. The webhook plane is
back-office machinery, not page shape — design amnesia does not touch it; it should survive
any rebuild verbatim.

**Ideal shape:** unchanged step count for the visitor (one tap → talking). The rebuild's
work is render-plane only: every page that shows a broker or a "reach us" moment carries
the SAME one-tap call/text affordance for the RIGHT broker (attribution-aware where a
broker context exists — resolve defect 4 as a product decision), `sms:` offered wherever
"text" is promised (defect 2), all numbers from the canonical module (defect 1), and a tap
event so the funnel's top exists in analytics (defect 3).

**Destination implication:** NOT a destination. This is a **stamped affordance across the
exploration graph** — per the continuity directive it belongs to the persistent chrome and
to broker/listing/contact nodes, never to a page of its own. The numbers themselves are the
phone-channel equivalent of SEO equity: published on GBP and signage, they are DATA a
redesign must not churn.

**Dual objective this process stamps on its pages** (it stamps sections, not whole routes —
these compose with the host page's objectives):

- `visitor_objective`: "Reach the broker for this listing/page by phone or text in one tap,
  right now."
- `machine_objective`: "Contact made and kept: the caller/texter exists in the CRM, the
  interaction is on their timeline, and the owning broker is alerted to respond — with a
  voicemail-and-callback floor when nobody answers."
- `exits`: the conversation itself (off-graph, the point); on no-answer → voicemail →
  broker call-back; page-side alternates for non-callers: `/contact?intent=…` (the form
  process), `/team/[slug]` (choose a broker), `#get-value` (the valuation spine).

**Data gaps blocking correctness:** none in the capture chain — dialed line → broker →
person → timeline → alert is complete and tested at the unit level. Named measurement gaps:
no tap-through event (defect 3), GA4 device split not pulled this session, and no
call-answer-rate / voicemail-rate number exists anywhere yet (the timeline payloads carry
`dialStatus` — queryable, never queried; §0 forbids stating one here).

## 12. Acceptance checks

Persist; never delete. Run against production (`ryan-realty.com`) unless noted. Live-call
checks use a broker's own phone; clean up test leads afterward.

1. **Forged webhooks rejected (both legs):**
   `curl -s -o /dev/null -w '%{http_code}' -X POST https://ryan-realty.com/api/twilio/voice --data 'From=%2B15005550006&To=%2B15417033095'`
   → `403`; same POST to `/api/twilio/inbound-sms` → `403`.
2. **Telephony truth is complete:**
   `SELECT email, twilio_number, forward_to_cell, notify_sms FROM brokers WHERE is_active`
   → every active broker has non-null `twilio_number` AND `forward_to_cell` (a null forward
   = that line voicemails every call, `voice/route.ts:175-178`).
3. **Rendered numbers reconcile with the table (§0):** for each broker,
   `curl -sL https://ryan-realty.com/team/<slug> | grep -o 'tel:[0-9]*' | head -1` — digits
   equal the last-10 of that broker's `twilio_number` from check 2 (render mapping
   `lib/data/brokers/getBrokers.ts:201-206`).
4. **Brand-line link on /contact:**
   `curl -sL https://ryan-realty.com/contact | grep -c 'tel:+15417033095'` ≥ 1.
5. **Voice E2E (live, from a phone NOT in the CRM):** dial a broker line → hear "This call
   may be recorded…" → that broker's cell rings with the caller's number as caller ID.
   Then: `SELECT id, kind, broker, payload->>'forwardedTo' AS fwd, dedupe_key FROM
   crm_timeline WHERE kind='call' ORDER BY created_at DESC LIMIT 1` → `dedupe_key` LIKE
   `twilio:call:CA%`, `broker` = the dialed line's owner, `fwd` non-null; and the caller's
   last-10 exists in `crm_contact_points` joined to a `crm_people` row with
   `source='inbound-call'` assigned to that broker.
6. **Voicemail + transcript E2E:** repeat check 5 but let it ring out (>25 s) → voicemail
   prompt plays; leave a message. Verify `kind='voicemail'` row (`twilio:vm:` dedupe),
   then within minutes `payload->>'recordingSid'` non-null with the transcript in `body`,
   and the owning broker's mailbox received "Voicemail transcript (…s)"
   (`recording/route.ts:111-122`).
7. **SMS E2E (unknown sender):** text a broker line → `SELECT` newest `crm_timeline` row
   `kind='sms_in'` with dedupe `twilio:SM%`; `crm_people` row `source='inbound-sms'`
   assigned to the line's owner; `crm_tasks` row with dedupe `twilio-task:SM%` due ~15 min;
   the broker's CELL received the forward FROM the broker's business line
   (`inbound-sms/route.ts:365-378`).
8. **STOP/START round-trip:** from the check-7 phone reply `STOP` → confirmation text
   arrives; `SELECT * FROM crm_suppressions WHERE person_id=:pid AND channel='sms' AND
   reason='stop-keyword'` → 1 row. Reply `START` → row gone, resubscribe confirmation
   arrives. (`inbound-sms/route.ts:199-217`.)
9. **Known-contact no re-alert:** text the same line again from the check-7 phone → a new
   `sms_in` row exists but NO new `crm_broker_alerts` row for `kind='new-lead'` (create-only
   alerting, `inbound-sms/route.ts:226-242`).
10. **Broker-cell loop guard:** a text from a broker's own `forward_to_cell` to their
    business line creates NO person and NO timeline row (`inbound-sms/route.ts:128-144`).
11. **Units:** `npx vitest run lib/data/crm/findOrCreatePersonByPhone.test.ts
    lib/crm/office-hours.test.ts lib/crm/seller-intent.test.ts` — green.
12. **Alert drain freshness:** after check 7 (with a `notify_sms=true` broker),
    `SELECT status FROM crm_broker_alerts ORDER BY created_at DESC LIMIT 1` reaches `sent`
    within ~2 minutes (cron `* * * * *`, `vercel.json`).
