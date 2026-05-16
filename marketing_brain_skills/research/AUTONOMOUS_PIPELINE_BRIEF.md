# RYAN REALTY MARKETING PIPELINE · End-to-end build brief

**For:** a fresh Claude Code session
**Author:** Matt Ryan, Ryan Realty
**Drafted:** 2026-05-16
**Repository root:** `/Users/matthewryan/RyanRealty`

Paste this whole document as the first message of a new Claude Code session. The orchestrator in that session is you. The brief is fully self-contained.

---

## 1 · Mission

Build Ryan Realty's complete autonomous marketing pipeline. End state: a closed loop where a brain reads analytics, decides what content to make, dispatches producers, the producers create content using documented tools and platform expertise, content lands in an asset library, Matt approves, content publishes, performance metrics flow back to the brain, and the brain learns which patterns reuse well.

You are building the entire stack: brain → producers → asset library → approval → publish → analytics → reuse.

Do not stop until the closed loop runs end-to-end on at least one smoke-test action and the deliverables in §11 are all on disk and ready for Matt's review. This is the only thing this session does.

---

## 2 · Non-negotiable guardrails

These are hard. Violating any one of them invalidates the whole build.

1. **Draft-First, Commit-Last.** Never commit or push to git without Matt's explicit per-turn "ship it" approval. Never publish to any external platform without explicit per-asset approval. All work lands in scratch paths (`out/`, `marketing_brain_skills/research/`, gitignored locations) until Matt signs off.
2. **Em-dash and en-dash ban.** Run `node -e "require('./lib/punctuation-guard.ts')"`-style validation or grep `[–—]` on every text artifact (every SKILL.md, every research bible, every caption, every blog draft, every email body) before declaring it done. Zero matches required. The guard is at `lib/punctuation-guard.ts`. See `marketing_brain_skills/brand-voice/voice_guidelines.md` §6.1 for the ban rationale.
3. **No fabricated capabilities.** Every claim about a tool, API, model, or platform must trace to either an actual API doc URL, a verified test call you made in this session, or a citation to existing repo documentation. If you cannot verify a claim, mark it `[unverified]` and surface it for Matt instead of asserting it.
4. **No shortcuts in research phases.** If a tool has 20 sub-tools, document all 20. If a platform has 8 surfaces, document all 8. If a model family has 12 versions, list them with capability deltas. The word "comprehensive" in this brief is not aspirational, it is a hard requirement.
5. **No skipping mandatory references.** Every producer SKILL.md must cite all 7 mandatory references (listed in §6.6 below). Auto-validate before declaring a producer done.
6. **No marking a phase done until its verification gate passes.** Gates are in §6.
7. **No spending money without per-call Matt approval.** Replicate, xAI, Veo, Apify (beyond minimal scrapes), Synthesia, virtual-staging APIs, paid Google Maps quota beyond free tier — all require explicit Matt approval before the call. Surface the cost estimate and wait.
8. **Voice rules apply to everything you author.** `marketing_brain_skills/brand-voice/voice_guidelines.md` v1.5 §11.0 governs every line of text in every SKILL.md, every bible, every caption, every email. Read it first. No banned phrases, no caption bylines, no off-market framing, no architect hashtags, no "stepping into this next chapter," no congratulations to invented parties.
9. **Audit logs at every phase.** Each phase writes a `phase-N-log.md` to `marketing_brain_skills/research/` listing what was done, what was skipped (with reason), what was blocked. No phase passes without its log.
10. **Stop and surface, do not push past blockers.** If a phase exceeds 1.5× its estimate or a verification gate fails, write a clear blocker report and stop. Wait for Matt's direction. Do not silently degrade quality to keep moving.

---

## 3 · Required reading (do this in full, in this order, BEFORE Phase 0)

Load every one of these in full. Not a summary, not an excerpt, the whole file:

1. `CLAUDE.md` — repo-level rules, especially §0 Data Accuracy, §0.5 Draft-First / Commit-Last, §0.7 Brand Voice, §0.8 Video Build Hard Rules, the Design System v2 section, and the Marketing Brain Architecture section.
2. `marketing_brain_skills/producers/REGISTRY.md` — the producer catalog (Sections A through I).
3. `marketing_brain_skills/producers/TEMPLATE.md` — the producer SKILL.md template (10 base sections).
4. `automation_skills/content_engine/SKILL.md` — content routing bus.
5. `automation_skills/automation/publish/SKILL.md` — canonical publish skill with platform matrix.
6. `marketing_brain_skills/brand-voice/voice_guidelines.md` v1.5 — the voice contract.
7. `marketing_brain_skills/brand-voice/corpus/gbp_responses.md` — Matt's actual writing corpus for voice validation.
8. `video_production_skills/asset-library/SKILL.md` — the asset library spec.
9. `social_media_skills/platform-best-practices/SKILL.md` — the current platform layer (to be expanded by Phase 2).
10. `video_production_skills/VIDEO_PRODUCTION_SKILL.md`, `video_production_skills/ANTI_SLOP_MANIFESTO.md`, `video_production_skills/VIRAL_GUARDRAILS.md` — video build floor.
11. `lib/punctuation-guard.ts` — em-dash hard ban implementation.
12. `out/proof/2026-05-14/publish-status.json` — last live publish run, reference for what working external IDs look like.
13. `out/proof/2026-05-14/research-broker-captions.md` — last research run on top broker captions; expand and integrate into the platform bible.

