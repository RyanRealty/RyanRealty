---
name: content_engine
description: >
  STOP. Video producer SKILLs are gone. This file is not the live content factory.
  Do not load video_production_skills/**. Media production is Studio (CLAUDE.md §4).
  Inbox and /marketing/request file a marketing_brain_actions row and run no producer
  (CLAUDE.md §5). Still-live static/social SKILLs: flyer, list-kit, blog-post, IG,
  meme_lord. CMA is a TypeScript product. Use this skill only to refuse the retired
  video matrix and to point at Studio / publisher-sweep.
when_to_use: >
  Fires if an agent is about to load a deleted video SKILL or treat this file as
  THE entry point for all content. Stop, then route media to Studio.
output_type: operational
target_platforms: []
asset_destination: no asset; routing only
auto_inputs: ["CLAUDE.md §4", "CLAUDE.md §5"]
required_inputs: ["intent"]
optional_inputs: []
estimated_runtime_min: 1
cost_usd_estimate: $0
thumbnail_uri: none
example_outputs: []
action_types:
  - content:*
---

# STOP - video producer SKILLs are gone

Do not load `video_production_skills/**/SKILL.md`. Do not load `social_media_skills/coming-soon-teaser`. Remotion is retired. Hourly SKILL.md producers are off.

**Media / social production is the Studio** (CLAUDE.md §4): `lib/studio/`, `/admin/studio`, `/api/cron/studio-slate`. Prompts come from `lib/studio/craft.ts`. Drafts land `ready`. Matt's §1 stamp plus `/api/cron/publisher-sweep` → `/api/social/publish`.

**Inbox + `/marketing/request` file a row and run no producer** (CLAUDE.md §5). CMA, newsletter, CRM, and the Facebook seller report stay as TypeScript products.

This skill is not THE entry point for all content production. Do not storyboard, render, or QA video from this file.

**Status:** Deprecated. Locked 2026-09-05 (D7). Video half is dead.

## Live routing (non-video only)

| Matt says | Load | Path |
|---|---|---|
| video / reel / listing tour / news clip / market video / earth zoom / avatar / meme reel | Studio | `CLAUDE.md` §4, `lib/studio/`, `/admin/studio` |
| publish / ship to socials | publisher-sweep | `automation_skills/automation/publish/SKILL.md` then `/api/cron/publisher-sweep` → `/api/social/publish` |
| flyer / just-listed flyer / open house / print one-sheet | `flyer-design` | `social_media_skills/flyer-design/SKILL.md` |
| list kit / full listing asset package | `list-kit` | `social_media_skills/list-kit/SKILL.md` |
| IG single post | `ig-single-post` | `social_media_skills/ig-single-post/SKILL.md` |
| IG carousel | `instagram-carousel` | `social_media_skills/instagram-carousel/SKILL.md` |
| meme image / image post | `meme_lord` | `social_media_skills/meme_lord/SKILL.md` |
| blog post / SEO article | `blog-post` | `social_media_skills/blog-post/SKILL.md` (Supabase `blog_posts` on the Next site) |
| CMA / what is this property worth | TypeScript CMA | `lib/cma/` + `marketing_brain_skills/producers/cma/SKILL.md` |

If the request is video or motion, stop here and open Studio. Do not invent a Remotion, Replicate, or ElevenLabs render path from this skill.

## Hard constraints

1. Never load `video_production_skills/**`.
2. Never dispatch a producer-runtime worker from this skill.
3. Matt approval is mandatory before publish. Silence is not approval.
4. Every stat ships with a verification trace (CLAUDE.md §0). No trace, no ship.
5. Voice: `marketing_brain_skills/brand-voice/VOICE.md`.

## See also

- `CLAUDE.md` §4. Studio (`lib/studio/`, `/admin/studio`, publisher-sweep)
- `CLAUDE.md` §5. Producer runtime retired
- `automation_skills/automation/publish/SKILL.md`. Live publish path
- `social_media_skills/platform-best-practices/SKILL.md`. Platform rule layer
- `social_media_skills/flyer-design/SKILL.md`. Static flyers

---

## Mandatory references (validator-required)

- `CLAUDE.md §0 (Data Accuracy)`
- `CLAUDE.md §0.5 (Draft-First, Commit-Last)`
- `design_system/ryan-realty/SKILL.md`
- `marketing_brain_skills/brand-voice/VOICE.md`

---

## Validator stub sections (canonical 11-section structure)

## 1. What it makes

Nothing. This skill refuses the retired video factory and points media at Studio.

## 2. Input contract

Natural-language intent. If it is video, route to Studio. If it is a still-live static SKILL above, load that SKILL.md.

## 3. Tool stack

Studio (`lib/studio/`, `/admin/studio`). Publish via publisher-sweep. No Remotion. No `video_production_skills/**`.

## 4. Platform stack

Live social delivery is `/api/cron/publisher-sweep` → `/api/social/publish`. Blog is `public.blog_posts` on the Next site.

## 5. The recipe

Stop. Point at Studio or a still-live static SKILL. File a `marketing_brain_actions` row if the request came from inbox or `/marketing/request`. Run no producer.

## 6. Asset library wiring

`data/asset-library/manifest.json` and `lib/asset-library.mjs` still exist for stills. Video is Studio.

## 7. Publishing flow

Matt §1 stamp on a Studio `ready` draft. Then publisher-sweep. See `automation_skills/automation/publish/SKILL.md`.

## 8. QA gate

Studio craft rules in `CLAUDE.md` §4 and `docs/GROK_CRAFT_CANON.md`. Do not invoke a deleted quality_gate SKILL.

## 9. Failure modes

Loading `video_production_skills/**` is a failure. Dispatching a producer from this skill is a failure. Publishing without Matt's stamp is a failure.

## 10. Mandatory references

See the Mandatory references block above.

## 11. Tool gap suggestions

None. Do not restore Remotion or a second video factory.

## Content-producer additional references

- `automation_skills/content_engine/SKILL.md`
- `social_media_skills/platform-best-practices/SKILL.md`
