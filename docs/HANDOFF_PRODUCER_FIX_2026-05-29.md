# Handoff — producer "fix it all" build (2026-05-29)

Big multi-slice build. This file is the durable plan so any session can resume. Channel had
delayed-delivery hiccups mid-session (now stable); go serial, verify each step, use MCP
`execute_sql` for DB reads (never node-fetch Supabase — the DB-CLI guard refuses it, correctly).

## Confirmed DONE + pushed

- `4034651` (rebased, on origin): 8 producers retrofitted green; validator skip-list fixed;
  **blocking gate G35** (`scripts/check-producer-skills.mjs`) in `ci:gates` + `MECHANICAL_GATES.md`;
  audit docs (`PRODUCER_TOOL_UTILIZATION_AUDIT_2026-05-28.md`, `CANONICAL_LIB_ADOPTION_AUDIT_2026-05-28.md`).
- `docs/PRODUCER_EXECUTOR_ARCHITECTURE_DECISION_2026-05-29.md` (UNCOMMITTED — commit on resume).
- This handoff (UNCOMMITTED).

## Live queue truth (MCP execute_sql, 3 consistent queries — TRUSTED)

`marketing_brain_actions` = 42 rows: **ready 17 (9 with fabricated citations+draft_path)**,
approved 0, executed 9 (cites 0, draft 1 — these are ops/comms, no citations expected), pending ~1.

→ Fabrication is PROVEN (9 ready rows) but CONTAINED: none approved, none of the fabricated-content
rows published. They've sat in `ready` since 2026-05-22. **Cleanup item: kill those 9 fabricated
ready rows** (they reference draft_paths that were never written). Query to find them:
`select id, action_type, assigned_producer from marketing_brain_actions where status='ready'
and executor_response ? 'citations';`

## KEYSTONE FINDING (slop root cause)

Deployed pipeline can't render and fabricates verification data. `producer-runtime`
(`app/api/cron/producer-runtime/route.ts`, sched `47 * * * *`) reads SKILL.md, calls Anthropic
Messages API **with NO tools**, system prompt (lines ~183-195) tells Claude to RETURN JSON with
`draft_path`/`citations[]`/`scorecard{}` — all invented. Row → `ready`. Vercel serverless cannot
run Remotion/Chromium/PIL/Puppeteer/ffmpeg (+300s cap), so the REAL generators (`build_*.py`,
`render-*.mjs`, Remotion, `/api/cma`) run ONLY via orchestrators + `run-producer.mjs` +
`test-all-producers.mjs` + CLI — never the prod cron. Admin one-shot
(`app/api/admin/run-producer/[id]/route.ts`) = same text-only fabrication.

## DECISION (locked w/ Matt): cloud queues, local worker renders. Scope = WORKER + GENERATORS + DE-FABRICATE.

## Build order (resume at first unchecked)

- [ ] **Slice 1 — de-fabricate the cron** (pure code, verify by `next build` typecheck, no render):
  classify producers by frontmatter `output_type` (text/operational → may finish in cloud;
  video/image/document → visual → defer to worker). In `producer-runtime/route.ts`: visual
  producer → do NOT invent a deliverable; leave `in_production` tagged `awaiting_local_render`.
  Text-only → keep call but strip "invent citations" instruction; numbers must come from the
  (already-verified) payload, citation trace points to payload provenance. Mirror in admin one-shot.
- [ ] **Slice 1b — kill the 9 fabricated `ready` rows** (MCP update status='killed', note reason).
- [ ] **Slice 2 — Tier 1 stub rewires** (each currently shutil.copy's Tumalo; make payload-driven;
  add G22 `require_action_row` to touched `build_*.py`; verify each w/ a NON-Tumalo fixture →
  output must differ from the Tumalo asset):
  - `build_cma_wrapper.py` → POST `/api/cma/generate`, poll slug, pull PDF.
  - `build_listing_tour_video.py` → re-point `producer-inventory.mjs` → `video/listing-tour/scripts/prepare-tour.ts`.
  - `build_market_data_video.py` + `build_market_report_video.py` → render `video/market-report` comp from fresh Supabase (merge two).
  - `build_flyer_design_wrapper.py` → call `scripts/render-just-listed-flyer.mjs`.
  - `build_ig_single_post_wrapper.py` → config-driven compositor.
  - `build_neighborhood_tour.py` → real pipeline OR refuse non-matching payload.
  - `build_clip_compilation.py` → `lib/asset-library.mjs` query, not hardcoded paths.
- [ ] **Slice 3 — Tier 2 data-accuracy (§0):** `data_viz_video` kill hardcoded `PRICES` in
  `build_data_viz_video.py:20` + `video/data_viz_video/src/DataVizComp.tsx:79`, pull live
  `market_stats_cache`; wire Spark |delta|>1% gate (typed in `VideoProps.ts`, never called).
- [ ] **Slice 4 — Tier 2 quality:** `build_listing_reveal.py` → render its Remotion comp;
  earth_zoom/google_maps_flyover → real `_real.py` 3D-tiles default; route ALL VO via `_voice_lib`
  (fix `prepare-tour.ts` inline + 12 drifted `listing_video_v4/scripts/synth_*.py`); forced-alignment
  captions everywhere; `check_first_frame.py` on ~11 video build scripts; flat producers
  `load_recon()` from `out/design-recon/<fmt>/recon.md`.
- [ ] **Slice 5 — AI-video (smoke FIRST, memory `smoke_test_before_bulk_spend`):** reusable
  Replicate i2v/t2v helper w/ intelligent prompts; smoke 1 hero + 1 b-roll (~$1); SHOW Matt before default.
- [ ] **Slice 6 — local render worker** `scripts/render-worker.mjs`: poll `in_production` (visual) →
  `run-producer.mjs` → real artifact + citations + scorecard → `ready`. Document run steps.
- [ ] **Slice 7 — harden + refresh:** `test-all-producers.mjs` payload-variance assertion
  (listing A ≠ listing B); CAPI on buyer LP; punch list for env-blocked (blog/newsletter/avatar) +
  missing producers; refresh `video_production_skills/API_INVENTORY.md`; final `npm run ci:gates` + validator sweep green.

## Guardrails for this build
- Draft-first §0.5: any rendered deliverable → show Matt before commit. Code/skill infra commits freely.
- §0 data accuracy outranks all: real numbers from live queries, never invented.
- Smoke-test paid APIs (Replicate) on 1 item before any batch.
- Serial execution; verify each file op; MCP for DB.
