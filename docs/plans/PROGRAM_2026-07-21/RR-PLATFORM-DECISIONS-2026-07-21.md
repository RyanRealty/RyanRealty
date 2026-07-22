# Ryan Realty Platform — Requirements, Gaps, Decisions
2026-07-21 · One run · Verified against code by 14 parallel audit agents (evidence: file paths per claim, ~660 tool calls)

## How to read this

Your brain dump, reorganized into 13 workstreams. Each one states what exists (verified in code), what is missing, and a decision with its mechanical enforcement. Per your standing rules: no new plan files in the repo (this document lives outside it; approved decisions merge into the existing `docs/plans/PROGRAM_2026-07-21/` package, which is already the plan of record), no CLAUDE.md additions (the consolidation shrinks it), and every rule ships as a gate, cron, schema constraint, or contract test — never prose.

## The verdict

**You have far more than the brain dump assumes. The problem is not missing features. It is reachability.**

The audit found the same defect class in every domain: machinery that is built, tested, and dark.

- 3,213 subdivision pages render today — zero are in the sitemap, so Google and LLMs cannot find 97% of them.
- The exact page class you asked for ("townhomes in Tetherow", "vacant lots in Broken Top") already renders and is indexable — zero sitemap entries, zero internal links.
- Typing "3480" returns address matches from the server — the live dropdown never renders the addresses category. A better search component exists, fully built, imported by nothing.
- The marketing@ email-request pipeline is coded end to end — its cron is missing from vercel.json (the route's own docstring falsely claims it is wired).
- The newsletter system is complete with 13 CI gates — 3 subscribers, no issue ever sent.
- The West Side Meta audience refresh is a manual script, not a cron.
- 23 of 72 cron routes are unregistered. Two learning ledgers have zero code readers or writers.

This matches the diagnosis already committed on `main` in `PROGRAM_2026-07-21` ("code that exists and cannot be reached" is the dominant defect class). So the plan below is not a new program. It is your brain dump merged into that one, with decisions made.

**The one mechanical fix that prevents the whole class (Phase 0, before anything else):**

| Gate | What it fails on |
|---|---|
| `ci:cron-registered` | any `app/api/cron/*` route absent from vercel.json without an explicit `// cron:manual-only` marker |
| `ci:reachable-exports` | components/endpoints imported by nothing (ratcheted; kills the orphan class) |
| `ci:sitemap-resolvable` | any sitemap-emitted URL family whose resolver can 404 |
| Heartbeat cron | any registered pipeline (FSBO scrape, MV refresh, audience sync) silent past its cadence alerts you — staleness is currently invisible |

---

## W1 — Known-audience tracking and identity (West Side)

**Status: ~90% built and live. The brain dump under-sells what exists.**

Have (verified): anonymous sessions stitch to known `crm_people` through four independent paths (email link click, sign-in, form fill, CMA/BPO doc open). Durable identity graph (`rr_vid` cookie + `visitor_identity_map`) retroactively flips all of a browser's anonymous sessions to identified. Meta Pixel on every page with CAPI dedup and hashed-email advanced matching; GA4 user_id set on identify. Every outbound email (newsletter, CMA, BPO, market report, saved search) carries person-stamped links; opens/clicks write to the person's timeline. Funnel dashboard with per-source drop-off. Hot-visitor escalation texts the broker within 15 minutes. `westside_parcels` (17,665 rows) is linked to CRM people with a Meta Custom Audience already created.

Build (decisions):
1. **Promote the West Side audience refresh to a daily cron** (it is a manual script today) and verify `META_AUDIENCE_PUSH_ENABLED` is on in prod. *Mechanism: vercel.json entry + the cron-registered gate + heartbeat.* (S)
2. **One West Side cohort report**: weekly digest + admin view filtered to parcel-linked people — who visited, opened, clicked this week. Today nothing is scoped to the cohort you paid to build. *Mechanism: DAL function + cron; row-count contract test.* (M)
3. **Wire `search` and scroll-depth events into the first-party store** — they go to GA4 only, so the per-contact "top searches" panel starves and page drop-off is invisible per-person. *Mechanism: event-taxonomy contract test (component fires ↔ ALLOWED_EVENT_TYPES accepts).* (S)
4. **SMS click tracking everywhere** — short-link instrumentation exists for prospecting sends; extend to all SMS. *Mechanism: governed-send chokepoint (W5) makes it structural.* (S)
5. Delete the legacy `visits`/`trackVisit` duplicate path and FUB-era `email_campaigns`; fix the stale `FACEBOOK_SELLER_GROWTH_PIPELINE.md` by folding it into canon (it documents a dead system). (S)
6. Drop-off findings stay a report you act on per-mission — no automated page-change loop (your NO LOOP directive).

## W2 — The geo index: thousands of thick pages

**Status: the rendering architecture exists; discovery and depth do not.**

Have: 10 city + 19 community + ~13 neighborhood + 10 ZIP thick pages. `public.boundaries` holds 3,251 authoritative GIS polygons including 3,213 subdivision plats, and `/subdivisions/[slug]` renders any of them on demand. 589K historical listings in the database. JSON-LD on every geo page; AI crawlers welcomed; `llms.txt` live.

Build (decisions):
1. **Light up the subdivision inventory with a content threshold**: a plat with a polygon and ≥10 lifetime sales becomes indexable and sitemapped, with a sales-history section (the 589K-row asset, currently rendered nowhere) and market stats from a per-subdivision cache backfill; below threshold renders but noindexes. No thin content, at scale. *Mechanism: threshold lives in one constant; sitemap derives from `boundaries` + the threshold query; `ci:sitemap-resolvable`.* (L)
2. **Fix sitemap drift today**: 5 live community pages are never submitted (registry has 19, sitemap hardcodes 14); `/cities/{city}/{subdivision}` URLs are submitted that 404. *Mechanism: sitemap reads the registry (delete the hardcoded list) + gate.* (S)
3. **Subdivision browse pages persist after the last active listing closes** (they currently evaporate from the sitemap) — fall back to sold history. (S)
4. **MPC parity**: community pages keep the thick archetype; subdivision pages gain sales history, stats, schools, parent cross-links. Events/HOA/rules render only where curated data exists (the Tetherow model) — 26 of 27 content files lack it; populating them is an ongoing content job, not a template change. (M, then ongoing)
5. **`llms.txt` enumerates the full geo index** (cities, communities, indexable subdivisions), not just hubs. *Mechanism: generated from the same query as the sitemap; parity test.* (S)
6. **Historical depth**: one prod query establishes earliest CloseDate; monthly cache backfills to it (feeds W8's ten-year reports). (M)
7. Park / school-district / trail GIS polygons from county+ODE sources as new `boundaries` geo_types — authoritative only, per your standing rule. (M)

## W3 — Pre-built search pages (type × status × geo)

**Status: the route, 35 presets, and depth content exist; the matrix's long tail is dark.**

Have: `/homes-for-sale/{city}/{preset}` with editorial intro + FAQ + JSON-LD + cross-links; ~840 city×preset URLs sitemapped; centralized noindex policy gate-enforced. The 3-segment `{city}/{subdivision}/{preset}` pages render correctly today — with zero sitemap entries and zero internal links.

Build (decisions):
1. **Inventory threshold rule**: a combo joins the sitemap at ≥1 active listing WITH depth content; zero-inventory combos render honest empty state but noindex. Kills the existing thin-page exposure (with-pool-in-Culver class). *Mechanism: sitemap emission is inventory-count-driven from `listing_search_mv`; gate asserts no zero-count indexable URL.* (M)
2. **Emit the 3-segment matrix for the curated geo set** (14 resorts + 14 Bend neighborhoods + threshold-passing subdivisions), extend depth content to subdivision level. (M)
3. **Add missing property-type presets**: multi-family (PropertyType C — "multi-family homes in Redmond" is impossible today), manufactured. Sold/recently-sold pages wait on an ORMLS display-rule check (question 4 below). (S)
4. **Replace the hand-curated popular-searches snapshot with an auto-derived link layer + one crawlable HTML site-index page** — this is also the "site index" from your brain dump, and it is how the thousands of pages get internal links. *Mechanism: derived from live inventory on a schedule; freshness gate.* (M)
5. Sort-only presets noindexed (duplicate-content surface). Pre-render top-N combos via generateStaticParams. (S)

## W4 — Site search and the map

**Status: two specific bugs make it feel broken; a better search component sits orphaned.**

Have: suggestions backend covering addresses, cities, subdivisions, neighborhoods, zips, brokers, reports; a GIN full-text index built specifically for the typeahead; map-move refetch wired and defaulting on. The "3480" failure is exact: the server returns address matches, the live dropdown never renders that category. The dead-feeling map is exact too: split view silently pins `city=Bend` into every viewport query, so panning to Redmond returns zero rows with a misleading empty state.

Build (decisions):
1. **One search component.** Merge the orphaned SmartSearch (renders addresses, 90ms debounce, client cache, uses the cached GET route) into the live filter bar and the site header; global header search on every page; blog + guides + static pages join the suggestion scope. Delete the three orphans after the merge. *Mechanism: suggestions route switches to the tsvector index it was built for; perf contract test (warm suggestions < 150ms); reachable-exports gate keeps orphans from recurring.* (M)
2. **Map: pan drops the invisible city pin** (pure bounding-box search once the user moves, visible scope chip until then), canvas-level loading state, result count on mobile map view. *Mechanism: extend the existing map-search contract tests.* (M)
3. **Kill the dark semantic-search stack** (endpoint, embeddings table, OpenAI dependency — zero UI consumers; the deterministic parser wins). One NL system. (S)

## W5 — Broker home, send dialog, notifications

**Status: mid-rebuild with the right spec already written; the piece you're describing is the one that's explicitly not built yet.**

Have: one admin home (redirect landed), 5-tab mobile shell, canonical SMS/email composers gate-enforced (G50), unified SendPanel v1 on the person page, next-step engine with merge-rendered one-click sends (sequence-enrolled contacts only), FUB-parity inbox with AI SMS drafts, 2-tap notification→CMA litmus demonstrated on production, 15-min Gmail sync of all three mailboxes.

Build (decisions):
1. **Ship spec-03 first** — the person-workspace rebuild + the single `sendDeliverable` action + governed-send chokepoint. It is fully specced, explicitly deferred, and every complaint in your dump (Frankenstein composer, pills, 706-line page with 40–55-query fan-out) lands on it. Your send-dialog spec (lead name + audit both clickable, SMS and email variants preloaded, tweak, save-as-template, CC-me, approve-and-send) becomes THE SendPanel, converging the three existing dialogs. *Mechanism: G50 extended — any send action not routed through the chokepoint fails CI.* (L)
2. **One ranked "who to contact" list**: merge the sequence queue with inbound triage — BPO/CMA replies, showing requests, doc opens, hot visits — ranked by recency × lead heat. Today inbound activity never reaches the action queue. *Mechanism: queue contract test seeded with fixture events.* (M)
3. **Recommended replies at the thread**: extend the existing AI SMS draft pattern to email and to inbound-reply context, preloaded in the composer (broker can override — no auto-send). (M)
4. **Save-as-template and CC-me** in the composers (both are small, both currently unreachable from any send flow). (S)
5. **Notifications**: flip the mac-mini relay to Twilio (flag already exists — removes the single-machine dependency), keep the serverless SMS-forward rail, add PWA web-push as the durable channel. (M)
6. Calendar-aware scheduling stays deferred (your "down the road"). Read-only calendar display already works.

## W6 — Expired / FSBO

**Status: the strongest domain in the audit. Near-parity with the ask.**

Have: 15-minute expired detection, 3-strategy skip trace with TCPA/DNC compliance tags, native CRM load with the full listing story, automatic 5-lens audit doc per expired, unified `/admin/prospecting` worklist with sent/unsent filters and engagement counts, fail-closed SMS send (quiet hours, suppression, re-list guard, at-most-once), automatic STOP handling, broker alerts on reply. FSBO: Zillow scrape daily, same machinery.

Build (decisions):
1. **Wire the email send** — the dialog's Email tab is dead (no server action behind it); add channel-aware sent-state. (M)
2. **Ownership duration** from county sale date into the audit doc, prospecting detail, and CRM record. (S)
3. **Render the under-contract history** — days-to-pending and fell-through data is already queried and then dropped before the UI. (S)
4. **Reply intelligence**: classify inbound prospect replies (interested / not / stop-adjacent) with a cheap model; interested ⇒ task + preloaded recommended reply in the inbox (W5.3 machinery). (M)
5. **One-click "enroll in expired drip"** on the prospecting row (manual, honoring your 2026-07-11 outreach pause as the default). (S)
6. **Expired story panel on the person page** (reuse the existing price-history component — today the story lives in a prose note). (S)
7. **FSBO sources**: add Craigslist RSS (cheap, legal); drop Facebook Marketplace (no API; scraping is ToS-fragile — not worth the risk). Internal FSBO worklist already exists; a public FSBO page publishing valuations of other people's homes is a compliance exposure — not building it. (S)
8. Capture scope stays at your locked directive ($500K+, SFR, 6 cities) until you say otherwise — widening is a one-constant change (question 2 below).

## W7 — Saved searches and the buyer funnel

**Status: unified. One table, one engine, one cron, five entry points sharing one code path — the "no duplicate logic" requirement is already true here.**

Have: `listing_alerts` unified (user/broker/system origins), hourly engine with instant/daily/weekly, price-drop-into-range and back-on-market alerts, full `/account` dashboard, guest capture with auto-claim on sign-in, per-lead alert panel + viewed-homes + behavior summary on the CRM card, per-subscription open/click rollups.

Build (decisions):
1. **Add monthly cadence** (keep daily; it's currently rejected by validation). (S)
2. **Build hide-homes**: table + tile control + exclusion from results and alert emails. Doesn't exist at all. (M)
3. **Stitch likes/saves to the person**: consumer likes are auth-user-keyed and never join `crm_people`, so "they liked this home" is invisible to brokers. Build the auth-user→person join, add save events to the first-party store, surface on the lead. *Mechanism: identity-join contract test.* (M)
4. **BPO one-click from a viewed/liked home card** (buyer-side BPO with offer strategy already exists; the card just has no CTA and the action hardcodes the seller-side subject). (S)
5. Broker create-search form gets the full consumer filter vocabulary + instant cadence; `/lp/buyer-listing-alerts` actually creates the alert row it promises. (S)
6. Fix the viewed-homes panel's legacy identity path (native leads currently show empty). (S)

## W8 — Market reports (the HousingWire / Mohtashami upgrade)

**Status: your "one generation path" rule is violated worst here — four parallel metric paths can show different numbers for the same city. Liability-grade problem, and the consolidation IS the work.**

Have: cache infrastructure (29K stat rows, versioned methodology, 6h refresh, drift-check cron), CRM subscription sends with §0-verified figures, per-figure verification trace in the admin preview, email-safe chart rendering, weekly generated report. A complete HousingWire-tracker + Mohtashami research spec already sits in the program package — research done, zero implementation.

Build (decisions):
1. **One generation path**: standardize every surface on `market_stats_cache` + `market_pulse_live` (the §0-audited path); extend the cache to cover the hub's filters; retire the raw-listings RPC and the separate weekly-report path. *Mechanism: consistency cron extended to cross-check every read path; import gate bans the retired RPC.* (L)
2. **Weekly history snapshot table** fed from the pulse (inventory, new listings, pendings, price-cut share) — the pulse holds these today and overwrites them every refresh, which is why no WoW/YoY weekly framing is possible. Rates/spreads from FRED + Freddie PMMS (free, primary). No HousingWire subscription needed. (M)
3. **The tabbed core-chart module**: one fast cache-fed component (price, inventory, DOM, months-of-supply, price-cuts, volume) embedded on listing, city, community pages — replacing today's single-chart or zero-chart embeds. (M)
4. **Click-through lands on a full pre-generated report**: `/housing-market/[geo]` becomes the canonical report (YTD default, timeframe selector). The explore page — exactly the blank "create your report" page you want gone — retires at parity. (M)
5. **Ten-year back-generation**: backfill monthly cache to earliest verified data (W2.6 query decides depth); per-city archive pages render only years with real sales volume. (M)
6. **Bulk + individual sends**: audience selector on the send engine, reusing the newsletter queue's delivery ledger; "send now" per contact exists via SendPanel. (M)
7. **Mohtashami corpus + narrative**: ingest his articles/posts into a reference library; generate report narratives in his analytical structure with our data and our voice — every narrative passes the §0 trace and the voice gate; `market_narratives` table finally gets its writer. (M)
8. One geo registry for report coverage (today four different city lists govern email areas, weekly reports, pages, and verdicts). *Mechanism: single registry; gate on inline geo lists.* (S)

## W9 — Newsletters

**Status: the machine is complete and gate-covered; the program never started. 3 subscribers, zero real issues sent.**

Have: auto-draft cron (monthly, from live DAL data with per-stat citations), per-broker identity swap, three pre-send gates (voice, citation, dead-link), tranched warm-up sends with a deliverability circuit breaker, full tracking rails, 13 CI gates.

Build (decisions):
1. **Start it**: enroll past clients + engaged leads + the West Side cohort with a consent-respecting posture (not the full 12K cold book — deliverability and CAN-SPAM risk; question 3 confirms the audience). Send the first issue on the existing rhythm. (S — it's an operating decision, not code)
2. **Per-lead newsletter history on the contact card** (join over recipient tables — data exists, surface doesn't). (S)
3. **Wire `/account/notifications` to actually govern newsletter membership** — your ask supersedes the locked unsubscribe-only decision. (S)
4. **Postmaster ingestion cron** before the first large send (the reputation gate exists but permanently runs on fallback data). (S)
5. **Webhook-registration check**: Resend webhook state is invisible to CI today; if it's unregistered, bounce suppression silently dies. *Mechanism: nightly check against the Resend API.* (S)

## W10 — Content studio and broker marketing

**Status: the spine (action rows, approval queue, publish fan-out, cost ledger) is live; everything broker-facing is missing, and the producer freeze blocks additions by design.**

Have: 522 action rows through the protocol, Matt-only approval queue with previews, 10-platform publish path, marketing@ email pipeline fully coded (parser, allowlist, confirmation replies) — **but its cron is not registered**, and the request page is a mailto link that writes nothing.

Build (decisions):
1. **Wire the marketing@ inbox cron + confirm the Workspace grant; make `/marketing/request` an authenticated form writing action rows.** Two intakes, one queue. (S)
2. **Broker content library**: a broker-visible surface over finished deliverables (persisted to storage — today finished work lives in gitignored `out/` on your machine), with download and per-broker filtering. (M)
3. **Re-brand step**: one parameterized "render for broker X" pass using the `brokers` table (headshot, contact, license). (M)
4. **Bulk approve / bulk reject** in the approval queue (strictly per-card today). (S)
5. **Purge the catalog drift**: request catalog and dispatch registry still offer ~20 video deliverables that route to producers deleted in June — a broker request would dispatch into a void. (S)
6. Per-broker Instagram auto-posting: deferred — requires per-broker OAuth and an approval-model change; revisit after the library operates. Share-to-social for brokers rides the existing OG-image + ShareButton rails with a pre-written caption field. (deferred)
7. New producers (weekend-events, re-brand) require lifting the G45 freeze you imposed — scoped unfreeze is question 1.

## W11 — Brand voice (your three rules + Orwell)

**Status: your 2026-07-21 recorded decision already covers this — keep the deterministic list as an invisible floor, add Orwell as a reviewer layer. Zero of it is implemented, and the list has drifted into ~12 disagreeing copies.**

Have: the Five Laws canon, a zero-violation ratcheted gate on public site copy (4 enforcement layers), runtime newsletter voice gate. Holes: CRM sends, blog publish, CMA prose, and social captions ship with no or partial voice checks; the Python producer list still bans words the canonical list relaxed in June.

Build (decisions — implementing your recorded decision):
1. **One generated list source** — the ~12 hand-typed copies collapse into one; consumers are generated. *Mechanism: parity test fails CI when any consumer drifts.* (M)
2. **One shared voice-check function on every send path** (newsletter pattern, generalized): blog publish, CMA/BPO prose, social captions, sequence templates. Broker-typed 1:1 messages exempt as personal correspondence. *Mechanism: ratchet gate on send paths lacking the check — the `ci:email-quality` pattern, applied to voice.* (M)
3. **Orwell reviewer**: advisory LLM pass on long-form (blog, newsletter, market narratives, CMA prose) — lists violations (stale phrase, long word + replacement, cuttable words, passive voice) then rewrites, facts/numbers/names unchanged. Non-blocking; deterministic floor stays the hard gate (a non-deterministic reviewer must never be the thing that blocks a send). (M)
4. **Canon cleanup**: VOICE.md gains the Orwell + never-pander section; the stale five-attribute SKILL.md model and the contradictory cursor blog rules are deleted; producer-gate references repoint. (S)
5. **Rewrite pass over stored copy** (published blog posts, templates) with the reviewer, batched, reviewed before republish. (M)

## W12 — Out-of-area coverage and referrals

**Status: the feed is statewide (~362 cities in the data), the site hard-404s them at the edge, and your own FAQ promises a referral service no system supports.**

Have: out-of-area browse URLs already work (unlinked); seller-side geo classification writes `geo:out-of-area` tags that nothing consumes; no referral stage, pipeline, or fee instrument exists.

Build (decisions — resolving open decision C2 in the program package):
1. **Referral-capture tier, not full page builds**: the middleware 404 becomes a light city page — honest copy ("here's every active listing; this is outside our home market; we'll connect you with the right broker"), live listings (already works), and a capture form tagging `geo:out-of-area`. Sitemap-include only the top cities by inventory to protect Central Oregon topical authority. (M)
2. **Buyer intake geocoding**: classify the inquired property so out-of-area leads get flagged, routed to a referral queue instead of the standard buyer drip. (S)
3. **Referral disposition in the CRM**: `referral:` tag namespace + Referred-Out disposition + a light receivable record (25% inbound fee). Full W9/agreement e-sign flow later, when volume justifies it. (M)
4. One prod query confirms Burns/Harney presence and sizes the real out-of-area inventory. (S)

## W13 — Consolidation and skills (your four constraints, as the operating rules)

This is the active `D22` program on main, now carrying your directives as its acceptance criteria:

1. **CLAUDE.md shrinks** — stale facts the audit enumerated (wrong gate counts, 49 citations to a deleted directory, dead cron cadences, FUB-era sections) come out; rules that matter become gates; the file converges toward pointers into one canon. *Mechanism: the existing canon gate (G44) plus the consolidation lanes file already committed.*
2. **No new plan files** — the program package and `ADMIN_REBUILD/` are the only plan homes; decisions from this document merge into `04-DECISIONS-RECORDED.md`. The rogue-plan gate arm gets fixed (it currently passes on deletions and ignores subdirectories).
3. **Skills reviewed and streamlined** — the five loop skills: two exist only as gitignored files on this machine (fleet state on a laptop), one carries an embedded PAUSED block, all encode the old approval model. Decision: promote the preserved copies to tracked, strip stale state, update to the 2026-07-21 approval model. Producer skills: keep as recipes (freeze intact), delete retired stubs. Cursor rules that contradict canon die.
4. **Mechanical over prose, one direction** — every decision above names its gate. The reconciliation your program flagged gets done: the draft-first commit hook and CLAUDE.md §0.5 still enforce the old approval model your 2026-07-21 decision replaced (full autonomy post-hoc for reversible work; per-action approval only for outbound messages to real people, publishing, ad spend, OAuth). Question 5 confirms, then the hook is rewritten to enforce the new boundary.

---

## Execution order (discrete missions — no loop, per your directive)

| Phase | Contents | Why this order |
|---|---|---|
| **0 — Reachability spine** | The four gates in the verdict + sitemap drift fixes + delete the dead class (orphaned components, dark semantic stack, dead cron routes, legacy tracking path) + wire the two dark crons (marketing inbox, postmaster) | Prevents the defect class every other phase would otherwise re-create |
| **1 — Conversion layer** | W5 (person workspace + SendPanel + triage queue) + W6 (email sends, reply intelligence) + W7 quick wins | Closest to revenue; everything else feeds leads into this |
| **2 — Audience engine** | W1 (westside cron + cohort report + events) + W9 (launch the newsletter) + W8.1–2 (one generation path + history table) | Uses the audience you already bought; kills the data-liability split-brain |
| **3 — Search-facing scale** | W2 (subdivision light-up) + W3 (matrix + site index) + W4 (search/map) + W12 (referral tier) | The thousands-of-pages ambition, on top of a now-consistent data layer |
| **4 — Content & voice** | W10 (broker library + intakes) + W11 (voice implementation) + W8.3–7 (charts, reports, narratives) | Broker-facing tools and the publishing layer, last because they depend on 1–3 |

Each phase ends with the adversarial audit pass (a second agent assuming everything is broken, verifying independently) — the method already proven on the CMA pipeline and the program audits. Results merge into the program package. Then I stop and you point at the next phase.

## The five questions only you can answer

1. **Producer freeze (G45)** — lift it, scoped to the broker-facing set (weekend-events producer, re-brand producer, broker library)? It's your directive; W10 is blocked without it.
2. **Expired capture scope** — keep your $500K / SFR / 6-city floor, or widen? One constant either way.
3. **Newsletter audience** — my recommendation is past clients + engaged leads + West Side cohort (not the 12K cold book). Confirm, and the first issue goes out on the next cycle.
4. **Sold-listing pages** — indexable per-geo sold pages need an ORMLS/IDX display-rule confirmation. You're the licensee; I can draft the rule check but the compliance read is yours.
5. **Approval model** — confirm the 2026-07-21 decision stands (full autonomy with post-hoc review for reversible work; per-action approval only for outbound messages, publishing, spend, OAuth grants), and I rewrite the draft-first hook to enforce exactly that boundary.
