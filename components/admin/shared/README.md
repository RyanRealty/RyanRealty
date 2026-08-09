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

**That change has not landed, and must not land until the two conditions below
are met.** Relocation and presentation are separate commits in 11F — moving
files does not migrate them, and a gate flipped early would go green for the
wrong reason: rule 3 reads IMPORTS, and `TW_PALETTE` catches `bg-gray-500` but
NOT `bg-card` / `text-muted-foreground`, which resolve to the PUBLIC brand
palette. Measured at the time of the move:

| | count |
|---|---|
| files here | 25 |
| files importing `@/components/ui/*` | 14 |
| shadcn semantic-class occurrences | 351 |
| total LOC | 5,323 |

### Condition 1 — the files must actually be on v2

Every `@/components/ui/*` import gone, and every semantic class replaced with a
`var(--a-*)` token. Heaviest first: `PeopleListView.tsx` (793 LOC, 12 shadcn
imports, 64 semantic classes), `MobileInfoTab.tsx`, `MobilePeopleRoot.tsx`.

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