Write a `phase-0-required-reading-log.md` at the end confirming every file was loaded and listing each one's last modification date.

---

## 4 · End-state definition (you are done when ALL of these are true)

1. Three canonical research bibles exist under `marketing_brain_skills/research/`:
   - `tool-inventory.md` (every MCP, every lib helper, every package, every API key, every Replicate model, every Google Maps surface, every AI service)
   - `platform-bible.md` (every social, email, blog, print surface with 2026 algorithm, format spec, viral pattern corpus, real-estate compliance rules)
   - `asset-library-map.md` (every storage location, naming convention, manifest schema, reuse query patterns)
2. A fourth artifact `tool-acquisition-recommendations.md` aggregates every producer's "what tool would make this 10× better" with cost tiers and impact ranking.
3. `marketing_brain_skills/producers/REGISTRY.md` is updated with all new producer rows and `broker-contact-card` is registered.
4. 50 producer SKILL.md files exist (32 existing retrofitted + 18 new). Each has all 11 sections per §6.5 below. Each cites all 7 mandatory references. Each declares `action_types:` in frontmatter matching its registry row exactly.
5. The 10 brain skills (`weekly-cycle`, `diagnose-performance`, `generate-briefs`, `audit-ads`, `audit-crm`, `audit-website`, `brand-voice`, `competitor-recon`, `platform-trends`, `snapshot-channels`) are audited and gaps backfilled.
6. The performance feedback loop is wired: `content_performance` Supabase table schema confirmed, `automation_skills/automation/performance_loop/SKILL.md` reads from it, brain `generate-briefs` reads performance trends to bias next-cycle decisions.
7. Asset library reuse intelligence is wired: producers can query "what worked best on IG Reels for under-contract posts in the last 90 days" via the manifest schema before deciding to render fresh vs repurpose existing.
8. Publishing layer bugs are documented (LinkedIn image path missing, X v1.1→v2 media migration, IG carousel polling) with action items.
9. One smoke-test action runs end-to-end: synthetic action row → content_engine routes → producer executes → output stored → surfaced to Matt as a contact sheet. No real publish.
10. A single review HTML at `out/proof/<today>/pipeline-build-summary.html` shows every artifact with status, links, and a single ship CTA.
11. **Producer Catalog UI** exists at `/admin/producers` (Next.js page, shadcn/ui only per CLAUDE.md design rules). Grid view of every producer with name, category, what it makes, 3-6 example thumbnails from the asset library, required + optional inputs, status. Detail view per producer with full description, all example outputs, tool stack, platform stack, recipe, and a comment box that creates a `producer_change_request` row. Matt can filter by category, status, output_type, platform.
12. **Approval Queue UI** exists at `/admin/approval-queue` (Next.js page, shadcn/ui only). Reads `marketing_brain_actions` where `status='ready'`. Per-action card with rendered preview (image carousel, video player, blog preview, etc.), all per-platform captions in code blocks, comment thread, and action buttons: Approve & ship / Approve & schedule / Request changes / Reject / Duplicate as new variant. Comments stored on the action row as a JSONB thread; approve flips status to `approved` which the existing publish skill picks up.

---

## 5 · Pipeline phases (run in this exact order; verify gates before advancing)

### Phase 0 · Pre-flight (you, in-context, ~15 min)

- Complete the §3 required reading.
- Write `phase-0-required-reading-log.md` confirming.
- Verify the four sub-agent types you'll dispatch (`general-purpose`, `Explore`, `Plan`, `brand-voice:enforce-voice`, plus the deferred MCP tools you can load via ToolSearch) are available.
- Lock canonical output paths under `marketing_brain_skills/research/` and per-producer SKILL.md paths.

### Phase 1 · Tool intelligence bible (1 deep agent, ~3 hours, parallel with Phase 2)

Output: `marketing_brain_skills/research/tool-inventory.md`

Document with cost, capability detail, rate limits, known bugs, and "right tool for what / wrong tool for what":

