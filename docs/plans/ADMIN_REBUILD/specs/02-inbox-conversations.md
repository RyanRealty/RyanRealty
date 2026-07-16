# Spec 02 — Inbox, Conversations & Messaging

> End-to-end feature specification for the owner's **#1 pain surface**: the inbox,
> the conversation model beneath it, the SMS/email/group composer, and delivery
> visibility. Derived from `00-REASONING-AND-ARCHITECTURE.md` (the locked
> architecture) and `audit-reports/crm-messaging.md` (the evidence base). Every
> architectural claim ties to a root cause (RC1–RC7) and a constraint (C1–C5).
> A senior engineer should be able to build this with no further questions.

**Area:** Inbox · conversations · messaging (SMS/MMS/email/group) · delivery state
**Kills:** RC1 (no conversation entity), most of RC2 (no optimistic/idempotent send), the messaging half of RC3 (forked mobile/desktop), the messaging slice of RC4 (four renderers, plural send paths).
**Serves:** C2 (the response half of the loop), C3 (phone-first), C5 (send integrity — messages carry money + TCPA).
**Depends on Spec 01 (Foundation):** the `requireAdmin(capability)` in-body guard (§4.4), the optimistic/idempotent mutation primitive (§4.2), the single responsive shell (§4.3), the cached-DAL + streaming render pattern (§4.6). This spec **consumes** those primitives; it does not re-define them.

---

## 0. The job this serves

A broker is standing in a driveway. A text comes in from a lead and his co-buyer
spouse. The broker needs to (a) see instantly that this is a **group** of two
people, not one, (b) reply to **both** without dropping the spouse, (c) know the
reply actually **went through**, and (d) do it in seconds on a phone, with one tap
per message and zero doubt about whether a second tap will double-charge a TCPA
message. Today none of that is true (`crm-messaging.md §0`). This spec makes all of
it true by construction.

The core loop (C2) has a **respond** edge. The inbox + composer **is** that edge.
Everything here optimizes: *notified → open the right conversation → reply to the
right people → see it land → send a deliverable* — in seconds, on the phone.

---

## 1. Keep / Rebuild / Delete (explicit, cited)

### 1.1 KEEP — the compliance-hardened server core (do not touch its internals)

The audit is unambiguous that the send/receive engine is correct and hard-won
(`crm-messaging.md §0`, §2.7, §8). Keeping it is a **legal-risk** decision, not a
convenience (C4, C5). The rebuild wraps these; it does not rewrite them.

| Kept asset | Evidence | Role in rebuild |
|---|---|---|
| Suppression chokepoint, fail-closed on every live send | `crm-messaging.md §2.7`, `lib/crm/suppressions.ts:20-24` | Called by the ONE `sendMessage` action before dispatch |
| Quiet-hours gate | `crm-messaging.md §2.7`, `app/actions/crm.ts:774-778` | Same |
| A2P fail-closed gate | `lib/crm/twilio.ts:222-229` | Same |
| `MessagingServiceSid`+`From` sent together (AT&T incident fix) | `lib/crm/twilio.ts:286-309` | Preserved verbatim; do not "clean up" |
| Signature-validated webhooks (incl. preview envs) | `lib/crm/twilio.ts:51-78` | Reused; extended to write `crm_message` (§7) |
| Forward-only delivery-state merge (`crm_advance_sms_delivery` RPC, race-safe, one SQL stmt) | `app/api/twilio/status/route.ts:47-58`, `supabase/migrations/20260715153000_twilio_hardening.sql:56-80` | Extended to advance `crm_message.delivery_state` by `provider_sid` |
| STOP/START/HELP + suppression on inbound | `app/api/twilio/inbound-sms/route.ts:128-152` | Unchanged |
| iMessage-incident channel-safety guards + `ci:crm-sms-safety` gate | `crm-messaging.md §2.7`, `package.json:125,166` | Unchanged; still gates every send path |
| Group MMS via Conversations API + MCS | `lib/crm/twilio-conversations.ts:93-231` | Reused by `sendMessage` group path; **conversation reuse fixed** (§6.5) |
| Gmail-DWD send from broker's own mailbox | `lib/crm/gmail.ts:313-429` | Reused; **threading headers added** (§5.4) |
| CMA/BPO send libs (`sendCmaToLead`, `sendBpoToLead`) | arch §3, `lib/cma/send.ts`, `lib/bpo/send.ts` | Called from the person workspace (Spec 03); this spec logs their sends into `crm_message` too |
| Sequence-engine cron (at-most-once claims, A2P-aware) | arch §3, `app/api/cron/crm-sequence-engine/route.ts` | Unchanged executor; its sends now write `crm_message` |
| Drafts store (`crm_message_drafts`, keyed person+broker+channel) | `lib/data/crm/drafts.ts` | Re-keyed to `conversation_id` (additive column, §3.6) |
| Composers `SmsComposer`/`EmailComposer`/`EmailBodyEditor` (bones are good; `ci:composer-discipline` keeps reuse) | `crm-messaging.md §5.4`, `package.json:284` | Kept as the ONE composer; gain optimistic/idempotent semantics (§5) |
| Unknown-caller "Add Person"/link flow | `crm-messaging.md §6.6`, `AddPersonForm.tsx` | Kept; extended to re-key a raw participant to a person (§6.6) |

### 1.2 REBUILD — the interaction model, the data model, the render architecture

| Rebuilt | Why (root cause) | Section |
|---|---|---|
| Introduce `crm_conversation` / `crm_conversation_participant` / `crm_message` | RC1 — there is no conversation entity; a "conversation" is `person_id` (`crm-messaging.md §1`) | §3 |
| One inbox listing conversation rows (not a 2,000-row timeline rescan) | RC1 + perf (`getInboxQueue.ts:430-449`, the rolling-window correctness bug `§6.1`) | §4 |
| Optimistic + idempotent `sendMessage` (one action, all channels) | RC2 — the §2 hang/double-send machine (`crm-messaging.md §2.1-2.4`) | §5 |
| ONE conversation renderer (collapse the four) | RC4 — four renderers, four capability sets (`crm-messaging.md §7`) | §4.4 |
| Group-aware rendering + reply-all by construction | RC1 — group vs 1:1 pixel-identical, silent participant drops (`crm-messaging.md §4`) | §6 |
| Delivery state in the inbox | The hole: badge on one surface only (`crm-messaging.md §3.2`) | §4.5 |
| Email reply threading (`In-Reply-To`/`References`/`threadId`) | Broken at RFC level (`crm-messaging.md §5.2`) | §5.4 |
| Inbound email marks conversation unread | Unwired "Phase B" hook (`crm-messaging.md §5.3`) | §7.4 |
| One responsive tree for inbox+thread+composer | RC3 — 27 mobile twins, divergent behavior (`crm-messaging.md §9`) | §8 |

