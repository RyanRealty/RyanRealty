# Mechanical guardrails for Ryan Realty website

This catalog lists every guardrail that has been moved out of prose
(CLAUDE.md, EXECUTION_PLAN.md, handoff docs) and into mechanical
enforcement (lint rules, CI scripts, build hooks). Prose rules require
agent discipline and break under context pressure. These don't.

**Rule:** if a guardrail can be mechanized, mechanize it. If a guardrail
keeps being violated, the answer is a new gate, not more prose.

## Active gates

| # | Gate | Mechanism | Source |
|---|---|---|---|
| G1 | DAL boundary — no raw `from('<table>')` outside `lib/data/` | ESLint `no-restricted-syntax` (error) + `scripts/check-dal-boundary.mjs` (ratcheted) | Plan §4 + CLAUDE.md §6 |
| G2 | Brand voice §6.1 + §6.2 in JSX text + string attrs | ESLint plugin `rr-brand-voice/no-violations` (error) | CLAUDE.md §3 |
| G3 | Brand voice across content files | `scripts/check-brand-voice.mjs` (ratcheted) | CLAUDE.md §3 |
| G4 | Design tokens — no raw hex, no retired fonts, no bg-image hero | `scripts/lint-design-tokens.js --base-diff` | CLAUDE.md §5 / Plan §10 |
| G5 | SEO route metadata + JSON-LD authoring | `scripts/check-seo-routes.mjs` + `scripts/check-seo-authoring.mjs` | Plan §1 |
| G6 | **Mockup parity** — every gated route imports every component the matching mockup contract requires | `scripts/check-mockup-parity.mjs` (ratcheted) + per-route `design_system/ryan-realty/ui_kits/<route>/parity.json` | Plan §1 + Wave 3 §9 |
| G7 | **Mockup coverage** — every mockup directory must have a `parity.json` contract | `scripts/check-mockup-coverage.mjs` (allowlisted) | Plan §1 + Wave 3 §9 |
| G8 | **Page DAL completeness** — every `app/<route>/page.tsx` reads through `@/lib/data` (positive direction) | `scripts/check-page-dal.mjs` (ratcheted) | Plan §1 |
| G9 | **`generateStaticParams` on every dynamic route** | `scripts/check-static-params.mjs` (ratcheted) | Plan Wave 3 §9 |
| G10 | **Bundle budget** — total + per-chunk JS size ceiling + growth-vs-baseline detection | `scripts/check-bundle-budget.mjs` (baselined) post-`next build` | Plan §1 |
| G11 | **Route smoke** — every canonical route returns 200, non-blank, non-404 against a live server | `scripts/check-route-smoke.mjs` + start-server-and-test | feedback memory "verify before moving on" |
| G12 | **Draft-first commit gate** — user-facing diffs require an `Approved-by: matt` or `Draft-shown: <url>` line | `.husky/commit-msg` → `scripts/check-draft-first.mjs` | CLAUDE.md §0.5 |
| G13 | First-frame thumbnail quality (video pipeline) | `scripts/check_first_frame.py` | CLAUDE.md §4 |
| G14 | TypeScript strict | `tsc --noEmit` via `next build` | Plan §1 |
| G15 | Lighthouse perf ≥ 0.90 / a11y ≥ 0.95 / BP ≥ 0.90 / SEO ≥ 0.95 / LCP ≤ 2500ms / CLS ≤ 0.10 | `npm run ci:lighthouse` (blocks PRs) | Plan §1 |
| **G16** | **Data access discipline** — `docs/DATABASE_SCHEMA_SNAPSHOT.md` matches live Supabase + `docs/DAL_INDEX.md` matches `lib/data/`. Drift fails CI. | `scripts/check-data-access.mjs` (regenerates both via `_agent_schema_dump()` RPC + AST walk; diffs vs HEAD) | CLAUDE.md "Data Access Discipline" + feedback `no-adhoc-sql.md` |

Run them all locally before pushing:
```bash
npm run ci:gates
```

That umbrella runs design-tokens + seo-routes + dal-boundary + brand-voice + mockup-parity + page-dal + static-params in sequence. CI runs the same set in `.github/workflows/ci.yml`.

## The ratchet pattern

G3, G6, G7, G8 all use the same baseline-ratchet pattern: a JSON file in `scripts/` records the legacy state when the gate was first added. The gate fails on NEW violations beyond the baseline, not on the legacy backlog. As migrations land, the baseline shrinks.

