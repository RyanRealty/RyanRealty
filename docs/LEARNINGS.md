# Ryan Realty — LEARNINGS

**The one document every agent reads before it executes.** Claude Code, Cursor, Grok Bot,
Grok Build, Copilot: same file, same rules. Models are rented. This file is owned.

**Compiled 2026-09-02** from the whole archive: `CLAUDE.md`, `AGENTS.md`,
`docs/DEVELOPMENT_PROCESS.md`, `docs/MECHANICAL_GATES.md` (292 gate scripts),
the live `process_escape_ledger` table (7 rows), `docs/plans/ENTERPRISE_MAP/REQUIREMENTS.md`
(R-200 to R-222), `docs/plans/MARKET_TRUTH/` (D1 to D16), `.auto-memory/`, every
`HANDOFF_*` doc, `docs/audit/` and `docs/audits/`, and `docs/plans/CROSS_AGENT_HANDOFF.md`. Extended 2026-09-01 from a full mine of the local
session archives — every Claude Code transcript for this repo, Cursor's composer
history, and Grok Build's prompt histories — for Matt corrections not yet written down.

## The law of this file

1. **Nothing goes in unless something actually broke.** Every entry names the incident:
   what shipped wrong, what it cost, who caught it. Theory, best practice, and "we should
   probably" do not qualify. An entry without an incident gets deleted.
2. **Fixes beat prompts.** When Matt corrects an agent, the correction is written here in
   the same session, and into the canon file that owns the surface. A rule that lives only
   in chat history is lost next session (CLAUDE.md preamble).
3. **A rule that keeps being broken becomes a gate, not more prose.** This file is the
   *why* layer. The *enforcement* layer is `docs/MECHANICAL_GATES.md`. Each entry below
   says where the rule now lives. If it says "prose only", that is the next gate to build. Once a rule has a gate, its entry
   collapses to the rule, one line of incident, and the pointer; the gate's row in
   `docs/MECHANICAL_GATES.md` keeps the story.
4. **This file is a digest with pointers, not a second source of truth.** Where an entry
   and its owning canon disagree, the owning canon wins and this file gets fixed.
5. **It only compounds.** Entries are never deleted because they feel obvious. Obvious is
   what a rule feels like after it has been learned.

## How to add an entry

```
- **Rule in imperative form.** What broke, with the number or the surface. Who caught it.
  → Lives in: <gate script | CLAUDE.md §N | REQUIREMENTS.md R-NNN | prose only>. Source: <file>, <date>.
```

Then, in the same commit: apply the rule to the immediate work, and if the class has
escaped twice, build the gate (`docs/MECHANICAL_GATES.md` has the pattern).

Entry shape is mechanical (`scripts/check-learnings-canon.mjs`, G71): at most 9 lines and
800 bytes, both pointers present, at most 6 lines once a gate enforces it, and the three
agent surfaces (CLAUDE.md, AGENTS.md, GROK_BOT_BRAIN.md) must keep naming this file.

---

# 1. Prime directives

The rules that outrank everything else, each with the incident that made it a rule.

- **If you don't have proof, say "I don't know" instead of guessing.** Every public number
  traces to a named source, freshly queried, with the raw result printed. A cloud text
  producer wrote 9 of 17 "ready" rows with fabricated citations and draft paths
  (2026-05-29). Caught at the cron level, not by review, nothing published.
  → Lives in: CLAUDE.md §0, `lib/voice/check.ts` no-trace-no-ship at the publish route.
  Source: `docs/HANDOFF_PRODUCER_FIX_2026-05-29.md`.
- **An estimate is a number.** A date, duration, or impact estimate needs a named basis or it
  does not ship. Folklore stated as fact is fabrication. Matt directive 2026-07-29.
  → Lives in: CLAUDE.md §0.
- **Absence from one query shape is not absence.** A coverage report exact-matched MLS alias
  slugs against plat slugs, found nothing, and told Matt to go source county plats from
  DIAL. `boundaries` held 3,213 subdivision rows. One `count(*)` would have killed it.
  Repeated 2026-08-15: GBP, YouTube, X reported dead from `expires_at` alone; all three
  auto-refresh daily. Matt directive 2026-08-06.
  → Lives in: CLAUDE.md §0; `TokenHealth.refreshTokenPresent`. Source: escape ledger row 6.
- **Never spend without approval.** Ad spend, outbound messages to real people, public
  posts, OAuth grants: per-action Matt approval, every time. Silence is never approval, a
  passing gate is never approval, a green build is never approval. Matt 2026-07-21.
  → Lives in: CLAUDE.md §1; `validateDbApproval()` in `app/api/social/publish/route.ts`.
- **Never overwrite another session's work.** `git add -A` in one session absorbed another
  session's 8 staged files into an unrelated commit; the other session then saw "nothing to
  commit" (2026-05-14). History mis-attributes it permanently.
  → Lives in: AGENTS.md (stage specific paths, `git status --short` before commit).
  Source: `.auto-memory/memory_marketing_brain_decisions.md`.
- **The builder never grades its own homework.** The work-graph machinery (v1.2 to v1.5)
  shipped self-verified. The first fresh-context adversarial pass found 17 defects: two
  gates blind to tail-row deletion, a state machine bypassable below the DAL, a fail-open
  ledger guard, four overstated register rows. Matt directive R-040, 2026-08-15.
  → Lives in: `docs/DEVELOPMENT_PROCESS.md` v1.5.1 step 5; DB triggers
  `loop_work_nodes_guard`, `site_improvement_ledger_guard`. Source: escape ledger row 7.
- **Do not poll CI.** A session sat on `gh run view` in a loop and re-ran `ci:gates` after a
  green stamp. Hundreds of dollars ("648 compose PR #134 burn"). One `ci:gates` per ship,
  push, stop. Matt directive R-221, 2026-08-19.
  → Lives in: G44 `check-process-canon.mjs` asserts the string in three files.
- **Look at the real output like a human before calling it done.** Producer rebuild review
  was harsh because automated tests passed on outputs that did not fulfil the spec.
  Dispatching subagents to "make a mockup that passes the test" is banned (2026-05-19).
  Generalised 2026-09-01 as the TASTE canon: five questions answered on screenshots
  before any public surface ships.
  → Lives in: `docs/HANDOFF_PRODUCER_REBUILD_2026-05-19.md`; TASTE canon commit `f8f5248`.
- **Never ask Matt to run anything.** All git, terminal, deploy work is the agent's. The
  only exception is a missing secret or access, stated exactly.
  → Lives in: CLAUDE.md §8, AGENTS.md Execution.
- **"You're right, I should have looked at X" is banned.** X becomes a mandatory preflight
  input. Every escape gets three things: the whole class fixed, the check that would have
  caught it, a `process_escape_ledger` row.
  → Lives in: `docs/DEVELOPMENT_PROCESS.md` "When something escapes".

---

# 2. Decision authority

Confirmed by Matt 2026-07-21. Full autonomy with post-hoc review for everything reversible;
per-action approval for exactly four classes; two later carve-outs.

