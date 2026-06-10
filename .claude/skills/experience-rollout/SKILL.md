---
name: experience-rollout
description: Run ONE quiet, serial revolution of the Ryan Realty Experience System rollout — migrate the next page family to the v3 archetype language, or fix a regression, or wait silently on Matt's review. Use when Matt says "continue the experience rollout", "/experience-rollout", or a /loop firing carries this protocol.
---

# Experience Rollout — one revolution per invocation

Mission (Matt, 2026-06-09): "thoroughly polished, much smarter UI/UX, more interactive with better information, keep users here, track them and make it better, no inconsistencies, never regress, we must have the best." The mechanism: SIX page archetypes in the approved v3 design language (see `docs/EXPERIENCE_SYSTEM.md`), every route migrated family by family.

## The optimized-loop contract (lessons from the first loop — binding)

1. **ONE builder at a time.** Never run parallel background agents. A revolution does exactly one unit of work.
2. **ONE message per revolution, maximum.** Either a family review (3–5 plain sentences + open the before/after screenshots natively with `open`) or a single status line. No notification storms. If there is nothing to say, say nothing beyond the status line.
3. **The ledger is the truth.** `docs/EXPERIENCE_SYSTEM.md` § "Rollout status" holds: current family, state (building / awaiting-review / approved / shipped), what shipped when, and Matt's calibration notes. Update it EVERY revolution so "where are we" is answerable by reading one table.
4. **Never nag.** If waiting on Matt's review: one status line at most, then sleep long (3600s heartbeat). His silence pauses the rollout indefinitely; that is correct behavior.
5. **Session frays — persist state.** Anything learned (a calibration note from Matt, a gotcha) goes into the ledger or this skill file, never only chat.

## Revolution protocol (run top-down, stop at the first step that acts)

