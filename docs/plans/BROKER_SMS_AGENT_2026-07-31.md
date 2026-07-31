# Broker SMS Agent — execution plan (2026-07-31)

**Mission.** Each of the three brokers texts the marketing line (`TWILIO_NUMBER_MARKETING`,
+1 541 224 5025) and gets a conversational agent that can: run a CMA, produce social/content
drafts, iterate on those drafts from free-text feedback, answer questions from the live
database, and answer Oregon real-estate-law questions with primary-source citations. Brokers
review and approve their own drafts and social content by replying APPROVE. Matt keeps
post-hoc visibility via a daily supervision digest.

**Definition of done (the contract — checked line by line before "done" is claimed):**

1. A text from a registered broker cell to the marketing line gets a reply; a text from any
   other number keeps today's lead-flow behavior byte-for-byte.
2. "CMA on 2417 NW Awbrey" produces a confirm-back, an action row, a render, and a texted
   draft link, end to end, without anyone touching the terminal.
3. "Make me an IG post for <listing>" → draft link → "shorter caption, drop the price" →
   revised draft link → "APPROVE" → the post is actually live on the platform, and the
   broker gets the live post link. (This requires fixing the dead `humanApprovedAt` wiring —
   Phase 0.)
4. "What's Redmond inventory like" answers with numbers pulled live through the same DAL
   functions the site uses, with a server-side citation trace per figure.
5. "Do I need a lead-based-paint disclosure on a 1972 build" answers with an ORS/OAR citation
   drawn from an ingested corpus, never model memory; a deal-specific legal question routes
   to Matt instead of being answered.
6. The agent's outbound send path is mechanically incapable of texting a non-broker number
   (whitelist enforced in code + CI gate).
7. Matt receives a daily digest of every broker-initiated action, approval, publish, and law
   Q&A exchange.
8. STATUS, RESET, and STOP work; a lost phone can be deregistered in one step.
9. Every LLM turn and producer run is cost-ledgered; a per-broker daily cap halts the agent
   politely when hit.
10. Pilot ran with Matt only for ≥ 1 week before Paul/Rebecca were enabled.

---

## Baseline (verified by recon 2026-07-31)

What already exists and is reused as-is:

- **Transport:** 7 signed Twilio webhook routes; `verifiedTwilioParams()` HMAC validation on
  every one; 4-layer inbound idempotency (`crm_timeline.dedupe_key` keyed on MessageSid,
  `crm_message.provider_sid` unique, `crm_tasks.dedupe_key`, `crm_idempotency_keys`).
  `sendSms()` in `lib/crm/twilio.ts` sends MessagingServiceSid+From together (AT&T queue
  lesson) and never retries. A2P fail-closed gate on every send.
- **Marketing line:** `MARKETING_NUMBER` (+15412245025) already routes into
  `app/api/twilio/inbound-sms/route.ts` and falls through to the Matt desk flow.
  **Critical interplay:** the reply-loop guard (`isBrokerForwardCell`) silently DROPS any
  text from a broker's own cell — which means the branch point for the agent is exactly
  that guard: broker cell → marketing line = agent turn, everything else unchanged.
- **Pipeline:** `marketing_brain_actions` rows; producer-dispatcher/-runtime/-publisher-sweep
  crons; `assigned_approver` column exists (default 'matt', currently written by nothing) —
  the natural slot for broker self-approval. One-shot execution logic exists in
  `app/api/admin/run-producer/[id]/route.ts`.
- **DAL:** `getMarketPulse`, `getMarketStats`/`getCityMarketDetail`, `searchListingsAll`,
  `getListingDetail`, `selectCmaCompsPool`, `buildCrmPeopleQuery` (broker-scoped) — the full
  Q&A surface exists; the agent adds zero new query paths.
- **Precedents:** `lib/crm/reply-intent.ts` is the working inbound-SMS→LLM reference
  (deterministic pre-pass, 6s timeout inside the webhook, fail-open,
  `sanitizeRecommendedReply()` voiding any number not present in source material — the §0
  mechanism this agent generalizes).

