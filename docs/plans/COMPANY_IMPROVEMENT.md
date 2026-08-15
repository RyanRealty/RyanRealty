# Company improvement — THE LOOP addendum

**Version:** THE LOOP v1.5.1  
**Canon:** [docs/DEVELOPMENT_PROCESS.md](../DEVELOPMENT_PROCESS.md)  
**Weekly packet:** [COMPANY_SCOREBOARD.md](COMPANY_SCOREBOARD.md)  
**Universe:** [ENTERPRISE_MAP](ENTERPRISE_MAP/SESSION_HANDOFF.md) CAP / INT / FAC  
**Identity path:** [docs/MARKETING_LEAD_FLOW.md](../MARKETING_LEAD_FLOW.md) §9  

This is not a new OS. It is how THE LOOP’s ingest reads the whole company, and how a change is required to land across the system.

## Cycle (unchanged)

ingest → diagnose → prioritize → fix-the-class → verify → ship → measure → learn → lock → compete

`score = reach × gap-to-benchmark × confidence ÷ effort`

Confidence is the learned win-rate for that `change_class` (win+loss only) from `site_improvement_ledger.domain`. A new class starts at 0.5.

## Holistic blast-radius (required before a change starts)

A change that cannot name the planes it touches is not ready. Closed set: `COMPANY_BLAST_RADIUS` in `lib/data/loop/domains.ts`.

| Plane | What must stay true |
|---|---|
| **dal-stat** | One named DAL function. Public numbers from CAP-006 / `analytics_mart_*` / pricing facts only. §0 trace. Never raw `listings` for a report. |
| **public-site** | Every visitor surface that shows the number or filter reads that DAL. Search filters come from `lib/search/field-registry.ts`, not a one-off URL. |
| **admin-crm** | Brokers see the same figure, same definition. CRM ease is scored; a hidden admin island is a defect. |
| **reporting** | Admin analytics / GCI / office share / GSC / GBP consume the same store. A new stat that reporting cannot read is incomplete. |
| **alerts-newsletters** | Saved-search and listing-alert sends use `listing_alerts` (not legacy `saved_searches`). Newsletter copy that cites a number uses the same DAL. |
| **ads-audiences** | The same `crm_people` row and identity keys feed CAPI / Meta audiences. Do not build a second lead list for ads. |
| **identity** | Visitor → match → `crm_people` is one spine (`visitor_identity_map`, Google sign-in, email click). Losing a known person is a P0. |

If we expose a new statistic: add the DAL, add the `DATABASE_FOR_AI_AGENTS.md` lookup row, then wire every plane that will show it in the **same** change. Site, reporting, CMA, newsletter, and ads do not each invent a query.

## Named surfaces → existing domains

Do not add a thirteenth domain. These are the surfaces Matt named, mapped onto the closed set.

| Surface | Domain | Already owned by | Diagnose rule |
|---|---|---|---|
| Home search / map | public-ux | CAP-001; `SEARCH_*_PLAN` | Search 200 + empty/wrong pins → search class. Cold LCP on `/homes-for-sale` → perf. |
| Granular filters | public-ux | `lib/search/field-registry.ts` (Spark-visible residential fields are the honest target) | A live facet with no registry row, or a registry row the URL/sheet/alert whitelist cannot use → filter class. |
| Saved searches | nurture | `listing_alerts` is canonical. `saved_searches` is legacy public-share only. | Broker or client cannot save/send a filter set → alert class. Building on `saved_searches` for sends is a defect. |
| Listing alerts to clients | nurture | `listing_alerts` + digest crons; Nurture owns outbound | Active alert with no send in the cadence window → send-path class. Send without `crm_person_id` → identity class. Matt-gated if it is a first send to a real person. |
| CMA look and feel | broker-tools | CMA pipeline; public/draft views | A CMA a seller cannot read in one pass → look class. A CMA number off the pricing/DAL path → license-voice P0. |
| Every stat accurate | license-voice | CLAUDE.md §0; `check-market-formula`; Spark×Supabase pre-render | Untraced number does not ship. Methodology stamp on the served row (today **v3**, do not claim v4). |
| One verification process | license-voice + data-sync | CAP-006 / marts / `sale_pricing_facts` / `listing_pricing_reads` | A second query shape for the same public figure is a class. Fix the writer, not the page. |
| All existing polygons | public-ux + data-sync | `boundaries` + `listing_boundary_xref_mv` + `search_areas` | Unused `geo_type` on the map, or `ST_Within` on the request path → P0. Pins come from the xref MV / `getGeoBoundaryMapData`. |
| Deploy / stack (Vercel, Supabase) | factory | FAC-*; `deploy:verify`; hosted migrations | Push without READY, or code ahead of hosted schema → factory P0. |
| Analytics, GBP, social, in-system reporting | sales-insights + social-presence | CAP-015/016/018/029/031; `analytics_mart_*`; snapshot crons | Expired token → Matt reconnect. Audience heartbeat stale → ads-audiences class (spend still Matt-gated). A report a broker cannot act on → UX defect. |
| CRM features + ease of use | nurture + broker-tools | CAP-011; `/crm-e2e` | `crm-e2e-verify` FAIL → that class this cycle. A feature that exists in a table but not in the broker’s day is incomplete. |
| Spark → Supabase sync | data-sync | INT Spark; `sync-delta` / full / history | Spark is ingest only. We compute here. Delta unhealthy → P0. Full/history work that does not buy freshness is waste. |
| User tracking / opens / clicks / match / ads | leads + identity plane | `visitor_*`, `email_events`, `MARKETING_LEAD_FLOW` §9, CAPI `event_id` | Open/click not on `email_events` → measurement class. Site arrival that does not attempt `visitor_identity_map` → identity P0. Google continue must keep the same person. Ads must use that person, not a parallel list. |

