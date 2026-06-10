# CRM Replacement Blueprint — Replacing Follow Up Boss with the Ryan Realty Platform

**Date:** 2026-06-09
**Status:** DRAFT — pending Matt's review. Nothing in this document has been built or changed. All FUB API calls made for this review were read-only GETs.
**Method:** Live read-only sweep of the FUB account via `api.followupboss.com/v1` (raw responses archived at `scratch/fub-feature-audit/raw/`), full codebase integration inventory, and the May 2026 audit trail (`docs/FUB_AUDIT_2026-05-17.md`, `docs/FUB_LEAD_WORKFLOW_LIVE_AUDIT_2026-05-29.md`).

---

## 1. Executive summary

**The verdict: this is very buildable, and most of it is already built.** The codebase has, over the last three months, absorbed nearly every FUB job that matters: lead capture, tagging, routing, attribution, geo intelligence, compliance flagging, CMA delivery, alerting, digests, and reporting all run from this repo today. FUB's remaining load-bearing roles are exactly four:

1. **The contact database itself** (18,176 people, 64 custom fields, tags, notes, timeline)
2. **The phone number** `541.703.3095` (FUB-tracked, printed on ads and social profiles)
3. **Email sync + batch email** (BCC dropbox, open/click tracking, 32,851 email events)
4. **Mobile surface** (new-lead push notifications, on-the-go record lookup, the FUB iOS app)

Everything else FUB offers is either barely used (dialer: 103 calls ever; appointments: 7 ever; deals: 20 stale), already duplicated by our code (visitor tracking, round-robin, lead alerts, reporting), or actively hostile to our automation (FUB **blocks** `POST /v1/emails` and `POST /v1/textMessages` for API integrations, which is why every send-workflow we have designed ends in a workaround).

**The strategic argument is stronger than the cost argument.** Savings are real but modest (roughly $2,100–2,500/yr at list price for 3 Grow seats, verify against the actual invoice). The real win is that an in-house CRM is **agent-operable**: Claude can read, write, draft, send, sequence, and triage natively, with the listings database, market cache, CMA pipeline, visitor identity graph, and marketing brain in the same schema. FUB structurally cannot do this, and its API restrictions are the single biggest recurring obstacle in our automation work.

**Recommended path:** a 5-phase build over roughly 4–6 weeks of agent-driven work, with a dual-run period where FUB stays live as the fallback, and a cutover gated on hard checks (zero lead loss for 14 consecutive days, number port complete, A2P registration approved, suppression engine enforced on every send path). Detail in §8.

---

## 2. Verified account inventory (live API, 2026-06-09)

Every number pulled fresh this session. Raw JSON archived at `scratch/fub-feature-audit/raw/`.

| Object | Count | Notes |
|---|---:|---|
| Account | `ryan-realty` (id 1980916597) | Owner: Matt Ryan |
| Users | 3 | Matt (Broker, id 1), Rebecca (Broker, id 2), Paul (Agent, id 3) |
| People | **18,176** | Oldest record 2023-10-04. Newest today (FSBO cron). |
| Stages | 16 | Distribution below |
| Custom fields | 64 | Full enrichment schema (BatchData, seller scores, listing context, CMA delivery, buyer prefs) |
| Tags | API 403 on list endpoint | Tag taxonomy known from code (see §5) |
| Action plans | 76 (7 live: ids 69–75) | 1–68 are deleted FUB defaults + legacy `*KTS AP*` imports |
| Action plan enrollments | AP69: 3 ever / 0 running. AP71: 3 ever / 0 running. All others 0. | **The drip engine is effectively unused** |
| Email templates | 76 | SL/BL/EXP/FSBO/OOS/NHD/SPH series, built May 2026 |
| Text templates | 37 | Same series |
| Smart lists | 12 | Leads, Hot Prospects, Nurture, Buyers, Sellers, Pending, Closed, Past Clients, Sphere, IDX Activity, Email Activity, Stay In Touch |
| Groups (routing) | 2 | "Team Ryan" + "Seller Leads", both round-robin, 2 users each |
| Ponds | 1 | "Out Of State Home Owners" |
| Teams | 0 | unused |
| Pipelines / deals | 2 pipelines / **20 deals** | Buyers + Sellers pipelines; barely used |
| Tasks | 253 | Mostly auto-created call tasks |
| Appointments | **7** (2 types, 3 outcomes) | barely used |
| Calls | **103** | in 2.5 years; the dialer is not a real dependency |
| Text messages | API 400 on bare list | Phone-sent texts never appear in the FUB API anyway (known limitation, memory-confirmed) |
| Notes | 14,491 | migrate |
| Events (lead activity) | 16,465 | migrate |
| Email events (`emEvents`) | 32,851 | opens/clicks from FUB batch emails. Parity via Resend webhooks post-cutover |
| Webhooks registered | **0** | FUB pushes nothing to us; all flow is one-way (us → FUB) |
| Threaded replies | 0 | unused |
| Relationships | 30 | spouse/partner links; migrate |
| Person attachments | API 403 (needs owner-scope key or per-person pull) | inventory at migration time |

