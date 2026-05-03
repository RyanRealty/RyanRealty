# Cross-agent handoff (Cursor ↔ Claude Cowork / Claude Code)

**Purpose:** The other agent cannot read your chat. Anything not in `git` + this file + `task-registry.json` is invisible. Update this document **before you stop** or when switching tools, so pickup is fast and safe.

**Convention:** Keep the **Current** section accurate. After each handoff, you may move the previous "Current" block under **History** (newest history first) or delete stale bullets—do not let this file become a novel.

---

## Current (replace this block each time you hand off)

| Field | Value |
|--------|--------|
| **Surface** | **Cursor Cloud Agent** — BL-015 search/city/community path performance branch. |
| **Stopped at (UTC)** | 2026-05-03 — BL-015 implementation committed on `cursor/bl-015-search-performance-301f`; PR branch ready for review. |
| **Branch @ commit** | `cursor/bl-015-search-performance-301f` @ `bd959b3` (handoff update follows this implementation commit). |
| **Task focus** | BL-015 Phase 7 optimize search city and community paths. |

### Done this session (Cursor Cloud)

- Installed missing Cloud runtime pieces locally in the agent container: Node/npm via apt, upgraded Node to 20.20.2, ran root `npm ci`, and installed nested `video/market-report` dependencies so Vitest video scene tests can import Remotion.
- Marked `BL-015` in progress, then complete via `npx tsx scripts/orchestrate.ts`.
- Parallelized basic search listing rows + count in `getListingsWithAdvanced()`.
- Bounded `getGeocodedListings()` to 10 external geocode attempts per call and 2 concurrent fetches.
- Parallelized a city communities pending-count lookup with resort key lookup and kept tile/map projection constants off `details` JSONB.
- Excluded standalone `listing_video_v4` from the root Next TypeScript project, matching the existing `video` workspace exclusion, so app builds do not typecheck independent Remotion sources.
- Added `lib/actions-performance.test.ts` covering list/count parallel startup, geocode concurrency, geocode batch cap, and projection constants.

### Verification

- `npx vitest run lib/actions-performance.test.ts` passed.
- `npm run lint -- app/actions/listings.ts app/actions/cities.ts app/actions/communities.ts app/actions/geocode.ts lib/actions-performance.test.ts` passed with existing warnings only.
- `npm run test` passed, 35 files and 405 tests.
- `npm run build` passed.
- `npx tsx scripts/orchestrate.ts validate BL-015` passed and `complete BL-015` marked the registry complete.

### Next agent should

1. Pull or check out `cursor/bl-015-search-performance-301f`.
2. Review PR for BL-015, especially the root `tsconfig.json` exclusion of `listing_video_v4`.
3. Continue with the next registry item after merge: `BL-018` Phase 12 and 13 cleanup and full verification.

### Blockers / env / secrets

- Cloud image initially had no Node/npm on PATH. This session installed Node 20.20.2 and dependencies manually; a future env setup should bake Node 20 plus root `npm ci` and nested `video/market-report npm ci` into startup if Cloud Agents start from the same image.
- No schema changes were made.

### Skills actually read (paths)

- `docs/plans/GLOBAL_SKILLS_REGISTRY.md`
- `using-superpowers/SKILL.md`
- `supabase/SKILL.md`
- `supabase-postgres-best-practices/SKILL.md`
- `nextjs/SKILL.md`
- `test-driven-development/SKILL.md`
- `requesting-code-review/SKILL.md`
- `verification-before-completion/SKILL.md`
- `video_production_skills/VIDEO_PRODUCTION_SKILL.md`
- `video_production_skills/VIRAL_VIDEO_CONSTRAINTS.md`
- `video_production_skills/ANTI_SLOP_MANIFESTO.md`
- `video_production_skills/VIRAL_GUARDRAILS.md`

---

## History (optional; newest first)

_(Paste prior "Current" blocks here when you rotate, or leave empty.)_
