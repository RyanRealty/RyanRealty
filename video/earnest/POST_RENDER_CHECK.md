# Post-Render First-Frame Check

This project has no automated render script. After every `npx remotion render` invocation,
run the first-frame thumbnail gate manually from the repo root:

```bash
python3 scripts/check_first_frame.py video/earnest/out/<render>.mp4
```

This is a ship-blocker (locked 2026-05-20). A non-zero exit means the first frame is a
black card, logo-only card, or low-contrast background. Fix the opening composition
before publishing.

## Typical render command

```bash
cd /Users/matthewryan/RyanRealty/video/earnest
npx remotion render src/index.ts <EpisodeComp> out/<slug>.mp4 \
  --codec h264 --concurrency 1 --crf 22 \
  --image-format=jpeg --jpeg-quality=92
```

Then from repo root:

```bash
python3 scripts/check_first_frame.py video/earnest/out/<slug>.mp4
```
