# Requirements register — everything Matt has asked for, dispositioned

**Built:** 2026-08-15 from a five-agent harvest of the full on-disk corpus (handoff history, master goals, brain dumps, Broker OS plan, public-product locks, recorded program decisions, canon, rules, memory). 572 raw directives deduped to the rows below.
**Law:** this register may never quietly shrink (G57 `ci:requirements-register`). Rows are append-or-amend; a requirement leaves only by becoming SUPERSEDED with a pointer. "He said five things so forget the 120 others" fails the build.
**Dispositions:** LOCKED (standing rule in force) · VERIFIED (built; per the source doc or map evidence) · PARTIAL · MISSING (not built — must cite a covering gap G-row) · PARKED (deliberate not-now) · GATED (waits on a Matt per-action approval) · SUPERSEDED.
**Honesty:** VERIFIED here inherits from source docs and map evidence statuses. The v1 certification pass (VERSION-1) re-verifies; a disposition an accept test contradicts gets corrected, never argued with.
**Covers column:** MISSING/PARTIAL rows cite the VERSION-1 gap (G-row) or owner that carries them. Ad-hoc work that touches a row updates it in the same change.
**Max:** R-217 (the tail pin — G57 fails if rows above this number vanish or the pin goes stale)

## The animals (what each is, how it improves)

| Domain | What it is here | Improvement lens (diagnose rules: COMPANY_IMPROVEMENT.md) |
|---|---|---|
| license-voice | §0 data accuracy + brand voice + fair housing/ODS/TCPA compliance. The license outranks everything. | Untraced number → stop. Voice gate failures → class fix. |
| factory | How the company changes itself: THE LOOP, gates, deploys, approvals, memory. | Escape → class + gate. Schema/prod lag → P0. |
| data-sync | Spark→Supabase ingest, boundaries, identity plumbing, freshness. | Delta unhealthy → P0. Re-aggregating Spark → stop. |
| sales-insights | Stats engine, marts, CMA/BPO/pricing, reporting. | Public number off-engine → P0. Broker can't act on it → UX. |
| public-ux | The 296-page public product: search, places, listing, look. | Traffic+low convert → CTA/UX. LCP>2.5s → perf. Filter/map miss → search. |
| seo-aeo | Rankings, AEO/AI citability, JSON-LD, crawl health, content depth. | High imp + CTR<2% → title/meta. Pos 5–15 → depth. |
| leads | Capture, attribution, identity stitch, routing, ads plumbing. | Traffic high + enroll low → funnel. Arrival without stitch → identity. |
| nurture | Sequences, alerts, newsletter, suppression/quiet-hours compliance. | Nurture-heavy + Lead≈0 → product defect. Alert without person → identity. |
| broker-tools | The admin/Broker OS: Today, people, prospecting, valuations, send paths. | Broker can't see next step → copilot. Unreadable output → look class. |
| social-presence | Channels, tokens, publish cadence, content factory outputs. | measured=0 → learn path first. Token needs-reauth → park or Matt-want. |
| transactions | TC/Vault, SkySlope strangler, Oregon forms, commissions. | Stale mirror → ops. Stale form → do not send. |
| recruit-retain | Broker onboarding, own-book, /join, the brokerage as product. | New broker can't run day one → platform. |

## license-voice

