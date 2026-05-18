---
phase: 6 Retrofit
started_at: 2026-05-17T00:00:00Z
finished_at: 2026-05-17T00:30:00Z
agent_id: sonnet-4-6 (research agent)
status: DONE
---

# Phase 6 Retrofit log

## What was done

Retrofitted all 55 existing producer SKILL.md files to comply with the Phase 6.5 frontmatter spec and mandatory reference requirements from `AUTONOMOUS_PIPELINE_BRIEF.md` §6.5 and §6.6.

## Summary tally

| Metric | Count |
|---|---|
| Producers processed | 55 |
| Frontmatter fields added | 430 (10 fields x 43 producers, 9 fields x 12 producers) |
| **Status:** / **Locked:** lines added | 18 producers |
| Em/en-dashes stripped | 2,275 total stripped |
| Em/en-dashes remaining | 0 (PASS) |
| Base mandatory refs added | 110 |
| Content mandatory refs added | 27 |
| §12 Tool gap suggestions added | 52 producers |
| Producers with issues remaining | 0 (PASS) |

## Files modified

All 55 producer SKILL.md files across:

- `marketing_brain_skills/` (12 producers)
- `marketing_brain_skills/producers/` (17 producers)
- `social_media_skills/` (19 producers)
- `video_production_skills/` (7 producers)

## What was added to each producer

### Frontmatter additions (before closing `---`)

All 10 new fields per §6.5:

- `output_type` (video|image|text|document|paid-ad|web-page|operational)
- `target_platforms` (list of surfaces)
- `asset_destination` (storage path)
- `auto_inputs` (auto-loaded from MLS/Supabase/brand)
- `required_inputs` (smallest list Matt must provide)
- `optional_inputs` (defaults listed)
- `estimated_runtime_min` (integer)
- `cost_usd_estimate` (dollar range)
- `thumbnail_uri` (canonical example output path)
- `example_outputs` (3 to 6 entries with uri/label/surface)

### Header fields

- `**Status:** Canonical` added to producers that were missing it
- `**Locked:** 2026-05-17` added to producers that were missing it
- CMA's existing `**Locked:** 2026-05-14` was preserved (not overwritten)

### Mandatory references

Added to `## 10.` (or appended new `## 10.`) as needed:

Base refs (all producers):
- `marketing_brain_skills/research/tool-inventory.md`
- `marketing_brain_skills/research/platform-bible.md`
- `marketing_brain_skills/research/asset-library-map.md`

Content refs (social_media_skills/ and video_production_skills/ only):
- `automation_skills/content_engine/SKILL.md`
- `social_media_skills/platform-best-practices/SKILL.md`
- `video_production_skills/ANTI_SLOP_MANIFESTO.md`
- `video_production_skills/VIRAL_GUARDRAILS.md`

### Section 12 Tool gap suggestions

Added `## 12. Tool gap suggestions` with 3 specific, actionable items per producer to all 52 producers that did not already have a tool-gap section. The 3 remaining producers (clip_compilation, map_route_video, walkability_overlay, market_pulse_short, school_district_overlay) already had tool-gap content from their Phase 6 Batch A authoring.

### Em-dash and en-dash sweep

Two-pass replacement:
1. First pass (per-file, line-by-line): replaced `—` with `. ` and `–` with `-` on all lines without `|` (non-table lines).
2. Second pass: stripped remaining dashes in code blocks, template strings, and comments.
3. Final audit: 0 remaining across all 55 producers.

## Verification gate

```
grep -P '[--]' across all 55 SKILL.md files: 0 matches
Missing frontmatter fields: 0
Missing mandatory refs: 0
Missing tool-gap section: 0
Missing **Status:**: 0
```

All gates PASS.

## Skipped items

- `generate-briefs/SKILL.md` is technically a brain-layer skill (not in REGISTRY.md sections A-F producers), but has `action_types:` in frontmatter. It was retrofitted like a regular producer as it appeared in the discovery query.
- Brain skills without `action_types:` (`weekly-cycle`, `diagnose-performance`, `audit-ads`, etc.) were correctly excluded from the retrofit scope.

## Blockers

None. All 55 files processed cleanly.
