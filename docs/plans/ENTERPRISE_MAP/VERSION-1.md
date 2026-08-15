# Company v1 — the first certified whole-company version

**Status: OPEN** (flips to CERTIFIED by the certification pass below, in one commit)
**Process:** THE LOOP v1.3.0 §Company versions (`docs/DEVELOPMENT_PROCESS.md`)
**Substrate:** the Enterprise Map matrices (`matrix/CAPABILITIES.md` CAP-001…035, `matrix/INTEGRATIONS.md` INT-001…037, `matrix/FACTORY.md`), inventories regenerated 2026-08-08T21:00Z, live probe 2026-08-15T15:3xZ (`npx tsx scripts/company-scoreboard-probe.ts`).

## Why versions exist

The failure mode: we go deep on one change, ship it, and the rest of the company never
catches up. Forward, regress, forward, regress. Trunk-based shipping has per-commit gates
but no moment where the WHOLE system is certified together, so seams rot invisibly.

A **company version** is that moment. It is a floor across every capability and
integration in the map, verified together in one pass. Between certifications THE LOOP
grinds classes exactly as it does now. The version defines what "everything caught up"
means, and certification is the forcing function that finds the strands.

Versions close on **conditions, never dates** (§0: an invented timeline is a fabricated
number).

## The whole company in six layers (plain language)

| Layer | What it is | Main pieces (map refs) | State at v0 |
|---|---|---|---|
| **1. Ground truth** | One database everything reads and writes | Supabase: 594,623 listings · 3.9M history rows · 22,672 people · stats caches (45 pulse rows, all methodology v3) · 3,312 boundary polygons (INT-001, CAP-006) | Green. Stats engine VERIFIED; only-path for public numbers. |
| **2. Data in** | Feeds that fill layer 1 | Spark MLS sync 3 lanes (CAP-007) · analytics snapshots GA4/GSC/socials (CAP-031) · email + SMS events (INT-004/005) · visitor tracking + identity map (164 visitors, 1 stitched to a person) · SkySlope mirror (INT-017, stale 2026-06-10) | Working. Identity stitch and SkySlope mirror are the weak seams. |
| **3. Public product** | The 296-page site a consumer sees | Search/map (CAP-002) · listing detail (CAP-003) · geo/neighborhood pages (CAP-004) · market hub (CAP-005) · landing pages (CAP-008) · team (CAP-021) · account (CAP-023) · SEO/AEO (CAP-029) · design system (CAP-026) · voice (CAP-028) | Working-to-reliable. No route below Working. |
| **4. Broker product** | The 170-page admin the brokers run the business on | CRM people/inbox/sequences (CAP-009/010/011) · CMA/BPO (CAP-013) · TC (CAP-012) · prospecting (CAP-014) · newsletter (CAP-020) · DSCR (CAP-034) · SMS agent (CAP-035) · broker platform/onboarding (CAP-022) · admin shell + design (CAP-024/025/027) | Uneven. Shell VERIFIED at Reliable; TC, SMS agent, and onboarding are Skeleton. |
| **5. Outbound + distribution** | How work leaves the building | Marketing brain pipeline (CAP-015) · producers (CAP-016) · video (CAP-017) · Meta ads/audiences (CAP-018) · social publishing OAuth (CAP-019) · westside program (CAP-030) | Weakest layer. 4 of 5 social tokens expired; brain measured=2 of 420 ready; sends Matt-gated by design. |
| **6. The factory** | How the company changes itself | THE LOOP + gates (271 `ci:*`) · 61 registered crons · deploy discipline · the Enterprise Map · this manifest (CAP-032, FAC-*) | Working. The Learn step became mechanical with v1.3.0 (this delivery). |

## Where v0 stands (map close 2026-08-08 + probe 2026-08-15)

- **Capabilities:** 6 Reliable · 22 Working · 7 Skeleton · 0 below Skeleton. Evidence: 6 VERIFIED · 27 PARTIAL · 1 UNKNOWN · 1 BLOCKED_MATT.
- **Integrations:** 9 green · 10 amber · 4 red (GBP, LinkedIn, YouTube, X — all OAuth expiry) · 6 dark (parked) · 8 unknown.
- **Ledger:** 12 rows · 12 open windows · **11 expired-unlearned, all `seo-aeo`** — the measured proof of the ad-hoc habit. The WIP guard now refuses new classes in that domain until they close.
- **Live seams:** identity 1/164 stitched · Lead stage = 0 of 22,672 people · 6 active listing alerts · email clicks 7d = 0 · TikTok token expires 2026-08-16T12:00Z.

## The v1 floor (all seven, together)