| ID | Requirement | Source | Disposition | Covers |
|---|---|---|---|---|
| R-001 | Every published figure carries a live verification trace or is cut; no trace no ship | CLAUDE.md §0 | LOCKED | — |
| R-002 | Months of supply = active/(closed_6mo/6); verdict pill must match thresholds ≤4/4–6/≥6 | CLAUDE.md §0; SITE_SPEC | LOCKED | gate `ci:market-formula`. Pulse MOS withholds when the row's numerator is not the count on screen, or implied six-month closes exceed a printed 12-month sold count (fleet 5d55abbd72a67d25a5d7232b46fd2fb0, 2026-08-16). Gate `ci:publish-months-of-supply`. Blog current-MOS lists rewrite through `publishBlogCurrentMos` + pulse (fleet f3693aef8c4a8198e806a1b1b2d0b723, 2026-08-17). Historical June snapshots stay labeled as June. |
| R-003 | Never invent timelines, forecasts, estimates; a date is a number needing a named basis | CLAUDE.md §0 (Matt 2026-07-29) | LOCKED | — |
| R-004 | Absence claims need a second differently-shaped counter-query before reaching Matt | CLAUDE.md §0 (Matt 2026-08-06) | LOCKED | — |
| R-005 | Spark×Supabase reconciliation is a hard pre-render gate; stop on delta>1% | CLAUDE.md §0 | LOCKED | — |
| R-006 | Never aggregate raw listings for market reports; cache tables only | CLAUDE.md §0/§7 | LOCKED | — |
| R-007 | Voice canon is VOICE.md (Five Laws, Buffett); banned punctuation/vocabulary mechanical | CLAUDE.md §2 (locked 2026-08-05) | LOCKED | gates `ci:brand-voice`, `lib/voice/check.ts` |
| R-008 | Fact then stop; never a sentence explaining the prior sentence; no AI-slop, no fake quotes | VOICE.md; PUBLIC decisions.md | LOCKED | — |
| R-009 | Three voice registers: public law · personal notes may thank · admin simple instrument language | BROKER-OS v0.10 (2026-08-12) | LOCKED | — |
| R-010 | Never name virtues except the About mission sentence; MLS remarks never rewritten | BROKER-OS D11 (2026-08-12) | LOCKED | — |
| R-011 | Do not rewrite VOICE.md unilaterally | BROKER-OS v0.10 | LOCKED | — |
| R-012 | Em dashes fine in SEO titles; dash rule targets AI-seeming prose only | handoff 2026-08-02 | LOCKED | — |
| R-013 | Fair-housing gate on listing descriptions and ads; place not people; no generated buyers as hook | RECONCILED-RULES §1.11; BROKER-OS | LOCKED | — |
| R-014 | Never state commission rates in Public Remarks (NAR settlement) | RECONCILED-RULES §1.12 | LOCKED | — |
| R-015 | Sold data is VOW-only behind sign-in; public sold pages forbidden | DECISIONS-RECORDED §9 (2026-07-21) | LOCKED | — |
| R-016 | Charts break polylines across gaps; no invented smoothing; charts render in code never as photos | RECONCILED-RULES §1.14; imagery canon 2026-08-14 | LOCKED | — |
| R-017 | Testimonials require author+source provenance; no fabricated social proof | RECONCILED-RULES §1.13; DESIGN_DIRECTIVES | LOCKED | — |
| R-018 | ODS/IDX attribution block on listing detail + chrome; seller opt-outs honored in MVs | PUBLIC-PRODUCT-OS; G54 | LOCKED | gate `ci:ods-compliance` |
| R-019 | Never assert parcel-level STR eligibility as zoning; MLS permit field labeled as such | FILTER_COMPLETENESS 2026-07-30 | LOCKED | — |
| R-020 | A degraded read must not publish a zero count; absent is not zero | handoff 2026-07-30 | LOCKED | — |
| R-021 | Do not state a fact the page cannot keep true; prove formatter swaps before §0 figures change | PHASE 11 (2026-08-07) | LOCKED | — |
| R-022 | No invented five-year percentages or 0–10 scores on listing intelligence; over/under or refuse | public look 2026-08-14 | LOCKED | — |
| R-023 | Imagery: reference-conditioned place work allowed; never invent a listing room/view; no people-as-residents | imagery canon 2026-08-14 | LOCKED | — |
| R-024 | Same-labeled figures on one page share one SFR source; label type_scope SFR vs all | DESIGN_DIRECTIVES; SALES_INTELLIGENCE | LOCKED | Hub/region/annual-review name omitted pulse cities + TIGER remainder (fleet 5439b87e, 2026-08-16). Gate `ci:pulse-city-remainder`. City URL hyphens resolve to space-form cache keys before a city-tier read (fleet 75370225805bb52d38b151ced2dab5c1, 2026-08-16). Gate `ci:city-cache-slug`. Place-page HOA glance and FAQ share `publishPlaceHoa` (fleet eab91ac8dfa9b833ade88640c6cce7d4, 2026-08-16). Gate `ci:publish-place-hoa`. A list median caption names the number's grain, never Regional for a place figure (fleet 5f0ec58d60988a52e76b8a559ef22f0c, 2026-08-16). Gate `ci:publish-median-caption`. Listing Monthly payment and Rental analysis share `publishFinancingSplit` (fleet 0b2eea305a233f4a1d246cf2e8f1a299, 2026-08-16). Gate `ci:publish-down-payment`. Awbrey index-vs-place 52/63 finding rejected (fleet 9f0392434899acb5c7543925a52e542b, 2026-08-16): production shares one inventory count on `/neighborhoods` tile, `/cities/bend` row, place hero, FAQ, Dataset, and `#homes`. Registry plat index tile, hero, and `#homes` share `getPlatPublicInventory` SFR + PUBLIC_ACTIVE (fleet 37d5349b2d2e55aa62df73389d8bad85, 2026-08-16). Gate `ci:publish-plat-inventory`. Plat hero/sell figures come from `publishPlatFigures` (plat inventory median only; withhold parent-pulse pending/sold) (fleet 6a52801e3ef9e0d041b830497794290d, 2026-08-16). Gate `ci:publish-plat-figures`. Awbrey 52/63/62 three-count finding rejected (fleet c2764a13014ffde27bb0758f43bdb546, 2026-08-16): production still shares one inventory count and one median on `/neighborhoods` tile, `/cities/bend` row, place hero, FAQ, Dataset, and `#homes`. Southern Crossing index-1 vs place-23 finding rejected (fleet 8a95d715ef63989d964b9d643d2938f4, 2026-08-16): production shares one inventory count (3) and one median ($920,000) on `/neighborhoods` tile, `/cities/bend` row, place hero, FAQ, Dataset, `#homes`, and hydrated map badge. Search filter-match vs map-viewport and city header vs SFR FAQ share `publishSearchCount` (fleet d8f52b39ceceb240344f408d574fee27, 2026-08-16). Gate `ci:publish-search-count`. Homepage See homes / Browse homes next to the region count open `publishRegionalSearchHref` (`?view=list`, no city) so split/map cannot inject Bend (fleet ef6af6b44156e99f0f5ca42850819b19, 2026-08-17). Gate `ci:publish-regional-search-href`. Listing facts and True cost share `publishListingHoa` exact monthly (fleet 1c49031c7eea8492a01ac8eedc219140, 2026-08-17). Gate `ci:publish-listing-hoa`. Listing H1, drop, and JSON-LD share `publishListingAsk` exact ListPrice (fleet 5c0dab89dd5d797b64c246eb068cc562, 2026-08-17). Gate `ci:publish-listing-ask`. Listing contact hrefs share `publishListingContactKey` (ListNumber; contact resolves either) (fleet 1400f2fa89d1a2082646e324d4b8d8ba, 2026-08-17). Gate `ci:publish-listing-contact-key` /cities names omitted pulse cities + TIGER remainder (fleet 90bec16d, 2026-08-17). Gate `ci:pulse-city-remainder` now includes the cities index. Plat YTD withholds when it contradicts the current-year table (fleet 0db0fe1f, 2026-08-17). Gate `ci:publish-plat-year-sales`. /communities featured and A-Z share `publishCommunityIndexCount` (fleet 7452bc19, 2026-08-17). Gate `ci:publish-community-index-count`. Coverage note only. Do not mark G27 done. |
| R-025 | Exclude Coming Soon from for-sale counts and anon access everywhere | handoff 2026-08-02; COMING_SOON_SQL | PARTIAL | G27 — anon/public listing access sealed (2026-08-02 session). Residual: pulse `active_count` still SQL-includes CS (probe 2026-08-16: Bend pulse 486; City=Bend SFR CS = 5) |
| R-026 | Every number in packets/newsletters is a compliance artifact; one definition per metric | ADMIN 00-REASONING | PARTIAL | G18 |
| R-027 | Oregon TC disclosures derive from role×property with primary-source citations | RECONCILED-RULES §1.15 | GATED | M2 (TC resume) |
| R-028 | Public competitor brokerage names locked off forever (I6); admin desk may keep names | PRODUCT.md | LOCKED | — |
| R-029 | TCPA/DNC suppression is a single enforcement point with STOP/HELP + quiet hours | CRM blueprint | VERIFIED | — |

## factory