### 1.3 DELETE — the accretion (cite before removing)

| Deleted | Evidence it is dead/duplicate/wrong |
|---|---|
| `markAllReadAction` — dead POST endpoint, zero callers | `crm-messaging.md §6.5`, `crm-inbox.ts:125-194` |
| The four parallel renderers `InboxThreadView` / `MobileThread` / `ConversationFeed` (as message renderer) / `PersonCenterColumn` bubble logic — collapsed to ONE `<Conversation>` | `crm-messaging.md §7` |
| The 2,000-row `buildInboxWorkingSet` window (a rolling window presented as an archive) | `crm-messaging.md §6.1`, `getInboxQueue.ts:430-449` |
| SID-key fragmentation (`twilioSid` vs `sid` vs `messageSid`) — one `provider_sid` column replaces all | `crm-messaging.md §1` table |
| `payload.groupTo` / `payload.group`/`groupMembers` conventions — replaced by participant rows | `crm-messaging.md §4`, §12 |
| `getGroupReplyParticipants` + its hardcoded `BROKER_LINES` set of 4 numbers + its `group:true`-only filter bug | `crm-messaging.md §4.4`, `getGroupReplyParticipants.ts:30,41-47` — obsolete once participants are rows |
| `sendDocSmsAction`'s own suppression/quiet-hours reimplementation + bare messaging-service send (`sid` key, no quiet-hours override) | `crm-messaging.md §7.1`, `send-doc.ts:240-305` — routed through `sendMessage` |
| Duplicate "Reopen"/"Mark read" bulk buttons (same `open` mutation, two labels) | `crm-messaging.md §6.5`, `InboxThreadList.tsx:263-274` |
| Assigned-folder empty-state "How It Works" → `/admin/crm` placeholder link | `crm-messaging.md §12`, `InboxThreadList.tsx:91-93` |
| `error=` in the URL as the failure channel (persists in shared links) | `crm-messaging.md §2.5` — replaced by optimistic failed-bubble + Retry |

The `handled` status, `needsReply`, and `lastKindLabel` are **not deleted** — they were
computed and thrown away (`crm-messaging.md §6.5`). This spec **wires them** (§4.2, §4.3).

---

## 2. Naming & where things live

- New tables: `crm_conversation`, `crm_conversation_participant`, `crm_message`
  (the `crm_` prefix matches the existing `crm_timeline`, `crm_conversation_state`,
  `crm_deal_*` convention — arch §4.1 uses the bare names `conversation`/`message`;
  we prefix for codebase consistency).
- New DAL: `lib/data/crm/conversations/` — `getInbox.ts`, `getConversation.ts`,
  `getConversationParticipants.ts`, `getInboxCounts.ts`, `resolveOrCreateConversation.ts`.
- One consolidated action file: `app/actions/crm-messaging.ts` exporting
  `sendMessage`, `setConversationState`, `assignConversation`, `saveDraft`,
  `discardDraft`, `markConversationRead`, `resolveRawParticipant`. (Replaces the
  scattered `crm-inbox.ts` / `crm-conversation.ts` / `crm-compose.ts` /
  `crm-send-now.ts` send surfaces — `crm-messaging.md §7.1`.)
- One UI surface: `app/admin/(protected)/inbox/` (renamed from `crm/inbox` per the
  new IA, arch §5) with `<InboxList>`, `<Conversation>`, `<Composer>` — one tree,
  mobile-first (§8).

---

## 3. Data model

### 3.1 The three new tables (source of truth for messaging)

`crm_timeline` **stays** as the immutable activity ledger for notes/calls/events and
as the back-compat read surface during transition (arch §4.1). Messages become
first-class rows in `crm_message`, which is the **source of truth** for the inbox,
delivery state, and group structure.

```sql
-- Migration: 2026XXXX_conversation_model.sql  (ADDITIVE, back-compatible)

create table public.crm_conversation (
  id                uuid primary key default gen_random_uuid(),
  subject           text,                          -- email subject / null for SMS-only
  channel_set       text[] not null default '{}',  -- e.g. '{sms}', '{sms,email}'
  primary_person_id bigint references crm_people(id), -- anchor contact; null for pure-raw threads
  is_group          boolean not null default false,  -- maintained by trigger = (external participant_count > 1)
  participant_count integer not null default 0,      -- external (non-broker) parties; maintained by trigger
  state             text not null default 'unread',  -- unread | open | handled | closed
  assigned_broker   text,                            -- broker slug
  last_message_at   timestamptz not null default now(),
  last_inbound_at   timestamptz,
  last_outbound_at  timestamptz,
  needs_reply       boolean not null default false,  -- true when last message is inbound & unanswered (wired, §4.3)
  twilio_conversation_sid text,                      -- reuse the group MMS Conversation (fixes §6.5)
  gmail_thread_id   text,                            -- reuse the email thread (fixes §5.4)
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index crm_conversation_inbox_idx on crm_conversation (last_message_at desc);
create index crm_conversation_person_idx on crm_conversation (primary_person_id);
create index crm_conversation_assigned_idx on crm_conversation (assigned_broker, state, last_message_at desc);
create unique index crm_conversation_twsid_idx on crm_conversation (twilio_conversation_sid) where twilio_conversation_sid is not null;

create table public.crm_conversation_participant (
  id               bigint generated always as identity primary key,
  conversation_id  uuid not null references crm_conversation(id) on delete cascade,
  person_id        bigint references crm_people(id),  -- resolved contact
  raw_phone        text,                              -- E.164 for an unresolved number
  raw_email        text,                              -- for an unresolved email
  role             text not null default 'contact',   -- contact | raw  (broker line is NOT a participant row)
  channel_address  text not null,                     -- the phone/email that identifies them in THIS thread
  display_name     text,                              -- snapshot name for raw participants
  created_at       timestamptz not null default now(),
  constraint participant_identity_ck
    check (person_id is not null or raw_phone is not null or raw_email is not null)
);
create index crm_participant_conv_idx on crm_conversation_participant (conversation_id);
create index crm_participant_person_idx on crm_conversation_participant (person_id);
create index crm_participant_addr_idx on crm_conversation_participant (channel_address);

create table public.crm_message (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid not null references crm_conversation(id) on delete cascade,
  direction        text not null,                     -- in | out
  channel          text not null,                     -- sms | mms | email | call | voicemail
  body             text,
  subject          text,                              -- email only
  provider_sid     text,                              -- Twilio SID or Gmail message id — THE receipt key
  delivery_state   text not null default 'queued',    -- queued|sent|delivered|read|failed|carrier_blocked|received
  error_code       text,                              -- Twilio/SMTP error code when failed
  error_message    text,
  media            jsonb not null default '[]',        -- [{path,contentType,name}] via existing MMS proxy
  sent_by          text,                              -- broker slug for outbound; null inbound
  in_reply_to_id   uuid references crm_message(id),   -- email reply chain
  idempotency_key  text,                              -- client-generated; dedupes double-taps
  timeline_id      bigint references crm_timeline(id),-- link back to the ledger row (dual-write)
  created_at       timestamptz not null default now()
);
create unique index crm_message_idem_idx on crm_message (idempotency_key) where idempotency_key is not null;
create unique index crm_message_provider_idx on crm_message (provider_sid) where provider_sid is not null;
create index crm_message_conv_time_idx on crm_message (conversation_id, created_at desc);
```

