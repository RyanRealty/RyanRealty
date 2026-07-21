# Decisions — recorded 2026-07-21

Matt's answers. These override the recommendations in `03-DECISIONS.md` where they differ.

---

## 1. Loop autonomy — full autonomy, post-hoc review

**Decided:** loops commit and push without Matt in the session. No draft queue for code, infra, gates, DAL, migrations, site content, or dead-code deletion. He reviews after.

**Carve-out held, pending his confirmation:** actions that leave the building and cannot be pulled back stay per-action.

- Sending email or SMS to real people
- Publishing social posts
- Ad spend
- OAuth grants

Reason: CLAUDE.md §0 ties a wrong published figure to a principal broker license, and a send to 129 expired owners has no undo. Everything upstream — build, verify, queue — runs unattended.

**Consequence for `02-LOOP-V2.md`:** the `approval_class` enum collapses from three values to two. `draft-first` is retired. Every candidate is `continuous` except the four action types above, which stay `per-action`. The per-domain cap of 3 and fleet cap of 12 no longer bind on anything except `per-action`, so §6.2's bottleneck-release mechanisms are mostly moot. `loop_standing_approvals` survives only to cover `per-action` grants.

## 2. Brand voice — layer, do not replace

**Decided:** keep the deterministic word list as a free floor. Collapse the 12 hand-maintained copies into one generated source with a parity test. Add an Orwell pass as an advisory LLM reviewer on long-form only.

The Orwell reviewer output format, per Matt's own spec: list every violation first — each stale phrase, each long word with its short replacement, each cuttable word, each passive construction — then the rewrite, with every fact, number, and name unchanged.

Not a commit blocker. Scope extends past `app/` and `components/` to the surfaces currently ungated entirely: emails, SMS templates, CMA prose, video VO, social captions, and Supabase blog posts.

Immediate fix: `lib/marketing-brain/generate-briefs.ts` still hard-fails on "about", "around", "approximately". The canonical list emptied those on 2026-06-02. The brain is rejecting valid content in production.

## 3. Effort units — agent-hours and loop iterations, never calendar

**Decided:** calendar estimates are wrong at this velocity and are banned from program docs. The repo ships ~51 commits a day with agent fleets.

Effort stays on the scoring function's scale (S=1, M=3, L=8, XL=20 agent-hours). Progress is reported as candidates closed per loop iteration, not weeks elapsed.

## 4. Automation spend — measure first, cap later

**Decided:** no ceiling set yet. The $250/month proposal was not grounded in any measurement.

Measured actuals as of 2026-07-21:

| Cost center | Actual | Source |
|---|---|---|
| Brain LLM calls | $8.54 lifetime — $8.42 May (145 events), $0.12 July (3 events) | `marketing_cost_ledger` |
| BatchData skip trace | ~$10/month | 146 new prospects in 30 days (129 expired, 17 FSBO) at ~$0.07/hit per `lib/owner-resolution.mjs:9` |
| Apify | **uninstrumented** — zero rows, `cost_type` only ever records `anthropic_tokens` | `marketing_cost_ledger` |

Pipeline total runs roughly $25–50/month at current volume.

The real cost center is the loop's own model spend, which no ledger tracks. The 2026-07-21 audit alone consumed ~8M subagent tokens.

**Actions:** instrument Apify runs and loop model spend into `marketing_cost_ledger`. Add the zero-result scraper alarm regardless of budget — the current failure mode is indistinguishable from an empty market, which is how the pipelines went dark unnoticed before. Set a ceiling after 30 days of measured cost per closed candidate.

## 5. The loop — shelved

**Decided 2026-07-21:** "Forget the loop right now. We'll pick that up at a later time."

`02-LOOP-V2.md` is preserved but is not part of this program. No scheduler, no `loop_*` tables, no candidate queue, no domain contracts. The program runs as one sequenced spec.

