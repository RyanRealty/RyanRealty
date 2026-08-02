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

## Build log

- **2026-07-31 (build day 1).** Phase 0 SHIPPED: R0.1 approvalRef wiring (publisher-sweep →
  `/api/social/publish` `validateDbApproval`, DB-verified, replaces the never-wired
  `gate.humanApprovedAt`); R0.2 `needs_changes` added to the live CHECK constraint
  (migration `20260801050000`, applied + local file); R0.3 produce/SKILL.md purged of all
  retired video mappings incl. frontmatter triggers, Step-3 examples, and the news-clip
  pattern (gbp row corrected to `ops:gbp_post`); R0.4 `lib/ai/anthropic.ts` shared client
  (producer paths kept on their shipped model; agent on claude-opus-5), producer-runtime +
  run-producer migrated; R0.6 attribution fixed on s1/s3/s4/s5/s7/s9 (finding was 6 of 10
  templates, not 1) + flyer SKILL hedges killed + `check-ad-brokerage-attribution.mjs` wired.
  Phase 1 tables live in prod + local migration `20260801051000` (broker_agent_sessions,
  broker_agent_turns w/ MessageSid idempotency, brokers.sms_agent_enabled, legal_corpus,
  all RLS-locked). `lib/agent/types.ts` contract locked. `exifr` installed. Verified live:
  all four Twilio numbers (incl. marketing +15412245025) already webhook to
  `/api/twilio/inbound-sms`; `TWILIO_NUMBER_MARKETING` + `PRODUCER_RUNTIME_ENABLED` exist in
  Vercel prod. **Manual go-live step: set `BROKER_SMS_AGENT_ENABLED=true` in Vercel
  production (CLI write was permission-blocked in this session; code ships dark until set).**
  Parallel workers building: transport/ingress, agent runtime + core tools, produce tools +
  run-producer-core extraction, Gmail/asset ingestion, ORS 696 + OAR 863 corpus ingest,
  digest cron + the two safety gates.

- **2026-08-02 (build day 2 — SHIPPED).** All six parallel workers landed: transport
  (`lib/agent/ingress.ts` + inbound-sms branch, 20s debounce, never-silent fallback), agent
  core (`lib/agent/runtime.ts`, Opus 5 tool loop, §0 tracer w/ corrective retry, daily $3
  cap), produce tools (run-producer-core extraction, create/revise/approve/hold/status,
  listing-state table, coming-soon + third-party guards), Gmail/assets (broker-scoped DWD
  search, attachment + link ladder, EXIF/vision shoot ingest), law corpus (**352 rows live:
  105 ORS 696 + 203 OAR 863 + 44 matrix, version 2026-08-01**), digest cron (0 14 * * *)
  and gates `ci:broker-agent-send-safety` (9 checks) + `ci:approval-stamp-wired` (6 checks).
  Integration fixes: tools param on force-final/trace-retry calls (API 400 otherwise),
  `server-only` imports removed from new files (+ `server-only` dep installed for the
  existing CRM chain), `marketing_cost_ledger` cost_type CHECK extended for
  `broker_agent_tokens` (found live), audit/ledger writes made non-fatal to a good reply.
  Tests: 4,811 unit green incl. the R5.1 golden-transcript harness (8 scenarios).
  **REAL E2E PASSED:** in-process production path (ingress → debounce → Opus 5 → market
  tools → whitelist send), Twilio status **delivered** to Matt's cell: "Redmond right now:
  185 active listings, median list price $540,000, 4.4 months of supply…" — every figure
  present in the same turn's `market_stats` tool result (pulse refreshedAt 22:48Z). Re-run:
  `NODE_OPTIONS=--conditions=react-server npx tsx scripts/_smoke-broker-agent.ts`.
  DONE contract: 1✅ 2◐(CMA render path deferred to render worker; wiring shipped)
  3◐(mechanics gate-verified; first live publish rides the first broker-approved draft — a
  live publish is per-action approval territory) 4✅ 5✅(corpus live; general-vs-deal
  classifier fail-open) 6✅(gated) 7✅(cron registered) 8✅(harness) 9✅(ledger verified
  live) 10◐(pilot flag ON for matt; BROKER_SMS_AGENT_ENABLED=true still needs to be set in
  Vercel prod — CLI write was permission-blocked) 11◐(spine harness-verified; live run needs
  a real shoot email) 12✅ 13✅(broker-provided-fact protocol in prompt + produce tool).

## Risks

