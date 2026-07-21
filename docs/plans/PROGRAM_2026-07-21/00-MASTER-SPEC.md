# Ryan Realty — Program Spec

**Drafted 2026-07-21. Not committed. Awaiting Matt's review.**

This restates Matt's 2026-07-21 requirements braindump as an executable program. It is the rewritten prompt he asked for.

Source of truth for current state: 19 domain audits, each written by one agent and then attacked by a second agent told to assume the first was wrong. Both passes read source code, not docs. Findings live in `audits/`. 190 requirement rows.

Companion documents:

- `01-PRIMITIVES.md` — the nine shared foundations and the order to build them
- `02-LOOP-V2.md` — THE LOOP v2.0.0, the continuous improvement engine
- `03-DECISIONS.md` — 11 questions for Matt plus the defaults being taken without asking
- `audits/` — the raw corpus, one file per domain, plus two research reports

---

## 1. The finding that reframes the program

Ryan Realty shipped 1,542 commits in the last 30 days. It runs 125 mechanical gates. It has 49 registered crons and 81 planning documents, 15 of them marked live.

The product is still thin in exactly the places Matt named.

Output is not the constraint. Fifteen open master plans are. Work starts faster than it finishes, so every domain sits at 60 to 80 percent and nothing closes. Every audit found the same shape: a correct implementation exists somewhere, was never made the only path, and drifted into three to twelve copies.

One measurement carries the whole diagnosis. The helper `isSuppressed` has 47 adopting files. The helper `recordEmailEvent` has 5. Both cover every send path in principle. The difference is that a gate asserts every send is suppression-checked, and no gate asserts any send is measured.

**A primitive here gets adopted exactly as widely as its gate forces, and not one file further.**

That rule sets the program's method. Every foundation below ships with the gate that makes it the only path, in the same commit. A foundation without a gate becomes copy number thirteen.

It also sets what the loop must optimize. A loop that generates work would make this worse. The loop must finish work: one item at a time, a hard definition of done, an adversarial pass before anything closes, and a cap on how many domains stay open.

---

## 2. What is already true

The audits corrected a lot of pessimism. Credit where it is earned:

- **AEO is the strongest domain.** Two mechanical gates, structured data across ~25 surfaces, FAQ and Dataset schema on 7 page families, a live `llms.txt`. This is ahead of most brokerages.
- **The geo system is deeper than the braindump assumes.** An A-to-Z searchable index of every community and subdivision with active inventory already ships. School attendance polygons from Deschutes County GIS render on school pages. The `/communities/{city}-{sub}` route renders a full ~18-section stack.
- **The sitemap already emits thousands of programmatic URLs** — every active listing, city-by-preset filters, subdivision pages, price-drop and motivated-seller facets.
- **FSBO detection runs daily and works**: Apify Zillow scrape, skip trace, native CRM lead, queued CMA, audit row. Its outbound SMS has a rigorous TCPA and suppression pipeline.
- **CMA and BPO are genuinely built**, with five real send surfaces and a working adversarial audit pattern in `lib/cma/audit.ts` that the rest of the program will copy.
- **Search and map are strong at the core**: Google Maps clustering, polygon draw with server-side point-in-polygon, an 89-field URL registry, hourly alert cron.
- **The CRM has real mobile engineering**, one nav shell, one nav source, a working Twilio send path, and reworked composers.
- **The gate substrate works and is trusted.** 125 gates enforced in CI and in a pre-push hook. This is the lever the whole program pulls.

The problem is not that things were not built. It is that built things are unreachable, duplicated, or unmeasured.

---

## 3. The dominant defect class

Across all 19 domains, the most common defect is **code that exists and cannot be reached**.

Verified live examples:

- 23 of 72 cron route directories are not registered in `vercel.json`. Nine are legitimately fanned out. The rest are dark, including `detect-expired-listings`, `marketing-inbox-poll`, `daily-broker-digest`, and `optimization-loop`.
- The only "something is waiting for you" badge in the entire broker tool never renders. `ConsoleShell` takes an `inboxUnread` prop, has one mount site, and that site never passes it.
- The like control is dead site-wide. `CardActionBar` accepts a `like` prop and deliberately never renders it, while like counts still show to signed-out visitors.
- `app/actions/home.ts` is entirely dead. Every export has zero importers.
- Four of eight allowed visitor event types have no producer anywhere, and they carry scoring weight.

