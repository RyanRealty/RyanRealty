# FUB parity — composer + group MMS (progress, 2026-06-29)

Mission (Matt): every CRM feature works like Follow Up Boss. This doc tracks the
text/email composer + group-MMS thread, driven by Matt's FUB screenshots
(IMG_6005–6011).

## ✅ Shipped + verified

- **FUB SMS input bar** (`SmsComposer.tsx`, commit 7063ec2e). One rounded chat bar:
  `+` (reveals merge fields) · "Text message · SMS" · round send arrow (muted when
  empty, primary on input). Dropped the separate preview bubble. Recipient/group
  chips above; quiet-hours + segment count below. Verified at 375px.
- **Email "To" row** (`EmailComposer.tsx`, commit 496634c5). Shows "Name · email"
  above Subject (FUB IMG_6009). Verified at 375px.
- **Group-text recipients** (earlier, commit fbb7479b). The composer lists the lead
  + every linked person with a phone (spouse, …) as toggle chips by default — no
  typing. Verified end-to-end (chip toggles into the hidden recipientIds).
- **Native group MMS send** (`lib/crm/twilio-conversations.ts` + `sendCrmSmsAction`,
  commit 634ceb57). 2+ recipients → one Twilio Conversation, every phone bound to
  the broker's MMS proxy, one group message → recipients share a real group thread.
  Falls back to the 1:1 broadcast if the group can't form (member out of
  scope/suppressed/no phone, no proxy, or Twilio rejects a binding). The
  single-recipient path is unchanged.
  - **Verified at the Twilio API level**: create conversation + bind 2 participants
    to `+15417033095` + post a group message — all accepted, then cleaned up. Our 4
    numbers are MMS-capable; a Default Conversations Service exists.

## ✅ FUB relationships + messages → CRM (reconciliation, 2026-06-29)

- **Comms tab now shows the FULL history** (commit 178efc1b). Was capped at the
  latest 40 of a 100-row timeline window — older texts/emails (incl. group texts)
  looked lost. New `getContactConversation` DAL + `loadContactConversation` action +
  a "Load older messages" pager walk the whole history, newest first, texts + emails
  + calls interleaved. Verified on lead 13014 (423 texts + 120 emails): 50 → 100 →…
- **Messages are fully synced** — spot-checked Kevin Hoffman: FUB 423 texts = our 423;
  emails 120 (≥ FUB's 100, we also hold Gmail-synced). Totals: 2,850 texts, 41,748
  emails in `crm_timeline`. No destructive migration was run — nothing deleted.
  Group texts are stored per-participant as `sms_in/out` rows, so they're preserved
  and now visible via the full-history Comms tab.
- **Relationships imported + labels fixed** (commit 84be3855). 29/30 FUB
  `peopleRelationships` in `crm_relationships`; the 1 skip is a related person whose
  FUB contact isn't in our CRM. Kinds were raw FUB strings (Spouse/Husband/Wife/
  Daughter/"") → none matched our vocab → all rendered "Other". Normalized to
  spouse(9)/child(1)/other(19) in both the main import and a one-off remap.
  `related_person_id` stays null by design — FUB's endpoint exposes the related
  person's info but no usable counterparty id, so a second-contact link can't be
  derived from it. Relationships render via `related_name` + correct label.
- **Relationship linking is now a name search** (commit bd664e76) — no more contact-id.

## ✅ Telephony + contact-page parity (2026-06-30)

- **Contact page is FUB-tabbed on desktop** (commit 990e6926). The real "legacy UI"
  Matt saw: `/admin/crm/[id]` (where 25+ links point) redirects to the contact-360
  page, which on desktop hid the tabs and dumped every section into a cramped
  3-column grid. Now the tabs show on every breakpoint and one focused section
  renders, centered in a max-w-3xl column — the FUB experience mobile already had.
- **Spam blocking** (commit acf1d362). `crm_blocked_numbers` table; inbound voice
  webhook hard-rejects blocked callers, inbound SMS drops their texts. StirVerstat
  (SHAKEN/STIR) low-attestation calls are flagged `spamSuspected` on the timeline
  (optional auto-reject via `CRM_AUTO_BLOCK_SPAM_CALLS`). Comms feed shows a
  "Possible spam" badge + a one-tap "Block this number" on inbound calls/voicemails.
- **Caller-ID names via Lookup** (commit 24fe75d3). New inbound-call leads get their
  CNAM name + line type from Twilio Lookup via `after()` (never blocks the dial);
  placeholder "Call lead 555…" names are replaced with the real name.
- **VM/call transcripts: already working** — 17 of 18 recordings transcribed
  (ElevenLabs scribe → `crm_timeline.body`), and they render in the Comms feed. The
  earlier "0 transcripts" reading was a query bug (looked in payload, not body).
- **Outbound caller ID: already correct** — calls go out from the broker's own
  business line, which is the callerId the lead sees.

## ⏳ Needs a live test (Matt's real phones — I can't do this autonomously)

- **Group MMS delivery**: confirm two real mobile numbers actually receive ONE group
  thread (and can reply to each other). Send a group text from a lead with a linked
  spouse to two phones you control and confirm the thread shows everyone.

## ⏭️ Remaining increments (FUB parity, not yet built)

1. **Inbound group-reply logging.** Configure the Conversations service webhook
   (`onMessageAdded`) → an endpoint that resolves the conversation SID (stored in the
   `crm_timeline` payload of the group send) to the CRM people and logs replies.
   Without this the group thread works on the recipients' phones but replies don't
   appear in the CRM. Needs a live inbound test.
2. **Email CC/BCC** (FUB IMG_6009 has CC/BCC). Needs send-side support in
   `sendCrmEmailAction`.
3. **"•••" → Start a group message / Select Recipients** (FUB IMG_6010/6011). We
   already add people via the composer chips; this is the alternate FUB entry point.
4. **AI template chips** (Introduction / Follow Up / Still Buying / Nurture Lead).
   We have templates via `TemplatePickerNav`; FUB's are AI-generated per contact.

## Notes
- Twilio: `TWILIO_NUMBER_*` per broker + `TWILIO_MESSAGING_SERVICE_SID`; A2P 10DLC
  verified. Group MMS uses the broker's number as the proxy.
- Constraint: a phone can be in only ONE conversation per proxy at a time — the
  fallback handles the "already bound" rejection. Inbound + reuse logic will need to
  find/close stale conversations; track when building increment 1.
