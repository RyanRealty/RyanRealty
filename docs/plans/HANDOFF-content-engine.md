# New-session prompt — CONTENT ENGINE

Paste this into a fresh Claude Code session to start/continue the content-engine initiative exactly
where we left off.

---

You are starting the **Ryan Realty content engine** — a NEW initiative, separate from the newsletter.
The goal: backfill ryan-realty.com with **hundreds of SEO- and LLM-optimized local pages** across all
of Central Oregon — **events, parks, races, festivals, points of interest, housing news, and evergreen
housing topics** — all categorized, searchable, and structured for both classic SEO and AI answer
engines (ChatGPT, Perplexity, Google AI Overviews). This library will feed the monthly newsletter
(`docs/plans/HANDOFF-newsletter.md`), which is a curator over it.

There is **no spec doc yet** — creating it is part of this session's job. Matt's process: **take stock
→ optimize what exists → find gaps → create new.** Start with the audit.

## Decisions & context already established
- **Design:** use the **existing site design system** (internally named "brutalist" — it's the premium
  cream/navy editorial look, NOT literal brutalism). No new design register. Match the site.
- **A lot already exists — audit + optimize, do NOT rebuild.** Live programmatic routes:
  `/blog/[slug]` (housing news + evergreen), `/schools/[slug]`, `/parks/[slug]` (POI), `/guides/[slug]`,
  `/area-guides`, `/cities/[slug]`, `/communities/[slug]`, `/subdivisions`, `/zip`, `/tools/*`, and an
  `llms.txt` already served (`app/llms.txt/route.ts`). These use the pattern **data + one template +
  `[slug]`** — replicate it for new types.
- **The one clear gap: EVENTS.** No events route exists (`/central-oregon/events/*` 404s). The
  newsletter needs these. Build the event-page pipeline first (matches the existing `[slug]` pattern +
  `Event` schema + a producer that seeds recurring anchors and refreshes seasonally ~2–3 weeks ahead).

## Research findings (DIRECTIONAL — the deep-research harness kept rate-limiting; re-verify the
load-bearing ones with direct WebSearch before betting on them):
- **Google's own guidance:** unique, first-hand content beats every tactic; **schema is NOT required
  for AI citation** (do it for classic rich results, not as the AEO lever); llms.txt gets no special AI
  treatment.
- **~85% of AI citations come from OFF-SITE mentions.** The content engine alone is necessary but NOT
  sufficient — add a parallel **off-site entity/reputation track** (local directories, review sites,
  "best of Bend" roundups, Reddit/forums, Wikidata / Google Knowledge Graph). Earned mentions reportedly
  lift AI citations far more than on-site pages.
- **Listicles are the most-cited page type in ChatGPT (~44%)** → build things-to-do / parks / "best of"
  content as **lists/rankings**, not prose.
- **Freshness:** content updated within 30 days gets ~3x more AI citations → a **refresh pipeline is
  core**, not optional.
- **Biggest risk (existential):** Google's 2024–2025 "scaled content abuse" / "site reputation abuse" /
  helpful-content systems. Hundreds of AI/templated pages done wrong can **demote the whole site that is
  already ranking.** The bar is: each page **genuinely more useful than what already exists**. Publish in
  **reviewed batches**, never a firehose.

## The gap list ("what did I miss" — bake these into the spec)
1. Audit must produce a **keyword/entity + cannibalization map**, not just an inventory (new pages must
   not compete with existing ones for the same query).
2. **The moat = your live MLS data + first-hand broker knowledge on every page** (median/DOM/inventory by
   neighborhood/school zone + a real local POV). That is the E-E-A-T + anti-slop differentiator.
3. **Freshness/expiry subsystem** — dated sources, seasonal/annual refresh, past-event handling
   (recurring → roll forward; one-off → archive/redirect).
4. **Taxonomy + internal linking IA** — category hubs → spokes, breadcrumbs, cross-links
   (events↔parks↔neighborhoods↔schools). Design this before generating pages.
5. **Schema per type** — Event, SportsEvent (races), Festival, Place/TouristAttraction (POI),
   EducationalOrganization (schools), Article (news), FAQPage, BreadcrumbList — for classic rich results.
6. **Legal/rights** — event copy + photos are copyrighted; scraping venue/Visit Bend calendars can
   breach ToS. Original write-ups + licensed/original photos. Neighborhood/school content is
   **fair-housing-sensitive** (no steering).
7. **Rollout + indexing** — reviewed batches, sharded sitemaps, IndexNow, watch GSC coverage.
8. **Measurement + pruning = THE LOOP** — per-page rankings (GSC), AI citations, organic traffic,
   newsletter CTR; double down on winners, prune/consolidate dead weight.
9. **Governance** — an owner + update cadence, or the library rots in a year.

## Where we left off / what's next
1. **Run the audit ("take stock"):** inventory every existing content page (`/blog`, `/schools`,
   `/parks`, `/guides`, `/cities`, `/communities`, etc.), map each to its target topic/keyword/entity,
   flag schema coverage + freshness, and surface **gaps + cannibalization**. Delegate the enumeration to
   Explore/subagents; keep the synthesis.
2. **Draft `docs/CONTENT_ENGINE_SPEC.md`** from the audit + the decisions above: content taxonomy, page
   templates per type (with schema), the data-sourcing + freshness pipeline, the off-site entity track,
   the batched-rollout + indexing plan, the measurement loop, mechanical gates, and the generation +
   human-review pipeline (brand voice + §0 accuracy + fair-housing gates on every page).
3. **Build events first** (the newsletter's blocker): route + `Event`-schema template + seed the real
   Central Oregon recurring events.

## Constraints
Brand voice (`marketing_brain_skills/brand-voice/VOICE.md`, gated) · §0 data accuracy (live + traced,
no fabricated stats/dates) · fair housing · GIS/authoritative sources only · existing design system ·
draft-first · quality bar per page (unique, first-hand, more useful than what exists) · reviewed
batches. Related skills: `searchfit-seo:*`, `automation_skills/content_engine`, the blog producer.
Note the **producer-layer freeze** (marketing execution layer is frozen maintenance-only) — confirm
with Matt whether this site-content initiative is in or out of that freeze before building autonomous
producers.
