# Company improvement — THE LOOP addendum

**Version:** THE LOOP v1.2.0  
**Canon:** [docs/DEVELOPMENT_PROCESS.md](../DEVELOPMENT_PROCESS.md)  
**Weekly packet:** [COMPANY_SCOREBOARD.md](COMPANY_SCOREBOARD.md)  
**Universe:** [ENTERPRISE_MAP](ENTERPRISE_MAP/SESSION_HANDOFF.md) CAP / INT / FAC  

This is not a new OS. It is how THE LOOP’s ingest reads the whole company.

## Cycle (unchanged)

ingest → diagnose → prioritize → fix-the-class → verify → ship → measure → learn → lock → compete

`score = reach × gap-to-benchmark × confidence ÷ effort`

Confidence is the learned win-rate for that `change_class` (win+loss only) from `site_improvement_ledger.domain`. A new class starts at 0.5.

## Domain → signal → diagnose

| Domain | Primary signals | Diagnose rule |
|---|---|---|
| **public-ux** | Route smoke, CWV, look failures at 390+1280, bounce | Traffic high + conversion low → CTA/UX class. LCP > 2.5s on a money route → perf class. |
| **seo-aeo** | GSC `target_query_benchmark`, CTR, position, `llms.txt` / JSON-LD | Imp high + CTR < 2% → title/meta. Pos 5–15 + volume → depth. AI cannot cite us → schema/`llms.txt`. |
| **leads** | LP convert, `crm_people` by source, speed-to-lead, suppression | Traffic high + enroll low → funnel. Reply time up → inbox/copilot. |
| **nurture** | Sequence sends, pause-on-reply, `email_events`, stage mix | Nurture-heavy + Lead near zero is a product defect. |
| **social-presence** | Token health, ready→executed→measured, `content_performance`, GBP | `measured=0` → fix the learn path before new producers. Expired OAuth → Matt reconnect. |
| **sales-insights** | `analytics_mart_*`, office share, GCI / commissions vs $1M target | A number a broker cannot act on is a UX defect. A public number off-engine is a P0. |
| **transactions** | `tc_deals` vs SkySlope freshness, form-catalog `update_available` | Stale mirror → ops class. Stale OREF 001 → do not send. |
| **broker-tools** | Today queue, CMA cycle time, SMS-agent DoD, own-book scope | Broker cannot see next step / looking-at → copilot class. |
| **recruit-retain** | `/join` convert, time-to-first-useful-day, own-book isolation, broker GCI | New broker cannot connect IG or see only their book → platform class. |
| **data-sync** | Delta freshness, strict-verify backlog, pulse age, methodology stamp | Delta unhealthy → P0. Public stat without CAP-006 → stop. |
| **factory** | Deploy READY, gate failures, dark crons, escape ledger, migration lag | Escape → class + gate. Docs-only push burning build CPU → factory class. |
| **license-voice** | §0 traces, brand-voice gate, PAGE_CONTRACT PDFs | Untraced number does not ship. |

Closed set in code: `COMPANY_IMPROVEMENT_DOMAINS` in `lib/data/loop/domains.ts`. An unknown domain fails the insert.

## Cadence

| When | Who | What |
|---|---|---|
| Continuous | Agent on the winning domain | One class per cycle. Grind until blocked on Matt, a measurement window, or an empty score. |
| Daily | Substrate + Sense | Sync, pulse, tokens, deploy, money-path smoke. |
| Weekly | Orchestrator | Overwrite [COMPANY_SCOREBOARD.md](COMPANY_SCOREBOARD.md). Close learn rows whose windows ended. Re-score. |
| Monthly | `/deep-audit` | Stuck rows, dark crons, expired tokens, drifted skills. |
| On escape | Whoever shipped it | Fix the class, add the gate, write `process_escape_ledger`. |

Matt reads the weekly packet. He says yes only to outbound to real people, public posts, ad spend, and OAuth.

## Collision (keep)

- Public structure vs Growth content: a family under visual rebuild is frozen to Growth until it ships.
- Nurture owns outbound. Demand / Presence never send.
- Transaction owns anything legally binding. SkySlope is the live file until cutover.
- Public numbers only from CAP-006 / marts.
- One session per file glob. Parallel build in worktrees; serial land on `main`.
- Broker OS A–G are **job names**, not a second process.

## Do not

- Write a new Public / Admin / Company Product OS
- Add a sixth standing agent session as the default
- Treat `docs/plans/continuous-improvement.md` as live
- Rebuild FEATURES.md as the SoR
- Grind ads while Demand is parked
- Silent social posting or SkySlope cutover

## First code

`site_improvement_ledger.domain` + DAL in `lib/data/loop/`. Ingest: `collectCompanyScoreboardSignals`. Probe: `npx tsx scripts/company-scoreboard-probe.ts`.
