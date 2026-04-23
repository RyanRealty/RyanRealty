# Listing tour video (Remotion)

**Format:** **1080×1920 (9:16)** — Reels / TikTok. **~45s** cut (not a 90s slideshow). Prepare generates **6 Replicate i2v motion clips** by default; Ken Burns is only a fallback (`--allow-stills` / `--no-i2v`).

**Setup (once per machine / after pulling):** `npm run video:listing-tour:setup` — installs deps, copies fonts + logo from `video/cascade-peaks/public/`, creates `out/`.

**Prepare + render:** keys are read from repo-root `.env.local`, then **any missing** of `REPLICATE_API_TOKEN`, `ELEVENLABS_*`, etc. are filled from **`process.env`** (so exports / CI work). Supabase URL + service role must be set one way or the other. If the listing has **no** MLS photos at all, optional **`UNSPLASH_ACCESS_KEY`** can still let prepare run with generic portrait placeholders (last resort — not for Caldera B-roll).

**Caldera Springs / neighborhood stock (the usual case):** keep **MLS photos** for hero + interiors. For **extra** stills, either run **`npm run video:listing-tour:fetch-caldera-broll`** (writes `public/broll/caldera-springs.json` from Unsplash using `UNSPLASH_ACCESS_KEY` — **vet** hits; not every result is literally Caldera), or hand-edit that JSON. **Two or more** URLs → `prepare-tour` puts them in **`brollPhotos`** and **Act4** uses them for the tail only. See `public/caldera-springs-broll-review.html`. Override path: `--broll-json=…`.

```bash
npm run video:listing-tour:prepare -- --listing-key="YOUR_LISTING_KEY"
npm run video:listing-tour:render
```

Flags: `--unbranded`, `--no-i2v`, `--skip-voice`, `--broll-json=…`. Studio: `npm run video:listing-tour:studio`.

Outputs: `out/tour-props.json`, `out/tour_render.mp4`, `public/tour-cache/<slug>/`.

**HTML storyboard (before render):** open `public/reel-storyboard-preview.html` in a browser (double-click or `file://`), use **Load tour-props.json** to pick `out/tour-props.json`, and click segments or **Play timeline**. Or from repo root: `npm run video:listing-tour:preview:storyboard` then open `http://localhost:3457/reel-storyboard-preview.html`.

**QC (required before “done”):** `node scripts/listing-tour-qc-render.mjs out/<file>.mp4` then inspect printed PNGs (see `.cursor/skills/listing-tour-reel-qc/SKILL.md`).
