# Prompt to paste into the new agent session

Copy everything below the `--- START PROMPT ---` line and paste it as the first message to a fresh Opus session in this repo.

---

--- START PROMPT ---

You are picking up an area-guide template overhaul for Ryan Realty (Bend, Oregon real estate brokerage on AgentFire WordPress with a Next.js frontend at ryanrealty.vercel.app).

**The mission is fully briefed in `docs/agent-handoff-area-guide-templates-2026-05-15.md` — read that file first, in full, before doing anything else.** It contains:

- The mission paragraph
- Hard constraints (CLAUDE.md sections, user-memory feedback files, design system v2)
- Data inventory across 95+ Supabase tables in project `dwvlophlbvvygjfxcrhm`
- External API credentials in `.env.local`
- Missing data sources (schools, walk score, climate, commute) and recommended fills
- Existing Next.js scaffolding (routes, lib files, server actions) — don't duplicate, extend
- 4 template specs (city, neighborhood, subdivision, listing detail) with section-by-section data sourcing
- Implementation approach (API-first via Next.js, not AgentFire UI) with two paths and a recommendation
- Build sequence
- 9 open questions to ask Matt before writing production code
- First deliverables (read everything, draft template mocks at static HTML preview URLs, get Matt's approval)

Specifically before doing anything:

1. Read `docs/agent-handoff-area-guide-templates-2026-05-15.md` cover-to-cover.
2. Read `CLAUDE.md` in full (it's already in your project instructions; re-read it).
3. Read every user-memory file in `~/.claude/projects/-Users-matthewryan-RyanRealty/memory/` — especially `feedback_gis_authoritative_only.md`, `feedback_draft_first_review.md`, `feedback_search_codebase_first.md`, `feedback_contact_sheet_required.md`.
4. Read the existing Next.js routes that overlap with your work: `app/cities/[slug]/page.tsx`, `app/cities/[slug]/[neighborhoodSlug]/page.tsx`, `app/communities/[slug]/page.tsx`, `app/area-guides/page.tsx`, `app/listings/[listingKey]/`, `app/sitemap.ts`. Also the lib files: `lib/communities.ts`, `lib/community-content.ts`, `lib/community-profiles.ts`, `lib/city-content.ts`, `lib/structured-data.ts`, `lib/slug.ts`.
5. Read the most recent SEO + GIS work logs: `docs/seo-neighborhood-polygon-fix-2026-05-14.md`, `docs/seo-audit-ryan-realty-com-2026-05-13.md`, `docs/agentfire-menu-audit-2026-05-15.md`.
6. Verify the Supabase MCP tools work (run a small test query against the `boundaries` table). If they don't, surface that immediately.
7. **Then surface the 9 open questions** from the handoff doc to Matt and wait for answers before writing production code.
8. **Then draft 4 template mocks** as static HTML files at `public/template-picker/area-templates/v1/{city,neighborhood,subdivision,listing}.html` — wire them up with real data from the database so Matt can click through actual cities/neighborhoods/subdivisions/listings and see the template in context. Per `feedback_contact_sheet_required.md`, every draft must have an HTML preview Matt can open in his browser. Tell Matt the file paths or a localhost / Vercel preview URL.
9. **Then wait for Matt's verbal approval** before scaffolding the production page templates.

Non-negotiables you cannot violate:

- **CLAUDE.md §0 Data Accuracy** — every figure on a published page traces to a verified source. No approximating. No "about." Cite the row.
- **CLAUDE.md §0.5 Draft-First, Commit-Last** — nothing ships to a tracked location or pushes until Matt has seen the draft and explicitly approved.
- **`feedback_gis_authoritative_only.md`** — polygons come from City of Bend GIS, Deschutes County DIAL, Oregon GEO, or US Census TIGER. Never approximate. Never bounding-box from memory. Never LLM-generate. Every row gets boundary_source + boundary_source_url + boundary_fetched_at + boundary_verified_by.
- **Design System v2** — Navy + Cream two-color palette, Geist for UI, Amboqia for display, shadcn/ui only.
- **Supabase listings** RETS-style mixed-case columns MUST be double-quoted in SQL: `"ListPrice"`, `"StandardStatus"`, `"BedroomsTotal"`. Quote first or queries silently fail.

Skill routing — load before relevant work: `data:write-query`, `data:analyze`, `design:design-system`, `engineering:code-review`, `engineering:architecture`, `engineering:testing-strategy`, `marketing:seo-audit`, `marketing:draft-content`.

Database access: Supabase MCP project `dwvlophlbvvygjfxcrhm`. Use `mcp__5adfee1a-...__execute_sql` for ad-hoc queries, `__apply_migration` for DDL. The handoff doc has the full table inventory and column conventions.

Today's foundation that you build on top of (committed at `43eff652`):
- Authoritative City of Bend GIS neighborhood polygons in `boundaries` + `neighborhoods` tables, all with provenance metadata
- `idx_listings_bend_point_gist` partial GIST index for fast point-in-polygon
- RPCs `import_bend_neighborhood_boundary`, `backfill_bend_listings_neighborhood` (+ scoped variant), `clear_listings_neighborhood_tag`
- ~3,200 Bend listings (active + 24mo closed) correctly tagged

Today's also-shipped:
- `docs/agentfire-menu-audit-2026-05-15.md` (the menu audit; affects how area pages get linked)
- Tree Farm + Valhalla Heights AgentFire pages have corrected stats + corrected Yoast metadata. These will be obsoleted by the new templates but the data is correct in the interim.

**Start by reading. Then ask the 9 questions. Then draft mocks. Then wait for approval.**

--- END PROMPT ---
