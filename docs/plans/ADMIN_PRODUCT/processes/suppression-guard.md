# Process: suppression-guard — Outbound compliance gate

## 0. Meta
- Status: deepened
- Cadence: continuous (fires on every outbound attempt)
- Verdict: KEEP (proposed; P3 decides) — compliance law, not preference. CLAUDE.md §0/§1 + TCPA outrank every other rule.
- Last evidence pass: 2026-08-04 · commit 21e2c63b

## 1. Purpose
Every client-facing outbound send either passes the compliance gates (suppression, quiet hours, A2P, hard-stops) or is blocked/rescheduled with a recorded reason. Wrong numbers / double SMS are compliance failures for a licensed brokerage.

## 2. Inception (what starts it)
- Trigger type: system condition (evaluated at every send attempt)
- Concrete triggers — every outbound path:
  - Sequence email step — `crm-sequence-engine/route.ts:201-207`
  - Sequence SMS step — :315-321 (suppression), :394 (quiet hours), :392-470 (A2P)
  - Governed 1:1 SMS — `lib/comms/sendGovernedSms.ts:30-101` via `checkSendGuards()` (`lib/comms/guards.ts:28-49`)
  - Group MMS — inline per-recipient suppression `app/actions/crm.ts:852`
  - Bulk cohort jobs — crm-bulk-worker path
  - Market-report send — `lib/crm/market-report-send.ts` (fail-closed inside)
  - Newsletter drain — re-checks suppression at send time (`newsletter-send/route.ts:25`)
- List-maintenance triggers: STOP/START keywords (`inbound-sms:194-218`), broker UI (`/admin/crm/settings/suppression` add/lift), block-list (`/admin/crm/settings/company/block-list`), no-sms-consent at enrollment (`lib/crm/enroll.ts:297-305`).
- Entry evidence: `crm_suppressions` table; `lib/crm/suppressions.ts:31-57` (`isSuppressed`, FAIL-CLOSED — a read error blocks the send).

## 3. Actors
- Human: broker maintaining lists; the contact (STOP/START).
- Automated: guard functions inside every send path; A2P status checker.
- Accountable: system (gates are code); Matt as PB for the policy.

## 4. Systems of record
- `crm_suppressions` — channel-scoped (sms | email | all) + reason (`stop-keyword`, `no-sms-consent`, hard-stop).
- Blocked-numbers list (`getCrmBlockedNumbers`) — inbound-side drop list.
- A2P campaign status — Twilio (read via `getA2pCampaignStatus`).
- TCPA litigator/DNC flags — stored on prospect records (BatchData skip-trace; hard-stop per memory).
- NOT SoR: any per-surface copy of "can I text this person" — the gate functions are the only truth.

## 5. End-to-end path (a send attempt)
1. **Hard-stop check** · system · `checkSendGuards()` stage 1 — hard-stop suppressions (channel `all`) · `lib/comms/guards.ts:28-49` · failure: none (fail-closed) · n/a
2. **Channel suppression** · system · `isSuppressed(person, channel)` — DB error ⇒ treated as suppressed (fail-closed by design) · `lib/crm/suppressions.ts:31-57` · n/a
3. **Quiet hours** · system · `inSmsQuietHours()` (`lib/crm/quiet-hours.ts:23-26`) — automated: reschedule via `nextSendWindow()`; manual 1:1: override permitted (`crm.ts:788-793`); sequence email uses LA-hours window 7–19 (`engine:197-199`) · n/a
4. **A2P gate (SMS)** · system · VERIFIED → Twilio send; else fallback email body, else visible queue row in `crm_timeline` · `engine:392-470` · n/a
5. **Daily cap (sequence SMS)** · system · `SEQ_SMS_DAILY_CAP` (default 500) counted from trailing-24h `sms_out` `source='sequence'` · `engine:86-93,397-402` · n/a
6. **Merge-token guard** · system · unresolved `%token%` → enrollment `stopped`, never leaks · `engine:284-290` · n/a
7. **Idempotency** · system · `withSendIdempotency()` (`lib/crm/idempotency.ts`); sequence at-most-once via `claimSend()` unique `(enrollment_id, step_index)` (`engine:120-129`) · n/a
8. **Send or record-block** · system · pass → Twilio/Gmail/Resend + `crm_timeline`; block → suppressed/rescheduled status on the attempting artifact · n/a
9. **List maintenance** · human+system · STOP adds, START lifts (stop-keyword scope ONLY — a broker-added suppression survives a START) · `inbound-sms:194-218`; UI add/lift `addSuppressionAction`/`liftSuppressionAction` · either device