## Domain → signal → diagnose (scoreboard rows)

| Domain | Primary signals | Diagnose rule |
|---|---|---|
| **public-ux** | Route smoke, CWV, look at 390+1280, search/filter/map, bounce | Traffic high + conversion low → CTA/UX. LCP > 2.5s on a money route → perf. Filter/map miss → search class. |
| **seo-aeo** | GSC `target_query_benchmark`, CTR, position, `llms.txt` / JSON-LD | Imp high + CTR < 2% → title/meta. Pos 5–15 + volume → depth. |
| **leads** | LP convert, `crm_people` by source, speed-to-lead, identity map, CAPI match | Traffic high + enroll low → funnel. Arrival without stitch → identity. |
| **nurture** | Sequences, `listing_alerts`, `email_events` open/click, stage mix | Nurture-heavy + Lead near zero is a product defect. Alert with no person → identity. |
| **social-presence** | Token health, ready→executed→measured, GBP, `content_performance` | `measured=0` → learn path first. Expired OAuth → Matt. |
| **sales-insights** | `analytics_mart_*`, GCI, office share, GBP/GSC admin | Number a broker cannot act on → UX. Public number off-engine → P0. |
| **transactions** | `tc_deals` vs SkySlope, form-catalog | Stale mirror → ops. Stale OREF 001 → do not send. |
| **broker-tools** | Today queue, CMA cycle + look, SMS-agent, own-book, CRM ease | Broker cannot see next step → copilot. CMA look unreadable → look class. |
| **recruit-retain** | `/join` convert, day-one, own-book, broker GCI | New broker cannot see only their book → platform. |
| **data-sync** | Delta freshness, strict-verify, pulse age, methodology, polygon xref | Delta unhealthy → P0. Spark pull that we re-aggregate on Spark → stop. |
| **factory** | Deploy READY, gates, dark crons, migration lag, Vercel/Supabase | Escape → class + gate. Hosted schema behind `main` → P0. |
| **license-voice** | §0 traces, brand-voice, PAGE_CONTRACT, one-stat process | Untraced number does not ship. |

Closed domain set in code: `COMPANY_IMPROVEMENT_DOMAINS`. An unknown domain fails the insert.
**Expertise routing:** every domain carries required reads in `DOMAIN_REQUIRED_READS`
(`lib/data/loop/domains.ts`, tested for existence) — the loop-brief prints them under the
next node, so no session works an animal cold. The canon preflight contract stacks on top
per change type.

## How Matt steers (three verbs, mid-flight welcome)

The loop is autonomous; Matt is never required mid-cycle — but any word from him lands as
durable state in the same delivery that acts on it, per the canon's new-directive rule:

- **ADD** ("I also want…"): a new register row (R-next). If nothing covers it, a new
  manifest gap (G-next) + a seeded work node. It enters the scored queue like everything
  else — no ad-hoc side channel, no forgetting.
- **CHANGE** ("that's not what I meant / do it this way"): the node's contract is amended
  (objective/accept updated, evidence trail kept), or the register row is amended; a
  superseded requirement flips to SUPERSEDED in place with a pointer — never deleted (G57).
- **STOP** ("kill it / off the rails"): `killWorkNode(id, reason)` — terminal, reason
  recorded; the register row flips to PARKED or SUPERSEDED. A stop is a fact the graph
  remembers, so the idea cannot re-enter unnoticed.

Blocked ≠ stopped: a node waiting on a Matt move goes `blocked` with the reason, and the
brief serves the next eligible node. The loop routes around humans; it never idles on one.

## Accept against the goal (this is the test)

A class is a software change with a hypothesis, not a vibe. Before work starts, the ledger row must name:

1. **Domain** and **change_class**
2. **Goal type** (one primary): visual · performance · behavior · data · ops
3. **Metric** + **baseline** + **predicted_delta** + **window**
4. **Blast-radius planes** that must be caught up when this ships