This is why the loop's entry test leads with reachability, and why the adversarial auditor's first duty is to prove a real user or a registered cron reaches the code.

---

## 4. Domain contracts

Twenty domains. Each is a contract with a definition of done, not a wish. Percentages are met-requirement counts from the audit corpus.

Owner loops map to the five in THE LOOP: Growth, Demand, Nurture, Transaction, Experience.

### Tier 1 — Live defects. Fix first, no discussion.

These ship wrong output today. Several are license-adjacent. All are small.

| # | Domain | The defect | Owner |
|---|---|---|---|
| D7 | Market reports | `get_beacon_price_bands` buckets **closed sales by list price** in admin reports and CSV exports. A §0 violation on a public surface. The sibling function was fixed 2026-06-26; this one was missed. | Growth |
| D17 | Broker toolkit | CRM scoping **fails open**. `if (scopeToSelf && crmSlug)` — an unmapped broker email yields `crmSlug = null`, the filter never applies, and the query returns every broker's clients and tasks. The seeded role emails do not match the hardcoded map keys, which is the exact trigger. | Nurture |
| D3 | Geo pages | The sitemap emits `/cities/{city}/{sub}`, which does not resolve, while the working route `/communities/{city}-{sub}` is never emitted. Thousands of URLs point at hollow 200s. | Growth |
| D14 | Sharing | Three nav surfaces labeled "Sold homes" render active inventory. | Growth |
| D1 | Visitor identity | Session reads join on the dead FUB id while writes use the native CRM id. Every contact created since the June cutover shows an empty behavior panel, which a broker reads as "this lead did nothing." | Nurture |
| D1 | Visitor identity | Scroll and section tracking is dropped on ~60 page families by three stacked bugs: a missing consent field, a payload key the route never reads, and an unmapped section. | Demand |
| D12 | Saved searches | `/lp/buyer-listing-alerts` promises matches within 30 minutes and enrolls nobody. | Nurture |
| D10 | FSBO | FSBO listings are never marked gone. The off-market guard is a permanently false branch, so a sold FSBO stays solicitable forever. A compliance exposure. | Nurture |
| D5 | AEO | `robots.txt` allows Bytespider while middleware 403s it. Every listing page emits duplicate listing and breadcrumb JSON-LD. | Growth |
| D18 | Brand voice | `generate-briefs.ts` hard-fails any brief containing "about", "around", or "approximately" — words the canonical list emptied on 2026-06-02. The brain is rejecting valid content in production. | Growth |

**Done:** each defect fixed as a class, each with a gate or probe that prevents its return.

### Tier 2 — Foundations. Everything else waits on these.

Detail in `01-PRIMITIVES.md`. Nine primitives, dependency-ordered.

| P | Foundation | Replaces | Unblocks |
|---|---|---|---|
| P0 | Reachability spine — cron-registered gate, dead-export gate, `loop_runs` heartbeat | 23 unregistered crons, ~15 dead modules, no heartbeat | Makes every later phase verifiable |
| P7 | Fail-closed authorization | 3 hardcoded broker email maps, filters that fail open | Onboarding a broker without a deploy |
| P1 | Person identity spine — one subject id, one resolver | Two id spaces read and written inconsistently | Behavior panels, engagement, ad-click resolution |
| P2 | Outbound message bus — one `sendTracked()` | 31 raw send importers, 5 measured, 3 CMA delivery paths | "Everything this contact got and clicked" |
| P4 | Geo taxonomy registry | 10+ hardcoded place lists, 3 inline re-declarations | Correct sitemap, stats coverage, blog-to-geo links |
| P3 | Typed telemetry contract | 4 emitters, 4 dead event types, 3 stacked payload bugs | Scroll and drop-off reporting, real intent scoring |
| P5 | Canonical market-stats engine | 3 engines computing the same numbers 3 ways | One verification trace per figure, 10-year history |
| P6 | One search vocabulary | 2 map stacks, 3 filter vocabularies | Faceted pages, polygon alerts, broker-created searches |
| P8 | Generated rule sources | 12 hand-maintained banned-word lists, 5 hardcoded model ids | Voice enforcement that cannot drift |

**Done:** the old paths deleted, not deprecated, and a gate asserting the new path is the only path.