| ID | Requirement | Source | Disposition | Covers |
|---|---|---|---|---|
| R-030 | Full autonomy post-hoc for reversible work; per-action approval for outbound/publish/spend/OAuth only | CLAUDE.md §1 (Matt 2026-07-21) | LOCKED | — |
| R-031 | Broker self-approval: content the broker initiates on the SMS line, APPROVE = stamp, Matt digest | CLAUDE.md §1 (2026-08-01) | LOCKED | — |
| R-032 | Every rule that keeps being violated becomes a mechanical gate, not more prose | DECISIONS-RECORDED §9 | LOCKED | catalog `docs/MECHANICAL_GATES.md` |
| R-033 | Production truth is origin/main; ship same session; deploy:verify after every push; migrations same delivery | AGENTS.md; production-parity | LOCKED | — |
| R-034 | Done = build + real data + deploy READY + screenshots 390/1280; per-class accept by goal type | definition-of-done; COMPANY_IMPROVEMENT §Accept | LOCKED | — |
| R-035 | One recursive company process (THE LOOP); versions certify the whole; conditions never dates | Matt 2026-08-15; DEVELOPMENT_PROCESS | VERIFIED | v1.4.0 shipped |
| R-036 | Everything remembered: durable work graph is the source of record; chat is disposable | Matt 2026-08-15 | VERIFIED | `loop_work_nodes` + loop-brief |
| R-037 | No shortcut assumptions: selection happens over the full enumerated universe | Matt 2026-08-15 | VERIFIED | G56 + this register (G57) |
| R-038 | Domain with expired unlearned windows is frozen until Learn closes them | DEVELOPMENT_PROCESS v1.3+ | LOCKED | insert guard |
| R-039 | Ban calendar effort estimates; agent-hours and loop iterations only | DECISIONS-RECORDED §3 | LOCKED | — |
| R-040 | Adversarial verification: second agent starved of builder reasoning for high-stakes claims | RR-PLATFORM-DECISIONS | LOCKED | workflows W1.1/W1.2 |
| R-041 | Never ask Matt to run terminal commands; agents execute everything | AGENTS.md; CLAUDE.md §8 | LOCKED | — |
| R-042 | Grok Imagine is the only generative image/video stack; park the model zoo; i2v of real MLS photos only | BROKER-OS D10 (2026-08-12) | LOCKED | — |
| R-043 | Numbers and brand type composite in Remotion/list-kit; never baked into generative prompts | BROKER-OS (2026-08-12) | LOCKED | — |
| R-044 | Video hard rules: 1080×1920, hook by frame 12, single-word Amboqia captions, Victoria VO, no unapproved MP4 ships | CLAUDE.md §4 (locked 2026-04-27…05-20) | LOCKED | — |
| R-045 | Video producers stay out of the brain REGISTRY; local worker only | CLAUDE.md §4 (Matt 2026-06-14) | LOCKED | — |
| R-046 | Outbound content must "blow them away"; Tumalo kit is the named exemplar | BROKER-OS (2026-08-12) | LOCKED | — |
| R-047 | Two tracks never mix files; parallel in worktrees, serial land on main; anti-stranding contract | BROKER-OS v0.12/v0.13; AGENTIC_GRAPH rule 11 | LOCKED | — |
| R-048 | Canon consolidation: one rule once; no conflicting plan docs; plans register in the canon | DECISIONS-RECORDED §7 | VERIFIED | G44 |
| R-049 | Expired/FSBO first message proves this-home marketing; never blame prior agent; never invent numbers | BROKER-OS | LOCKED | — |
| R-050 | Graph engineering adopted as substance: contracts, edges-as-code, verifier edges, budgets, stop conditions | AGENTIC_GRAPH (GO 2026-08-15) | VERIFIED | workflows + canon v1.4.0 |
| R-051 | Named stops stand: I6, Tremor npm, PropXYZ purchase, new Public Product OS. Page-grade process is KILLED (Matt 2026-08-16) — do not run, do not score, do not fix-to-a-rubric | Matt 2026-08-16; handoff 2026-08-15 | LOCKED | R-215 |
| R-052 | Existing code is a quarry, not a freeze; implementation amnesia on rebuilds | BROKER-OS v0 | LOCKED | — |

## data-sync

| ID | Requirement | Source | Disposition | Covers |
|---|---|---|---|---|
| R-053 | Spark is ingest-only; all computation in Supabase; one delta-sync core, caller allowlist shrink-only | Matt 2026-08-15; RECONCILED §3.7 | LOCKED | — |
| R-054 | Active inventory fresh via delta lane; terminal listings finalize one-way and stop churning | sync rules; RECONCILED §3.6 | PARTIAL | strict-verify backlog drain |
| R-055 | GIS boundaries authoritative; city = TIGER polygon; in-boundary via xref MV/RPC, never request-time ST_Within | RECONCILED §3.8; DESIGN_DIRECTIVES | LOCKED | — |
| R-056 | DAL-first: no raw .from outside lib/data; every page imports @/lib/data; mixed-case quoting | RECONCILED §3.4; CLAUDE.md §7 | LOCKED | gates G1/G8 |
| R-057 | CustomFields ingest with private-detail diversion; showing requirements can never leak via anon key | SEARCH_OPT 2026-07-29 | VERIFIED | — |
| R-058 | Token liveness authority is heartbeat sync_logs, never expires_at alone; no reconnect asks | Matt 2026-08-15 ("knock it off") | LOCKED | escape cb7699f1 |
| R-059 | Identity dedup: high-confidence auto-merge, weak matches manual fail-closed; one merge path | ADMIN decisions | PARTIAL | G2 |
| R-060 | GPC honored on watch and send; inbound SMS/email always lands on the person timeline | BROKER-OS | LOCKED | — |
| R-061 | FSBO marks expire after consecutive missed scrapes; never solicit forever | 03-DECISIONS; MASTER-SPEC D10 | VERIFIED | — |
| R-062 | Do not publish mart year 1990; public annual reads are mart-only with 1998 floor, missing year missing | handoff 2026-08-14; PUBLIC decisions | LOCKED | sibling owns cube residual |
| R-063 | Sync-ops is the one supervision view; health alarms never wake by SMS — Oversight + digest only | ADMIN decisions | LOCKED | — |

## sales-insights