**Design decisions, stated:**

- **Group vs 1:1 is `participant_count > 1`** (external parties only; the broker/business
  line is implicit, carried on `message.sent_by`). A trigger maintains `participant_count`
  and `is_group` on participant insert/delete, so **they cannot drift** and cannot be
  confused — kills RC1's headline symptom by construction (arch §4.1).
- **One typed `provider_sid`** ends SID-key fragmentation → the status webhook matches on
  exactly one column and delivery receipts attach on **every** path (`crm-messaging.md §1`).
- **`idempotency_key` unique index** makes a duplicate send a database-level no-op
  (§5.3) — a second tap **cannot** deliver a second message (C5).
- **`timeline_id` dual-write:** the canonical send writes both a `crm_message` (source of
  truth) and a `crm_timeline` row (the ledger), linked. Existing readers (person page,
  reports, `getContactActivityFeed`) keep working unchanged during transition; the inbox
  reads `crm_message`. This is the additive, back-compatible path arch §4.1 mandates.

### 3.2 Conversation identity (how a message finds its conversation)

`resolveOrCreateConversation(input)` is the single resolver every writer (send action +
both webhooks + Gmail sync) calls. Rules, in order:

1. **Group MMS** (Twilio Conversations): key on `twilio_conversation_sid`. One conversation
   per SID. Participants = the member set.
2. **1:1 SMS/MMS:** key on `(primary_person_id, channel_address=contact_phone_e164)` when the
   phone resolves to a person via `crm_contact_points`; otherwise a `raw`-participant
   conversation keyed on the E.164 number. When a person owns multiple phones, each distinct
   contact phone is its own 1:1 conversation (a person can have separate SMS threads to
   cell vs office — matches carrier reality).
3. **Email:** key on `gmail_thread_id` when present; else on `(primary_person_id,
   channel_address=contact_email)`. Inbound sets `gmail_thread_id` from the Gmail `threadId`
   so subsequent messages coalesce.