Pre-existing defects this feature exposes (they block the promise, so they are Phase 0, not
footnotes):

- **D1 — autonomous publish is dead.** `/api/social/publish` requires
  `publish_payload.gate.humanApprovedAt` (≤ 7 days) but nothing ever copies
  `marketing_brain_actions.approved_at` into it; publisher-sweep publishes fail
  `validateGate` and rows get killed after 2 retries. Broker approval is worthless until
  this is wired.
- **D2 — `needs_changes` violates the status CHECK constraint**
  (`20260513170000_marketing_brain_actions.sql` never added it). The revision loop's core
  status may 23514 on every "request changes." Verify live; migrate if unfixed.
- **D3 — `produce/SKILL.md` still maps decommissioned listing-reel/video action types**
  (registry rows deleted 2026-06-14). A broker asking for a listing video must get an honest
  "format retired" answer, not a dead dispatch.
- **D4 — five drifted Anthropic call sites, no shared client** (`claude-sonnet-4-5` vs
  `claude-sonnet-4-6` etc.). The agent adds a sixth caller; consolidate first.

---

## Architecture

```
broker cell ──SMS──► marketing line ──► /api/twilio/inbound-sms
                                          │  From ∈ broker cells AND To = marketing line?
                             no ──────────┤yes
                             (today's     ▼
                              lead flow)  agent ingress: dedupe MessageSid → persist turn
                                          → 200 TwiML immediately → process via after()
                                          ▼
                                   lib/agent/ runtime (transport-agnostic)
                                   session store · tool-use loop · cost ledger
                                          │ tools
        ┌──────────────┬─────────────────┼──────────────────┬────────────────┐
        ▼              ▼                 ▼                  ▼                ▼
   DAL reads      produce protocol   revise/approve     law_lookup      job_status
   (market/       (action row +      (comments +        (legal_corpus   (active rows
   listings/      registry +         needs_changes +    retrieval)      for broker)
   comps/CRM)     in-process run)    APPROVE stamp)
                                          ▼
                       text producers: complete in-process (seconds)
                       visual (CMA/flyer/carousel): render worker on VM (minutes, honest ETA)
                                          ▼
                       ready → SMS to broker with draft/contact-sheet link
                       APPROVE → approved_by=broker → publisher-sweep → executed → live link
```

Session processing runs post-response via `after()` with `maxDuration` raised on the route —
never inside Twilio's 15s webhook window. Replies go out via `sendSms()` from the marketing
line, through a hard broker-cell whitelist.

---

## Numbered backlog

### Phase 0 — repair the rails (defects D1–D4)

- **R0.1** Wire the approval stamp: on `approve_now`/`approve_schedule` (and in
  publisher-sweep as belt-and-braces), copy `approved_at` → `publish_payload.gate.humanApprovedAt`
  plus the other required gate fields, sourced from the row's QA artifacts.
  *Accept:* a test row approved via the queue publishes through the sweep with `validateGate`
  passing; the killed-after-2-retries failure mode is gone for gated rows.
- **R0.2** Verify `needs_changes` against the live CHECK constraint; ship a migration adding
  it if prod hasn't been altered out-of-band. *Accept:* `request_changes` succeeds on a test
  row; constraint text includes `needs_changes`.
- **R0.3** Purge decommissioned reel/video mappings from `produce/SKILL.md`; add the honest
  "format retired 2026-06-14" response to the agent's refusal table. *Accept:* grep-clean;
  agent answers a video request with the retirement note + nearest live alternative.
- **R0.4** Create `lib/ai/anthropic.ts` — one client, exported model constants, shared cost
  math. Migrate producer-runtime and run-producer to it; leave the other call sites for a
  follow-up. *Accept:* agent + producer paths import from one module; model IDs defined once.
