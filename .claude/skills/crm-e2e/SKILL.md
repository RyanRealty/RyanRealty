---
name: crm-e2e
description: Run ONE iteration of the CRM end-to-end guardian — verify every CRM feature is wired into the website and working end to end (data, crons, sync freshness, auto-enrollment coverage, web surfaces, Twilio, Gmail, compliance gates, external blockers), FIX what fails, ship the fix, and stay quiet when green. Use when Matt says "/crm-e2e", "verify the CRM", "is the CRM healthy", or when a /loop firing carries this protocol.
---

# CRM E2E Guardian — one iteration

You are the guardian of the in-house CRM (the FUB replacement; canonical state
in memory `project_crm_replacement_initiative` and
`docs/CRM_REPLACEMENT_BLUEPRINT.md`). One iteration = probe → repair → report.
Matt's bar: **every feature wired into the website, everything works end to
end, nothing requires him to do manual work the system could do.**

## Step 1 — run the battery

```bash
node scripts/crm-e2e-verify.mjs        # probes PRODUCTION (~2-4 min)
```

~30 checks: data layer, live invocation of the production CRM crons
(auto-enroll, sequence-engine, gmail-sync, portal-lead-intake, geo-resolve),
sync freshness, FUB mirror spot-reconciliation, auto-enroll coverage (no
eligible new lead left unenrolled), geo-resolve coverage (no resolvable
contact left geo-invisible), community-list undercount (the 593f5fe4 class,
via health Rule 7), engine stalls, owner-resolution coverage, admin surfaces
(auth-redirect + anonymous-leak check), Twilio webhooks + balance + A2P brand
state, Gmail DWD auth for all 3 broker mailboxes, the suppression gate, static
entry-point wiring, Anthropic credits, FUB port-reply watch. JSON lands at
`tmp/crm-e2e-latest.json`.

## Step 2 — act on results

**All PASS (warns only from the KNOWN EXTERNALS list below):** say one short
line ("CRM e2e green, N checks") and end the iteration. No essays when green.

**Any FAIL:** fix it THIS iteration, in priority order:
1. **Lead-loss risks first**: cron routes erroring, auto-enroll coverage gaps,
   inbound webhook guards down, FUB mirror lag, contact-point table anomalies.
2. **Comms correctness**: engine stalls, suppression gate not blocking,
   sequence misconfiguration.
3. **Surface/auth**: admin pages failing, data leaking to anonymous visitors
   (treat a leak as a drop-everything incident).

Repair rules: diagnose with logs/DB/direct API calls; fix the CLASS, not the
instance; re-run the battery to prove the fix; commit + push (single-checkout
`main`, rebase with autostash, pathspec-scope commits to your files — a
parallel session often shares this working tree). When a regression class
repeats, ADD A CHECK to `scripts/crm-e2e-verify.mjs` in the same commit
(gates-not-prose).

**WARN transitions:** a warn NOT on the known-externals list means something
degraded — investigate it like a FAIL.

## Step 3 — watch the external blockers (state changes unlock work)

Current known externals (update this list as they clear):
- `external.anthropic-credits` OUT OF CREDITS → when it flips PASS: trigger
  `/api/cron/crm-smart-followups` once (CRON_SECRET auth), confirm drafts +
  digest landed, tell Matt smart follow-ups are live.