| ID | Requirement | Source | Disposition | Covers |
|---|---|---|---|---|
| R-064 | One stats engine: market_stats_cache + market_pulse_live; methodology stamped; v3 never claimed v4 | MASTER-SPEC D7; CLAUDE.md §7 | LOCKED | — |
| R-065 | Closed sales: ClosePrice COALESCE chain; percentile_cont medians; CloseDate windows; SFR convention | data-architecture §1 | LOCKED | — |
| R-066 | ClosePrice is contract price; seller concessions deduct before commission math | seller net 2026-08-14 | VERIFIED | — |
| R-067 | Deterministic narratives from cache; no LLM-invented figures; decade archive aggregates cache | DECISIONS-RECORDED §28/§29 | VERIFIED | — |
| R-068 | CMA beats a real RPR packet: community market not ZIP, closed sales only, no AVM | CMA canon 2026-08-14 | VERIFIED | — |
| R-069 | Comp selection: market-area first; product type must match; hard geo exclusions (Parkway/river, zoning, lot character); distance+direction recorded in citations | PROSPECT_TO_CMA; pricing audit 2026-08-14 | PARTIAL | G16 |
| R-070 | One pricing engine across CMA, BPO, expired-audit; one adjustment contract; matcher rolled into one public product | PROSPECT_TO_CMA; 2026-08-14 | PARTIAL | G16 |
| R-071 | Pricing guardrails: mapped vs unmapped are different markets; tight-GLA quality stop; 15% same-neighborhood $/sqft cut; one-acre not rural in named cities | pricing audit 2026-08-14 | VERIFIED | — |
| R-072 | Severity-aware CMA publish gate (critical blocks / major review / minor advisory); loosening needs Matt | CMA_PIPELINE 2026-07-30 | LOCKED | — |
| R-073 | Every CMA builds or states an honest broker-readable failure; comp trace persists in build_summary | CMA_PIPELINE | PARTIAL | G16 |
| R-074 | Rebuild CMA corpus under the live judge and measure flag rate; fix county/site resolver flags | CMA_PIPELINE | MISSING | G16 |
| R-075 | CMA answers zoning, ADU, rental rules, income potential; published listing CMA hides list-price rec + sold comps | 2026-07-30 | VERIFIED | — |
| R-076 | Public pricing page refuses new construction and thin sets; CMA document may still price NC; stamp queue SFR-only | public pricing 2026-08-14 | VERIFIED | — |
| R-077 | Reporting collapse: one definition registry, each metric computed once behind the DAL, rendered once | ADMIN decisions | MISSING | G18 |
| R-078 | Measurement full: first-broker-action stamp, reply latency, CMA SLA visible on admin surfaces | ADMIN decisions | MISSING | G18 |
| R-079 | Brokers get scoped performance; spend/CPL/ROI/financials superuser-only; commission ledger is tc_commissions | ADMIN 01-DECISIONS | LOCKED | — |
| R-080 | Admin charts use admin tokens; series render as charts not KPI strips; honest charts only where volume supports (D98) | BROKER-OS; DESIGN_DIRECTIVES | PARTIAL | G18 |
| R-081 | Resort/outbound market-report MoS uses 6-month pulse base | LOCKED 2026-07-27 | LOCKED | — |
| R-082 | Subdivision stats scoped City+SubdivisionName with ODS ≥3 median gate | DECISIONS-RECORDED §30 | VERIFIED | — |
| R-083 | CMA performance report shows send-to-reply funnel from engagement events | PROSPECT_TO_CMA | MISSING | G16 |
| R-084 | Market-report emails: chart images, contextual stats, voice, verification traces | ADMIN_CONSOLIDATION | VERIFIED | — |
| R-085 | DSCR: admin screen ranked by printed Deal Score; emailable Matt-approved draft; figures trace with manufactured-rent weakness flagged | DSCR plan 2026-08-03 | PARTIAL | CAP-034 residual |
| R-086 | Broker SMS market Q&A answers from live DAL with per-figure citations; law Q&A cites ORS/OAR corpus | BROKER_SMS_AGENT | VERIFIED | — |

## public-ux

| ID | Requirement | Source | Disposition | Covers |
|---|---|---|---|---|
| R-087 | Public IA locked: Homes · Places · Market · Sell · About; Saved is an affordance; six v3 patterns only | ia-lock; BROKER-OS | LOCKED | — |
| R-088 | Every page carries visitor objective + machine objective + exits; dead ends are defects; one exploration graph | PUBLIC decisions | LOCKED | — |
| R-089 | Lead-gen machine that never acts like it; machine objective only via visitor objective | PUBLIC decisions | LOCKED | — |
| R-090 | Six section patterns (Instrument Field Ledger Stage Sheet Quiet); no two adjacent same; ≤4 per page; chart atom inside Instrument | PUBLIC decisions; D9 | LOCKED | — |
| R-091 | Brand sacred: navy/cream, Amboqia display + Geist body; shadcn-only controls; ban new UI components drawing own chrome | decisions; DESIGN_DIRECTIVES | LOCKED | gates design-tokens/public-ui |
| R-092 | Mobile-first: 390 is truth, 1280 second; visual inspection on live numbers is law — code review is not the look | BROKER-OS v0.6 | LOCKED | G9 baselines 2026-08-16 (`look-walk-baseline.json`) |
| R-093 | Stamped look: PropXYZ cards/map + Tremor-style market blocks + HouseMe listing intelligence; no Magic UI; no Tremor npm | Matt stamp 2026-08-14 | PARTIAL | sibling owns rollout |
| R-094 | Listing opens on Stage: real MLS photo/video hero, UNMUTE top-right, poster until video ready; beats Zillow Showcase | Track 1; DESIGN_DIRECTIVES | VERIFIED | — |
| R-095 | Home page: search door + six town doors with live MLS photography; Places/Opens first screenful photographed and door-through | Track 1 2026-08-13 | PARTIAL | Town-door photographs visible at rest 2026-08-16 (`.town-fill` opacity 1; class `KbExploreTowns`). Residual: photos are curated static scenics (`TOWN_IMG` in app/page.tsx), not live MLS — G21 |
| R-096 | /sell: worth-question gone; address-only step 1; CTA language "Value my home"; worth-language only in title/meta | Track 1; D5 | VERIFIED | — |
| R-097 | One registry-driven filter surface + URL contract; buyer can express any shoppable MLS need; registry generated from Spark metadata, gated | SEARCH plans | VERIFIED | G15 accept 2026-08-16 (`search-completeness-accept.json` A1; 131 fields; `ci:search-registry-generated`) |
| R-098 | Facet counts live per value, class-aware, zero-match disabled; find-a-filter matches values; no dead filters | FILTER_COMPLETENESS | VERIFIED | G15 accept 2026-08-16 (A2; `ci:search-field-completeness`) |
| R-099 | Zoning as jurisdiction:code with definitions + verification dates; permits-intents only | FILTER_COMPLETENESS | VERIFIED | G15 accept 2026-08-16 (A3; `lib/zoning/resolve.ts` keys `jurisdiction:code`) |
| R-100 | Every long-tail searchable concept dispositioned exposed-or-excluded with reason in a gate ledger | FILTER_COMPLETENESS | VERIFIED | G15 accept 2026-08-16 (A4; 268 concepts, unexplained = 0) |
| R-101 | Sold search depth behind registered VOW gate | SEARCH_OPT | PARTIAL | G15 residual — VOW chokepoint live; sold browse still on the legacy RPC, not `searchListingsAll` |
| R-102 | Drawn shapes: multi-shape include/exclude, URL-persisted, server-evaluated, radius live-readout; drawn geography reaches saved alerts | SEARCH_OPT; FILTER plan | VERIFIED | G15 accept 2026-08-16 (A6; `?shapes=` + `search_listing_keys_in_shapes`; alerts leg G4) |
| R-103 | Named saved areas reusable in searches and alerts; broker-authored then user | SEARCH_OPT | VERIFIED | G15 accept 2026-08-16 (A7; `search_areas` + AreaPicker + `/account/areas`) |
| R-104 | Search performance: filter paint <800ms p75; pan pins <500–800ms; cold TTFB <600ms; timeout honesty | SEARCH plans | PARTIAL | G15 residual — TTFB p75 measured 275/254ms; client filter-paint / pan-pin RUM not recorded |
| R-105 | Search chrome: omnibox, chips, Save/Alerts, count/sort, map+list lockstep; mobile bottom-sheet; sentence search writes same filter params | WAVE3; decisions | VERIFIED | — |
| R-106 | Account portal unifies alerts, saved searches, saved homes, named areas, activity | SEARCH_OPT | VERIFIED | G15 accept 2026-08-16 (A10; `/account` rails live) |
| R-107 | Nav/IA residual: site nav covers brokerage/buy/sell/market/tools/communities; city section order fans out to neighborhood/community | PROSPECT_TO_CMA IA | PARTIAL | G21 |
| R-108 | KB desktop density pass; fix duplicate DOM streaming containers (~40% waste) | PROSPECT_TO_CMA | MISSING | G21 |
| R-109 | Mobile classes: map cards never dead-end; sub-city surfaces scoped data; interstitials never stack over hero; sticky broker bar site-wide | MOBILE_GRIND | PARTIAL | G21. Hero count grain locked 2026-08-16 (`placeHeroLead` + `ci:place-hero-grain`): neighborhood/community/ZIP heroes label the page grain, not the parent city (fleet 97c68da5). Residual: map-card dead-ends, interstitial stack, sticky broker bar |
| R-110 | One count per geography per page; partial plat coverage draws honest count, never hull-fill | MOBILE_GRIND | VERIFIED | — |
| R-111 | Place doors: neighborhoods + subdivisions indexes live, photographed, no invented cutoff | handoff 2026-08-15 | VERIFIED | — |
| R-112 | Listing detail: vacation-rental projection only with real STR data; Transparent-CMA summary after comp rework | PROSPECT_TO_CMA | MISSING | G16/G21 |
| R-113 | V3Chrome only in layout; page never remounts header; gate contracts move with migrations; PWA offline minimal | migration-recipe; decisions | LOCKED | — |
| R-114 | Experience archetypes one language across public; parity.json per migrated family; zero sliders, arrows-only carousels | EXPERIENCE; sliders rule | PARTIAL | Experience loop |
| R-115 | Admin IA locked: 11 destinations; mobile 5 tabs; Tasks/Calendar fold into Today; legacy URLs redirect forever | ia-lock; .auto-memory 2026-07-17 | LOCKED | — |
| R-116 | Dark mode: admin ships both themes reachable | 11F UNIT 1 | MISSING | G24 |