### Tier 3 — Domain build-out. Most of this shrinks once Tier 2 lands.

| # | Domain | Requirement in one line | State | Gap |
|---|---|---|---|---|
| D1 | Visitor identity | Resolve a known homeowner on ad click, track their session, show the whole story on the contact record | partial | Ad-click leg absent entirely. No per-person ad URL, no `fbclid` join, identity map never read at track time |
| D2 | Meta ads | Target the West Side list, measure it, exclude the existing book | partial | The governed daily sync pushes the **entire CRM with no geography filter**. The West Side audience is refreshed by a hand-typed command. No exclusion audience exists, so prospecting spend can be served to current clients |
| D3 | Geo pages | Community, neighborhood, subdivision, city — one archetype, no thin content, GIS boundaries | partial | Four hand-maintained section lists. Parks and trails polygons absent. No out-of-area referral capture |
| D4 | Faceted search | Thousands of pre-built indexable search pages | partial | One faceted engine exists with **zero `generateStaticParams`**. 35 presets flat. Three-way geo × type × status never emitted |
| D5 | AEO | Be the source LLMs cite for Central Oregon | **working** | Duplicate JSON-LD, robots/middleware mismatch, no AI-referral measurement |
| D6 | Listing detail | Expose the full record, mobile-first, convert | partial | 87 of ~800 fields surfaced. `amenities` jsonb never read. A 3s broker-query timeout removes **every contact CTA** while the page still returns 200 |
| D7 | Market reports | HousingWire and Mohtashami rigor, local data, one engine, 10 years | partial | Three engines. Cache does not reach 10 years. No time-frame selector. Neighborhood tier thin |
| D8 | CRM dashboard | One view answering "who do I contact right now" | partial | Landing view is recency, not priority. The only unread badge is dead. Two dashboards remain |
| D9 | Expired | Detect, enrich, audit, send, track, reply, enroll | partial | More built than assumed — manual enrollment and AI reply drafting both exist. Detection cron is **unregistered**. No sent/not-sent filter |
| D10 | FSBO | Same as expired, across Craigslist, Marketplace, Zillow | **working** | Zillow only. $500K floor inherited with no decision. Off-market guard dead |
| D11 | CMA and BPO | Thorough valuations with offer strategy, tracked | partial | Real and reachable. Gmail transport means no bounce signal, so bounce suppression never fires for these recipients |
| D12 | Saved searches | Same engine front and back, tracked, hide and save | partial | Broker create captures 5-6 fields, broker **edit** captures 12. The richest vocabulary is unreachable from any create surface. Guests structurally report zero engagement |
| D13 | Newsletter and sends | One tracked send layer for everything | partial | Newsletter is genuinely automatic and reachable. It calls `attributeOutbound` and never `recordEmailEvent`, so newsletters are **absent from `email_events` entirely** |
| D14 | Sharing | Share a listing or post and have it look like a real post | partial | Blog and listing OG cards verified live. Like is dead site-wide. No city OG branch |
| D15 | Search and map | Fast, covers everything, map updates on move | partial | Two divergent map stacks. Map query hand-lists ~18 of ~90 fields, so pins do not match the list |
| D16 | Content at scale | Thousands of pages, 10 years of reports, bulk approve | partial | Lifestyle taxonomy already exists across 6 page families. No bulk tooling. No city-records mining. Admin blog list never selects `status`, hiding 28 quarantined posts |
| D17 | Broker toolkit | A broker can be productive on day one | partial | Two marketing surfaces exist and are **locked behind empty capability arrays**. Unlocking is one edit |
| D18 | Brand voice | Orwell's six rules, no pandering, no salesy tone | partial | 12 duplicated lists. Four of six rules cannot be regex-detected. Emails, SMS, CMA prose, VO, captions, and Supabase blog posts are **ungated entirely** |
| D19 | THE LOOP | Continuous, guardrailed, adversarial, measured | **shelved** | Matt shelved the loop concept 2026-07-21. Spec preserved at `02-LOOP-V2.md` for later. Not part of this program |
| D20 | Transaction (TC) | Oregon-compliant coordination | not audited | Needs a 20th audit to seed its contract |
| D21 | **FUB purge** | Zero references to Follow Up Boss anywhere | **not started** | Matt directive 2026-07-21. See §4.1 |
| D22 | **Canon consolidation** | One rule stated once, one audit per subject, one plan per initiative | **in progress** | Matt directive 2026-07-21. See §4.2 |

