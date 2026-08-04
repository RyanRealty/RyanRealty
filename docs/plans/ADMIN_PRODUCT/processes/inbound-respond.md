# Process: inbound-respond — Human responds to inbound

## 0. Meta
- Status: deepened
- Cadence: daily (multiple times per day; phone-first per Matt Q1/Q3)
- Verdict: KEEP (proposed; P3 decides) — one of Matt's three wake-up triggers ("reply on an existing thread: read context, reply. Speed over data.")
- Last evidence pass: 2026-08-04 · commit 21e2c63b

## 1. Purpose
A broker reads an inbound message (SMS or email) in context and sends the first human reply fast, from whichever device they're on.

## 2. Inception (what starts it)
- Trigger type: inbound event
- Concrete triggers:
  - Inbound SMS to a business line — `app/api/twilio/inbound-sms/route.ts` (signature verify :105-106 → blocked-number gate :116-117 → person match :155-160)
  - Inbound email — `crm-gmail-sync` cron (9,24,39,54 * * * *) pulls 3 broker mailboxes → `crm_timeline` `email_in` — `lib/crm/gmail.ts:206-376`
  - Portal lead email (Zillow/Realtor.com) — `crm-portal-lead-intake:94-151` (converts to lead; reply is this process)
  - Broker-alert deep link (new-number SMS fires an alert — broker-alert §5.10)
- Preconditions: message matched to a person (`findOrCreatePersonByPhone` / `loadEmailPersonMap`); broker resolvable (dialed-line broker else `assigned_broker`).
- Entry evidence: `crm_timeline` `sms_in`/`email_in` rows; conversation shadow-write via `recordConversationMessage` (`lib/crm/record-message.ts`).

## 3. Actors
- Human: assigned broker (accountable). Matt as PB can see all books.
- Automated: inbound SMS route, Gmail sync, reply-intent classifier (`lib/crm/reply-intent.ts:250-265` call site, kill switch `CRM_REPLY_INTENT_DISABLED`, fail-open), task creator, real-time cell forward.
- Accountable for completion: the broker who owns the thread.

## 4. Systems of record
- `crm_timeline` — canonical message log (dedupe `twilio:{sid}:p{personId}`; `email_in`/`email_out`).
- Conversation model (shadow-write) — inbox threading + unread state (`markConversationUnreadOnInbound` — inbound-sms :191).
- `crm_tasks` — reply-followup tasks (dedupe `twilio-task:{sid}:p{id}` — :304-349).
- NOT SoR: the broker's personal cell thread (forward copy only — :366-379); Gmail itself (mirrored into timeline).

## 5. End-to-end path (inception → completion)
1. **Message arrives** · system · Twilio POST verified (`verifiedTwilioParams`, 403 on fail) · :105-106 · failure: forged request rejected · n/a
2. **Blocked-number gate** · system · `isNumberBlocked(from)` → silent TwiML end · :116-117 · n/a
3. **Broker-cell / agent branch** · system · `isBrokerForwardCell()` → broker SMS agent (`handleAgentInbound`, flag-gated) or silent drop — never becomes a lead · :128-144 · n/a
4. **Person match** · system · dialed-line broker via `brokerForTwilioNumber(to)`; `findOrCreatePersonByPhone()` find-or-create · :155-160 · failure: wrong match = compliance risk (mis-threaded history) · n/a
5. **Store + thread** · system · `crm_timeline` upsert `sms_in` (dedupe key) + conversation shadow-write + unread set · :163-191 · failure: dedupe collision = intended idempotency · n/a
6. **STOP/START/HELP** · system · STOP → `addSuppression({channel:'sms', reason:'stop-keyword'})`; START → `removeSuppression` (stop-keyword scope only) · :194-218 · handoff to suppression-guard · n/a
7. **Alert if new** · system · `queueBrokerAlert()` only when `created===true` (else no wake-up — reply-on-thread relies on forward + inbox badge) · :220-242 · **gap: a reply on an existing thread does NOT queue a broker alert** — it forwards to the cell (step 9) but has no push/deep-link rail · n/a
8. **Classify + task** · system · `classifyInboundReply()` fail-open; upsert `crm_tasks` + `sendCrmEmail()` to assigned mailbox · :250-349 · n/a
9. **Cell forward** · system · AWAITED `sendSms()` business line → `forwardCellForBroker()`, STOP/START/HELP never forwarded · :366-379 · failure: forward fails silently → broker may never see it if inbox unchecked · n/a
10. **Broker reads in context** · human · `/admin/crm/inbox` — thread (`getConversationThreadFull`), contact card, drafts, templates · either device (phone per Matt Q3)
11. **Broker replies** · human · 1:1 SMS `sendCrmSmsAction` (`app/actions/crm.ts:743-960`) through `sendGovernedSms` chokepoint (guards → idempotency → Twilio → timeline `sms_out` + shadow-write — `lib/comms/sendGovernedSms.ts:30-101`); email reply via inbox composer → Gmail → next sync mirrors `email_out` · failure: quiet-hours block (manual override allowed for 1:1 replies — `crm.ts:788-793`) · **phone or desktop**
12. **Sequences pause** · system · engine's stop-on-reply: any `sms_in`/`email_in`/`call`/`voicemail` since enrollment → `paused_reply` (`crm-sequence-engine/route.ts:133-146`) · n/a

