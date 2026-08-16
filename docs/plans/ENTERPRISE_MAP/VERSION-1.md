# Company v1 — the first certified whole-company version

**Status: OPEN** (flips to CERTIFIED by the certification pass below, in one commit)
**Max:** G31 · M6 (the tail pin — G56 fails if rows above these numbers vanish or the pin goes stale)
**Process:** THE LOOP v1.6.0 §Company versions (`docs/DEVELOPMENT_PROCESS.md`)
**Substrate:** the Enterprise Map matrices (`matrix/CAPABILITIES.md` CAP-001…035, `matrix/INTEGRATIONS.md` INT-001…037, `matrix/FACTORY.md`), inventories regenerated 2026-08-08T21:00Z; live figures carry their own stamps in `COMPANY_SCOREBOARD.md` (single source — counts are not restated here).
**Demand side:** [REQUIREMENTS.md](REQUIREMENTS.md) — every harvested Matt directive, dispositioned; the current count and split live in that file's G57 gate output, not here. MISSING/PARTIAL rows cite the gap below that carries them.

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
| **2. Data in** | Feeds that fill layer 1 | Spark MLS sync 3 lanes (CAP-007) · analytics snapshots GA4/GSC/socials (CAP-031) · email + SMS events (INT-004/005) · visitor tracking + identity map (164 visitors, 1 stitched to a person) · SkySlope mirror (INT-017 ops live; rows still stamped 2026-06-10 until the first successful cron) | Working. Identity stitch is the remaining weak seam. |
| **3. Public product** | The 296-page site a consumer sees | Search/map (CAP-002) · listing detail (CAP-003) · geo/neighborhood pages (CAP-004) · market hub (CAP-005) · landing pages (CAP-008) · team (CAP-021) · account (CAP-023) · SEO/AEO (CAP-029) · design system (CAP-026) · voice (CAP-028) | Working-to-reliable. No route below Working. |
| **4. Broker product** | The 170-page admin the brokers run the business on | CRM people/inbox/sequences (CAP-009/010/011) · CMA/BPO (CAP-013) · TC (CAP-012) · prospecting (CAP-014) · newsletter (CAP-020) · DSCR (CAP-034) · SMS agent (CAP-035) · broker platform/onboarding (CAP-022) · admin shell + design (CAP-024/025/027) | Uneven. Shell VERIFIED at Reliable; TC, SMS agent, and onboarding are Skeleton. |
| **5. Outbound + distribution** | How work leaves the building | Marketing brain pipeline (CAP-015) · producers (CAP-016) · video (CAP-017) · Meta ads/audiences (CAP-018) · social publishing OAuth (CAP-019) · westside program (CAP-030) | Weakest layer, but not for tokens: TikTok, YouTube, X, GBP, and the Meta page token all self-renew via the daily heartbeat (verified live 2026-08-15). LinkedIn is parked (provider issued no refresh token). The real gaps: brain measured=2 of 420 ready; sends Matt-gated by design. |
| **6. The factory** | How the company changes itself | THE LOOP + gates (271 `ci:*`) · 61 registered crons · deploy discipline · the Enterprise Map · this manifest (CAP-032, FAC-*) | Working. The Learn step became mechanical with v1.3.0 (this delivery). |

## Where v0 stands (map close 2026-08-08 + probe 2026-08-15)

- **Capabilities:** 6 Reliable · 22 Working · 7 Skeleton · 0 below Skeleton. Evidence: 6 VERIFIED · 27 PARTIAL · 1 UNKNOWN · 1 BLOCKED_MATT.
- **Integrations:** the 2026-08-08 map close called GBP, LinkedIn, YouTube, and X red "reconnect" items. **Corrected 2026-08-15 with live evidence:** GBP, YouTube, and X carry 1–2 hour access tokens by provider design and auto-refresh from stored refresh tokens via the daily 12:00Z token-heartbeat (scheduled run 2026-08-15T12:00:03Z all OK; live trigger rolled expiries forward on demand). TikTok same, verified. Only LinkedIn is dead — its provider issued no refresh token — and it is **PARKED**, not a reconnect ask. Red count after correction: **0**.
- **Ledger:** 12 rows · 12 open windows · **11 expired-unlearned, all `seo-aeo`** — the measured proof of the ad-hoc habit. The WIP guard now refuses new classes in that domain until they close.
- **Live seams:** identity 32/166 stitched · Lead stage = 2 of 22,679 people (G3 writer) · 6 active listing alerts · email clicks 7d = 0.

