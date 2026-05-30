# Handoff — producer "fix it all" build (2026-05-29)

**PAUSED** mid-Slice-1: the tool-output channel degraded (Bash + Read return empty/garbled).
Refusing to edit/commit code I can't read back or typecheck — that would risk shipping exactly the
unverified slop this task removes. Resume when the channel is stable. **First three commands on
resume:** `git status`, `git rev-list --left-right --count origin/main...HEAD`, `npx tsc --noEmit`.

## Channel-instability protocol
Symptom: Bash stdout (even `printf`/`git`) returns empty; `Read` of a just-written file returns
empty; occasionally a FABRICATED value (wrong row count / wrong git SHA seen earlier). Reliable
throughout: `Write` success confirmations, `Edit` success confirmations, MCP `execute_sql`.
Rule: trust only Write/Edit confirmations + MCP results. Re-run any empty Bash/Read before acting.

## Confirmed DONE + pushed (origin/main)
- `4034651`: 8 producers green; validator skip-list; **G35 gate** (`scripts/check-producer-skills.mjs`)
  in `ci:gates` + `MECHANICAL_GATES.md`; 2 audit docs.
- `89bf074`: keystone doc + architecture-decision doc + handoff.
- On resume the working tree also has UNRELATED dirty files from a parallel session
  (app/about, app/contact, app/lp/*, docs/DAL_INDEX.md, docs/DATABASE_SCHEMA_SNAPSHOT.md,
  scripts/_render-seller-ads-v10.mjs, scripts/ga4-admin.mjs, .gitignore). DO NOT touch/commit those.

## Live queue truth (MCP execute_sql — trusted)
42 rows: ready 17 (9 carry FABRICATED citations+draft_path), approved 0, executed 9 (ops/comms —
no citations expected, fine), pending 1. Fabrication PROVEN, CONTAINED (nothing approved/published).

## ⚠️ EXACT CURRENT STATE of Slice 1 (de-fabricate cron)

### File 1 — `lib/marketing-brain/producer-output-class.ts` — NEW, COMPLETE, VERIFIED ✅
Exports: classifyOutputType, classifyProducerFromDisk, canCloudComplete,
buildTextProducerSystemPrompt, buildVisualDeferralEnvelope, parseOutputTypeTokens.
Unit-tested 8/8 via `npx tsx` against real SKILL.md (cma→visual, blog-post→text,
data_viz_video→visual, cma-narrative→visual, facebook-lead-gen-ad→text, comms-matt-alert→text,
site-city-page→visual, ops-meta-ads→text). UNCOMMITTED. This file is solid — no rework needed.

### File 2 — `app/api/cron/producer-runtime/route.ts` — EDITED, 4 edits confirmed, NOT typechecked
Applied + confirmed via Edit success:
  1. import of the 4 helpers from producer-output-class. ✅
  2. skill-load block replaced with classify → if !canCloudComplete(cls): write
     buildVisualDeferralEnvelope + deferred.push + continue; else systemPrompt =
     buildTextProducerSystemPrompt(skillContent). ✅
  3. `const deferred: Array<{action_id;producer_slug;output_class}> = []` declared next to
     executed/errors (~line 166). ✅
  4. response object: added `deferred_count` + `deferred` + updated note. ✅
STILL TODO in this file (could NOT read lines ~280-313 to finish):
  - [ ] The TEXT-producer SUCCESS envelope merge (was ~lines 270-285, `updatedEnvelope`) still
        writes the OLD fabricated-shape fields: `draft_path`, `scorecard`, `contact_sheet_path`.
        For text producers those are meaningless. Change the merge to store the NEW shape:
        `deliverable_text: producerOutput.deliverable_text`, `citations: producerOutput.citations ?? []`
        (now payload-traced), `publish_payload`, drop draft_path/scorecard/contact_sheet_path
        (or set them null with a comment). Keep cost/token/model fields.
  - [ ] `npx tsc --noEmit` clean.

### File 3 — `app/api/admin/run-producer/[id]/route.ts` — NOT YET TOUCHED
Mirror the same guard (it's a near-duplicate of the cron, 277 lines):
  - [ ] import the 4 helpers.
  - [ ] after `const producerSlug = ...` (~line 100), classifyProducerFromDisk; if
        !canCloudComplete(cls): update row executor_response = buildVisualDeferralEnvelope(...),
        return NextResponse.json({ ok:true, deferred:true, output_class:cls,
        reason:'visual producer deferred to local render worker' }) — do NOT call Anthropic.
  - [ ] for text: replace the inline fabricating systemPrompt (~lines 120-132) with
        buildTextProducerSystemPrompt(skillContent).
  - [ ] update the success envelope merge (~lines 232-248) same as File 2 (new text shape).
  - [ ] `npx tsc --noEmit` clean.

### Commit for Slice 1 (code/infra — no Matt-review gate needed)
`fix(producers): de-fabricate cloud executor — defer visual producers to local render worker;
text producers forbidden from inventing figures (CLAUDE.md §0)`
Files: lib/marketing-brain/producer-output-class.ts, app/api/cron/producer-runtime/route.ts,
app/api/admin/run-producer/[id]/route.ts. (Scoped git add — exclude the parallel-session dirty files.)

## Slice 1b — kill the 9 fabricated ready rows (MCP execute_sql)
```sql
update marketing_brain_actions
set status='killed',
    executor_response = coalesce(executor_response,'{}'::jsonb)
      || jsonb_build_object('killed_reason','fabricated by text-only cron before 2026-05-29 de-fabrication fix','killed_at', now())
where status='ready' and executor_response ? 'citations';
```
(First SELECT the ids to log them. 9 rows expected.)

## Remaining slices (full plan — unchanged)
- Slice 2 — Tier 1 stub rewires (all shutil.copy Tumalo today; make payload-driven; verify each
  with a NON-Tumalo fixture → output ≠ Tumalo asset; add G22 require_action_row to touched build_*.py):
  cma_wrapper→POST /api/cma/generate; listing_tour_video→repoint producer-inventory.mjs to
  video/listing-tour/scripts/prepare-tour.ts; market_data_video+market_report_video→render
  video/market-report comp from fresh Supabase (merge two); flyer_design_wrapper→
  scripts/render-just-listed-flyer.mjs; ig_single_post_wrapper→config compositor
  (pattern render-ig-carousel-slide.mjs); neighborhood_tour→real pipeline OR refuse non-match;
  clip_compilation→lib/asset-library.mjs query not hardcoded paths.
- Slice 3 — §0 data-accuracy: data_viz_video kill hardcoded PRICES (build_data_viz_video.py:20 +
  video/data_viz_video/src/DataVizComp.tsx:79) → live market_stats_cache; wire Spark |delta|>1%
  gate (typed in VideoProps.ts sparkValue/sparkDeltaPct, never called).
- Slice 4 — quality/canonical libs: build_listing_reveal.py→render its Remotion comp;
  earth_zoom/google_maps_flyover→real _real.py 3D-tiles default (demote PIL stub); route ALL VO via
  _voice_lib (fix prepare-tour.ts inline-no-settings + 12 drifted listing_video_v4/scripts/synth_*.py);
  forced-alignment captions; check_first_frame.py on ~11 video build scripts; flat producers
  load_recon() from out/design-recon/<fmt>/recon.md.
- Slice 5 — AI-video: reusable Replicate i2v/t2v helper w/ intelligent prompts; SMOKE 1 hero +
  1 b-roll (~$1) per memory smoke_test_before_bulk_spend; SHOW Matt before making default.
- Slice 6 — scripts/render-worker.mjs: poll marketing_brain_actions where status='in_production'
  and executor_response->>'deferred_to_local_render'='true' → run-producer.mjs → real artifact +
  real citations (live query) + real scorecard (render + first-frame gate) → status='ready'.
  Document run instructions (it runs on the Mac / a render box, not Vercel).
- Slice 7 — harden + refresh: test-all-producers.mjs payload-variance assertion (listing A ≠ B so
  a copy-stub can't pass green); CAPI on buyer LP; punch list for env-blocked (blog/newsletter/avatar)
  + missing producers; refresh video_production_skills/API_INVENTORY.md; final ci:gates + validator sweep.

## Guardrails
Draft-first §0.5 (show Matt rendered deliverables before commit; code/infra commits free).
§0 data accuracy outranks all. Smoke-test Replicate before batch. Serial; verify each op; MCP for DB.
Memory: no background subagents on API-heavy pipelines; scope FUB ops to Matt only; brand-voice on all copy.