Then we do the class. Then we **accept or it is not done**. Gates and `npm test` are the floor. They are not the accept.

| Goal type | Accept (must show) | Not accept |
|---|---|---|
| **visual** | 390 + 1280 screenshots of every named surface, after the change, against the stated look. Mobile and desktop. | “It builds.” A desktop-only crop. |
| **performance** | The named CWV / LCP / TTFB number on the named route, after deploy, vs the baseline on the ledger row. | Lighthouse on localhost only. |
| **behavior** | The user path works signed-out and signed-in, empty and full, on the real data. CRM / search / alerts / identity as named. | A unit test that never opened the page. |
| **data** | §0 trace per figure. Same DAL on every plane that shows the number. Methodology stamp on the served row. | A second query that “looks right.” |
| **ops** | Delta / deploy / token / cron in the state the diagnose rule required (READY, healthy, not expired). | Push succeeded, production not checked. |

A true software organization does the same thing: ticket states the accept test, CI is the ratchet, the review is “did we hit the goal,” and nothing is Done while sibling surfaces are still on the old contract.

### Holistic catch-up (the stranded-work rule)

The failure mode this section exists to kill: we go deep on one change, the rest of the product does not know, and something stays broken or half-wired.

A class is **not done** while any of these is true:

- A named blast-radius plane still reads the old definition (site has the new stat, reporting does not; filter is in the sheet, `listing_alerts` cannot use it; visitor is tracked, `crm_people` is not).
- The ledger row has no `actual_delta` after the window ended.
- The weekly packet still says UNKNOWN for a signal this class claimed to fix.
- Production is not READY for the SHA, or hosted schema lags the code.

WIP limit: **one open class per domain.** Close it (accept + Learn) or kill it (ledger verdict + reason). Do not start a second class in a domain that still has expired, unlearned windows. That is how ad-hoc piles up.

Weekly packet job 1 is not “what is new.” It is **close expired windows, list stranded classes, then pick the next score.**

### Company versions (the macro accept)

Per-class accept keeps one change honest; the **company version** keeps the whole system
honest. Manifest: [ENTERPRISE_MAP/VERSION-1.md](ENTERPRISE_MAP/VERSION-1.md) — the floor
every capability and integration must meet, the granular gap list, and the certification
pass that flips it to CERTIFIED in one commit. The stranded-domain rule above is enforced
in code: `insertImprovementLedgerRow` refuses a domain with expired unlearned windows,
and `closeImprovementLedgerRow` writes the Learn (`lib/data/loop/ledger.ts`). The packet
probe reports `expiredUnlearned` per domain so job 1 has a number, not a vibe.

## Cadence

| When | Who | What |
|---|---|---|
| Continuous | Agent on the winning domain | One class per cycle, on every named blast-radius plane. Accept against the goal before calling it done. Grind until blocked on Matt, a measurement window, or an empty score. |
| Daily | Substrate + Sense | Sync, pulse, tokens, deploy, money-path smoke, identity stitch health. |
| Weekly | Orchestrator | Overwrite [COMPANY_SCOREBOARD.md](COMPANY_SCOREBOARD.md). Close learn rows whose windows ended. Re-score. |
| Monthly | `/deep-audit` | Stuck rows, dark crons, expired tokens, drifted skills, unused polygons, alert send gaps. |
| On escape | Whoever shipped it | Fix the class, add the gate, write `process_escape_ledger`. |

Matt reads the weekly packet. He says yes only to outbound to real people, public posts, ad spend, and OAuth.

## Collision (keep)

- Public structure vs Growth content: a family under visual rebuild is frozen to Growth until it ships.
- Nurture owns outbound. Demand / Presence never send.
- Transaction owns anything legally binding. SkySlope is the live file until cutover.
- Public numbers only from CAP-006 / marts / pricing facts.
- One session per file glob. Parallel build in worktrees; serial land on `main`.
- Broker OS A–G are **job names**, not a second process.
- Ads spend stays Matt-gated. Audience *wiring* (same people, same keys) is loop work.

## Do not

- Write a new Public / Admin / Company Product OS
- Add a sixth standing agent session as the default
- Treat `docs/plans/continuous-improvement.md` as live
- Rebuild FEATURES.md as the SoR
- Grind ads while Demand is parked
- Silent social posting or SkySlope cutover
- Invent a second identity table or a second stats engine
- Send listing alerts from `saved_searches`
- Call a class done because CI passed
- Start a new class in a domain that has expired, unlearned ledger windows
- Leave a blast-radius plane on the old contract

## First code

`site_improvement_ledger.domain` + DAL in `lib/data/loop/` (import the subpath, not the `@/lib/data` barrel). Ingest: `collectCompanyScoreboardSignals`. Probe: `npx tsx scripts/company-scoreboard-probe.ts`.