| Class | Authority | Mechanism |
|---|---|---|
| Code, infra, gates, DAL, migrations, site content, skills, dead-code deletion | Autonomous. Commit, push, Matt reviews after, reverts if bad | CLAUDE.md §1 |
| Outbound email or SMS to a client, lead, or prospect that an agent initiates | Per-action Matt approval | CLAUDE.md §1 class 1; `sendGovernedSms` / `sendGovernedEmail` chokepoint (G56) |
| Publishing to a public social channel | Per-action approval; stamp must be ≤ 7 days old | `validateDbApproval()`, `GATE_MAX_AGE_MS = 7 * 24h`, pinned by `check-approval-stamp-wired.mjs` |
| Ad spend: create, change, or scale paid campaigns | Per-action Matt approval | CLAUDE.md §1 class 3 |
| OAuth grants: connecting accounts, granting scopes | Per-action Matt approval | CLAUDE.md §1 class 4 |
| `content:*` drafts a broker initiates on the broker SMS line | That broker's APPROVE reply is the stamp (same 7-day freshness); Matt gets a daily digest. 2026-08-01 | `lib/agent/runtime.ts` APPROVE/HOLD → `handleApproveAction` stamps `approved_by = brokerEmail` |
| Rendered video committed to tracked `public/` paths | Commit needs `Approved-by: matt` or `Draft-shown: <url>` | `check-draft-first.mjs` via commit-msg hook |
| A2P/10DLC campaign creation or change (`Usa2p create`) | Explicit per-run Matt authorization, never inferred | `.claude/skills/crm-e2e/SKILL.md` |
| Anything client-facing from the TC system (a real envelope, a real email) | Draft-first, Matt approves | `.claude/skills/tc-builder/SKILL.md` |
| Admin Product OS process / IA / visual / litmus decisions | Matt lock; the loop never crosses a lock | `.claude/skills/admin-product-os/SKILL.md` |
| Arming or disarming THE LOOP | Only Matt's words "arm the loop" / "disarm the loop"; silence does neither. One iteration ran before a hold formally landed (R-211) | `docs/GROK_BOT_BRAIN.md`, REQUIREMENTS.md R-211 |

Broker self-approval does not extend the four classes to brokers generally. It only
substitutes the broker's own SMS reply for Matt's, on drafts that broker initiated.

---

# 3. Stop points

Where an agent halts and waits for a human. Each one exists because an agent once did not.

| # | Stop when | Do this |
|---|---|---|
| 1 | Any of the four approval classes is about to fire | Surface the specific action. Wait for an explicit yes |
| 2 | A rendered content deliverable is ready | Build to `out/` (gitignored), show Matt, get the marker, then commit |
| 3 | Spark × Supabase delta > 1% on any market-report figure | Print both values, both queries, delta, suspected cause. Stop. **Prose only today; no script enforces it** |
| 4 | A stat cannot be verified against a named, freshly-run source | Cut it. Ship with fewer numbers, never one wrong one |
| 5 | A "there is no data for X" is about to reach Matt as a decision | Run a second, differently-shaped query (a broad count) and show both first |
| 6 | An untraced public number surfaces during diagnose | Stop-class. Trace it or remove it before anything else |
| 7 | A defect reached Matt or production | Fix the class, add the check, write the ledger row. Then continue |
| 8 | A data leak to an anonymous visitor is found | Drop everything. It is an incident, not a queued fix |
| 9 | Admin Product OS hits a process / IA / visual lock | Write the decision package, mark `awaiting_lock`, stop |
| 10 | A loop skill is green (crm-e2e all-PASS, tc-builder nothing unblocked) | One short line, then silence. Do not invent busywork |
| 11 | Blocked on a live SkySlope session, an external credential, or a Twilio verification code only Matt can enter | Say what is needed in one line. Stay staged. Do not nag |
| 12 | A domain has open or expired-unlearned measurement windows | No new class in that domain until the Learn step closes them |
| 13 | The CMA engine is about to be changed | Read `marketing_brain_skills/producers/cma/SKILL.md` first. Matt stopped a change mid-flight because two "bugs" it diagnosed were already fixed or wrong: "you must know how we do cmas before implementing anything" |
| 14 | A boundary polygon disagrees with a recorded plat or HOA declaration | Research, do not tighten geometry. The polygon is sometimes the thing that is wrong (Osprey Pointe is legally carved out of the Crosswater plat) |

---

# 4. Hard-won lessons, by theme

## 4.1 Data accuracy and market truth

- **Bare `PropertyType='A'` is a mixed bucket, not single family.** `/sell` was about to
  publish 988 homes / 4.52 months of supply from the A bucket; detached truth was 775 /
  4.42, a different verdict. SFR is `property_sub_type='Single Family Residence'`.
  → Lives in: CLAUDE.md §7, MARKET_TRUTH D1. Source: `docs/plans/MARKET_TRUTH/DECISIONS.md`, 2026-08-22.
- **Never derive a market stat from `details` JSONB; use typed columns.** The 2026-04-25
  cache audit found six corruptions from this: `median_dom=0` everywhere, median equal to
  average, sale-to-list hardcoded 1.000, `sold_count` inflated 48 to 83%, Redmond
  `median_ppsf` at $22,310, 13 of 30 columns silently NULL.
  → Lives in: `check-dal-internal-discipline.mjs` (G21). Source: `.auto-memory/memory_cache_layer_rewrite_2026_04_25.md`.
- **Months of supply = actives / (closed last 6 months / 6). Thresholds ≤4 seller, 4 to 6
  balanced, ≥6 buyer. The pill must match the number.** A fleet bot found
  `/communities/tetherow` showing 4.6 months next to 35 actives and 36 sales/12mo, which is
  arithmetically impossible.
  → Lives in: `check-market-formula.mjs`, `check-publish-months-of-supply.mjs`.
- **A NULL feature flag is unknown, never false.** 16 YN fields are 90 to 100% NULL with
  zero explicit `false`; "no HOA" from NULL misleads a buyer who finds dues at closing.
  Live counterexample: `pool_yn` returned 167 vs 15,763 depending on whether NULL was
  treated as false. Only `garage_yn` clears the 70% item-response floor. Matt 2026-08-22.
  → Lives in: MARKET_TRUTH D13, D16, `PLACE_CONTENT_RULES.md` R3.
- **HOA dues are segment-scoped and 36-month windowed.** Averaging across a mixed-type
  subdivision put 50 pages at more than 2× the real number (worst: $1,852/mo published).
  → Lives in: `check-publish-place-hoa.mjs`, `PLACE_CONTENT_RULES.md` R2. Matt 2026-08-26.
- **Year-built range is p10 to p90, never min to max.** 151 subdivisions carried a stray
  pre-1940 outlier; min-max spans averaged 23 years vs 12 for percentile.
  → Lives in: `PLACE_CONTENT_RULES.md` R1.
- **CDOM resets at 60 days, not 90.** Oregon Data Share §3-20. The 90-day figure is only the
  `new_listings` de-dupe window. → Lives in: MARKET_TRUTH D15.
- **Do not exclude unprovable-DOM rows.** 17.3% of 2021 to 2026 closes have unprovable
  spans; they skew slow, so excluding them makes the market look faster than it is.
  → Lives in: MARKET_TRUTH corrections, 2026-08-22.
- **The region list is the live 16 MLS-city set.** A draft DDL invented 18 cities, added
  Mitchell (Wheeler County, a different market) and dropped Tumalo, Warm Springs, Crooked
  River Ranch. It moved the published median by real dollars.
  → Lives in: MARKET_TRUTH D14; `check-market-city-mls-canon.mjs` (Crooked River Ranch had
  been filed under Terrebonne, Tumalo under Bend, behind a false "verified" comment).
- **Townsite plats are not residential subdivisions.** `redmond-townsite` spans 10 sub-types
  across a century; "a typical home of 1,276 sqft" is a category error.
  → Lives in: `PLACE_CONTENT_RULES.md` R4.
- **Cite methodology `v3-2026-05-07`, never v4.** The v4 definition exists; no served row
  carries it. → Lives in: CLAUDE.md §7.