## 6. Decision points
- Blocked number? → drop silently (2).
- Broker's own cell? → agent/drop branch, never a lead (3).
- New person? → lead-ingress + broker-alert fire; existing → forward-only (7) — the asymmetry is the biggest gap.
- STOP keyword? → suppression before anything else user-visible (6).
- Quiet hours on reply? → manual 1:1 override permitted; automated sends never (11).
- Unknown-sender email? → portal-intake conversion or unmatched (stays out of timeline).

## 7. Completion
- Done-when: first outbound reply logged (`sms_out` in timeline / `email_out` mirrored) OR broker explicitly dismisses; unread cleared; task closed.
- Artifacts: reply row + updated conversation state (+ paused enrollment when applicable).
- Signals: unread badge clears; task completion.
- Terminal states: replied · dismissed/no-action · handed-off (e.g. became cma-deliver kickoff).

## 8. Time & SLA
- Broker budget: Matt's own bar is "speed over data" — minutes, phone. Speed-to-lead report measures lead→first-touch; **nothing measures reply-to-inbound latency on existing threads**.
- System budgets: SMS ingest real-time; email up to 15 min behind (sync cadence).
- "Late": invisible today — no SLA surface for unanswered inbound. Gap.

## 9. Variants
- SMS reply · email reply · portal lead first-response · missed call/voicemail (timeline `call`/`voicemail` rows trigger stop-on-reply but have no inbox lane — verify in P4) · group MMS (bypasses `sendGovernedSms`, per-recipient suppression inline — `crm.ts:838-914`). Same process; channel variants only.

## 10. Current implementation map
- Routes: `/admin/crm/inbox` (607-line page; `getInboxQueue`, `getConversationThreadFull`, `getInboxContactCard`, `getDraftsForPerson`, `getSendTarget`), `/admin/crm/[id]`, `/admin/broker-dashboard` (inbound triage: `getInboundTriage`, `confirmNextStepAction`, `dismissTriageItemAction`), `/admin/crm/tasks`, `/admin/crm/calendar`.
- Crons: crm-gmail-sync, crm-portal-lead-intake, crm-task-reminders.
- Known defects: (a) reply-on-existing-thread has no alert rail (forward-only); (b) no reply-latency measurement; (c) email lag up to 15 min; (d) forward failure is silent; (e) FUB-imported historical texts have no body (2,680 rows — memory) so old context is holey.
- Duplicate paths: inbox vs person record vs broker-dashboard triage all render thread slices; cell-forward thread is a fourth uncontrolled copy.

## 11. Target shape (process-level, not pixels)
- Should exist: YES — the response half's core loop.
- Ideal: one thread surface (phone-first) with history above composer (Matt Q3 verbatim); reply-on-thread joins the alert rail as a wake-up trigger (Matt Q1 says it wakes him — today it only forwards to his cell); reply latency measured per thread.
- Data gaps: reply-latency stamp; voicemail/call lane in inbox; historical SMS bodies (unrecoverable — display honestly).
- UI destination implication: ONE primary inbox destination; person record is context, not a second inbox.

## 12. Acceptance checks
- [ ] Inbound SMS from a known number → timeline `sms_in` + unread set + cell forward received; NO duplicate on Twilio retry (same sid).
- [ ] Inbound SMS from a new number → person created + broker alert queued (see broker-alert checks).
- [ ] STOP then START → suppression added then lifted (scope stop-keyword only), neither forwarded to the cell.
- [ ] Reply from inbox on phone → `sms_out` in timeline, conversation marked read, enrolled sequence flips `paused_reply`.
- [ ] Reply during quiet hours as manual 1:1 → allowed with override; sequence/automated send in same window → rescheduled.
- [ ] Email from a tracked mailbox contact → `email_in` visible in inbox within 15 min.