**Stage distribution (18,176 people):**

| Stage | Count | Reading |
|---|---:|---|
| Lead | 8,230 | prospect book (farm imports, out-of-state owners, portal-era leads) |
| Seller Prospect | 7,524 | prospect book (Westside Bend farm, expired/FSBO, enriched owners) |
| Real Estate Agent | 2,342 | the realtor book, excluded from marketing |
| C - Cold 6+ Months | 46 | |
| Past Client | 21 | |
| Active Client | 8 | |
| A - Hot 1-3 Months | 2 | |
| Everything else | ≤2 each | Pending/Closed/Sphere/Nurture/Trash effectively empty |

**Compliance populations (written by our own BatchData/TCPA pipeline):** `compliance:hard-stop` 3,227 · `contact:do-not-call` 1,095 · `contact:do-not-text` 141.

**Reading:** 87% of the database is a marketing/prospecting book, not active-transaction contacts. FUB is being used as a queryable contact warehouse with a tag taxonomy our own code maintains. The May 29 live audit confirmed the deeper truth: the nurture plans were fully built but never connected, and FUB's own automation layer (Automations 2.0) is dead stock. **The automation brain already lives in this repo.**

---

## 3. Complete FUB feature catalog × actual usage × disposition

Disposition key: **REBUILD** (build in platform), **ALREADY OURS** (codebase covers it today), **REPLACE** (third-party service swap), **DROP** (not worth rebuilding), **DEFER** (build later if a need appears).

### A. Contacts and data

| FUB feature | Our usage | Disposition |
|---|---|---|
| Person records (multi email/phone/address, source, stage, assigned agent) | Heavy — 18,176 records | **REBUILD** (core `crm_people`) |
| Custom fields (64 defined) | Heavy — enrichment, scores, listing context | **REBUILD** (jsonb + typed columns) |
| Tags + mergeTags semantics | Heavy — canonical taxonomy written by our code | **REBUILD** |
| Stages | Heavy (3 stages carry 99% of records) | **REBUILD** (enum + history) |
| Dedup on create (by email) | Relied on implicitly by every entry point | **REBUILD** (dedupe by email + phone, merge tooling) |
| Notes timeline | Heavy — 14,491 notes, lead-origin notes, drafted outreach | **REBUILD** |
| Activity events timeline | Heavy — 16,465 events from our tracking | **REBUILD** (unified timeline) |
| Relationships (spouse etc.) | Light — 30 | **REBUILD** (trivial) |
| File attachments per person | Light | **REBUILD** (Supabase Storage) |
| Merge/dedupe UI, bulk actions, CSV import/export | Periodic (farm imports, dedup scripts) | **REBUILD** (we already script this against FUB) |

### B. Communication

