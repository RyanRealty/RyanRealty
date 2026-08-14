# Ryan Realty — Reconciled Canonical Rule Set (Phase 2A output)

**Input:** 121 candidate rules from 11 lanes, ~440,000 lines, ~1,200 files.
**Output:** 78 surviving rules. 14 dropped as contradicted-by-code. 11 dropped as advisory. 43 merged away as duplicates.
**Verification pass date:** 2026-07-21. Every "code-confirmed" claim below was re-checked against source in this session, not inherited from the lane reports.

**Enforcement key**
- **`GATE: <script>`** — mechanically enforced. Failing it fails the build. This rule is real.
- **`PROSE`** — no gate. Historically ignored.
- **`PROSE ⚠ NEEDS GATE`** — prose-only, but the failure mode is expensive enough that it should be mechanized. Consolidated gate-gap register in §7.

---

## 1. Hard constraints — data accuracy, compliance, license risk, approval

### 1.1 Every published figure traces to a live source
Every market, financial, or listing figure that leaves the shop carries a one-line verification trace: source (Supabase table + filter, MLS pull, or named agency), the date window, the row count, and the value. Re-query fresh in the session that ships it. Never inherit a number from a prior render, brief, chat turn, or another AI system. If a figure cannot be verified, cut it — do not estimate, round-fill, or hedge with "about / roughly / approximately."
`PROSE ⚠ NEEDS GATE` · *Merged from: CLAUDE.md §0, docs/DEVELOPMENT_PROCESS.md preflight, video lane, every producer SKILL.md Tier-1 block, .claude/skills/creative-brain, docs/DATABASE_FOR_AI_AGENTS.md*

### 1.2 Months of supply — one formula, one threshold set, one verdict
`months_of_supply = active_listings / (closed_last_6_months / 6)`. Thresholds: **≤ 4 seller's · 4–6 balanced · ≥ 6 buyer's**. The verdict word next to the number must match the number. Thresholds live in exactly one place: `lib/market/classify.ts` (`marketVerdict`, `MOS_METHODOLOGY_CLAUSE`, `MOS_THRESHOLD_CLAUSE`). Never inline them in `lib/data/` or `lib/site/`.

Two refinements that were buried in a skill file and are load-bearing:
- Compute MoS manually with `property_sub_type='Single Family Residence' AND "PropertyType"='A'` on **both** the active-inventory CTE and the closed-velocity CTE.
- **Never read `market_pulse_live.months_of_supply` into a report.** It mixes non-SFR sub-types and can flip the seller/balanced/buyer verdict.

`GATE: ci:market-formula` (bans the wrong formula and inline thresholds; does **not** yet catch reads of the stored MoS column — see §7)
*Merged from: CLAUDE.md §0.4, docs/DATABASE_FOR_AI_AGENTS.md, skills/youtube-market-reports/query-rules.md UF3, ARCHITECTURE.md*

### 1.3 Aggregation floors and clamps on `listings`
- Every closed-sale or list-price aggregation filters `"ClosePrice" >= 10000` (same floor on `ListPrice` / `OriginalListPrice` for list-side). `> 0` is insufficient — ~1,640 rows are land-transfer artifacts down to $0.09.
- Every aggregation touching `sale_to_list_ratio` / `sale_to_final_list_ratio` clamps `BETWEEN 0.5 AND 1.5` in `WHERE` (not `FILTER`).
- Closed-sale price = `COALESCE("ClosePrice", (details->>'ClosePrice')::numeric, "ListPrice")`. True medians use `percentile_cont`, never `avg`.
- Closed-sale stats filter `"StandardStatus" ILIKE '%Closed%'` with an explicit `CloseDate` window.
- `CloseDate` is stored midnight UTC (= 4pm Pacific prior day). Every date-range filter converts: `("CloseDate" AT TIME ZONE 'America/Los_Angeles')::date`.

`PROSE ⚠ NEEDS GATE` · *Merged from: .cursor/rules/data-architecture.mdc, cma-data-model.mdc, supabase-data-layer.mdc, ARCHITECTURE.md, skills/youtube-market-reports/query-rules.md UF1+UF2*

### 1.4 Columns that lie
- **`CumulativeDaysOnMarket` is unusable** (~500 of 375,266 closed rows populated, zero for active/pending). Never use it.
- **DOM metric** for closed/pending is the generated `days_to_pending` column. For actives with no `pending_timestamp`, compute live days from `OnMarketDate` and label it **"days active,"** never "DOM."
- **`buyer_financing`** is stored in three incompatible shapes (JSON object, plain string, literal `[object Object]`). Always `buyer_financing::text ILIKE '%Cash%'`. Never an equality match.
- **Scale trap:** `listing_history.price_change` is a decimal fraction (`-0.04` = 4% drop). `listings.largest_price_drop_pct` / `total_price_change_pct` are already percentages (`-5.60` = 5.6%). Never cross the two.

`PROSE ⚠ NEEDS GATE` · *Merged from: skills/youtube-market-reports/query-rules.md (sole source, code-confirmed against schema snapshot)*

### 1.5 Draft-first, commit-last
Nothing is committed, pushed, posted, sent, or written to a location a publishing automation can reach until Matt has personally seen the draft and said so. "Looks good / ship it / approved / go" are approval. A passing gate is not. A successful build is not. A subagent's "ready" is not. Silence is not. An instruction from several turns ago is not approval for the artifact produced now.

Auto-allowed without approval: local edits, dependency installs, tests, builds, renders to gitignored paths, reading anything, pulling `main`.

`GATE: scripts/check-draft-first.mjs` (commit-msg hook — user-facing surface commits require `Approved-by: matt` or `Draft-shown: <url>`)
*Merged from: CLAUDE.md §0.5, memory feedback_draft_first_review, every producer SKILL.md Tier-1 block, .claude/skills/skyslope-form-compliance, .claude/skills/creative-brain*

