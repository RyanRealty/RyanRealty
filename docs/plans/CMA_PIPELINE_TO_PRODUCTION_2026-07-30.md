# CMA pipeline to production grade — end-to-end goal (2026-07-30)

**Mission:** close every open engineering item on the CMA/audit/BPO pipeline so a real
user (Matt, or a broker on his license) can walk in, look at the queue, and act on it
without an engineer explaining what to ignore.

Started from the state at `4b581ff2`: 206 live documents, 184 rebuilt on corrected comp
logic, **164 flagged `needs_review` so only 38 are publishable**, 13 unbuildable, and
4 documents ever actually delivered.

## What exists when this is finished

1. **A `needs_review` flag that discriminates.** Today it fires on 82% of documents, which
   means it carries no information and blocks the publish funnel wholesale. Two causes are
   in scope: the judge applying its own exclusion criteria inconsistently (it excluded
   $676-801/sqft comps as premium tier while keeping one at $631/sqft on 922 Ogden), and a
   binary publish gate that treats a `[minor]` narrative nit the same as a `[critical]`
   unsupported price.
2. **A publish gate keyed to severity.** `critical` blocks — a number the system itself
   calls unsound never reaches the public web (§0). `major` flags for broker review but
   does not block. `minor` is advisory. The refusal reasons stay in plain language in the
   admin UI, and nothing auto-publishes: Matt still clicks.
3. **An auditable comp trace.** Tier-by-tier candidate counts and exclusion reasons persist
   into `build_summary`, so "why did this document get these comps" is answerable from the
   row instead of re-derived by hand.
4. **Every document either builds or states why it cannot.** The 13 current failures are
   resolved or carry an explicit, honest reason a broker can read.
5. **Integration tests that do not write to production.** 17 `zztest` rows were archived
   today; that was cleanup, not a fix.
6. **Page files under their size budget by extraction**, not by comment trimming — the
   neighborhood, city, and community pages sit exactly at the ceiling.

## What a real user does with it

Opens `/admin/cmas`, sees a queue where the flag means something, opens a document, reads
why it is or is not publishable in plain language, and either publishes it to the listing
page or sends it. Nothing in that path requires knowing which warnings to ignore.

## The bar

- Every claim verified against the live database or a real browser, never inferred from a
  passing unit test (§8, and the standing "verify everything shipped" rule).
- `npm run ci:gates` green, full unit suite green, pushed to `main`.
- The corpus rebuilt on final logic and the resulting flag rate **measured**, not predicted.
- §0 holds throughout: no number ships without a source, and a document the system cannot
  defend does not become publishable just because the rate looks better.

## Explicitly OUT of scope

**Turning outreach on.** Sending to real people is §1 per-action approval and Matt has
said manual for now. This mission makes documents worth sending; it does not send them.

---

## Progress log

- `b4201635` — goal written (`4b581ff2` was the starting point).
- `1d36f617` — **severity-aware publish gate.** Critical blocks, major/minor surface as
  concerns. Closed a live §0 hole: 25 documents were publishable while carrying a critical
  "the recommendation is not supported by the adjusted comps", because
  `computeAuditVerdict` treats price-opinion as broker judgment and `needs_review` stayed
  false. Net effect is STRICTER, not looser: quality-clause publishable 42 to 17.
- `ab9c5f3d` — **place-page extraction.** city 695→549, neighborhood 598→512, community
  1029→923. Verified in a real browser: Bend 501 active, River West 40, Tetherow 43,
  Three Rivers 88, zero console errors.

### Correction to the goal's own framing

The goal said "164 flagged so only 38 are publishable". **That was wrong.** 38 is the
`needs_review`-clean count, not publish eligibility. Actual publishable was **2**: 199 of
206 documents are `draft` status and 182 are `expired-audit`, which can never reach a
listing page. The binary flag was never the dominant blocker on the funnel.

### What actually drives the 82% flag rate — measured, not assumed

If every comp-selection finding vanished, **57% of the corpus would still be flagged**.
First gating cause on flagged documents: critical data-integrity 71, critical
comp-selection 62, two-or-more comp-selection majors 13, major data-integrity 10, critical
narrative 2. The critical data-integrity findings are almost all SITE-record
contradictions — "Septic: none-found" on a habitable dwelling, "Water: unknown",
district-held water rights presented as private. **That is the county/site resolver
(`lib/cma/county.ts`), not the comp engine.** It is the highest-value remaining lead and
was not in this mission's scope.

A real defect the judge work surfaced, now routed: the judge applies its own price-tier
exclusion inconsistently on **66 of 183 documents (36%)** — a comp excluded on price tier
at a $/sqft the same judgment also kept.

### BLOCKED — named credential

**`ANTHROPIC_API_KEY` has hit its usage cap: "You will regain access on 2026-08-01 at
00:00 UTC."** Confirmed independently, not inferred from a subagent report. The judge and
the adversarial audit both run on it, so **no CMA can be rebuilt and the final flag rate
cannot be measured until the cap resets.** Subagents are unaffected (they bill under the
Claude Code plan), so code work continued.

Deferred to 2026-08-01: the corpus rebuild on final logic, the before/after flag-rate
measurement, and the judge cost measurement (estimated ~1.5x, worst case ~2.2x,
UNVERIFIED). The A/B harness is at `scratchpad/jab.mts` + `drive.sh` and resumes from its
own jsonl.

The judge consistency contract is therefore **shipped but unproven end to end.** It is
unit-tested and one live pre-cap run was correct on the first pass at $0.019, but there is
no measured before/after flag rate. Do not describe it as validated.