| FUB feature | Our usage | Disposition |
|---|---|---|
| 2-way Gmail/365 email sync per user | Active (Matt's inbox; BCC dropbox `ryan.realty@followupboss.me` used by CMA sender) | **REPLACE** — Gmail API sync, all 3 broker mailboxes (DWD service account already proven in SkySlope work) |
| Email open/click tracking (32,851 events) | Active for batch emails | **REPLACE** — Resend webhooks (delivered/opened/clicked/bounced/complained) |
| Email templates + merge fields (76) | Built, lightly fired | **REBUILD** — templates in repo (versioned, brand-voice gated by CI) |
| Batch emailing (FUB caps ~500/day) | Occasional | **REPLACE** — Resend on `mail.ryan-realty.com` (verified) for bulk; Gmail send-as for 1:1 |
| Texting from app (A2P, templates, the AP auto-SMS) | Configured, near-zero actual use through FUB. Matt texts from his iPhone (those never even reach the FUB API) | **REPLACE** — Twilio number + A2P 10DLC; inbound SMS logs to timeline and forwards to broker's phone; outbound 1:1 stays native iPhone by choice, sequences send via Twilio |
| Built-in dialer, call recording, ring groups | 103 calls ever — not a dependency | **DROP** (keep: inbound forwarding + voicemail-to-timeline via Twilio; click-to-call is a `tel:` link) |
| FUB-tracked number 541.703.3095 | **Load-bearing** — on social profiles + ads for attribution | **REPLACE** — port the number to Twilio (port request early; zero-downtime cutover window) |
| Group texting / MMS | Unused | **DROP** |
| Shared team inbox | Light (3-person shop) | **DEFER** — per-broker Gmail stays the inbox; CRM shows the synced copy |

### C. Automation

| FUB feature | Our usage | Disposition |
|---|---|---|
| Action plans (drip: email/SMS/task steps) | Built (7 live plans), **3 enrollments ever, 0 running** | **REBUILD** — sequence engine on Vercel cron (the 15-min cadence pattern we already run everywhere) |
| Automations 2.0 (trigger rules) | Dead (stock templates, 1 active rule on a tag nobody holds) | **REBUILD** — trigger rules in code (tag/stage/source/inactivity → enroll/notify/task), CI-tested |
| Lead routing: groups round-robin | Configured; in practice all leads route to Matt by directive | **ALREADY OURS** — `canonical-lead-tagger` + `marketing_assignments` already implement assignment with audit trail |
| Ponds | 1 pond | **REBUILD** (a saved view with shared ownership; trivial) |
| Inbox lead processing (parses 250+ portal emails: Zillow, Realtor.com…) | **Verify**: no current code path depends on it; all live sources are our own LPs/webhooks/crons. Legacy book suggests portal-era usage only | **DEFER** — if a portal source is still active at cutover, add a Gmail-parser worker for that one source (not 250) |
| Pixel / website tracking (widgetbe.com) | Active on site, gated by consent | **ALREADY OURS** — `visitor_sessions`/`visitor_events` + identity bridge already capture this first-party; delete the third-party pixel at cutover |
| Stop-on-reply (pause drip when lead responds) | Designed around heavily (pause cron + `*:in-conversation` tags) | **REBUILD** — inbound email/SMS sync marks the thread, sequence engine checks before every send |

### D. Organization and working surface

| FUB feature | Our usage | Disposition |
|---|---|---|
| Smart lists (12) | Daily working surface in FUB UI | **REBUILD** — saved views: serialized filter AST over `crm_people`, shareable, same 12 ports |
| Deals + 2 pipelines | 20 deals, stale | **REBUILD-LITE** — kanban over `crm_deals` for pre-contract pipeline only. **Vault stays the transaction system of record** (locked rule) |
| Tasks (253) | Active (auto call tasks, follow-ups) | **REBUILD** |
| Appointments (7) | Effectively unused | **DROP** — Google Calendar is the calendar; link calendar events to person records |
| Calendar sync | Via Google anyway | **ALREADY OURS** (Calendar MCP/API) |

### E. Notifications and mobile

| FUB feature | Our usage | Disposition |
|---|---|---|
| New-lead push (mobile app) | Real dependency (speed-to-lead) | **REPLACE** — iMessage alert (send_imessage already in our stack) + email + PWA push. Hot leads already trigger Resend alerts today |
| iOS/Android app | Record lookup on the go | **REPLACE** — `/admin/crm` built mobile-first as an installable PWA |
| @mentions / team notifications | Unused (3-person shop) | **DROP** |

### F. Reporting

| FUB feature | Our usage | Disposition |
|---|---|---|
| Leaderboard / agent activity | Not meaningfully used | **DROP** |
| Lead source reporting | Useful | **ALREADY OURS** mostly (`marketing_assignments`, performance pulls, GA4) — add a source-ROI view over `crm_people` |
| Call/text/email volume reports | Light | **REBUILD-LITE** — counts over the timeline table |
| Deals forecast | Unused | **DROP** (Vault + closed-listings data is truth) |

### G. Platform and ecosystem

| FUB feature | Our usage | Disposition |
|---|---|---|
| Open API | Heavy (42 scripts + 20 cron routes + 3 client libs) | **REBUILD** — internal DAL + admin API; the agent becomes the primary API consumer |
| Webhooks out | **Zero registered** | n/a — our DB IS the source; Postgres + crons replace polling |
| Embedded apps / marketplace (Ylopo, CallAction…) | None installed that we depend on | **DROP** |
| Zapier | Unused | **DROP** |
| Lender seats / lender view | Unused | **DROP** |
| Roles/permissions | 3 users, all effectively full access | **REBUILD-LITE** — Supabase auth + RLS, broker-scoped views, keep simple |

---

## 4. What the codebase already covers (verified inventory)

The platform already implements, in production today:

- **Canonical FUB client** `lib/followupboss.ts` (25+ functions: events, tags, notes, tasks, assignment, custom fields, action-plan enrollment, lead pulls) plus `lib/fub-client.mjs` (webhook pipeline) and `lib/canonical-lead-tagger.ts` (post-create orchestration + TCPA hard-stop gate)
- **12+ lead entry points** writing structured leads: seller LP, list-now LP, buyer LP, expired LP, Tetherow LPs, contact form, home valuation, open-house RSVP, saved-search capture, auth sign-in, Meta Lead Ads webhook (HMAC-verified, deduped via `processed_meta_leads`), expired + FSBO detection crons
- **20 cron routes** touching FUB: hot-visitor escalation, seller-workflow pause, outreach drafting, expired/FSBO detection, attribution scans, broker digests, weekly pipeline digest, marketing snapshots, performance pulls
- **First-party visitor identity graph**: `visitor_sessions` / `visitor_events` with FUB person linkage and anonymous-session backfill (this is FUB's pixel, already rebuilt, already consent-gated)
- **Compliance machinery**: BatchData TCPA/litigator/DNC flags mapped to hard-stop tags (3,227 people), checked before audience tagging on LP paths
- **Geo intelligence**: `fub_person_geo` (geocode → city/neighborhood/subdivision tags) — something FUB cannot do at all
- **Assignment ledger**: `marketing_assignments` (who, when, why, which entry point)
- **CMA pipeline**: request → build → deliver → `cma_deliveries` cross-reference with FUB note IDs
- **Audience sync**: FUB → Meta custom audiences (`meta-rebuild-audiences-from-fub.mjs`), local people cache scripts
- **Templates**: the 76 email + 37 SMS templates were authored by us in May (the `.tmp_env/fub-setup/` scripts) — the content already exists and is portable

What this means: **the migration is mostly a re-pointing exercise.** Every entry point already flows through 2–3 client modules. Swap the implementation behind `lib/followupboss.ts`-shaped interfaces to write to `crm_*` tables instead of FUB, and the whole capture layer moves without touching the 12 entry points.

---

## 5. Target architecture

### 5.1 Data model (new `crm_*` tables in the existing Supabase project)

```
crm_people                id, created/updated, first/last name, stage, source, assigned_broker,
                          emails jsonb[], phones jsonb[], addresses jsonb[],
                          tags text[] (GIN), custom jsonb (the 64 fields),
                          fub_legacy_id (migration key), claimed_search_vector
crm_timeline              id, person_id, ts, kind (note|email_in|email_out|sms_in|sms_out|call|
                          voicemail|web_event|task|stage_change|system), payload jsonb,
                          broker_id, dedupe_key          ← the unified timeline (notes+events+comms)
crm_tasks                 person_id, type, due_at, done_at, broker_id, origin
crm_deals                 person_id, pipeline, stage, value, listing_key, vault_ref   (pre-contract only)
crm_saved_views           name, filter_ast jsonb, sort, shared, owner       ← smart lists
crm_sequences             name, status, steps jsonb[] (delay, channel, template_ref, conditions)
crm_sequence_enrollments  person_id, sequence_id, step_idx, next_run_at, status
                          (running|paused_reply|completed|stopped), enrolled_by
crm_templates             key, channel (email|sms), subject, body_md, merge_fields[]  (in-repo source,
                          synced to table; brand-voice CI gate runs on the repo files)
crm_suppressions          person_id/email/phone, reason (stop|unsub|bounce|complaint|tcpa|manual),
                          source, ts        ← single enforcement point for every send path
crm_messages              thread_id, person_id, channel, direction, provider_id (gmail msg id /
                          twilio sid / resend id), raw_ref, ts
crm_relationships         person_id ↔ person_id, kind
crm_attachments           person_id, storage_path, name, mime
```

Existing tables that plug straight in: `marketing_assignments`, `fub_person_geo` (rename `crm_person_geo`), `visitor_sessions`/`visitor_events`, `processed_meta_leads`, `cma_deliveries`, `expired_listings`, `fsbo_listings`, `guest_search_alerts`. They already carry `fub_person_id`; migration adds `crm_person_id` and backfills via `fub_legacy_id`.

All access through `lib/data/` DAL functions (G1/G8/G16 gates apply as everywhere else). RLS: brokers authenticated via existing Supabase auth; all-shared visibility with assigned-filter defaults (mirrors how the 3-person FUB account is actually used).

### 5.2 Services

| Service | Implementation |
|---|---|
| **Email in (sync)** | Gmail API watch/poll on all 3 broker mailboxes via the existing DWD service account. Inbound + outbound messages matched to people by address, written to `crm_messages` + timeline. This replaces FUB's 2-way sync AND the BCC dropbox (no more `@followupboss.me`). |
| **Email out (1:1)** | Gmail API send-as the broker (lands in their Sent folder, best deliverability, real reply chain). Used by sequence steps that should look personal. |
| **Email out (bulk/sequence)** | Resend on `mail.ryan-realty.com` (already verified) with per-message webhooks → `crm_timeline` (open/click/bounce/complaint) → auto-suppression. CAN-SPAM unsubscribe link on every nurture email. |
| **SMS** | Twilio, per-broker business numbers + the ported marketing line. Full architecture in §5.5 (this is the FUB-parity-critical piece). STOP/HELP keywords auto-handled → `crm_suppressions`. |
| **Voice** | Twilio number forwards to assigned broker's cell. Missed → voicemail → transcription → timeline + alert. No dialer build (103 calls in 2.5 years does not justify one). |
| **Sequence engine** | Vercel cron every 15 min: pull due `crm_sequence_enrollments`, re-check suppressions + pause-on-reply + business-hours window, render template, send via the right channel, advance step, log. Same pattern as the producer-runtime cron we already operate. |
| **Trigger rules** | In-code automation registry: on person-created / tag-added / stage-changed / inactivity-elapsed → enroll, task, notify, or alert. Versioned, testable, gated. This replaces both FUB action-plan triggers and Automations 2.0, and fixes the class of bug the May 29 audit found (tags applied, nothing enrolled, invisible for weeks). |
| **Notifications** | iMessage (existing MCP) for hot leads, email digests (already built), PWA web-push for the rest. |
| **Dedupe/merge** | On-create dedupe by email/phone; merge tool in admin UI; the farm-import dedup scripts repoint to `crm_people`. |

### 5.3 UI (`/admin/crm`, design-system components, mobile-first PWA)

1. **People** — virtualized table, saved views rail (the 12 smart lists ported), bulk actions, instant search
2. **Person page** — header (stage, tags, broker, compliance banner), unified timeline, composer (email/SMS/note with templates), tasks, sequence membership, geo + enrichment panel, linked CMA/listings/visitor history
3. **Inbox** — unified unhandled-conversations queue (inbound email/SMS/voicemail across brokers)
4. **Pipeline** — kanban for the 2 pipelines (pre-contract; Vault link-out for in-contract)
5. **Sequences** — list, step editor, enrollment counts, per-step send/open/reply stats
6. **Reporting** — source ROI, speed-to-lead, sequence performance, compliance dashboard

### 5.4 The agent layer (why this beats FUB)

Every capability above lands as DAL functions + admin API routes, which means Claude can: triage the inbox, draft replies in Matt's voice (brand-voice gated), enroll/pause sequences, work the saved views, write CMA follow-ups, run dedup, and produce the digests — natively, without FUB's blocked endpoints, rate limits, or UI automation. The CRM becomes another surface of THE LOOP with mechanical gates (suppression-check gate, brand-voice gate, send-rate gate) instead of prose rules.

### 5.5 Texting architecture (the FUB-parity piece, in detail)

Matt's requirement (2026-06-09): accurate per-client conversation tracking, especially text messages, with texting from a business number like FUB's and inbound routing to the right agent. This section is the contract for that.

**Numbers plan.** FUB's texting is ordinary carrier infrastructure with per-user numbers on top. We replicate the same model on Twilio:

| Number | Role |
|---|---|
| `541.703.3095` (ported from FUB) | Brokerage marketing line. Stays on ads, social profiles, lead-capture surfaces. Inbound routes by contact lookup (below). Sequence/automation SMS sends from here. |
| New local 541 number — Matt | Matt's 1:1 business texting line |
| New local 541 number — Rebecca | Rebecca's line |
| New local 541 number — Paul | Paul's line |

~$1.15/mo per number. All four register under one A2P 10DLC brand + campaign.

**Inbound routing (the "right agent depending on the client" rule).** Every inbound SMS/MMS hits our Twilio webhook:

1. Match sender phone against `crm_people` phones.
2. **Known contact** → write to that person's timeline → notify the **assigned broker** (push + iMessage alert with the message body and a one-tap reply link into the PWA) → conversation appears in that broker's inbox queue.
3. **Unknown number** → create a lead (source `inbound-sms`), route by rule (default Matt), alert immediately — an unknown inbound text is a hot signal.
4. Texts to a broker's personal business line skip the lookup ambiguity entirely — they already belong to that broker; the timeline write + alert still fire.

This is strictly better than FUB, which routes an inbound text to whoever owns the number it arrived on, not to the agent who owns the relationship.

**Outbound + capture guarantees.** Three send paths, all of which land on the person timeline by construction (capture is structural, not best-effort):

1. **CRM composer / PWA** — broker texts from the person page or inbox; sends from their own business number via Twilio; logged at send time with delivery receipts.
2. **Sequence engine** — automated touches from the marketing line; logged, suppression-checked, quiet-hours-gated.
3. **Agent-drafted** — Claude drafts in the broker's voice, broker approves, system sends. (FUB structurally blocks this; it's the headline capability gain.)

**The personal-iPhone channel (the gap FUB never solved).** Matt's real client texting happens natively from his cell. Those messages never touch FUB's API today and would never touch Twilio either. Two-part answer:

- **Going forward:** 1:1 business texting moves to the business numbers via the PWA (one tap from the alert). That's the same behavior change FUB asks for (replies must go through the FUB app to come from the FUB number) — this is not a new constraint, it's the existing one, honestly stated.
- **The bridge:** the mac mini already has Messages access (iMessage MCP). A sync job matches Matt's native iMessage/SMS conversations against known CRM contact phones and writes them into `crm_timeline` (read-only ingest, his own message store, known contacts only). FUB cannot do this at all. Result: even when Matt texts a client from his personal cell, the conversation record is complete. (Applies to Matt's phone — Rebecca and Paul get full capture by using their business lines.)

