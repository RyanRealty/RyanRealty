# CRM Messaging Domain — Ground-Truth Audit

Domain: inbox, SMS, email, group messages, delivery visibility.
Auditor scope: `app/admin/(protected)/crm/inbox/**`, `components/admin/crm/inbox/**`, the shared composers (`SmsComposer`, `EmailComposer`, `EmailBodyEditor`, `ConversationFeed`, `RecipientField`, `ComposerAttachments`, `TemplatePicker*`, `MergeFieldInserter`), send actions (`app/actions/crm.ts`, `crm-inbox.ts`, `crm-conversation.ts`, `crm-compose.ts`, `crm-send-now.ts`, `send-doc.ts`, `[id]/form-actions.ts`), Twilio/Gmail/Resend libs (`lib/crm/twilio.ts`, `twilio-conversations.ts`, `sms-status.ts`, `gmail.ts`, `lib/resend.ts`, `lib/email-tracking.ts`), webhooks (`app/api/twilio/inbound-sms`, `status`, `conversations-events`), and the DAL (`lib/data/crm/getInboxQueue.ts`, `getInboxThread.ts`, `getContactActivityFeed.ts`, `getContactConversation.ts`, `getSendTarget.ts`, `getGroupReplyParticipants.ts`, `drafts.ts`).

Every claim below carries file + line evidence. All line numbers are from the tree at commit `d3dd457a` (2026-07-16).

---

## 0. Headline

The messaging stack has a **correct, compliance-hardened server core** (suppression chokepoint, quiet hours, A2P fail-closed gate, signature-validated webhooks, forward-only delivery state, dedupe keys) wrapped in a **UI that gives the user zero feedback and hides the very state the server so carefully records**. Specifically:

1. **The send FEELS hung because it is architecturally hung**: a form-action send serially awaits Twilio + ~10 DB round trips + a full `force-dynamic` re-render of the heaviest page in the admin (a 2,000-row timeline scan) before ANYTHING changes on screen — no pending state, no optimistic bubble, no disabled button, and the sent text **stays in the compose box** afterward because the textarea is controlled state that survives the redirect.
2. **Double sends are structurally possible** at every SMS/email surface: no `useFormStatus`/pending-disable anywhere (verified: only `NextStepCard.tsx` uses it), no idempotency key, and the timeline dedupe key is derived from the *Twilio SID of each attempt* — so a second tap is a second, fully-delivered message.
3. **Group messages are correctly modeled in the database and completely invisible in the UI.** `payload.groupTo` / `payload.groupMembers` / `group: true` are written by the send path and both webhooks — and read by **zero** UI components. A group text renders pixel-identically to a 1:1 text in all four thread renderers. Worse: replying from the inbox (desktop or mobile) to a group thread **silently drops every other participant** because only the contact-detail page wires group recipients into the composer.
4. **Delivery state exists in the DB and is shown on exactly one surface** (desktop person-detail timeline). The inbox — the surface built for messaging — shows nothing between "tapped send" and "client replied".
5. There are **four different renderers of the same `crm_timeline` conversation** with four different capability sets, **two+ parallel SMS send paths** with incompatible payload conventions (breaking delivery receipts for docs/outreach sends), and **two email backbones** (Gmail DWD + Resend).

---

## 1. Data model (source of truth)

| Table | Role | Evidence |
|---|---|---|
| `crm_timeline` | Every message/call/note/event, per person. Kinds: `sms_in/sms_out/email_in/email_out/call/voicemail/note/...` | `lib/data/crm/getContactActivityFeed.ts:43-71` |
| `crm_conversation_state` | Per-person triage: `unread/open/handled/closed` + `assigned_broker` + inbound/outbound clocks | `app/actions/crm-inbox.ts:56-69` |
| `crm_message_drafts` | Unsent drafts keyed (person, broker, channel) | `lib/data/crm/drafts.ts` |
| `crm_contact_points` | phone/email → person resolution | `lib/crm/twilio.ts:159-178` |
| `email_events` | open/click/sent engagement | `lib/email-tracking.ts`, `app/api/track/e/*` |

**There is no thread/conversation entity.** A "conversation" is `person_id`. Group threads, multi-channel threads, and multiple phone numbers all collapse onto the person. This single modeling decision is the root of the group-message invisibility (§4) and of the N-copies-of-one-group-thread inbox behavior.