4. **Multi-channel coalescing:** SMS and email to the **same** `primary_person_id` render in
   ONE conversation view (channel-unified, arch §5) but are **distinct rows** ordered by time.
   `channel_set` accumulates `{sms,email}`. (Rationale: a broker thinks "my conversation with
   Jane," not "my SMS thread and my email thread with Jane.") A group MMS conversation is
   **never** coalesced with a 1:1 (different participant set).

### 3.3 The additive migration + backfill from `crm_timeline`

Backfill is a one-time job (`scripts/backfill-conversations.mjs`, run as a guarded
migration step) that reads `crm_timeline` message kinds and promotes them. Non-message
kinds (`note`, `call`, `voicemail`, `event`, ...) are **untouched** and stay in
`crm_timeline` only.

Backfill algorithm (deterministic, idempotent — safe to re-run):

```
for each crm_timeline row where kind in (sms_in,sms_out,mms_in,mms_out,email_in,email_out),
    ordered by ts asc:
  key = resolveConversationKey(row):
     - group  → payload.conversationSid / getConversationChatServiceSid
     - sms1:1 → (person_id, other-party phone from payload/contact_points)
     - email  → payload.gmail_thread_id if present else (person_id, other-party email)
  conv = upsert crm_conversation by key
  upsert participants:
     - group  → payload.groupMembers ∪ payload.groupTo, resolved to person_id where possible
     - 1:1    → the single contact (person or raw)
  insert crm_message:
     provider_sid = coalesce(payload.twilioSid, payload.sid, payload.messageSid)   -- unify the 3 keys
     delivery_state = payload.deliveryState || derive(kind)     -- inbound→received, else sent
     media = payload.media || []
     timeline_id = row.id
     idempotency_key = null (historical rows never double-send)
  recompute conv.last_message_at / clocks / participant_count / is_group / needs_reply
```

Provenance: `crm_timeline.dedupe_key` guards against double-promotion on re-run;
`crm_message.timeline_id` is the join back. The backfill runs **before** the inbox
cuts over to reading `crm_message`, so there is no window where the inbox is empty.

**Migration safety (C4/RC6 — prove the round trip before cutover):** the backfill emits a
reconciliation report — `count(promoted messages) == count(timeline message rows)`,
`count(distinct conversations)`, `count(group conversations)`, and a sample of 20
group threads showing participant reconstruction. The cutover PR does not merge until the
report shows zero dropped rows. (This is §8's "done = proven round trip" applied to the
migration itself.)

### 3.4 Triggers (keep the invariants true by construction)

- **`participant_count` + `is_group`** maintained on `crm_conversation_participant`
  insert/delete (external roles only).
- **Conversation clocks + `needs_reply`** maintained on `crm_message` insert:
  `last_message_at = created_at`; inbound sets `last_inbound_at` and `needs_reply=true`;
  outbound sets `last_outbound_at` and `needs_reply=false`; `channel_set` unions the channel.
  (This is why `needs_reply` — "waiting on you," the single most useful triage signal that
  the old system computed and threw away, `crm-messaging.md §6.5` — is now a persisted,
  indexed, renderable column.)
- **State transition on inbound:** an inbound message sets `state='unread'` unless already
  `open` by the assigned broker in the last N minutes (mirrors the current
  `markConversationUnreadOnInbound` intent, `crm-messaging.md §5.3`, but now fires for
  **email too**, fixing §7.4).

### 3.5 Source-of-truth ownership (one definition per fact — arch §4.5 discipline)

| Fact | Single source | Never re-derived from |
|---|---|---|
| Is this a group? | `crm_conversation.is_group` | counting payload keys |
| Delivery state of a message | `crm_message.delivery_state` | scanning `crm_timeline.payload` |
| Who is in the thread | `crm_conversation_participant` rows | `payload.groupMembers`/`groupTo` |
| Unread / needs-reply | `crm_conversation.state` / `.needs_reply` | folder-time array filters |
| Reply-all target set | the participant rows | hardcoded `BROKER_LINES` |

### 3.6 `crm_message_drafts` — one additive column

Add `conversation_id uuid references crm_conversation(id)`. Drafts remain keyed by
person+broker+channel for back-compat but gain a `conversation_id` so a draft attaches to
the exact thread (including a message-less new-group draft, which today folds into the queue
via `getInboxQueue.ts:451-459` — that behavior is preserved).

---

## 4. Feature — The Inbox (the one list)

### 4.1 Purpose & job

One surface, one query, showing **conversation rows** ordered by recency, so the broker
sees "who's waiting on me" in one glance and opens the right thread in one tap (C2 triage
edge). Replaces the 2,000-row timeline rescan that ran on every folder switch / open /
refresh (`crm-messaging.md §6.1-6.2`).

### 4.2 The row

Each `<InboxRow>` renders from `getInbox()` (§4.7):

- **Identity:** conversation title. 1:1 → the person's name (or the raw number + "Add
  Person" affordance if unresolved). Group → **participant chips** ("Jane + Tom") and a
  `Group · N people` label (§6.2) — group vs 1:1 is unmistakable at the list level, not
  just inside the thread.
- **Snippet:** last message body (or `[Photo]` / `[N attachments]` for MMS, resolved through
  the existing `/api/admin/crm/mms/...` proxy — fixes the `[1 attachment]` literal-text bug,
  `crm-messaging.md §7`).
- **Channel glyph:** sms / email / group icon from `channel_set`.
- **Time:** relative `last_message_at`.
- **Triage state:** unread (bold + dot), **`needs_reply` → a "Waiting on you" pill** (now
  wired, §3.4), assigned-broker avatar.
- **Delivery of last outbound** (§4.5): a small state chip so the broker sees "delivered /
  failed" **without opening the thread** — the exact gap in `crm-messaging.md §3.2`.

### 4.3 Folders & counts

Folders: `All`, `Unread`, `Waiting on you` (`needs_reply=true`), `Assigned to me`,
`Sent`, `Closed`, `Drafts`. Scope: `mine` / `all` (superuser + broker; broker scope
clamped inside the query per kept RBAC posture, `buildCrmPeopleQuery` doctrine arch §3).

- `handled` status is now reachable: the thread header offers `Waiting → Handled → Closed`
  (wires the dead `handled` state, `crm-messaging.md §6.5`).
- Counts come from `getInboxCounts()` — a **cached** aggregate (`unstable_cache`, tag
  `inbox:counts:{brokerSlug}`), invalidated by the tag on any state mutation. **Not** 11
  full-array filter passes per render (`crm-messaging.md §6.2`, `getInboxQueue.ts:381-393`).
  Badge counts load lazily and never block first paint (arch §4.6).

### 4.4 The ONE conversation renderer (collapse the four)

`<Conversation>` is the single component that renders a thread on every surface (inbox pane,
person workspace Comms section). It supersedes `InboxThreadView`, `MobileThread`,
`ConversationFeed`, and the `PersonCenterColumn` bubble logic (`crm-messaging.md §7`). It
renders, on **every** surface (this is the point — capabilities live on the shared model,
not where they were first requested, killing RC4/`§7` point 4):

- Chat bubbles, oldest→newest, cursor-paginated ("Load older" — fixes the hard 100-cap,
  `crm-messaging.md §7`).
- **MMS/media inline** via the proxy (fixes "photo renders as `[1 attachment]`").
- **Delivery badge per outbound bubble** (§4.5).
- **Email engagement** (opens/clicks) on email bubbles (fixes the inbox gap,
  `crm-messaging.md §5.5`).
- **Group context**: participant header + per-bubble sender name when group (§6.2).
- **Channel interleaving**: SMS and email in one time-ordered stream (fixes mobile's
  single-channel-only view, `crm-messaging.md §9`).
- **FUB-imported redacted bodies** shown as `contentHidden` placeholders (kept behavior,
  `crm-messaging.md §8`).

### 4.5 Delivery state IN the inbox

Every outbound bubble and every inbox row's last-outbound chip renders
`crm_message.delivery_state`: `Queued → Sent → Delivered → Read` (green ladder) or
`Failed` / `Carrier blocked` (red, with the Twilio `error_code` on tap and a **Retry**
affordance that re-sends with a fresh idempotency key). This is now possible on **all**
surfaces because delivery state is a first-class column, not a payload scan on one page.

**Streaming the state to the open conversation only** (arch §4.2): when a conversation is
open, a lightweight **poll** (every 5s, backing off to 15s after 1 min idle) on
`getConversation(conversationId, sinceCursor)` patches new/changed `crm_message` rows into
local state. Baseline is poll (no Supabase realtime is configured for CRM today —
`crm-messaging.md §3.2` confirms none exists; the realtime hits elsewhere in the repo are
consumer widgets, not CRM). **Progressive enhancement:** if `postgres_changes` realtime is
later enabled, swap the poll for a `crm_message` channel filtered by `conversation_id` — the
component reads the same shape either way. The inbox **list** does **not** poll; it revalidates
on its cache tag when a mutation touches it.

### 4.6 Inbox flows (phone-first, tap-counted)

**Open + reply to a text (target vs the audit's measured 4 interactions / 3 full renders / 0
feedback frames, `crm-messaging.md §11`):**
1. Tap conversation → row highlights **instantly** (optimistic navigation via the Spec-01
   pending-state primitive), thread streams in. (1 tap)
2. Type in the always-visible composer, tap Send → **pending bubble appears instantly**,
   input clears + disables (§5). (1 tap)
3. Delivery chip advances Sent→Delivered via the open-conversation poll. No page refresh.

Target: **2 taps, 0 full-page renders, continuous feedback.**

**Triage without opening:** swipe/checkbox → Mark read / Assign / Close, each an optimistic
mutation returning the changed conversation (no `router.refresh()`; the row updates in place).
Bulk assign is **one** batched action over the selected ids, not N sequential round trips
(fixes `crm-messaging.md §6.5`).

### 4.7 `getInbox()` DAL

```
getInbox({ scope, folder, brokerSlug, cursor, limit=30 }) →
  { rows: InboxRow[], nextCursor }
```
- Reads `crm_conversation` ordered by `last_message_at desc`, keyset-paginated on
  `(last_message_at, id)` — **no rolling 2,000-row window; every conversation is reachable
  including old Closed/Sent** (fixes the archive-truncation correctness bug,
  `crm-messaging.md §6.1`).
- Joins `primary_person_id → crm_people` for the name and a `lateral` for the last message
  snippet + last outbound delivery_state + participant chips (2 lateral subqueries, indexed).
- Broker scope clamped in the query.
- `unstable_cache` per `(scope, folder, brokerSlug)` with tag `inbox:{brokerSlug}`; a send /
  state change invalidates the tag. Streamed inside `<Suspense>`; the shell paints first
  (arch §4.6).

---

## 5. Feature — The Composer (optimistic + idempotent send)

### 5.1 Purpose & job

Send an SMS/MMS/email/group message and **know instantly** it is in flight, with **zero**
chance a second tap double-charges a TCPA message (C5). This is the direct fix for the
owner's "text hangs, I send multiple" (RC2).

### 5.2 Client behavior (the optimistic primitive from Spec 01, applied)

On Send:
1. Generate `idempotency_key = crypto.randomUUID()`.
2. **Optimistically append a "sending" bubble** into the open conversation via `useOptimistic`.
3. **Clear + disable** the input immediately (`useTransition` pending). The Send button is
   disabled while the action is in flight — fixes the "button never disabled" +
   "text survives redirect" double-send trap (`crm-messaging.md §2.1, §2.4`). The composer is
   **keyed by conversation id** so navigation resets it (fixes the surviving-state bug,
   `crm-messaging.md §2.4`, `InlineReply.tsx:260-266`).
4. On resolve: patch the real `crm_message` row in (delivery chip starts its ladder). On
   reject: mark the optimistic bubble **Failed** with the reason + a **Retry** button
   (re-sends with a **new** idempotency key). No `error=` URL param (fixes `§2.5`).

No `router.refresh()`. No full-page re-render. The action returns the changed entity; the
client patches local state (arch §4.2).

### 5.3 Server contract — `sendMessage`

```
sendMessage({
  conversationId?,          // omitted for a brand-new compose
  newParticipants?,         // [{personId}|{rawPhone}|{rawEmail}] when starting fresh
  channel,                  // 'sms' | 'email'  (mms inferred from media; group inferred from participant count)
  body, subject?,           // subject required for email
  mediaRefs?,               // uploaded attachment refs
  idempotencyKey,           // REQUIRED
  quietHoursOverride?       // only honored 21:00–08:00 (§5.6)
}) → { ok: true, messages: CrmMessage[], conversation: ConversationSummary }
    | { ok: false, error, code, failedRecipients? }
```

Serverside order (in-body guard first, per arch §4.4):
1. **`requireAdmin('crm:message:send')`** — in-body, because actions are independently
   invocable POSTs (arch §4.4; closes the RC5 hole where only the layout gated).
2. **Idempotency check:** `select from crm_message where idempotency_key = $key`. If found →
   **return the existing row(s)**, dispatch nothing. A duplicate key is a no-op (arch §4.2).
   This is the hard stop that makes double-send impossible even if the client guard fails.
3. `resolveOrCreateConversation` (§3.2) → conversation + full participant set.
4. **Compliance gates (kept libs, unchanged):** quiet hours; `isSuppressed()` per recipient
   (fail-closed); A2P status (fail-closed). A block returns a typed error → the client marks
   the bubble blocked with the reason (e.g. "Quiet hours — send anyway?" surfaces the override
   only when actually in the window, §5.6).
5. Merge-token resolution — fail-closed on an empty required token (kept behavior); returns a
   typed error so the client shows "Merge field {first_name} is empty" instead of sending a
   broken message.
6. **Dispatch** via the kept path: 1:1 → `sendSms`/MMS via the broker line +
   MessagingServiceSid; group → `sendGroupMms` (Conversations API, **reusing**
   `twilio_conversation_sid`, §6.5); email → Gmail DWD with threading headers (§5.4).
7. **Persist:** insert `crm_message` (`provider_sid`, `delivery_state='sent'|'queued'`,
   `idempotency_key`, `media`) **and** the `crm_timeline` ledger row, linked by
   `timeline_id`, in one RPC. Recompute conversation clocks (trigger).
8. **Partial failure is explicit:** for a group/multi-recipient send, per-recipient outcomes
   are returned in `failedRecipients`; the send is `ok:true` only if **all** intended
   recipients dispatched. A 3-person send where 2 fail returns
   `{ok:false, failedRecipients:[...]}` — fixes the swallowed-partial-failure bug where the old
   path returned `{ok:true}` on one success (`crm-messaging.md §2.5`, `crm.ts:935-937`).
9. Invalidate `inbox:{brokerSlug}` + `inbox:counts:{brokerSlug}` tags (targeted, not
   page-wide).

### 5.4 Email specifics (fix threading + engagement)

- `sendCrmEmail` gains `In-Reply-To` + `References` headers and passes Gmail `threadId` when
  the conversation has one, so a reply threads in the client's mail app (fixes the RFC-level
  break, `crm-messaging.md §5.2`, `gmail.ts:360-369`). The conversation's `gmail_thread_id` is
  set from the send response and reused thereafter.