- `twilio.a2p-brand` no brand → the console wizard needs the Chrome extension
  on the mac mini (drive it per memory: select browser "mac mini matt logged
  in"; all values staged in `scripts/crm-a2p-register.mjs` BIZ block). When
  brand status = APPROVED: re-run `node scripts/crm-a2p-register.mjs` to
  create the LOW_VOLUME campaign, then announce outbound texting is live.
- `external.fub-port-reply` → when FUB replies about 541.703.3095: read the
  message, execute the Twilio account-to-account transfer steps, webhook the
  number like the others (inbound-sms + voice), and update the blueprint.

## Hard rules (never violate, even mid-repair)

- **Never mass-enroll the historical book** — `ENROLLMENT_EPOCH` in
  `lib/crm/enroll.ts` is load-bearing.
- **Never auto-send client comms outside the active sequences** — smart
  follow-ups stage drafts; brokers send.
- **Suppressions are sacred**: any fix touching send paths must keep the
  fail-closed `isSuppressed` gate in front of every send.
- **Clean up synthetic test artifacts in the same iteration** (test people,
  test notes — in BOTH systems when dual-written).
- Parallel-run integrity: FUB stays untouched as the fallback until Matt
  triggers the blueprint §7 cutover gate.

## Loop pacing (when running under /loop self-paced)

Green iteration → next check in 30–60 min. Just-fixed something → re-check in
10–15 min. Waiting only on externals → 60 min is fine. Always leave a
heartbeat wakeup so the loop survives.

## GRIND SEMANTICS (Matt directive 2026-06-10 — overrides any "one iteration" language above)

**A firing does not stop after one increment.** Chain iterations back-to-back — ship one, immediately pick the next — until one of these is true: (a) every remaining increment is blocked on Matt's review or an external dependency, (b) nothing actionable remains, or (c) the session's context is nearly spent — then finish the in-flight commit, write the handoff, and spawn a fresh session that keeps grinding (per memory `feedback_continuous_work_and_handoff`). Sleeping between wake-ups is for the BLOCKED state only. "Did something then stopped" is the named failure mode this section exists to prevent. Time is of the essence — Matt should never find a loop idle while unblocked work exists.

## PRIORITY INPUT — Matt 2026-06-11: "the CRM is not working, I need to communicate with my leads"

Three-part directive, outranks the routine battery:
1. **Comms broken (P0):** Matt cannot communicate with leads. Battery shows A2P campaign IN_PROGRESS (submitted 2026-06-10) — outbound SMS is carrier-constrained until verification. VERIFY the actual send paths end-to-end TODAY: (a) email send from the CRM inbox UI as a broker, (b) SMS via the Twilio messaging service, (c) what the UI shows the broker when a send fails (silent failure = the worst case). If A2P is the blocker, surface its status + ETA in the CRM UI banner so brokers know WHY texts are held, and confirm email path works as the fallback. Report concrete findings.
2. **Layout confusing:** brokers can't tell what's going on. Redesign the CRM around one question: "what needs my attention right now?" — lead-centric inbox with unified timeline (email+SMS+calls), clear next-action queue, journey stage visible.
3. **Slow:** profile the CRM pages (inbox, person view) like the admin dashboard fix (commit b0647b96 pattern: uncached per-request fetches were 28-49s there). Same medicine: cache the bundles, kill N+1s.

Design workflow for #2 (Matt directive): use the FIGMA MCP (connected in the orchestrator session) — generate the new CRM interface in Figma first against the locked brand (navy/cream, Amboqia+Geist) + the v6 Linear finish register (docs/EXPERIENCE_SYSTEM.md "Family 2: the v6 build brief"), get Matt's eyes on the Figma frames, then implement. Coordinate with the orchestrator for Figma access if this session lacks the MCP.

## PRIORITY INPUT 2 — Matt 2026-06-11: Twilio is live, finish the telephony setup

Twilio confirmation email arrived; comms infrastructure is GO. Work order, in order:
1. **FUB opt-outs -> Twilio sync (COMPLIANCE P0, TCPA exposure):** people opted out
   in FUB are not registered in Twilio. Our own send gate (lib/crm/suppressions.ts,
   fail-closed) honors FUB opt-outs at send time, but defense-in-depth requires the
   Twilio layer too: sync every FUB contact carrying contact:do-not-text /
   compliance:hard-stop (+ TCPA litigator tags per memory reference_tcpa_litigator_handling)
   into the Twilio Messaging Service opt-out list, initial backfill + ongoing sync in
   the crm-fub-delta cron. Also verify Advanced Opt-Out (STOP handling) is enabled on
   the messaging service AND that STOP events flow BACK into FUB tags (bidirectional).
   Smoke-test rule applies: verify with 1-2 numbers before bulk.
2. **Per-broker business phones on public profiles:** each broker's Twilio business
   number goes into public.brokers (new/existing phone field), renders on /team
   profile cards + team/[slug] pages + their JSON-LD (RealEstateAgent telephone) —
   coordinate the public-surface edit with the orchestrator (Growth owns page copy).
   Verify INBOUND routing for each number end-to-end: call -> app/api/twilio/voice
   route -> forwards to the right broker cell, recording/voicemail path works
   (voice routes committed today).
3. **Primary number routing:** verify the main line (541.703.3095 FUB-tracked +
   541.213.6706 direct) — inbound call AND text reach the right place; document the
   routing map in docs/CRM_REPLACEMENT_BLUEPRINT.md.
Report concrete verification evidence per item (real test calls/texts where safe).

## PRIORITY INPUT 3 — A2P REJECTION DIAGNOSED (orchestrator, 2026-06-11 ~13:20). Fix + resubmit. THIS BLOCKS ALL LEAD TEXTING.

Campaign on MG592bf50afb3f10e6f1078995dae496e4 status=FAILED, error 30909: CTA
unverifiable. Root cause confirmed: message_flow claims consent is gathered on
ryan-realty.com forms, but the forms display NO SMS-consent language — carriers
visited and rejected. Execute in order:
1. **Add compliant consent disclosure to every lead form** (seller LP
   /lp/seller-home-value, /lp/sell-your-home, valuation form, /contact, buyer
   forms): visible text at the submit button: "By submitting, you agree to
   receive calls and texts from Ryan Realty about your request. Message
   frequency varies. Msg & data rates may apply. Reply STOP to opt out, HELP
   for help." + link to /privacy. NOT conditioned on purchase; keep it as
   disclosure text (no pre-checked boxes). This text is carrier-required
   compliance language — it is exempt from voice-law styling but must not be
   hidden. Verify rendered on prod after deploy.
2. **Rewrite message_flow** to be verifiable: name the exact live URLs and
   quote the exact on-page consent text; drop the verbal-consent mention as a
   primary CTA (keep web-form + inbound-text only). 
3. **Resubmit**: FAILED campaigns can't be edited — DELETE the failed
   Usa2p resource and re-create with corrected message_flow + same samples
   (keep the STOP line in samples). Confirm new status SUBMITTED/PENDING.
4. Log a process_escape_ledger row (defect: campaign submitted with
   unverifiable CTA; check: a pre-submission checklist in this skill).
Until approval lands: every outbound SMS path stays gated; email is the
working channel (verified by Matt's Twilio email + battery).

### STATUS 2026-06-12 — round-2 rejection diagnosed + fixed + RESUBMITTED (Matt-authorized)
The 2026-06-11 resubmission FAILED again (30909, instant). Root causes found
2026-06-12: (1) middleware.ts bad-ua/empty-ua bot screen 403'd HTTP-library
user agents on EVERY URL cited in message_flow including /privacy — carrier
reviewers fetch with exactly those UAs (proof: `curl https://ryan-realty.com/privacy`
returned 403 x-bot-screen:bad-ua); (2) /privacy carried ZERO SMS language
(carriers require the no-mobile-data-sharing clause). Fixed in a29ba247:
COMPLIANCE_VERIFICATION_PATHS exemption in middleware.ts (keep in sync with
CTA_URLS in crm-a2p-resubmit.mjs), "SMS and text messaging" /privacy section,
preflight now also fetches every URL with python-requests UA + asserts the
privacy clause. Deleted FAILED QE2c6890, re-created same SID, status
IN_PROGRESS confirmed via GET 2026-06-12 ~17:45Z. Ledger row
5ddc5e41-38f2-4166-98de-b2d79b079dd5. NOTE: the permission classifier requires
Matt's explicit per-run authorization for any Usa2p create — ask, never infer.
When status flips VERIFIED: announce outbound texting live, run a 1-number
smoke send, verify queued-pending-A2P SMS drain.

### STATUS 2026-06-11 (SMS-restore mission) — steps 1-4 EXECUTED
1. DONE. Shared `components/site/SmsConsentDisclosure.tsx` (SMS_CONSENT_TEXT) at the
   submit button of every phone-collecting form. Verified rendered on prod
   (13 URLs PASS incl. /contact, /sell/valuation, all LPs, /sell/* + /buy/* landings).
   Commit 3301fd60. Screenshots: out/sms-consent-proof/.
2. + 3. DONE. `scripts/crm-a2p-resubmit.mjs` deleted FAILED QE2c6890… and re-created
   with message_flow quoting the exact on-page text + 6 live URLs. New status
   IN_PROGRESS (carrier review) confirmed via GET 2026-06-11.
4. DONE. Ledger row 1a95248d-80d1-4ac9-812c-cc1ff27bd0ec.
**A2P pre-submission checklist (MANDATORY before any future Usa2p create):** run
`node scripts/crm-a2p-resubmit.mjs` dry-run — it aborts unless every URL named in
message_flow returns 200 AND contains SMS_CONSENT_TEXT verbatim; never cite a consent
channel a carrier cannot verify by URL; every sample carries a STOP line; consent text
changes (SmsConsentDisclosure.tsx) require campaign resubmission.
**FUB→Twilio opt-out backfill (PRIORITY INPUT 2 item 1): STAGED, blocked on Matt.**
`scripts/crm-twilio-optout-backfill.mjs` (dry-run verified: 3,309 unique E.164 numbers
from contact:do-not-text + compliance:hard-stop). Twilio Consent API
(accounts.twilio.com/v1/Consents/Bulk) 404s until Compliance Toolkit is ENABLED:
Console > Messaging > Settings > General — page is gated by an emailed verification
code only Matt may enter. After he enables: `--smoke` (2 numbers, expect error_code 0)
then `--execute`.

### Matt directive 2026-06-12 — opt-out backfill BACK-BURNERED
The FUB→Twilio Consent API backfill (PRIORITY INPUT 2 item 1) is deferred by Matt:
our own send gate (lib/crm/suppressions.ts, fail-closed, checked by the sequence
engine + manual SMS path) is the accepted control. Do NOT nag about the Compliance
Toolkit verification code. Script stays staged at scripts/crm-twilio-optout-backfill.mjs
for when it is picked back up. Loop checks: verify the suppression gate keeps passing
instead (engine suppressed-count + isSuppressed fail-closed behavior).
