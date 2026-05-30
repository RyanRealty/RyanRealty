# Producer executor architecture — keystone finding + decision needed (2026-05-29)

This supersedes the "Execution-path caveat" in `PRODUCER_TOOL_UTILIZATION_AUDIT_2026-05-28.md`. The dispatch trace settled the open question and found the **root cause of producer slop**. It is not (only) the copy-wrapper stubs — it is the deployed executor itself.

## What actually runs in production

Deployed cron chain (scheduled in `vercel.json`):

- `producer-dispatcher` — `23 * * * *` — `pending` → `in_production`, writes a dispatch envelope.
- `producer-runtime` — `47 * * * *` — `app/api/cron/producer-runtime/route.ts`.
- `publisher-sweep` — `53 * * * *` — publishes `approved` rows.

`producer-runtime` reads the producer's `SKILL.md`, then calls the Anthropic **Messages API with NO tools** (`model: claude-sonnet-4-5`, `max_tokens: 4096`). Its system prompt (route lines 183-195) literally tells Claude to *"produce the required output as a valid JSON object"* containing `draft_path`, `citations[]`, `scorecard{}`, `publish_payload`, `contact_sheet_path`. The row then flips to `ready`.

The **admin one-shot** (`app/api/admin/run-producer/[id]/route.ts`) is the same text-only call.

## Why this is the slop root cause (and a §0 violation)

1. **It renders nothing.** Vercel serverless has no Remotion/Chromium/PIL/Puppeteer/ffmpeg and a 300s cap. The `draft_path` Claude returns points at a file that was never written.
2. **It fabricates citations + scorecards.** Claude is asked to emit `citations` and a viral `scorecard` for a deliverable that does not exist. That is invented data — a direct violation of CLAUDE.md §0 ("every number traces to a live query") and the anti-slop manifesto.
3. **The real generators are never invoked by the deployed pipeline.** `build_*.py`, `render-*.mjs`, Remotion comps, and `/api/cma` are reachable only via the orchestrators (`build-*-orchestrator.mjs` → `run-producer.mjs`), `test-all-producers.mjs`, and the CLI — none of which the Vercel cron calls.
4. **Separately, on the orchestrator/CLI path, the Tier-1 stubs ship a frozen Tumalo exemplar** regardless of payload (see the main audit doc Tier 1).

Net: no producer currently emits a real, payload-specific, verified visual deliverable through automation.

## The structural constraint

Vercel cannot render video or composite images (no native render stack, 300s ceiling, no GPU). The Mac already does — `npx remotion render`, PIL, Puppeteer, Replicate, ElevenLabs, live Supabase. So the rendering must happen on a real machine, not in the serverless cron. This is not a preference; it is a hard platform limit.

## Decision made (2026-05-29): cloud queues, local worker renders

- **Cloud brain** decides + queues: writes `in_production` rows with a fully data-verified payload (numbers already pulled + cross-checked, so the renderer never invents them).
- **Text-only producers** (blog, listing-description, cma-narrative, ad copy, captions, GBP post) may legitimately finish in the cloud cron — their deliverable *is* text — but the cron must be changed to **verify numbers, not fabricate them**, and to **refuse visual producers** instead of hallucinating a `draft_path`.
- **Local render worker** (new component): polls `in_production` rows for visual/video producers, runs the **real** generator via `run-producer.mjs`, produces the real artifact + real citations (live query) + real scorecard (actual render + first-frame gate), flips to `ready`.
- **Matt reviews** (draft-first §0.5) → `publisher-sweep` publishes.

## What this means for the "fix it all" work

- **Rewiring Tier-1 stubs to real generators is correct in every model** — the build scripts must become real, payload-driven generators no matter who calls them. This proceeds now.
- **Tier-2 data-accuracy + quality fixes proceed now** — they harden the real generators the worker will call.
- **The new architectural piece is the local render worker + de-fabricating the cloud cron.** That is the highest-leverage single fix (it is what stops the pipeline from publishing invented citations), but it is a new component, so it is called out here as an explicit decision rather than buried in a script edit.

## Build order

1. Make the real generators real + verified (Tier 1 rewire, Tier 2 data-accuracy, quality libs). ← in progress
2. Harden the cloud cron: text-only producers verify-not-fabricate; visual producers are refused (no hallucinated draft_path) until the worker handles them.
3. Build the local render worker (`scripts/render-worker.mjs`): poll `in_production` for visual producers → `run-producer.mjs` → real artifact + citations + scorecard → `ready`.
4. Fix `test-all-producers.mjs` to assert payload variance (listing A render ≠ listing B render) so stubs can never pass green again.