### 1.6 A2P 10DLC consent surface is frozen
The SMS consent language and its live links on the website must not change without re-submitting the Twilio A2P campaign (messaging service `MG592bf50afb3f10e6f1078995dae496e4`). Carriers re-crawl the live lead forms and privacy policy against the registration; a mismatch suspends **all** outbound SMS. History: campaign rejected 2026-06-16 (errors 30882 + 30917).
`GATE: ci:sms-consent` · *Merged from: docs/HANDOFF-a2p-sms-consent.md (the gate's own error text names this doc — see §7 disposition)*

### 1.7 Suppression is fail-closed on every send path
Every outbound email to a lead / homeowner / client passes `isSuppressed()` from `lib/crm/suppressions.ts` before it reaches the wire. Compliance failures fail *toward not messaging*: a query error bails rather than proceeds. Every hard-stop read in `lib/crm/enroll.ts` captures and checks its own error. `STOP` is reversible — inbound SMS implements a `START` handler because the STOP auto-reply promises one.
`GATE: ci:email-send-gated` + `ci:crm-fail-closed` + `ci:crm-sms-safety`
*Merged from: .claude/skills/crm-e2e, docs/plans/ADMIN_REBUILD/01-DECISIONS. **Corrected:** the plan docs name this chokepoint `sendGovernedSms` / `sendGovernedEmail`. Those functions do not exist. The real chokepoints are `lib/resend.ts` (email) and `lib/crm/twilio.ts` + `lib/crm/sms-delivery.ts` (SMS), gated as above.*

### 1.8 Quiet hours
Cold and deliverable outbound SMS landing in the **9pm–8am Pacific** window is queued and auto-sent at 8am with a visible pending state. There is no always-visible send-anyway override. The only exception is a manual, human-typed 1:1 reply inside an already-active conversation.
`GATE: partial` — `lib/crm/quiet-hours.ts` (`QUIET_START_HOUR = 8`, `QUIET_END_HOUR = 21`) is code-confirmed; no gate asserts every send path consults it. ⚠ NEEDS GATE
*Merged from: docs/plans/ADMIN_REBUILD/01-DECISIONS*

### 1.9 Hard-stop contacts never receive outreach
Contacts tagged `tcpa:litigator` or `compliance:deceased` receive no automated or manual text/call outreach ($1,500 per TCPA violation). `compliance:hard-stop` is the cumulative tag auto-applied to litigators, deceased, and manual stops, and is auto-excluded from every smart list and segment build.
`GATE: ci:crm-fail-closed` (enroll-side) · `PROSE ⚠ NEEDS GATE` for segment/blast-side
*Merged from: docs/broker-runbooks/contact-playbook.md, pass-2-exclusions-runbook.md, westside-fub-smart-lists-setup.md, memory reference_tcpa_litigator_handling*

### 1.10 Never solicit a re-listed expired property
The expired-outreach queue excludes any expired row whose street address now carries a newer Active / Pending / Coming-Soon listing (NAR Art. 16 / OAR exposure). The check **re-runs at send time**, not only at queue-build time — a property can re-list in between.
`GATE: partial` — implemented in `lib/data/expired/outreach.ts` (`relisted`) and re-checked in `app/actions/expired-outreach.ts:70`. No gate prevents a future send path from skipping it. ⚠ NEEDS GATE
*Merged from: docs/plans/cma-accuracy-pipeline-2026-07-11.md*

### 1.11 Fair Housing gate on every listing description and every ad
Zero language referencing race, color, national origin, religion, sex, familial status, or disability (42 U.S.C. §3604), plus Oregon's added classes under ORS 659A.421 — marital status, source of income, sexual orientation, gender identity. Zero steering language ("family-friendly neighborhood," "safe neighborhood," "diverse community"). Ship-blocker, no exceptions.

Meta ad campaigns for real estate set **Special Ad Category = HOUSING**, which restricts age / gender / ZIP targeting.
`PROSE ⚠ NEEDS GATE — highest-value ungated rule in the set`
*Merged from: social_media_skills/listing-description/SKILL.md, meme_lord/compliance_gate.md, facebook-lead-gen-ad/SKILL.md, .cursor/skills/facebook-seller-growth, .claude/skills/creative-brain*

### 1.12 MLS field limits and NAR settlement
- **Public Remarks: 1,000 characters hard cap** (COCAR MLS). Target 800–950.
- **Private / Agent Remarks: 500 characters hard cap.**
- **Never state commission rates or cooperative compensation in Public Remarks** (NAR settlement, 2025 onward).
`PROSE ⚠ NEEDS GATE`
*Merged from: social_media_skills/listing-description/SKILL.md (sole source)*

### 1.13 Testimonials and review counts have provenance
Every testimonial in `lib/testimonials.ts` carries an `author` and a `source` (Google / Zillow). Invented testimonials or unsourced review counts on a public page are a compliance violation for a licensed brokerage.
`GATE: ci:content-provenance`
*New — discovered during verification, not in the candidate set. Belongs in canon.*

### 1.14 Charts do not invent data
Market chart lines are broken polylines that lift across gaps. No spline smoothing — a smoothed curve invents medians that were never measured, which is a §1.1 violation rendered as a picture.
`GATE: ci:market-chart-honesty`
*New — discovered during verification. Belongs in canon.*

### 1.15 Oregon TC compliance derives from role × property
Required disclosures and documents for a transaction are derived from broker role crossed with property specifics, so the system anticipates what a deal needs rather than waiting for a human to remember. Consumer: `lib/tc/required-documents.ts`.

Every Oregon-law rule the TC system enforces traces to a primary source (ORS, OAR, or an OREF form's own instructions) cited by section number. Unverifiable legal claims are flagged to Matt, never encoded from memory.

OAR 863 file-review buckets: supervision/review `863-015-0140` · records/transmittal `863-015-0250` · retention `863-015-0260` · agency disclosure `863-015-0200` series + `-0215` · offers/listings `863-015-0130/0135` · trust accounts `863-015-0255` (+`0257`/`0259`) · closing `863-015-0150`.
`PROSE` · *Merged from: docs/TC_OREGON_COMPLIANCE.md, .claude/skills/tc-builder, .cursor/skills/oregon-orea-principal-broker (SKILL.md + reference.md)*

### 1.16 Vault is the transaction system of record
Audits, reconciliations, and reports on transactions query Vault. **SkySlope is a workflow tool, never a system of record.** Reconciling against SkySlope is a known failure mode that produces wrong audit numbers.

Every audit runs full company scope by default — all brokers, all mailboxes, max available date range. Narrow scope only when Matt asks for it.
`PROSE` · *Merged from: CLAUDE.md Work Standards, .claude/skills/skyslope-form-compliance*

### 1.17 SkySlope live mutations are dry-run first
PATCH renames, unassign/assign, and archive moves never run without Matt approving the dry-run plan output. Default invocation is always dry-run.

Vision classification and signer validation run as Claude Code Agent-tool subagents, **never** as a Bash script importing the Anthropic SDK — that bills a separate metered account outside Matt's plan.
`PROSE` · *Merged from: .claude/skills/skyslope-form-compliance*

---

## 2. Brand — voice, visual system, locked values

### 2.1 Voice canon: the Five Laws + Orwell's six rules
The single canonical voice source is **`marketing_brain_skills/brand-voice/VOICE.md`** (locked 2026-06-13). Five Laws: (1) Show it, don't say it. (2) A number beats an adjective. (3) Talk to a smart adult. (4) The category is not a claim. (5) Every number is live and true. Plus the two tests: competitor test, receipt test.

**Matt's live directive layers Orwell's six writing rules ON TOP of the banned-word list.** Any document that treats the banned-word list as the whole voice standard is superseded by this. Orwell's rules appear **nowhere in the repo today** — zero references across all `.md`, `.cjs`, `.mjs`, `.ts`. They must be written into `VOICE.md` and encoded in `scripts/brand-voice-vocabulary.cjs` in the same change that publishes this document, or the directive lives only in chat and dies there.

Superseded and to be deleted: `voice_system_v2.md` (already a retirement stub), the "five voice attributes" model in `marketing_brain_skills/brand-voice/SKILL.md`, and `.cursor/rules/blog-voice.mdc`'s independent banned-word list.
`GATE: ci:brand-voice` (Laws 1–4 patterns are in `BANNED_PATTERNS`) · **Orwell layer: ungated, must be added** ⚠
*Merged from: CLAUDE.md §Brand Voice, VOICE.md, voice_guidelines.md, brand-voice/SKILL.md, .cursor/rules/blog-voice.mdc*

### 2.2 Banned punctuation
Em dash `—`, en dash `–`, and semicolon `;` are banned outright in public-facing copy. Dramatic colons banned in body prose. One exclamation per piece maximum, none in market-data content. The em-dash survives in exactly one place: as the data placeholder for "unavailable" in a stats table.

The publish API (`/api/social/publish`) hard-rejects any caption containing an em- or en-dash via `assertNoDashes()` in `lib/punctuation-guard.ts`.
`GATE: ci:brand-voice` (scope: `app/` + `components/`, excluding api/actions/admin) + runtime rejection at `/api/social/publish`
*Merged from: CLAUDE.md, voice_guidelines.md §6, automation_skills/automation/publish/SKILL.md*

### 2.3 Banned vocabulary
Real-estate clichés (stunning, nestled, boasts, charming, pristine, gorgeous, breathtaking, must-see, dream home, meticulously maintained, entertainer's dream, tucked away, hidden gem, truly, luxurious, updated throughout), AI filler (delve, tapestry, robust, seamless, elevate, unlock, holistic, curated, bespoke), marketing slop (top producing, white glove, premier, boutique, your real estate journey, we are passionate about), fake urgency (act fast, won't last), hype openings, pandering.

**Smallness positioning is banned** — "three brokers," "small brokerage," "small team," "boutique." Headcount is not a position and caps the growth story. Survives only in Matt's personal 1:1 correspondence.

**Naming a category or virtue out loud is banned** — "independent brokerage by design," "we're honest / local / dedicated." A licensed active broker is the baseline for a real-estate site, not a selling point. Show it with a concrete fact or cut it.

Full lists live in `scripts/brand-voice-vocabulary.cjs`, which is the executable copy. Prose restatements of the list are the thing being deleted.
`GATE: ci:brand-voice` · *Merged from: CLAUDE.md, voice_guidelines.md §6.2, Design System v2 banned vocabulary, 8+ producer QA tables*

### 2.4 Locked brand values
| Value | Locked to | Note |
|---|---|---|
| Navy | `#102742` / `oklch(0.270 0.058 253.912)` | code-confirmed in `colors_and_type.css` **and** `app/globals.css` |
| Cream | `#faf8f4` | code-confirmed |
| Display face | **Amboqia Boriango** | `design_system/ryan-realty/fonts/Amboqia_Boriango.otf` |
| Body / UI face | **Geist** | via `next/font` |
| Ribbon sub-label | Azo Sans Medium, uppercase, tracked `0.12em` | only surviving AzoSans use |
| Matt's direct phone | `541.213.6706` (dotted) | 29 render references |
| FUB-tracked bio phone | `541.703.3095` | social profiles, ads, inbound lead capture |
| Web | `ryan-realty.com` (hyphenated, lowercase) | |
| Place separator | middle dot `·` — `BEND · OREGON` | |
| Social handle | `@ryanrealtybend` on **every** platform | `/ryanrealtybend` for FB + LinkedIn vanity |
| VO voice | ElevenLabs **Victoria**, ID `qSeXEcewz7tA0Q0qk9fH` | permanent |
| VO settings | `eleven_turbo_v2_5` · stability `0.40` · similarity `0.80` · style `0.50` · speaker_boost `true` | the 0.50/0.75/0.35 tuple is banned |

**Two-color palette only.** `--rr-navy-deep`, `--rr-sand`, `--rr-fir`, `--rr-sky`, and both golds (`#D4AF37`, `#C8A864`) are retired and must not be reintroduced. Use `rgba(16,39,66,0.85)` for hover/pressed and `rgba(16,39,66,0.08)` for borders. White and pure black are permitted only for text-on-photo legibility and scrim layers.

Broker/brokerage facts (phones, handles, social URLs) are imported from `lib/brand/contact.ts` (`BRAND` / `CONTACT` / `BROKERS`) — never typed as literals in render code.
`GATE: ci:design-tokens` (color) + `ci:broker-facts` (phone/handle literals) + `ci:heading-display` (Amboqia on display headings) + `ci:email-brand-tokens`. VO settings: `PROSE ⚠ NEEDS GATE`
*Merged from: CLAUDE.md Design System v2, colors_and_type.css, .cursor/rules/design-system.mdc, 8+ producer QA tables, .claude/skills/frontend-design, skills/youtube-market-reports/brand-system.md*

### 2.5 Format conventions on every numeric surface
Tabular numerals (`font-variant-numeric: tabular-nums`). Currency rounded to the nearest thousand — `$895,000`, never `$894,750`. Days as integer + "days" — `38 days`. Percents carry one decimal and a signed arrow when YoY — `↑ 2.1% YoY`. Unavailable renders as `—`. Sentence case for body headlines; Title Case only for a hero H1. "You/your" is the subject; "we/our team" is the brokerage; "I" only in genuinely first-person content (a VO, a review reply, a personal letter). No emoji in blog, email body, ad headlines, or video on-screen text; one max in a social caption.
`GATE: ci:currency-format` + `ci:date-format` · *Merged from: CLAUDE.md, Design System v2, voice_guidelines.md*

### 2.6 Locked canonical brand assets
- **Hero photo (any banner / cover / header / cinematic anchor):** `design_system/ryan-realty/assets/hero/hero-old-mill-master-4k.jpg`, with per-platform pre-crops in the same folder, top-anchored so the flag stays visible.
- **Heritage wordmark:** `assets/brand/logo-blue.png` — use the pre-rendered image, never re-typeset.
- **Broker headshots:** `assets/team/{matt-ryan,paul-stevenson,rebecca-peterson}.png` — transparent PNG is canonical, `.jpg` is legacy fallback. Never add a background fill, border, or frame-faking drop shadow; the transparent edge is the composition.
- **Listing-agent rule:** per-listing deliverables carry the **listing agent's** headshot, resolved from `listings.ListAgentEmail`. Brand-led content (market reports, news, guides) carries no headshot.
`PROSE` · *Merged from: CLAUDE.md Design System v2, memory reference_broker_headshots*

### 2.7 AI imagery discipline
**Superseded 2026-08-14.** Live standard is `.claude/skills/creative-brain/SKILL.md` law 1: reference-conditioned Central Oregon place work is allowed; prompt-only scenic slop is refuse; do not invent a listing, a room, or the view from an address; charts render in code. Ads that could read as a real property still carry a digitally-created disclosure.
`PROSE` · *Merged from: .claude/skills/creative-brain (2026-08-14)*

---

## 3. Architecture and data

### 3.1 Read the snapshot; never discover schema
`docs/DATABASE_SCHEMA_SNAPSHOT.md` (every column of every public table) and `docs/DAL_INDEX.md` (every DAL function, its tables, columns, cache key, TTL, tags) are read **before** any query is written. Querying `information_schema` for column discovery is forbidden — the answer is already in the snapshot. The one legitimate use of raw `execute_sql` is investigating actual data quality, and even then: read the snapshot first, then run one targeted query.

Both files regenerate via `npm run ci:data-access -- --refresh`. Apply a migration → refresh → commit. Add a DAL function → refresh → commit.
`GATE: ci:data-access` (runs locally + nightly, **not** in the secret-less static chain — it hits live Supabase)
*Merged from: CLAUDE.md Data Access Discipline, memory feedback_no_adhoc_sql, .claude/skills/optimize-data-loading*

### 3.2 Mixed-case columns — the rule has two halves, and only one was ever written down
The `listings` table uses RETS mixed-case column names. **The correct handling depends on the client, and conflating them causes silent failure in both directions.**

- **Raw SQL** (psql, `execute_sql`, hand-written `SELECT`): mixed-case names **must** be double-quoted — `SELECT "StreetNumber", "ListPrice" FROM listings WHERE "StandardStatus" = 'Active'`. Unquoted returns "column does not exist."
- **supabase-js / PostgREST** (all `lib/data/` code): pass the **bare** name — `.eq('ListingKey', key)`. Writing `.eq('"ListingKey"', key)` puts literal quote characters inside the JS string, sends `?%22ListingKey%22=eq.X`, and PostgREST **silently returns nothing**. This shipped as the 2026-05-28 "Listing Not Found" regression.

Quoted-in-SQL columns: `"StreetNumber"`, `"StreetName"`, `"ListPrice"`, `"StandardStatus"`, `"Latitude"`, `"Longitude"`, `"TotalLivingAreaSqFt"`, `"PhotoURL"`, `"SubdivisionName"`, `"ClosePrice"`, `"CloseDate"`, `"CumulativeDaysOnMarket"`, `"BedroomsTotal"`, `"BathroomsTotal"`, `"PropertyType"`, `"OriginalListPrice"`, `"OnMarketDate"`. Lower-case (never quoted): `year_built`, `pending_timestamp`, `price_per_sqft`, `days_to_pending`, `property_sub_type`, `buyer_financing`, `is_finalized`, `history_finalized`.
`GATE: ci:dal-column-quoting` (G17 — catches the supabase-js half)
*Merged from: CLAUDE.md, docs/DATABASE_FOR_AI_AGENTS.md, .cursor/rules/database-canonical-reference.mdc. **The two-half distinction is new** — it exists only in the gate's source comment and contradicts the flat "always quote" instruction all three docs gave.*

### 3.3 Never aggregate raw `listings` for a market report
Read from `market_pulse_live` (10–15 min freshness), `market_stats_cache` (6 hr), or `listing_tile_mv`. `listings` is 589K+ rows; always paginate or aggregate, never `SELECT *` without a tight filter. The snapshot itself carries this instruction.

**`market_pulse_live` has no neighborhood rows** — neighborhood ledgers use `listing_tile_mv` instead.

Registry source of truth for the 14 resort communities + 14 Bend neighborhoods: `data/resort-communities.json`.
`GATE: ci:row-cap` + `ci:resort-definitions` · *Merged from: CLAUDE.md, docs/DATABASE_FOR_AI_AGENTS.md, memory reference_market_pulse_no_neighborhood_rows*

### 3.4 DAL-first, DAL-only
- No raw `.from()` outside `lib/data/`. `GATE: ci:dal-boundary`
- Every `app/<route>/page.tsx` imports `@/lib/data`. `GATE: ci:page-dal`
- If a DAL function in `DAL_INDEX.md` covers the access pattern, call it. Do not write a parallel query.
- A consumer needing only IDs / slugs / display fields gets a **slim select variant**, not a reuse of a wide selector — especially against `listings`.
- Independent DAL calls in a page run via `Promise.all`, never sequential awaits.
`GATE: ci:dal-boundary` + `ci:page-dal` + `ci:dal-actions-reads` + `ci:dal-internal-discipline`
*Merged from: CLAUDE.md, .claude/skills/optimize-data-loading, .cursor/rules/supabase-data-layer.mdc*

### 3.5 Canonical listing URL
`/homes-for-sale/<city>/[<neighborhood>/][<community>/]<address-slug>/<mlsNumber>`, built **only** through the helpers in `lib/slug.ts`. `ListNumber` is the public identifier; `ListingKey` is internal. Legacy `ListingKey` URLs 301-redirect to canonical.
`GATE: ci:canonical-listings` + `ci:legacy-redirects` + `ci:listing-key-lookup` + `ci:seo-routes`
*Merged from: .cursor/rules/data-architecture.mdc, seo-url-guardrails.mdc, ARCHITECTURE.md, AGENTS.md*

### 3.6 Finalization is one-way
A listing is set `is_finalized = true` only when all three hold: `"StandardStatus"` contains `Closed`, `"CloseDate"` is not null, and `history_finalized` is true. A finalized listing is never re-synced or un-finalized.
`PROSE ⚠ NEEDS GATE` · *Merged from: .cursor/rules/sync-pipeline.mdc*

### 3.7 One delta-sync core
The unified fetch → diff → upsert → finalize core is `lib/sync/deltaSync.ts`. A delta-sync implementation is identified by its call to `computeNextDeltaCursor` (`lib/sync/deltaCursor.ts`). The allowlist of files permitted to call it is **ratcheted and may only shrink** — a new caller is a re-fork and fails CI.

Media expansion, identical on both paths: `Photos,FloorPlans,Videos,VirtualTours,OpenHouses,Documents` (`SYNC_EXPAND` in `app/actions/sync-spark.ts:29`, `LISTING_EXPAND` in `lib/spark.ts:403`).
`GATE: ci:delta-sync-core` + `ci:sync-cursor` · *Merged from: docs/plans/DELTA_SYNC_UNIFICATION_HANDOFF.md, docs/VIDEO_DATA_FLOW.md*

### 3.8 The `geo_type='city'` boundary is the TIGER polygon
Bend's `city` boundary is the incorporated-city polygon and intentionally excludes ~239 MLS-tagged-Bend listings sitting in unincorporated Deschutes County. For area-wide semantics use `region='central-oregon'`. All GIS/boundary data comes from official GIS sources — never approximated.
`PROSE` · *Merged from: .cursor/skills/database-canonical-reference/SKILL.md, memory feedback_gis_authoritative_only*

### 3.9 Server actions and Supabase clients
Every server-action file opens with `'use server'` and returns a typed data-or-error shape — never throws. Client selection is context-specific: session-aware client for user-facing reads, service-role client **only** on admin/cron paths unreachable by end users, anon client for public read-only.

Current user comes from `getSession()` in `app/actions/auth.ts` — never `supabase.auth.getSession()` directly. Protected server components redirect before rendering.
`GATE: ci:service-client` + `ci:auth-redirect` + `ci:admin-endpoint-auth` + `ci:admin-role-guard` + `ci:cron-auth` + `ci:server-only-imports`
*Merged from: .cursor/rules/server-actions.mdc, error-handling.mdc, auth-patterns.mdc*

### 3.10 Pure core, thin shell
Data-shaped business logic (pricing, comp filtering, stat derivation, status transitions) splits into a pure core module with no Supabase client and no fetch, unit-tested directly (`lib/cma/pricing.ts`, `lib/cma/contract.ts` are the exemplar), plus a thin untested I/O shell in `lib/data/`. Unit tests never hit hosted Supabase. Complex client state extracts to a pure colocated module tested with plain vitest before wiring into the component.

Tests validate behavior through the same exported interface the app calls — never internal query structure, never types the compiler already proves. Colocated `*.test.ts`.
`GATE: ci:hook-tests` (partial) · *Merged from: .claude/skills/tdd/SKILL.md, DB-TDD.md, FRONTEND-TDD.md*

### 3.11 Admin access model
Admin login is Google-only, no passwords. Access resolves by looking up the signed-in email in `admin_roles` → `superuser` / `broker` / `report_viewer`. Matt Ryan is superuser; Rebecca Peterson Ryser and Paul Michael Stevenson are broker-role, each linked to a `brokers` row.

Capability model is `lib/admin/capabilities.ts` — dot-notation, append-only, co-located across domains. Brokerage-wide commissions and P&L (`commissions.view`, `financials.view`) are superuser-only; brokers see their own rows via row scope. Commission source of truth is the single `tc_commissions` ledger.
`GATE: ci:admin-role-guard` + `ci:admin-content-authz` + `ci:crm-scope`
*Merged from: docs/ADMIN_FIRST_LOGIN.md, docs/plans/ADMIN_REBUILD/01-DECISIONS*

### 3.12 Admin navigation is source-controlled
Admin nav is defined in `lib/admin/nav.ts`, not hand-rolled per page. Locked destination set: Home, Inbox, People, Prospecting, Transactions, Performance, Content, Settings. Superuser nav-item budget ≈ 35. Every legacy admin route gets a permanent redirect-bridge, never a 404. Mobile bottom tabs stay Home / Inbox / People / Deals / Activity.
`GATE: ci:admin-nav-source` + `ci:nav-reachability` + `ci:legacy-redirects`
**Status note:** `/admin/inbox` and `/admin/prospecting` do not exist yet — the destination set is partially unbuilt.
*Merged from: docs/plans/ADMIN_REBUILD/01-DECISIONS*

### 3.13 Admin help is versioned markdown
Knowledge-base articles live as one file per article in `docs/admin-help/*.md` with YAML frontmatter: `title` (sentence case, task-oriented), `area` (Dashboard | CRM | Deals | Reports | Admin), `routes` (prefix-matched admin pathnames), `summary`. `lib/admin-help.ts` reads the directory at render time and serves `/admin/help` and `/admin/help/[slug]`. `README.md` is excluded by filename.
`MACHINERY — loaded at runtime by lib/admin-help.ts.` **Do not delete `docs/admin-help/`.**
*Sole source: docs/admin-help/README.md*

---

## 4. Engineering process

### 4.1 THE LOOP is the development process
All development routes through `docs/DEVELOPMENT_PROCESS.md` **v1.1.0**: ingest telemetry → diagnose → prioritize → fix the class → verify exhaustively → ship → measure → learn → lock behind a gate → compete. Five domain loops (Growth, Demand, Nurture, Transaction, Experience) run over one shared spine, one session per loop; a sixth standing session is a smell. Every agent entry point's version pointer must match the header exactly.
`GATE: ci:process-canon` (G44)
*Merged from: CLAUDE.md, docs/DEVELOPMENT_PROCESS.md, AGENTS.md*

### 4.2 Preflight contract — no change starts blind
Before touching a database or a stat: load `DATABASE_SCHEMA_SNAPSHOT.md` + `DAL_INDEX.md` + the relevant DAL function, and carry a §1.1 verification trace per figure. Before touching a page or surface: load its mockup + its `parity.json` + its canonical data source.
`GATE: ci:page-dal` + `ci:mockup-parity` + `ci:mockup-coverage`
*Merged from: docs/DEVELOPMENT_PROCESS.md*

### 4.3 Escape ledger
Any defect that reaches Matt or production gets three things: the whole class fixed, a new check added, and a row in `process_escape_ledger` (table confirmed present). **"I should have looked at X" is banned** — X becomes a mandatory preflight input.
`PROSE ⚠ NEEDS GATE` · *Sole source: docs/DEVELOPMENT_PROCESS.md*

### 4.4 Prose rules are not real; gates are
`npm run ci:gates` runs the authoritative chain — **126 links** as of 2026-07-21. `package.json` is the list; never re-enumerate it in prose, it drifts. The meta-gate `ci:gates-wired` fails on any `scripts/check-*.mjs` that runs nowhere. The orphan baseline (`scripts/gates-wired-baseline.json`) currently holds **0** files and may only shrink.

**If a guardrail keeps being violated, the answer is a new gate, not more prose.** Pattern documented in `docs/MECHANICAL_GATES.md`.
`GATE: ci:gates-wired` · *Merged from: CLAUDE.md, docs/MECHANICAL_GATES.md, memory feedback_gates_not_prose, feedback_enforcement_over_audits*

### 4.5 Definition of done
A user-visible task is not done without a screenshot proving real data renders, desktop **and** mobile, with zero console errors. A 200 from curl is not proof. Verify the entire surface — above-the-fold is not verification.
`PROSE ⚠ NEEDS GATE` · *Merged from: .cursor/rules/definition-of-done.mdc, memory feedback_verify_before_moving_on + feedback_verify_entire_surface*

### 4.6 Deploy verification is mandatory
`npm run deploy:verify` runs immediately after every push to `main`, polling Vercel for the pushed SHA and exiting non-zero on error. "Pushed = done" is banned. Confirm `origin/main` SHA moved and Vercel built.
`GATE: deploy:verify` (script confirmed: `scripts/check-vercel-deploy.mjs`) · *Merged from: .cursor/rules/deploy-verify-before-done.mdc, memory feedback_verify_push_landed*

### 4.7 Git workflow
Single checkout, `main` only. No `git worktree`, no feature branches, no PRs unless explicitly asked. Before work: `git pull --rebase origin main`. After an **approved** commit: push to `origin` immediately — no locally-parked commits. Migrations apply to hosted Supabase in the same delivery as the code depending on them. Stale `.git/index.lock` files get cleared silently, never reported as a blocker. Push via `npm run push` so gates + build stamp the pre-push marker before the SSH connection opens.
`GATE: pre-push hook (rr-gates-marker)` · *Merged from: CLAUDE.md, AGENTS.md, memory feedback_direct_to_main + feedback_always_push + reference_prepush_marker_npm_run_push*

### 4.8 UI is built from the design system, never hand-rolled
Every UI element uses the themed primitives at `@/components/ui/` (radix-nova re-skinned to the brand). "shadcn" and "the design system" are the same thing here, not a choice. Raw `<button>`, `<select>`, `<input>`, `<table>`, custom modals, custom dropdowns, and hand-rolled progress/skeleton/toggle are banned on product surfaces. Semantic tokens only (`bg-primary`, `text-muted-foreground`, `border-border`, `bg-card`, `bg-background`) — never `bg-white`, `bg-gray-100`, or a hex. `cn()` from `@/lib/utils` is the only className merge helper. Custom classes from `globals.css` (`card-base`, `btn-cta`) are banned.

The per-surface visual target is `design_system/ryan-realty/ui_kits/<surface>/index.html`. 25 `parity.json` contracts exist today and enumerate the components a page must import.
`GATE: ci:design-tokens` + `ci:shadcn-burndown` + `ci:mockup-parity` + `ci:mockup-coverage` + `ci:console-kit` + `ci:dead-ui`
*Merged from: CLAUDE.md Design System Rules, .cursor/rules/design-system.mdc, AGENTS.md, .claude/skills/frontend-design, .claude/skills/hallmark/RYAN-REALTY-NOTES.md*

### 4.9 Admin screens have two contracts
(1) The five-laws HARD/SOFT curation rubric. (2) A component contract requiring `ConsoleSection` / `KpiStrip` on every route in `REQUIRED_KIT_PAGES`.
`GATE: ci:admin-curation` + `ci:console-kit` + `ci:admin-mobile-shell` + `ci:admin-responsive`
*Merged from: docs/ADMIN_DESIGN_STANDARD.md, docs/CONSOLE_KIT.md*

### 4.10 Sliders use arrows, not scrollbars
Carousels and sliders navigate with left/right arrow controls and hide the scrollbar. A bare `overflow-x-auto` with a visible scrollbar is never the primary navigation. Reference: `components/TilesSlider.tsx`.
`PROSE ⚠ NEEDS GATE` · *Sole source: .cursor/rules/sliders-no-scrollbars.mdc*

### 4.11 Page archetypes, not bespoke builds
Six page archetypes built once in the v3/v6 design language; every public route is an instance. `homepage-v6` is the current locked visual authority. Any hero defaults to video > live 3D > photo.
`GATE: ci:hero-image` + `ci:mockup-coverage` · *Merged from: docs/EXPERIENCE_SYSTEM.md, memory feedback_hero_video_default*
**⚠ Open decision — see §6.2.**

### 4.12 Delegate mechanical work off Opus
Codebase enumeration, bulk refactors, reading >10 files, long test suites, and data extraction go to Sonnet/Haiku subagents launched in parallel when independent. Opus keeps architecture decisions, final code review, product trade-offs, and cross-system debugging. Never spawn background subagents for multi-phase pipelines — drive those from the main session.
`PROSE` · *Merged from: CLAUDE.md Opus Orchestrator Policy, memory feedback_no_background_subagents + feedback_parallel_build_agents_orchestration*

### 4.13 SkySlope PDF reading is dual-pass
Every page gets both a pdf.js text-layer pass **and** a mandatory same-page OCR pass, labeled and concatenated in fixed layout — never conditional on text-layer thinness. Implementation: `scripts/skyslope-pdf-insight.mjs`.

Executed-marker detection requires OCR of up to 50 pages (an 8-page cap produced 5.5% detection vs 54% at 50) and per-signer-role validation against the form's signer profile (`single_party` vs `mutual`) — never "any two signatures." Bias toward false-negative. One SkySlope folder per property, not per sale-agreement cycle.

Filename convention: `{SaleAgreementNumber}_{FormName}_X.{ext}` — three underscore-separated fields, no dates, no OREF numbers, no sequence numbers. `SaleAgreementNumber` is OCR'd from the PDF, never synthesized from MLS or folder metadata.

API quirks: PATCH-rename requires the new filename in the **JSON body** (`{FileName: newName}`) — a query parameter returns HTTP 500 every time. Folder-list pagination uses `earliestDate`/`latestDate` as **Unix seconds** with fixed 10 items per page and 1-based `pageNumber`; there is no `pageSize`, so a `rows.length < 50` stop condition only retrieves page one.
`PROSE` · *Merged from: .cursor/rules/skyslope-pdf-analysis.mdc, .cursor/skills/skyslope-file-organization, .cursor/skills/skyslope-api, .claude/skills/skyslope-form-compliance*
**⚠ Conflict — see §6.4 (v4 vs v5 filename convention).**

### 4.14 Meta Marketing API constraints under HOUSING
Ad sets under `special_ad_categories:['HOUSING']`: reject standard Lookalikes (Special Ad Audience LALs only, UI-only), ban `excluded_geo_locations` (error #2909046), block most real-estate `flexible_spec.interests` IDs (#2909049), require omitting WCA `subtype:'WEBSITE'` (removed in Graph v21.0), are incompatible with `frequency_control_specs` under `OFFSITE_CONVERSIONS`, and require `is_adset_budget_sharing_enabled:false` on ad-set-budget campaign creation.
`PROSE` · *Sole source: .cursor/skills/facebook-seller-growth/SKILL.md*

### 4.15 Word/.docx generation
`TextRun` size is in half-points (24 = 12pt); body text stays ≥ 24 for long passages. Prefer stacked bold-label/value paragraphs over tables for many-field records. Unavoidable tables use `layout: TableLayoutType.FIXED`, percentage widths summing to 100, `VerticalAlign.TOP` on every cell, capped at 4–5 columns. Reference implementation: `scripts/skyslope-forms-principal-brief-docx.mjs`.
`PROSE` · *Sole source: .cursor/skills/professional-word-docx/SKILL.md*

---

## 5. Content and marketing production

### 5.1 The marketing action protocol
Every marketing action gets exactly one row in `public.marketing_brain_actions`. Status flow is strict:
`pending → in_production → ready → approved → executed → measured`, with `killed` as terminal.

Approval by category: `content:*` = matt-review-draft · `site:*` = matt-review-PR · `ops:*` = matt-explicit (named in conversation, never inferred) · `comms:*` / `analyze:*` = none.

Every `content:*` action dispatches through `automation_skills/content_engine/SKILL.md` — never a producer directly. Non-content actions dispatch to `assigned_producer/SKILL.md`. Producer paths resolve through `marketing_brain_skills/producers/REGISTRY.md`; never hard-code one.
`MACHINERY — REGISTRY.md and every dispatchable SKILL.md are read at request time by app/api/cron/producer-runtime/route.ts (classifyProducerFromDisk).` **Do not delete producer SKILL.md files that REGISTRY rows point at.**
*Merged from: CLAUDE.md Marketing Brain Architecture, REGISTRY.md, memory feedback_brain_pipeline_protocol*

### 5.2 Producer-layer growth freeze
The execution scaffold is frozen at its 2026-06-09 footprint. No new producers, no new REGISTRY rows, no new dispatcher choreography, no new content crons. The REGISTRY row count only ratchets down (baseline: 116). Regenerating the baseline requires Matt's explicit unfreeze in the transcript, cited in the commit message. Unfreeze condition: ten real posts through approve → publish → measure yielding a decision-grade insight.

Content is produced in-session via `marketing_brain_skills/produce/`, still writing the action row, still routing through approval, still measured.
`GATE: ci:producer-freeze` (G45) · *Merged from: CLAUDE.md, REGISTRY.md*

### 5.3 The cloud cron can only complete text
`/api/cron/producer-runtime` executes a producer only when its SKILL.md frontmatter declares `output_type` in `{text, operational, paid-ad, backend-service}`. Anything in `{video, image, document, pdf, carousel, reel, flyer, web-page}` — or undeclared — is refused and deferred to the local render worker. This exists to stop the model fabricating a `draft_path`, citations, and a scorecard for a deliverable it never rendered.
`MACHINERY — lib/marketing-brain/producer-output-class.ts, enforced at app/api/cron/producer-runtime/route.ts:175-213.`
*New to canon — was documented nowhere in CLAUDE.md.*

### 5.4 Video producers are decommissioned from brain dispatch
Per Matt's 2026-06-14 directive, every video-deliverable producer was removed from `REGISTRY.md`. Video `content:*` action types resolve to no producer and can never be dispatched. The Remotion code remains on disk but is not brain-callable.

**Consequence for consolidation:** `lib/marketing-brain/generate-briefs.ts` (`FORMAT_ROUTE_MAP`), `lib/marketing-brain/inbox-producer-registry.ts`, and `scripts/run-producer.mjs` still hardcode ~18 routes to deleted `video_production_skills/*` paths. Generating a brief in any of those formats dispatches to a path that fails at runtime. **This must be fixed in the same change that publishes this document.**
`PROSE ⚠ NEEDS GATE` · *Merged from: REGISTRY.md banner + code verification*

### 5.5 Video hard constraints (inlined — every cited file is gone)
CLAUDE.md cites 30 distinct `video_production_skills/*.md` paths 49 times. **The directory contains exactly three files:** `captions/canonical/SingleWordCaption.tsx`, `load-amboqia.ts`, `safe-zones.ts`. Every pointer is dead. The numeric constraints worth keeping, inlined:

- **Format:** 1080×1920 portrait, 30 fps, h264 + aac, faststart, < 100 MB.
- **Length:** 30–45s for viral cuts, never over 60s. Long-form market reports may reach 60s. TikTok educational ceiling 90s.
- **Hook:** motion by frame 12 (0.4s), on-screen text by frame 30 (1.0s), first spoken word is content. No logo card, no title-on-black, no agent intro, no "REPRESENTED BY."
- **First frame is the thumbnail (ship-blocker):** real photo content, strong contrast. Banned at t=0: pure black (luma < 30), pure white, solid brand-color background, wordmark alone, sponsor card, focus-pull-from-black. Enforced by `scripts/check_first_frame.py` (luma 30–240, variance ≥ 250, saturation ≥ 8 mid-luma).
- **Beats:** 2–3s standard, 4s absolute max, ≥ 12 beats in a 45s video, ≥ 3 distinct motion types. Each beat uses a different camera move — never the same zoom twice consecutively, never generic center Ken Burns.
- **Text safe zones** (import from `video_production_skills/captions/canonical/safe-zones.ts`, never hardcode): portrait working area x 90–990, y 280–1480; avoid top 0–280, right 960–1080, bottom 1480–1920. Landscape x 90–1830, y 80–1000. Square x 90–990, y 90–1010.
- **Captions (locked 2026-05-20):** ONE word at a time, large, centered, **Amboqia Boriango**, white with soft drop shadow, no pill, no gold. Synced to ElevenLabs `/v1/forced-alignment` word timestamps — never clock slots or `<Sequence>` boundaries. Crossfade ≤ 100ms between adjacent words (`CROSSFADE_SEC = 0.08`); gaps > 500ms render true silence. Caption zone portrait y 1280–1460, x 90–990. Landscape y 880–1000. Square y 850–1010. **Nothing else may enter the caption zone.** Component: `SingleWordCaption.tsx`.
- **Text motion:** text is fixed. Only photos move. Never zoom baked-in text.
- **Pacing:** no scene with readable text under 2.5s; text-heavy openings hold ≥ 3s.
- **Brand in frame:** zero logo/brokerage name/phone/agent name/URL for news, market, area, meme, and evergreen cuts. Listing videos carry the logo only in the 200px footer bar.
- **Listing overlay system:** two layers, byte-identical across a batch. Layer 1 text-zone scrim `rgba(0,0,0,0.40)`, hard rectangle, no feathering, no text-shadow, no drop-shadow. Layer 2 logo footer bar `rgba(0,0,0,0.70)`, 200px tall, flush bottom, logo 580px wide, vertically centered, no drop shadow. Clean unobstructed photo between the two.
- **Render:** `--codec h264 --concurrency 1 --crf 22 --image-format=jpeg --jpeg-quality=92`. Concurrency 1 is required (Chrome OOMs higher).
- **Quality gate before approval:** duration in range · `blackdetect` strict (`pix_th=0.05`) returns zero · first-frame check passes · register change at 25% · pattern interrupt at 50% · kinetic reveal in final 15% · no frozen frames · no black bars at transitions · banned-words grep clean · every number carries units and traces to `citations.json` · file < 100 MB.
- **Viral scorecard minimums:** listing 85 · market data 80 · neighborhood 80 · meme 75 · earth zoom 85 · news 80 · default floor 80. `scorecard.json` and `citations.json` ship next to the render.
- **Logo timing (platform rule):** the logo is a closer, not an opener. No in-frame logo on any short-form. Permitted at end cards, YouTube branding watermark after 0:30, carousel final slides, email headers, print, and paid lead-gen creative.

`PROSE ⚠ NEEDS GATE` — only `check_first_frame.py` is mechanized, and nothing calls it from `ci:gates`.
*Merged from: CLAUDE.md Video Build Hard Rules + Captions + Pacing sections, video_production_skills/captions/canonical/*, social_media_skills/platform-best-practices/SKILL.md, memory feedback_video_motion_text_fixed*

### 5.6 IPA pronunciation library
IPA phoneme tags work on `eleven_turbo_v2_5` (canonical) and `eleven_flash_v2`; they are silently **skipped** on `eleven_v3`. Locked pronunciations: Deschutes `dəˈʃuːts` ("duh-shoots") · Tumalo `TUM-uh-low` (never "TOO-muh-low") · Paulina `pol-EYE-nuh` · Madras `MAD-russ` · Tetherow · Awbrey · Terrebonne. Numbers are spelled out for ingestion. `previous_text` chains across lines for prosody continuity.
`PROSE` · *Merged from: CLAUDE.md, memory feedback_deschutes_pronunciation*

### 5.7 Static-format canvas registry
These belong in a **JSON data file**, not prose repeated across 12 producer files:

| Format | Spec |
|---|---|
| IG feed / carousel / Stories | 1080×1350 portrait (default) or 1080×1080 square |
| LinkedIn document carousel | 8–12 slides at 1080×1080 (or 1080×1350), single vector PDF, market-insight framing never a brochure |
| Yard sign main panel | 18×24in + 0.25in bleed = 5550×7350 @ 300 DPI |
| Yard sign rider | 6×24in + 0.25in bleed = 7350×1950 @ 300 DPI |
| Yard sign phone type | Geist 700, 160px, navy, tabular-nums, `541.213.6706` |
| USPS farm mailer | 6×9in default or 4×6in @ 300 DPI, USPS address clear zone + IMb space reserved |
| Mailer QR | 300×300px, ECC level M (15%) to survive postal handling |
| Neighbor outreach | Avery 5160 labels, 20–40 nearest geocoded neighbors, 8.5×11in 300 DPI CMYK card + 1080×1400 sRGB digital proof |

`PROSE ⚠ SHOULD BE A DATA FILE` · *Merged from: 12 producer SKILL.md QA tables*

### 5.8 Facebook lead form field cap
Paid lead-gen forms cap at **3–5 fields**. Each field above 5 drops completion 5–15%.
`PROSE` · *Merged from: social_media_skills/facebook-lead-gen-ad + platform-best-practices*

### 5.9 Blog publishing path
Blog posts are rows in the Supabase `blog_posts` table rendered by the live Next site — **not** AgentFire WordPress. Content is body-only HTML; author resolves from the `brokers` row.
`GATE: ci:content-schema` + `ci:content-metadata` + `ci:content-freshness` + `ci:content-uniqueness`
*Merged from: memory reference_blog_publish_path*

### 5.10 Social publish path limits
One image per post maximum. LinkedIn is video-only on this path. X blocks duplicate content. Every publish attaches native media — no bare-text posts.

The publish gate rejects any call whose `gate` object is missing `manifestoPath` / `citationsPath` / `scorecardPath` / `qaReportPath` / `postflightPath` / `humanApprovedAt`, or whose `humanApprovedAt` is more than **7 days** old.
`MACHINERY — validateGate() in app/api/social/publish/route.ts` · *Merged from: automation_skills/automation/publish/SKILL.md, memory reference_social_publish_path_limits + feedback_native_media_required*
**⚠ Note:** the gate demands a `manifestoPath` pointing at `ANTI_SLOP_MANIFESTO.md`, which no longer exists. See §7.

### 5.11 CMA is a recorded deliverable
Every finalized CMA is a row in `public.cmas` (≈175 rows) with `cma_comps` linking the comps used. Output is a 15-page branded HTML CMA: subject + 6–10 comp flyers + branded map + two-method pricing. Signed by the broker handling the listing, resolved from `public.brokers` by email or slug, falling back to Matt.
`GATE: ci:cma-routing` · *Merged from: marketing_brain_skills/producers/cma/SKILL.md*

### 5.12 Media sourcing order
Asset library → Unsplash → Shutterstock → AI generation. The library manifest is `data/asset-library/manifest.json` (1,104 photos, vision-graded, searchable on `vision_*` fields), CLI at `lib/asset-library.mjs`. No photo repeats within a single render.
`GATE: ci:asset-register-dedup` · *Merged from: CLAUDE.md, memory reference_asset_library_visual_catalog*

### 5.13 UTM convention
`docs/UTM_TRACKING_CONVENTION.md` is the single source for parameters on every published link. `components/GoogleAnalytics.tsx` auto-detects `fbclid` / `gclid` / `ttclid` / `msclkid` but cannot separate organic-search channels without explicit UTMs.
`GATE: ci:tracking-policy` (partial) · *Sole source: docs/UTM_TRACKING_CONVENTION.md*
**Note:** the per-channel table was not line-by-line verified. Spot-check before folding into the canonical doc.

### 5.14 GBP category honesty
Never add a Google Business Profile category or attribute for a service not actually offered, even if every competitor lists it. Category stuffing is both a compliance exposure for a licensed brokerage and a known GBP suspension trigger.

Local-SEO scope (GBP categories, attributes, posts, photos, reviews, citations) and website-SERP scope (titles, meta, on-page depth, JSON-LD, vitals) are mutually exclusive. A finding for the wrong scope gets filed to the other loop, never executed in place.
`PROSE` · *Merged from: .claude/skills/local-seo*

---

## 6. CRM and workflows

### 6.1 FUB is decommissioned — the in-house CRM is the system of record
Follow Up Boss was fully decommissioned **2026-06-24**. `getFubApiKey()` always returns `undefined`; `CRM_LEAD_BACKEND` defaults to `'native'`. There is no remaining cutover flip. All dashboards count leads from `crm_people` via `getLeadIntake`.

Every doc that describes FUB as live infrastructure is dead: `docs/CRM_INTEGRATION.md` (its G49 "must POST to FUB" contract is inverted), `docs/TC_SYSTEM.md`, `docs/MARKETING_LEAD_FLOW.md`, `docs/FUB_SELLER_WORKFLOW_2026-05-17.md`, `docs/FUB_CUSTOM_FIELDS.md`, `docs/FUB_BROKER_DIGESTS.md`, `docs/FUB_SMART_LISTS_STARTER_PACK.md`, the whole `docs/fub-crm-spec/` and `docs/fub-feature-audit/` trees, and all three `docs/broker-runbooks/*.md`.
`GATE: ci:crm-lead-integrity` + `ci:crm-secrets` · *Merged from: 9 docs + code verification*

### 6.2 One send interface
Every SMS renders `components/admin/crm/SmsComposer.tsx`. Every email renders `EmailComposer.tsx`. Bulk hosts that own audience and scheduling render the shared `EmailBodyEditor.tsx`. Hand-rolled compose UIs are banned.
`GATE: ci:composer-discipline` (G50) · *Merged from: memory reference_crm_canonical_composers, docs/plans/ADMIN_REBUILD*

### 6.3 At-most-once mutation
One generic `crm_idempotency_keys` table backs every at-most-once mutation. Group sends key **per recipient** so a retry never re-texts someone already reached.
`PROSE ⚠ NEEDS GATE` (table confirmed present) · *Merged from: docs/plans/ADMIN_REBUILD/01-DECISIONS*

### 6.4 Enrollment epoch
`ENROLLMENT_EPOCH = '2026-06-10T00:00:00Z'` (`lib/crm/enroll.ts:14`). Contacts created before it are never auto-enrolled into sequences, so the historical book is never mass-enrolled.
`GATE: partial` — code-confirmed constant; `ci:crm-fail-closed` covers the adjacent hard-stop path. *Merged from: .claude/skills/crm-e2e*

### 6.5 Automation stages drafts; brokers send
Automated comms only ever stage drafts. The cron auto-enrolls leads into plans — **no manual stage change is required for enrollment** (locked 2026-05-22). All three broker runbooks still instruct "do not skip the stage change"; only Matt's was half-corrected and it self-contradicts. The cron is authoritative.
`PROSE ⚠ NEEDS GATE` · *Merged from: docs/broker-runbooks/{matt-ryan,paul-stevenson,rebecca-peterson}.md — all three delete after this rule is recorded*

### 6.6 Lead routing
Distribution is source-to-broker strategies plus round-robin. **Ponds and group first-to-claim are removed** (data preserved, UI and routing paths deleted).

Per-broker attribution: URL param `?agent=<slug>` (`matt` / `matt-ryan` / `rebecca` / `rebecca-peterson` / `paul` / `paul-stevenson`) → `components/AgentAttributionBridge.tsx` writes the `rr_agent_attribution` cookie (90-day TTL) → `readAttributedAgentServer()` in `app/actions/agent-attribution-read.ts` overrides default routing. Default: all leads to Matt.
`PROSE ⚠ NEEDS GATE` · *Merged from: docs/plans/ADMIN_REBUILD, CLAUDE.md*

### 6.7 CMA-in-seconds budget
From a new-lead notification tap to a kicked-off CMA build: **≤ 3 taps and ≤ 30 seconds on mobile**, using the full deterministic async `buildCma` (no instant-estimate engine). Last measured production pass: 2 taps / 17.5s. Review and send stay draft-first; nothing auto-sends.
`PROSE` (measured, not gated) · *Merged from: docs/plans/ADMIN_REBUILD/LITMUS.md*

### 6.8 The compliance-critical kept core
These are never discarded or forked during any rebuild: the SMS/email compliance chain (suppression, quiet hours, A2P, signed webhooks), the `buildCrmPeopleQuery` AST compiler, the bulk-job framework, the CMA/BPO send libraries, the `listing_alerts` pipeline, and the sequence-engine cron.
`PROSE` · *Merged from: docs/plans/ADMIN_REBUILD/00-REASONING + README*

### 6.9 Inbound text routing
Inbound texts forward to the broker's cell. CRM replies send from the business line. Four numbers, no proxy pool. Send `MessagingServiceSid` and `From` together — raw-`From` alone can sit queued an hour on AT&T.
`PROSE` · *Merged from: memory reference_crm_inbound_text_routing + reference_twilio_a2p_messaging_service_routing*

### 6.10 E-sign signing order
Envelope recipients carry a `signing_order`. Recipients at a later order are notified only after every earlier order completes; parallel within the same order. Tables confirmed: `tc_envelope_recipients.signing_order`, `tc_envelope_fields.recipient_id`.
`PROSE ⚠ NEEDS GATE` · *Merged from: .claude/skills/tc-builder*

### 6.11 `site_signal` scope contract
Per-page analysis filters to page scope. Scope-level rollups never enter per-page aggregations. Query-level rows carry their own scope. Page and query coverage is capped to a daily top set — **an absent row is not a zero.**
`PROSE ⚠ NEEDS GATE` · *Merged from: .claude/skills/growth-loop*

---

## 7. Contradictions resolved

| # | Contradiction | Positions | Verdict from code | Surviving rule |
|---|---|---|---|---|
| 1 | Delta sync cadence | `sync-pipeline.mdc`: every 10 min · `ARCHITECTURE.md`: every 15 min | `vercel.json`: `3,18,33,48 * * * *` | **15 min.** §3.7 |
| 2 | Full sync cadence | `docs/SYNC.md`: every 10 min via Vercel cron, delta every 2 min via Inngest | `vercel.json`: `sync-full` = `0 2 * * 0` (weekly Sun 2am); delta = Vercel cron not Inngest | **Weekly full, 15-min delta, Vercel cron.** `docs/SYNC.md` is dead. |
| 3 | Marketing cron cadence | CLAUDE.md: dispatcher 15min / runtime 30min / sweep 10min | `vercel.json`: dispatcher hourly, runtime hourly, sweep `*/30` | **Hourly / hourly / 30 min.** CLAUDE.md text is wrong. |
| 4 | Cron count | `ARCHITECTURE.md`: 37 | `vercel.json`: **49** | Never state a count in prose. |
| 5 | Gate count | CLAUDE.md: "~60" | `package.json`: **126** links | Never state a count in prose; `package.json` is the list. §4.4 |
| 6 | Orphan gates | CLAUDE.md: 7 tracked orphans | `gates-wired-baseline.json`: `files: []` = **0** | Zero orphans. §4.4 |
| 7 | Producer runtime enabled | CLAUDE.md: `PRODUCER_RUNTIME_ENABLED=true` in Vercel prod | `loop-health-check/route.ts:145` reports `false` | **Autonomous producer runtime is dark in production.** |
| 8 | Producer count | CLAUDE.md: 80 brain-callable + 8 skill-only | REGISTRY.md (2026-06-14) after video decommission: 56 rows; freeze baseline: 116 names | Never state a count; REGISTRY.md is the list. |
| 9 | Measurement intervals | `measurement-loop/SKILL.md`: 24h/7d/30d | `lib/marketing-brain/measurement-loop.ts`: **48h/7d/30d**, columns `metrics_48h/_7d/_30d`, crons `performance-pull-48h/-7d/-30d` | **48h / 7d / 30d.** |
| 10 | Voice canon | CLAUDE.md + VOICE.md: Five Laws, locked 2026-06-13 · `brand-voice/SKILL.md`: "five voice attributes," no mention of VOICE.md · `voice_guidelines.md`: two stacked banners, the lower one naming the retired `voice_system_v2.md` · `.cursor/rules/blog-voice.mdc`: its own independent list | `brand-voice-vocabulary.cjs:167` comment: "the VOICE.md laws, hard-coded (added 2026-06-13)" | **VOICE.md Five Laws + Orwell's six.** All three competing sources delete. §2.1 |
| 11 | ElevenLabs settings | `docs/research/elevenlabs-victoria.md`: 0.50 / 0.75 / 0.35 · CLAUDE.md: 0.40 / 0.80 / 0.50, old values explicitly banned | CLAUDE.md is later (2026-05-07) and the research doc is the banned tuple | **0.40 / 0.80 / 0.50.** §2.4 |
| 12 | Caption format | `platform-best-practices/SKILL.md` + `youtube-market-reports/*`: full-sentence active-word highlight, zone y 1480–1720 · CLAUDE.md: single-word Amboqia, zone y 1280–1460 | 2026-05-20 lock explicitly supersedes 2026-05-07; the older coords sit inside the platform action UI | **Single-word Amboqia, y 1280–1460.** §5.5 |
| 13 | Brand-system authority | `youtube-market-reports/brand-system.md`: "single source of truth," lists fir / sky / gold · CLAUDE.md Design System v2: those tokens retired, `design_system/ryan-realty/` is the source | Later directive (2026-05-13); `colors_and_type.css` confirms navy + cream only | **Navy + cream. `design_system/ryan-realty/` is authority.** §2.4 |
| 14 | Social handles | `social-channel-specs.md`: "ryanrealtybend (or ryanrealty)" / "(or mattryan-bend)" · CLAUDE.md: locked | Locked 2026-05-13; render code uses `@ryanrealtybend` | **`@ryanrealtybend` everywhere.** §2.4 |
| 15 | Meta token status | `api_knowledge/SKILL.md` contradicts itself in one file: matrix says EXPIRED, constraints say LIVE | CLAUDE.md's own correction (2026-05-06) says the "expired" claim was stale | **Live.** `ci:meta-token` exists as the runtime check; never assert token state in prose. |
| 16 | Meta audience IDs | `facebook-seller-growth/SKILL.md` self-contradicts: 2026-05-26 block lists 9 "canonical" IDs, 2026-06-09 block says they're stale | Later block wins | **Never record audience IDs in prose.** |
| 17 | Production domain | `docs/SITE_SPEC.md`: prod is `ryanrealty.vercel.app`, `ryan-realty.com` is WordPress | Cutover completed 2026-07-07; vercel.app now redirects | **`ryan-realty.com` is production.** `SITE_SPEC.md` is dead. |
| 18 | Paid funnel status | `FACEBOOK_SELLER_GROWTH_PIPELINE.md` (2026-05-11): all five layers live · `PAID_FUNNEL_DASHBOARD_RUNBOOK` (2026-06-02): every campaign paused | Later doc wins | **Status belongs in a dashboard, never in prose.** Both docs delete. |
| 19 | Broker stage change | `matt-ryan.md` self-contradicts within one file; Paul's and Rebecca's runbooks were never corrected | Cron auto-enrolls (locked 2026-05-22) | **No manual stage change required.** §6.5 |
| 20 | FUB decommission date | `FUB_FEATURE_AUDIT.md` captured 2026-06-25 as an operating manual, one day after decommission | Code: `getFubApiKey()` returns undefined | **2026-06-24 is the decommission date.** §6.1 |
| 21 | G44 rogue-plan scope | `DEVELOPMENT_PROCESS.md` claims G44 fails the build on any unregistered plan doc | `check-process-canon.mjs:65` — non-recursive `readdirSync('docs/plans')`, top level only. All 29 `docs/plans/ADMIN_REBUILD/**.md` sat unregistered without tripping it | **The gate is top-level only.** Either make it recursive or stop claiming full coverage. |
| 22 | Skills registry | `docs/plans/GLOBAL_SKILLS_REGISTRY.md` (mtime 2026-04-22) vs `~/.claude/GLOBAL_SKILLS_REGISTRY.md` (2026-07-11) | 3 months stale | **The `~/.claude/` copy is canonical.** Drop the mirror and repoint CLAUDE.md. |
| 23 | Master plan authority | `DEVELOPMENT_PROCESS.md`: master-plan.md is superseded, archive · `master-plan-protocol.mdc` (`alwaysApply: true`) enforces it · `AGENTS.md` treats its ownership matrix as a live step | DEVELOPMENT_PROCESS.md is v1.1.0, locked 2026-06-09, gate-backed | **THE LOOP supersedes.** Delete `master-plan-protocol.mdc`; strip the AGENTS.md step. |
| 24 | Delta-sync plan status | Canon registry tags `DELTA_SYNC_UNIFICATION_HANDOFF.md` "open input" · the file says DONE 2026-07-20 | `ci:delta-sync-core` is in the chain; `lib/sync/deltaSync.ts` exists | **Done.** |
| 25 | Saved-search / lifecycle plan status | Canon tags them "live" (in flight) | Subscriptions hub, `listing-alert-email.ts`, `market-report-optin.ts`, `cma-build-worker`, `newsletter-monthly-draft`, `lib/email/shell.ts` all present | **Shipped.** |
| 26 | FUB spec gap map | `21-gap-map-vs-inhouse-crm.md`: 13 reports and company settings "missing entirely" | `app/admin/(protected)/crm/reporting/` has all 13 + overview; `crm/settings/company/` exists; `crm_company_settings` is in the schema snapshot | **Built.** Gap map is dead. |
| 27 | A2P status | `.claude/skills/crm-e2e` embeds a 2026-06-11/12 rejection narrative | Memory `reference_twilio_a2p_status`: verified, outbound SMS live, re-verified 2026-07-13 | **A2P verified, SMS live.** |
| 28 | `ci:lighthouse` / `ci:a11y` | AGENTS.md cites them as CI steps; both **missing** from `package.json`; `.github/workflows/{ci,quality}.yml` invoke them | Two CI workflow steps are currently broken | **Genuinely broken CI.** Fix in the same change: either add the scripts or repoint the workflows at `quality:lighthouse` / `ci:kb-a11y-static`. |

### Open decisions only Matt can make — do not invent an answer

1. **Design-language generation.** Canon marks both `KB_SITE_CONVERSION_GOAL.md` ("kinetic-brutalist," locked 2026-06-18) and `EXPERIENCE_SYSTEM.md` (v3 archetypes, 2026-07-10) as live for what reads as the same rebuild. EXPERIENCE_SYSTEM.md never uses the words "KB" or "kinetic-brutalist," yet the repo has 8 `ci:kb-*` gates in the chain and a whole `components/site/kb/` tree. **Which is the design language?** Both are currently enforced.
2. **`docs/avatar-market-channel/`.** A 2026-06-30 from-scratch spec for an autonomous AI-avatar video channel, versus the 2026-06-14 directive decommissioning every video producer including `avatar_market_update` by name. **Live initiative or dead?**
3. **SkySlope filename convention.** `.cursor/skills/skyslope-file-organization` locks v4 (`{SaleAgreement}_{FormName}_X.ext`). `.claude/skills/skyslope-form-compliance` locks v5 (`{SaleAgreement}_X_{Form#}_{FormName}.ext`). Both claim to be locked. Both have live scripts. **Which ships?**
4. **Search-preset content depth.** `growth-loop` says it yielded the work to Experience family 3; `experience-rollout` lists it as item 3 still queued behind the homepage. **Which loop owns it?**
5. **`docs/plans/` deletion has three live dependencies.** `scripts/orchestrate.ts` hardcodes and `JSON.parse`s `docs/plans/task-registry.json`; CLAUDE.md names `docs/plans/CROSS_AGENT_HANDOFF.md` as the tool-switch protocol target (newest entry 2026-07-17, actively used); CLAUDE.md names `docs/plans/GLOBAL_SKILLS_REGISTRY.md` as a fallback. **Where do the registry and the handoff file live after consolidation?** Nothing can be deleted until this is answered.
6. **Anon access to off-market statuses.** Closed / Withdrawn / Expired / Canceled exposure on raw `listings` via PostgREST is unresolved — same class as the fixed Coming-Soon leak. `activity_events` has permissive (`USING true`) RLS and broadcasts over Realtime; a `new_listing` event on a Coming-Soon listing could reach subscribed browsers. Not confirmed leaking. **Needs a security decision.** `ci:public-listing-status` covers part of this today.

---

## 8. Rules dropped

### Contradicted by code (the doc claims X, the code does Y)

| Claimed | Code actually does |
|---|---|
| Virtual staging burns a "Virtually staged" watermark into the image (NAR disclosure) | `scripts/build_virtual_staging.py` writes disclosure text to a separate `disclosure.md` sidecar. Zero watermark in the image-writing path. If the PNG is distributed without its sidecar there is **no disclosure at all** — this is a live compliance hole, not just a doc error. |
| Virtual staging is scoped to furniture / rugs / art, no structural alterations | Not code-enforced at all. Depends entirely on the `adirik/interior-design` prompt staying in bounds. |
| Meme captions are never AI-generated; Matt writes every punchline | `scripts/build_meme_lord.py` hardcodes fixed `SETUP_LINES` / `STAT_LINE` / `PAYOFF_LINES` from market data. No code path exists for Matt to supply a punchline. |
| `sendGovernedSms` / `sendGovernedEmail` are the one send chokepoint | Neither function exists. Real chokepoints: `lib/resend.ts` + `isSuppressed()`, and `lib/crm/twilio.ts` + `lib/crm/sms-delivery.ts`. Restated as §1.7. |
| `CONTEXT.md` at repo root is the ubiquitous-language document | `CONTEXT.md` does not exist. |
| CLAUDE.md's `video_production_skills/*` reading list (30 paths, 49 citations) | Directory holds three `.ts`/`.tsx` files and zero markdown. Constraints inlined as §5.5. |
| `docs/FUB_BROKER_DIGESTS.md`: `FOLLOWUPBOSS_API_KEY` powers `/api/cron/daily-broker-digest` | That route has zero FUB references; it imports `getBrokerDigest` and reads `crm_people` / `crm_tasks` directly. |
| `docs/CRM_INTEGRATION.md`: every inbound lead must POST to FUB `/v1/events`, gate G49 | `lib/followupboss.ts` `sendEvent()` carries "FUB DECOMMISSIONED (cutover 2026-06-24)" and writes to `crm_people`. |
| Broker runbooks: `detect-expired-listings` hourly, `daily-broker-digest` 8am, `weekly-pipeline-digest` Mon 8am, `seller-workflow-pause` every 15 min | None of the four appear in `vercel.json`'s 49 crons. The route folders exist unscheduled. Expired detection now runs inside `sync-delta`. |
| `contact-playbook.md` cites `scripts/westside-bend-build-fub-import.mjs`; `westside-fub-smart-lists-setup.md` cites `scripts/westside-bend-fub-smart-lists.mjs` | Neither file exists. |
| `.claude/skills/facebook-seller-growth` cites `scripts/meta-rebuild-fub-audiences.mjs` as ready | File does not exist. |
| `automation_skills/triggers/listing_trigger`: `supabase/functions/listing-trigger/`, `/api/webhooks/listing-new`, `/api/cron/listing-watch`, `/api/workers/content-job`, tables `automation_runs` / `content_jobs` / `thumbnail_jobs` | None of these paths, routes, or tables exist. |
| `automation_skills/automation/qa_pass`: `scripts/qa-banned-words.sh`, `qa-frame-checks.ts`, `qa-scorecard.ts` | None exist. |
| `skills/youtube-market-reports/pipeline.md`: Inngest fn `market-report/generate` with `waitForEvent('script-approved')`; `storyboard-template.md`: components `AnimatedLineChart`, `MarketGauge`, `BendZipMap`, etc. | `/api/cron/market-report` only calls `generateWeeklyMarketReport()`. `lib/inngest.ts` is a 21-line bare event sender with zero defined functions. None of the named components exist. |

### Dropped as advisory, aspirational, or non-behavior-changing

Instagram content mix (40/25/20/15) · "first contact in 5 min converts at 21×" · the Hallmark theme-pinning note (subsumed by §2.4's palette lock) · `.cursor/skills/README.md`'s skill index (already wrong — 4 of 7 folders omitted) · the "frontend pre-ship checklist" (its enforceable parts are already §4.8 gates; the rest is self-scoring) · external-API-documentation authoring conventions · CRM stage-transition automation (explicitly deferred, unbuilt, no matching code) · `social-channel-specs.md` and `references/production-scripts.md` in full (every path targets a `/BRAND MANAGER` and `/SOCIAL MEDIA MANAGER` directory tree that does not exist on this machine — written for a different project) · the `.gitignore` skill-exception comment (tracks 12 directories, names 8).

---

## 9. Gate-gap register — prose rules that should be mechanized

Ordered by cost of the failure they prevent. Matt's principle is that ungated prose gets ignored; this is the backlog that principle implies.

| Rank | Rule | Why it must be a gate |
|---|---|---|
| 1 | **§1.11 Fair Housing** | Highest license exposure in the entire rule set and enforced by nothing. A word-list scan over listing descriptions, ad copy, and captions is straightforward. |
| 2 | **§1.1 verification trace** | The §0 mandate that outranks everything else has zero mechanical backing. A gate asserting `citations.json` exists and every rendered figure appears in it is buildable today. |
| 3 | **§1.12 MLS char caps** | A 1,001-character Public Remarks is a hard MLS rejection and a trivial `length` assertion. |
| 4 | **§1.10 relisted guard** | Implemented in two files with nothing preventing a third send path from skipping it. Mirror the `ci:email-send-gated` pattern. |
| 5 | **§1.8 quiet hours** | Same shape: the constant exists, nothing asserts every send path consults it. |
| 6 | **§2.1 Orwell layer** | New directive, currently in chat only. Encode in `brand-voice-vocabulary.cjs` or it dies. |
| 7 | **§1.2 stored-MoS ban** | `ci:market-formula` catches the wrong formula and inline thresholds but not a read of `market_pulse_live.months_of_supply` — the exact failure that flips a verdict. |
| 8 | **§1.3 / §1.4 aggregation floors + bad columns** | `>= 10000`, the 0.5–1.5 clamp, the `CumulativeDaysOnMarket` ban, and the `price_change` scale trap are all greppable. |
| 9 | **§5.5 video constraints** | `check_first_frame.py` exists but is called from nowhere. Wire it and the duration/blackdetect checks into a `ci:video-gate`. |
| 10 | **§3.6 finalization one-way** | An un-finalize is silent data corruption. |
| 11 | **§5.4 dead producer routes** | `FORMAT_ROUTE_MAP` and `inbox-producer-registry.ts` point at deleted paths. A gate asserting every route target resolves to a real `SKILL.md` closes it permanently. |
| 12 | **§4.3 escape ledger** | `process_escape_ledger` exists; nothing requires a row. |

---

## 10. Blockers on the deletion itself

These must land in the **same change** as the consolidation, or deleting the source files breaks running code.

1. **`scripts/validate-producer.mjs` requires citations to files that no longer exist.** `MANDATORY_REFS_CONTENT` demands every content producer's raw text contain the literal strings `video_production_skills/ANTI_SLOP_MANIFESTO.md` and `video_production_skills/VIRAL_GUARDRAILS.md`. It is a **substring match, not an `existsSync` check**. So `ci:producer-skills` (G35, in `ci:gates`) currently *requires all 28 producer files to cite two dead paths to pass CI.* Renaming or deleting any of the eight mandatory refs requires updating `MANDATORY_REFS_BASE` and all 24–28 producer files atomically.
2. **`/api/social/publish` demands a `manifestoPath`** pointing at the same missing manifesto.
3. **`scripts/check-producer-skills.mjs` has a blind spot:** `PRODUCER_ROOTS` covers only `marketing_brain_skills/producers`, `social_media_skills`, and `video_production_skills`. The three real dispatch targets living directly under bare `marketing_brain_skills/` (`analyze-anomaly`, `analyze-competitor`, `analyze-experiment`) are invisible to it.
4. **`scripts/orchestrate.ts`** hardcodes and parses `docs/plans/task-registry.json`, and prints `docs/plans/master-plan.md` + `docs/plans/continuous-improvement.md` as operator guidance.
5. **CLAUDE.md** names `docs/plans/CROSS_AGENT_HANDOFF.md` as the live tool-switch protocol target and `docs/plans/GLOBAL_SKILLS_REGISTRY.md` as a skills-index fallback.
6. **`ci:lighthouse` / `ci:a11y`** are invoked by two GitHub workflows and defined nowhere.
7. **`docs/admin-help/*.md` is machinery, not prose** — `lib/admin-help.ts` reads the directory at render time to serve `/admin/help`. Do not delete it.
8. **`docs/HANDOFF-a2p-sms-consent.md` is referenced by gate error text** — `scripts/check-sms-consent-compliance.mjs` tells the agent to read it before touching the consent surface. Either keep the file or update the gate's message to point at the new canonical document.