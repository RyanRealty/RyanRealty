# Twilio Cutover — Audit + Build Plan (2026-06-24)

**Owner:** Matt Ryan (principal broker). **Goal (the bar):** FUB → in-house Twilio CRM, production-grade, every edge case handled.
1. All 3 brokers' correct business number shown in profile + site contact info, each forwarding to that broker's personal cell.
2. All Twilio features live: record calls, inbound/outbound SMS, voice forwarding, voicemail+transcription, outbound click-to-call.
3. Every text/email/call tracked in the lead's conversation timeline (capture is structural).
4. Clean cutover from FUB.

Method: 8-subsystem parallel audit (workflow `twilio-cutover-audit`) + live Twilio REST verification + live `brokers` table read + direct code read of every Twilio route.

---

## Live-verified ground truth (pulled this session, supersedes stale doc claims)

> **CORRECTION 2026-07-02 (supersedes two rows below):** Matt's line is now the ported
> primary **+1 541 703 3095** (`brokers.matthew-ryan.twilio_number`, migration
> `20260702090000_broker_primary_number_fix`) — +1 541 224 5025 is the retained
> legacy/spare line (`MARKETING_NUMBER`, do not release). And Paul's number below is a
> TYPO: the account owns **+1 541 502 3436** (501 was never owned). See the TELEPHONY
> entry in CRM_BUILD_MISSION.md PROGRESS.

| Fact | Status | Evidence |
|---|---|---|
| Twilio account | **Full / active** (not trial) | `GET /Accounts/{sid}` → type=Full |
| A2P 10DLC brand | **APPROVED / VERIFIED** | BrandRegistration BN6164…, status APPROVED |
| A2P campaign CD5597F | **VERIFIED** | Messaging Service Usa2p compliance → campaign_status VERIFIED |
| 4 numbers owned | Matt +1 541 224 5025 · Rebecca +1 541 250 3380 · Paul +1 541 501 3436 · **marketing +1 541 703 3095 (FUB line ALREADY PORTED)** | IncomingPhoneNumbers list |
| Webhooks | voice→`/api/twilio/voice`, sms→`/api/twilio/inbound-sms` on all 4, host `ryan-realty.com` (= production) | per-number config |
| Signature validation | **live** (unsigned POST → 403 invalid signature) | curl probe |
| Messaging Service "Ryan Realty CRM" | all 4 numbers attached; **StatusCallback = NONE** (gap) | Service config |
| `brokers.phone` (live) | Matt `(541) 703-3095` (FUB line), Paul `541-977-6841` (cell), Rebecca `(415) 308-9087` (SF cell) | brokers table |
| env `TWILIO_PHONE_NUMBER` = `…3617` | **STALE** — that number is NOT in the account; referenced nowhere in code | inspect + grep |

**Consequence:** the two longest-lead external blockers (A2P approval, number port) are DONE. The remaining work is all in our code + config.

---

## Consolidated punch list (deduped across 8 audits, reconciled to live truth)

### A. Broker identity + public site (Goal #1)
- **[BLOCKER] Dialed-number routing.** Inbound voice + SMS route by the *caller's* assignment, not `params.To` (the dialed line). A stranger calling Paul's published number forwards to **Matt's** cell. Fix: `brokerForTwilioNumber(e164)` reverse-map; resolve the dialed-line broker first; marketing line (3095) → default desk. (`app/api/twilio/voice/route.ts:54`, `inbound-sms/route.ts:53`)
- **[BLOCKER] No Twilio number shown on the public site.** Footer = Matt's direct 541.213.6706; contact + listing CTAs = 541.703.3095; team cards/signature = personal cells. The instrumented Twilio lines are invisible. (`SiteFooter.tsx`, `app/contact`, `lib/listing-cta.ts`, `components/site/BrokerCard.tsx`, `app/team/[slug]/page.tsx`, `lib/brand/contact.ts`, `lib/crm/email-signature.ts`)
- **[BLOCKER] No single source of truth (broker→Twilio→cell).** Mapping lives only in env; `brokers` has one generic `phone`. Fix: add `brokers.twilio_number`, `brokers.forward_to_cell`, `brokers.public_phone`; migrate env→DB; helpers read DB (env fallback). Update G38 (`check-broker-facts.mjs`).
- **[HIGH] Rebecca's 415 (SF) number shown publicly.** Replace display with her 541 Twilio line; keep 415 as `forward_to_cell`.
- **[MED] Hardcoded forward fallback `+15412136706`** — remove; missing forward → voicemail + config alert.

