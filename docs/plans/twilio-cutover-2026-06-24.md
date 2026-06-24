# Twilio Cutover — Audit + Build Plan (2026-06-24)

**Owner:** Matt Ryan (principal broker). **Goal (the bar):** FUB → in-house Twilio CRM, production-grade, every edge case handled.
1. All 3 brokers' correct business number shown in profile + site contact info, each forwarding to that broker's personal cell.
2. All Twilio features live: record calls, inbound/outbound SMS, voice forwarding, voicemail+transcription, outbound click-to-call.
3. Every text/email/call tracked in the lead's conversation timeline (capture is structural).
4. Clean cutover from FUB.

Method: 8-subsystem parallel audit (workflow `twilio-cutover-audit`) + live Twilio REST verification + live `brokers` table read + direct code read of every Twilio route.

---

## Live-verified ground truth (pulled this session, supersedes stale doc claims)

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

## Build order (waves) — see decisions below
Filled in once Matt confirms the 3 forks (public-number model, recording posture, cutover aggressiveness).

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

### Wave 6 documented follow-ups (tracked, not blocking the cutover)
- Unknown-sender inbound email → auto-create a lead (or holding table) excluding automated/blocked domains. Today the Gmail sync only matches existing contacts; a brand-new emailer is not captured (FUB's inbox parser used to). Needs spam-safe sender filtering.
- CRM email composer reply threading (In-Reply-To / References / Gmail threadId) so replies continue the client's thread instead of starting a new one.
- Gmail attachment metadata capture (payload.attachments chip).
- Per-broker phone in transactional comms signatures (CMA deliver/request, digest, inbox-reply, rental-PDF still carry the old direct line 541.213.6706 → repoint to the broker's Twilio line / brand line).