## The v1 floor (all seven, together)

1. **No capability below Working (3)** — or it carries Matt's explicit PARK / BLOCKED sign-off recorded on this manifest.
2. **Zero needs-reauth integrations** — tokens with refresh tokens on file self-renew via the heartbeat (that is the system working, not a defect); anything the provider will not refresh is explicitly parked. Met 2026-08-15: LinkedIn parked, everything else auto-refreshes.
3. **Zero FIX integrations** — Meta audience heartbeat green for a full week (first green run 2026-08-15T14:03Z); SkySlope mirror re-synced or the cutover decided.
4. **Zero expired unlearned ledger windows** — now mechanical: `insertImprovementLedgerRow` refuses a stranded domain; `closeImprovementLedgerRow` is the Learn step.
5. **Zero UNKNOWN in the weekly packet on claimed-fixed signals** — plus first rendered look-walk baselines (public site 390+1280, CMA output) and `/join` conversion instrumented.
6. **Production parity** — `main` deployed READY, hosted schema current, methodology stamp honest (v3, never claimed v4).
7. **Certification pass** (below) run end to end in one commit.

## The v1 gap list

Agent-executable (each is a normal loop class: ledger row → blast-radius planes → accept → Learn):

| # | Work | Ref | Domain |
|---|---|---|---|
| G1 | **DONE 2026-08-15** — all 11 windows closed via `scripts/loop-learn-close-windows.ts` with §0 traces: 1 win (Tetherow LCP p75 60,768ms → 4,156ms), 1 loss (overlay discipline, engagement 0.144 → 0.119), 1 flat (llms.txt +3 AI sessions vs +10), 8 inconclusive (GSC page series not live in the June window — telemetry gap named per row). Probe `expiredUnlearned` = 0; domain unfrozen. Work-graph node `bcde58b9` carries the evidence. | ledger probe 2026-08-15 | seo-aeo |
| G2 | **DONE 2026-08-16** — lead-capture + sign-in write `crm_person_id` on `visitor_identity_map` (lockstep with `fub_person_id`). Planes: identity, ads-audiences (`external_id`), alerts (`stampListingAlertsCrmPerson`). Packet §1b 1/164 → **32/166**. Accept: fleet-test form-submit stitch `rr_vid=g2-accept-ea08a60f-3cbc-4769-9353-c56e686588fc` person 61855. Gate `ci:identity-stitch-paths`. | packet §1b | leads |
| G3 | **DONE 2026-08-16** — inbound `buildNativePersonRow` writes Lead (trigger `native-create`); `sequence-enroll` + `first-outbound` advance Lead → Nurture via `advanceJourneyStage`. Sequence first send stamps first-outbound. Compose stages read `getCrmStages`. Broker/bulk writes name `broker-set-stage`. Lead stage reactivated at position 0 (no people remap). Accept: writer created 61917 + 61920 at Lead; `advanceJourneyStage` moved 61921 Lead → Nurture (timeline source `sequence-enroll`). Packet-eligible Lead 0 → **2**. Gate `ci:stage-truth`. | CAP-009; R-163 | nurture |
| G4 | **DONE 2026-08-16** — account / guest / buyer-LP enrollment writes `listing_alerts` with native `crm_person_id` (`nativeCrmPersonId`; account captures the person before persist). Sends read `listing_alerts` only. Live before: 7 active / 8 total, all already stitched. Accept: fleet-test save created an active row with `crm_person_id`. Gate `ci:listing-alert-enroll`. | CAP-010, packet §1b; R-152 | nurture |
| G5 | **DONE 2026-08-16** — day-one checklist on Today; `scopeBroker` fail-closes unmapped non-superusers to `UNMAPPED_OWN_BOOK`; slug from `brokers.crm_slug`; `content.marketing` unlocked. Accept: signed-in `paul@ryan-realty.com` on production Today (socials item open) and People (recently-touched all `assigned paul`); DB book 71 vs company 23009, sentinel 0. Gate `ci:broker-own-book`. | CAP-022; R-198 residual OAuth | recruit-retain |
| G6 | SMS agent to its plan's definition of done. **BLOCKED 2026-08-16** — accept is a live marketing-line text → reply → APPROVE stamp; hard limit forbids outbound SMS to Matt. Graph `c8bbccaa` carries the reason. Unblock: Matt texts APPROVE or authorizes one smoke to his cell. | CAP-035 | broker-tools |
| G7 | **DONE 2026-08-16** — every WESTSIDE_BACKLOG row dispositioned. #9 review-ask drafts + #10 luxury money links shipped. #2/#5 re-ranked to G22 (crawl evidence). #7/#8 gated (spend / outbound). Gate `ci:westside-backlog`. | CAP-030 | seo-aeo |
| G8 | **DONE 2026-08-16** — inbound Files refresh cron `/api/cron/skyslope-mirror-refresh` (HMAC login + GET only). DAL `getSkySlopeMirrorFreshness` / `refreshSkySlopeMirrorInbound`. Closings verdict + heartbeat `evalSkySlopeMirror`. Gate `ci:skyslope-mirror` 12/12. Accept residual named: this VM cannot invoke production cron (injected `CRON_SECRET` 12-char stub → 401) and has no `SKYSLOPE_*` keys; first refresh is the 06:20 UTC schedule. Probe 2026-08-16: 33 rows, newest `synced_at` 2026-06-10T00:35:10Z, age 1617h, `current=false`. | INT-017 | transactions |
| G9 | **DONE 2026-08-16** — first rendered baselines on production at 390+1280 for the `beat_on` set (8 routes, all HTTP 200) plus graded CMA `cma-19496-tumalo-reservoir` (17 pages, cover is the house, range $955k–$1.06M). Packet §1b CMA look + public-ux walk read `look-walk-baseline.json` (no longer UNKNOWN). Gate `ci:look-walk`. Residuals named on the baseline (home/city/Tetherow/market TRAIL; listing/about WORKING). | packet UNKNOWNs; R-092 | public-ux, broker-tools |
| G10 | **DONE 2026-08-16** — `/join` visits + conversions from `visitor_events` via `getJoinConversionStats`. Contact form `Join the team` writes `join_convert` and tags `recruit:join` (no buyer enroll, no CAPI Lead). Today + packet read the same DAL. Gate `ci:join-conversion`. | packet §7; R-201 | recruit-retain |
| G11 | Meta audience heartbeat: hold green 7 days, then flip INT-007 FIX→KEEP. **Machinery 2026-08-16** — `readMetaAudienceHold` + 36h daily probe; map cell updated (last LIVE 2026-08-16T09:01Z). Accept still open: streak must end on or after **2026-08-22**. | INT-007 | factory |
| G12 | **DONE 2026-08-16** — park-or-rebuild docket on the packet and `/admin/loop`. Park = incremental vendor $0 (keep R-045; inbox video types stay matt_alert). Rebuild = ElevenLabs Turbo $0.05/1k + producer cap $5/row $15/run; re-register 24 producers; repoint 11 dead safe-zone imports; requires Matt to change R-045. Decision pending M3. Gate `ci:video-docket`. | CAP-017; R-045 | factory |
| G13 | **DONE 2026-08-16** — eight unknown-health cells probed. Green KEEP: OpenAI models 118, xAI models 12, Unsplash 1, Replicate `ryanrealty` + Synthesia videos 1, AdSense `pub-592866` in prod JS. Park: Sentry stub DSN / `org:ci` token, NeverBounce key missing, VAPID keys missing (0 active subs). Health counts **unknown = 0**. Gate `ci:integration-health`. | INT-021…036 | factory |
| G14 | **DONE 2026-08-15** — token auto-refresh verified live: scheduled heartbeat 12:00:03Z refreshed TikTok (rolls daily) and renewed YouTube/X/GBP; on-demand trigger moved expiries forward again at 19:09Z. Refresh tokens on file for all four. | INT-009, INT-011, INT-012, INT-013, heartbeat `sync_logs` | social-presence |
| G15 | Search completeness to plan acceptance: zoning intents with definitions, long-tail disposition ledger, sold depth behind VOW gate, user saved areas, perf p75 targets | REQUIREMENTS R-097…R-106 | public-ux |
| G16 | CMA/pricing production residual: corpus rebuild under live judge, resolver flags, one engine across CMA/BPO/expired-audit, comp geography contract, send-to-reply funnel, listing Transparent-CMA | REQUIREMENTS R-069, R-070, R-073, R-074, R-083, R-112 | sales-insights |
| G17 | Prospecting product: one dense sortable list, real detail page with send-audit, person-page rollup, per-channel compliance stops | REQUIREMENTS R-171, R-172, R-145 | broker-tools |
| G18 | Reporting collapse: one definition registry, each metric computed once behind the DAL and rendered once, measurement stamps (first-action, reply latency, CMA SLA) on admin | REQUIREMENTS R-026, R-077, R-078, R-080 | sales-insights |
| G19 | One responsive person surface + unified SendPanel; delete desktop/mobile forks; one send path per concept | REQUIREMENTS R-170 | broker-tools |
| G20 | Buyer packet product (build side): how-this-home-compares + what-to-think-about-offering; ask-first flow; sends stay Matt-gated | REQUIREMENTS R-142 | nurture |
| G21 | Public IA/mobile residual: nav coverage, city section-order fan-out to neighborhood/community, KB density, duplicate DOM streaming waste, dead-end map cards, sub-city scoping, interstitial stacking, sticky broker bar | REQUIREMENTS R-107, R-108, R-109 | public-ux |
| G22 | SEO/AEO residual: money-path JSON-LD parity contracts, crawl-budget pruning, GBP review-ask drafts, /luxury internal links, Lighthouse perf promote, contestable-SERP depth, out-of-area referral tier | REQUIREMENTS R-119, R-120, R-124, R-125, R-126, R-129, R-130, R-151 | seo-aeo |
| G23 | Email residue kill: stop FUB/Beacon archived nurture sends via connected Gmail; purge FUB vocabulary and dead keys | REQUIREMENTS R-147 | nurture |
| G24 | Admin dark mode: both themes ship and are reachable | REQUIREMENTS R-116 | broker-tools |
| G25 | Social fan-out calendar (build side): one idea becomes per-channel variants, Loop G draft-first calendar on Today; publishes stay approval-gated | REQUIREMENTS R-186 | social-presence |
| G26 | Email tracking completeness: route the four untracked send paths (sequence SMS-to-email fallback, home-valuation CMA delivery + acknowledgment, admin one-off composer, CMA request confirmation) through `attributeOutbound`/track | REQUIREMENTS R-137; adversarial audit 2026-08-15 | nurture |
| G27 | Coming Soon count truth — **not done**. Dedicated session (2026-08-02) sealed public listing access (RLS + `listing-status-public` + sitemap). Residual: pulse `active_count` still SQL-includes Coming Soon (`refresh_market_pulse` FILTER Active+CS). Live 2026-08-16: Bend pulse 486 (v3); City=Bend SFR Coming Soon = 5 (second shape). Public listing counts exclude CS; the served pulse number does not. Loop node `2891d28e` stays **open**. | REQUIREMENTS R-025; audit 2026-08-15; probe 2026-08-16 | sales-insights |
| G28 | Referral fee reaches the money math: `inboundFeePct` (recorded 25%) currently write-only — wire it into `tc_commissions.referral_fee` when a referred person's deal closes | REQUIREMENTS R-203; audit 2026-08-15 | transactions |
| G29 | Stand the verification fleet up: Matt creates the 6 starter bots from VERIFICATION-FLEET.md briefs; endpoint proven with a synthetic finding end-to-end (POST → table → intake → node → rejected-as-test); first core+regression pass runs | REQUIREMENTS R-207; VERIFICATION-FLEET.md | factory |
| G30 | **DONE 2026-08-15** — Flow Prover lane: designated fleet test identity recognized at the intake chokepoint (tag + all-channel suppression), wake-task skip, auto-enroll refusal, packet-count exclusion — all four guards proven live (fixture person 61855: tagged, suppressed, 0 tasks, enroll refused, excluded). Flows case pack + Bot 6 brief + `fleet-flow-verify` backend check shipped. | REQUIREMENTS R-208; chokepoint proof 2026-08-15 | factory |
| G31 | Newsletter redesign (look only): restyle the branded email shell + admin rendered preview so Matt can approve the look. Enroll and send stay Matt-manual after that approve. Zero sends in this node. | REQUIREMENTS R-212; R-159 | nurture |

