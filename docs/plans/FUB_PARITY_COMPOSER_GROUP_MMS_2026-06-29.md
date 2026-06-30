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
