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

## Progress log

- `4b581ff2` — starting point. Goal written.