Two things from the loop spec survive because they are useful independent of any loop: the adversarial verification method (build with one agent, refute with a second that is starved of the builder's reasoning, compute the verdict in code rather than asking a model), and the reachability test (a change to unreachable code is not a change).

## 6. Follow Up Boss — zero references

**Decided 2026-07-21:** "We do not use Follow Up Boss anymore so there should be zero reference to it."

Recorded as D21 in `00-MASTER-SPEC.md` §4.1. Verified: FUB is off the serving path, zero calls in `app/`. Residue is 2,662 code references, 15 `fub_*` database columns, 5 env vars including stored login credentials, 905 doc files, and three reachable lib modules still containing FUB API calls — one of them on the live expired and FSBO path.

Converges with the top-priority defect: the identity spine reads `fub_person_id` while writing the native `crm_people.id`. Same fix.

## 7. Consolidation preserves memory

**Decided 2026-07-21, correcting an earlier over-read:** "WE NEED TO KEEP MEMORY AND CONTEXT — I just don't want duplicates or conflicting audits, reports, plans."

The consolidation target is deduplication, not deletion. One audit per subject, one plan per initiative, one statement per rule. History, research, and past findings are memory and are kept. A file is removed only when its entire content has moved somewhere else.

Recorded as D22 in `00-MASTER-SPEC.md` §4.2.

## 8. Still open

- **30-day win condition.** Not answered; the question carried bad calendar framing. Re-ask as an ordering question, not a duration one.
- **IDX agreement**: does it permit public display of individual sold listings? Three nav surfaces promise "Sold homes" and render active inventory. Those links get pulled either way.
- **FSBO price floor**: inherited $500K from expireds with no decision recorded. FSBO stock skews below it.
- **Broker publishing autonomy**: can Paul and Rebecca publish under the brand with their own attribution, or does it route through Matt?
- **`transaction-tc` contract**: commission a 20th audit to seed it, or leave it on the `/tc-builder` ladder outside the contract system?

## 9. Platform decisions — 2026-07-21 (evening session)

Recorded from Matt's answers to the 14-domain platform gap analysis. His words: "LIFT G45, KEEP EXPIRED FLOOR, YES ON NEWSLETTER, YES ON APPROVAL MODEL, ME WANT ACTUAL MECHANICAL AND NOT PROSE."

1. **G45 producer freeze — LIFTED.** Gate script and baseline deleted, `ci:producer-freeze` removed from the chain, CLAUDE.md section shrunk to the lift record. New producers may be added; the action-row protocol, approval queue, and voice gates still govern every one.
2. **Expired capture floor — KEPT.** The 2026-05-19 scope stands: SFR, $500K+, six cities. Widening is a one-constant change whenever Matt says so.
3. **Newsletter — START.** Audience: past clients + engaged leads + the West Side cohort, consent-respecting. Not the full ~12K cold book. Preconditions before the first large send: postmaster ingestion cron, Resend-webhook registration check.
4. **Approval model — CONFIRMED.** Decision 1 (full autonomy, post-hoc review for reversible work) stands with the four per-action classes: outbound messages to real people, publishing posts, ad spend, OAuth grants. Mechanically applied: CLAUDE.md §0.5 rewritten, `check-draft-first.mjs` narrowed to rendered content deliverables (media files in tracked `public/` paths) — code and site content commit clean.
5. **Mechanical over prose — ABSOLUTE, permanent.** Every rule ships as a gate, cron, schema constraint, or contract test, or it does not count. First installment: G53 `ci:cron-registered` (23 dark cron routes: 12 now marked with their real triggers, 11 in a shrink-only baseline), sitemap derives communities from the registry (drift now impossible), sitemap no longer submits 404-ing `/cities/{city}/{subdivision}` URLs.
6. **Sold-listing pages — still open** (unchanged from §8): needs Matt's ORMLS/IDX display-policy read before indexable sold pages get built.
