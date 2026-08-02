# Audit remediation — end-to-end mission

**Source:** `docs/audits/WEBSITE_AUDIT_2026-08-02.md` (PR #28)
**Started:** 2026-08-02
**Branch:** `claude/ryan-realty-website-audit-sybjq3`

## The goal

Every P0 and P1 defect the audit found is fixed in production code, verified against the
running site or a real build, and locked behind a mechanical gate where a gate is what stops
it recurring.

**What exists when finished**

1. All five child sitemaps return valid XML within a normal crawler timeout, and stay warm.
2. Each broker resolves to exactly one indexable URL. Aliases 301 to it.
3. The brand-voice gate enforces the punctuation hard-fails CLAUDE.md §2 declares, and the
   codebase passes it.
4. Every page title fits the SERP display budget, carries the brand once, and contains no
   em dash.
5. No meta description is cut mid-word.
6. `/buyers/` and `/sitemap/` resolve to their correct destinations.
7. The self-serving `AggregateRating` is gone; per-review markup stays.
8. `preconnect` is issued for the image CDN.

**What a real user does with it:** a crawler (Googlebot or an AI agent) fetches
`/sitemap.xml`, follows every child to a complete URL list, crawls each page once under one
canonical URL, and reads a clean, correctly-truncated title and description.

**The bar:** verified against the real thing — live HTTP for site behaviour, a real build or
gate run for code. Not "the diff looks right."

## Scope

**In scope — the audit's "quick wins" block (items 1–8).** All code, all verifiable now.

**Explicitly out of scope**, and why — these are not deliverables a coding session can honestly
close:

| Item | Why not now |
|---|---|
| 9, 10, 11, 15 — dated market pages, answer-shaped H2s, 28 long-form neighborhood articles, FAQ split | Content programs. Each piece needs §0 per-figure verification and lands on public marketing surfaces. Weeks of authored work, not a refactor |
| 17, 18, 20 — press pitching, term ownership, annual review | Outbound to real people. CLAUDE.md §1 approval class 1 — Matt's call, per send |
| 19 — GBP/Zillow/Yelp profiles | Third-party surfaces; needs OAuth grants (§1 class 4) |
| 21 — GSC + GA4 instrumentation | Credentials not present in this environment |
| 12, 13, 14, 16 — JSON endpoint, Dataset expansion, outbound citations, payload reduction | Code-shaped and genuinely doable. Deferred behind 1–8 by impact; revisit if budget remains |

## Workers

Disjoint file sets. Round 2 depends on Round 1 because wiring the punctuation gate before the
violations are fixed would fail the build.

| # | Worker | Exclusive files | Round |
|---|---|---|---|
| A | Sitemap reliability (P0) | `app/sitemaps/**`, `app/sitemap.ts`, `vercel.json` | 1 |
| B | Broker canonicalization (P0) | `app/team/[slug]/page.tsx` | 1 |
| D | Title template + description truncation | `app/layout.tsx`, truncation source, `app/blog/page.tsx` | 1 |
| E | Redirects + review markup | `data/legacy-redirects.json`, `app/reviews/page.tsx` | 1 |
| C | Punctuation gate + fallout | `scripts/check-brand-voice.mjs`, remaining violations | 2 |

## Progress log

| Time (UTC) | Event |
|---|---|
| 15:35 | Goal written. Deps installing. Round 1 briefs prepared |
| 15:52 | **A (sitemaps, P0) done.** `maxDuration = 300` + in-flight dedupe + hourly cron warmer. Gate `ci:cron-registered` passes (58 registered). Dedupe proven: 5 concurrent cold requests → 1 build; failures not cached. Typecheck clean |

### Worker A — findings

The v2 per-class cache key is what *multiplied* the cold-start cost: five class
requests meant five independent full fan-outs over the same universe, contending on the
same tables. That is why the two heaviest classes never returned a byte while cheap ones
occasionally squeaked through.

Fix is three parts: (1) `maxDuration = 300` so a cold build is not killed before it writes
a header, (2) a module-level in-flight promise so concurrent class requests share ONE
build, (3) an hourly sequential cron warmer so the first real request is always a cache hit.

The shared universe is deliberately **not** put in `unstable_cache` — that was the v1
failure (2.4MB over the 2MB per-entry cap, silent write failure, nothing ever reused).
Only the compact per-class tuples are persisted.

**Audit recommendation dropped as unnecessary:** "split `listings` into paginated children
under the 50K limit." The listings class is ~7.6K URLs, well inside both the 50,000-URL and
50MB sitemap limits. Splitting would add moving parts for no gain.

| 16:02 | **Round 1 merged and committed** (`fbf512e`). B, D, E verified against their own claims, not taken on report. 358/358 test files green |
| 16:10 | **C (punctuation gate) done.** Gate wired, 18 real prose violations fixed, ratchet held at 0. 12 new tests |

### Worker B, D, E — verification notes

Each worker's claim was re-checked rather than accepted:

- **B** correctly identified that `normalizeAgentSlug` was the WRONG resolver (it returns the
  3-value attribution slug, and `null` for three of the aliases, which would have produced
  `/team/null`). It used `broker.slug` instead. It also flagged that the page BODY had the same
  bug feeding the JSON-LD `url` and BreadcrumbList — outside its brief, so I fixed it. That
  collided with an existing `canonicalSlug` in the same scope, hence `canonicalPathSlug`.
- **D** located the truncation in `lib/share-metadata.ts` (not `lib/seo/`). Verified it is the
  real path: `/sell` imports `pageMetadata`, which calls `shareDescription` at line 88. Re-ran
  the fix against the four actual live descriptions.
- **E** caught a multi-hop chain the brief missed: `/matthew-ryan` already pointed at
  `/team/matt-ryan`, so adding `/team/matt-ryan` would have created a 2-hop redirect the gate
  rejects. It retargeted both.

### Worker C — the punctuation gate, and what it should NOT enforce

`VOCAB.PUNCTUATION` has four entries. Only the two dashes are gated, deliberately:

- **semicolon** — string literals in `app/` and `components/` are full of CSS and SVG where
  `;` is syntax. §2 bans it in *body prose*, which a literal-level scanner cannot separate
  from a style string.
- **exclamation** — §2 allows one per piece and bans it only in market-data copy. That is a
  per-deliverable budget, not a per-literal rule.

Encoding either would trade a real gate for a noisy one. Both stay under human review per §2.

Five exemptions, each carved out by §2 itself: bare data placeholder, dash inside a `${...}`
fallback, numeric range, debug output, client reviews, embedded CSS/JS. Without them the gate
flagged 243 items, most of them legitimate output whose "fix" would have degraded the product.
With them: 82 → 23 → 18 genuine prose violations, all fixed. **Baseline stays at 0** — no
ratchet regression.

Proven working: injecting an em dash into `app/faq/page.tsx` makes the gate fail; removing it
returns to green.

| 16:25 | **Review pass.** Caught a NUL byte I had written into `check-brand-voice.mjs`, which made git classify the gate script as binary. Fixed (`bb9fd37`) |

## Final state — audit items 1 to 8

| # | Item | Status | Commit |
|---|---|---|---|
| 1 | Sitemap timeouts (P0) | Done | `fbf512e` |
| 2 | Broker canonical + alias 301s (P0) | Done | `fbf512e` |
| 3 | Punctuation gate wired + em dash removed | Done | `e7580a8`, `bb9fd37` |
| 4 | Title lengths, duplicate brand | Done | `fbf512e` |
| 5 | Mid-word description truncation | Done | `fbf512e` |
| 6 | `/buyers`, `/sitemap`, `/lp/` redirects | Done | `fbf512e` |
| 7 | `preconnect` for the image CDN | Done | `fbf512e` |
| 8 | Self-serving `AggregateRating` | Done | `fbf512e` |

Verified: 359/359 test files, full `ci:gates` chain, `tsc` clean, redirect gate (810 mappings,
no loops, no multi-hop), brand-voice at 0 with punctuation now actually enforced.

**Not verifiable from here:** the live sitemap fix needs a deploy. The three dead children
should be re-checked against production after merge, and the cron warmer confirmed running.
A local production build is not possible in this environment (no Supabase credentials); CI
builds it with real env and the build step passes.

## Known open item

`lint-and-build` fails at step 10, "Route smoke test", not at build. The server starts
("Ready in 708ms") and `wait-on` then times out for 5 minutes probing
`http://127.0.0.1:3000`. Build itself succeeds in ~270s.

**Not caused by this work:** it failed identically on `8b981a9`, which added a single markdown
file and no code. `main` is green, so this is not a broken base either — it points to a flake
or a PR-event environment difference in that step. Investigated and rejected two theories with
evidence: the middleware canonical-host redirect (`NON_CANONICAL_HOSTS` is a two-entry
allowlist that excludes `127.0.0.1`) and a bind-address mismatch (Next reports a network
address, so it is not localhost-only). Left alone deliberately rather than changing CI config
on a guess that cannot be reproduced without CI's credentials.

### Blocker fixed along the way

The pre-commit hook aborted before running a single gate. husky invokes hooks as `sh -e`,
ignoring the bash shebang, and dash has no `set -o pipefail`. Also fixed a pre-existing test
that failed on Node 22 for ICU reasons (`hour12: false` renders midnight as `'24'` on old ICU,
`'00'` on new). Confirmed pre-existing by reproducing it on a clean stash of HEAD.
