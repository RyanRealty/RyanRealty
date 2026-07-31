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

---

## Final state (all six workers merged, `d38668c2` pushed)

190 gates green · 346 test files / 4365 tests · `tsc` clean.

| Commit | What |
|---|---|
| `1d36f617` | Publish eligibility keys on finding severity |
| `ab9c5f3d` | Place-page extraction, three files off their ceiling |
| `3c78ec6b` | Int tests can no longer strand rows in production (G59) |
| `b755d48f` | CMA send count no longer inflated by archived rows |
| `57957728` `4d89d32d` | Archived documents out of the admin queue and its KPIs |
| `7a36777f` | The judge must hold to the exclusion rule it declares |
| `b3e1cfd4` | 'N/A' is not a subdivision; a mailing city is not a market; comp trace persisted |
| `d38668c2` | A narrative citing a comp that does not exist is critical |

### Corpus, measured

```
live documents           207
  carry a price          201
  build_error              7
  needs_review           168
  comp_selection trace    36
  publish-blocked        207
  publish-clean            0
  currently published      0
```

**Zero documents are publishable right now, and that is correct.** Every rebuild in this
session ran while `ANTHROPIC_API_KEY` was capped, so the judge and the adversarial audit
both returned null. "No audit" blocks publishing by design, because publishing on an
absence of evidence is the §0 failure mode. The funnel has no inventory until the corpus
is rebuilt.

### Three defects found that were NOT on the original list

1. **`SubdivisionName='N/A'` on 62,974 listings.** The selector queried it literally, so
   'N/A' matched citywide strangers and stamped them `subdivision-6mo` — reports told
   sellers those were same-subdivision sales, and the bogus rung satisfied the comp target
   so the real neighborhood tiers never ran. 21 live CMA subjects affected.
2. **The CMA send count read 9 when the truth was 4**, and the admin queue showed Total 38
   / Delivered 6 / Sent 7 against a truth of 25 / 1 / 2. Archiving sets `archived_at`;
   both queries filtered only on `status`. Found by walking the UI, not by any test.
3. **`buildCma` failed CLOSED on an audit outage.** An authored em-dash in the "audit
   unavailable" note was pushed into `pricing.notes`, which the brand-voice gate throws on
   90 lines later, so any API outage became a total build outage.

### MUST DO after 2026-08-01 00:00 UTC

The cap resets and only then can this be finished:

1. **Rebuild the corpus.** Every current price is deterministic-only, unvetted by the judge
   and unaudited. Nothing should be treated as publishable before this.
2. **Measure the flag rate** before/after the judge consistency contract. It is shipped and
   unit-tested but UNPROVEN end to end. Harness: `scratchpad/jab.mts` + `drive.sh`.
3. **Measure the judge repair fire rate.** Cost is an estimate (~1.5x, worst case ~2.2x).
4. Re-check the 7 `build_error` rows — 4 are genuine (two land listings, two never MLS-listed).

### The highest-value lead, still open

If every comp-selection finding vanished, **57% of the corpus would still be flagged**. The
dominant driver is critical data-integrity from the SITE resolver: "Septic: none-found" on
habitable dwellings, "Water: unknown", district-held water rights presented as private.
**That is `lib/cma/county.ts`, not the comp engine.** It was out of scope here and is the
next mission.