- Render-worker liveness bounds visual-format latency (CMA/flyer/carousel); the agent's ETA
  honesty and STATUS command are the mitigation; R0.5 documents the restart path.
- `after()` execution windows on Vercel bound turn length; max 8 tool rounds + per-turn
  timeout keep turns inside it; overflow degrades to "working on it — I'll text you."
- SMS `From` spoofing is theoretically possible; surface exposure is draft-creation and
  reads only (whitelisted recipients, APPROVE-gated publish, no client sends), which caps
  the blast radius; revisit with per-session PIN if it ever matters.

---

# Amendment 1 — the naive-broker scenario (2026-07-31)

The design target is not a broker who knows the system. It is Rebecca texting:

> "I've got some new photos back from Rich, the photographer, for framed visuals. Can you
> take a look at what he sent me and then create some more marketing materials out of it?"

That message contains: a person who exists nowhere in our systems (Rich), no property, no
deliverable format, voice-to-text noise ("framed visuals"), and an implicit instruction to go
read her email. The agent must resolve all of it with at most one smart question. This
amendment adds the capabilities and the edge-case ledger that scenario forces.

**Recon facts this rests on (verified 2026-07-31):**
- Per-broker Gmail access already exists and is *structurally* scoped: `getGmailFor(subject)`
  in `lib/crm/gmail.ts` builds one DWD JWT per mailbox (3 broker mailboxes in
  `CRM_MAILBOXES`) — the agent impersonates only the requesting broker and cannot see
  anyone else's mail. Rich `q=` search and `attachments.get` byte download are proven in
  scripts (`scripts/_ordway-gmail-hunt.mjs`, `_ordway-gmail-download.mjs`) but not
  productized in `lib/`.
- The asset library has `register()` but no property-shoot ingest flow; `listing_photos`
  (Spark MLS) and `asset_library` never meet. Vision grading is an uncodified agent pass;
  the manifest field is `vision_quality` while the Postgres column is `vision_grade` — any
  new ingest writes BOTH. No EXIF capability exists anywhere (greenfield: add `exifr`).
- Listing-state inference is fully feasible from existing columns: `StandardStatus`
  (includes literal `'Coming Soon'`), `OnMarketDate`, `ListDate`, `DaysOnMarket`. No row at
  all for a fresh shoot = pre-market.
- Coming Soon on the PUBLIC SITE is absolutely suppressed (`lib/listing-status-public.ts`,
  gate `ci:public-listing-status`, 2026-07-21 incident). That rule is untouched here.
- **Live compliance bug found:** `s1_just_listed()` in `scripts/build_single_image_posts.py:169`
  renders with NO brokerage attribution (eyebrow is "JUST LISTED", and the skill bans logos,
  so nothing on the image names Ryan Realty). Flyer footer attribution is "if required"
  judgment prose, and one approved flyer layout has no footer at all. The
  brokerage-name-in-advertising rule (cited in-repo as OAR 863-015-0215 in
  `listing-description/SKILL.md`; re-verify the citation during R4.1 ingest) has no gate.

## New / amended rungs

- **R0.6 (new, ships regardless of the agent — this is live exposure today):** add the
  `RYAN REALTY` attribution to the S1 Just Listed template; make the flyer compliance footer
  non-optional in `flyer-design/SKILL.md` (kill the "if required" hedge and the no-footer
  layout, or give that layout an attribution element); new gate
  `check-ad-brokerage-attribution.mjs` — every registered creative template/generator carries
  the brokerage name by construction. *Accept:* gate wired in `ci:gates`; S1 render shows
  attribution.
- **R1.2 (amended):** inbound turns aggregate over a 20s debounce window before processing —
  real people text in bursts, and three rapid texts are one request, not three.
- **R2.2 (amended):** APPROVE with more than one job awaiting approval requires the job
  handle ("APPROVE 2"); a bare APPROVE with multiple pending gets a clarifying reply, never
  a guess.
- **R2.5 (new) `email_search` tool:** Gmail `q=` search over the requesting broker's mailbox
  only (DWD subject = requester; structural scoping). Searches by display name, domain,
  `has:attachment`, recency. Returns candidates (from, subject, date, attachment/link
  summary) for confirm-back. Productizes the script-proven pattern into `lib/agent/gmail.ts`.