## 6. Decision points
- Hard-stop? → block always, every channel.
- Channel suppressed? → block that channel; others may pass.
- Quiet hours? → automated reschedule vs manual-1:1 override (deliberate asymmetry).
- A2P not VERIFIED? → email fallback → visible queue (never silent).
- Cap hit? → reschedule to next window.
- DB unreachable? → FAIL CLOSED (no send).
- Litigator/DNC flag (prospecting)? → hard-stop, no outreach (memory: TCPA litigator handling).

## 7. Completion
- Done-when (per attempt): send executed with timeline row, OR blocked/rescheduled with a recorded, queryable reason.
- Artifacts: timeline row or status on enrollment/job/alert row.
- Signals: A2P-queued rows are visible in timeline; suppression counts on `/admin/crm/health`.
- Terminal states per attempt: sent · suppressed · rescheduled · stopped (token guard) · capped.

## 8. Time & SLA
- Gate evaluation is synchronous (ms). Quiet-hour reschedules land next window (SMS ~8am; email 7–19 LA).
- "Late" does not apply; "leaked" is the failure that matters — zero tolerance.

## 9. Variants
- Channel: SMS · email · group MMS (inline check — WEAKER: bypasses `sendGovernedSms`, no idempotency stage; defect) · broker alerts EXEMPT by design (internal, whitelist-guarded instead — broker-alert §5.8).
- Origin: sequence · manual · bulk · cadence sends (market report) · newsletter · prospecting outreach (adds litigator/DNC + manual-first-touch rules).

## 10. Current implementation map
- Routes: `/admin/crm/settings/suppression`, `/admin/crm/settings/company/block-list`, `/admin/crm/settings/company/registration` (A2P status), `/admin/crm/health` (counts).
- Actions/libs: `guards.ts`, `suppressions.ts`, `quiet-hours.ts`, `sendGovernedSms.ts`, `idempotency.ts`, engine gates, STOP/START handler.
- Known defects: (a) group MMS bypasses the governed chokepoint (`crm.ts:838-914`) — suppression inline but no idempotency; (b) gates are per-path composition, not one enumerated pipeline — each new send path must remember every gate (the class of bug G-gates exist for); (c) blocked-number list (inbound) and suppression list (outbound) are separate concepts sharing one settings area — easy to confuse.
- Duplicate paths: none send-side beyond MMS; concept duplicated across settings surfaces.

## 11. Target shape (process-level, not pixels)
- Should exist: YES — law.
- Ideal: ONE enumerated guard pipeline every channel calls (MMS included); every block writes a queryable reason row; suppression + block-list + A2P + litigator status visible as one per-person "can we contact?" answer.
- Data gaps: block-reason audit rows for gate-drops outside sequences; per-person contactability view.
- UI destination implication: background automation + one compliance panel (settings/health), not a daily destination.

## 12. Acceptance checks
- [ ] Text STOP → `crm_suppressions` sms row (stop-keyword); sequence SMS to that person → enrollment `suppressed`, no Twilio call.
- [ ] START after broker-added suppression → broker suppression SURVIVES (scope check).
- [ ] Manual 1:1 SMS in quiet hours → allowed with override flag; sequence SMS same window → rescheduled, `next_run_at` in window.
- [ ] Kill DB access in a test env → `isSuppressed` error ⇒ send blocked (fail-closed proof).
- [ ] Group MMS to a mixed cohort → suppressed member excluded (and note idempotency gap until fixed).
- [ ] A2P status forced non-VERIFIED in test → SMS step lands as visible queue/email fallback, never silent drop.