Matt-only (steered 2026-08-16 — CHANGE/HOLD/PARK/DONE recorded below; nothing else waits):

| # | Move | Ref |
|---|---|---|
| M1 | **CHANGE 2026-08-16** — first-cohort blast is no longer the v1 gate. Loop work is G31 redesign. After Matt approves the look, he enrolls and sends manually. | CAP-020 |
| M2 | **HOLD 2026-08-16** — TC cutover held until the TMS has been thoroughly tested. Do not unpause TC_BUILDOUT. Vault stays SoR; SkySlope stays live TMS. | CAP-012 |
| M3 | **SILENCE 2026-08-16** — park-in-practice. R-045 stays LOCKED. Docket remains (park $0 / rebuild $0.05/1k Turbo + $5/row). No rebuild until Matt says rebuild. | CAP-017 |
| M4 | **PARKED 2026-08-16** — no ad spend for v1. Audience wiring and the Meta heartbeat continue. | CAP-018 |
| M5 | **DONE 2026-08-16** — ryan-realty.com has been the live host for a long time (A 76.76.21.21, `server: Vercel`). DNS cutover is not an open gate. | CAP-001 |
| M6 | **REVIEWED 2026-08-16** — Matt said the OAuth/env set is connected. Live probe: TikTok / YouTube / X / GBP have rows + refresh tokens (KEEP, heartbeat). LinkedIn has a row but expired 2026-07-09 with **no refresh token** (PARK). Threads / Pinterest / Nextdoor auth **empty** (PARK). RentCast / SchoolDigger / Inngest are env keys, not OAuth — still PARK as product paths. No reconnect ask. | INT PARK list + CAP-033 |

