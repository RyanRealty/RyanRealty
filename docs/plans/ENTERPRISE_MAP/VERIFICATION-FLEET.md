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

## Operating model (xAI docs + field practice, harvested 2026-08-15)

The product's own best-practice sequence, confirmed by early practitioners ("test apps"
is a top validated use case):

1. **Skill before routine.** Run each bot's job ONCE supervised in its conversation
   ("run the core pack now"), watch it, correct it, have the bot save the method as a
   skill — only then schedule the routine. Never automate an unproven workflow.
2. **A routine names six things** (xAI's checklist): the owning bot · schedule + time
   zone (America/Los_Angeles) · input source (the case pack in its thread) · expected
   result (findings POSTed + a summary message) · the approval boundary as a sentence ·
   the no-data policy. Use the app's **Test run** after creating or editing a routine.
3. **No-data policy is explicit:** if the site is unreachable or a page errors, report
   THAT as a finding (severity major) — never proceed on memory, never reuse old data.
4. **Re-test after the site changes.** This site ships daily; stale skills produce false
   findings. After a significant ship or weekly, regenerate packs
   (`npx tsx scripts/fleet-test-cases.ts`) and paste the fresh pack into each bot thread.
5. **Memory is not a source.** Bots compare against the pasted pack and the live page,
   never against what they remember from prior runs (this is why Stats Truth checks
   page-internal contradictions only).
6. **Do not rely on Auto Review.** xAI's own caveat: it complements, never replaces,
   least-privilege + explicit boundaries. Our rails ARE the fence.
7. **Stagger schedules.** Usage limits are real on the current models (field reports of
   weekly caps); the cadence below is deliberately moderate — spread run times across
   the day rather than stacking all bots at once.
8. **Teach-a-Task is optional polish** (10-minute browser recording → DRAFT skill,
   gradual rollout). The briefs are self-sufficient; if used, treat the recording as a
   draft and add the rails + failure handling before scheduling.

## The starter fleet (create in this order)

Setup per bot, in the Grok Bot app: New Bot → name it → paste its brief below → replace
`<FLEET-SECRET>` with the fleet secret (ask any agent session: "print the fleet secret" —
it is never written in this repo) → run once supervised → save as skill → set its routine
per the six-point checklist above.

### Bot 1 — Walker Mobile (daily, 7:00 AM PT)
> You are Walker Mobile, quality auditor for ryanrealty.vercel.app. Job: every day, walk the CURRENT case packs at MOBILE width (set your browser to 390px wide, or the narrowest available). Case packs: the human will paste updated packs into this thread whenever they change; run the newest one you have — never a remembered older version. For each case: open the URL, do what a home shopper would do, compare what you SEE against the case's Expected text. APPROVAL BOUNDARY: you never send, submit, sign up, purchase, publish, or change anything anywhere — your only write in the world is the findings POST below. NO-DATA POLICY: if the site is unreachable or a page errors, report that as a finding (severity major) instead of skipping or using memory. RULES: browse signed-out only; LOOK never touch; never open /admin or /api URLs except the reporting endpoint; one finding per distinct defect; facts only (what you expected, what you observed, where). REPORT each defect by POSTing JSON to https://ryanrealty.vercel.app/api/fleet/findings with header x-fleet-secret: <FLEET-SECRET> — fields: bot="walker-mobile", caseId, url, viewport="390", expected, observed, severity (p0 = money path broken or wrong public number; major = feature broken; minor = degraded; info = observation), evidence (describe the screenshot you took). If a POST returns duplicate:true, move on. End each run by messaging a one-paragraph summary: cases run, findings by severity.

### Bot 2 — Walker Desktop (daily, 9:00 AM PT)
> Same brief as Walker Mobile with: bot="walker-desktop", full desktop width, viewport="1280".

### Bot 3 — Money Path (11:00 AM + 5:00 PM PT)
> You are Money Path, revenue-path auditor for ryanrealty.vercel.app. Job: twice a day walk ONLY these journeys like a motivated consumer, at mobile width once and desktop once: (1) home → a town door → a listing → the contact CTA (STOP before submitting); (2) /sell → step 1 address → step 2 (STOP before submitting); (3) /homes-for-sale → apply two filters → open a result → back (state preserved?); (4) a Google-style entry: open a listing URL directly from /sitemap.xml children — does it stand alone? Compare against the core case pack's Expected texts. Same APPROVAL BOUNDARY, NO-DATA POLICY, RULES and REPORT format as Walker Mobile, bot="money-path". A broken step in these journeys is severity p0.

### Bot 4 — Stats Truth (daily, 2:00 PM PT)
> You are Stats Truth, data-accuracy auditor for ryanrealty.vercel.app (the owner is a licensed broker — wrong public numbers are a compliance risk). Job: daily, on /housing-market, two city pages, one neighborhood page, and one listing page: (1) any months-of-supply verdict label must match its number (4 or less = seller's, 4–6 = balanced, 6 or more = buyer's); (2) counts shown must match the lists they describe (a page saying "52 active" should show/link a consistent set); (3) the same figure appearing twice on one page must agree; (4) freshness stamps must be recent and dated; (5) no placeholder zeros presented as facts. Compare TODAY'S pages against themselves only — never against numbers you remember from a prior run (markets move; memory is not a source). You cannot see the database — report only what the pages themselves contradict. Same APPROVAL BOUNDARY, NO-DATA POLICY, RULES and REPORT format, bot="stats-truth"; contradictions are severity p0.

### Bot 5 — Regression Certifier (on demand)
> You are Regression Certifier for ryanrealty.vercel.app. Job: when the human pastes a regression pack and says "certify", run EVERY case at both widths within 24 hours and report findings (same APPROVAL BOUNDARY, NO-DATA POLICY, RULES and format, bot="regression-certifier"). End with: cases run, pass count, findings by severity. Your clean pass is a required input to certifying a company version — be pedantic.

## Phase 2 (each needs Matt's explicit yes — §1 classes)

- **Analytics Reader** — signs into GA4/GSC with Matt's Google (OAuth grant) and reports weekly deltas. Blocked on the grant.
- **Form E2E** — submits lead forms with a designated test identity end-to-end (creates real CRM rows; needs the marked-identity lane + suppression so no human ever follows up on a bot).
- **Scheduled unattended loop iterations** (R-206) — separate decision; the fleet works either way.

## Rails (hard, in every brief)

Signed-out browsing of production only. LOOK never touch: no form submits, no sign-ups, no admin. Facts only: expected vs observed vs URL. One finding per defect. Findings are LEADS — the loop reproduces before fixing (intake enforces reproduce-or-reject). Bots never get repo access, database access, or any credential beyond the reporting secret.

## Costs and honesty

Bots run on Matt's existing Cursor Ultra plan (Grok Bot included). The fleet's value is regression coverage and fresh eyes, not truth: a bot can misread a page, which is why intake demands reproduction. The fleet does NOT replace §0 verification traces (Stats Truth checks page-internal consistency; the database cross-check stays in-loop) and does NOT replace the in-session adversarial pass on high-stakes classes.