- Every MCP server in `~/Library/Application Support/Claude/claude_desktop_config.json` (and the system reminder MCP list). Cover at minimum: Figma, Gmail, Calendar, Supabase, Drive, Apify, Slack, Canva, Airtable, Vercel, ElevenLabs, computer-use, Read/Send iMessages, PDF Tools, PowerPoint, Claude Preview, Claude in Chrome, Control Chrome, Apollo, Enterprise Search, MCP Registry, ccd-directory, ccd-session-mgmt, scheduled-tasks, pdf-viewer. For each: list every sub-tool, every parameter, what it can / cannot do.
- Every `lib/*` helper module in the repo. Read each file. For each: what it exports, what API it wraps, known gotchas.
- Every npm + python package used by producers. Find via grep of `import` / `require` / `from` statements across `scripts/`, `listing_video_v4/`, `video/`, `app/`. Include Remotion, Sharp, Playwright, Pillow, ffmpeg, etc.
- Every API key in `.env.local` and what it unlocks. Read the file. For each key: which service, which scopes, what producers use it, current expiry if known.
- Replicate model registry. List every model relevant to real-estate content: Kling v2.1 Master, Kling v2.1 Pro, Veo 3, Hailuo 02, Seedance 1 Pro, Wan 2.5 i2v, Luma Ray 2, plus depth (MiDaS, Depth Anything V2), audio (musicgen, stable-audio), OCR, virtual staging models. Per model: input format, output format, cost per second or per call, max duration, quality tier, when to choose it vs alternatives.
- Google Maps API surface (exhaustive, because Ryan Realty is a real-estate brokerage and mapping is core): Maps Static API, Maps JavaScript API, Aerial View API, Solar API, 3D Tiles, Street View Static API, Places API (Text Search, Nearby Search, Place Details, Photos), Directions API, Distance Matrix API, Geocoding API, Elevation API, Earth Engine if accessible, plus Google Earth Studio for cinematic flythroughs. Mapbox layers and Apple MapKit JS for comparison. Per surface: cost, quota, best use case, what it returns.
- xAI Grok (current model lineup, capabilities, cost, access status), Veo 3 (access path: Google AI Studio vs Replicate), Synthesia tier we're on if any, Canva MCP capability matrix, ElevenLabs voice library + the Victoria voice settings (canonical per CLAUDE.md), Apify actor catalog (which real-estate actors are useful, what they cost), Apollo capabilities, Enterprise Search.
- AgentFire WordPress REST API (blog publishing), Resend (transactional email), Supabase (tables, storage buckets, edge functions), FUB (Follow Up Boss CRM API).

For every entry include: capability summary, cost, rate limits / quotas, known bugs or gotchas, the producer types that would use it, and the model/version. Where capabilities have evolved recently (Kling versions, Veo access tiers, xAI model lineup), note the date of the information and link to the source.

Minimum word count: 8,000 words. Minimum citations: 50.

### Phase 2 · Platform intelligence bible (1 deep agent, ~3 hours, parallel with Phase 1)

Output: `marketing_brain_skills/research/platform-bible.md`

For every surface a Ryan Realty producer ships to:

Surfaces: Instagram (Feed, Reels, Stories, Carousel), Facebook (Feed, Reels, Stories, Groups, Marketplace), TikTok, YouTube (long-form, Shorts), LinkedIn (Feed, Document Carousel, Native Video), X, Pinterest, Threads, Nextdoor, Google Business Profile, Email (Resend), AgentFire blog, USPS direct mail (postcards), yard signs (physical), Zillow / Realtor.com (listing syndication).

Per surface: 2026 algorithm details (not 2024, not 2025), exact format spec (aspect ratio, length range, character limits, hook timing in frames), hashtag strategy + count + placement, posting cadence, best times in Mountain Time, what's banned / what gets suppressed, real-estate compliance (NAR Clear Cooperation Policy MLS Statement 8.0, fair-housing protected-class rules, Oregon state MLS rules where applicable).

Viral pattern corpus: at least 10 verbatim caption examples per surface from real top creators (Glennda Baker, Madison Sutton, Daniel Heider, Levi Pinson, Cash Jordan, Aaron Kirman, Branden Williams, Ryan Serhant, Josh Flagg, plus regional Pacific NW + mountain-town brokers from Bend, Bozeman, Park City, Truckee, Sun Valley, Aspen). Include engagement numbers where available. Cite each with source URL.

Explicit "viral headless content" section per surface: what logo-free, muted-feed-optimized, brand-restrained content looks like in 2026. Top creators do not put their brokerage logo on short-form. Document this pattern with examples.

Real-estate compliance section per surface: how to reference off-market, sold, pending, just-listed without triggering MLS reporting violations or fair-housing complaints. Pull from `out/proof/2026-05-14/research-broker-captions.md` and expand.

Minimum word count: 10,000 words. Minimum verbatim caption examples: 200 across all surfaces.

### Phase 2.5 · Asset library map (1 agent, ~45 min)