### B. Voice / recording
- **[BLOCKER] Recordings not playable in the UI** (owner's explicit ask). Lead page strips `payload` before `ConversationThread`; `getContactActivityFeed` drops `payload`. Fix: thread `recordingSid`/`transcript`/`durationSec` through; render `<audio src=/api/admin/crm/recording/{sid}>` + transcript in `ConversationThread` + `ContactActivityFeed`.
- **[BLOCKER] No outbound calling.** `tel:` dials from the personal device (unrecorded, untracked). Build `/api/admin/crm/call` → `POST /Calls.json`, dial lead from broker's Twilio line, record, pre-insert timeline row.
- **[BLOCKER/HIGH] Recording proxy authorizes any admin.** Scope to the assigned broker (principal sees all).
- **[HIGH] Signature validation skipped when `NODE_ENV!=='production'`.** Validate whenever `TWILIO_AUTH_TOKEN` is set; bypass only behind explicit dev flag.
- **[HIGH] `.or()` CallSid injection** in recording webhook — validate `^CA[a-f0-9]{32}$`.
- **[HIGH] Call/voicemail inserts not idempotent** (retry → unique violation). Upsert on `dedupe_key` + try/catch so TwiML always returns.
- **[HIGH] Two-party-consent.** Voicemail `<Record>` has no recording notice; broker-leg + outbound consent not handled; add consent to payload; add a `check-call-recording-consent` gate.
- **[LOW] voice-complete** uses lookup-only → unknown voicemail leaver dropped. Use find-or-create.

### C. SMS / MMS
- **[BLOCKER] StatusCallback dead** — no delivery visibility. Set Messaging Service `StatusCallback=/api/twilio/status` (one-time) + pass per-send.
- **[HIGH] Send-from model.** 1:1 composer sends via the pooled MS (any number), not the broker's own line → lead sees inconsistent number. Send from `brokerTwilioNumber(slug)` with StatusCallback.
- **[HIGH] Inbound SMS fires no new-lead alert** on `created` (voice does). Add it.
- **[HIGH] No quiet-hours (8a–9p TCPA)** guard in `sendCrmSmsAction` + sequence engine.
- **[HIGH] Inbound MMS media dropped.** Parse `NumMedia`/`MediaUrlN`, rehost to Supabase Storage, store `payload.media`, render in timeline.
- **[MED] STOP/HELP exact-word only; no HELP branch; A2P not fail-closed; A2P refetched 3×/send.** Leading-token match + HELP; treat null as not-verified; module-TTL cache.

### D. Email
- **[HIGH] Resend events not written to timeline** (delivered/open/click/bounce/complaint).
- **[HIGH] Bulk newsletter invisible on timeline** (no `email_out`, no pixel).
- **[HIGH] Unknown inbound email dropped** — auto-create lead or holding table.
- **[HIGH] Composer replies don't thread** — add In-Reply-To/References/threadId.
- **[MED] Transactional Resend sends bypass suppression + timeline; Gmail attachments discarded.**

### E. Cutover mechanics
- **[BLOCKER] No `CRM_LEAD_BACKEND` flag / `lead-router.captureLead()`** — cutover is a 14-file edit, not a flag flip. Native branch writes `crm_*` directly (no FUB round-trip).
- **[HIGH] FUB-primary entry points have no native fallback** (5 lead-capture forms, agents, home, tetherow/heath) — would drop leads at cutover.
- **[HIGH] FUB-polling crons** break at cutover — guard/retire/repoint.
- **[MED] FUB widgetbe pixel still loads; FUB export snapshot not confirmed archived.**

### F. Tests / gates / health
- **[BLOCKER] No e2e proof inbound call→recording→transcript→timeline.** Add route tests + scheduled probe + `recordingCaptureHealthy` signal.
- **[HIGH] `crm-e2e-verify.mjs` not scheduled.** Schedule nightly or fold Twilio checks into `crm-health-check`.
- **[HIGH] No `twilioReachable`/bad-creds health alarm.**
- **[HIGH] `check-twilio-config` gate** — require TWILIO_NUMBER_*/FORWARD_*/MESSAGING_SERVICE_SID/ELEVENLABS_API_KEY in `lib/env.ts`.
- **[HIGH] No route-level tests** for inbound sms/voice/email→timeline.

---

## FUB decommission — EXECUTED 2026-06-24 (Matt: "make it live + completely remove FUB incl. the pixel")

**Native is the live lead backend and Follow Up Boss receives zero traffic.** Done at the client seam so no lead is dropped and the build stays green:

- **Phase 1 — pixel removed** (e7e4c15c): FollowUpBossPixel deleted + dropped from the analytics stack; tracking-policy gate updated. First-party visitor_sessions is the replacement.
- **Phase 2 — native live, FUB API killed** (fd693a5f): `lib/followupboss.sendEvent` now captures NATIVELY via `ensureNativeLead` (audience inferred from event type + source tag + broker attribution) — it is the live capture seam, so every former caller writes to crm_people with zero edits. `getFubApiKey()` returns undefined → every other FUB function hits its keyless no-op path → ALL FUB API calls stop. `lib/crm/lead-router` default flipped to `native`. Tests updated.
- **Phase 3 — crons/routes/health removed** (26c4aa65): deleted crm-fub-delta (mirror), fub-outreach-execution, marketing-snapshot-fub crons + the /api/fub/* WordPress tracking routes; removed crm-fub-delta from vercel.json; retired the FUB-sync health rules (mirror-disabled + delta-stale — the latter would false-alarm forever with the cron gone).
- **Verified:** all 13 remaining `api.followupboss.com` fetch sites read `getFubApiKey()` and guard on it (keyless-safe pattern), so the kill switch = zero outbound FUB traffic. Source typechecks clean; gates green.

**Remaining = the literal dead-code scrub (a careful refactor, NOT a mechanical delete — deliberately not rushed):** `lib/followupboss.ts` is now the live NATIVE seam (sendEvent = native capture), so the ~58 callers' `sendEvent(...)` calls must be migrated to `captureLead(...)` (not deleted — deleting them would remove native capture) before the module + `lib/fub.ts` / `lib/fub-snapshot.ts` / `lib/canonical-lead-tagger.ts` / `lib/crm/mirror.ts` / `lib/crm/fub-env.ts` + the `ci:fub-env` gate can be removed. The FUB reporting/admin pages (fub-attribution, reports/lead-flow) read FUB → now empty → repoint to crm_* or remove (product call). `crm_people.fub_legacy_id` stays as the migration provenance key for the 18K mirrored contacts. This tail is inert (FUB is already dead); it is code hygiene, not function.

## Cutover runbook (the flip Matt owns)

The comms layer (Waves 1-6) is fully FUB-independent already (Twilio + crm_* +
Gmail + Resend). The remaining cutover is the LEAD-ENTRY backend, gated behind
`CRM_LEAD_BACKEND` (lib/crm/lead-router.ts `captureLead`, default `dual`).

**To flip (when the gate below passes):**
1. Repoint each lead entry point through `captureLead({ ...nativeFields, fub: <existing SendEventParams> })` — it already builds the FUB event; just pass it plus the native fields. Entry points: `app/actions/lead-capture.ts` (the 5 LP forms), `app/actions/lead-landing.ts`, `app/actions/agents.ts`, `app/actions/home.ts`, the Tetherow/Heath LPs, `app/api/meta/lead-webhook`, expired/FSBO detection crons. (Inbound SMS + voice already create native leads via findOrCreatePersonByPhone.)
2. Set `CRM_LEAD_BACKEND=dual` in Vercel and run the proving window.
3. When the gate passes, set `CRM_LEAD_BACKEND=native`. FUB writes stop; crm_people keeps filling with zero FUB dependency.
4. Retire/guard the FUB-polling crons (crm-fub-delta, marketing-snapshot-fub, buyer/seller-lead-attribution); remove the FollowUpBossPixel after confirming first-party visitor parity; archive the full FUB export.

**Cutover gate (all must pass):**
- [x] A2P 10DLC campaign VERIFIED (live-confirmed 2026-06-24)
- [x] 541.703.3095 ported into Twilio + webhooks live (live-confirmed)
- [x] Per-broker numbers on the public site, forwarding to each broker's cell
- [x] Inbound + outbound SMS/voice + recording captured to the timeline
- [x] Delivery receipts + STOP/HELP + suppression enforced on every send path
- [ ] 14 consecutive days of dual-write with zero reconciliation diffs on new leads
- [ ] All lead entry points repointed through captureLead (step 1 above)
- [ ] Hot-lead alert latency <= FUB push (measured)
- [ ] Full FUB export snapshot archived

## Build order (waves)
Waves 1-6 shipped (see progress log). Wave 7 = the cutover chokepoint (this section). Wave 8 = gates/health. Wave 9 = live end-to-end verification.

## Decisions (Matt, 2026-06-24)
1. **Public numbers:** per-broker Twilio lines shown publicly + 541.703.3095 as the brokerage brand line. Matt's 541.213.6706 → forward-only, off the site.
2. **Recording:** record both legs + announce, leave ON. Add voicemail notice + CI gate.
3. **Cutover:** build everything + dual-run; Matt flips the final switch.

## Progress log
- 2026-06-24 — Audit complete (8 subsystems + live Twilio/DB verification). Doc created.
- 2026-06-24 — **Wave 1+2 shipped** (commit b6427f2f — bundled by a concurrent-agent `git add -A`; code verified correct, on origin): brokers.twilio_number + forward_to_cell migration + backfill; getBrokerTelephony DAL; dialed-number routing in voice + inbound-sms; verifiedTwilioParams (signature in all envs, 403-not-500); idempotent crash-safe call/voicemail upserts; find-or-create in voice-complete; inbound-SMS new-lead alert; recording-webhook SID validation; voicemail recording notice. tsc 0 errors, 1346 tests pass, all static gates green.
- 2026-06-24 — **Wave 3 shipped**: public site now shows each broker's Twilio business line (getBrokers + getBrokerBySlug map twilio_number; BROKERS fallback roster updated); CONTACT brand line + footer + org JSON-LD → 541.703.3095; account page + KB footer/nav off Matt's old direct; brokerage_settings.primary_phone → brand line; G38 baseline ratcheted 16→13. Old per-broker cells now private (forward_to_cell only). NOTE: deferred to Wave 6 — CMA/digest/rental-PDF email + video comms still show 541.213.6706, repoint to the Twilio brand line there.
- NOTE: a concurrent agent/Cursor session is committing to this same checkout (shared working tree). Some of my work landed under its commit messages. Code is correct + on origin; flagged for Matt.
- 2026-06-24 — **Wave 4 shipped**: recording playback in the lead timeline + ContactActivityFeed (inline audio + transcript), recording proxy ownership-scoped to the assigned broker, outbound click-to-call (startCrmCallAction + /api/twilio/outbound-bridge, records both legs), Call button now Twilio-tracked. DAL-refactored (getRecordingOwnerBroker, getOutboundCallLead).
- 2026-06-24 — **Wave 5 shipped**: StatusCallback on every send (delivery receipts now flow), A2P cached + fail-closed, 1:1 composer sends from the broker's own line, TCPA quiet-hours lib (manual override + sequence-engine hard gate), inbound MMS capture + ownership-scoped media proxy + inline render, STOP/HELP leading-token matching.
- 2026-06-24 — **Wave 6 (core) shipped**: Resend events (delivered/opened/clicked/bounced/complained) now mirror onto the contact conversation timeline (deduped). Gmail sync already writes email_in/email_out, so inbound+outbound email is tracked for known contacts. Bounce/complaint already auto-suppress.

- 2026-06-24 — **Wave 7 shipped**: CRM_LEAD_BACKEND cutover chokepoint (lib/crm/lead-router.ts captureLead, default 'dual'), tested. Runbook + gate checklist above.
- 2026-06-24 — **Wave 8 shipped**: ci:call-recording-consent gate (locks the TwiML "recorded" announcement, wired into ci:gates) + twilioReachable health alarm (Rule 6, critical) so a rotated token pages within one cron cycle. Extracted getSendTarget DAL (app/actions reads 275→273).
- 2026-06-24 — **Wave 9 (verify)**: LIVE end-to-end on production — all 6 Twilio webhooks return 403 unsigned (signature live), the new outbound-bridge + MMS proxy deployed, MMS proxy 401 unauthed. **Signed inbound-SMS round-trip PASSED**: created lead #52255 source inbound-sms, assigned_broker=matt (routed by the dialed line = Matt's Twilio number — dialed-number routing confirmed live), sms_in timeline row + new-lead alert + task; test data cleaned up (one labeled test alert email to matt@ is the only residual). Public team pages: Matt shows his Twilio line + brand line, no old direct. Rebecca/Paul served a stale per-slug data-cache (old cells) post-deploy → fixed by bumping broker cache keys (broker-by-slug-v1→v2, brokers-v2→v3) so the deploy orphans stale entries. tsc 0 errors, 1360 tests pass, all static gates green.

**Status: comms layer is production-grade and live-verified. Remaining = the lead-entry flip (Matt owns, runbook above).**

### Final adversarial review (independent agent) — dispositions
- **FIXED [prod bug]** /team pages render via `getAgentBySlug`→`getBrokerBySlug` in `app/actions/brokers.ts` (a different fn than the lib/data one Wave 3 updated), so Rebecca's 415 + Paul's old cell were live. Added twilio_number + `withPublicPhone()`; the fn is uncached so it fixes prod on deploy.
- **FIXED [HIGH]** recording + MMS proxies failed OPEN for a non-superuser with no broker slug (report_viewer) → blanket access to every contact's audio/MMS. Now fail closed (null slug = 403).
- **FIXED [HIGH]** recording webhook not idempotent (Twilio retry → re-transcribe + dup email + transcript wipe). Added already-processed short-circuit + never-null-body.
- **FIXED [MED]** stripped private `forward_to_cell` from lib/data BROKER_FULL_SELECT (latent client leak).
- **Tracked follow-ups (real, lower-risk):** per-recipient-tz quiet hours (today Pacific-default; out-of-state automated sends under-protected); click-to-call insert-after-call race (near-zero practical risk); inbound dup-lead race on a brand-new number hit by 2 simultaneous webhooks (rare; merge tool exists; a global unique index is wrong since spouses share numbers); sequence engine should import the shared quiet-hours lib.
- **Confirmed correct by review:** dialed-number routing, recording `.or()` injection-safety, A2P fail-closed + StatusCallback-on-every-send, the forward-only SMS delivery state machine, slug-present recording/MMS ownership, dedupe_key NULL handling, the consent gate.

### Wave 6 documented follow-ups (tracked, not blocking the cutover)
- Unknown-sender inbound email → auto-create a lead (or holding table) excluding automated/blocked domains. Today the Gmail sync only matches existing contacts; a brand-new emailer is not captured (FUB's inbox parser used to). Needs spam-safe sender filtering.
- CRM email composer reply threading (In-Reply-To / References / Gmail threadId) so replies continue the client's thread instead of starting a new one.
- Gmail attachment metadata capture (payload.attachments chip).
- Per-broker phone in transactional comms signatures (CMA deliver/request, digest, inbox-reply, rental-PDF still carry the old direct line 541.213.6706 → repoint to the broker's Twilio line / brand line).