1. **No capability below Working (3)** — or it carries Matt's explicit PARK / BLOCKED sign-off recorded on this manifest.
2. **Zero red integrations** — each reconnected (Matt OAuth) or explicitly parked.
3. **Zero FIX integrations** — Meta audience heartbeat green for a full week (first green run 2026-08-15T14:03Z); SkySlope mirror re-synced or the cutover decided.
4. **Zero expired unlearned ledger windows** — now mechanical: `insertImprovementLedgerRow` refuses a stranded domain; `closeImprovementLedgerRow` is the Learn step.
5. **Zero UNKNOWN in the weekly packet on claimed-fixed signals** — plus first rendered look-walk baselines (public site 390+1280, CMA output) and `/join` conversion instrumented.
6. **Production parity** — `main` deployed READY, hosted schema current, methodology stamp honest (v3, never claimed v4).
7. **Certification pass** (below) run end to end in one commit.

## The v1 gap list

Agent-executable (each is a normal loop class: ledger row → blast-radius planes → accept → Learn):

| # | Work | Ref | Domain |
|---|---|---|---|
| G1 | Close the 11 stranded `seo-aeo` windows: write `actual_delta` + verdict from GSC 28d actuals | ledger probe 2026-08-15 | seo-aeo |
| G2 | Identity stitch class: lead-capture + sign-in writes `crm_person_id` to `visitor_identity_map` (1/164 today). Planes: identity, ads-audiences, alerts | packet §1b | leads |
| G3 | Stage truth: Lead stage is 0 of 22,672 people — stage writers + journey advance so the funnel is real | CAP-009 | nurture |
| G4 | Alerts coverage: enroll path from account/LP into `listing_alerts` (6 active today); sends never from legacy `saved_searches` | CAP-010, packet §1b | nurture |
| G5 | Broker platform 2→3: day-one checklist, permissions, own-book views | CAP-022 | recruit-retain |
| G6 | SMS agent to its plan's definition of done | CAP-035 | broker-tools |
| G7 | Westside backlog: execute or re-rank every item with evidence | CAP-030 | seo-aeo |
| G8 | SkySlope mirror re-sync ops (also feeds M3) | INT-017 | transactions |
| G9 | Look-walk baselines recorded: public site at 390+1280, CMA rendered output graded | packet UNKNOWNs | public-ux, broker-tools |
| G10 | `/join` conversion instrumented so recruit-retain has a number | packet §7 | recruit-retain |
| G11 | Meta audience heartbeat: hold green 7 days from 2026-08-15, then flip INT-007 FIX→KEEP | INT-007 | factory |
| G12 | Video decision docket for Matt: park or rebuild, with costs and the brain-path option | CAP-017 | factory |
| G13 | Probe each unknown-health integration once (Sentry ingest, OpenAI/xAI call path, stock/gen media, VAPID, AdSense); flip to green or park | INT-021…036 | factory |
| G14 | TikTok auto-refresh verified actually renewing (token expires 2026-08-16T12:00Z); else it joins M1 | INT-011 | social-presence |

Matt-only (the complete list of human dependencies for v1 — nothing else waits on you):

| # | Move | Ref |
|---|---|---|
| M1 | OAuth reconnect: GBP, LinkedIn, YouTube, X (sign-in only; runbook exists) | INT-009/010/012/013 |
| M2 | Newsletter first cohort send (5,346 subscribers waiting) | CAP-020 |
| M3 | TC: unpause TC_BUILDOUT or hold, and the SkySlope cutover decision | CAP-012 |
| M4 | Video: park or rebuild (after G12 docket) | CAP-017 |
| M5 | Ads spend: fund or explicitly park for v1 (audience wiring is agent work either way) | CAP-018 |
| M6 | DNS cutover timing (ryan-realty.com) | CAP-001 |
| M7 | One-line PARK sign-off: Threads, Nextdoor, Pinterest, RentCast, SchoolDigger, Inngest stay parked for v1 | INT PARK list |

## Certification pass (run when the gap list is empty)

1. Regenerate inventories A–R; re-stamp CAP/INT/FAC evidence cells that moved.
2. `npm run ci:gates` + tests + build green at the certification SHA.
3. Probe: `expiredUnlearned = 0`; zero UNKNOWN on claimed signals; token set as agreed (valid or parked).
4. Route smoke + money-page content gates green on production.
5. Deploy READY on the SHA; hosted schema parity confirmed.
6. Flip this header to **CERTIFIED** with SHA + date; the weekly packet records "Company v1".
7. Open `VERSION-2.md` with the next floor (candidate themes: outbound layer to Working everywhere, measured>ready in the brain, identity stitch as a default property of every lead path).

## Rules

- **One open class per domain; stranded domains are frozen** — enforced in code, not prose (`lib/data/loop/ledger.ts`).
- **The weekly packet leads with version progress**: gaps closed / remaining, floor violations, stranded windows.
- **No side manifests.** This file is the version; v2 supersedes it inside this package. A "version plan" anywhere else is a rogue plan (G44).
- **Blast-radius still applies per class** (`docs/plans/COMPANY_IMPROVEMENT.md`): the version is the macro accept; each class still names its planes and accepts against its goal type.
