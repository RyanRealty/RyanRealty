# `components/admin/shared/` — admin infrastructure that outlives one route

Matt's 11F blocker decision 1 (2026-08-08, `docs/plans/ADMIN_PRODUCT/decisions.md`).

## What lives here

Components imported by MORE THAN ONE admin route. `mobile/` (16 files) is the
phone CRM kit; `people-list/` (9 files) is the desktop people table and its
panels. Between them they are imported by five admin pages plus `lib/`, which is
what makes them infrastructure rather than one route's islands.

A component used by exactly one route does NOT belong here — it belongs in that
route's `_components/`. That is the rule the whole 11F relocation runs on, and
this directory is the named exception for the case where the rule has no answer.

## Why not `components/admin/v2/`

`v2` is 20 files of pure design system: primitives with no product knowledge.
Burying 25 CRM-specific components in it would cost the barrel its meaning.
Matt's words: two directories with one rule each beats one directory with two
jobs. The rejected alternative was per-page exemptions in the gate, which turns
the blacklist into a list of holes nobody can reason about.

## The gate contract — NOT YET IN FORCE

The end state Matt approved is that `ci:admin-v2-tokens`
(`scripts/check-admin-v2-tokens.mjs`) treats this directory exactly like `v2`:
it satisfies the same token rules, and a gated page may import from it without
tripping rule 3 (the `LEGACY_IMPORT` blacklist).

**That change has not landed yet, and the reason is now Condition 2 alone.**

### Condition 1 — the files are on v2 — MET

All 25 files were migrated off shadcn (2026-08-09). Zero `@/components/ui/*`
imports, zero shadcn semantic classes, zero raw hex, zero colour functions:
every colour reaches these components through `var(--a-*)`.

| | before | after |
|---|---|---|
| files importing `@/components/ui/*` | 14 | 0 |
| shadcn semantic-class occurrences | 351 | 0 |
| total LOC | 5,323 | ~5,300 |

The migration was done by parallel agents and then **adversarially verified**,
which is the part worth keeping: the first pass produced token-pure code that
typechecked with zero API drift, and the verify pass still found **46
behavioural regressions** — an invisible sub-tab band (`var(--a-surface)`
painted on `var(--a-surface)`), hover and press states silently dropped from
phone tap targets, a select-all checkbox that lost its indeterminate dash,
stage values rendering UPPERCASED through `.av2-state`, and a popover that
became a focus-trapping modal. A second pass fixed them and was re-verified.

Three of those were defects in the PRIMITIVES, not the migration, and were
fixed at the source — they had been live for every admin surface already on v2:
`Dialog`/`Sheet` hardcoded their title/description ids (duplicate DOM ids
whenever two mounted), `Sheet` dismissed itself on keyboard-activated clicks
(`clientX/clientY` are 0 for Enter/Space), and `Sheet` is a permanently-mounted
`<dialog>` so React's `autoFocus` fired once while it was hidden and never
again.

**Known and accepted:** `Dialog` and `Sheet` always render a visible "Close"
text button in the header, where the shadcn originals used an icon with an
sr-only label. That is the v2 language and 81+ call sites already ship it; it
is recorded here so the next reader does not re-file it as a regression.

### Condition 2 — the dependency closure has to close

Under v2 rules a file here may not import legacy `components/admin/*`. Eleven
files outside these two directories are pulled in transitively:

```
BulkActions.tsx      <- people-list/PeopleListView.tsx
saved-view-grouping  <- people-list/PeopleSidebar.tsx
ConversationFeed     <- mobile/MobileCommsTab.tsx
calendar/AppointmentSheet <- mobile/MobileCalendarTab.tsx
  ...and BulkProgress, StoredAttachments, bulk/{registry,FormSelect,types},
     EmailBodyEditor, MergeFieldInserter
```

**`EmailBodyEditor` and `MergeFieldInserter` cannot simply be moved.**
`ci:composer-discipline` (G50) hard-codes the literal path
`@/components/admin/crm/(SmsComposer|EmailComposer|EmailBodyEditor)` in a
regex — relocating them silently disarms the gate that guarantees every send
goes through one composer. Whatever resolves this closure has to either move
them AND update that gate deliberately, or leave the `bulk/*` chain in legacy
and accept that `PeopleListView` keeps one sanctioned legacy edge.

Recompute the closure before attempting the flip; do not trust this list to
have stayed still.