There is no OAuth reconnect task. Tokens that can refresh self-renew (Matt 2026-08-15). The prior M1-as-reconnect was an escape — see `process_escape_ledger`.

## Certification pass (run when the gap list is empty)

1. Regenerate inventories A–R; re-stamp CAP/INT/FAC evidence cells that moved.
2. `npm run ci:gates` + tests + build green at the certification SHA.
3. Probe: `expiredUnlearned = 0`; zero UNKNOWN on claimed signals; token set as agreed (valid or parked).
4. Route smoke + money-page content gates green on production.
5. Deploy READY on the SHA; hosted schema parity confirmed.
6. Flip this header to **CERTIFIED** with SHA + date; the weekly packet records "Company v1".
7. Open `VERSION-2.md` with the next floor (candidate themes: outbound layer to Working everywhere, measured>ready in the brain, identity stitch as a default property of every lead path).

## Rules

- **One open class per domain; stranded domains are frozen** — enforced twice: in the DAL (`lib/data/loop/ledger.ts`, fail-closed on unreadable ledger) and at the database (`site_improvement_ledger_guard` trigger, migration 20260815210000), so no writer bypasses it. Work-node transitions are likewise trigger-enforced (`loop_work_nodes_guard`).
- **The weekly packet leads with version progress**: gaps closed / remaining, floor violations, stranded windows.
- **No side manifests.** This file is the version; v2 supersedes it inside this package. A "version plan" anywhere else is a rogue plan (G44).
- **Blast-radius still applies per class** (`docs/plans/COMPANY_IMPROVEMENT.md`): the version is the macro accept; each class still names its planes and accepts against its goal type.
