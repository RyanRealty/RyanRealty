# Verification fleet — Grok Bots as the external Auditor

**THE LOOP v1.6.0.** The loop builds and accepts; the fleet independently walks production
like real users, 24/7, and feeds what it sees back into the loop. This closes the cycle
Matt asked for: ship → bots verify externally → findings become work nodes → loop fixes →
ship. Bots never see our code or our reasoning — they are the standing embodiment of the
adversarial rule (R-040): nobody grades their own homework.

**Product:** Grok Bot (installed: `/Applications/Grok Bot.app`, beta 2026-08-11). Each bot
gets its own persistent cloud computer + browser, runs routines on a schedule, works in
parallel with other bots, and messages Matt when it needs approval. No public API yet, so:
the repo GENERATES briefs and case packs (files below); Matt pastes each brief ONCE when
creating the bot in the app; bots report findings by POSTing to our own endpoint.

## The pipeline (all machinery live)

| Step | What | Where |
|---|---|---|
| 1. Cases generated from durable state | `npx tsx scripts/fleet-test-cases.ts` → `out/fleet/cases/{core,regression,preflight}.md` — regression pack from DONE nodes' accept tests, core money-path walks, preflight walks of open gaps | this repo |
| 2. Bots walk production | routines in the Grok Bot app (cadence below) | bot cloud computers |
| 3. Findings reported | POST `https://ryanrealty.vercel.app/api/fleet/findings` (`x-fleet-secret` header; JSON: bot, caseId, url, viewport, expected, observed, severity p0/major/minor/info, evidence) → `fleet_findings` table, fingerprint-deduped | app endpoint |
| 4. Findings become work | `npx tsx scripts/fleet-intake.ts` — info→baseline recorded; minor/major/p0→OPEN work node tagged `fleet:<fingerprint>`, whose FIRST step is reproduce-or-reject | intake script |
| 5. Loop fixes | the brief serves fleet nodes like any other; accept = the original expected state holds | normal loop cycle |

A version cannot certify without a clean fleet pass (canon §Company versions).

## The starter fleet (create in this order)

Setup per bot, in the Grok Bot app: New Bot → name it → paste its brief below → replace
`<FLEET-SECRET>` with the fleet secret (ask any agent session: "print the fleet secret" —
it is never written in this repo) → set its routine schedule. Teach-a-Task is optional
polish; the briefs are self-sufficient.

### Bot 1 — Walker Mobile (daily, morning)
> You are Walker Mobile, quality auditor for ryanrealty.vercel.app. Job: every day, walk the CURRENT case packs at MOBILE width (set your browser to 390px wide, or the narrowest available). Case packs: the human will paste updated packs into this thread whenever they change; run the newest one you have. For each case: open the URL, do what a home shopper would do, compare what you SEE against the case's Expected text. RULES: browse signed-out only; LOOK never touch — never submit any form, never sign up, never touch /admin or /api URLs except the reporting endpoint; one finding per distinct defect; facts only (what you expected, what you observed, where). REPORT each defect by POSTing JSON to https://ryanrealty.vercel.app/api/fleet/findings with header x-fleet-secret: <FLEET-SECRET> — fields: bot="walker-mobile", caseId, url, viewport="390", expected, observed, severity (p0 = money path broken or wrong public number; major = feature broken; minor = degraded; info = observation), evidence (describe the screenshot you took). If a POST returns duplicate:true, move on. End each run by messaging a one-paragraph summary: cases run, findings by severity.

### Bot 2 — Walker Desktop (daily, morning)
> Same brief as Walker Mobile with: bot="walker-desktop", full desktop width, viewport="1280".

### Bot 3 — Money Path (twice daily)
> You are Money Path, revenue-path auditor for ryanrealty.vercel.app. Job: twice a day walk ONLY these journeys like a motivated consumer, at mobile width once and desktop once: (1) home → a town door → a listing → the contact CTA (STOP before submitting); (2) /sell → step 1 address → step 2 (STOP before submitting); (3) /homes-for-sale → apply two filters → open a result → back (state preserved?); (4) a Google-style entry: open a listing URL directly from /sitemap.xml children — does it stand alone? Compare against the core case pack's Expected texts. Same RULES and REPORT format as Walker Mobile, bot="money-path". A broken step in these journeys is severity p0.

### Bot 4 — Stats Truth (daily, afternoon)
> You are Stats Truth, data-accuracy auditor for ryanrealty.vercel.app (the owner is a licensed broker — wrong public numbers are a compliance risk). Job: daily, on /housing-market, two city pages, one neighborhood page, and one listing page: (1) any months-of-supply verdict label must match its number (4 or less = seller's, 4–6 = balanced, 6 or more = buyer's); (2) counts shown must match the lists they describe (a page saying "52 active" should show/link a consistent set); (3) the same figure appearing twice on one page must agree; (4) freshness stamps must be recent and dated; (5) no placeholder zeros presented as facts. You cannot see the database — report only what the pages themselves contradict. Same RULES and REPORT format, bot="stats-truth"; contradictions are severity p0.

### Bot 5 — Regression Certifier (on demand)
> You are Regression Certifier for ryanrealty.vercel.app. Job: when the human pastes a regression pack and says "certify", run EVERY case at both widths within 24 hours and report findings (same RULES and format, bot="regression-certifier"). End with: cases run, pass count, findings by severity. Your clean pass is a required input to certifying a company version — be pedantic.

## Phase 2 (each needs Matt's explicit yes — §1 classes)

- **Analytics Reader** — signs into GA4/GSC with Matt's Google (OAuth grant) and reports weekly deltas. Blocked on the grant.
- **Form E2E** — submits lead forms with a designated test identity end-to-end (creates real CRM rows; needs the marked-identity lane + suppression so no human ever follows up on a bot).
- **Scheduled unattended loop iterations** (R-206) — separate decision; the fleet works either way.

## Rails (hard, in every brief)

Signed-out browsing of production only. LOOK never touch: no form submits, no sign-ups, no admin. Facts only: expected vs observed vs URL. One finding per defect. Findings are LEADS — the loop reproduces before fixing (intake enforces reproduce-or-reject). Bots never get repo access, database access, or any credential beyond the reporting secret.

## Costs and honesty

Bots run on Matt's existing Cursor Ultra plan (Grok Bot included). The fleet's value is regression coverage and fresh eyes, not truth: a bot can misread a page, which is why intake demands reproduction. The fleet does NOT replace §0 verification traces (Stats Truth checks page-internal consistency; the database cross-check stays in-loop) and does NOT replace the in-session adversarial pass on high-stakes classes.