Output: `marketing_brain_skills/research/asset-library-map.md`

Document every storage destination where Ryan Realty content lives, with naming conventions and reuse rules. Required coverage:

- Supabase Storage `asset-library` bucket (verify by hitting the actual bucket; the 2026-05-14 publish run used `social-drops/2026-05-14/<property>/`).
- `data/asset-library/manifest.json` (read the actual schema; see `video_production_skills/asset-library/SKILL.md`).
- `public/list-kits/<address>/v3/` for shipped listing kits.
- `out/proof/<date>/rendered/` for in-flight artifacts (gitignored).
- AgentFire WordPress media library (for blog images).
- Google Business Profile media library (auto-refreshed via `app/api/cron/gbp-media-refresh/` if it exists).
- `listing_video_v4/public/` (Remotion static assets).
- `listing_video_v4/out/` (Remotion renders, gitignored).
- `design_system/ryan-realty/assets/` (brand assets, broker headshots, hero photos, mascot Jax).

Per location: schema, naming convention, who writes to it, who reads from it, retention policy, reuse query patterns ("how does a producer ask 'has this house been featured before' or 'what worked best on IG Reels last quarter'").

Surface a recommended canonical store going forward if the current state is fragmented.

Minimum word count: 3,000 words.

### Phase 3 · Gate 1 verification (you, in-context, ~30 min)

For each of the three Phase 1/2/2.5 outputs:
- Open the file, run word count, confirm minimum met.
- Grep for em-dashes and en-dashes, confirm zero.
- Spot-check 5 random citations: are they real URLs that resolve, real API endpoints that exist, real captions verbatim?
- Spot-check that every banned pattern from voice_guidelines.md §11.0 is absent.

If any gate fails, write `phase-3-gate-1-blocker.md` and stop. Do not advance.

### Phase 4 · Registry refresh (you, in-context, ~30 min)

- Add the 18 new producer rows to `marketing_brain_skills/producers/REGISTRY.md`. New producers (canonical list):
  - Video: `map_route_video`, `school_district_overlay`, `walkability_overlay`, `market_pulse_short`, `clip_compilation`
  - Image: `virtual_staging`, `floor_plan_render`, `comparable_grid`, `testimonial_card`, `map_static_card`
  - Text: `newsletter`, `listing-description`, `cma-narrative`, `market-report-blog`
  - Paid: `meta-creative-variant`, `google-ads-copy`, `nextdoor-business-ad`
  - Site: `site-neighborhood-page`
  - Ops: `ops-google-ads`
  - Comms: `comms-client-update`
  - Analyze: `analyze-competitor`
- Register `broker-contact-card` (currently exists at `social_media_skills/broker-contact-card/SKILL.md`, 9.8 KB, unregistered).
- Each new row gets: action_types, approval gate, estimated runtime, notes.
- Output: a diff of REGISTRY.md changes for Matt's review.

### Phase 5 · Brain layer audit (1-2 agents, ~3 hours)

For the 10 brain skills (`weekly-cycle`, `diagnose-performance`, `generate-briefs`, `audit-ads`, `audit-crm`, `audit-website`, `brand-voice`, `competitor-recon`, `platform-trends`, `snapshot-channels`):

- Read each SKILL.md.
- Verify: clear input contract, clear output contract, references the three Phase 1/2/2.5 bibles, references content_engine for content dispatch, references content_performance for performance reads, references asset-library for reuse queries.
- Backfill any gaps.
- Wire the performance feedback loop: confirm `content_performance` Supabase table exists with the right schema (post_id, platform, externalPostId, posted_at, captured_at, metrics_json with views/likes/comments/saves/shares, asset_library_refs[]). If missing, write the migration to `supabase/migrations/<timestamp>_content_performance.sql` (do NOT apply, surface to Matt).
- Wire `automation_skills/automation/performance_loop/SKILL.md` to read content_performance and pass winning patterns back to `generate-briefs`.

Output: `phase-5-brain-layer-audit.md` listing per-skill status (locked / gaps / migration needed) plus the wiring diagram for the feedback loop.

### Phase 6 · Producer authoring (5-8 parallel agents, batched by category, ~8 hours)

Author or rewrite 50 producer SKILL.md files (32 existing + 18 new). Each follows the 11-section template (see §6.5 below). Each cites the 7 mandatory references (see §6.6). Each declares `action_types:` in frontmatter matching the REGISTRY.md row exactly. Each has Status: `Canonical · Locked: 2026-05-16`.