- **Reply-All** prefills the original `Cc` set into recipients (fixes `crm-messaging.md §5.2` —
  today Reply-All opens the same composer as Reply and drops Cc).
- Open/click engagement (kept HMAC-token pixel+link wrapping) renders on the email bubble in
  the ONE renderer (fixes the inbox-only-shows-nothing gap, `crm-messaging.md §5.5`).

### 5.5 Media

Attachments upload **client-direct** with per-file status chips (kept — the one honestly-fed
part of the old composer, `crm-messaging.md §5.4`) and are stored as `crm_message.media[]`,
rendered inline through the existing MMS proxy on every surface.

### 5.6 Quiet-hours override

The "Send anyway (quiet hours)" control renders **only** when the current time is inside the
21:00–08:00 window (fixes the always-visible clutter+invitation, `crm-messaging.md §2.6`).
Outside the window the server ignores the flag.

---

## 6. Feature — Group messaging (unmistakable, no silent drops)

### 6.1 Purpose & job

The owner's stated #1 confusion: "I can't tell if a message is a group or a single person"
(arch §2/RC1). And the worse latent bug: replying from the inbox to a group **silently drops
everyone but the primary** (`crm-messaging.md §4.4`, `InlineReply.tsx:260-266`). Both are
solved structurally by the participant model (§3.1).

### 6.2 Group is a rendered property of the model

- Inbox row: `Group · N people` label + participant chips (§4.2).
- Thread header: `Group · Jane, Tom, +1` with tappable chips (each opens that participant's
  person card, or an "Add Person" affordance for a `raw` participant).
- Each bubble in a group shows its **sender name** (which participant sent it), from the
  `crm_message` direction + inbound participant match. A 1:1 shows no per-bubble name.

