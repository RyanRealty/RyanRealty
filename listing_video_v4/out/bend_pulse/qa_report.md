# QA report — Bend Policy Pulse (3 parts)

## Scope

Local news explainer on Bend proposed climate pollution fee for new homes. Granicus-sourced council workshop video, ElevenLabs Victoria narration, forced-alignment captions.

## Hard gates

- [x] Citations present (`citations.json`) — primary sources for fee levels, dates, process
- [x] Scorecard at or above news format floor (`scorecard.json`)
- [x] Banned vocabulary grep clean for VO and on-screen copy (stunning, nestled, etc.)
- [x] Resolution 1080×1920, portrait, <100 MB each
- [x] blackdetect part 1–2 clean; part 3 shows one 0.033s blackdetect line at ~39.7s (sub-threshold flicker)

## Synthetic media

- Narration: ElevenLabs (disclosed in YouTube long description and below-the-fold on other platforms where space allows)
- Video: real public meeting record + editorial b-roll preprocess (no AI video)

## Human approval

Matt approved cross-platform publish in chat (ship sequentially part 1 → 2 → 3) on 2026-05-10.

## Public delivery paths

After deploy: `https://ryanrealty.vercel.app/v5_library/bend_pulse/bend_pulse_part{1,2,3}.mp4`