**Payload key fragmentation** (the reason delivery receipts don't attach to half the sends):

| Writer | SID key written | Delivery receipts attach? |
|---|---|---|
| Manual 1:1 send (`app/actions/crm.ts:911`) | `twilioSid` | ✅ |
| Sequence engine (`app/api/cron/crm-sequence-engine/route.ts:423`) | `twilioSid` | ✅ |
| Doc send (`app/actions/send-doc.ts:283`) | `sid` | ❌ never |
| Expired outreach (`app/actions/expired-outreach.ts:143`) | `sid` | ❌ never |
| FSBO outreach (`app/actions/fsbo-dashboard.ts:185`) | `sid` | ❌ never |
| Group MMS out (`app/actions/crm.ts:858-871`) | `messageSid` (+`sid` when media) | ❌ (Conversations API — no StatusCallback path at all) |
| Inbound group (`app/api/twilio/conversations-events/route.ts:135-144`) | `sid`+`messageSid`, `group: true`, `groupMembers` | n/a |
| Outbound group | `groupTo` but **no `group: true`** | — breaks `getGroupReplyParticipants` (§4.4) |

The webhook RPC matches strictly on `payload->>'twilioSid'` (`supabase/migrations/20260715153000_twilio_hardening.sql:76-79`, `app/api/twilio/status/route.ts:53-58`).

---

## 2. THE SEND PATH, FRAME BY FRAME (SMS — the owner's #1 pain)

### 2.1 Frame 0 — user taps Send

- `SmsComposer` is a plain `<form action={props.sendAction}>` (`components/admin/crm/SmsComposer.tsx:118`).
- Send button disable condition: `!body.trim() || attachments.uploading || props.sendDisabled` (`SmsComposer.tsx:188`). **It is NOT disabled while the action is in flight.**
- **No `useFormStatus`, no `useTransition`, no `useOptimistic` anywhere in the composer, InlineReply, MobileThread, or MobileComposeSheet.** Repo-wide grep: the only `useFormStatus` in the CRM is `components/admin/crm/NextStepCard.tsx:18,44`. The only visual acknowledgment that a send is happening is... nothing.

### 2.2 Frames 1–N — the server action (everything serial)

Inbox binding: `sendSmsForm` (`app/admin/(protected)/crm/inbox/page.tsx:258-265`) → `sendCrmSmsAction` (`app/actions/crm.ts:732-938`), which serially awaits for a simple 1:1 send:

1. `requireCrmAccess()` — auth + `admin_roles` read (memoized per request) (`crm.ts:733`)
2. `requirePersonInScope()` — `crm_people` read (`crm.ts:738`)
3. `parseAttachmentRefs` (+ `signAttachmentUrls` when MMS) (`crm.ts:745-753`)
4. quiet-hours check (`crm.ts:774-778`)
5. `getSendTarget()` — `crm_people` (+ `crm_contact_points` fallback) (`crm.ts:887`)
6. `isSuppressed()` — suppressions read (`crm.ts:889`)
7. `buildMergeContext()` — brokers + company settings reads (`crm.ts:895`)
8. `brokerTwilioNumber()` → `getBrokerTelephony()` (`crm.ts:898`)
9. `instrumentSmsLinks()` — short-link INSERT per URL in the body (`crm.ts:902`)
10. `getA2pCampaignStatus()` — Twilio API (5-min module cache + `unstable_cache` 300 s, so usually cached) (`lib/crm/twilio.ts:300`)
11. **Twilio `POST /Messages`** — the actual network send (`lib/crm/twilio.ts:248-252`)
12. `crm_timeline` INSERT (`crm.ts:908-917`)
13. `revalidateCrm()` — `revalidatePath('/admin/crm')` + `/admin/crm/{id}` (`crm.ts:936`, def `crm.ts:434-437`)

Then the inbox wrapper adds:

14. `discardDraftAction()` — full auth + scope + DELETE again (`inbox/page.tsx:263`, `app/actions/crm-inbox.ts:347-363`)
15. `redirect(\`${backHref}&c=${personId}\`)` (`inbox/page.tsx:264`)

### 2.3 Frame N+1 — the redirect re-renders the heaviest page in the admin

The inbox page is `export const dynamic = 'force-dynamic'` (`inbox/page.tsx:86`). The redirect re-runs:

- `getInboxFolderQueue` → `buildInboxWorkingSet`: up to **2,000 `crm_timeline` rows joined to `crm_people`, fetched in up to 2 sequential 1,000-row PostgREST pages** (`lib/data/crm/getInboxQueue.ts:430-449`), folded in memory, then filtered **11×** for the folder-rail counts (`getInboxQueue.ts:381-393`)
- `getTwilioSmsStatus`, `getCrmTemplatesAdmin`, `getSignatureForMailbox` (`inbox/page.tsx:116-121`)
- the open pane: contact card + **100-row full-body thread** + send target + state row + drafts (`inbox/page.tsx:183-189`)
- `buildMobileThreadItems` — sanitizes every email body for the mobile tree **even on desktop** (`inbox/page.tsx:193`)

Only when this full RSC payload streams back does the sent message appear. **Total user-perceived latency = Twilio round trip + ~10 serial DB reads + a 2,000-row scan + full page assembly, with zero intermediate feedback.**

### 2.4 Frame N+2 — the trap that causes double sends

After the redirect, the message is in the thread — but **the compose box still contains the sent text**:

- `body` is controlled state seeded once from `initialBody` (`SmsComposer.tsx:70`).
- The redirect targets the same URL/tree position; `SmsComposer` inside `InlineReply` has **no key** (`InlineReply.tsx:260-266`), so the client component instance — and its state — survives the RSC swap. React's automatic post-action form reset only applies to *uncontrolled* fields.
- The Send button is therefore still enabled, still armed with the same text.

Combined with §2.1 (button never disabled in flight) the user experience during a 2–6 s send is: *tap send → nothing happens → text still in box → tap again*. Both taps run `sendCrmSmsAction` end-to-end. **There is no idempotency key anywhere in the chain**; the timeline dedupe key is `twilio:${sent.sid}:p${rid}` (`crm.ts:916`) — per-attempt-unique by construction, so it dedupes nothing across taps. Two Twilio messages deliver.

The same trap exists on every other SMS surface:

- **Person page (desktop + mobile Comms tab)**: `sendSmsForm` in `[id]/form-actions.ts:65-69` doesn't even redirect on success — it relies on `revalidateCrm` to refresh the 33-query person page. No success flash, composer keeps text, button stays live.
- **Mobile inbox thread**: `MobileThread.tsx:436` — same composer, keyed only by AI-draft version (`smsDraftV`), so a send never remounts it.
- **Mobile compose sheet**: `MobileComposeSheet.tsx:136-143` closes the sheet on success (the one surface with decent post-send behavior), but during flight nothing is disabled — double-tap still double-sends.

### 2.5 Failure path

Errors round-trip as `redirect(...&error=...)` → destructive Alert above the composer (`inbox/page.tsx:262,443-447`; `MobileThread.tsx:422-426`; person page `[id]/page.tsx:487`). Functional, but (a) it costs a full re-render to find out, (b) the error persists in the URL (survives refresh, pollutes shared links), and (c) on the multi-recipient path partial failure is silent: `sendCrmSmsAction` returns `{ok: true}` if **at least one** recipient succeeded (`crm.ts:935-937`) — `lastError` for the others is discarded. A 3-person send where 2 fail reports success.

### 2.6 Quiet-hours override

The "Send anyway (quiet hours)" checkbox renders 24/7 (`SmsComposer.tsx:197-205`), not just during 9 pm–8 am. A compliance override permanently visible is both clutter and an invitation to pre-check it.

### 2.7 What the Twilio layer does right (keep in the rebuild)

- `MessagingServiceSid` + `From` sent **together**, per the verified 2026-07-15 AT&T queue incident (`lib/crm/twilio.ts:286-309`) — matches memory; correctly implemented.
- A2P gate fails **closed** (`twilio.ts:222-229`).
- StatusCallback wired on every plain send (`twilio.ts:247`).
- Signature validation on all webhooks incl. preview envs (`twilio.ts:51-78`).
- Forward-only delivery-state merge in one SQL statement — race-safe (`supabase/migrations/20260715153000_twilio_hardening.sql:56-80`).
- STOP/START/HELP keyword handling + suppression chokepoint (`inbound-sms/route.ts:128-152`).
- iMessage-incident guards intact: `contact:do-not-call → ['call','sms']` (`lib/crm/suppressions.ts:20-24`), relay whitelist + gate `ci:crm-sms-safety` in `ci:gates` (`package.json:125,166`; `scripts/check-crm-sms-channel-safety.mjs` exists).

---

## 3. Delivery visibility

### 3.1 What exists

- Webhook → `crm_advance_sms_delivery` RPC writes `payload.deliveryState` forward-only, records carrier-filter (30007/30008) as a visible system row, suppresses on 21610 (`app/api/twilio/status/route.ts:44-97`).
- On-demand reconcile: `refreshSmsDeliveryStatusAction` pulls live Twilio status for a stuck row (`app/actions/crm-person-detail.ts:321-365`).
- `SmsDeliveryBadge` — Delivered/Sent/Queued/Failed/Carrier-blocked chip + refresh button (`components/admin/crm/person-detail/PersonCenterColumn.tsx:197-283`, rendered at line 335).

### 3.2 The hole

**The badge renders on exactly one surface: the desktop person-detail timeline.** Grep for `deliveryState` across `components/`: only `PersonCenterColumn.tsx:181`. Not in `InboxThreadView` (desktop inbox), not in `MobileThread` (mobile inbox), not in `ConversationFeed` (mobile Comms tab). The inbox — the purpose-built messaging surface — has **zero** delivery indication, which is precisely the owner's "I can't tell if it went through" complaint.

Additionally:

- **No push/poll**: no Supabase realtime subscription, no polling anywhere. A `delivered` receipt becomes visible only after a manual reload of the person page.
- Delivery receipts never attach to doc/FSBO/expired sends (payload key mismatch, §1 table).
- **Email has no delivery state at all**: Gmail-sent CRM emails have no bounce/delivery webhook (Resend's webhook covers only Resend sends). A bounced email to a dead address shows as a normal "Email sent" row forever.

---

## 4. Group messaging

### 4.1 Outbound model (correct at the wire level)

2+ recipients → real carrier group MMS via Twilio Conversations: members bound `Address`-only, broker line joins as `ProjectedAddress`, media uploaded to MCS (`lib/crm/twilio-conversations.ts:111-231`). Falls back to per-recipient 1:1 broadcast if the group can't form (`crm.ts:817-879,881-933`). Recording: one `sms_out` row per member with `title: 'Group text sent'` and `payload.groupTo` (`crm.ts:858-871`).

### 4.2 Inbound model (correct at the wire level)

Group replies bypass Programmable Messaging entirely; the Conversations webhook records one `sms_in` per member with `payload.group: true, groupMembers` (`app/api/twilio/conversations-events/route.ts:128-151`), honors STOP/START, alerts the broker, dedupes on retries.

### 4.3 The UI renders none of it — the owner's exact complaint, verified

- `toFeedItem` maps rows to feed items and **drops the payload**: no `group`, no `groupMembers`, no `groupTo` survive (`lib/data/crm/getContactActivityFeed.ts:110-137`). The label comes from `KIND_MAP` — always `'Text sent'` / `'Text received'` (`:44-47`).
- Desktop inbox bubble: renders `fullBody` + `broker/person name` only (`components/admin/crm/inbox/InboxThreadView.tsx:144-162`).
- Mobile inbox bubble: body only (`MobileThread.tsx:393-409`).
- Mobile Comms tab row: title is hardcoded `"${broker} texted ${personName}"` — even for a group message (`ConversationFeed.tsx:70-76`).
- Repo-wide grep for `groupMembers|groupTo|'Group text'` in `components/`: **zero hits.** The stored titles (`'Group text sent'`, `'Group text received'`) surface *only* in the broker alert email body (`conversations-events/route.ts:223`).

**Conclusion: a group message and a 1:1 message are pixel-identical everywhere the owner looks.** And because the inbox queue is person-keyed (`getInboxQueue.ts:461-483`), one group thread appears as N separate 1:1-looking conversations.

### 4.4 Group replies drop people — worse than the display bug

- **Inbox (desktop)**: `InlineReply` passes **no `recipients`** to `SmsComposer` (`InlineReply.tsx:260-266`); the inbox page never calls `getGroupReplyParticipants`. Reply to a group text from the inbox → a 1:1 text to the primary only. Everyone else is silently dropped.
- **Inbox (mobile)**: same — `MobileThread.tsx:436` passes no recipients. (The kebab offers "Start a group message", which is a *new* group, not a reply-all to the existing one.)
- **Person page (desktop + mobile Comms)**: the ONLY surface implementing Matt's "a group reply drops nobody" rule — group participants reconstructed and pre-checked (`[id]/page.tsx:223-239`, `SmsComposer.tsx:82-100,119-148`).
- **Bug inside the one working path**: `getGroupReplyParticipants` filters `.contains('payload', { group: true })` (`lib/data/crm/getGroupReplyParticipants.ts:41-47`), but outbound group rows never write `group: true` (§1 table). Its own doc comment claims `payload.groupTo` rows are covered — the query excludes them. So a group thread the broker **started** (no inbound reply yet) reconstructs zero participants, and the "reply" quietly reverts to 1:1 even on the person page.
- Hardcoded `BROKER_LINES` set of 4 numbers (`getGroupReplyParticipants.ts:30`) duplicates DB telephony truth (`brokers.twilio_number`); a number change makes the brokerage's own line appear as a "participant".

### 4.5 Other group gaps

- Raw (non-contact) group participants get **no record of outbound sends at all** (`crm.ts:857` — "raw number: … no timeline to log"). There is no audit trail of what was texted to that number except inside Twilio.
- `sendGroupMms` creates a **new Conversation for every send** (`twilio-conversations.ts:138-144`); no reuse of the `conversationSid` already stored on the thread's timeline rows. Twilio rejects a second group-MMS conversation over the same number-set, which would trip the silent 1:1-broadcast fallback (`crm.ts:876-878` logs a `console.warn` only). PLAUSIBLE (needs a live repro): repeated group sends to the same people degrade from "one shared thread" to "N private texts" with no operator-visible signal.
- Group size capped at 10 incl. broker line — enforced (`twilio-conversations.ts:85,128-130`; `MobileComposeSheet.tsx:41,203`).

---

## 5. Email

### 5.1 Send path

`sendCrmEmailAction` (`crm.ts:466-574`): scope → suppression (fail-closed) → To/Cc/Bcc re-validated server-side with per-recipient suppression sweep (`lib/crm/resolve-email-recipients`) → merge tokens → Gmail API send from the broker's own mailbox via DWD (`lib/crm/gmail.ts:313-429`) → open/click instrumentation (`lib/email-tracking.ts:139-152`) → `email_out` timeline row per recipient-contact (`crm.ts:564-570`). Solid.

### 5.2 Reply threading is broken at the RFC level

`sendCrmEmail` builds headers `From/To/Cc/Bcc/Subject/MIME-Version` only (`gmail.ts:360-369`). **No `In-Reply-To`, no `References`, no Gmail `threadId`** — despite the module header claiming "real reply chain" (`gmail.ts:11-12`). Repo grep: those headers exist only in `lib/marketing-brain/inbox-reply.ts:146-147` (a different subsystem). Consequence: every CRM "Reply" starts a fresh thread in the client's mail app (Gmail threads on References, not subject). The inbox's Reply/Reply All/Forward buttons (`InlineReply.tsx:103-114,139-151`) only prefill `Re:`/`Fwd:` subjects — Reply All doesn't even prefill the original Cc list into recipients (it opens the same composer as Reply; `initialTo` is never passed in the inbox binding, `inbox/page.tsx:448-469`).

### 5.3 Email is not real-time in either direction

- Inbound email lands via the Gmail **poll** cron every 15 min (`vercel.json` schedule `9,24,39,54 * * * *`; `app/api/cron/crm-gmail-sync/route.ts:1-8`). No Gmail push (`users.watch`). A client's email reply is invisible for up to 15 minutes.
- Emails the broker sends **from his own Gmail client** appear in the thread only after the same poll (dedupe against app-sent copies handled at `gmail.ts:227-253`).
- **Inbound email never flips the conversation to unread**: `markConversationUnreadOnInbound` is called only by the two Twilio webhooks (`inbound-sms/route.ts:125`, `conversations-events/route.ts:154`) — the Gmail sync writes timeline rows and touches nothing else. `crm-inbox.ts:19-28` documents this as an unwired "Phase B" hook that never got wired. Net effect: a new client email on an already-open/closed conversation produces **no unread badge, no count bump**, and a closed conversation stays buried in Closed. Combined with the 15-minute poll this makes email in the inbox unreliable as an "inbox".

### 5.4 Composer

- `EmailComposer` (`components/admin/crm/EmailComposer.tsx`) + canonical `EmailBodyEditor` with a real "Preview, what sends" iframe, Text/HTML toggle, merge-field warnings — good bones.
- Send button disabled only for `attachments.uploading || sendDisabled` (`EmailComposer.tsx:170`): empty subject/body submits and round-trips a server error; and the same no-pending/no-reset/no-idempotency traps as SMS (§2.4) apply verbatim.
- Attachments upload client-direct with per-file status chips (`ComposerAttachments.tsx`) — the one part of the composer with honest in-flight feedback.

### 5.5 Engagement tracking

Open/click pixel + wrapped links with HMAC tokens, compliance links exempt (`lib/email-tracking.ts:129-152`); engagement renders in `ConversationFeed` ("N opens · last opened") (`ConversationFeed.tsx:189-196`) and as badges in `PersonCenterColumn` (`:327-334`). The **inbox** reading pane shows none of it (no opens/clicks in `InboxThreadView`).

### 5.6 Two email backbones

- Gmail DWD for CRM/broker mail (`lib/crm/gmail.ts`).
- Resend (`mail.ryan-realty.com`) for newsletters/market reports **and** for inbox @mention notifications (`inbox/page.tsx:59,409-414`).
Same conversation domain, two senders, two bounce/deliverability stories (Resend has a webhook; Gmail has nothing).

---

## 6. The inbox queue (correctness + performance)

### 6.1 The 2,000-row working-set window is a correctness bug

`buildInboxWorkingSet` reads the most recent 2,000 message rows **company-wide** (broker-scoped when restricted) and derives every conversation from that window (`getInboxQueue.ts:430-449`). Any conversation whose latest message is older than the window **ceases to exist in the inbox — in every folder, including Closed and Sent**. With three brokers plus sequence/newsletter traffic, 2,000 messages is weeks, not years. The inbox is a rolling window presented as an archive. (`messageCount` per row is likewise window-derived and admits it: `getInboxQueue.ts:127-130`.)

### 6.2 Recomputed from scratch on every navigation

`force-dynamic` + no caching: the 2,000-row join + drafts + state overlay + **11 full-array filter passes** for folder counts (`getInboxQueue.ts:381-393`) run on every folder click, thread open, view toggle, and post-send redirect.

### 6.3 Opening an unread thread renders the page twice

`ThreadHeader`'s auto-read effect fires `setStatusAction('open')` → `revalidatePath` ×2 → `router.refresh()` (`ThreadHeader.tsx:54-63`, `crm-inbox.ts:87-90`) — a second full server render (2,000-row scan and all) immediately after the first, on every unread open.

### 6.4 No navigation feedback

- No progress bar / `useLinkStatus` anywhere in the admin (grep: zero hits).
- `crm/loading.tsx` is a **people-list table skeleton** (`app/admin/(protected)/crm/loading.tsx:1-12`) — the wrong shape for the inbox, and search-param-only navigations (folder/thread clicks are all `?scope=&folder=&c=` links on one route, `inbox-url.ts:20-27`) are React transitions that keep stale UI with no pending cue at all. Click a conversation → the row doesn't even highlight until the full payload returns.

### 6.5 Model/UI dead ends

- Status `handled` exists in the model (`getInboxQueue.ts:35-38`) but **no UI writes it** — ThreadHeader offers Close/Reopen only (`ThreadHeader.tsx:124-133`), bulk offers read/unread/close/reopen (`InboxThreadList.tsx:263-274`), mobile triage the same (`MobileThread.tsx:206-243`).
- `needsReply` and `lastKindLabel` computed for every row (`getInboxQueue.ts:113-114,539`) and rendered **nowhere** (grep of components: zero hits). "Waiting on you" — the single most useful triage signal — is derived and thrown away.
- `markAllReadAction` (`crm-inbox.ts:125-194`) has **zero callers** — dead code exposing a live POST endpoint.
- The bulk toolbar's "Mark read" and "Reopen" buttons are the same mutation (`open`) under two labels (`InboxThreadList.tsx:263-274`).
- Bulk assign loops one server action per selected id (`inbox/page.tsx:136-143`) — N sequential round trips.

### 6.6 What's decent

Folder rail counts are live and consistent (single source, `matchesFolder`), unknown-caller "Add Person"/link-to-existing flow is inline and complete (`AddPersonForm.tsx`), drafts fold into the queue including message-less draft conversations (`getInboxQueue.ts:451-459,551-579`), triage actions all return typed results and surface errors (`InboxThreadList.tsx:161-191`, `ThreadHeader.tsx:65-87`).

---

## 7. Four renderers of one conversation (duplication)

| Surface | Component | Bubbles? | Delivery badge | MMS/attachments visible | Email engagement | Group hint | Load older |
|---|---|---|---|---|---|---|---|
| Desktop inbox reading pane | `InboxThreadView.tsx` | yes | ❌ | ❌ (a texted photo renders as literal `[1 attachment]` text) | ❌ | ❌ | ❌ (hard 100 cap, `inbox/page.tsx:185`) |
| Mobile inbox thread | `MobileThread.tsx` | yes | ❌ | ❌ | ❌ | ❌ | ❌ |
| Mobile Comms tab (person) | `ConversationFeed.tsx` | no (FUB row list) | ❌ | ✅ (`:200-220`) | ✅ opens/clicks | ❌ | ✅ cursor pager |
| Desktop person timeline | `PersonCenterColumn.tsx` | no (event cards) | ✅ (`:335`) | ✅ `TimelineMediaStrip` | ✅ badges | ❌ | ❌ (timeline cap) |

Same `crm_timeline` rows, four presentations, four different capability sets. The inbox — the messaging surface — is the *least* capable: no media, no delivery, no engagement, no pagination, no group context.

Notable inbox-view media gap evidence: inbound MMS body is written as `[N attachment(s)]` when no text (`inbound-sms/route.ts:95`), and neither inbox renderer resolves `payload.media` through the existing `/api/admin/crm/mms/...` proxy (grep: `StoredAttachmentStrip`/media rendering only in `ConversationFeed.tsx` + `PersonCenterColumn.tsx`).

## 7.1 Parallel send paths (duplication, continued)

- **SMS**: `sendCrmSmsAction` (canonical, gated) vs `sendDocSmsAction` (`send-doc.ts:240-305` — own suppression/quiet-hours reimplementation, **no quiet-hours override**, sends via bare messaging service so the From number may differ from the broker's line and split the client's phone thread, writes `sid` so no delivery receipts) vs expired/FSBO one-offs vs the sequence engine. A `ci:composer-discipline` gate exists (`package.json:284`) for UI reuse, but the *server* send paths remain plural.
- **Email**: `sendCrmEmailAction` (Gmail) vs Resend transactional vs newsletter/market-report senders (`crm-send-now.ts` correctly reuses the cron path and logs to the thread).
- **Compose surfaces on one person page**: EmailComposer + SmsComposer (center column) + ContactSendCenter dialog (BPO/CMA/report/matches, `ContactSendCenter.tsx`) + NextStepCard + OwnedHomeCard/ContactCmaCard sends + SendDocDialog — six ways to "send the client something", each with its own feedback idiom (redirect-flash vs toast vs inline error).

---

## 8. Webhooks (inbound + status) — verified against the known context

| Claim (from memory) | Code truth |
|---|---|
| MessagingServiceSid+From must ride together | ✅ implemented + documented (`twilio.ts:286-309`) |
| Group MMS uses MCS | ✅ (`twilio-conversations.ts:93-109,178-192`) |
| Inbound texts forward to broker cell; CRM replies send from business line | ✅ forward implemented, awaited, loop-guarded against the broker's own cell (`inbound-sms/route.ts:59-72,226-239`) |
| FUB-imported texts have redacted bodies | ✅ handled as `contentHidden` placeholders in all four renderers (`getContactActivityFeed.ts:33-38`, `InboxThreadView.tsx:53-56,156`, `ConversationFeed.tsx:141,183-188`, `PersonCenterColumn.tsx:300`) |
| SMS safety gate exists | ✅ `ci:crm-sms-safety` in `ci:gates` (`package.json:125,166`); do-not-call suppresses sms (`suppressions.ts:20-24`) |

Webhook quality is high: signature-verified (incl. malformed-body → 403), dedupe keys on timeline/tasks, always-200 on status to stop retry storms, awaited side-effects (Vercel freeze-safe), block-list gate, unknown-sender lead creation with alerts.

One inbound gap: `inbound-sms` writes `sms_in` **without `title`** (`inbound-sms/route.ts:110-121`) while group inbound writes `title: 'Group text received'` — inconsistent, and since snippets prefer body, harmless today but another convention fork.

---

## 9. Mobile vs desktop divergence (messaging features)

| Feature | Desktop | Mobile |
|---|---|---|
| Drafts folder | ✅ | ❌ (folded to inbox, `inbox/page.tsx:521`; no tab, `MobileInbox.tsx:37-42`) |
| Save draft from composer | ✅ (InlineReply) | ❌ (`MobileThread.tsx:436` passes no `saveDraftAction`) |
| Reply All / Forward | ✅ (subject-prefill only) | ❌ (plain Re: reply sheet) |
| Quick-tag row | ✅ (`InlineReply.tsx:200-256`) | ❌ |
| Note tray / @mentions | ✅ (`NoteTray`) | ❌ (no note affordance in thread) |
| Assignee visibility+change in thread | ✅ (`ThreadHeader`) | ❌ (assign only via list swipe) |
| Start a **group** text | ❌ (desktop Compose = single contact, `ComposeButton.tsx:74-78`) | ✅ (`MobileComposeSheet` multi-recipient) |
| AI draft pills / template picker in inbox | ❌ | ✅ (`MobileAiPills`, template sheet) |
| Inbox search | ❌ (none) | ✅ client-side over loaded rows (`MobileInbox.tsx:85-97`) |
| Mixed-channel thread view | ✅ (all channels interleaved) | ❌ — mode picked by newest message; email mode filters to emails **only**, SMS mode reduces emails to a centered pill (`mobile-data.ts:86-91`, `MobileThread.tsx:203,299-351,384-391`) |
| Delivery badge | person-detail only | ❌ nowhere |
| Same-conversation presentation | inbox bubbles vs person-page event cards | inbox bubbles vs Comms-tab FUB rows |

The two platforms are effectively two different products for the same job, each missing features the other has.

---

## 10. Per-surface verdicts

### `/admin/crm/inbox` (desktop) — **partial**
Triage (folders/bulk/assign/close) works with honest error states. Reading pane renders emails/SMS/calls/notes. But: send UX is the §2 hang/double-send machine; no delivery state; no media; no group context; group reply drops people; no search; 2,000-row window truncates history; every click is a full dynamic re-render with no pending cue; unread-open double-renders.

### `/admin/crm/inbox` (mobile) — **partial**
Faithful FUB-iOS shell (rows, swipes, FAB compose, AI pills, group compose, calling sheet, block flow). Same send-path defects; single-channel thread view hides half the conversation; no drafts; no notes; no delivery state.

### Person page Comms (desktop `PersonCenterColumn`, mobile `MobileCommsTab`) — **partial**
The only surfaces with delivery badges (desktop), media, engagement, full history pagination (mobile), and working group-reply recipients — but split across two different renderers, template loading is a full-page `?tpl=` navigation (`TemplatePickerNav.tsx:30-40` on a 33-query page), and success feedback after a send is nothing (no flash param set, §2.4).

### Send actions / Twilio / webhooks — **works** (server core)
With the caveats: partial-failure swallowing (§2.5), payload-key fragmentation (§1), no idempotency (§2.4).

### Group messaging — **broken** end-to-end as a user-facing feature
Wire-correct, UI-invisible, reply-all only on one surface and buggy there (§4.4).

### Email in the inbox — **partial/broken**
Sends fine; replies don't thread (§5.2); inbound is 15-min-late and never marks unread (§5.3).

---

## 11. Click/step costs (measured against the code paths)

- **Reply to a text from the inbox (desktop)**: open inbox (1) → click conversation (2, full re-render + auto-read second render) → click "Text" (3) → type → Send (4) → wait through §2.3 with no feedback. 4 interactions, 3 full server renders, 0 feedback frames during send.
- **Find out if last night's text was delivered**: impossible from the inbox. Requires: person page (1-2 clicks from inbox) → scroll timeline to the sms_out card → read badge → possibly tap refresh (1 more). And only if the send was manual/sequence (payload `twilioSid`).
- **Reply-all to a group text**: impossible from the inbox (silently degrades to 1:1). From the person page: works only if an inbound group message already exists (§4.4). The user cannot tell any of this from the UI.
- **See a photo the client texted**: inbox shows `[1 attachment]` text → navigate to person page → Comms tab → expand the row (3-4 extra steps).
- **Load a template into an inbox reply**: not possible on desktop inbox (no template picker there — desktop templates exist only on the person page via `?tpl=` full-page navigation; mobile inbox has a template sheet).

---

## 12. Dead / orphaned / mislabeled

- `markAllReadAction` — no callers (`crm-inbox.ts:125-194`).
- `handled` status — unreachable from any UI.
- `needsReply`, `lastKindLabel` — computed per row, never rendered.
- `loadContactConversation` action (`crm-conversation.ts`) — used only by `ConversationFeed`'s pager; fine but the desktop surfaces ignore pagination entirely.
- `InboxScope` legacy type + `matchesScope` — retained "for the mobile branch + tests" (`getInboxQueue.ts:70-75`) but the mobile branch routes on the new scope×folder model; legacy mapping kept alive only for old URLs (`inbox-url.ts:46-65`).
- Assigned-folder empty-state "How It Works" button links to `/admin/crm` (the people list) — a placeholder destination (`InboxThreadList.tsx:91-93`).
- `getGroupReplyParticipants`'s `groupTo` support — documented but excluded by its own query filter (§4.4).
- `payload.group: true` — written by inbound only; outbound never; the asymmetry is load-bearing for the §4.4 bug.

---

## 13. Root causes (for the rebuild architect — facts, not design)

1. **No conversation/message entity.** Messages are person-keyed timeline rows; threads, groups, channels, and delivery state are all payload conventions with no schema, so every consumer re-derives (or drops) them differently.
2. **Server-action + redirect + force-dynamic as the only UI update mechanism.** Every mutation pays for the heaviest possible read path, and the client has no state machine for pending/sent/delivered/failed.
3. **Composer state lives in client components that survive the very navigation that is supposed to reset them.**
4. **Capabilities were built where they were requested, not on the shared model** — delivery badge on the person page, group recipients on the person page, media on the Comms tab, templates on mobile — so the inbox, the newest surface, shipped without all of them.
5. **Payload key conventions were never specified** (`twilioSid` vs `sid` vs `messageSid`; `group` vs `groupTo`), so cross-cutting features (receipts, group reconstruction) silently miss half the writers.
