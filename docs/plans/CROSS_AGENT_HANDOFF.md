# Current — 2026-10-14 (Cursor, AGENTS.md single process source)

Surface: Cursor cloud. Branch `cursor/agents-md-single-source-6f1e` / PR #562 from origin/main `a0030cbdc` (#546 after #559). Folds and supersedes #544 (agent rules: PR plus self-merge, DB writes). Nobody pushes main. Nothing sent.

**What this branch does.** `AGENTS.md` is the only process-rule file. CORE RULES (identical prefix in `CLAUDE.md` for Grok's 10k cutoff) add: PRs only / no fast-forward; auto-merge except `hold-for-matt`; no PR older than 3 days; Done = merged + production READY + live URL; payload caps; no sleep waits; new process rules land in `AGENTS.md`; bots may write the Ryan Realty Supabase DB when Matt's task needs it. `CLAUDE.md` and `.cursor/rules` process files point here. Sends, expired drip hard stop, no force-push, no secrets, no approved-CMA wording changes stay.

**Also this session.** Tried repo Allow auto-merge + `hold-for-matt` label: GitHub App 403. `gh pr merge --auto` squash-merged #559 (`5ebc1c030`) and #546 (`a0030cbdc`) because they were already mergeable. #547/#550/#514 cannot enable auto-merge (`Auto merge is not allowed for this repository`); #550 and #514 are CONFLICTING. #545/#469/#473/#479 stay open (titles already hold for Matt; label could not be created).

**Held.** Do not send. Do not rebuild letters. Do not apply `20261013180000_crm_suppressions_cleared.sql`. Do not merge the phase-pool branch.

Skills read: `.cursor/rules/git-commit.mdc`, `.cursor/skills/site-queue/SKILL.md`.

## Earlier — 2026-10-14 (Cursor, reader-5 leftover reads)

Surface: Cursor cloud. Branch `cursor/reader-5-leftover-reads-52cc` / PR #559, merged onto `origin/main` (`5ebc1c030`). Closed stale #552. Nobody pushes main. Nothing sent. No CMA rows written.

**What that branch did.** (1) Thin-window own-listing-unsold: an Active home whose ask was cut, with no per-foot local verdict, stands in as its own local read so own-ground sales move down with the city index. (2) Own-ground sold count: when own-subdivision rungs find nothing, one any-size read of the subject's ground; the letter says "No home sold" only on a real zero.

## Earlier — 2026-10-14 (Claude, the two buyer landing pages look like landing pages)

Surface: Claude Code cloud. Branch `claude/festive-ramanujan-xfbo6b` from origin/main `5293aa46`. PR #548 landed on main. Nothing sent. Nobody pushes main.

## Earlier — 2026-10-14 (Cursor, Meta Lead no dollar values)

## Earlier — 2026-10-14 (Cursor, CMA intake + ranking PRs live)

## Earlier — 2026-10-14 (Cursor, GA4 offline conversions)

Surface: Cursor cloud. Branch `cursor/offline-ga4-conversions-3b48` (#543), merged origin/main `7e23fdb97` (#551 handoff, #489 same-vintage, #542 Meta Lead no dollars). Nothing sent. Nobody pushes main. No rebuild.

**This pass.** Daily `/api/cron/offline-conversions` now also sends GA4 MP `qualify_lead` (Buyer Contract, Pending) and `close_convert_lead` (Closed) through `fireGa4Event`. `lead_type` only, no dollar amount. Stored `_ga` client_id on `crm_people.custom.gaClientId` (first-touch from `fireLeadGenerated`). Skip + log when missing. Idempotent `ga4_offline_conversion` / `person:<id>:<stageKey>`. Live audit 2026-10-14: **0 of 23,909** contacts have a usable client_id. Land #543, then `gh pr checks --watch` and `gh pr merge --squash`.

**Still open.** Hold #452 (body requires a rule-25 fleet score). Hold #471 (stale vs main; would drop `loadCmaMapTile` / `CMA_MAP_MS`). Do not send. Do not rebuild letters. Do not apply `20261013180000_crm_suppressions_cleared.sql`. Do not merge the phase-pool branch. The unique `idx_listings_parcel_number` migration is not on main.

Skills read: `.cursor/rules/git-commit.mdc`, `.cursor/skills/site-queue/SKILL.md`.

## Earlier — 2026-10-14 (Cursor, listings-failure no-cache)

Surface: Cursor cloud. Branch `cursor/listings-failure-no-cache-fd1f` landed on main via #511. Community and resort pages throw `ListingsUnavailableError` after one retry. A cold miss is HTTP 500 + noindex. `CommunityDegraded` is deleted.

## Earlier — 2026-10-14 (Cursor, make main CI green)

Surface: Cursor cloud. Branch `cursor/fix-main-ci-db9c` landed on main via #539. Nothing sent. Nobody pushes main.

**What that commit did.** `ci:studio-rules` names both studio node tests. `/sell` Stage uses the repo `SELL_POSTER` (4200×3150) so content-floor stays 3780. After #521, type links jump to `#homes-dial-<group>`. After #528, `serve.ts` re-exports `V3Footer`. After #498, `/buy/concessions` takes the 30-yr rate from `getLiveMortgageRate` / `getCalculatorDefaults` and points are `dollars / loan * 100` so `ci:stat-source` stays one engine.

## Earlier — 2026-10-11 (Grok, CMA outreach build gate + 13 approved sends)


Surface: Grok. Branch `fix/cma-outreach-build-gate`, PR #485, cut from origin/main `c6c855384`. Upstream is this feature branch, never main. Matt merges. Do not pop git stash `plat-walk wip 2026-10-09`. Do not restart the 144-home fleet. Do not send any letter named below again.

**Sent today on Gmail, after Matt approved the within-15% above-range set.** Existing drafts. Not rebuilt. Each passed a live off-market check, a sendable non-suppressed email, five price-setting sales, last ask above the printed band, and a recommendation within 15% under the ask. `sendCmaToLead` returned transport gmail. Each has one `email_events` row, event `sent`, key `cma:<slug>`. At send time open=0, click=0, bounce=0. Gmail does not write a provider `delivered` event; `cmas.status` is the receipt. Public letter: `https://ryan-realty.com/cma/<slug>`.

- 1648 Pheasant `cma-1648-pheasant` ask $599,900, band $475,306–$587,555, rec $531,000
- 20653 Foxborough `cma-20653-foxborough` ask $599,000, band $505,476–$559,360, rec $528,000
- 20850 Delta `cma-20850-delta` ask $814,900, band $748,823–$790,560, rec $754,000
- 21512 Etna `cma-21512-etna` ask $649,999, band $588,843–$625,826, rec $593,000
- 2462 Lynda `cma-2462-lynda` ask $619,000, band $533,043–$595,093, rec $552,000
- 2923 Deborah `cma-2923-deborah` ask $575,000, band $413,863–$544,752, rec $497,000
- 2949 Flagstone `cma-2949-flagstone` ask $568,900, band $534,765–$561,162, rec $538,000
- 3037 Purcell `cma-3037-purcell` ask $565,000, band $503,611–$550,951, rec $526,000
- 3063 Brownstone `cma-3063-brownstone` ask $669,900, band $637,400–$659,900, rec $640,000
- 3802 Petrosa `cma-3802-petrosa` ask $774,900, band $709,900–$754,900, rec $713,000
- 60865 Sweet Pea `cma-60865-sweet-pea` ask $660,000, band $549,000–$657,964, rec $605,000
- 61574 Devils Lake `cma-61574-devils-lake` ask $849,900, band $744,407–$829,611, rec $806,000
- 61579 Lucia `cma-61579-lucia` ask $565,000, band $470,338–$512,310, rec $491,000

**Already delivered yesterday. Do not send again.** Aldrich `cma-2745-aldrich` and Mahogany `cma-19877-mahogany`, both 2026-10-11 17:55–17:56 UTC, Gmail, `sent=1`. Still open=0, click=0, bounce=0, no public page view.

**Not sent. `email_events` sent=0. Still drafts. Nothing to open.**

- 1913 Monterey Mews `cma-1913-monterey-mews` stayed a draft. The stored letter prices on 3 sales. The floor is 5. It was not rebuilt. Ask $660,000, band $565,000–$659,000, rec $601,000, which is above the band and within 15%, but three sales cannot go out.
- Holds, more than 15% under the last ask: 1122 Foxwood, 1235 Hartford, 140 4th, 1265 Remarkable, 120 Sisemore, 1624 Overlook, 1975 Butler Market, 1975 Harriman, 19985 Voltera, 20184 Merriewood, 21315 Livingston, 21380 Oakview, 2667 Jones, 2681 Moonlight, 3153 Cromwell, 69 Piper, 711 Georgia.
- No sendable email: 1027 Albany, 19920 Ponderosa, 3353 Collier, 454 Burnside, 60933 Sydney Harbor, 61370 Fairfield, 62619 Lawler, 63106 Sophwith, and Nolan `cma-62856-nolan` (untyped phone is not a cell).
- 20513 Byron is suppressed.
- Inside-range and ask-below-band letters were not sent. Lucus stays suppressed.

**Gate.** PR #485 is still open. `gateOutreachBuild` is not on production until Matt merges. The sends above ran from this worktree, which has the gate, and each send also ran `screenAddressForSolicitation`.

**Still open.** Do not rebuild McCann until 20 McCann unit 5 and 26 McCann #2 are checked (both about 1,604 sq ft, $975,000). Schaeffer stays outside Boyd Acres. Do not add Parks At Broken Top back as a Broken Top alias. The homes that stayed short on the 2026-10-10 book walk stay short. Oakview stays a hold.

Skills read: none. The send used `sendCmaToLead` after the live gate. Git commit format from `.cursor/rules/git-commit.mdc`.

## Earlier — 2026-10-14 (Cursor, homes-for-sale-by-area internal links)

Surface: Cursor cloud. Landed on main via #525. Sitewide footer column "Homes for sale by area" plus listing city/community doors. Nothing sent.

## Earlier — 2026-10-14 (Cursor, HTML payload budget)

Surface: Cursor cloud. Branch `cursor/html-payload-budget-7682` from origin/main `a4b308804` (merged, not rebased: #525 by-area links, #511 listings-failure, #539 CI reds, #536, #538, #528, #533, #521). Land path is `gh pr merge 527 --squash` after this PR's own CI. Nobody pushes main. Nothing sent.

**What this branch does.** Caps public listing SSR grids at 24 cards (`SSR_GRID_PAGE`; home rails 36). Community fold grid and map homes past 24 load from `GET /api/place/homes`. Search SSR no longer reads cookies (`getSession` / saved / liked); viewer state hydrates after paint so `/homes-for-sale/bend` can use the public `s-maxage=60` header. Listing media flight capped at 24 photos. `ci:page-payload` shrink-only ratchet plus a 200 KB hard fail when serialized unique listing cards exceed one grid page. `/search` content-floor words lowered 819 → 750 because the 24-card seed has fewer address words (CI measured 763). #525 Bend leftover intro and footer by-area column stay from main.

**Not this change.** Do not merge `cursor/ai-voiceover-scripts-8a9c` unless Matt asks. Do not merge the SMS suppression branch. Do not apply `20261013180000_crm_suppressions_cleared.sql`. Do not run the CRM backfill. Do not send. Do not merge `fix/cma-phase-match`. Do not merge PR 488 or 489. Do not rebuild letters.

**Still open.** Do not pop git stash `plat-walk wip 2026-10-09`. Do not restart the 144-home fleet. Whole-plat pool stays on `fix/cma-whole-pool`. Do not rebuild `cma-120-sisemore` unless Matt asks. Schaeffer stays outside Boyd Acres. Do not add Parks At Broken Top as a Broken Top alias. Oakview stays a hold. Keats and Remarkable stay delivered.

Skills read: `.cursor/rules/git-commit.mdc`, `.cursor/skills/site-queue/SKILL.md`, `docs/RUN_LOOP.md` (this is payload plumbing, not a site-queue look change).

## Earlier — 2026-10-14 (Cursor, homes-for-sale-by-area internal links)

Surface: Cursor cloud. Branch `cursor/homes-for-sale-by-area-f550` landed on main via #525. Nobody pushes main. Nothing sent.

**What that branch did.** Sitewide footer column "Homes for sale by area" with exact-match anchors to `/homes-for-sale/{bend,redmond,sisters,sunriver,la-pine}` plus the top eight community hubs. `/homes-for-sale/bend` server-renders live inventory takeaways after the H1.

## Earlier — 2026-10-14 (Cursor, listings-failure no-cache)

Surface: Cursor cloud. Landed on main via #511 at `ab4342b1d`. Community and resort pages throw `ListingsUnavailableError` after one retry when the listings or community read does not answer.

## Earlier — 2026-10-14 (Cursor, make main CI green)

Surface: Cursor cloud. Landed on main via #539 at `5293aa46c`. `ci:stat-source` one engine; `#homes-dial-` type links; `V3Footer` re-export.


## Earlier — 2026-10-14 (Cursor, city buyer-answer geo-guard)

Surface: Cursor cloud. Landed on main via #538. Reserved child segments (`living`, `cost`, `vs`, `types`) pass through to the App Router.

## Earlier — 2026-10-13 (Cursor, sitemap + listing index hygiene)

Surface: Cursor cloud. Branch `cursor/sitemap-index-hygiene-f2b8` landed on main via #533. Do not `git push` main. Nothing sent.

**What that commit did.** `listings.xml` submits Active, Active Under Contract, and Pending. Closed / Expired / Withdrawn / Canceled pages older than 90 days are `noindex, follow` with a community or city hub canonical. Thin geo and matrix URLs drop.

## Earlier — 2026-10-13 (Cursor, price-drops accuracy)

Surface: Cursor cloud. Branch `cursor/price-drops-accuracy-61bb` landed on main via #512. Nothing sent.

## Earlier — 2026-10-13 (Cursor, inbound SMS clear + industry exclusion, PR only)

Surface: Cursor cloud. Branch `cursor/clear-import-suppression-on-inbound-sms-f271` from origin/main `b802ee703`. Do not merge. Do not `git push` main. Do not apply hosted SQL. Do not run the backfill. Nothing sent.

**What this branch does.** Inbound `sms_in` marks that person's non-opt-out `crm_suppressions` rows cleared (`cleared_at` / `cleared_by` / `cleared_reason`). STOP / bounce / complaint / unsubscribe / GPC stay. START still deletes only `sms` + `stop-keyword`. Durable tag `industry:contact` plus existing realtor/vendor tags and exact industry stages exclude people from every bulk, drip, list, ad, and marketing send. The 1:1 admin composer ignores the industry flag. Backfill script `scripts/crm-reclass-import-hard-stops.ts` is dry-run by default; `--apply` is for Matt after merge.

**Not this change.** Do not apply `20261013180000_crm_suppressions_cleared.sql` to hosted Supabase from this session. Do not run the backfill. Do not refresh the G16 snapshot against live. Do not send.

Skills read: `.cursor/rules/git-commit.mdc`, `AGENTS.md` CORE RULES.

## Earlier — 2026-10-12 (Grok, ask-in-band stands when the price already does)

Surface: Grok. Branch `fix/cma-ask-in-band-sentence` in `/Users/matthewryan/RyanRealty-wt-ask-sentence`, cut from origin/main `874435e73`. Matt merges the PR. Nobody pushes main. Nothing rebuilt, nothing sent, nothing approved.

**What this commit does.** An expired CMA whose recommendation is already under the last ask, and not more than 15% under, is no longer held because that ask sits inside the sales band. Exactly 15% under is not a hold. A stored ask-in-band kind does not block approve or the send gates in that case, and the letter uses the recommendation headline. When the ask is inside the range and strictly below the high, the ask story adds: "One of the sales that set this price is above that ask." Prices and the band do not change. The email body does not change. Ask-below-band stays held. A recommendation that is missing, equal to the ask, over it, or more than 15% under stays held.

**Not this change.** Do not merge the phase-pool branch `fix/cma-phase-match`. Do not merge PR 488 or 489. Do not rebuild these letters to re-pick comps. A full rebuild re-picks sales and can move the price. The live page and the PDF render from render_args, so this prose lands on deploy. Do not send until Matt has merged, production is running this code, and the next weekday 9:03 AM PT window. Do not resend the 2026-10-11 letters (the 13, Aldrich, Mahogany). Do not send Monterey Mews. Do not email designing4you@msn.com. Do not send company-owned cold outreach. Do not send homes more than 15% under, the six whose ask is under every sale, 23 Benaiah, 2545 Awbrey, or 466 Flagline. Do not rebuild McCann.

**Still open.** Do not pop git stash `plat-walk wip 2026-10-09`. Do not restart the 144-home fleet. Whole-plat pool stays on `fix/cma-whole-pool` in the primary checkout. Do not rebuild `cma-120-sisemore` unless Matt asks. Schaeffer stays outside Boyd Acres. Do not add Parks At Broken Top as a Broken Top alias. Oakview stays a hold on this branch. Keats and Remarkable stay delivered.

Skills read: `.cursor/rules/git-commit.mdc`. The change follows AGENTS.md rules 3, 7, 9, 11, and 17, and Matt's 2026-10-12 stand-behind call.

## Earlier — 2026-10-11 (Grok, company-owned cold outreach hold)

Surface: Grok. Landed on main at `4812c989c` via PR #486. Production deploy READY. Nothing rebuilt, nothing sent, nothing approved. Do not email the inbox that replied on 3802 Petrosa. Do not send an apology. Do not re-send 61579 Lucia.

**What this commit does.** A cold expired or FSBO send refuses when the county legal owner is a company (LLC, L.L.C., LP, L.P., LLP, L.L.P., Inc, Incorporated, Corp, Corporation). The check reads the legal-owner sentence, not the skip-trace person. Family trusts, trustees, and estates still send. The refusal is on the send rail, the email intro, and the text intro, before the claim. Both drains dequeue `company-owned` so the queue does not stall. Intake still builds the CMA. Asked CMAs (seller form, place page, lead form, broker, BPO) are not held. A missing legal-owner sentence does not hold. A failed notes read refuses the cold send. The prospect row carries `enrichmentNotes` from `enrichment_notes`, so that send path typechecks.

**The miss.** County owner of 3802 Petrosa and 3063 Brownstone is PAHLISCH HOMES AT PETROSA LP. Skip trace kept the first email and those two letters went Sunday 2026-10-11. The recipient replied it was not her home. That inbox is suppressed (crm_suppressions id 15645, person 61033, channel all, reason wrong-party). 1355 Ochoa is PAHLISCH HOMES AT COLLIER LLC and was not sent. 61579 Lucia is LUCIA ST LLC and already went.

**Still open.** Do not pop git stash `plat-walk wip 2026-10-09`. Do not restart the 144-home fleet. Whole-plat pool stays on `fix/cma-whole-pool` in the primary checkout. Do not rebuild `cma-120-sisemore` unless Matt asks. Do not rebuild McCann until 20 McCann unit 5 and 26 McCann #2 are checked. Schaeffer stays outside Boyd Acres. Do not add Parks At Broken Top back as a Broken Top alias. Oakview stays a hold. Keats and Remarkable stay delivered.

Skills read: `.claude/skills/tdd/SKILL.md`, `.cursor/rules/git-commit.mdc`. Database shape from `docs/DATABASE_SCHEMA_SNAPSHOT.md` and `supabase/migrations/20260610010000_crm_core.sql`.

## Earlier — 2026-10-10 (Grok, whole plat pool)