## seo-aeo

| ID | Requirement | Source | Disposition | Covers |
|---|---|---|---|---|
| R-117 | Layer A shell exact-match titles/H1s ("Homes for Sale in {City}, Oregon"); Layer B Buffett body; poetry H1s banned | TOP_SITE_GOAL | LOCKED | — |
| R-118 | Be the source AI assistants cite for Central Oregon; llms.txt + crawlers allowed; citation queries land on real pages | MASTER-SPEC D5; PRODUCT.md | VERIFIED | defend continuously |
| R-119 | JSON-LD battery: Organization, Place, Dataset, FAQPage, Listing; one FAQ derivation; no self-serving AggregateRating | DESIGN_DIRECTIVES; 2026-08-02 | PARTIAL | G22 |
| R-120 | Money-path parity contracts: housing-market Dataset/FAQ JSON-LD, LP JSON-LD + indexability, contact LocalBusiness + phone in body | money-path plan 2026-06-04 | MISSING | G22 |
| R-121 | Sitemap integrity: child sitemaps serve listing/geo URLs in prod; canonical/robots/sitemap match live routes | 2026-08-02; seo-url-guardrails | VERIFIED | gate `ci:sitemap-resolvable` |
| R-122 | Never thin indexed geo/listing families; cuts need GSC evidence + 301; /lp/* noindexed off the organic graph | ia-lock; decisions | LOCKED | — |
| R-123 | Zero-inventory city×preset pages noindex + out of sitemap; plats ≥10 lifetime sales indexable; out-of-area ≥5 active, TOP_N=100 | DECISIONS-RECORDED | VERIFIED | — |
| R-124 | Crawl-budget pruning when GSC reports starvation; hub-to-tail links; internal-link /luxury-homes-bend from money surfaces | WESTSIDE_BACKLOG | PARTIAL | G22 — luxury links SHIPPED G7 2026-08-16 (nav, city rail, /cities Bend, /communities). Crawl prune still condition-gated on GSC indexed counts. |
| R-125 | GBP review-ask: on deal close, stage Matt's template as ready CRM draft with write-review URL | WESTSIDE_BACKLOG | VERIFIED | G7 done 2026-08-16 — `restageCrmDeal` + daily `review-ask-on-close` stage `crm_message_drafts` with `GBP_REVIEW_URL`. Never sends. |
| R-126 | Win contestable SERPs (community/market/sell/lifestyle×homes); accept portal head-term dominance; funnel scoring on every page | TOP_SITE_GOAL; BROKER-OS Loop F | PARTIAL | G22 |
| R-127 | Answer-shaped H2s + real freshness stamps on geo/market pages; long-form dated citable editorial for neighborhoods/resorts | 2026-08-02 | VERIFIED | — |
| R-128 | Dual-source measurement: first-party primary; GA4-only dead-traffic claims banned; CrUX field CWV on | GOAL_10X; 2026-08-02 | LOCKED | — |
| R-129 | Lighthouse a11y/SEO/CLS blocking; promote perf/LCP warn→error after real PR samples | 2026-08-02/03 | PARTIAL | G22 |
| R-130 | Sub-second LCP goal on public routes; <2.5s hard line | MASTER_SPEC; AGENTS goal | PARTIAL | G22 |

## leads

| ID | Requirement | Source | Disposition | Covers |
|---|---|---|---|---|
| R-131 | $1M GCI year-1 (~48 closings); north star qualified seller leads; ~10× weekly qualified leads path | MASTER_SPEC §1.3; GOAL_10X | PARTIAL | scoreboard tracks |
| R-132 | One valuation spine /sell#get-value; step1 address only, step2 email required; written CMA within 24h every day | PUBLIC decisions | LOCKED | — |
| R-133 | Fees: one public 3% plan; comparison matrix dead; silent on negotiability | PUBLIC decisions | LOCKED | — |
| R-134 | Identity stitch everywhere: map Google email → crm_people → person ids → rr_vid before any ask; no fake CRM lead from cookies | PUBLIC decisions; EXECUTION | PARTIAL | G2 DONE 2026-08-16 — map write + CAPI external_id + alert stamp live; "before any ask" still open |
| R-135 | Welcome-back names last house/search; no modal on land; consent is not the price of an account | PUBLIC decisions | VERIFIED | — |
| R-136 | Conversion events E1–E6 instrumented; alert/save capture uses current search context, never a blank form | CONVERSION_MAP; PRODUCT | LOCKED | — |
| R-137 | Every outbound email/SMS carries open/click tracking tied to crm_people via attributeOutbound | SAVED_SEARCH goal; attribution plan | PARTIAL | G26 — spine tracked; audit 2026-08-15 found four untracked paths (sequence email fallback, home-valuation delivery + ack, admin one-off, CMA request confirmation) |
| R-138 | Suppression + stop-list + quiet hours checked on every send path, fail-closed | CRM_BUILD_MISSION; RECONCILED | LOCKED | — |
| R-139 | Lead routing: source→broker strategies + round-robin; no ponds; all-to-Matt dormant default | 01-DECISIONS; crm-completion | LOCKED | — |
| R-140 | Person labels closed set (Expired, FSBO, Buyer, Seller, Client); dual-intent = two labels one person | BROKER-OS | LOCKED | — |
| R-141 | Looking-at wake: identified visitors only; one per person+listing per session; unidentified = no SMS; sends Matt-gated | BROKER-OS D3 | GATED | M-class approval |
| R-142 | Buyer packet: ask-first after broker yes; names the home; never seller CMA, never lender BPO; packet sections defined | BROKER-OS D1/v0.8 | MISSING | G20 |
| R-143 | Paid ads parked; on return: Housing SAC, SAA lookalikes only, Value-my-home/listing/newsletter spines, prove-it budget, CPL tracked | ads plans; PRODUCT | GATED | M4 |
| R-144 | Meta CAPI qualified-quality loop fires at qualifying stage; per-broker ?agent= attribution on ads | ADS_GO_LIVE; PAID_ADS | PARTIAL | G2 |
| R-145 | Expired/FSBO outreach: sequences built, sends per-channel compliance, start gated on Matt | WESTSIDE; PROSPECT_TO_CMA | GATED | G17 + M-class |
| R-146 | Referral desk /refer-a-client inbound-only: no outbound drip; hand-write agreement after real inbound; never contact client first | 2026-08-14 | LOCKED | — |
| R-147 | Kill FUB/Beacon archived nurture emails still sending via connected Gmail; purge FUB vocabulary/keys | EMAIL_SEND_AUDIT; twilio-cutover | MISSING | G23 |
| R-148 | NO native sponsorship, preferred lenders, title companies; AdSense informational surfaces only, never conversion surfaces | MASTER_SPEC (Matt 2026-04-25) | LOCKED | — |
| R-149 | Newsletter is named buyer capture; signup stitches rr_vid; buyer opt-in gets listing mail not seller drips | BROKER-OS; PRODUCT | VERIFIED | — |
| R-150 | West Side: target the list, measure it, exclude existing book; audience refresh runs and logs | MASTER-SPEC D2; W1.1 | PARTIAL | G7 done 2026-08-16 — backlog dispositioned. G11 2026-08-16 — hold DAL + 36h daily probe; last LIVE 2026-08-16T09:01Z. Residual: KEEP waits for 2026-08-22; live Meta push still flag-gated. |
| R-151 | Referral-capture tier for out-of-area cities, not full page builds | RR-PLATFORM W12 | MISSING | G22 |

## nurture

| ID | Requirement | Source | Disposition | Covers |
|---|---|---|---|---|
| R-152 | Saved searches + listing alerts are ONE concept, one storage model, same engine front/back; sends from listing_alerts only | ADMIN_CONSOLIDATION; MASTER-SPEC D12 | VERIFIED | G4 done 2026-08-16 — enroll writers stamp crm_person_id; cron/engine never read saved_searches |
| R-153 | Alert engine completeness: typed events (new/price/status/open-house/coming-soon), preview/approval mode, household recipients with independent unsubscribe | SEARCH_OPT | MISSING | G4 |
| R-154 | Matt's seven Flexmls subscriptions run in-house as sender | SEARCH_OPT | MISSING | G4 |
| R-155 | Users build/edit/pause saved searches full-fidelity with branded HTML alerts; self-subscribe to market reports per area | SAVED_SEARCH goal | VERIFIED | — |
| R-156 | Admin Subscriptions hub: subscribe any contact, edit criteria in place with live English summary + count, bulk manage | SAVED_SEARCH; ADMIN_CONSOLIDATION | VERIFIED | — |
| R-157 | Sequences: monitoring-first weekly, authoring under Settings, pause-on-reply; ENROLLMENT_EPOCH — never mass-enroll the historical book | PHASE-0; RECONCILED §6.4 | LOCKED | — |
| R-158 | Expired capture floor: SFR $500K+ six cities; auto-enroll stays paused; never solicit re-listed expireds (re-check at send) | DECISIONS-RECORDED §9; RECONCILED §1.10 | LOCKED | — |
| R-159 | Newsletter: auto-draft on the 1st; Matt approves the rendered look; he enrolls and sends manually. First-cohort blast is not a loop gate (CHANGE 2026-08-16) | LIFECYCLE goal; DECISIONS §9; Matt 2026-08-16 | PARTIAL | G31 + M1 look-approve |
| R-160 | Draft-first everywhere: CMA/BPO/newsletter build allowed, send to real lead requires human click; approval surfaces show rendered previews | LIFECYCLE; crm-up-to-snuff | LOCKED | — |
| R-161 | One tracked send layer: composers only; one send chokepoint conversation→governed-send→provider; idempotency keys, no double-send | 01-DECISIONS; MASTER-SPEC D13 | LOCKED | — |
| R-162 | Visitor hot-lead handling: five-minute call task only; escalate email off | Track 2 P3 | VERIFIED | — |
| R-163 | Stage truth: journey stages advance from real events; Lead stage nonzero from real signal | COMPANY_IMPROVEMENT; probe | VERIFIED | G3 done — native-create writes Lead; sequence-enroll/first-outbound advance via advanceJourneyStage; persons 61917 + 61920 Lead; 61921 advanced Lead→Nurture; packet Lead 2 |
| R-164 | Per-person subscriptions panel (alerts, reports, newsletter) in Audiences | ADMIN decisions | MISSING | G4 |
| R-165 | Inbound email replies get reply-intent classification parity with SMS | W5.3 (2026-07-23) | VERIFIED | — |

## broker-tools

| ID | Requirement | Source | Disposition | Covers |
|---|---|---|---|---|
| R-166 | Today is the broker home: four lanes (do, socials, deals, modify); one approvals lane; wake-ups inbound-human only | BROKER-OS; ia-lock | PARTIAL | Broker OS loop |
| R-167 | Copilot: everyone-to-respond-to with next action + draft; broker yes → send + CRM records | BROKER-OS | PARTIAL | Broker OS loop |
| R-168 | Person header: who (closed labels), next step, what they're doing now — without reading notes | BROKER-OS | VERIFIED | — |
| R-169 | Phone is a full product: reply with history, log call/note, approve drafts; PWA-class mobile CRM | PHASE-0; CRM blueprint | PARTIAL | Broker OS loop |
| R-170 | One responsive person surface; delete desktop/mobile forks; unified SendPanel; one send path per concept | FULL-AUDIT; specs/03 | MISSING | G19 |
| R-171 | Prospecting: one dense sortable list (thumbnail, kind badge, prices, audit, sent, activity); real detail page; person-page rollup of expired/FSBO/CMAs + engagement | PROSPECT_TO_CMA | MISSING | G17 |
| R-172 | Per-channel prospecting compliance (SMS/email/call separately) with open-channel CTAs, not one hard stop | PROSPECT_TO_CMA | MISSING | G17 |
| R-173 | One valuation worklist (CMA/BPO/expired-audit) over one build engine; CMA kickoff ≤3 taps/≤30s from phone; async build texts broker when ready | decisions; LITMUS | VERIFIED | — |
| R-174 | CMAs sign/send as assigned broker, Matt fallback; broker-signed deliverables recorded | decisions; RECONCILED §5.11 | LOCKED | — |
| R-175 | Broker scoping fail-closed: own book by default, Matt sees all; entity-scope on every reader; no placebo surfaces | PHASE-0; MASTER-SPEC D17 | PARTIAL | G5; CAP-022 (readers on Today/People/Messages/CMAs/batch-emails; residual readers not re-audited) |
| R-176 | One capability model + in-body auth guards on every mutating admin action | 01-DECISIONS | LOCKED | — |
| R-177 | Cut list frozen: 26 routes + 12 surfaces never resurrect; one deal board (CRM deals redirects to Closings) | cut-list; Track 2 | LOCKED | — |
| R-178 | Admin v2 shell everywhere: zero legacy interiors; Geist headers; navy blacklisted as admin input; no vanity KPI walls | PHASE 11; CRM_AUDIT; 11F | LOCKED | — |
| R-179 | Delivery observability: who got what, arrived/opened/failed + fix path, globally and per person | ADMIN_CONSOLIDATION | VERIFIED | — |
| R-180 | Broker SMS agent: marketing-line replies for brokers only, whitelist-gated outbound, CMA/content/law Q&A, daily Matt digest | BROKER_SMS_AGENT | PARTIAL | G6 |
| R-181 | Twilio: per-broker business numbers public + forwarding, recording, transcription, click-to-call; one A2P campaign | twilio-cutover | PARTIAL | CAP residual |
| R-182 | /admin home is what-needs-attention-now; lead hub shows one person's everything | ADMIN_CONSOLIDATION | VERIFIED | — |
| R-183 | Restyle send chokepoints without touching the send path | P11 (2026-08-07) | LOCKED | — |

## social-presence

| ID | Requirement | Source | Disposition | Covers |
|---|---|---|---|---|
| R-184 | Live channels: GBP, Instagram, Facebook, LinkedIn; Threads/Nextdoor/Pinterest parked; Matt IG primary; brokers connect their own in Settings | BROKER-OS D6/D8 | PARTIAL | G13/CAP-019 |
| R-185 | No public post without fresh humanApprovedAt ≤7 days; silence is never approval; first week per-item, then optional 7-day grant, never forever-autopilot | BROKER-OS D7; RECONCILED §5.10 | LOCKED | — |
| R-186 | One idea fans out as per-channel variants; never identical cross-post; Loop G is a self-running draft-first calendar | BROKER-OS | MISSING | G25 |
| R-187 | Executed posts write content_performance and flip measured before any optimizer is trusted | BROKER-OS; CAP-015 | PARTIAL | CAP-015 residual |
| R-188 | GBP: one brokerage profile, exact NAP, never keyword-stuffed title; handle @ryanrealtybend everywhere | BROKER-OS; RECONCILED §2.4 | LOCKED | — |
| R-189 | Settings is the connect door; Today is the calendar; /admin/social stays a traffic report | BROKER-OS | LOCKED | — |

## transactions

| ID | Requirement | Source | Disposition | Covers |
|---|---|---|---|---|
| R-190 | Vault is transaction SoR; SkySlope is live TMS until Closings is dialed, then cut over — never a second vendor, never reverse-reconcile | BROKER-OS D2; CLAUDE §8 | LOCKED | M2 decision |
| R-191 | Dialed cutover bar: create deal in UI, fill licensed form from deal, send, seal, person↔deal — without SkySlope | BROKER-OS | PARTIAL | G8 + M2 |
| R-192 | Brokers never build forms: pick licensed blank, fill from deal, send, file; licensed blanks stay licensed | BROKER-OS | LOCKED | — |
| R-193 | Form catalog detects OREF/ODS revisions without downloading every blank; never send a stale form | T2.1b (2026-08-14) | VERIFIED | — |
| R-194 | One deal entity across pre-close + tc-close; many people per deal via tc_deal_people; two houses = two deals | decisions; EXECUTION | PARTIAL | M2 |
| R-195 | Envelope seal atomic; concurrent signers cannot double-seal; tc_events immutable audit spine | TC_ARCHITECTURE | GATED | M2 (TC resume) |
| R-196 | In-house e-sign parked for v1; signing manual/off-platform; SkySlope mutations dry-run first with Matt approval | 01-DECISIONS; RECONCILED §1.17 | LOCKED | — |
| R-197 | CMA/BPO/signing service nodes frozen: tokenized URLs, no nav, noindex | ia-lock | LOCKED | — |

## recruit-retain

| ID | Requirement | Source | Disposition | Covers |
|---|---|---|---|---|
| R-198 | New broker productive day one: own book, connect own socials, capabilities unlock marketing surfaces, one settings screen not hardcoded maps | BROKER-OS; MASTER-SPEC D17 | PARTIAL | G5 |
| R-199 | Compass-caliber presence; beat Cascade Sotheby's/Hasson locally; brokerage-as-product thesis | MASTER_SPEC (2026-04-25) | PARTIAL | version target |
| R-200 | /join stays off the exploration graph in the About cluster; chrome never sells recruiting | ia-lock | LOCKED | — |
| R-201 | /join conversion instrumented so recruiting has a number | packet | VERIFIED | G10 — `visitor_events` via `getJoinConversionStats`; packet + Today read the same DAL |
| R-202 | Recruiting toolkit deferred behind West Side proof | 03-DECISIONS A1 | PARKED | — |
| R-203 | Inbound agent referrals: destination GCI after 25% referral fee recorded | 2026-08-14 | PARTIAL | G28 — desk live, 25% fee basis recorded at intake; `inboundFeePct` is write-only and never reaches `tc_commissions.referral_fee` (audit 2026-08-15) |

## Additions (post-harvest — new directives land here in ID order)

| ID | Requirement | Source | Disposition | Covers |
|---|---|---|---|---|
| R-204 | Per-node expertise: every domain names required reads; the brief prints them under the next node; no animal is worked cold | Matt 2026-08-15 (versioning Q&A) | VERIFIED | `DOMAIN_REQUIRED_READS` + existence tests |
| R-205 | Steering verbs ADD/CHANGE/STOP: any Matt word lands as durable state in the same delivery; stops are terminal and remembered; blocked ≠ stopped — the loop routes around humans | Matt 2026-08-15 (versioning Q&A) | LOCKED | COMPANY_IMPROVEMENT §How Matt steers |
| R-206 | Unattended loop iterations with ZERO gap: the next iteration fires the moment the previous one marks itself complete (self-chaining), with a 10-min heartbeat as backstop; stops only for access gaps or the four approval classes | Matt 2026-08-15 GO + "fire as soon as the other is complete"; cap removed 2026-08-16 | VERIFIED | Clean-finish handoff: iteration curls `loop-sentinel?handoff=1` (cloud agents get RR_CHAIN_SECRET via envVars; human sessions use CRON_SECRET) → successor launches instantly. Heartbeat every 10 min backstops; kill switch and standdown apply. No daily launch cap (Matt 2026-08-16) |
| R-207 | External verification fleet: grok bots browse production like users on routines; findings feed the work graph mechanically (reproduce-or-reject); a version certifies only on a clean fleet pass; analytics sign-in stays Matt-gated | Matt 2026-08-15 (self-feeding loop) | PARTIAL | G29 — machinery live (endpoint, packs, intake, briefs); bots not yet created in the app |
| R-208 | Bots test the system like humans end-to-end including real submits (newsletter, valuation, listing contact, alert save) and the workflows behind them — via the designated fleet test identity with all side effects neutralized; admin-side effects verified by the loop | Matt 2026-08-15 ("use the system like a human, catch all use cases") | VERIFIED | G30 done — four chokepoint guards proven live (fixture 61855); Flow Prover brief + flows pack + fleet-flow-verify shipped |
| R-209 | No idle waste, no stale instructions: bot packs served live from the work graph (auto-update every iteration); RUN-TOKEN still names whether the pack text changed — a match skips re-POSTing identical pack findings, it does not end walker / money / stats / lane runs (R-217). Only Flow Prover ends on a flows-pack token match. The loop never waits on bots | Matt 2026-08-15 (thoughtful sequencing, minimize downtime); amended Matt 2026-08-16 | VERIFIED | `/api/fleet/cases/[pack]` + TOKEN PROTOCOL in `fleet-briefs.ts`; loop-inline verification remains the ship gate |
| R-210 | Full co-evolution: bot findings enter through the steering verbs (intake at every loop boot; p0/major findings outrank planned work; regressions carry the CHANGE duty into their node); the loop rewrites full bot briefs in code, served live — bots follow next heartbeat, nothing re-pasted | Matt 2026-08-15 ("everything grows together") | VERIFIED | `/api/fleet/briefs/[bot]` + `fleet-intake-core` punch-list (`FLEET-PUNCH`) in loop-brief boot + `fleetNodePriority` queue ordering |
| R-211 | THE LOOP stays DISARMED until Matt explicitly arms it ("arm the loop"). After that word, it stays armed until he says "disarm the loop". Planning-mode hold: infrastructure may be built and pushed, but no unattended iteration launches while `LOOP_SENTINEL=off`. One iteration ran before the hold landed (bc-13c50db8 completed G2 cleanly, 2026-08-16 02:20–02:45 UTC); the system was disarmed the same hour, then armed on Matt's word | Matt 2026-08-15 ("we are still in planning mode … we don't want to be executing a loop yet"); Matt 2026-08-16 21:52 PT ("Arm the loop") | LOCKED | Armed 2026-08-16 21:52 PT: `LOOP_SENTINEL=on` written to Vercel production; bake deploy follows this row. Disarm requires the same explicit word. Silence never arms or disarms |
| R-212 | Newsletter redesign is loop work: restyle the branded email shell + admin rendered preview; Matt approves the look; enroll and send stay Matt-manual. Zero agent sends | Matt 2026-08-16 (M1 CHANGE) | MISSING | G31 |
| R-213 | One generative product: xAI only (image, video, voice, content text) via `XAI_API_KEY`. Social/video/VO/stills go through `lib/grok-*.ts`. Third-party gen vendors are inventoried and canceled. Executor reads https://docs.x.ai/overview before any generate call | Matt 2026-08-16 ADD; D10 | MISSING | G32 |
| R-214 | `/admin/loop` is written for Matt: what is being fixed, what is next, what just finished, in plain English. Shop jargon folds away. Matt instructions land as graph nodes (ADD/CHANGE/STOP), never as a side feature the loop cannot see | Matt 2026-08-16 ADD | VERIFIED | G33 done — Now / Next / Waiting / Finished in plain English; bots / measuring / how it runs folded; ADD landed as graph node `1a6eb37a` |
| R-215 | Page-grade is dead. Do not grade, grind, capture a universe, write cards, fix-to-a-rubric, or regrade. Public look is Matt keep/kill on real pages | Matt 2026-08-16 STOP | LOCKED | skill refuse stubs; `ci:process-canon` asserts KILLED |
| R-216 | Same-category fleet findings share one ship: claim the class, one `npm run push`, one `deploy:verify`. Do not rebuild after each bot finding | Matt 2026-08-16 | VERIFIED | `lib/data/loop/ship-class.ts` + loop-brief SHIP CLASS + sentinel ONE SHIP CLASS prompt; G44 asserts no regression |
| R-217 | Fleet walkers do a full site review every run. Packs are the floor, not the ceiling. A RUN-TOKEN match must not end walker / money / stats / lane runs. Flow Prover stays on the four flows and may end on token match so it does not re-submit | Matt 2026-08-16 (instructions were too limited; full site review) | VERIFIED | `fleet-briefs.ts` SITE REVIEW + walker token protocol; pack header no longer says END this run now; G44 asserts the language |

## Standing Matt gates (never agent-closed)

Outbound to real people · public posts · ad spend · OAuth grants/new-platform connects · newsletter look-approve after G31 (M1) · TC cutover HOLD until TMS tested (M2) · video rebuild is xAI-only (M3 CHANGE 2026-08-16; G32) · ads spend PARKED for v1 (M4) · ~~DNS timing (M5)~~ DONE 2026-08-16 · OAuth/env review recorded (M6; no reconnect ask) · xAI-only gen stack (M7 / R-213) · press pitches · GBP/Zillow/Yelp profile corrections · severity-gate loosening · referral agreements.