0. **Read state**: the ledger section, `git status --short` (know what's draft vs shipped), latest Matt feedback in conversation. Honor any new calibration note by appending it to § Calibration below (and the ledger) before acting.
1. **If Matt just gave a verdict** ("ship it", "change X") → act on it: ship the approved family (stage ONLY that family's files + its parity contract, commit with `Approved-by: matt`, `git pull --rebase --autostash`, push, watch the deploy READY, run the family's smoke, update ledger) OR apply the change and re-present one review.
2. **If a regression exists** (nightly e2e issue, smoke failure, red gate on main, deploy not READY) → fix it first, whole-class + gate, ship per the continuous lane, update ledger.
3. **If awaiting Matt's review** → one status line, sleep (3600s).
4. **Else migrate the NEXT family** (strict queue order below): launch ONE background builder with the full canon chain — reuse `components/site/experience/*` modules; archetype per `docs/EXPERIENCE_SYSTEM.md`; parity.json updated to the NEW contract in the same change (gates enforce the destination, never the past); tsc + `npm test` + `npm run ci:gates` green; BEFORE ship also run a real `npx next build` against the STAGED set (the nav_interact escape: local checks see the working tree, the deploy builds the commit — a builder's code must never reference files outside its staged file set); desktop 1440 + mobile 390 screenshots (animations-off pattern, `scripts/_shot-homepage-v3.mjs`) + a production BEFORE shot of the same route. When the builder's notification returns: verify its claims yourself (run the gates, eyeball the screenshots via Read), then present the ONE review and set state awaiting-review.

## Family queue (one per revolution, this order — reordered 2026-06-10 per Matt: "home page is still lame and many of the custom search pages have thin content")

1. communities/[slug] + menu — SHIPPED 58f95ff4 + b94c29af, LIVE and verified.
2. HOMEPAGE (app/page.tsx) — implement the approved homepage-v3 concept with the shipped experience kit. IN BUILD.
3. Search-preset content depth — every preset/intent search page (price bands, lifestyle, keyword presets the menu links) gets the experience treatment PLUS destination-page depth: live segment stats band, short honest editorial intro, FAQ + schema, internal links. These are thin filter grids today; they should be programmatic-SEO destinations.
4. cities/[slug] + cities index — BUILT, awaiting Matt's verdict (review delivered).
5. cities/[slug]/[neighborhoodSlug] (13 Bend neighborhoods).
6. listing/[listingKey] (the money page — extra care: keep every lead CTA + JSON-LD; content smoke must stay green).
7. Hubs: /buy, /sell, /homes-for-sale shell, /videos, /housing-market + reports.
8. Tools: mortgage/rental/appreciation calculators.
9. Content: /blog, /guides, /faq, /about, /team.
10. LPs last (they convert today; touch only with explicit approval).

## Calibration (Matt-locked design rules — append, never delete)

- No tile walls: never two card-grids in a row; prefer ledger rows (full-width, hairline rules, price huge in Amboqia, photo bleeding off-edge), asymmetric one-big+supporting compositions, split-scroll spines (pinned media beside flowing content), full-bleed map/video breaks, overlap/layering between sections.
- Exciting + interactive, brand-restrained: count-up numerals on first view, scrubbable price-history, map↔list linked hover/filtering, inline payment slider, live pulse ticker. Respect prefers-reduced-motion. No carnival.
- Data as identity: live numbers in Amboqia display type ARE the design; tabular numerals; live-dot freshness cues; §0 honesty (every figure from the DAL, honest empty states, never invented).
- Navy #102742 / cream #faf8f4 only; Amboqia display + Geist body; sentence case; no banned words; no emoji; no sliders/carousels.
- Engagement tracking (`useEngagementTracking`) on every section so "track them and make it better" is real.
- MARKET REPORTS MUST BEAT THE BEACON REPORT BY A LOT (Matt 2026-06-10): Beacon Appraisal's monthly PDF is the local market-data institution. Our market surfaces must be decisively better: live + neighborhood-deep where they are monthly + city-level, plain-English where they are appraiser tables, and the charts must be next level — engaging, animated, annotated story-charts a normal person reads in seconds, every figure §0-verified. Family brief: docs/EXPERIENCE_SYSTEM.md § "Beat-Beacon brief". CONFIGURABILITY IS FIRST-CLASS (Matt 2026-06-10): the user easily selects MULTIPLE YEARS and configures the report in any manner they want — geography (city/neighborhood/community), metric set, period grain (monthly/quarterly/annual), and side-by-side year comparison. Every configuration: §0-accurate (each rendered figure traces to the cache, honest axes always), URL-addressable (a configured view is a shareable link), exportable as the print-grade artifact, and super engaging per the chart system. The explorer foundation exists at /reports/explore — it gets rebuilt to this bar, not patched.
- HOMEPAGE IS MAX EFFORT (Matt 2026-06-10: "this is the face of our business it must go max"): the homepage never ships from a builder pass alone — the orchestrator personally runs an elevation pass (type scale, spacing rhythm, motion timing, interaction feel, section-by-section judgment vs the approved concept) and a design critique before Matt sees it. It must measurably beat every competitor homepage in the comparison battery or it iterates before review.


## Competitive verification (Matt directive 2026-06-10 — every family, before ship)

"We are the best and it must be verified against our competitors." Each family review includes a comparison artifact BEFORE the ship verdict: (1) screenshot our new page next to the equivalent page at 2-3 named competitors — local brokerages (cascadehasson.com, stellarrealtynw.com, durenrealty.com or whoever ranks for the query) AND one portal (zillow.com/redfin.com equivalent surface); (2) a 6-10 row feature table: what each shows that we do/do not (live data, boundary maps, video, interactivity, lead hooks, load feel); (3) Lighthouse mobile perf score ours vs theirs (npx lighthouse --quiet); (4) one honest sentence: where we now lead, where we still trail. The review is not complete without it; "we are the best" is a measured claim, never an asserted one.

## Hard limits (unchanged, absolute)

Draft-first for consumer-visible ships (per-family approval); infra/fix lane ships continuously per Matt's standing go. Never publish social content, never OAuth, never spend, never touch app/lp/** conversion paths without explicit per-action approval. Single checkout, `main` only. Stage surgically — the tree carries other sessions' work.

## Loop pacing (when fired via /loop dynamic)

After the revolution: ScheduleWakeup with prompt `/loop Run one revolution of the Experience Rollout protocol: READ .claude/skills/experience-rollout/SKILL.md fully and execute exactly one revolution per its protocol.` — delaySeconds 3600 when awaiting Matt, 1500 as builder-fallback (the builder's completion notification is the real wake signal). Stop entirely (no re-arm) the moment Matt says stop.

## GRIND SEMANTICS (Matt directive 2026-06-10 — overrides any "one iteration" language above)

**A firing does not stop after one increment.** Chain iterations back-to-back — ship one, immediately pick the next — until one of these is true: (a) every remaining increment is blocked on Matt's review or an external dependency, (b) nothing actionable remains, or (c) the session's context is nearly spent — then finish the in-flight commit, write the handoff, and spawn a fresh session that keeps grinding (per memory `feedback_continuous_work_and_handoff`). Sleeping between wake-ups is for the BLOCKED state only. "Did something then stopped" is the named failure mode this section exists to prevent. Time is of the essence — Matt should never find a loop idle while unblocked work exists.