Batch by category (so subagents don't duplicate work):
- Batch A: Video producers (~19 producers)
- Batch B: Image producers (~13 producers)
- Batch C: Text + long-form producers (~11 producers)
- Batch D: Paid ad producers (~4 producers)
- Batch E: Site producers (~6 producers)
- Batch F: Operational producers (~7 producers)
- Batch G: Comms + Analyze producers (~5 producers)

Depth ladder:
- **Flagship producers** (~1,500 lines): listing-tour-video, market-data-video, news-video, list-kit, ig-single-post, instagram-carousel, newsletter, blog-post, linkedin-document-carousel, monthly-market-report-orchestrator.
- **Standard producers** (~800 lines): the rest of video + image + paid + site + ops.
- **Light producers** (~500 lines): low-volume formats like yard-sign-rider, neighbor-outreach-note, testimonial-card.

Each producer's "The recipe" section (template §5) must be testable: it lists exact tool calls, file paths, Supabase queries, API endpoints. An agent reading the recipe can execute it end-to-end.

Each producer's Section 11 (tool gap suggestions) lists what additional tools or models would make this producer 10× better. Phase 9 aggregates these.

### Phase 7 · Asset library + reuse intelligence wiring (1 agent, ~1.5 hours)

- Confirm `data/asset-library/manifest.json` schema supports reuse queries by tag, surface, format, performance tier, age.
- Confirm every producer's Section 6 declares its asset destination and matches what's actually in the manifest.
- Wire `content_performance` ↔ asset library back-references so the brain can query "show me the IG Reel that drove the most saves in the last 90 days for under-contract posts in NE Bend."
- Write a `marketing_brain_skills/research/reuse-query-patterns.md` documenting the queries producers should ask before rendering fresh: "has this content type / address / topic been featured in the last 30 days?" "what variant performed best last cycle?" "is there a reusable asset we can repurpose?"

### Phase 8 · Publishing layer audit (1 agent, ~1 hour)

Audit `/app/api/social/publish/route.ts`, `lib/meta-graph.ts`, `lib/linkedin.ts`, `lib/x.ts`, `lib/google-business-profile.ts`, `lib/buffer.ts`. Surface the known bugs already identified (LinkedIn image-post path missing, X v1.1 → v2 media migration, IG carousel `status_code=FINISHED` polling). Add an action-item list of fixes Matt needs to greenlight separately.

Output: `phase-8-publishing-layer-audit.md`.

### Phase 9 · Tool gap aggregation (1 agent, ~45 min)

Read every producer's Section 11. Aggregate into `marketing_brain_skills/research/tool-acquisition-recommendations.md`. Categorize by cost tier (free, <$25/month, <$100/month, >$100/month). Rank by impact (how many producers each gap blocks). Surface specific recommendations: xAI Grok subscription, Veo 3 access path, virtual-staging API, Pinterest OAuth, TikTok OAuth + app audit, paid Google Maps quota, Synthesia tier upgrade.

### Phase 10 · End-to-end smoke test (1 agent, ~45 min)

- Pick one new producer (recommend `newsletter` because it touches multiple platforms and the asset library).
- Construct a synthetic `marketing_brain_actions` row (in scratch, not the real table) for `content:newsletter` with realistic payload.
- Route through `automation_skills/content_engine/SKILL.md` resolution logic.
- Producer loads its SKILL.md, follows the recipe, produces a draft.
- Output written to asset library destination per producer's Section 6.
- Surface as a contact sheet under `out/proof/<today>/smoke-test/`.
- NO REAL PUBLISH. NO REAL TABLE WRITE.

Output: `phase-10-smoke-test-result.md` with the contact-sheet path and what the producer asked / didn't ask Matt (testing the "auto-load layout, ask only essentials" UX).

### Phase 10.5 · Producer Catalog UI (1 agent, ~2 hours)

Output: a Next.js page at `app/admin/producers/page.tsx` and supporting components under `app/admin/producers/_components/`.

- Build behind admin auth (use the same pattern as any existing `/admin/*` route in the repo; if none exists, scaffold a minimal middleware-level password check using an env var `ADMIN_DASHBOARD_TOKEN`).
- shadcn/ui only. Brand tokens (navy `#102742`, cream `#faf8f4`, Geist font) per CLAUDE.md design system rules. No raw HTML buttons, no hex codes outside `--primary`.
- Grid view: one Card per producer, ordered by category section (A–F from REGISTRY.md). Card shows: producer name (Geist 600), category badge, one-sentence "what it makes" pulled from SKILL.md frontmatter `description`, 3-6 example thumbnails pulled from `example_outputs:` frontmatter (which Phase 6 populated). Required-input chips. Status pill (Locked / Draft / Needs Tool / Needs OAuth).
- Detail route: `/admin/producers/[slug]` shows full SKILL.md rendered as MDX, an Examples gallery (all `example_outputs[]`), and an "Edit producer" panel.
- **Edit producer** panel: a Textarea + Submit button. On submit, writes a new row to `producer_change_requests` table (schema: id, producer_slug, requester, request_text, requested_at, status[pending|in_progress|drafted|approved|rejected], drafted_diff_path, drafted_sample_render_path, completed_at). The orchestrator agent (separate skill, not built in this phase but stubbed) picks it up, drafts a SKILL.md diff plus a sample new render, surfaces both for Matt's approval in the same UI. For this phase, just build the form + the table + the row insert. Mark the orchestrator side as a stub with a clear TODO comment.
- Data source: producers loaded by parsing every SKILL.md under `marketing_brain_skills/producers/*/SKILL.md`, `social_media_skills/*/SKILL.md`, `video_production_skills/*/SKILL.md`, `automation_skills/**/SKILL.md`. Use gray-matter or equivalent to parse frontmatter. Cache the parse result in `lib/producer-catalog.ts`.
- Examples loaded from `example_outputs:` frontmatter (URLs to Supabase asset-library, public/list-kits, or out/proof rendered files).
- Filter sidebar: category, status, output_type, target_platforms.
- Search box: free-text against name + description.
- Output: working page + supporting components + the migration file at `supabase/migrations/<timestamp>_producer_change_requests.sql` (do NOT apply, surface to Matt).
- Verification gate: page builds (`npm run build`), renders without errors, lists at least 50 producer cards, every card has an example thumbnail.

### Phase 10.6 · Approval Queue UI (1 agent, ~2 hours)

Output: a Next.js page at `app/admin/approval-queue/page.tsx` and supporting components under `app/admin/approval-queue/_components/`.

- Behind same admin auth as Phase 10.5.
- shadcn/ui only.
- Lists all rows from `marketing_brain_actions` where `status IN ('ready', 'needs_changes')`, ordered by `executed_at DESC`.
- Per-action card layout:
  - Top: producer name + target (mls_id / city / topic) + action_type + estimated impact.
  - Middle: rendered preview. For image / carousel, embed images. For video / reel, embed `<video controls>`. For blog, embed iframe of the draft. For email, render the HTML inside an iframe.
  - Per-platform captions: each platform in its own collapsible block with copy-to-clipboard button.
  - Right side: action buttons (Approve & ship now, Approve & schedule, Request changes, Reject, Duplicate as new variant).
  - Bottom: comments thread.
- Comments thread: stored as a JSONB `comments` array on the `marketing_brain_actions` row. Schema per comment: `{id, author, body, posted_at, type[change_request|note|approval_note]}`. Matt types a comment, posts it. Backend writes to the JSONB array. If the comment is type `change_request`, the row's status flips to `needs_changes` and the producer is notified (write to `marketing_brain_actions.needs_changes_at` and trigger a re-render request).
- Action buttons:
  - **Approve & ship now**: status → 'approved', `approved_at` = now, `approved_by` = 'matt'. The existing publish skill picks it up on its next sweep. Surface a confirmation toast with the post URLs once available.
  - **Approve & schedule**: opens a date/time picker, writes `scheduled_for` (Mountain Time), flips status → 'approved'. The post_scheduler skill picks it up.
  - **Request changes**: opens a comment box (must include change request body), writes to comments JSONB, flips status → 'needs_changes'.
  - **Reject**: confirmation dialog, flips status → 'killed' with required reason in `killed_reason`.
  - **Duplicate as new variant**: opens a producer-selection dialog where Matt can pick "use the same producer with these payload tweaks" or "spin this off as a new producer based on `<original>`". The latter creates a `producer_change_requests` row of type `duplicate_with_changes`.
- Data source: Supabase `marketing_brain_actions` table. If the JSONB `comments` column doesn't exist yet, write the migration at `supabase/migrations/<timestamp>_approval_queue_columns.sql` (do NOT apply, surface to Matt).
- Filter sidebar: by producer category, action_type prefix (content / site / ops / comms / analyze), urgency (any `priority` field on the action row).
- Real-time updates: use Supabase Realtime channel on `marketing_brain_actions` so new pending rows appear without refresh.
- Verification gate: page builds, renders without errors, can render at least one mocked pending row of each major media type (image, carousel, video, blog, email).

### Phase 11 · Final review surface (you, in-context, ~30 min)

Compile everything into `out/proof/<today>/pipeline-build-summary.html`:

- Phase-by-phase status table (every phase: green / yellow / red with link to log).
- The three bibles with table of contents.
- The 50 producer cards (each with category, status, line count, key tool/platform stack, link to SKILL.md).
- Brain layer status with the feedback-loop wiring diagram.
- Tool gap recommendations report.
- Smoke test contact sheet.
- **Live links to `/admin/producers` and `/admin/approval-queue`** (both pages built in Phases 10.5 and 10.6) — these are the daily-use surfaces Matt will return to after the build is done.
- A single CTA section with options: `ship the rollout`, `ship per-phase`, `fix X first` (where X is specific to any verification gate that didn't pass).

This HTML is what Matt opens to approve the build.

---

## 6 · Verification gates, templates, and references

### 6.1 · Phase gate checklist (run at end of EVERY phase)

- Word count meets minimum.
- `grep -P '[–—]'` returns zero matches across all phase outputs.
- Voice guardrails: no banned phrases ("stepping into," "honored to have been," etc.), no caption bylines, no off-market framing in any text that's external-facing.
- Citation spot-check: 5 random citations confirmed real.
- Reference completeness: every producer SKILL.md cites all 7 mandatory references.
- Frontmatter validity: `action_types:` matches REGISTRY.md row.

### 6.2 · Audit log format

Every phase writes `marketing_brain_skills/research/phase-N-log.md` with:
- Phase name, started_at, finished_at, agent_id.
- Inputs consumed (files read, web queries made).
- Outputs produced (files written, lines, words).
- Cost (Anthropic tokens spent, Apify API calls, any paid-tool calls).
- Skipped items + reason.
- Blockers encountered + resolution.

### 6.3 · Cost budget

Total Anthropic token budget: $200 maximum. If approaching $150, surface a status update and ask Matt for headroom approval. Sonnet for research synthesis and producer authoring. Opus stays in the orchestrator seat. Apify minimal (caption scrapes only, < $5 total). No Replicate / Veo / xAI / Synthesia calls in this build.

### 6.4 · Wall-clock budget per phase

- Phase 0: 15 min
- Phase 1: 3 hours
- Phase 2: 3 hours (parallel with Phase 1)
- Phase 2.5: 45 min
- Phase 3: 30 min
- Phase 4: 30 min
- Phase 5: 3 hours
- Phase 6: 8 hours
- Phase 7: 1.5 hours
- Phase 8: 1 hour
- Phase 9: 45 min
- Phase 10: 45 min
- Phase 11: 30 min

Total: ~16-20 hours wall-clock. If any phase exceeds 1.5× its estimate, stop and surface to Matt with a blocker report.

### 6.5 · Per-producer SKILL.md template (11 sections, MANDATORY)

```
---
name: <producer-name>
description: One sentence: what this producer makes, for which surface, what triggers it.
action_types:
  - content:<action_slug>
  (or site:* / ops:* / comms:* / analyze:* — match REGISTRY.md exactly)
output_type: video|image|text|document|paid-ad|web-page|operational
target_platforms: [list of surfaces from platform-bible]
asset_destination: <storage location for reuse>
auto_inputs: [from MLS / Supabase / brand]
required_inputs: [smallest possible list of things Matt must provide]
optional_inputs: [defaults]
estimated_runtime_min: <number>
cost_usd_estimate: <range>
thumbnail_uri: <URL to one canonical example output, used as the producer's card image in the Catalog UI>
example_outputs:
  - uri: <URL to past approved render>
    label: <short caption, e.g. "Schoolhouse · Pattern A · 2026-05-15">
    surface: <ig_carousel | ig_reel | fb_feed | linkedin_doc | ... matching target_platforms>
  - uri: <URL>
    label: <...>
    surface: <...>
  # 3 to 6 entries minimum. Pulled by /admin/producers Catalog UI.
---

# <Producer Name>

**Scope:** one paragraph.
**Status:** Canonical
**Locked:** 2026-05-16
**Exemplar output:** <path>

## 1. What it makes
## 2. Input contract (auto / required / optional)
## 3. Tool stack (with cost and known bugs, citing tool-inventory.md)
## 4. Platform stack (with format spec, citing platform-bible.md)
## 5. The recipe (end-to-end, testable)
## 6. Asset library wiring (storage path, naming convention, reuse query pattern, citing asset-library-map.md)
## 7. Publishing flow (platforms in order, scheduling, OAuth status)
## 8. QA gate (format-specific checks)
## 9. Failure modes + recovery
## 10. Mandatory references
## 11. Tool gap suggestions (what would make this 10× better)
```

### 6.6 · Seven mandatory references (every producer cites all of these)

1. `CLAUDE.md` §0 (Data Accuracy)
2. `CLAUDE.md` §0.5 (Draft-First, Commit-Last)
3. `design_system/ryan-realty/SKILL.md`
4. `marketing_brain_skills/brand-voice/voice_guidelines.md`
5. `marketing_brain_skills/research/tool-inventory.md`
6. `marketing_brain_skills/research/platform-bible.md`
7. `marketing_brain_skills/research/asset-library-map.md`

Content producers (anything in Section A or B of REGISTRY.md) additionally cite:

8. `automation_skills/content_engine/SKILL.md`
9. `social_media_skills/platform-best-practices/SKILL.md`
10. `video_production_skills/ANTI_SLOP_MANIFESTO.md`
11. `video_production_skills/VIRAL_GUARDRAILS.md`

### 6.7 · Sub-agent dispatch pattern

- Use `general-purpose` for deep research with web access.
- Use `Explore` for codebase-only investigation (read-only, faster).
- Use `Plan` for architecture decisions.
- Use `brand-voice:enforce-voice` for voice validation of any external-facing text.
- Run agents in parallel when work is independent.
- Pass each subagent a tight, self-contained brief (no "you know what we were just talking about" — they don't).
- Never let a subagent self-approve its deliverable. The orchestrator runs the gate.

---

## 7 · Closed-loop architecture (the thing you are building)

```
[ Brain reads analytics ] → [ Brain decides what to make ]
            ↓
[ Action row in marketing_brain_actions ]
            ↓
[ content_engine routes to producer ]
            ↓
[ Producer reads tool-inventory + platform-bible + asset-library-map ]
            ↓
[ Producer checks asset library for reusable content ]
            ↓
[ Producer renders / drafts ]
            ↓
[ Output stored in asset library (Supabase + manifest) ]
            ↓
[ Surfaced to Matt as contact sheet ]
            ↓
[ Matt approves / rejects ]
   ↓                   ↓
[ Published ]    [ Logged as rejected; brain learns ]
   ↓
[ external IDs + posted_at logged ]
   ↓
[ 48h performance pull → content_performance table ]
   ↓
[ performance_loop reads content_performance ]
   ↓
[ Winning patterns surfaced to generate-briefs ]
   ↓
[ Brain biases next-cycle decisions toward winners ]
   ↓
[ loop ]
```

Every layer needs to be wired and verifiable. The smoke test in Phase 10 traces one action through Layers 1-6. Layers 7-8 (analytics feedback) are wired but not exercised until real posts have aged 48 hours.

---

## 8 · Output to Matt at completion

A single message that contains:

1. Link to `out/proof/<today>/pipeline-build-summary.html`.
2. The phase-by-phase status table (green / yellow / red).
3. Total cost spent (Anthropic + Apify).
4. Total wall-clock time.
5. The smoke test contact sheet path.
6. A bulleted "needs Matt's attention" list (publishing-layer bugs, tool acquisition recommendations, OAuth gaps, migrations to apply).
7. A single ship CTA: "approve the full build → I'll commit + push" / "approve per-phase" / "fix X first."

Stop there. Do not commit, push, or publish anything.

---

## 9 · Failure modes (when to STOP)

Stop and surface to Matt with a blocker report if:

- Any required-reading file does not exist or fails to load.
- Any phase exceeds 1.5× wall-clock estimate.
- Any verification gate fails after one retry.
- Cost approaches $150 of the $200 budget.
- A subagent returns "could not verify" on a load-bearing claim.
- An em-dash or banned phrase audit fails after retry.
- A producer's frontmatter `action_types` does not match its REGISTRY.md row after one retry.

Stop is not failure. Stop is the correct behavior when integrity is at risk.

---

## 10 · You are not doing any of these things

- Not committing.
- Not pushing.
- Not publishing.
- Not spending money on third-party services.
- Not modifying code outside the four skill trees (`marketing_brain_skills/`, `social_media_skills/`, `video_production_skills/`, `automation_skills/`) and the `lib/punctuation-guard.ts` test helper.
- Not assuming "this is roughly how it works." Every claim is verified.
- Not declaring something done until its gate passes.

---

## 11 · Final deliverables (these are the artifacts on disk when you are done)

```
marketing_brain_skills/research/
  AUTONOMOUS_PIPELINE_BRIEF.md                ← this file
  tool-inventory.md                           ← Phase 1
  platform-bible.md                           ← Phase 2
  asset-library-map.md                        ← Phase 2.5
  reuse-query-patterns.md                     ← Phase 7
  tool-acquisition-recommendations.md         ← Phase 9
  phase-0-required-reading-log.md
  phase-1-log.md
  phase-2-log.md
  phase-2.5-log.md
  phase-3-gate-1-log.md
  phase-4-registry-diff.md
  phase-5-brain-layer-audit.md
  phase-6-producer-authoring-log.md
  phase-7-asset-wiring-log.md
  phase-8-publishing-layer-audit.md
  phase-9-tool-gap-log.md
  phase-10-smoke-test-result.md
  phase-11-summary-log.md

marketing_brain_skills/producers/REGISTRY.md  ← updated with new rows

<each producer SKILL.md>                      ← 50 files, 11 sections, all references loaded

out/proof/<today>/
  pipeline-build-summary.html                 ← the single review surface
  smoke-test/                                 ← Phase 10 contact sheet
```

---

## 12 · Last word

This brief is the contract. Execute it. If something in this brief is wrong or unclear, stop and surface the issue to Matt instead of guessing. Every shortcut you don't take is a future debugging session you don't owe.

Begin with Phase 0.
