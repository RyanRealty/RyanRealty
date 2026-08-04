# Ryan Realty Admin + CRM — Ground-Up Rebuild · Specification Package

> **SUPERSEDED AS AN EXECUTION TARGET (2026-08-04).**
> The active program is the Admin Product OS:
> [`ADMIN-UI-UNIFICATION-PROMPT.md`](./ADMIN-UI-UNIFICATION-PROMPT.md).
> This package and `specs/` are **evidence, not approved design** — the OS
> precedence ladder explicitly retires "implement ADMIN_REBUILD/specs as already
> approved." `audit-reports/` remains allowlisted as factual evidence.
> Process, data, IA, and visual truth now live in `docs/plans/ADMIN_PRODUCT/`.

**Status:** specification complete, awaiting Matt's sign-off + the §D decisions.
**No code until this package is approved.**

This package answers the brief — *review every admin page and feature through a
senior engineer / architect / design lead lens, find the root causes not the
symptoms, design the architecture from first principles, and spec every feature
end to end with all edge cases before writing any code.*

## How this was produced

1. **Audit** — 12 parallel domain auditors read the live admin/CRM end to end
   (commit `d3dd457a`), assuming every feature broken until code proved otherwise.
   252 features assessed; **22 critical + 50 high** defects, each with `file:line`.
2. **Root-cause synthesis** — the ~250 symptoms collapse to **7 structural root
   causes** (RC1–RC7). Reasoning in `00-REASONING-AND-ARCHITECTURE.md`.
3. **Architecture + IA** — derived from the 5 real constraints (C1–C5), not
   pattern-matched. 56 nav items / 5 menus / 8 nav systems → **8 destinations**.
4. **Feature specs** — 11 end-to-end specs (9,300+ lines) in `specs/`, each with
   data model, flows, states, every edge case, error/compliance handling,
   responsive behavior, performance, and writer→store→reader→outcome acceptance
   criteria.
5. **Adversarial spec review** — a review lead found 15 cross-spec conflicts, 6
   architecture violations, 8 coverage gaps, 5 sequencing risks; all resolved in
   `01-DECISIONS-AND-RECONCILIATION.md`.

## Read in this order

| Doc | What it is |
|---|---|
| [`00-REASONING-AND-ARCHITECTURE.md`](00-REASONING-AND-ARCHITECTURE.md) | The reasoning: constraints → 7 root causes → kept core → target architecture → IA → the one success flow → sequencing. **Start here.** |
| [`brief.html`](brief.html) | The same reasoning as a visual brief (published as an Artifact). |
| [`01-DECISIONS-AND-RECONCILIATION.md`](01-DECISIONS-AND-RECONCILIATION.md) | Every cross-spec conflict resolved + the locked platform contracts + **§D: the 7 decisions that are Matt's call.** |
| `specs/01`–`11` | The end-to-end feature specifications. |
| `audit-reports/` | The raw evidence — 12 domain audits + the machine summary. |

## The 7 root causes (the whole story in one screen)

- **RC1** No conversation entity — a "thread" is just a person → group vs 1:1 confusion, dropped participants, heavy inbox.
- **RC2** No optimistic/idempotent mutations → the SMS hang, double-sends, admin-wide slowness.
- **RC3** Desktop and mobile are two forked products → "different on mobile," send absent on phone, doubled cost.
- **RC4** Build-by-accretion, no source of truth per concept → bloat, duplication, conflicting numbers.
- **RC5** Access truth in 3 disagreeing layers → broker dead-ends, unauthenticated action/XSS holes.
- **RC6** Placebo surfaces wired to nothing → configured-but-inert features, fabricated numbers.
- **RC7** Consumer funnel severed at every seam → confusing save-flow, buyer signal never reaches the CRM.

## The specs

| # | Spec | Kills | Owner of |
|---|---|---|---|
| 01 | Shell, nav, auth, capability model | RC5, RC3(shell) | the one auth primitive + generated nav + Today home + Approvals |
| 02 | Inbox, conversations, messaging | RC1, RC2 | the conversation model + governed-send persistence |
| 03 | Person workspace + unified Send | RC2, RC3, RC4 | the CMA-in-seconds flow; the person shell + fetch |
| 04 | People list + pipeline board | RC3, RC4 | contacts list, board, timeline region |
| 05 | Transactions ↔ TC ↔ e-sign | RC4, RC6 | one deal→transaction link, one commission ledger |
| 06 | Performance + metric layer | RC4, RC6, integrity | one definition per number |
| 07 | Prospecting (expireds/FSBO) | RC4, RC6 | one prospecting worklist + one cold-SMS pipeline |
| 08 | Content, listings, media, marketing | RC5, RC6 | content authz + sanitization; one media library |
| 09 | Settings + automation engine | RC6 | wired triggers, one settings home, broker identity |
| 10 | Consumer account + funnel | RC7 | account menu, save→resume, buyer-signal→CRM |
| 11 | API/actions/crons hardening | RC4, RC5 | the send chokepoint + the delete/dedup ledger |

## What is kept (a rebuild of surfaces, not the engine)

The compliance-critical core is correct and hard-won; discarding it would re-introduce
legal risk. Kept and built on: the SMS/email compliance chain (suppression, quiet
hours, A2P, signed webhooks), the `buildCrmPeopleQuery` AST compiler, the bulk-job
framework, the CMA/BPO send libs, the `listing_alerts` pipeline, and the
sequence-engine cron.

## Decisions blocking finalization

Seven business/legal/scope calls are Matt's — see
[`01-DECISIONS-AND-RECONCILIATION.md` §D](01-DECISIONS-AND-RECONCILIATION.md#d-deferred-to-matt--genuine-businesslegalscope-decisions):
e-sign strategy · Oregon record-sufficiency · roles & access scope · commission source
of truth · lead-distribution model · buyer-signal threshold · broker onboarding.