**The one daily-use difference to be honest about:** replying *from the business number* requires sending through the system (PWA tap-to-reply or Claude-drafted), exactly as FUB requires the FUB app. A native reply from the personal cell still gets *captured* (via the bridge) but goes out from the personal number. A v2 experiment can add reply-by-relay (reply to the forwarded text and the system re-sends it from the business number), but relay reply-threading is ambiguous when multiple conversations are active, and with TCPA stakes we will not ship a wrong-recipient risk. V1 = PWA reply + bridge capture.

**Sequencing constraint:** Twilio numbers cannot send a single SMS until the A2P 10DLC campaign is approved (days to weeks, external clock). This is the single hardest dependency in the whole project and the reason the migration MUST run parallel rather than big-bang — see §7.

---

## 6. Compliance (now our liability, already mostly our machinery)

- **TCPA/DNC**: the hard-stop system already exists (3,227 flagged). Centralize: every send path queries `crm_suppressions` at send time (one gate, not per-entry-point checks). Keep BatchData screening on new imports.
- **SMS**: A2P 10DLC registration required before any Twilio SMS. STOP/HELP auto-keywords, opt-out language in first touch (already written into the templates), quiet hours (8am–9pm local), frequency caps in the sequence engine.
- **Email**: CAN-SPAM unsubscribe on all bulk/nurture sends, Resend bounce/complaint webhooks auto-suppress, per-broker Gmail sends stay within Workspace daily caps.
- **Call recording**: not in scope (forwarding only). If ever added, re-check Oregon consent law first.
- **Data**: contacts PII lives in our Supabase (RLS, service-role only server-side). Export/delete tooling for any consumer request.