### 4.1 D21 — FUB purge

**Directive (Matt, 2026-07-21):** "We do not use Follow Up Boss anymore so there should be zero reference to it."

**Verified state.** FUB is off the serving path — zero calls to `api.followupboss.com` anywhere in `app/`. No API route, no cron. What remains is residue:

| Residue | Count |
|---|---|
| Code references — `app` 842, `lib` 990, `components` 197, `scripts` 580 | 2,662 |
| Database columns named `fub_*` | 15 |
| Env vars, including `FUB_LOGIN_EMAIL` and `FUB_LOGIN_PASSWORD` | 5 |
| Doc files mentioning FUB | 905 |
| Modules containing `api.followupboss.com` calls | 3 lib + 19 scripts |

**Live call sites, all reachable.** Verified as imported by live code. Not yet verified whether each call executes or sits on a dead branch — read before touching.

- `lib/expired-owner-lookup.ts` — imported by `app/api/admin/expired-listing-lookup/route.ts`, `lib/expired-listing-processor.ts`, and `lib/fsbo-processor.ts`. On the live expired and FSBO owner-lookup path.
- `lib/cma-delivery.ts` — reachable via `app/api/cma-delivery/route.ts`. Already flagged legacy, no suppression check.
- `lib/crm/mirror.ts` — imported by `app/actions/crm.ts`.

**This is the same work as the top-priority defect.** The #1 audit finding is that `visitor_sessions` rows are written with the native `crm_people.id` but read by joining on `fub_person_id`, so every contact created since the June cutover renders an empty behavior panel and a broker reads it as "this lead did nothing." That bug *is* the FUB residue. Purging FUB from the identity path and fixing the behavior panel are one job, not two.

**Order:**

1. Read the three live call sites, determine dead vs. firing, remove the calls, pull the stored credentials.
2. Migrate every reader to `crm_person_id`, backfill pre-cutover rows. Fixes the empty behavior panel in the same change. This is primitive P1.
3. Rename the 15 `fub_*` columns, expand-contract. Touches live columns — migration shown to Matt before it runs.
4. Docs fold into D22. FUB becomes one historical note explaining what the old system was and why we left, not 905 files implying it is current.

### 4.2 D22 — Canon consolidation

**Directive (Matt, 2026-07-21):** "One document that is the go-to document. We don't want multiples of anything, anything contradictory." Then, correcting scope: "WE NEED TO KEEP MEMORY AND CONTEXT — I just don't want duplicates or conflicting audits, reports, plans."

**Target is deduplication, not deletion.** One audit per subject, one plan per initiative, one statement per rule. Knowledge is preserved. Redundancy and contradiction are what goes. A file is removed only when its entire content has demonstrably moved somewhere else.

**Scope measured 2026-07-21:**

| Source | Files | Lines |
|---|---|---|
| `docs/**` | 618 | 236,424 |
| `SKILL.md` across five skill directories | 536 | 199,425 |
| `.cursor/rules` | 29 | — |
| CLAUDE.md + AGENTS.md | 2 | 1,548 |
| **Total governing prose** | **~1,200** | **~440,000** |

**Proof the corpus cannot be trusted as written:** CLAUDE.md references `video_production_skills/` 49 times and calls several of its files mandatory, non-negotiable reading. That directory contains three `.ts` files and zero markdown. `VIDEO_PRODUCTION_SKILL.md`, `ANTI_SLOP_MANIFESTO.md`, `VIRAL_GUARDRAILS.md`, `captions/SKILL.md`, and `API_INVENTORY.md` do not exist. Assume this class of rot throughout — verify every claim against code before preserving it.

**End state:**

- `CANON.md` — the rules. One statement per rule, no duplicates, no conflicts. Each rule marked mechanically enforced (naming its gate) or prose-only.
- A consolidated knowledge base — the memory. All verified findings, decisions, and the reasoning behind them, deduped to one document per subject.
- Machinery — files that running code reads, kept and stripped of restated rules, pointing at `CANON.md`.
- CLAUDE.md — reduced to a pointer plus the rules that must sit in an agent's context automatically.