Because `is_group`/`participant_count` are DB-maintained (§3.4), a group and a 1:1 are
**never** pixel-identical again (`crm-messaging.md §4.3`). And because the inbox lists
`crm_conversation` rows (not person-keyed timeline rows), one group thread is **one** inbox
row, not N 1:1-looking rows (fixes `crm-messaging.md §4.3` last line).

### 6.3 Reply targets the full participant set — by construction

`sendMessage` with a `conversationId` and no `newParticipants` sends to **every** participant
of that conversation (§5.3 step 3). There is no code path that can reply to a group as a 1:1,
because the participant set is the conversation's, not a hand-passed `recipients` prop the
inbox forgot to wire (fixes `crm-messaging.md §4.4` on **all** surfaces, not just the person
page). The obsolete `getGroupReplyParticipants` + its `BROKER_LINES` hardcode + its
`group:true`-only filter bug are **deleted** (§1.3).

### 6.4 Add-to / remove-from group

Adding a participant to an existing group conversation adds a `crm_conversation_participant`
row and (for Twilio Conversations) adds the member to the existing `twilio_conversation_sid`.
Removing is a soft state (participant marked left) — history is preserved. Group size cap of
10 incl. broker line is kept and enforced pre-send (`crm-messaging.md §4.5`).

### 6.5 Fix: reuse the Twilio Conversation (no degradation to N private texts)