---

## 7. Migration plan

**Parallel-run is the decision, not an option (settled 2026-06-09).** Build and run both systems side by side; FUB stays the live working tool until the cutover gate passes. Two reasons make big-bang impossible anyway: (1) our numbers cannot text until A2P approval clears (external, days to weeks), and (2) the ported number can only live in one system, so it moves last. Everything else — contact mirror, Gmail sync, the new broker numbers, sequence engine in shadow mode, the CRM inbox — runs in parallel with zero impact on FUB. The actual "cutover" ends up being a small event: repoint the entry-point modules and port one number.

**Inventory to migrate (all exportable via the API we already use):** 18,176 people (fields, tags, stage, source, assignment) · 14,491 notes · 16,465 events · 253 tasks · 30 relationships · 20 deals · attachments (per-person pull) · 76+37 templates (already in repo scripts) · the 7 live sequence definitions · 12 smart-list definitions (re-expressed as filter ASTs).

**Known acceptable losses:** FUB `emEvents` history (32,851 opens/clicks — archive the export, don't model it), phone-sent text history (never in the API; it lives in Matt's iPhone), call recordings if any exist (103 calls; export audio files if present).

**Dual-run design:** during Phases 1–3 the capture layer dual-writes (FUB + `crm_people`) behind a feature flag, with a nightly reconciliation job diffing the two (count + spot-check). FUB remains the working UI until the cutover gate passes. After cutover, FUB goes read-only for 30 days (downgrade to 1 seat if billing allows), then export-archive + cancel.