To re-baseline a gate (only when intentional — e.g. accepting a deferred contract):

```bash
npm run ci:dal-boundary:baseline       # writes scripts/dal-boundary-baseline.json
npm run ci:brand-voice:baseline        # writes scripts/brand-voice-baseline.json
npm run ci:mockup-parity --write-baseline
npm run ci:page-dal:baseline
npm run ci:static-params:baseline
```

A baseline commit should always include the reason in the commit body (e.g. "Accept gap on /listing/[listingKey] until Wave 3 rebuild lands").

## G6 — mockup parity in depth

The most important gate added 2026-05-28 because the listing-detail rebuild shipped without ever reading the mockup. The plan said "build from the mockup," and the agent ignored that prose rule. The gate now enforces it.

Contract per route lives at `design_system/ryan-realty/ui_kits/<route>/parity.json`:

```json
{
  "route": "app/listing/[listingKey]/page.tsx",
  "mockup": "design_system/ryan-realty/ui_kits/listing-detail/index.html",
  "requiredComponents": [
    { "name": "ListingHero",             "section": "ld-photo-grid full-bleed hero" },
    { "name": "PriceCtaStrip",           "section": "price + CTA strip" },
    { "name": "NeighborhoodMarketContext", "section": "Live market context (Zillow beater)" }
  ]
}
```

The gate parses the parity.json, reads the route's `page.tsx`, asserts each `requiredComponents[].name` is imported. Missing imports fail CI (unless baselined).

**Adding a new gated route:**

1. Place the mockup at `design_system/ryan-realty/ui_kits/<route>/index.html` (already exists for every planned route in this repo).
2. Add `design_system/ryan-realty/ui_kits/<route>/parity.json` with the component contract.
3. Run `node scripts/check-mockup-parity.mjs` locally.
4. Fix imports in the route file until it passes, or baseline the gap with a justification.

**Updating an existing contract:**

If the mockup changes (e.g. a new section added), update the `parity.json` to reflect the new required components. The gate will fail until the route file imports them.

## G7 — page DAL in depth

Positive counterpart to G1. Every `app/<route>/page.tsx` must `import ... from '@/lib/data'` (or any subpath). Opt-out is a leading `// @data-free` comment on a page that genuinely needs no data (e.g. a static About page).

Scope excludes:
- `app/api/**` (API routes — different read pattern)
- `app/admin/**` (admin tools — lower scope per Plan §3)
- `app/account/**`, `app/dashboard/**` (auth-gated, opt out individually)

## G8 — generateStaticParams in depth

Dynamic routes (paths containing `[slug]`) must export `generateStaticParams` so Next can pre-render. Opt-out is a `// @no-static-params` comment for routes that legitimately need full SSR.

Scope excludes the same auth-gated directories as G7.

## What's NOT yet mechanized (intentionally — runtime telemetry only)

| Guardrail | Why this stays prose | Where it lives instead |
|---|---|---|
| TTFB p95 < 200ms (listing) / < 300ms (LP) | Production telemetry, not pre-deploy | Vercel Analytics dashboard + manual review |
| MV refresh successfully for 7 consecutive days | Runtime health, not pre-deploy | `monitoring_alerts` + Supabase advisor digest |
| Pixel-diff every section vs mockup (visual parity) | Subjective human-judgement step | Mockup parity (G6) handles the structural check; visual sign-off stays with Matt |
| Data accuracy (every published number traces to a verified source) | Per-content-piece runtime concern, not a static lint | Producer-side `citations.json` files + per-deliverable verification trace |
| Spark × Supabase market-data reconciliation gate | Video pipeline, not website | `scripts/_voice_lib.py` + producer pre-render gate |

Everything mechanizable for the WEBSITE surface has been mechanized. Adding new gates as new failure modes surface is the pattern (see "How to add a new gate" below).

## How to add a new gate

1. Write `scripts/check-<thing>.mjs` with these CLI conventions:
   - Default exit code: 0 on pass, 1 on fail
   - `--report` flag: human-readable, always exit 0
   - `--json` flag: machine-readable
   - `--write-baseline` flag (if ratcheted): write the current state as the baseline
2. Add a `package.json` entry: `"ci:<thing>": "node scripts/check-<thing>.mjs"`
3. Add the script to the `ci:gates` umbrella in `package.json`
4. Add a `- run: npm run ci:<thing>` line to `.github/workflows/ci.yml`
5. Add a row to the "Active gates" table above

Done. No prose update to CLAUDE.md needed — the gate is the rule.
