# Cascade Peaks (Remotion)

This folder is the **Mac / Cursor mirror** of the Cowork session project at:

` /sessions/stoic-sweet-dirac/work/cascade_peaks `

Same composition name (**CascadePeaks**), same stack (Remotion 4.0.x, R3F, 3D Tiles). Cross-session status lives in repo memory:

` .auto-memory/memory_cascade_peaks_video_handoff.md `

## Prerequisites

- **Node.js 20+** (matches typical Cowork images).
- **Repo root `.env.local`** with either:
  - `REMOTION_GOOGLE_MAPS_KEY=…`, or
  - `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=…`  
  Enable **Map Tiles API** and **Photorealistic 3D Tiles** for the key; relax HTTP referrer restrictions for local/headless if you see tile **400**s in logs.
- **ffmpeg** (optional) — for `finish_v1.sh` compress + thumbnails.

## One-command setup (from repo root)

```bash
npm run video:cascade-peaks:setup
```

This runs `npm ci` in this folder, creates `out/`, mirrors the Maps key into `video/cascade-peaks/.env` (also done when Remotion loads `remotion.config.ts`), and reminds you if brand fonts are missing.

## Brand fonts (not committed)

Place these next to the graded JPEGs in **`public/`**:

- `Amboqia_Boriango.otf`
- `AzoSans-Medium.ttf`

Copy from Cowork `work/cascade_peaks/public/` or your brand vault. Without them, renders use fallback faces.

## How to watch the video

1. **While editing (interactive)**  
   From repo root: `npm run video:cascade-peaks:studio` → open **http://localhost:3000** (watch the CLI if that port is in use). Scrub **CascadePeaks**. Studio streams tiles live, so motion can look softer than the final encode.

2. **Finished file (full quality)**  
   After `npm run video:cascade-peaks:render`, open **`video/cascade-peaks/out/cascade_peaks_raw.mp4`** in Finder or run `open video/cascade-peaks/out/cascade_peaks_raw.mp4`. Optional: `cp video/cascade-peaks/out/cascade_peaks_raw.mp4 outputs/`.

3. **Compressed v1 + email pipeline**  
   `npm run video:cascade-peaks:finish` → **`out/cascade_peaks_v1.mp4`** plus thumbnails (needs `ffmpeg` and `RESEND_API_KEY` for `send_v1.py`).

## Daily commands (repo root)

| Command | Purpose |
|--------|---------|
| `npm run video:cascade-peaks:setup` | Install + env + `out/` |
| `npm run video:cascade-peaks:studio` | Remotion Studio |
| `npm run video:cascade-peaks:render` | Headless MP4 (`out/cascade_peaks_raw.mp4`) |
| `npm run video:cascade-peaks:finish` | Compress + thumbs + `send_v1.py` (needs Python + `RESEND_API_KEY`) |

Or from this directory: `npm run start`, `npm run build`.

## Closing card logo

`ClosingCard` uses **`public/ryan_realty_logo_white.png`** (white mark on transparent) via `staticFile` + `<Img>` — reliable in headless render. Replace that file to swap the end card lockup.

## Post-render pipeline

1. **`npm run video:cascade-peaks:render`** → `out/cascade_peaks_raw.mp4`
2. **`npm run video:cascade-peaks:finish`** → reads raw MP4 (see script for accepted filenames), writes `out/cascade_peaks_v1.mp4`, extracts thumbnails, sends email via Resend.

## Optional: decision-brief email assets

`send_brief.py` can attach three “owned” library images. On Mac, either:

- Set **`CASCADE_PEAKS_BRAND_ASSETS_DIR`** to a folder containing  
  `mountain_peak.jpg`, `mountain_starry.jpg`, and  
  `sunset_high_desert_01_1570452073.jpg`, or  
- Drop copies under **`video/cascade-peaks/.brand-attachments/`** with those exact names.

If those files are absent, only Wikimedia-linked options in the brief still work; owned inline images are skipped.

## Ignored paths

`node_modules/`, `out/`, `.env` under this folder are gitignored; sources and `public/*.jpg` stay in git.
