# Console Kit — the admin design standard (build to this, gated)

**Why this exists.** The Lead Command Center drifted into "a bunch of text and
boxes with no headings" because every admin page hand-rolled its own layout and
there was no artifact to check it against. Matt's directive (2026-06-15): the
admin must be designed, not a data dump, and it must be **mechanically
impossible to regress**.

The answer is not prose. It is: **one shared kit + a saved mockup per surface +
a gate that fails the build on drift + a screenshot in front of Matt before
"done."** `/verify` confirms function, never craft — a green verify is never
design sign-off.

## The kit (the look lives in ONE place)

`components/console/`:

- **`ConsoleSection`** — the panel primitive. `title` is a **required** prop, so
  no panel ships headless. Optional `count`, `action`, `id`. Every console panel
  renders through this. Change the chrome once → every page updates.
- **`KpiStrip`** — the tight 4-cell metric strip from the approved mockup. Soft
  fill, big number, quiet label. Use for any at-a-glance metric row.
- **`StatusPill` / `StagePill` / `ListingStatusPill`** — dot + soft fill + label;
  color is a SIGNAL only (hot/active/paused), never decoration.

The neutral look comes from the `.console-root` token scope
(`app/admin/console/console-theme.css`) — Linear/Notion register, calm blue
accent. Pages use semantic tokens (`bg-card`, `text-muted-foreground`,
`bg-secondary`, `text-foreground`) so they inherit it.

## The contract per surface

`design_system/ryan-realty/ui_kits/<surface>/`:
- `picked-mockup.html` (or `index.html`) — the approved visual blueprint. The
  Lead Command Center's is the reference: identity band → Next best action →
  KPI strip → [Activity | Watching + Saved searches] → Send a message.
- `parity.json` — `{ route, requiredComponents: [{name, section}] }`. Lists the
  kit components the page MUST import.

## The gates (drift = red build)

- **`ci:console-kit`** (`scripts/check-console-kit.mjs`) — every page in
  `REQUIRED_KIT_PAGES` must import `ConsoleSection`. The list only grows; a page
  that drops the kit fails CI. Append each surface as it is migrated.
- **`ci:mockup-parity`** (`scripts/check-mockup-parity.mjs`) — every
  `ui_kits/<surface>/parity.json` must have its `requiredComponents` imported by
  the route. Richer, per-surface contract.

Both run in `ci:gates`.

## The migration recipe (apply to every admin page)

1. `import { ConsoleSection } from '@/components/console/ConsoleSection'`
   (+ `KpiStrip` if there's a metric grid).
2. Every panel becomes a `<ConsoleSection title="…">`. A `<Card>` with a
   `<CardHeader><CardTitle>` → move the title into `ConsoleSection`'s `title`
   (use `count` / `action` for the trailing bits). A panel with NO heading →
   add a specific, sentence-case heading.
3. Metric grids → `<KpiStrip items={[{label, value}]} />`.
4. **Do not change** server actions, data fetching, forms, props, hrefs, or
   logic. Layout wrapper only — behavior must be identical.
5. Add the route to `REQUIRED_KIT_PAGES` in `check-console-kit.mjs` and (for
   flagship surfaces) add a `parity.json`.
6. Screenshot the rendered page and show Matt before calling it done.

## Status (2026-06-16)

**30 console surfaces migrated to the kit and locked by `ci:console-kit`** —
see `REQUIRED_KIT_PAGES` in `scripts/check-console-kit.mjs`. Covers the
broker-critical + previously data-dump pages: the lead command center; CRM
(inbox, workflows, tasks, sequences, approvals, new, deals); comms (newsletters
×4, email campaigns/compose); ops/data (approval-queue, expired-listings,
spark-status, sync, reports, audit-log, operations, kpi-dashboard,
fub-attribution, forms); transactions (deals, financials, commissions, cmas,
sign-off, people). Each verified: tsc clean, design-tokens at baseline, renders
unchanged in preview.

**Already curated (own headed patterns, not the generic kit):** broker-dashboard
(live "Right now" pulse + GroupCard/SectionLabel), console/leads list
(engagement-first table), console/leads/[id] (the reference, parity-gated).

**Long tail still to migrate** (lower-traffic system/config/analytics; do them to
this same recipe + append to the gate): console home, analytics hub + sub-pages,
brokers/*, listings/*, geo/*, media, photos, stock-photos, guides, blog, banners,
query-builder, search, setup, users, optimization, producers, resort-communities,
site-pages, signing/*, visitors/*. The gate guarantees none can ship off-standard
when touched.