- **Inverse metrics must be declared or improvement reads as a crash.** GSC average
  position moving 37 → 4 was classified as a crash (2026-05-13).
  → Lives in: `INVERSE_METRICS` list in the marketing brain. Source: `.auto-memory/memory_marketing_brain_decisions.md`.
- **Never publish `"DaysOnMarket"` as DOM.** It is list-to-close. → Lives in: CLAUDE.md §7.
- **Unit tests cannot catch a page disagreeing with itself.** They assert a map against
  itself. The whole `check-publish-*` family exists because a fleet walked production and
  found two numbers for one fact on one page (`ridge-at-eagle-crest` hero "14" vs listed
  "26" vs indexed "12"; homepage "1,834 homes" beside six towns summing to 927). The
  pattern: diff the published number against its own source or a sibling surface.
  → Lives in: ~25 `check-publish-*.mjs` gates.
- **A gate that pins the spelling of a mechanism fails the better replacement.** G52, a D91
  contract test, and `ci:publish-months-of-supply` each rejected a strictly stronger change
  because they asserted implementation shape. Assert the outcome, with negative fixtures.
  Source: `docs/plans/CROSS_AGENT_HANDOFF.md` ("third time this session").

- **CMA comps come from the subject's own market: subdivision, then neighborhood group,
  then radius; never a premium community, never a cheaper submarket.** Pine-area homes got
  Crosswater/Caldera Springs comps; an Old Bend CMA used Southeast Bend comps; the Delaware
  CMA repeated it after the rule was stated. Widen in order, never across a boundary.
  → Lives in: prose only for comp selection; `check-resort-definitions.mjs` for resort
  membership. Source: Claude Code 2026-07-30, 2026-08-05, 2026-08-29; Grok Build 2026-08-31.
- **A CMA never recommends above the home's own expired ask.** The market already proved
  that number too high; any such output means the comp logic is wrong — root-cause it,
  don't patch the case. Matt stated it on consecutive days.
  → Lives in: prose only. Source: Claude Code sessions, 2026-08-04, 2026-08-05.
