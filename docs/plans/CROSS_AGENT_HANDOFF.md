# Cross-Agent Handoff — Current

**Written:** 2026-06-09 by Claude Opus 4.8 (1M context). **Branch:** `main`, synced with `origin/main`. **HEAD:** `a48de35`.

*Convention: the other agent can't read the chat — anything not in `git` + this file + `task-registry.json` is invisible. Keep this "Current" block accurate; delete stale bullets, don't let it become a novel.*

Pull `main` and read this first. Then read `CLAUDE.md` (operating rules) and the task list (§2). User is Matt Ryan, principal broker, Ryan Realty. North star: **18 SELLER leads/month.**

---

## 0. The standing directive (what you're in the middle of)

Matt: **"finish everything else that was left, then start working on the brain."** A queued backlog of WAVES is being shipped one verified increment at a time. Do NOT stop between waves — each completion launches the next. The **brain** (#19) and **hero** (#20) come after the waves. Ultracode is ON: use the Workflow tool for substantive work; token cost is not a constraint; verify adversarially.

**RUNNING now (background workflow):** `wvg6h99fx` — Wave 3 headings (plain-Geist consumer headings → Amboqia primitives + ratchet `ci:heading-display`). On completion: read its output, review the diff, `npm run ci:gates`, `git add` EXACTLY the files it changed (watch the drop hazard, §3), commit + push, launch the next wave.

---

## 1. Shipped this session (all live on `main`)

| Commit | What |
|---|---|
| `b58927e` | maps: subdivision hover-highlight |
| `50ae556` + `9c477a0` | **4 memory-invariant gates**: jsdom-500 (`ci:no-jsdom-serverless`), OAuth dual-host (`ci:canonical-host`), embed↔CSP (`ci:embed-csp-parity`), asset-curation dedup (`ci:asset-register-dedup`) |
| `ed0afa8` | **4 P0 reliability fixes**: 3 poison-null resolvers + `/pulse` React-418 hydration crash |
| `3c439dc` + `94adbaf` | **FUB "Lead origin" note** on every web lead (the "why am I getting this lead" + activity fix). `94adbaf` recovered the rental-lead `originContext` wiring dropped from the explicit-path commit. |
| `40ff403` | **Watchable video** (VideoListingCard inline-play + `/videos` gallery) **+ saved-search & map-as-you-move on every results route** |
| `a48de35` | **Wave 2**: `ci:poison-null` gate (baseline 0) + converted the remaining 10 poison-null resolvers |
| `516afe0f` | **TC rung 1 complete (phase 2a done)**: document upload to a deal cycle — signed-upload-URL flow, sha256 dedupe, pdfjs page count, checklist assignment, `document_uploaded` audit events. `/admin/deals/<key>` → Upload document. |
| (next) | **TC rung 11: commission tracking** — `tc_commissions` table + backfill (settlement-verified, reconciles to the cent), Commission block on deal pages, `/admin/commissions` roll-up, linked from the Deals header. NOTE for the nav-refactor session: please add `item('/admin/commissions', 'Commissions', '💰')` to the transactions group in your uncommitted `app/components/admin/admin-nav.ts` — my earlier in-file addition was overwritten by your rewrite. |

`ci:gates` = **58/58 wired, 0 orphaned**. tsc clean, ~531 tests green.

---

## 2. Queued (use TaskList/TaskGet — tasks #15–#20)

- **#15 Wave 3** (running): headings → Amboqia. Next sub-wave = **components** (hand-rolled cards/badges/buttons/modals → `@/components/ui/*` + a `ci:design-system-components` gate).
- **#16 Wave 4 — SEO/AEO**: 3 market-report surfaces emit a self-301-redirecting canonical; missing canonicals + per-page-type JSON-LD on money pages; gates `ci:seo-canonical-redirect` + field-level `ci:ai-structured-data`.
- **#17 Wave 5 — gates + DAL + FUB/cron**: `ci:dal-boundary` deny-by-default, `ci:listing-detail` live content smoke, `ci:hydration-safety` extension (scan useMemo bodies + `lib/*.ts` impure helpers), `ci:dead-deprecated-ui`. **FUB**: pause-on-reply note + **schedule `seller-workflow-pause` cron (MISSING from `vercel.json`)**, retire FUB Automation #107 (`zzzArchived` templates = the "archived" Comms entries), mirror FUB activity to Supabase. **Cron health**: `competitor-recon` dead, `refresh-reporting-cache` → nonexistent table.
- **#19 Brain teardown + closed-loop redesign** (§5). **#20 Hero consistency + photo accuracy** (§5).

---

## 3. CRITICAL operating context

**Gate model (Matt's core principle):** every recurring problem → an enforceable `scripts/check-*.mjs` gate wired into `ci:gates`, never fix-and-move-on. `ci:gates-wired` (meta-gate) fails CI on any orphaned gate. Ship gates with a shrinking baseline JSON when there's pre-existing debt. "Gates not prose."

**This environment CANNOT reach prod over HTTP** — every `curl` to `ryan-realty.com` returns 403 (middleware `BAD_BOT_RE` blocks curl, geo-block CN/HK/RU/SG, + Vercel edge firewall on the sandbox IP). A curl 403 is NOT a real failure. Verify prod via: **Vercel MCP `web_fetch_vercel_url`** (bypasses the bot screen — use to eyeball rendered HTML), **Supabase MCP** (data), **Vercel MCP `list_deployments`** (deploy health).

**Commits:** single-checkout `main`, no feature branches. Messages end `Approved-by: matt` then `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`. Matt: **"ship it always ship it"** (verified work pushes without re-asking). `npm run ci:gates` before every push.

**Git hazards (both bit this session):** (1) **autostash trap** — `git pull --rebase --autostash` unstages staged files; `git add` AFTER the pull. (2) **explicit-path drop** — committing by path can miss a workflow-edited file; after a workflow, `git status` and stage EXACTLY what it changed. `rm -f .git/index.lock` proactively. `ci:data-access` drift after a DAL change → `npm run ci:data-access -- --refresh` then commit `docs/DAL_INDEX.md` + snapshot.

**Forbidden files — never edit/commit:** `app/api/cron/loop-health-check/route.ts`, `app/lp/seller-home-value/page.tsx`, `SellerLPForm.tsx`, `app/lp/sell-your-home/page.tsx`, `data/asset-library/manifest.json`. (`app/lp/seller-home-value/actions.ts` + `data.ts` ARE editable.) They show as `M` from another process — commit only explicit paths, never `git add -A`.

**Poison-null:** throw on DB error + `makeResilientCached(...)` from `lib/data/cache/resilient.ts` + bump cache key. Enforced by `ci:poison-null` (keep baseline 0).

**Brand voice (client-facing only):** no em-dash/semicolon, no banned words, dotted phone `541.213.6706`. Commits/notes exempt.

---

## 4. Findings (don't re-investigate)

- **Listing alerts:** engine built + scheduled + correct, but `saved_searches` + `guest_search_alerts` were **0 rows ever** (save UI didn't persist → fixed in `40ff403`). Unconfirmed delivery gate: prod `RESEND_FROM` must be a **verified** Resend domain (fallback `onboarding@resend.dev` is safe) — verify in Wave 5.
- **Search:** `/homes-for-sale` = two pages (`app/search/page.tsx` had the features; `[...slug]/page.tsx`, hit by city/preset links, didn't — fixed).
- **Video:** sections render live (Vercel web_fetch confirmed 26 video-tour cards on `/cities/bend`); were card-grids, now inline-playable.
- **Hero photos:** 170 hero-tagged photos, **99 are generic `central-oregon`** → most city heroes show a non-place-specific photo (task #20).

---

## 5. Strategic direction (Matt's words)

**Brain (#19):** "we don't use the metrics, we have no idea what our social profiles are doing, no overarching strategy, it's all loose and disconnected." It's an OPEN loop (generation from audit signals, not performance; measurement loop has ~no real data; social presence uninstrumented; competitor-recon dead). Target: closed loop — Measure (social presence + attributed lead-gen, one scoreboard) → Learn → Strategize (living strategy) → Produce (from strategy+performance) → Publish → Measure + one growth dashboard. Multi-agent teardown first, redesign for sign-off before rebuild.

**Hero (#20):** one canonical Hero component everywhere + curate place-accurate hero photos per place (geo-accuracy rule: identifiable landmark → its true slug only, never `central-oregon`) + a gate refusing to render a generic photo as a specific city.

---

## 6. Continue now

1. Watch `wvg6h99fx` → review, `ci:gates`, stage its exact files, commit, push.
2. Launch Wave 3b (components) → Wave 4 → Wave 5, each a Workflow (discover → implement → verify, structured output, adversarial verify), verified + shipped before the next.
3. Then #19 (brain), #20 (hero).
4. Workflow scripts live in `out/wf-*.mjs` (gitignored) — reuse the pattern.

## TC SYSTEM (SkySlope replacement) — session 2026-06-09/10

Matt approved recreating SkySlope ("yes lets do that... start by getting all of our existing Transactions into the system"). Spec: `docs/TC_SYSTEM.md`. Schema applied to hosted Supabase: `tc_deals / tc_cycles / tc_documents / tc_checklist_items / tc_checklist_assignments / tc_events` (+ Storage bucket `tc-documents`), migration `20260610010000_tc_system_v1.sql`. Full historical migration running via `scripts/tc-migrate-from-skyslope.mjs` (live re-fetch per folder, sha256 binaries, ARCHIVE-name → archived flag). Dashboard `/admin/deals` + snapshot tables `skyslope_transactions`/`skyslope_dashboard_meta` already synced (33 properties).

**Coordination with the CRM/FUB-replacement session (`crm_*`, docs/CRM_REPLACEMENT_BLUEPRINT.md):** disjoint namespaces, no collisions. `tc_deals.fub_person_ids` (jsonb of FUB person ids) is the intended join to `crm_people.fub_legacy_id` — when linking transactions to people, join through FUB ids, do NOT create a second person store in tc_*. `crm_deals` (CRM pipeline concept) ≠ `tc_deals` (transaction/property record); a future bridge table or fk can map them. Note: `20260610010000_` timestamp prefix is shared by `crm_core.sql` and `tc_system_v1.sql` — both already applied to hosted; do not rename either file.

Uncommitted (draft-first, awaiting Matt): deals dashboard page + action, sync scripts, master-file toolchain, skill-doc update, `data/skyslope-audit/broker-notes-review.json`, `docs/TC_SYSTEM.md`, both my migrations, this handoff block. The dev-preview harness `app/dev/deals-preview/` gets DELETED before commit.

### TC SYSTEM update — migration COMPLETE 2026-06-10

Full historical migration verified: 33 deals / 51 cycles / **2,355 documents, 948.9 MB, 0 failures, 0 missing binaries**, sha256 round-trips verified, source reconciliation exact (2,355 = 2,355). Deal detail page live at `/admin/deals/[key]` (documents + one-click archive/unarchive with tc_events audit + checklist + signed-URL downloads). Archive flow proven end-to-end authenticated (and reverted). Forms/signing DDL (`20260610020000_tc_forms_signing_v1.sql`) drafted + form-template importer built; apply pending Supabase MCP connector recovery. Commit bundle awaiting Matt sign-off.