- **R2.6 (new) `fetch_assets` tool:** attachment bytes via `attachments.get` (productized);
  link ladder — direct file URLs and Dropbox (`?dl=1`) fetched automatically; WeTransfer
  fetched immediately on discovery (links expire ~7 days); gallery platforms (Aryeo,
  HDPhotoHub, Amerititle-style portals) are v1 honest-fallback: the agent asks the broker to
  tap "download all" and forward the direct link. Zip archives extracted. Per-file size cap
  500 MB; video stored to the bucket, never re-sent over MMS.
- **R2.7 (new) property-shoot ingestion:** new bucket path `property-shoots/<slug>/`;
  register into `asset_library` with property + broker tags, writing BOTH `vision_quality`
  and `vision_grade`; vision grading codified as part of ingest (closing the uncodified-pass
  gap); EXIF extraction (`exifr`): capture date + GPS. GPS does double duty — confirms the
  property match and flags wrong-property outliers in a batch (photographers batch-deliver).
  *Accept:* a seeded Gmail fixture with 30 photos + 1 outlier ingests, grades, tags, and
  flags the outlier.
- **R2.8 (new) MMS-in as asset source:** a broker texting photos directly enters the same
  ingest path (Twilio media URLs are authenticated and expiring — fetch immediately).
- **R2.9 (new) listing-state inference module** — deterministic signal table, not vibes.
  This is the mechanism behind "smart enough to say coming soon or just listed":

  | Signal | Inferred state | Agent suggestion |
  |---|---|---|
  | No `listings` row for the address + fresh shoot | pre-market | "Coming soon or just-listed-at-launch kit?" (+ compliance affordance below) |
  | `StandardStatus = 'Coming Soon'` | coming soon | coming-soon kit (+ affordance) |
  | `OnMarketDate` ≤ 7 days | just listed | just-listed kit |
  | Recent price change | price improvement | price-improvement post |
  | Pending / Active Under Contract | under contract | "pending in X days" post |
  | Closed, RR was a side | just sold | S2 represented-the-… post |
  | Withdrawn / Expired / Canceled | dead listing | no marketing; expired workflow if RR-relevant |
  | `StandardStatus` NULL | **unknown, treated as NOT public-safe** (stricter than the site's documented null-pass-through hole) | ask the broker |

- **R2.10 (new) broker-provided-fact protocol:** pre-market properties have no MLS data, so
  price/beds/baths/sqft come from the broker in-thread. Every broker-supplied figure is
  confirmed back verbatim and traced as `broker-provided (<name>, <date>)` in the citations —
  §0 satisfied with an honest source, not a fabricated one.
- **R2.11 (new) `bpo` tool:** the BPO twin of the CMA flow (`lib/data/bpo/reads.ts`,
  `/bpo/<slug>` route already exist). Client-safe variant links only; the offer-strategy
  block stays admin-side by the route's existing strip mechanism.
- **R3.6 (new) coming-soon compliance affordance:** a coming-soon kit is produced only after
  (a) the broker confirms in-thread that a signed listing agreement exists (answer logged on
  the action row — no marketing without a listing agreement), and (b) the agent states the
  clear-cooperation consequence: public marketing starts the MLS-submission clock (verify
  the current NAR/MLSCO window during R4.1 and encode it). The public-site suppression rule
  is untouched — a coming-soon listing still never renders on ryan-realty.com.
- **R3.7 (new) third-party listing guard:** if the property resolves to a listing held by
  another brokerage (or the broker is on the buy side), the agent refuses marketing-material
  production — advertising another firm's listing without written consent is an advertising
  violation. It says so plainly and offers what IS allowed (e.g., a just-sold
  "represented the buyer" post after closing).

## DONE contract additions

11. The Rebecca transcript runs end to end as a golden E2E: "photos back from Rich, make
    marketing materials" → agent finds the email in HER mailbox → ingests + grades the
    shoot → infers pre-market → asks the one smart question ("Coming soon or save it for
    launch? I'd do a coming-soon teaser + just-listed kit for day one") → drafts → one
    revision round → APPROVE → published.
12. R0.6 shipped: no registered creative template can render without brokerage attribution;
    gate wired.
13. A pre-market property with zero MLS data flows through with broker-provided facts,
    confirmed back and traced.

## Edge-case ledger

Each row: the case → the handling (and the rung that owns it).

**A. Request comprehension (the naive-broker contract)**
1. No format named ("marketing materials") → propose the default kit (flyer + IG post +
   carousel via the list-kit orchestrator) as a recommendation, not a menu interrogation;
   one question max (R2.1 system prompt).
2. Voice-to-text noise ("framed visuals") → interpret charitably; confirm-back absorbs the
   ambiguity cost (R2.2).
3. Rapid multi-text bursts → 20s aggregation before processing (R1.2).
4. Named human unknown to the system ("Rich") → treated as an email-search cue, not a CRM
   lookup failure (R2.5).
5. No property named → infer from the broker's active listings + the found email + session
   context; ALWAYS confirm-back before work (R2.2 resolve_property).
6. Nicknames ("the Johnson place") → fuzzy owner/address match, candidate list.
7. Retired format (listing video/reel) → honest "retired 2026-06-14" + nearest alternative
   (R0.3).
8. Out-of-bounds (boost this post, text my client, delete X) → plain-language refusal from
   the refusal table; never silent.
9. Zero system jargon in replies: no "action row / producer / registry / render worker" —
   deliverable language only (R2.1).
10. First-ever message from a broker → one-time 3-line capability intro; HELP reproduces it.
11. Conversational texts with no task ("ugh, this seller") → brief human reply, no machinery.
12. Question about another broker's clients/deals → declined per CRM broker scope (R2.2
    crm_lookup).

**B. Email retrieval**
1. Multiple senders match "Rich" / photographer texts from a studio domain → rank by
   has:attachment + recency + display name; candidates confirmed back (R2.5).
2. The email went to a different broker's mailbox → agent says exactly what it searched
   (whose mailbox, what query) and asks for a forward. It never reads across mailboxes —
   structurally cannot (R2.5).
3. Photographer used the broker's personal Gmail → unreachable; ask for a forward to the
   work address.
4. Delivery is a link, not attachments → the R2.6 ladder; expiring links fetched at
   discovery time, not at production time.
5. Zip archive → extracted in ingest.
6. Multi-GB 4K video → bucket storage, size cap, honest note about what each format can use.
7. Same photographer, two properties in the window → EXIF GPS + subject/body address parse
   disambiguate; confirm-back decides (R2.7).
8. Link expired / returns an HTML page instead of files → detected, reported, forward
   requested.
9. Email is a "gallery coming soon" placeholder → recognized as such; broker told to expect
   a follow-up, no empty ingest.

**C. Property + listing state**
1. Pre-market, no listings row → `manual:<slug>` target + R2.10 broker-provided facts +
   R3.6 affordance.
2. Another RR broker's listing → allowed (team marketing); listing-agent headshot/attribution
   rules resolve automatically from the listings row; pre-MLS falls back to the requesting
   broker with a confirm.
3. Not an RR listing / buy side → R3.7 refusal with the allowed alternative.
4. Coming Soon status → site suppression absolute; social only via R3.6.
5. Closed → just-sold content with the represented-side eyebrow (S2 template).
6. Withdrawn/Expired/Canceled → no marketing; route to the expired workflow when relevant.
7. Wrong-property photos inside a delivery batch → EXIF GPS outlier flag + vision check
   (R2.7).
8. NULL StandardStatus → unknown, never assumed active (stricter than the site's documented
   hole; the agent asks).
9. Virtually staged or AI-enhanced imagery in the delivery → §4 disclosure rules apply; the
   agent asks the broker if staging was virtual when vision flags it, and stamps disclosure
   on affected deliverables.

**D. Production + review**
1. Flyer needs print-res / IG needs portrait → asset selection uses stored width/height +
   grades; the agent says when the shoot lacks a usable shot for a format instead of
   stretching one.
2. Photos land ungraded → impossible by construction; grading is inside ingest (R2.7).
3. Two jobs awaiting approval → APPROVE requires the handle (R2.2 amendment).
4. Broker silent mid-flow → job holds; one gentle nudge at 24h; draft auto-expires at 7 days
   with notice (matches the approval-freshness window).
5. "Wait, hold that" after APPROVE but before the sweep publishes → HOLD/CANCEL un-approves
   any not-yet-executed row.
6. Edit requested after publish → agent explains per-platform reality (edit vs delete-repost
   vs leave), constrained by the known platform limits.
7. Platform publish failure → broker told plainly + retry status; no silent kill.
8. Daily cost cap hit mid-conversation → polite halt naming the reset time.

**E. CMA / BPO**
1. Thin comp pool (rural, acreage, unique) → the agent states the pool size and spread
   honestly and offers widened criteria; it never pads a pool to look confident.
2. Subject unresolvable by address (new construction, bare lot) → manual subject facts via
   R2.10.
3. BPO strategy content → client-safe variant only in any link that could be forwarded;
   full variant stays behind admin auth (existing route behavior).