**Cutover gate (all must pass):**
- [ ] 14 consecutive days of dual-write with zero reconciliation diffs on new leads
- [ ] Number port of 541.703.3095 completed and inbound SMS/voice verified end-to-end
- [ ] A2P campaign approved; STOP keyword round-trip tested
- [ ] Gmail sync running on all 3 mailboxes ≥ 7 days, timeline spot-checked
- [ ] Suppression engine enforced on every send path (CI gate)
- [ ] Hot-lead alert latency ≤ FUB push (measured)
- [ ] All 12 entry points repointed in code (single-module swap) + smoke-tested
- [ ] Full FUB export snapshot archived (people/notes/events/files JSON)

---

## 8. Build phases and effort

**The build is fast. The calendar is set by external clocks, not by us.** Two different timelines, kept honest by separating them (recalibrated 2026-06-09 after Matt's correction — the original 4–6 week framing padded the build with human-team assumptions):

**Track A — agent build days (we control):**

| Phase | Scope | Build time |
|---|---|---|
| **0. Mirror + read-only CRM** | `crm_*` schema + migration, full FUB import (cache scripts already exist), `/admin/crm` people table + person timeline, fused with geo/visitor/CMA data FUB can't show | ~1 day |
| **1. Comms foundation** | Gmail sync (3 mailboxes), Resend path + webhooks, suppression engine + CI gate, template port, composer. **File A2P registration + number-port LOA the same day** | ~1–2 days |
| **2. Engine** | Sequence engine + trigger rules (port the 4 plans that matter), 12 saved views, tasks, dedupe/merge, dual-write flag on all entry points | ~1–2 days |
| **3. Phone** | Twilio wiring: inbound SMS/voice → timeline + routing + alerts, outbound sequence SMS, STOP handling, iMessage bridge ingest | ~1 day |
| **4. Cutover + PWA polish** | Gate checklist, repoint entry points, reporting views, push notifications | ~1 day |

Total build: **roughly a week of focused agent work.** Each phase ships and is usable the day it lands.

**Track B — external clocks (we don't control; all filed on day 1):**

| Item | Typical wait | Gates what |
|---|---|---|
| A2P 10DLC brand + campaign approval | days → a few weeks | any outbound SMS from our numbers |
| Port of 541.703.3095 out of FUB | ~1–4 weeks | the marketing line moving; everything else texts from the new broker numbers the moment A2P clears |
| Dual-write proving window | 7–14 days (our choice, runs concurrently) | the final repoint + FUB cancellation |
| Gmail sync observation | a few days, concurrent | trusting the timeline as the record |

Net: the **system is built and in daily use within about a week**; FUB gets cancelled as soon as the A2P approval, the port, and the proving window all clear — realistically **3–4 weeks of calendar**, nearly all of it waiting on carriers while the new CRM is already running.

---

## 9. Cost

| Item | Today (FUB) | After |
|---|---|---|
| FUB Grow, 3 seats | ~$174–207/mo at list ($58/user annual, $69 monthly) — **verify actual invoice**, add-ons (texting/calling) may apply | $0 |
| Twilio | — | ~$5–20/mo at current volume (number $1.15, SMS pennies, light voice forwarding, A2P campaign fee ~$2–10/mo) |
| Resend | already in stack | $0–20/mo (existing plan likely covers nurture volume) |
| Supabase/Vercel | already in stack | ~$0 marginal |
| **Net run-rate** | **~$2,100–2,500/yr** | **~$300–500/yr** |

Savings ~$1,800–2,000/yr at list price. The build cost is the real investment; the return is the agent-operated CRM plus owning the data.

---

## 10. Risk register (the honest hard parts)

1. **Email deliverability** — biggest technical risk. Mitigation: 1:1 sends via Gmail API (broker's own reputation), bulk via Resend on the verified subdomain, gradual warm-up, suppression hygiene, no purchased-list blasting (the 15K prospect book gets mailed only in screened, throttled batches, exactly as today's rules require).
2. **A2P 10DLC timeline** — external approval can take weeks. Mitigation: file in Phase 1, week 1. SMS sequences stay off until approved (email sequences don't wait).
3. **Number port** — 541.703.3095 is on printed/posted surfaces. Mitigation: ports are schedulable with no inbound downtime when timed right; verify FUB's underlying carrier (likely Twilio already) and keep FUB forwarding live until port confirms.
4. **Speed-to-lead regression** — FUB's mobile push is good. Mitigation: iMessage alerts (faster in practice for Matt) + measured latency in the cutover gate.
5. **Compliance liability transfer** — FUB's guardrails go away. Mitigation: the suppression engine is a CI-gated single chokepoint, which is stronger than today's per-path tag checks (the May 29 audit already caught one path missing the check).
6. **Hidden FUB dependencies** — e.g. a portal (Zillow/Realtor) still emailing leads into FUB's parser, or an integration we forgot. Mitigation: 30-day read-only observation window + the dual-run reconciliation diff; inventory FUB Admin → Integrations/Phone Numbers in the UI during Phase 0 (the API doesn't expose those screens).
7. **Scope creep** — rebuilding FUB features nobody uses. Mitigation: §3 dispositions are the contract; anything marked DROP/DEFER needs a new decision to enter scope.

---

## 11. What we deliberately will NOT rebuild

- The power dialer, ring groups, call recording (103 calls ever)
- Appointments module (7 ever; Google Calendar wins)
- 250-source email parsing (we have 0–1 active portal sources)
- Lender seats, teams, leaderboards, marketplace apps, Zapier
- FUB's deals forecasting (Vault is the transaction system of record, locked rule)
- A native mobile app (PWA + iMessage covers a 3-person brokerage)

---

## 12. Open questions for Matt

1. **Go/no-go on the direction** — phased build per §8, starting with Phase 0 (zero-risk read-only mirror)?
2. **FUB invoice** — what's the actual monthly spend (plan + any texting/calling add-ons)? Sets the real savings number.
3. **The 15K prospect book** — any marketing planned to it before cutover (affects sequence-engine priorities and warm-up schedule)?
4. **Numbers plan confirmation** — §5.5 proposes: port 541.703.3095 as the marketing line + one new business line per broker, inbound routed to the assigned broker. Confirm, or keep a single shared line for everything?
5. **FUB UI screens to photograph before cancel** — Phone Numbers, Integrations, Email settings (the three admin screens the API can't read). I'll drive this via the browser when we start Phase 0.

---

## 13. Source trace

- Live API sweep 2026-06-09: `scratch/fub-feature-audit/sweep.mjs` → `scratch/fub-feature-audit/raw/*.json` (33 endpoints, all GET)
- Per-plan enrollment + stage distribution + compliance counts: inline Node pulls this session (AP69 total=3/running=0, AP71 total=3/running=0, stages and tags as tabled in §2)
- Codebase inventory: Explore-agent sweep this session (3 client libs, 20 cron routes, 12+ entry points, 10 Supabase tables, 42 scripts, tag taxonomy)
- Configured-state history: `docs/FUB_AUDIT_2026-05-17.md`, `docs/FUB_SELLER_WORKFLOW_2026-05-17.md`, `docs/FUB_LEAD_WORKFLOW_LIVE_AUDIT_2026-05-29.md`, `docs/HANDOFF_FUB_SMART_LIST_WIRING_2026-05-27.md`
- FUB API restriction (no POST emails/textMessages for integrations): `docs/FUB_SELLER_WORKFLOW_2026-05-17.md` + memory `reference_fub_texting_phone_sent`
