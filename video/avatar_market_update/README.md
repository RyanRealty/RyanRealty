# avatar_market_update — Remotion wrapper

**Status:** Blocked on Synthesia API integration setup.

## Why this is not a Remotion comp (yet)

The `avatar_market_update` format (per `video_production_skills/avatar_market_update/SKILL.md`) is
a **Synthesia-first** pipeline:

1. Pull fresh Supabase `market_pulse_live` data.
2. Generate a 180-word-max script via `generate_avatar_script.py`.
3. Submit the script to the Synthesia API (`POST /v2/videos`) with a configured avatar.
4. Poll until the Synthesia render is ready, download the raw avatar MP4.
5. **Remotion wrap** (`AvatarMarketComp`) adds:
   - 5s branded intro (Amboqia title + hero photo)
   - Animated stat overlays synced to the script beat timestamps
   - 5s CTA end card (`ryan-realty.com · 541.213.6706`)
   - 5s contact end card

The Remotion composition exists ONLY to wrap the avatar MP4 — it cannot
render meaningfully without the Synthesia output. Faking a video avatar
with a static image violates the Anti-Slop Manifesto rule: no AI-without-
disclosure, no fake humanoid presence.

## API key status

`SYNTHESIA_API_KEY` is in `.env.local` (verified present 2026-05-20).
The build script (`scripts/build_avatar_market_update.py`) needs the
Synthesia account to have at least one configured avatar before it can
produce the first render.

## TODO: Synthesia avatar setup

1. Log in to app.synthesia.io using the account tied to `SYNTHESIA_API_KEY`.
2. Choose a **stock avatar** (Professional tier) or upload Matt's video for
   a **Personal Avatar** (requires a 1-min walking-and-talking sample video
   recorded in a controlled environment).
3. Note the avatar ID from `GET /v2/avatars`.
4. Add the avatar ID to `.env.local`:
   ```
   SYNTHESIA_AVATAR_ID=<id>
   ```
5. Run `python3 scripts/build_avatar_market_update.py test-payload.json` to
   produce the first weekly avatar MP4.

## Build workflow (once avatar is configured)

```bash
# 1. Generate this week's payload
python3 scripts/generate_avatar_market_payload.py --city Bend --out /tmp/avatar_payload.json

# 2. Run the producer (calls Synthesia, downloads MP4, runs Remotion wrap)
python3 scripts/build_avatar_market_update.py /tmp/avatar_payload.json

# 3. Review the draft at out/avatar_market_update/<slug>/avatar_market_update.mp4
#    DO NOT commit until Matt approves.
```

## Remotion comp (placeholder — will be activated once Synthesia is connected)

When the Synthesia MP4 is available, the `AvatarMarketComp` Remotion project
at `video/avatar_market_update/src/` will:

- Accept `{ avatarMp4Path, statOverlays, captionWords, cityName }` as props.
- Wrap the avatar clip in `<OffthreadVideo>` with brand overlays.
- Use `SingleWordCaption` from the canonical caption component.
- Use `PORTRAIT_SAFE` from the canonical safe-zones.
- Output 60s: 5s intro + 45s avatar + 5s CTA + 5s contact.

The Remotion scaffolding will be built in a follow-up task once the Synthesia
avatar ID is confirmed.
