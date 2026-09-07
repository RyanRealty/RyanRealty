# CMA funnel mission (2026-09-07)

Matt, 2026-09-07: "our cmas still look dumb and need to better convey the information …
i want expired and fsbos automated ASAP … getting these things looking good and approved
and then sent out and tracked so that we can get leads is the goal, every aspect of this
must be optimized … expireds/fsbo/seller valuation/and BPOs all using the same engine but
with their own nuances, easily managed and tracked."

This file is the goal the final review pass is measured against. It supersedes nothing;
`CMA_STATE_OF_THE_WORLD.md` (2026-08-27) is the engine reconciliation and still wins on
engine defects. Code wins over both.

## Where it stood at start (verified live 2026-09-07 11:30)

- `cmas`: 442 rows. Unified queue (`listCmaQueue`): 429 rows — ready 162 (133 with an
  email), build-failed 136, flagged 116, audit-failed 10, sent 4.
- Lanes as recorded: expired 378, unknown 28, seller-valuation 13, lead-form 8, fsbo 2.
  `fsbo_listings.cma_id` links 32 CMAs, so 30 FSBO documents sit in the queue mislabeled.
  212 rows carry a NULL `request_source`.
- `expired_listings`: 420 detected, 377 with a phone or email, 341 with a CMA,
  **0 first-touch sent**. `fsbo_listings`: 61, 32 reachable, 32 with a CMA, **0 sent**.
- Pipeline (traced in code): detection → skip-trace → CRM lead → CMA request → build →
  audit is automatic. Exactly one manual step remains: open `/admin/cmas/[slug]`, Approve,
  then Send now or Schedule. The weekday 8am / 5-minute drip drains the queue after
  Schedule. No auto-send switch exists anywhere.
- Audit verdicts: pass 271, did-not-run 138, fail 10, review 10. Local test run logged
  `[cma/audit] adversarial audit failed: 400 … usage limits` from the xAI path.
- Document: two render paths. Letter (print/PDF) re-renders from `render_args`; the browser
  `?print=1` link serves the frozen build-time blob (stale after any renderer fix). The
  immersive `/view` re-renders live. "How recent sellers sold" and the disclosure page exist
  only in print.
- Tracking plumbing exists (`email_events` keyed `cma:<slug>`, `visitor_events`
  `client-document`, `attributeOutbound` on the send path, `getCmaPerformance`), but the
  queue shows none of it and no reply routes back to the row.

## Done means

A real broker can, on a phone or desktop:

1. Open `/admin/cmas`, see every document from all four lanes (expired, FSBO, seller
   valuation, BPO) with lane, state, their price vs ours, and outcome (sent, delivered,
   opened, clicked, visited, replied) on the row.
2. Open a ready document, read it in under a minute because it answers the seller's
   questions in order (what happened / what it is worth and why / what it competes with /
   what to do), and approve it with one tap that advances to the next ready row.
3. Flip a per-lane **Auto-send** switch (default OFF) so that a ready, audit-passed document
   in that lane goes out without the tap: cold lanes through the weekday drip, asked lanes
   immediately. Audit-failed, unvetted, flagged and build-failed rows never auto-send.
4. See, per lane, the funnel: built → ready → sent → opened → clicked → replied, and get
   the existing broker SMS alert when a recipient replies or opens the document.
5. Trust the numbers: the document the client receives is the same one the broker
   reviewed (`?print=1` and the PDF render from the same source).

Every send still runs the existing gates: suppression, relist/off-market re-verify,
merge-token fail-closed, brand voice, adversarial audit. §1 holds: the auto-send switch is
Matt's control and ships OFF; nothing in this mission flips it.

## Workstreams (exclusive file sets)

| Stream | Owns | Deliverable |
|---|---|---|
| A. Document | `lib/cma/**` renderers, `scripts/cma-lookpass.ts` | A look-pass tool that screenshots every chapter (letter 816, immersive 1280, both at 375) for any slug from `render_args` read-only; then the punch list fixed and re-passed. |
| B. Lanes + auto-send | `lib/cma/origin.ts`, `lib/data/cma/unified-queue.ts`, `lib/cma/worker.ts`, `app/actions/cma-queue.ts`, `app/admin/(protected)/cmas/**`, one migration | `request_source` backfill from the FSBO/expired link tables; BPO in the vocabulary and the queue; `cma_lane_settings` with Auto-send per lane (OFF); worker auto-enqueue when ON; lane filter + counts; Approve-and-next. |
| C. Tracking → leads | `lib/data/cma/getCmaPerformance.ts`, `lib/data/prospecting/engagement.ts`, new `lib/data/cma/outcomes.ts`, new admin component, reply hook | Outcome per row, per-lane funnel, reply/open alert to the broker, verified with a real send to a test inbox. |
| D. Engine health | `lib/cma/audit.ts`, `lib/grok/**`, `lib/pricing/**`, `lib/cma/comps.ts`, `lib/cma/build.ts` | Why 138 audits did not run, fixed; the 136 build failures classed into correct §0 refusals vs selector bugs, bugs fixed, refusals surfaced with a reason the broker can act on. |

## Ledger

Appended by each stream as it lands: commit, what changed, how it was verified.

- **A · 96ea9616** (`wt/cma-doc-20260907`) — `scripts/cma-lookpass.ts`: read-only
  visual look-pass tool. Given `cmas.slug` values, renders the current letter
  (`resolveCmaPrintHtml` → `renderCmaHtml`) and immersive (`immersiveFromRow`
  → `renderImmersiveCmaHtml`) output from `render_args` — same functions the
  live PDF/`?print=1`/`/view` routes call — and screenshots every top-level
  chapter section at 816/375 (letter) and 1280/375 (immersive), plus a
  `contact-sheet.html` per slug. `lib/cma/lookpass-chapters.ts` (pure
  HTML→chapter mapper, unit-tested) backs the stdout summary.
  `immersiveFromRow` exported from `lib/cma/serve-document.ts` (no behavior
  change) so the tool reuses it instead of forking the render_args glue.
  `scripts/lib/server-only-shim.cjs` factors out the tsx module-resolution
  patch already duplicated in three other CMA CLI scripts.
  Ran on `cma-2465-7th-redmond-97756` (expired), `cma-19968` (FSBO),
  `cma-1617-nw-8th` (seller-lp) — all three produced full contact sheets;
  findings below. `npx tsc --noEmit` clean; `lib/cma/` vitest green except
  one pre-existing unrelated real-DB test.

  **What the renders showed (not fixed — Stream A step 1 is the tool):**
  - Immersive "How we got the price" comps table breaks on mobile (375px):
    the leftmost label column collapses to one character per line, running
    the whole comp-grid vertically unreadable, on all three slugs. The
    LETTER path handles the identical data as responsive cards at 375px with
    no breakage — this is isolated to the immersive table markup/CSS.
  - Immersive hero scene (`cma-2465-7th-redmond-97756`): the annotated aerial
    photo's landmark distance callouts ("Duffy's .5 miles", "Walmart 1.2
    miles") run past both the left and right frame edges at 1280px AND
    375px, and a "*Location is approximate…" disclaimer caption is clipped
    at the right edge at both widths.
  - Letter comp card #5 (735 Oak, `cma-2465-7th-redmond-97756`) renders a
    blank white photo box while comps 1–4 have photos — may be a legitimate
    no-photo state or a broken image; not confirmed either way.
