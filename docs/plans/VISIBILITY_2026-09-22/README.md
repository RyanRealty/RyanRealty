# Visibility mission, 2026-09-22/23: state and resume

Nodes: none (whole-system visibility pass; fix classes land on PR #352, and anything not finished here is listed below with its branch)

Matt's objective (2026-09-22): be seen by search engines and AI answer engines, then convert, as organically as
possible. Matt 2026-09-23: nothing from the past is permanent; a rule that keeps us from the goal gets evaluated and
changed (the four §1 approval classes, §0, fair housing and MLS rules still bind). Standing contracts from the same
day: every known contact is identified on every visit (identity loop, package p07), and multi-phase subdivisions
always group under one main page (subdivision families, package p02).

## Resume here (read this first)

1. **Landed so far** on `claude/admiring-feynman-7lgwc3` (draft PR #352): the GTM bootstrap syntax fix (browser GA4
   dead since 2026-09-17), AnimatedNumber settles on mount (no $0/0 in server HTML), sitemap hygiene (105 dead /zip
   URLs, redirect sources, dedupe), web-vitals path filter, MLS name truncations withheld, permission allow-list in
   `.claude/settings.json`, 44px footer city link and /team carousel arrows. PR #352's CI still needs the
   "Old Bend" atlas chip pairing fix (ci:tap-targets, see p13 follow-ups).
2. **Fifteen fix packages** were in flight as parallel agents in worktrees. Each one's full spec is in
   `packages/<pkg>.md`, the binding brief is `FIX_BRIEF.md`, the verified evidence is `evidence/`. Each worktree's
   state (committed and uncommitted) is snapshotted to `origin/claude/admiring-feynman-7lgwc3--wip-<pkg>`.
   The snapshots are NOT verified; a resuming agent checks out its branch, reads its spec, finishes, verifies
   (path-scoped vitest, eslint, the gates that read its files) and commits.
3. **Same session, same container:** the agents' worktrees are still at `.claude/worktrees/agent-<id>`; message each
   agent to continue (their transcripts persist), or run `resume-workflow.txt`.
   **New session or lost container:** run the Workflow tool with `scriptPath:
   docs/plans/VISIBILITY_2026-09-22/resume-workflow.txt`. It gives each package to a fresh agent in its own worktree,
   starting from the package's WIP branch, then a verifier per package, and returns branch names to merge.
4. **Merge order** into `claude/admiring-feynman-7lgwc3`: p04, p09, p08, p15, p03, p14, p01, p02, p13, p05, p12,
   p06, p07, p11, p10 (canon last, it touches the handoff and process docs everyone reads). After merging: `npx tsc
   --noEmit`, `npm run ci:gates`, `npm run test:unit`, `npm run gates:stamp`, push, update PR #352's body.
5. **DB writes still owed** (only through a non-MCP path; see p09's report for the method it found): refresh
   `place_membership` and the market-metric computes, then schedule it daily (p09); apply the migrations p07, p09,
   p11 write. Do not re-run the four stopped seller enrollments (that would email real people now).
6. **Helper for DB reads without MCP prompts:** `sb-read.mjs.txt` in this folder (copy it to a scratch dir as sb.mjs; supabase-js with the service-role env,
   `createRequire` on the repo's package.json). Copy it to a scratch dir and import `{ sb, count, rows, all }`.

## Packages

| Pkg | Scope | Evidence IDs | State at snapshot (2026-09-23 02:40Z) |
|---|---|---|---|
| p01 search-honesty | fabricated area slugs fail closed; browse/plat twin canonical; empty browse pairs; place-type sitemap leg; /homes-for-sale/bend 0 impressions | SEO-1, SEO-6, EXP-2, EXP-4, EXP-6, gsc-trend-5 | uncommitted work, 30 files |
| p02 subdivision-families | automatic phase-family grouping, family page owns the name, A-Z /subdivisions directory, plat title noise, count wording | Matt 09-23, SEO-7, SEO-4, EXP-3, EXP-7, VOICE-8, gsc-trend-4 | uncommitted work, 38 files |
| p03 plat-500s | deterministic plat 500s (elkai-woods, blakley-heights, saddleback...), generateMetadata fallbacks, warmer | DATA-6, DATA-1, SEO-2, AEO-3, EXP-7 | uncommitted work, 26 files |
| p04 copy-source-lines | source-line identifiers and cut prices, machine templates, one Bend count wording, phone on one line | VOICE-2, VOICE-6, VOICE-7, UXLIVE-7 | 1 commit (source lines) + more uncommitted |
| p05 chrome-links | chrome links to indexable URLs, luxury link, orphan pages, chrome-link gate, mobile phone in header, AdSense Auto ads off | UXLIVE-4/5/8/13, EXP-11 | uncommitted work, 41 files |
| p06 crm-intake | contact honeypot + suspect quality tag, seller merge key, %first% guard, human-touch stamp, door-label source, suppressed-SMS skip | FUNNEL-1..8, TRACK-8 | staged, commit hook was running |
| p07 identity-loop | signed person token on every outbound link, back-stitch, automation flag, admin activity view, gate, GA4 MP session fields | Matt 09-23, TRACK-1, TRACK-4, FUNNEL-4 | uncommitted work, 57 files |
| p08 tracking-hygiene | /_next/image redirect, web-vitals clamps, deploy parse check, GA4 mirror labels + settle window, silent-zero by scope, GA4 health guard | TRACK-1/2/3, gsc-trend-8/9 | uncommitted work, 29 files |
| p09 data-pipeline | place_membership refresh + schedule + freshness flag, hourly refresh-mvs duplicate, neighborhood MoS NULL, amenity medians | COMP-3, DATA-2/3/7/8 | 1 commit (place_membership schedule + scoreboard flag) + more |
| p10 loop-canon | RUN_LOOP.md, objective = visibility then conversion (taste a floor), canon contradictions, one handoff Current block + gate, voice gates per VOICE.md, push wrapper runs tests | PROCESS-3/5/6/7/8/9, UXLIVE-11, gsc-trend-3 | uncommitted work, 55 files |
| p11 weekly-measurer | GSC page x query store, weekly cron seeding GSC-gap nodes, Learn path fix, close 7 expired ledger windows, brief deltas, May backfill | PROCESS-1/2, TRACK-5/11, gsc-trend-1/2/12 | uncommitted work, 30 files |
| p12 aeo | neighborhood JSON-LD equals visible figures, FAQ plain answers, broker names on /about, sameAs, brand in homepage title, llms.txt, citation battery cron | AEO-1..9, VOICE-5, COMP-8, gsc-trend-11 | uncommitted work, 64 files |
| p13 payload | atlas dots out of the RSC payload, cluster pill median, payload gate, Old Bend chip pairing (PR #352 CI) | UXLIVE-3/6, SEO-10, DATA-5 | uncommitted work, 43 files |
| p14 listing-urls | 308 listing URL variants to canonical, stable canonical | gsc-trend-6 | uncommitted work, 20 files |
| p15 crawl-monitor | daily crawl probe cron (sitemaps, class samples at concurrency 8, inline-script parse, GSC Sitemaps API) | gsc-trend-7, SEO-2, SEO-9 | uncommitted work, 15 files |

Follow-up instructions sent to agents after launch are in `FOLLOWUPS.md` and bind like the spec.

## Why the site slips (verified; figures and sources in evidence/)

1. The loop could not see ranking: the benchmark was 153 of 153 rank-tracker quoted queries (0 clicks), site_signal
   kept the top 25 pages/queries a day (4.9% of impressions), the scoreboard said GSC "ok" from a row count, and Learn
   wrote false zeros on 8 of 12 windows. No cloud measurer ran; the site queue optimized a taste score no class reached.
2. Money pages lost ground: community pages dropped 3 to 14 positions on their own names since July (brasada-ranch
   p21.6 to p35.8, split over 65 URLs); city and 'homes for sale {city}' queries never ranked; /homes-for-sale/bend had
   0 impressions 09-06..09-21; 16.8% of listing keys were seen under more than one URL.
3. The crawl surface carried pages that should not exist or did not work: fabricated area slugs indexable; ~59% of
   1,815 sitemapped browse pairs empty; 651 plat twins; ~5.5% of plat URLs a persistent 500; 1,716 plats orphaned;
   105 dead /zip URLs; place pages 0.9 to 4.7 MB of HTML.
4. Served HTML carried wrong information: $0/0 figures; neighborhood JSON-LD figures that differ from the visible page;
   place_membership stale since 2026-08-23, so 174 of 752 active Bend single-family listings had no membership and the
   Bend verdict read 3.30 months "seller's" where the full set gives 4.28 "balanced" (p09 owns the refresh).
5. Measurement was blind: browser GA4 dead 08-19..08-31 and from 09-18; the server mirror made GA4 sessions "(not set)";
   RUM 45 to 70% junk rows from dead /_next/image URLs.
6. Conversion leaked: ~74% of site lead arrivals were bots; 254 alert texts to Matt in 7 days; the seller drip never
   sent to a site seller (merge key); 73 of 76 buyer drips halted at the SMS-consent step; 90 of 8,745 sessions in 7
   days tied to a known person.
7. Process lost work: 114 open PRs waiting on one person, 52 stacked handoff blocks, contradicting canon, main pushed
   red with hooks bypassed.

## Decisions still Matt's (with the recommendation)

- Sequence email copy that reaches real people (buyer step 0 says "your listing alerts are live" to contact-form
  inquiries): approve the rewrite p06 drafts.
- Whether to re-run the 4 stopped seller enrollments now that the merge key is fixed (recommend yes for the one real
  seller from 2026-09-14, no for the internal alias and the vendor pitch).
- GA4 Measurement Protocol mirror: keep with session/attribution fields (p07) or retire.
- Captcha (Turnstile) on /contact and the alerts sheet if the honeypot and classifier do not stop the bots.