- **R0.5** Confirm `PRODUCER_RUNTIME_ENABLED` and render-worker liveness on the VM; document
  the render-worker restart path in this doc. *Accept:* a seeded visual row completes end to
  end within its cadence.

### Phase 1 — transport + identity

- **R1.1** Branch in `inbound-sms`: ahead of the broker-cell drop guard, `From ∈ broker
  cells AND To = marketing line` → agent ingress. All other traffic byte-identical.
  *Accept:* fixture tests prove (a) broker→marketing = agent, (b) broker→own line = dropped
  as today, (c) client→marketing = lead flow as today.
- **R1.2** Agent ingress: MessageSid dedupe, persist inbound turn, ack 200 instantly, process
  via `after()`; reply via `sendSms` from the marketing line. **Hard whitelist:** the agent's
  send helper accepts only numbers in the broker-cell set (reuse the `isBrokerPhone` /
  alert-drain pattern) — this is the mechanical guarantee the agent can never text a client.
  No quiet-hours gate (recipients are internal brokers).
  *Accept:* whitelist unit test; a forced attempt to send to a non-broker number throws.
- **R1.3** Migrations: `broker_agent_sessions` (broker_slug, state jsonb, active_action_ids
  uuid[], last_activity_at) + `broker_agent_turns` (session_id, role, content jsonb,
  message_sid, tool_calls jsonb, citations jsonb, cost_usd, created_at). Sessions idle-expire
  after 4h (fresh context; job handles persist). RESET forces expiry.
  *Accept:* schema snapshot refreshed via `ci:data-access -- --refresh`; turns visible after
  a test conversation.
- **R1.4** Controls: `BROKER_SMS_AGENT_ENABLED` env kill switch; per-broker enable flag
  (`brokers.sms_agent_enabled`, default false — this is also the pilot mechanism and the
  lost-phone deregistration); STOP on the agent thread disables that broker's flag and
  confirms. *Accept:* flipping each control changes behavior in a fixture test.

### Phase 2 — agent core (transport-agnostic)

- **R2.1** `lib/agent/runtime.ts`: tool-use loop on the Messages API (shared client from
  R0.4), max 8 tool rounds/turn, per-turn timeout, cost written to `marketing_cost_ledger`
  (`cost_type: 'broker_agent_tokens'`). System prompt carries: broker identity + scope, §0
  rules, tool contracts, SMS style (plain text, no markdown, ≤ 3 segments before switching
  to a link), the APPROVE protocol, and the refusal table (ad spend, client sends, OAuth,
  retired formats, deal-specific legal advice).
