# news_video_avatar — TODO: Synthesia/HeyGen dependency

## Status

SKIPPED per build instructions (2026-05-20).

The anti-slop manifesto blocks shipping a fake avatar. This producer
requires a real avatar API to generate lip-synced broker video before
any Remotion composition makes sense.

## What is needed

1. **Synthesia API** (`SYNTHESIA_API_KEY` env var) — checked in
   `scripts/build_news_video_avatar.py`. As of 2026-05-20 `SYNTHESIA_API_KEY`
   is not provisioned in `.env.local` (see `video_production_skills/API_INVENTORY.md`).

   Alternatively **HeyGen** or **D-ID** can replace Synthesia. All three
   offer avatar-from-photo + VO text → MP4 pipelines.

2. **Matt's approved avatar** — Matt must record a 2-minute neutral-background
   video for the avatar training set. This has not been done.

3. **AI disclosure** — per the anti-slop manifesto, any avatar video must
   display "AI-ASSISTED CONTENT" in the first 2 seconds. The existing
   `scripts/build_news_video_avatar.py` already does this.

## Remotion comp plan (when dependency is resolved)

The comp would be structured as:

- Avatar lower-third: `<Video src={avatarMp4} />` at bottom 40% of frame
  in portrait safe zone, with the news b-roll or market chart behind.
- News b-roll / chart in the upper 60% (same beats as `news_video`
  `BendMedianPriceNews`).
- SingleWordCaption above the avatar (y 1100–1280 zone, not the
  default 1370 zone which would overlap the avatar).
- AI disclosure pill in the top-left (y 80–130, within PORTRAIT_AVOID_TOP
  but acceptable for disclosure banners).
- RyanRealtyOutro at the end.

## Files

- `scripts/build_news_video_avatar.py` — existing PIL mockup; still works
  as a 3-frame fallback when the avatar API is unavailable.

## Reference

- `video_production_skills/avatar_market_update/SKILL.md`
- `social_media_skills/platform-best-practices/SKILL.md` §avatar
- Anti-slop manifesto rule 3: "ElevenLabs-only VO" and rule 11: "No AI humor"