**Deletion safety.** Several gates read documentation. `check-process-canon.mjs` (G44) fails CI if a file sits in `docs/plans/` unregistered. `validate-producer.mjs` requires the literal string `voice_guidelines.md` in all 24 producer SKILL files, so deleting that one file fails CI repo-wide. The full gate-breakage map and safe deletion ordering land with the consolidation output. Nothing moves before it exists.

---

## 5. Sequence

Nine phases. Each ships alone and is useful alone.

| Phase | Work | Why here |
|---|---|---|
| 0 | Reachability gates only (P0a) | Without them, phases 1-8 drift into the same orphan state. This already happened four times |
| 0b | **FUB purge steps 1-2 (D21)** | Removes the live FUB call sites and the stored credentials. Step 2 *is* phase 2 — the identity migration off `fub_person_id` is the same change |
| 0c | **Canon consolidation (D22)** | Runs alongside, not after. Every phase below reads the rules, so having one non-contradictory statement of them first prevents rework |
| 1 | Fail-closed scoping (P7) | The only live data-exposure item. Small. Do it before the identity refactor touches the same call sites |
| 2 | Person identity spine (P1) — **merged with D21 step 2** | The hinge. Everything touching a human joins here. Fixes the empty behavior panel and removes the FUB join key in one change |
| 2b | **FUB schema rename (D21 step 3)** | After readers are migrated. Expand-contract. Migration shown to Matt before it runs |
| 3A | Outbound message bus (P2) | Largest unblocked cluster: newsletter, CMA, BPO, expired, alerts, bulk send, preferences |
| 3B | Geo registry (P4) | Runs parallel to 3A — places, not people. Ships the sitemap fix first |
| 4 | Telemetry contract (P3) | After a subject exists. Do not build lead scoring before this |
| 5 | Market-stats engine (P5) | After the registry, or the backfill re-hardcodes 11 cities. Price-band hotfix ships this week regardless |
| 6 | Search vocabulary (P6) | After registry and identity |
| 7 | Loop heartbeat and ledgers (P0b) | Deliberately late. Nothing trustworthy to measure until P2 and P3 exist |
| 8 | Generated rule sources (P8) | Gates content-scale work |
| 9+ | Domain build-out | Most items are materially smaller now. Several become one-liners |

Tier 1 defects run alongside phases 0 and 1. They do not wait.

### Do not build in the wrong order

- **No lead-scoring model before phase 4.** Two complete engines already exist unwired. Both would score everyone on inputs that cannot fire.
- **No bulk content tooling before the admin blog list selects `status`.** A bulk tool on that surface acts blind.
- **No historical report archive before the stats engines are consolidated.** You would backfill a store that a third engine contradicts every Sunday.
- **No marketing self-service rebuild before phase 1.** Two surfaces exist and are switched off. Unlocking is one edit; rebuilding is weeks.

---

## 6. How the work runs

`02-LOOP-V2.md` carries the full spec. The shape:

- 20 domain contracts, each with frozen requirements and a probe battery, so done cannot recede as it is approached.
- 190 audit rows seed one ranked queue. One scoring function, so five sessions cannot rank the same fleet differently.
- An **impact test** every candidate must pass before it can be worked: a named metric, a live baseline, a falsifiable prediction, and proven reachability. Failing it is how busywork dies.
- Three verification tiers: mechanical gates, then a starved adversarial subagent told to refute, then a verdict **computed in code** from the findings — never asserted by a model.
- Model routing by cost of a wrong answer divided by strength of the oracle that would catch it. Opus judges and reviews. Sonnet implements and reads. Haiku transforms. Scoring and verdicts use no model at all.
- Measurement stamped before the commit, closed by a cron reading a signal table no agent writes. An agent cannot grade its own work.
- Three approval classes. Infrastructure ships continuously. Anything a client sees queues for Matt, capped at 3 per domain and 12 fleet-wide so the queue never becomes the bottleneck.

---

## 7. Open decisions

Eleven questions in `03-DECISIONS.md`, plus the defaults being taken without asking.

The three that block the most work:

1. **What is a scheduled loop allowed to do without Matt in the session?** This single answer determines whether "run continuously" is buildable.
2. **What is the 30-day win condition** — fix live defects, prove the West Side loop end to end, or build the recruiting toolkit? All three touch the same plumbing.
3. **Brand voice: replace the banned-word list, or layer Orwell on top of it?** Removing the list does not weaken enforcement gradually. It removes it in one commit.