- **R2.2** Tool set v1 (every tool is a thin wrapper over an existing DAL/protocol function;
  zero new query paths):
  `resolve_property` (fuzzy match via listings + `findCmaSubjectByAddress`; multi-match →
  candidates; ALWAYS confirm-back before work starts) ·
  `market_stats` (`getMarketPulse` + `getCityMarketDetail` paired — stats cache alone lacks
  median list price and MoS) ·
  `search_listings` (`searchListingsAll`, capped) · `listing_detail` (`getListingDetail` +
  `getPropertyFactsByMls`) · `comps` (`selectCmaCompsPool`) ·
  `crm_lookup` (`buildCrmPeopleQuery` with the requesting broker's scope — brokers see their
  own people/deals) ·
  `create_action` (the produce-protocol INSERT, producer resolved via REGISTRY.md,
  `assigned_approver = <broker slug>`, `generated_by = 'broker_sms_agent'`,
  `payload.requested_via = 'broker_sms'`) ·
  `run_now` (text producers: invoke the run-producer core in-process — no waiting for the
  hourly cron; visual: leave for the render worker and return an honest ETA) ·
  `revise_action` (append typed change_request comment → `needs_changes` → immediate re-run) ·
  `approve_action` (callable ONLY when the inbound message is the literal token APPROVE,
  case-insensitive, optionally suffixed with a job handle; stamps `status='approved'`,
  `approved_by=<broker email>`, `approved_at=now()`) ·
  `job_status` (the broker's active rows with states + ETAs) ·
  `law_lookup` (Phase 4; until the corpus lands, answers come only from
  `lib/tc/required-documents.ts` + `docs/TC_OREGON_COMPLIANCE.md` with their citations, and
  anything outside them is flagged to Matt).
- **R2.3** §0 enforcement, generalized from `sanitizeRecommendedReply`: every digit-run and
  `$`-amount in an outbound reply must appear verbatim in a tool result from the current
  turn, else the reply is rewritten or blocked; per-figure citations persist on the turn row.
  Same mechanism extended to `ORS`/`OAR` strings (Phase 4).
  *Accept:* unit tests — a reply containing an untraced number is blocked; traced passes.
- **R2.4** Conversational contract: numbered job handles when >1 in flight ("1: CMA Awbrey ·
  2: IG post Tumalo"); ambiguous feedback → one clarifying question, never a guess;
  STATUS/RESET/HELP keywords handled deterministically before the model.
  *Accept:* golden-transcript tests for the two-jobs-in-flight ambiguity case.

### Phase 3 — content loop

- **R3.1** Draft delivery: producer-runtime success path + `render-worker.mjs` notify path
  both check `payload.requested_via='broker_sms'` and text the requesting broker the preview
  link on `ready` (contact-sheet/preview URL from `executor_response`, hosted under
  `public/proof/` or the existing drafts paths — mobile-viewable, view-only, tokenized;
  approval happens only in the SMS thread, so no new auth surface).
  *Accept:* seeded text row and seeded visual row each produce a broker text with a working
  link on `ready`.
- **R3.2** Revision loop: feedback → `revise_action` → re-run → re-notify. Producer contracts
  re-run brand-voice/QA on every iteration, so a broker cannot revise a draft out of
  compliance. *Accept:* golden transcript — request → draft → two revisions → APPROVE, with
  gate artifacts present on each iteration.
- **R3.3** Publish: APPROVE → approved (broker stamp) → publisher-sweep → `/api/social/publish`
  (gate wired per R0.1) → `executed` → agent texts the live post link.
  *Accept:* DONE item 3 demonstrated on a real (throwaway-caption) post.
- **R3.4** CMA boundary: the agent produces and iterates the CMA draft; **delivery to the
  client stays with the broker** (existing send/finalize path). The agent never messages a
  client — that is §1 per-action territory and stays out of scope permanently.
- **R3.5** Supervision digest: daily cron (registered in `vercel.json`, `ci:cron-registered`)
  emailing Matt every broker-initiated action, approval, publish, and law Q&A from the last
  24h. *Accept:* digest renders with a seeded day's activity; cron registered.

### Phase 4 — law corpus

- **R4.1** `legal_corpus` table (source, citation, heading, body, url, effective_date,
  fetched_at, corpus_version, checksum) + ingestion script pulling ORS 696 and OAR 863 from
  oregon.public.law, plus the TC compliance matrix and OREF form-library metadata. Monthly
  refresh cron; checksum diff → alert row for Matt (rule changes are surfaced, not silently
  swallowed). *Accept:* row counts printed; spot-check 5 statutes against the live source.
- **R4.2** `law_lookup` retrieval over the corpus; every answer carries the citation + URL +
  corpus_version; the R2.3 tracer extends to `ORS`/`OAR` strings so an uncited legal claim
  cannot leave the agent. Standing footer: informational, not legal advice.
- **R4.3** General-vs-deal-specific classifier: questions about a live transaction ("can my
  client back out of the Henderson deal") are not answered — they create a task + alert to
  Matt and the broker is told so. *Accept:* golden transcripts both sides of the line.
- **R4.4** All law Q&A logged to the session turns and included in the R3.5 digest
  (principal-broker supervision is a legal duty, not a feature).

### Phase 5 — pilot + hardening

- **R5.1** E2E fixture harness: simulated signed webhooks driving full conversations against
  golden transcripts (property Q&A, CMA, content+revision+approve, law general, law
  deal-specific, STATUS/RESET/STOP, non-broker sender, two-jobs ambiguity). Mocked Twilio +
  Anthropic; no production writes (int-test residue lesson).
- **R5.2** Pilot: `sms_agent_enabled` true for Matt only, ≥ 1 week; misunderstandings and
  silences reviewed; then Paul + Rebecca.
- **R5.3** New CI gates (written by the fixer, per canon):
  `check-broker-agent-send-safety.mjs` — AST-verifies the agent send path imports and applies
  the broker-cell whitelist, and that no other module calls the agent's sender;
  `check-approval-stamp-wired.mjs` — the R0.1 `humanApprovedAt` wiring cannot silently
  regress. Both wired into `ci:gates`.
- **R5.4** Canon updates in the same commit as ship: CLAUDE.md §1 amendment (below), §9
  routing row for the agent, memory write, REGISTRY/docs cross-links.

---

## §1 amendment (ships with R5.4)

> **Broker self-approval via the SMS agent line (Matt 2026-07-31).** `content:*` actions
> initiated by a registered broker through the broker SMS agent are approved by that broker:
> a literal APPROVE reply stamps `approved_by=<broker email>`, satisfying the publisher's
> approval gate (same ≤ 7-day freshness). Everything else is unchanged: ad spend, outbound
> messages to clients/leads/prospects, and OAuth remain per-action Matt approvals, and the
> agent refuses them outright. Matt receives a daily supervision digest of all
> broker-approved publishes and law Q&A.

## UX spec (style + two golden transcripts)

Style: plain text, no markdown, no emoji, numbers carry units, ≤ 3 SMS segments before the
answer becomes a link. Every draft delivery ends with:
`Reply APPROVE to post, or tell me what to change.`

```
Paul: cma on the tumalo reservoir place
Agent: Found 2 matches: 1) 18705 Tumalo Reservoir Rd 2) 19496 Tumalo
       Reservoir Rd. Which one?
Paul: 1
Agent: Running the CMA on 18705 Tumalo Reservoir Rd. Render takes about
       15 min - I'll text you the draft link.
[13 min later]
Agent: CMA draft ready: https://ryan-realty.com/drafts/cma-18705-tumalo-
       reservoir/cma.html - reply with changes or APPROVE to finalize.
```

```
Rebecca: whats redmond looking like right now
Agent: Redmond SFR: 214 active, median list $525,000, 38 median days to
       pending, 3.2 months of supply (seller's), sold last 30d: 61.
       As of 10:40am. Want the 90-day closed stats too?
```

## Cost + caps

LLM: Haiku pre-pass + Sonnet tool loop, expected well under $0.05/typical turn; per-broker
daily cap $3 (agent replies "hit today's budget, back tomorrow — Matt can raise it"), all
spend in `marketing_cost_ledger`. Producer runs keep their existing caps. Twilio: cents.
Nothing here is zero cost; the digest reports daily totals.

## Out of scope — permanently refused on this surface

Ad spend · any message to a client, lead, or prospect · OAuth/account changes · deletions ·
listing video/reel formats (decommissioned) · deal-specific legal advice · anything §1 lists
as per-action Matt approval.

## Risks

- Render-worker liveness bounds visual-format latency (CMA/flyer/carousel); the agent's ETA
  honesty and STATUS command are the mitigation; R0.5 documents the restart path.
- `after()` execution windows on Vercel bound turn length; max 8 tool rounds + per-turn
  timeout keep turns inside it; overflow degrades to "working on it — I'll text you."
- SMS `From` spoofing is theoretically possible; surface exposure is draft-creation and
  reads only (whitelisted recipients, APPROVE-gated publish, no client sends), which caps
  the blast radius; revisit with per-session PIN if it ever matters.