`sendGroupMms` **reuses** `crm_conversation.twilio_conversation_sid` instead of creating a new
Conversation per send (fixes `crm-messaging.md §4.5` — the silent degradation where Twilio
rejects a second group-MMS over the same number-set and the code falls back to N private 1:1
texts with only a `console.warn`). If Twilio reports the stored SID is gone, we create a new
one, store it, and record a **visible** system message in the thread ("Group thread
re-created") — never a silent 1:1 fan-out.

### 6.6 Raw participant → resolved contact

A `raw`-phone participant that later resolves to a person (via the kept Add-Person/link flow)
updates `crm_conversation_participant.person_id` in place. If that person already had a 1:1
conversation on the same phone, `resolveRawParticipant` **merges** the two conversations
(re-parent `crm_message` rows to the surviving conversation, union participants, recompute
clocks) so history is unified, not duplicated. Raw-participant outbound sends now **do** get a
`crm_message` audit row (fixes `crm-messaging.md §4.5` — today raw numbers get "no timeline to
log," leaving the only record inside Twilio).

---

## 7. Webhooks & inbound (extend the kept engine)

### 7.1 Inbound SMS / MMS

`inbound-sms/route.ts` (kept signature-validation, STOP/START/HELP, suppression, forward-to-
broker-cell) additionally: `resolveOrCreateConversation` → insert `crm_message`
(`direction=in`, `delivery_state='received'`, `media[]`, `provider_sid`) → trigger sets
`state=unread`, `needs_reply=true`, clocks. The dual-write `crm_timeline` row is preserved.
Inbound MMS with no text writes `body=null` + `media[]` (fixes the `[N attachments]`
literal-body convention, `crm-messaging.md §7`). Inbound gets a consistent `title` (fixes the
inbound-sms-vs-group-inbound title inconsistency, `crm-messaging.md §8`).

### 7.2 Inbound group (Conversations events)

`conversations-events/route.ts` (kept) resolves the conversation by
`twilio_conversation_sid`, upserts any newly-seen member as a participant, inserts one
`crm_message` per inbound (deduped on `provider_sid`), honors STOP/START, alerts the broker.
The `payload.group:true`/`groupMembers` conventions are gone — participants are rows.

### 7.3 Status callback (delivery)

`status/route.ts` + `crm_advance_sms_delivery` extended to advance
`crm_message.delivery_state` by `provider_sid` (forward-only, race-safe — kept SQL pattern).
Carrier-filter (30007/30008) → `delivery_state='carrier_blocked'` + a visible system message;
21610 → suppress. Because **every** send path now writes `provider_sid` into `crm_message`,
receipts attach on doc/FSBO/expired/group sends too (fixes the "receipts on 2 of 5 paths"
defect, `crm-messaging.md §1`, §3.2).

### 7.4 Inbound email marks unread

The Gmail sync cron (kept 15-min poll) now calls the same inbound path: it inserts a
`crm_message` (`channel=email`, `direction=in`, `gmail_thread_id`) which **flips the
conversation to unread + `needs_reply`** via the trigger (fixes the unwired "Phase B" hook —
`markConversationUnreadOnInbound` fired only for Twilio, so a new client email produced no
unread badge, `crm-messaging.md §5.3`). Gmail push (`users.watch`) to cut the 15-min latency
is an **open question** (§13), not required for correctness.

### 7.5 Email delivery/bounce

Resend-sent mail keeps its webhook → `delivery_state`. Gmail-sent mail has no native bounce
webhook; a bounced Gmail send lands as an inbound `mailer-daemon` message which we detect and
mark the original `crm_message.delivery_state='failed'` (best-effort — closes the "bounce
shows as sent forever" gap, `crm-messaging.md §3.2`, without inventing infra Gmail doesn't
provide). Called out as a known limitation in the thread UI ("Gmail can't confirm delivery").

---

## 8. Responsive behavior (ONE tree)

The inbox, `<Conversation>`, and `<Composer>` are **one** component tree each, authored
mobile-first, adapting by container query / CSS — **no** `md:hidden` twin trees, no 27
parallel mobile components, no double server render, no double JS bundle (arch §4.3; fixes
`crm-messaging.md §9`'s "two different products for the same job").

- **Small screens (default):** full-width conversation list → tap → full-screen thread with a
  sticky bottom composer (the driveway case). Back returns to the list.
- **Large screens (progressive enhancement of the same tree):** two-pane — list rail + open
  thread — via container query, not a second component. The composer, renderer, and actions
  are byte-identical to mobile.
- Every feature the old mobile fork had and desktop lacked (inbox search, AI draft pills,
  template picker) and vice-versa (drafts, Reply-All, note tray, delivery badge, assignee
  change, mixed-channel view — `crm-messaging.md §9`) exists **once**, on both, because there
  is one tree. Inbox search is a server-side keyset query over `crm_conversation` +
  participants (not client-side over loaded rows), so it searches the whole archive.

---

## 9. States (every mutation)

| State | Inbox list | Conversation | Composer send |
|---|---|---|---|
| **Empty** | "No conversations in {folder}" + start-compose CTA | "No messages yet" | n/a |
| **Loading** | Streamed: chrome instant, rows in `<Suspense>` with a conversation-shaped skeleton (not the people-table skeleton, `crm-messaging.md §6.4`) | Bubbles skeleton | — |
| **Populated** | Rows w/ delivery chips | Bubbles + delivery + engagement | Idle composer |
| **Pending/optimistic** | Row moves to top optimistically on send | "Sending" bubble, input cleared+disabled | Button disabled, spinner |
| **Success** | Row snippet+time patched from return value | Real bubble replaces optimistic; delivery ladder begins | Composer ready for next |
| **Partial** | — | Group send: delivered bubbles + per-recipient failed markers | `failedRecipients` surfaced, Retry-failed-only |
| **Error** | Toast + row unchanged | Optimistic bubble → Failed + reason + Retry | Input **restored** (not lost), Retry |
| **Offline** | Cached rows shown; mutations queue with "will send when online" (optimistic bubble stays "pending") | Same | Send disabled w/ "offline" hint |
| **Permission-denied** | Item not rendered (nav from capability map) **and** action refuses in-body (arch §4.4) | — | Refused before dispatch; no partial state |
| **Over-limit** | Group > 10: pre-send validation blocks with a clear message | — | Send disabled + reason |

---

## 10. Edge cases (exhaustive, specific to real data)

1. **Double-tap Send.** Same `idempotency_key` on both requests → DB unique index makes the
   second a no-op returning the first row (§5.3.2). Exactly one message delivers. (RC2/C5.)
2. **Group text with a raw number that later resolves to a contact.** `resolveRawParticipant`
   re-keys the participant + merges any pre-existing 1:1 conversation on that phone (§6.6).
   History unified, no duplicate thread.
3. **Lead with no phone (email-only) — SMS attempted.** `getSendTarget` returns no phone →
   typed error "No phone on file" → composer shows it, no dispatch, no fake success.
4. **Suppression / quiet-hours block.** Fail-closed (kept). Optimistic bubble marked
   "Blocked — suppressed" / "Quiet hours" with the reason. Quiet-hours override only offered
   inside 21:00–08:00 (§5.6).
5. **Merge-token with no value.** Fail-closed refusal (kept). "Merge field {x} is empty" →
   no broken message sends (§5.3.5).
6. **MLS/name sync overwriting an in-flight edit** — not a messaging write; N/A here (covered
   in the listings spec). Messages are append-only; no sync overwrites them.
7. **Expired session mid-send.** In-body `requireAdmin` fails → typed `unauthenticated` →
   client shows a re-auth prompt that **preserves the composer draft** (saved to
   `crm_message_drafts` on the failure) so nothing is lost; the deep-link/`next` preserves the
   conversation (arch §5). Retry after re-auth uses the **same** idempotency key (safe — §5.3.2).
8. **Concurrent broker edits (two brokers reply to the same thread at once).** Both inserts
   succeed (distinct idempotency keys, append-only). The open-conversation poll surfaces the
   other broker's message within 5s. State transitions are last-writer-wins on
   `crm_conversation.state` but message history never conflicts.
9. **Duplicate submit across a refresh/redirect.** Composer is keyed by conversation id and
   the input clears on send, so the text no longer survives (fixes `crm-messaging.md §2.4`).
   Even if it did, idempotency stops the dupe.
10. **Timeout on a 30–60s build (CMA/BPO send).** Handled in Spec 03's send path, but its send
    logs a `crm_message` on completion; if the build times out, the message is marked
    `failed` with a Retry, never a phantom "sent."
11. **A metric/state with no writer.** Not applicable — every `crm_message` field has a live
    writer (send action or webhook); the migration reconciliation (§3.3) proves no orphan
    columns. (Guards against RC6.)
12. **Group send degrades because Twilio rejects a repeat Conversation.** Fixed by reusing
    `twilio_conversation_sid` (§6.5); if re-creation is forced, a **visible** system message
    records it — never a silent 1:1 fan-out.
13. **Inbound MMS photo with no caption.** `body=null`, `media[]` populated, rendered inline
    (not `[1 attachment]` text).
14. **FUB-imported redacted body.** Rendered as `contentHidden` placeholder (kept, §4.4).
15. **Conversation older than any prior window.** Always reachable — no 2,000-row window
    (§4.7; fixes `crm-messaging.md §6.1`).
16. **Carrier filtering (30007/30008).** `delivery_state='carrier_blocked'` + system message
    + the outbound bubble shows a red chip in the inbox (not just the person page).
17. **STOP received mid-conversation.** Kept suppression fires; the next send fail-closes with
    "Contact opted out"; the thread shows the STOP as an inbound system message.
18. **Email reply that should thread but the original was sent from the broker's own Gmail
    client.** The Gmail sync dedupes against app-sent copies (kept, `gmail.ts:227-253`); the
    conversation coalesces by `gmail_thread_id` so the client-sent copy lands in the right
    thread, not a new one.
19. **Two phones for one person.** Two distinct 1:1 conversations (§3.2 rule 2) — matches
    carrier reality; each has its own delivery + thread.
20. **Multi-channel: SMS + email to the same person.** One conversation view, time-interleaved
    (§3.2 rule 4); `channel_set={sms,email}`; the composer defaults to the channel of the last
    inbound message but lets the broker switch.
21. **Bulk assign of 40 selected conversations.** One batched action, one round trip (fixes the
    N-sequential bug, `crm-messaging.md §6.5`).
22. **Unknown inbound sender (no contact).** Kept lead-creation + alert; a `raw`-participant
    conversation is created; the inbox row offers "Add Person" inline (kept flow, §4.2).

---

## 11. Error handling & compliance (fail-closed everywhere)

- **TCPA/suppression/quiet-hours/A2P:** every send routes through the ONE `sendMessage` action
  which calls the kept fail-closed gates **before** dispatch (§5.3). No parallel send path can
  bypass them — `sendDocSmsAction`'s own reimplementation is deleted and routed here (§1.3).
  The `ci:crm-sms-safety` gate remains in `ci:gates` and now also asserts that no writer inserts
  `crm_message`/dispatches without passing through `sendMessage` (a new gate assertion — arch
  §4.4 "gates not prose").
- **Auth:** in-body `requireAdmin('crm:message:*')` on `sendMessage`, `setConversationState`,
  `assignConversation`, and every route handler (arch §4.4). The nav/folder visibility is
  generated from the same capability map, so a broker never sees a thread action the server
  will refuse (kills RC5 dead-ends for messaging).
- **Data accuracy (C4):** delivery state shown to the operator always traces to
  `crm_message.delivery_state` written by the webhook — never inferred, never faked. A message
  we cannot confirm (Gmail) is labeled as unconfirmable, not shown as delivered (§7.5).
- **Partial failure never reads as success** (§5.3.8).

---

## 12. Performance

- **Inbox list:** cached `getInbox` (tagged), keyset-paginated, streamed in `<Suspense>` behind
  an instant shell. No `force-dynamic` full-page recompute per click (fixes
  `crm-messaging.md §6.2`). No 2,000-row scan, no 11 filter passes.
- **Counts:** cached aggregate, lazy, off the hot path (§4.3).
- **Mutations:** return the changed entity; client patches local state; only the relevant cache
  tag invalidates. No `router.refresh()`, no page fan-out (arch §4.2/§4.6). Opening an unread
  thread does **not** double-render (fixes `crm-messaging.md §6.3` — the auto-read effect now
  mutates state via the optimistic primitive without a second full server render).
- **One tree** halves server render + JS bundle vs the forked mobile/desktop trees (arch §4.3).
- **Open-conversation delivery updates** are a scoped 5s poll of a single conversation's new
  rows, not a full-page refetch (§4.5).
- Admin routes drop the public-site chrome/tracking bundle (arch §4.6) — inbox no longer ships
  SiteHeader/VisitTracker/GTM.

---

## 13. Acceptance criteria (writer → store → reader → outcome, per arch §8)

Each is an end-to-end assertion; a feature is not done until its round trip is proven by a
`verify`-style test.

1. **Conversation entity round trip.** Backfill promotes `crm_timeline` message rows → the
   inbox reads `crm_conversation` → the reconciliation report shows
   `promoted == timeline_message_rows`, zero dropped, and 20 sampled group threads reconstruct
   the correct participant set. **Outcome:** no message vanishes at cutover.
2. **Group is unmistakable.** Insert a 2-participant conversation → the inbox row shows
   `Group · 2 people` + chips and the thread header shows both names → a 1:1 shows neither.
   **Outcome:** a group and a 1:1 are visually distinct with zero manual tagging.
3. **Reply-all drops nobody.** From the **inbox** (not just the person page), reply to a group
   → `sendMessage` dispatches to **all** participants → each receives it, each gets a
   `crm_message` audit row (incl. raw numbers). **Outcome:** the spouse is never silently
   dropped from any surface (fixes `crm-messaging.md §4.4`).
4. **Optimistic + idempotent send.** Tap Send → a pending bubble appears in < 100ms, the input
   clears+disables → tap Send again immediately with the same key → the server returns the
   first message, dispatches nothing → exactly one Twilio message exists. **Outcome:** "text
   hangs, I send multiple" is impossible (RC2/C5). **Timing/tap budget:** reply = 2 taps, 0
   full-page renders, first feedback frame < 100ms (vs the audited 4 taps / 3 renders / 0
   feedback, `crm-messaging.md §11`).
5. **Delivery state in the inbox.** Send an SMS → the outbound bubble and the inbox row's chip
   show Sent → the status webhook fires → both advance to Delivered within the 5s poll, with no
   manual reload. **Outcome:** "I can't tell if it went through" is answered on the messaging
   surface itself (fixes `crm-messaging.md §3.2`).
6. **Receipts on every path.** A doc/FSBO/expired/group send writes `provider_sid` into
   `crm_message` → the status webhook matches it → delivery advances. **Outcome:** receipts
   attach on all 5 paths, not 2 (fixes `crm-messaging.md §1`).
7. **Email threads + marks unread.** Send an email reply → it carries `In-Reply-To`/`References`
   → the client's reply lands in the same Gmail thread → the sync inserts a `crm_message` →
   the conversation flips to unread + `needs_reply` and appears in "Waiting on you."
   **Outcome:** inbound email is reliable in the inbox (fixes `crm-messaging.md §5.2, §5.3`).
8. **Partial failure is honest.** A 3-recipient group send where 2 fail returns
   `{ok:false, failedRecipients:[2]}` → the UI marks 2 bubbles failed with Retry.
   **Outcome:** no false success (fixes `crm-messaging.md §2.5`).
9. **One tree, both sizes.** The same `<Conversation>` renders media, delivery, engagement,
   group context, and mixed-channel on a 375px phone and a 1280px desktop, from one component.
   **Outcome:** no feature is mobile-only or desktop-only (fixes `crm-messaging.md §9`).
10. **Auth in-body.** A POST to `sendMessage` without a session refuses regardless of the layout
    gate. **Outcome:** RC5 messaging dead-ends and the unauthenticated-POST class are closed.
11. **Archive completeness.** A conversation whose last message is 6 months old is reachable in
    Closed/All. **Outcome:** the inbox is an archive, not a rolling window (fixes
    `crm-messaging.md §6.1`).

---

## 14. Open questions for Matt (genuine decisions, not defaults)

1. **Multi-channel coalescing (§3.2 rule 4):** should SMS + email to the same person render as
   **one** unified conversation (my default — matches "my conversation with Jane"), or stay as
   **separate** SMS and email threads? This is a product-feel call; the model supports either
   (a `channel` filter on the same conversation vs distinct conversations).
2. **Gmail push (§7.4):** worth wiring `users.watch` to cut inbound-email latency from 15 min to
   near-real-time, or is the 15-min poll acceptable? (Push adds a renewable subscription + a
   webhook to maintain.)
3. **Group thread as one inbox row vs per-person visibility:** a group text currently touches N
   people's timelines. In the new model it's one conversation. Confirm a group conversation
   should appear **once** in the inbox for the assigned broker (my default), not once per member.
4. **"Waiting on you" as a default folder tab** (§4.3) — promote it to the primary triage view,
   or keep it as a filter under All? (It's the highest-signal folder; I default it visible.)
5. **Retention/archival:** any legal hold or retention window on `crm_message` (TCPA records)
   that should be encoded now (e.g. never hard-delete, only soft-close)?
6. **Delivery-poll cadence (§4.5):** 5s→15s backoff is my default for the open conversation.
   Acceptable, or tune for cost/latency?

---

## 15. Build sequencing within this spec (maps to arch §7 step 2)

1. Land the additive migration (`crm_conversation`/`participant`/`message` + triggers +
   indexes) — no reader change yet.
2. Dual-write: every send path + both webhooks + Gmail sync also write `crm_message`
   (source of truth) alongside the kept `crm_timeline` ledger.
3. Run the backfill + reconciliation report; do not proceed until zero-drop.
4. Build `getInbox`/`getConversation` DAL (cached, keyset) + the ONE `<Conversation>`
   renderer + the optimistic `<Composer>` on the single responsive tree.
5. Cut the inbox over to read `crm_conversation`/`crm_message`; keep `crm_timeline` readers
   (person page/reports) on the ledger until Spec 03 migrates them.
6. Delete the accretion (§1.3) behind the new gate assertions.

Each step ships and is observable on its own; nothing requires a flag-day (arch §7).
