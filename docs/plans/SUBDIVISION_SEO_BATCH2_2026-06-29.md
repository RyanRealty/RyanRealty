# Resort-community SEO batch 2 — progress (2026-06-29)

Executes handoff section 2a (the SEO long-tail lever). Status: **DRAFT, awaiting Matt's approval before commit.**

## What this is

The 2026-06-28 session deepened 4 resort-community pages (broken-top, tetherow, black-butte-ranch, brasada-ranch) from thin blurbs to 350-500 word sourced "About" prose, and they ranked page 2 with real GSC impressions. This batch finishes the **10 remaining curated resort communities** the same way.

Data check that set the priority:
- GSC (28d) demand is concentrated on these branded resort names (eagle crest, pronghorn, sunriver, etc.), all ranking pos 10-27 with 0 clicks.
- The raw top-inventory subdivision list is mostly junk abbreviations ("Crr", "Oww", "PLA") or out-of-service-area towns (Klamath Falls, Merlin, Chiloquin) — filtered out.
- The 10 targets each already had only a 113-185 word blurb vs the 350-500 word standard. Eagle Crest alone has 72 active listings.

## The 10 communities

eagle-crest, pronghorn, caldera-springs, sunriver, awbrey-glen, northwest-crossing, crosswater, widgi-creek, vandevert-ranch, three-rivers.

## Architecture (proven, unchanged from section 1f)

- New prose added to `lib/community-seo-content.ts` (now 14 entries: 4 original + 10 new).
- The community page (`app/communities/[slug]/page.tsx`) already wires `getCommunitySeoAbout(slug)` into `richContent.aboutProse` for communities with a `data/resort-community-<slug>.json` config (all 10 have one), so the deep prose renders in the `KbResortOverview` overview section. No page edit, no sitemap edit needed (all 10 slugs already in `RESORT_COMMUNITY_SLUGS`).

## §0 + brand-voice discipline

- Research done by 10 parallel §0-disciplined subagents. Every claim traced to an official/primary source (resort sites, Troon, county records, The Bulletin, KTVZ, Wikipedia-with-citations). Unverifiable facts (HOA dues, conflicting yardages/ratings, lot counts) deliberately omitted, not invented.
- Brand-voice: 0 violations across all 10 (`scripts/_seo-prose-scan.mjs` against the canonical vocabulary + `npm run ci:brand-voice` baseline-clean).

## Verification

- All 10 `/communities/<slug>` pages render the new prose in the overview section (dev server, 200 OK, signature phrases confirmed in SSR HTML, single non-duplicated render).
- tsc clean. `ci:community-content` (G33) passes. `site-contracts` (D100) passes. Full suite: 204 files / 2287 tests green.
- Contact sheet: `out/community-seo-drafts-2/index.html`.

## Open item (NOT this batch — pre-existing on main)

`npm run ci:gates` fails at `ci:design-tokens` (352 vs baseline 344). Every flagged file is from the **prior session** (luxury-homes-bend hex/arbitrary utilities, CRM admin/settings scroll guardrails, TemplateEditor raw button, WorkflowList arbitrary max-w). Not caused by this batch (my diff is only `lib/community-seo-content.ts`). The pre-commit hook does NOT run `ci:design-tokens`, so it does not block this commit — but main's CI design-token gate is red and should be fixed or baselined in a separate pass.

## Next (after this ships + measures)

- Bucket B: real non-resort subdivisions with inventory but no community route (Petrosa, Stevens Ranch, Awbrey Butte neighborhood, Longhorn Ridge). These need a NEW visible "About" section on the `/search/[...slug]` (homes-for-sale) route — bigger architecture lift, lower current GSC demand. Documented for the next phase.
- Re-measure rank movement in ~2 weeks per handoff section 2b.