- **The comps that set the price are the comps the client sees — one set, one engine.**
  Pricing and display pulled from two different sources; separately Matt had to ask whether
  the reverse-engineered pricing engine was even in the loop ("that needs to be the only
  source of pricing information"). Five comps minimum shown (absolute floor three), never a
  value set off three sales, and no "expected sale" figure — listing range plus recommended
  list price only.
  → Lives in: prose only. Source: Cursor sessions, 2026-08-17; Grok Build session, 2026-08-19.
- **From a competitor's report, take the data density — never the value, never the look.**
  RPR's $2.42M refined value and its tables were banned from the in-house CMA even while
  its content depth was the target.
  → Lives in: prose only. Source: Cursor session, 2026-08-17.

## 4.2 Database, cache, and performance

- **Never read `listings.details` over a broad candidate set.** It is TOAST-backed, up to
  37× slower per row: a 335-second anon-facing outage (2026-07-31) and `listing_tile_mv`
  8 days stale. Narrow first via trigger-maintained side tables; a typed-column swap only
  after proving zero disagreement table-wide (`has_virtual_tour` disagreed on 1,423 rows).
  → Lives in: `check-toast-read-discipline.mjs`. Source: `docs/TOAST_READ_DISCIPLINE.md`.
- **PostgREST silently caps at 1,000 rows.** Newsletter send tiering, CRM tag counts, the
  inbox queue and 20+ dashboard reads were silently truncated (2026-07-14).
  → Lives in: `check-row-cap.mjs` (G48).
- **Measure an index against the real query shape before adding it.** A covering index on
  `sale_pricing_facts` was slower (5.75s vs 1.77s seq scan) and was reverted. Static
  index-gap guesses were wrong 3 of 5 times. `EXPLAIN (ANALYZE, BUFFERS)` first.
  Source: `docs/plans/CROSS_AGENT_HANDOFF.md`.
- **Repo migrations are not prod migrations.** `/guides` rendered empty for 2.5 months and
  four more features were dead (`reporting_cache`, `listing_embeddings`,
  `partner_programs`/`referrals`, `revenue_events`) because migrations sat in the repo
  since March and were never applied. Resilient-cache fallbacks swallowed the `42P01`
  errors so nothing 500'd. The schema snapshot is generated from prod, so it cannot see
  them. → Lives in: `check-migration-drift.mjs`. Source: escape ledger row 3, 2026-06-10.
- **Mixed-case `listings` columns must be double-quoted in raw SQL, and must NOT carry
  literal quotes in supabase-js strings.** The second silently returns nothing; it was the
  2026-05-28 "Listing Not Found" regression class.
  → Lives in: `check-dal-column-quoting.mjs` (G17), CLAUDE.md §7.
- **`force-dynamic` and `revalidate` cannot coexist**; it silently disables ISR.
  → Lives in: G18.
- **Sentry `tracesSampleRate` ≤ 0.2** or the quota drains silently. → Lives in: G19.
- **A "renders on first request, caches after" pattern is only safe if the first request
  can complete.** `app/sitemaps/[cls]/route.ts` built the whole 10.7K-URL universe per
  class with no `maxDuration`, died before writing headers, so `unstable_cache` never
  populated. 3 of 5 sitemaps returned zero bytes for weeks.
  Source: `docs/audits/WEBSITE_AUDIT_2026-08-02.md` P0-1.
- **Confidential MLS keys must be checked by display name and by field name.** `Private
  Remarks` bypassed a list that held only `PrivateRemarks`; broker-private remarks were
  anon-readable on ~78% of listings. A second leak survived remediation via a cross-group
  label collision. → Lives in: `check-private-key-parity.mjs`. Source: 2026-07-30 audit.
- **Killed test runs leave residue in production tables.** A 2026-07-30 survey found
  stranded test rows in 7 tables (17 in `cmas`, 22 in `crm_people`).
  → Lives in: `check-int-test-residue.mjs` (G59).

- **Every statistic goes through the one stats process; the `-- audit:` escape hatch is
  not a stats path.** Inventory, closed-sale, and comp-pool counts were being computed
  honor-system through the raw-SQL bypass. Matt closed the loophole he had used himself:
  "all stats should come through one process, enforce this."
  → Lives in: `scripts/stat-tables.cjs`, `pre-tool-use.mjs`, `check-script-stat-source.mjs`.
  Source: Claude Code sessions, 2026-08-26.

## 4.3 CRM, identity, and outbound

- **Never trust the `rr_pid` cookie when the submitted form carries a different email.**
  All four lead-intake surfaces did. Live repro: one person's home valuation, seller tags,
  a CMA of a house she did not own, two call tasks, and an auto-sending seller sequence
  all landed on a different person's record because that browser still carried the first
  person's cookie. → Lives in: `lib/crm/submitted-identity`. Source: `docs/plans/CROSS_AGENT_HANDOFF.md`.
- **A settings toggle nothing reads is a lie to the broker.** `notify_new_leads`,
  `notify_deal_activity`, `notify_task_due` were writable and read by zero send paths.
  A quiet window may downgrade a lead notification to push-only; it never drops one.
  → Lives in: `queueBrokerAlert` gating. Source: `docs/plans/CROSS_AGENT_HANDOFF.md`.
- **An opt-in notify list with no fallback starves silently.** "cma-ready" fired 0 times
  against 335 real drafts because the opt-in list was never populated. Fall back to the
  assigned broker.
- **Attribution must survive the SMS link wrapper.** Sequence-engine and prospecting texts
  wrapped links without `attributeSiteLinks`, so short-links carried no `?_pid=`/`?agent=`
  and clicks never stitched. Source: commit `34ce756`, 2026-09-01.
- **Stitched identity must reach sessions created later.** `stitchVisitorIdentity` only
  stamped sessions existing at stitch time, so a returning stitched browser's new session
  was born unidentified, killing the "looking at" wake for every returner.
  Source: commit `b8d1406`.
- **Read the event kinds a writer actually produces.** "Looking at X now" read
  `crm_timeline` for kinds no writer ever wrote (zero rows all-time). Source: commit `202c4ac`.
- **One send interface per channel.** Five drifted copies of the SMS/email composer were
  consolidated. Matt 2026-07-15. → Lives in: `check-composer-discipline.mjs` (G50).
- **No toggles in resume, replay, or retry paths.** The post-sign-in resume called
  `toggleSavedListing` against stale state and un-saved listings (RC7).
  → Lives in: G51.
- **Any broker could message, reassign, or restage another broker's client.** Fix is a
  shared `requirePersonInScope` on every mutation, preserving Matt's whole-shop view
  deliberately. Source: `docs/audit/CRM_RBAC_AUDIT.md`.
- **Sequential ids are an IDOR.** `crm/deals/[id]` let a restricted broker read any deal's
  commission; `people/[id]/portal` leaked any contact's saved homes (2026-08-07).
  → Lives in: `check-entity-scope.mjs` (G66).
- **Meta CAPI returned 200 on failure with only a `console.warn`.** A revoked token
  silently dropped 100% of conversions. `CRM_MIRROR_ENABLED=false` silently stops all
  `crm_people` writes. An API key read under two differently-cased env names disabled half
  the system depending on which one was set. Named standing risks.
  Source: `docs/audit/CRM_CONTACT360_BUILDOUT.md`.
- **Service-role clients are shared, never per-file.** 3+ files did
  `createClient(url, SERVICE_ROLE_KEY)` inline. → Lives in: `check-crm-secrets.mjs`.
- **Broker headshots are never center-cropped.** ~20 surfaces beheaded portraits via
  `rounded-full object-cover` (2026-07-15). → Lives in: `check-avatar-crop.mjs` (G49).

- **The retired vendor CRM is gone everywhere: code, emails, docs, analytics.** Purged
  repeatedly and still resurfacing: "WE DONT USE FUB ANYMORE" (2026-07-04); "there should
  be absolutely no mention of it anywhere" (2026-08-07); found again in analytics (2026-08-19).
  → Lives in: `check-claude-canon.mjs` (fails any tracked file naming it). Source: Claude
  Code sessions, 2026-07-04, 2026-08-07; Grok Build session, 2026-08-19.
- **A CMA is signed by the lead's assigned broker; Matt is the fallback.** The plan
  defaulted to Matt four times: "I've told you four times that the CMA gets signed by the
  assigned broker."
  → Lives in: prose only. Source: Claude Code session, 2026-08-07.
- **A new outbound pipeline gets a smoke test, not real recipients.** Matt attaches real
  people himself; the agent proves delivery first — the saved-search alert pipeline was
  reported complete and "I DIDNT GET ANY EMAIL."
  → Lives in: prose only. Source: Cursor session, 2026-07-06.
- **A backfill never re-triggers sends, and a process writing garbage is killed with its
  residue.** The expired-pipeline backfill was explicitly barred from re-emailing; an
  automated note-writer had put 239 nonsensical entries on one contact — remove the notes
  AND the process that created them.
  → Lives in: prose only. Source: Cursor session, 2026-06-11; Claude Code session, 2026-07-05.
- **Bulk email goes out as the broker: a reply-able real address, their saved signature,
  and the full defined audience.** A production batch meant for ~2,700 neighborhood
  contacts reached 314; sends were leaving from no-reply@ without Matt's signature. Verify
  the audience count against the list before sending (see the PostgREST row cap, §4.2).
  → Lives in: prose only. Source: Grok Build sessions, 2026-08-29, 2026-08-30.
- **First touch on expired/FSBO/CMA outreach is manual and draft-first — and that posture
  is a toggle, not an architecture.** "i will always manually send the first expired
  message"; the next day: it's not ALWAYS manual, "but for now it is. i will toggle it."
  → Lives in: CLAUDE.md §1; the toggle framing is prose only. Source: Claude Code sessions,
  2026-07-29, 2026-07-30.

## 4.4 Deploy, build, git, and cost

- **The deploy builds the commit, not the working tree.** `trackEvent('nav_interact')`
  shipped while its `EventName` union extension stayed unstaged: every Vercel build failed
  for 75 minutes, 12 commits queued behind. A second escape the same night: a DAL export in
  the working tree, callers already committed. → Lives in: `check-commit-compiles.mjs`
  (G46, staged-tree tsc). Source: escape ledger row 1, 2026-06-10.
- **A `'use server'` module cannot re-export a type-only import.** It took
  `/admin/crm/subscriptions` to a 500 behind a green `tsc` (2026-08-08). → Lives in: G63.
- **Server-only modules leak into client chunks.** The asset manifest (1.4MB) shipped
  inside the `/pulse` client chunk, +42% bundle. → Lives in: G43, caught by G10.
- **A redirect in a page body under Next 16 prerender or a Suspense boundary is not a
  redirect.** 91 of 104 `/communities/<city>-<name>` pages served 200 with `Location: null`
  and no `<h1>`. `/motivated-sellers` silently 200'd an empty shell. Redirects come from
  `next.config.ts` as a real 308. Hit again 2026-09-01 on `/admin/people`.
  → Lives in: G69, REQUIREMENTS.md R-220.
- **`vercel redeploy <url>` rebuilds the OLD commit.** It picks up new env vars, not new
  source. Push a commit for both. Already-running functions do not see env changes either.
  Source: `.auto-memory/memory_marketing_brain_decisions.md`.
- **`vercel env add` silently fails in non-interactive mode** (`git_branch_required`); use
  the REST API (`POST /v10/projects/{id}/env`, `PATCH .../env/{envId}` to overwrite).
- **`--env-file` does not override an exported shell var, even an empty one.** A stray
  `ANTHROPIC_API_KEY=''` shadowed the real key and produced a false "key missing".
- **Worktree scripts resolve `node_modules` via `scripts/lib/resolve-node-modules.mjs`.**
  A direct `<repo>/node_modules` reference broke 5 pipeline paths (2026-08-21).
- **Every PR failed one CI step for ~3 months and nobody noticed.** `middleware.ts`'s bot
  screen 403'd `wait-on`'s axios UA; `main` looked green only because the step was gated on
  `pull_request`. → Lives in: `check-ci-probe-ua.mjs` (G60). Root-caused 2026-08-02.
- **A gate that runs nowhere is worse than no gate.** 28 `check-*.mjs` scripts ran nowhere
  while docs called them "enforced" (2026-06-20 audit). One "orphan" was actually CI
  calling an npm script that did not exist. → Lives in: `check-gates-wired.mjs` (meta).
- **A gate whose assertion list has gone empty passes trivially and looks like coverage.**
  `ci:console-kit` was retired for exactly this (2026-08-07).
- **SSG page generation has a budget.** "Generating static pages (644)" ate 11.2 of 14
  build minutes with 352 timeouts. → Lives in: G70, 2026-08-21.
- **Build minutes, not traffic, drove July 2026 Pro spend.** A "chore: update changelog"
  commit pattern on `main` burned hundreds of production builds. Never recreate it.
  → Lives in: AGENTS.md Cost-aware push.
- **Same-category fleet findings ship as one class.** One push, one `deploy:verify`. Do not
  rebuild per bot finding, do not open one ticket per finding. Matt R-216, 2026-08-16.
  → Lives in: G44, `lib/data/loop/ship-class.ts`.
- **23 of 72 cron routes were unregistered and invisible** (2026-07-21).
  → Lives in: `check-cron-registered.mjs` (G53).
- **~200 components shipped dark.** SmartSearch, HeroSearchOverlay, SearchSplitView were
  exported and imported nowhere. → Lives in: `check-reachable-exports.mjs` (G55).

- **A wrapper script propagates the real exit code.** `npm run push` exited 0 while
  `git push` was rejected non-fast-forward — gates and build reported success over an
  unpushed `main`.
  → Lives in: prose only. Source: Claude Code session, 2026-07-29.
- **A broken live page is reverted to last-known-good now, not iterated on.**
  caldera-springs rendered broken in production; the homepage and later the listing-detail
  page were ordered straight back to what worked. Iterate locally; push when the work is
  done, not per increment.
  → Lives in: prose only. Source: Grok Build sessions, 2026-08-10, 2026-08-11, 2026-08-29.
- **Committed worktree work is picked up, never reset.** Four restyle worktrees each needed
  the identical correction: do not start over, finish tests, open the PR.
  → Lives in: prose only. Source: Grok Build sessions, 2026-08-21.
- **Independent workstreams don't share a wrap unless files are provably disjoint.** Mixing
  admin-CRM planning with a public-site wrap left the live site looking "like a
  Frankenstein did it."
  → Lives in: prose only. Source: Cursor sessions, 2026-08-13.

## 4.5 Marketing pipeline, analytics, and ads

- **Check `.env.local` and the tool-registry SKILL.md before driving any UI.** An agent
  opened Meta Ads Manager without `?act=<id>`, landed in an empty default account,
  concluded the seller campaign needed a full rebuild, wrote a 313-line manual runbook, and
  tried to drive Chrome through account setup, before finding the real, fully built
  campaign under the configured `META_AD_ACCOUNT_ID` (2026-05-18). Env first, then
  SKILL.md, then a browser. The Marketing API beats Chrome MCP for Meta; Meta CAPTCHA-walls
  DevTools-driven browsing. Source: `docs/plans/CROSS_AGENT_HANDOFF.md`.
- **A pipeline stage with no downstream consumer is dead on arrival.** 33 brain action
  rows in a month; 26 stuck, 2 executed, 0 measured, because none of 72 producers wrote
  back status and nothing dispatched `pending`. Running a producer directly, bypassing the
  action row, is rogue: it happened 30+ times in one session.
  → Lives in: `require_action_row` (G22). Source: `.auto-memory/memory_brain_pipeline_audit_2026-05-21.md`.
- **Consent gating must be a Consent Mode check, never load suppression.** `GTMHead` was
  changed to refuse `gtm.js` until banner consent; GA4's config tag lives inside that
  container, so every non-consenting visitor vanished for two weeks. Matt caught the drop.
  Load GTM immediately, denied-by-default, update on the banner event.
  Source: commit `340fb06`, 2026-09-01.
- **A GA4 measurement ID can have a forgotten second destination.** A decommissioned
  Google tag mirrored every hit to a void property; the brain saw ~2% of real traffic. An
  earlier audit had blamed WordPress. GA4 will not delete a destination; reassign it to a
  never-installed ORPHAN tag.
- **A dead pixel's fan-out was a live Zapier zap nobody remembered.** Found via Graph API
  forensics, killed by Matt, verified by 74 hours of zero fires.
- **An audit that greps for the wrong pattern reports a false gap.** "The pixel is not
  installed on WordPress" grepped `retired.invalid/pixel/`; the real pattern was
  `widgetbe.com/agent`. It had been live for weeks.
- **Chrome MCP leaves the tab `document.hidden=true`,** so production React defers
  `useEffect` and a tracking component looks broken under MCP while working for every real
  visitor. Verify via bundle-string presence.
- **"We are a small brokerage in Bend" is not copy.** Matt: "the copy sounds dumb, no one
  cares that we are a small brokerage." Pivot to public-MLS-data frameworks; "What is your
  home worth?" is the gold-standard seller framework. Generic Canva-card creative was
  deleted outright. The 1-mile geo radius, not the headline, is the unlock for the
  neighbor-sale ad. Source: `.auto-memory/memory_seller_ad_session_2026-05-28.md`.
- **Do fresh research per topic.** A luxury-brand competitor recon was reused as seller-ad
  research. Stale, tangential research is a named anti-pattern.
- **A per-run cron sweep can still be a §0 failure.** See prime directive 1.

- **Every page inherits the same analytics treatment automatically.** Tagging had drifted
  per page; the rework had to guarantee a newly added page cannot ship untracked.
  → Lives in: prose only. Source: Grok Build session, 2026-08-19.

## 4.6 Compliance: SMS, MLS, transaction files

- **Never reword the carrier-verified SMS consent sentence.** Twilio re-vets A2P 10DLC
  against the live site. The campaign was rejected twice (error 30909): first because the
  form's consent language was written from intent and never rendered; second because the
  bot screen 403'd the reviewer's HTTP-library UA on every cited URL and `/privacy` had no
  SMS terms. → Lives in: preflight fetches every cited URL with a `python-requests` UA and
  asserts the exact sentence; `COMPLIANCE_VERIFICATION_PATHS` middleware exemption.
  Source: escape ledger rows 4 and 5, `docs/HANDOFF-a2p-sms-consent.md`.
- **Oregon Data Share display rules are a gate.** Matt directive 2026-07-21. → Lives in: G54.
- **A resort home is never a non-resort home and vice versa.** Matt 2026-08-05. A comp
  guard built from an 80%-inside polygon test had flagged ~2,900 closed sales wrongly; 23
  entries removed across 6 communities. → Lives in: `check-resort-definitions.mjs`,
  `data/resort-communities.json`.
- **Read a document's actual property and sale number before archiving on a
  "wrong-property" verdict.** A classifier nearly archived a correctly filed woodstove
  addendum. Wrong-folder contamination in SkySlope is a recurring pattern, not a one-off.
  Source: `docs/HANDOFF_SKYSLOPE_AUDIT_2026-05-29.md`.
- **Vault is the sole source of truth for transaction coordination.** SkySlope is a workflow
  tool. Reconciling against it produced wrong audit numbers. → Lives in: CLAUDE.md §8.
- **SkySlope `officeGrossCommissionOnSale` is server-derived and order-sensitive.** The
  working recipe: null the listing-commission fields, PUT `/commissions`, PUT
  `/commissionSplit`, then a no-op sale PUT. `saleTypeId` cannot be changed on a closed
  deal via API or legacy UI; Matt ruled to abandon the flip rather than reopen closed files.
- **Full company scope on every audit.** All brokers, all mailboxes, max date range.
  Narrow-scope audits produce false clean reports. → Lives in: CLAUDE.md §8.
- **A delivered PDF lost 9px of a comp's stat line at a page boundary; a BPO printed body
  text 1.5pt from the paper edge.** Measured live 2026-08-03. → Lives in: G64, `docs/PAGE_CONTRACT.md`.

- **Coming Soon listings never render publicly.** Matt found them live: "That is an
  absolute violation." Backend/broker-only, always.
  → Lives in: prose only. Source: Claude Code session, 2026-07-21.
- **DNC scrub runs before any outbound SMS touch, and outreach claims match reality.**
  "do the dnc scrub first, then finish the rest autonomously"; the buyer-outreach copy was
  corrected from implying we would sell the home to the true claim: "we have a buyer."
  → Lives in: prose only. Source: Claude Code sessions, 2026-08-25.
- **Compliance features are built to the letter of the law, without flourish.** "we dont
  need to overstate things just need to be compliant" (Oregon principal-broker sign-off).
  → Lives in: prose only. Source: Claude Code session, 2026-06-13.
- **A transaction document is complete only when every required party has signed.**
  Standing check for the in-house TC system: "a fully executed contract has signatures from
  the appropriate parties."
  → Lives in: prose only. Source: Grok Build session, 2026-08-23.
- **CMAs always use sold comps; VOW registration rules do not apply to them.**
  → Lives in: prose only. Source: Claude Code session, 2026-07-30.

## 4.7 Frontend, design system, SEO

- **An unlayered CSS reset silently zeroes every Tailwind utility inside it.** Unlayered
  CSS beats `@layer utilities` regardless of specificity. `.kb-root *{margin:0}` broke
  spacing on the listing page, homepage, city pages, and search at once. Matt flagged "the
  text below the price is off". Resets go in `@layer base`.
  Source: `.auto-memory/memory_listing_detail_ui_fixes_2026-06-24.md`.
- **Build from the mockup, and let a gate prove it.** The listing-detail rebuild shipped
  without reading the mockup; the prose rule was ignored. → Lives in: `check-mockup-parity.mjs`
  (G6, 2026-05-28).
- **One design system on the public site.** `components/site/v3`, look in `tokens.css`.
  The KB register, legacy chrome and per-surface mockups were deleted 2026-08-27.
  → Lives in: `ci:one-design-system`, `ci:chrome-single-source`.
- **Two colors. Retired gold and v1 cream never return.** Held out by `check-claude-canon.mjs`.
  The exception accent marks a data exception only; if nothing is wrong, use navy. Matt 2026-08-17.
- **Brand facts live in one file.** Phone and license were copied into ~30 files; a change
  left stale copies. → Lives in: G38, `lib/brand/contact.ts`.
- **Email and PDF generators drift to retired tokens separately from JSX.** → Lives in: G37.
- **Canonical URLs come from the resolved slug, not the requested one.** 10 broker alias
  pages each declared themselves canonical, splitting authority on the most important
  pages. A blanket root-layout canonical also risked deindexing `/videos`.
  → Lives in: G40. Source: `docs/audits/WEBSITE_AUDIT_2026-08-02.md` P0-2.
- **Five view-SEO pages were live, indexable, and permanently empty** because the preset
  vocabulary did not match live data (`/search/mountain-view`). → Lives in: G63 (view-preset).
- **A public ledger shipped rows reading "status_canceled · Bend · Stonegate".** 4 of 10
  event types had no label; 2,212 rows. → Lives in: G68 (activity labels), 2026-08-18.
- **Admin was unusable on phones** (fixed `w-56` sidebar, 165px content, 28 to 49s dashboard
  render from uncached live API calls) because admin was excluded from every public-surface
  discipline. → Lives in: `check-admin-mobile-shell.mjs`. Source: escape ledger row 2.
- **Three `<footer>` elements per page, one `display:none` site-wide.** → Lives in: G58.
- **Lighthouse aggregate scores miss WCAG failures.** → Lives in: pa11y-ci (G23).
- **Page-grade is dead and deleted, not stubbed.** Matt first said kill it with a refuse
  stub, then reversed: "I don't want some agent to find it and use it. A file that exists is
  a file an agent reads." → Lives in: G44 asserts the four skill paths do not exist.
- **The homepage first paint is V3Chrome only.** No ArrivalIntent strip on `/`, not restyled
  into another bar, not a modal. Matt R-218, 2026-08-16.
- **Brand voice: state the fact, then stop.** Never a sentence whose job is to explain the
  sentence before it. Matt 2026-08-05: "anytime any content/copy is created it is run
  through this voice. Period." → Lives in: `check-brand-voice.mjs`, `lib/voice/check.ts`
  hard-fails every send path.

- **A reskin restyles components in place — it never deletes them, and a failed redesign is
  reverted, not defended.** "i didnt want to remove components only reskin them"; the
  2026-08-21 restyle was rejected whole ("Okay, you suck. Just revert the pages back")
  after two days of Matt's review time.
  → Lives in: prose only. Source: Claude Code sessions, 2026-08-21, 2026-08-27.
- **A restyle is done when the WHOLE scrolled page changes — and the PR carries phone
  (~390) and desktop (~1440) screenshots of the running page before merge.** The named
  shortcut: "Search on the hero, same city report underneath. A new control on an unchanged
  page. That is a fail."
  → Lives in: prose only. Source: Grok Build sessions, 2026-08-28.
- **Parity with a reference means the entire page.** "It's not just a card. It's the entire
  page... do you understand parity?" Match the benchmark fully, then add — never ship less.
  → Lives in: prose only. Source: Grok Build sessions, 2026-08-29, 2026-08-30.
- **Warehouse and methodology internals never reach the page face.** "Market Truth
  leftover," `city_quarter_sale_to_ask`, and methodology stamps were live in Redmond page
  copy: "Strip warehouse/SQL/methodology from the face. Honesty stays behind a tap." Chart
  labels read in lay language.
  → Lives in: prose only. Source: Grok Build sessions, 2026-08-28, 2026-08-31.
- **Charts are reviewed rendered, as a full page, with a clean face.** "go back out and
  look at the chart after you create it... right now these are unreadable"; methodology
  strings live behind a detail affordance, not on the chart face.
  → Lives in: prose only. Source: Claude Code sessions, 2026-08-19.
- **Product controls: compact standard controls, clickable entities, aligned.** Filter pill
  walls became dropdowns ("review all the other interfaces that do something stupid like
  this"); an owner's name on a card clicks through to their page; alignment is fixed
  outright, never flagged as a design call.
  → Lives in: prose only. Source: Claude Code sessions, 2026-08-05, 2026-08-26.
- **Never send a visitor off-site for data we already own.** 3D and floor-plan views render
  natively: "We have that data."
  → Lives in: prose only. Source: Grok Build session, 2026-08-29.
- **Phone layouts favor horizontal rails over long vertical stacks.**
  → Lives in: prose only. Source: Grok Build session, 2026-08-29.
- **A place page's missing hero walks up the geography hierarchy, and maps default to the
  most specific geography.** Subdivision → neighborhood → city for the photo fallback; a
  listing map opens on the neighborhood or subdivision boundary, not the city.
  → Lives in: prose only. Source: Grok Build sessions, 2026-08-30, 2026-08-31.
- **Every public page has one objective, and the contact path is unmissable.** "all of the
  pages must work together... its a gigantic lead gen machine without acting like it"
  (2026-08-11); the later escalation: contacting the brokerage was "almost impossible to
  figure out" despite lead generation being the stated number-one goal.
  → Lives in: `docs/plans/PUBLIC_PRODUCT/PRODUCT.md`; prose only. Source: Claude Code
  sessions, 2026-08-11, 2026-09-02.
- **"Traded" is never used for a home sale, and a voice rewrite must match the agreed
  reference before shipping wide.** The three-day site-wide rewrite came back "so much
  worse — this is not the Berkshire voice I agreed to," on top of covering only a subset
  ("every page needs the rewrite not just the ones you mentioned").
  → Lives in: `marketing_brain_skills/brand-voice/VOICE.md`,
  `scripts/brand-voice-vocabulary.cjs`. Source: Claude Code sessions, 2026-08-06, 2026-08-09.

## 4.8 Auth and integrations

- **A generic error hid a completely broken Google sign-in.** OAuth handshake succeeded;
  `exchangeCodeForSession` failed because the PKCE `code_verifier` cookie never survived a
  server-action-initiated flow, and the SSR cookie adapter swallowed the write error in a
  silent try/catch. Also: Supabase Site URL was `vercel.app`, not `ryan-realty.com`.
  Initiate OAuth client-side. Source: `docs/HANDOFF_GOOGLE_SIGNIN_PKCE_BUG_2026-06-02.md`.
- **Token liveness is not `expires_at`.** See prime directive 3.
- **LinkedIn is deliberately parked** (no provider refresh token). Not dead, parked.
- **Never call `api.x.ai` outside `lib/grok/`.** Model ids in `lib/grok/client.ts`, gated by
  `ci:grok-models`. Vision-inspect a hero still before paying for motion. → Lives in: CLAUDE.md §4.

- **Google Maps is the only mapping stack.** Mapbox banned pending explicit Matt approval
  (2026-06-13); MapLibre GL ripped out mid-project: "GOOGLE MAPS IS THE ONLY MAPPING WE
  WILL USE."
  → Lives in: prose only. Source: Claude Code sessions, 2026-06-13, 2026-07-04.
- **When Matt says a credential works, verify it live before reporting blocked.** Repeated
  automated checks kept calling the Resend webhooks key send-only; it had full access —
  "it literally has full access drive my browser MCP."
  → Lives in: prose only. Source: Cursor session, 2026-07-24.

## 4.9 Process and meta-lessons

- **Sessions are disposable; the work graph is not.** Chat-based tracking lost in-flight
  work between sessions. `npx tsx scripts/loop-brief.ts` is the source of record.
  → Lives in: `docs/DEVELOPMENT_PROCESS.md` v1.4.0.
- **Curated subsets are a shortcut.** 572 raw Matt directives were harvested; 25 were
  missing from tracked state. CAP-033 was silently dropped from the v1 manifest. Both
  registers are now unshrinkable. Matt: "no shortcut assumptions". → Lives in: G56, G57.
- **G-numbers were handed out from script headers instead of the authoritative table,
  twice, in parallel sessions.** Collisions at G16, G37 to G39, G47 to G49, G53, G56 to G63.
  `docs/MECHANICAL_GATES.md` is authoritative; renumber and leave a note.
- **Walkers do a full-site review every run.** An earlier instruction was "too limited";
  packs are the floor, not the ceiling. Matt R-217.
- **Design amnesia is deliberate in the Admin Product OS.** Matt: "Frankenstein mishmash"
  (2026-08-06). → Lives in: G65 admin migration ratchet.
- **Two canons reuse decision numbers independently.** Brand-voice D11 (locked 2026-08-12)
  and MARKET_TRUTH D11 are different decisions. Always name the canon with the number.
- **The `.auto-memory/` directory is a session scratch, not the canon.** Its lessons were
  invisible to every agent that did not open it. That is why this file exists.

- **"Done" needs an un-fakeable mechanism.** Waves A–D of the platform program
  self-reported done without the gates their decisions named. "I don't want more prose. If
  there needs to be something that's like a gate and mechanical, then we need to have that
  in there."
  → Lives in: `check-program-complete.mjs`. Source: Claude Code session, 2026-07-22.
- **Never weaken a gate's threshold to make it pass.** The CMA page-safety fix order
  carried it explicitly: "Do NOT weaken the page-safety thresholds to make it pass."
  → Lives in: prose only. Source: Claude Code session, 2026-08-26.
- **Missions run to completion — no status stops, no asking to start.** Standing
  corrections span months: "YOU ARE IN AUTO MODE AND ARE TO RUN UNTIL COMPLETION WITHOUT
  FEEDBACK" (2026-07-24); "why do you stop for bullshit updates" (2026-08-09); "don't stop
  the work ever" (2026-09-01); "you've made the plan... just run until it's done" (Grok
  Build, 2026-08-08). The boundary: decide the obvious yourself; when genuinely unclear,
  ask real questions — "Your findings are confusing to me. Ask me questions."
  → Lives in: CLAUDE.md §1; the cadence is prose only. Source: Claude Code sessions,
  2026-07-24 through 2026-09-01; Grok Build session, 2026-08-08.
- **The default depth is exhaustive.** "I don't want just the high items. I want all of the
  items. That's what comprehensive means"; no self-imposed limiters ("What five flows are
  you talking about? Discover the flows through the code"); nested structures audited fully
  — PropertySubType was one example of sub-structure everywhere ("Why is the default the
  bare minimum?").
  → Lives in: prose only. Source: Claude Code sessions, 2026-07-30, 2026-08-17; Grok Build
  sessions, 2026-08-08, 2026-08-18.
- **Deliver the work, not a document about the work.** "Find and fix" means fixed ("now
  just give me a list of stuff that you found, but actually fix it. All of it"); plans are
  execution-grade, never directional prose ("i always need execution grade plans, write it
  in your memory"); a doomed approach is flagged the moment it is suspected ("if you know
  something likely won't work, why do you wait to address it").
  → Lives in: prose only. Source: Claude Code session, 2026-07-29; Cursor session,
  2026-08-03; Grok Build session, 2026-08-18.
- **No process documents while a plan is in flight.** "Do not write a skill, rubric, gate
  list, README, or new standard while this plan is in flight... The product is the live
  page."
  → Lives in: prose only. Source: Grok Build session, 2026-08-28.
- **Inventory what exists before building.** Golf-course pages were being recreated over
  existing resort pages ("ARE YOU RECREATING OR ADDING"); smart lists nearly reinvented
  ("CAN YOU SEE HOW WE DO SMART LISTS NOW"); an admin polish pass rebuilt what should have
  been left alone ("You rebuilt stuff that shouldn't have been rebuilt. You didn't really
  pay attention to the existing code").
  → Lives in: prose only. Source: Claude Code sessions, 2026-07-03, 2026-07-05, 2026-09-02.
- **A request from Matt survives sessions.** RPR data was asked for across multiple CMA
  sessions and still missing ("we're still stuck in the past"); open-house badges were
  requested and silently dropped ("i thought i asked for badges to be displayed on the
  listing tiles????").
  → Lives in: the work graph is the mechanism; prose only otherwise. Source: Cursor
  session, 2026-08-17; Grok Build session, 2026-08-31.
- **A closed decision stays closed.** "We aren't going to publish the Deschutes River
  Woods. Stop bringing that up."
  → Lives in: prose only. Source: Claude Code session, 2026-08-26.
- **A fix survives the next prompt.** Old behavior was pinned back in during the reskin
  ("you cant build a website without regressing every prompt"); garbled CRM names returned
  after being fixed ("HOW CAN WE HAVE GARBLED NAMES WE LITERALLY JUST FIXED THIS"). A
  recurrence is a missing gate (law 3).
  → Lives in: law 3 of this file. Source: Claude Code sessions, 2026-07-06, 2026-08-27.
- **An unexplained business rule is deleted, not patched around.** The "6 months and
  closed" filter had no traceable justification: "fucking nuke it from existence."
  → Lives in: prose only. Source: Claude Code session, 2026-08-27.
- **Never backfill a ledger to look complete.** Offered as the fix for graph-blind
  independent changes and rejected as theater — make the tracking self-aware instead.
  → Lives in: prose only. Source: Claude Code session, 2026-08-26.
- **A scope lock binds until Matt lifts it.** A "PLANNING AUDIT ONLY — no code, commits,
  migrations, deploys" brief derailed into building; the violation itself became a forensic
  investigation.
  → Lives in: prose only. Source: Cursor session, 2026-08-13.
- **Anything handed to Matt was exercised first, shown rendered, with a link.** His full
  review submitted into a dead endpoint ("Wait what so I just did that review for
  nothing????? Test the shit before u send it to Me"); drafts are rendered visuals, never
  raw HTML ("I NEED TO BE ACTUALLY ABLE TO SEE WHAT A NEWSLETTER... LOOK LIKE") or
  text-only mockups; every surface named comes with its clickable URL ("always provide a
  link").
  → Lives in: prose only. Source: Claude Code sessions, 2026-06-13, 2026-08-22; Cursor
  session, 2026-07-06.
- **Competitor products and names never enter the repo.** Beacon: "Don't ever put Beacon in
  our source code. Just go and look at the charts, harvest them." Redfin as a UX benchmark:
  "i do not want you to have the name redfin in our code at all."
  → Lives in: prose only. Source: Claude Code session, 2026-08-17; Grok Build session,
  2026-08-30.
- **When a page changes purpose, its contract changes in the same commit.** The homepage
  redo: if `parity.json` still requires the old market section, update the contract with
  the page — never keep a broken section to satisfy CI.
  → Lives in: prose only. Source: homepage-redo brief, 2026-08-28.
- **Forbidding the tool is not the fix for its failure mode.** The worktree ban and the
  subagent-parallelism limits were both reversed once stranded-work handling existed:
  "worktrees ARE allowed — design around that failure mode"; "remove that old directive on
  sub agents... I don't want any other rules or directives to keep this process from being
  optimized."
  → Lives in: AGENTS.md Worktrees. Source: Cursor session, 2026-07-26; Claude Code session,
  2026-07-30.
- **A status question gets the direct answer first.** "Just shut the fuck up and tell me if
  you fixed the site." / "Don't fix just answer."
  → Lives in: prose only. Source: Claude Code session, 2026-08-28.

## 4.10 Media, video, and creative

- **Never AI-convert what is real.** A video ad was built by animating a still lifted from
  a video ("YOU ARE LITERALLY TRYING TO CREATE A VIDEO FROM A STILL THAT WAS TAKEN FROM A
  VIDEO"); converting real-life items through AI "is literally the definition of slop."
  → Lives in: `docs/GROK_CRAFT_CANON.md` partially; the real-footage rule is prose only.
  Source: Claude Code sessions, 2026-07-10.
- **The creative bar is art-house originality, and it compounds.** Research true art
  houses, not approximations; keep what is learned in a durable creative brain ("ONLY BUILD
  ON CREATIVITY"); show complexity. A worse iteration is a reset, not a base ("This is
  worse than the last one — forget it"), and the deliverable is the rendered asset, never
  prose standing in for it ("Did you just build a bunch of prose?").
  → Lives in: prose only. Source: Claude Code sessions, 2026-07-10.
- **Generated place imagery is the named asset, unique per place, never the wrong city.**
  A mockup round used images that were not the Grok Imagine batch Matt meant; a batch of
  place heroes rendered "almost all identical"; Bend's Old Mill frame must never appear on
  a Redmond page.
  → Lives in: prose only. Source: Claude Code sessions, 2026-08-27; Cursor session,
  2026-08-28.
- **A content page's photo matches its actual subject.** A Tetherow sign sat on a Drake
  Park event page; the fix order: exhaust real sources with credit — including our own
  library ("WE LIKELY ALREADY HAVE ONE IN OUR PHOTO GALLERY") — or fall back to a fitting
  lifestyle photo, never a mismatch.
  → Lives in: prose only. Source: Claude Code sessions, 2026-07-03.
---

# 5. Escape ledger digest

`public.process_escape_ledger`, live Supabase, 7 rows as of 2026-09-02. Each is a defect that
reached Matt or production. The full protocol is in `docs/DEVELOPMENT_PROCESS.md`.

| # | Date | Escape | Why review missed it | Check added |
|---|---|---|---|---|
| 1 | 2026-06-10 | Build-breaking commit; 75 min of failed deploys, 12 commits queued | Local tsc validated the working tree; deploy builds the commit | G46 staged-tree compile |
| 2 | 2026-06-10 | Admin unusable on phones; 28 to 49s dashboard | Admin excluded from public-surface disciplines, never browser-checked at phone width | `check-admin-mobile-shell.mjs` |
| 3 | 2026-06-10 | 5 features dead in prod for 2.5 months from unapplied migrations | Schema snapshot is generated from prod; fallbacks swallowed `42P01` | `check-migration-drift.mjs` |
| 4 | 2026-06-11 | A2P campaign rejected (30909) | Consent language written from intent, never rendered | Preflight fetches every cited URL |
| 5 | 2026-06-12 | A2P rejected again | Bot screen 403'd the reviewer UA; `/privacy` had no SMS terms | Reviewer-UA fetch + privacy clause assert |
| 6 | 2026-08-15 | GBP, YouTube, X falsely reported dead to Matt | Liveness judged from `expires_at` alone (one query shape) | `TokenHealth.refreshTokenPresent` |
| 7 | 2026-08-15 | 17 defects in self-graded work-graph machinery | Builder verified its own build | R-040 adversarial pass, DB triggers, fail-closed ledger |

---

# 6. Tools and where things live

The full inventory is the repo; this is the door list. Grok bots use `docs/GROK_BOT_BRAIN.md`.

| Need | Door |
|---|---|
| The rules | `CLAUDE.md` (every session), this file (before executing) |
| The gates | `docs/MECHANICAL_GATES.md`; `npm run ci:gates` before any commit on a user-facing surface |
| The process | `docs/DEVELOPMENT_PROCESS.md` (THE LOOP); `npx tsx scripts/loop-brief.ts` |
| The requirements | `docs/plans/ENTERPRISE_MAP/REQUIREMENTS.md` (R-rules, each with its why) |
| Market truth | `docs/plans/MARKET_TRUTH/DECISIONS.md`, `PLACE_CONTENT_RULES.md` |
| The database | `docs/DATABASE_FOR_AI_AGENTS.md`, `DATABASE_SCHEMA_SNAPSHOT.md`, `DAL_INDEX.md`, `DATA_COVERAGE_INDEX.md`. Never `information_schema` |
| Brand voice | `marketing_brain_skills/brand-voice/VOICE.md` |
| Design | `design_system/ryan-realty/` (print, social, email, admin); `components/site/v3/tokens.css` (public site) |
| Media | `lib/grok/`, `lib/studio/`, `docs/GROK_CRAFT_CANON.md` |
| CRM | `lib/crm/`, `/admin/crm`, `public.crm_people` |
| Cross-agent handoff | `docs/plans/CROSS_AGENT_HANDOFF.md` Current block; `docs/plans/ENTERPRISE_MAP/SESSION_HANDOFF.md` |

---

# 7. Metrics this file is judged by

1. **Escapes trending to zero.** `process_escape_ledger` row rate per month. Tracked by
   THE LOOP as a metric of the process itself.
2. **Time from correction to gate.** When Matt corrects an agent, how many commits pass
   before the class has a mechanical check. The target is the same commit.
3. **Autonomous completion.** Share of ship classes that go brief → push → `deploy:verify`
   without a Matt intervention that is not one of the four approval classes.
4. **Repeat rate.** A lesson in this file that recurs is a gate that is missing. Section 3
   row 3 (Spark × Supabase) is the current known prose-only stop.

---

# 8. Open: known prose-only rules (next gates to build)

- Spark × Supabase > 1% reconciliation stop before a market-report render (§0). No script.
- §0 per-figure verification trace ("no trace, no ship") outside the publish route.
- §4 video hard rules: length, hook, beats, safe zones.
- The four approval classes themselves, beyond the commit-msg marker and the publish route.
