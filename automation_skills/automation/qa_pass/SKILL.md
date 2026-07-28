---
name: qa_pass
description: Autonomous QA agent that runs after every render and BEFORE Matt sees any draft. Auto-iterates up to 2 cycles on fixable failures. Refuses to surface borderline work — if in doubt, do NOT show Matt; rebuild or file a failure report. Triggers: "QA this draft", "review before showing Matt", "validate the rendered video", "run quality gate", "run QA". Also auto-invoked by every video format skill before handing off to Matt. NOT for post-publish analytics (use performance_loop).
---

# QA Pass

## What it is

The autonomous pre-review gate. Runs every check Matt would otherwise have to catch by eye. Produces `qa_report.md` and `gate.json`. The publish skill will not proceed without a passing `gate.json`. Auto-iterates on fixable failures (up to 2 cycles). If still failing after 2 cycles, writes a failure report and stops — the broken draft never reaches Matt.

## Hard refuse conditions (any single hit = non-ship)

2. Any figure in the video has no entry in `citations.json` tracing it to a named primary source (CLAUDE.md §0)
3. `citations.json` absent or malformed
4. `scorecard.json` absent or any `auto_zero_hits` entry present
5. Viral scorecard total below format minimum (listing 85, market data 80, neighborhood 80, meme 75, earth zoom 85, news 80; default 80) — auto-iterate first; refuse if still below after 2 cycles
6. ffprobe duration outside window: < 30s or > 60s (viral cuts); flag if > 45s for non-report formats
7. ffprobe codec not `h264` or file size > 100 MB
8. ffprobe frame rate not 30 fps
9. blackdetect (pix_th=0.05, pic_th=0.98, pic_cons_th=0.9) returns any sequence
10. Frozen frame detected at any beat boundary (visual diff < 0.2% pixel change across 3+ consecutive frames)
11. Black bars at any transition (letterbox or pillarbox artifacts > 2 px)
12. Caption zone (y 1480–1720, x 90–990) overlaps any other rendered component in any frame
13. Caption transition is a hard cut between full-sentence blocks (min 6-frame opacity ramp required)
14. Caption timing not derived from ElevenLabs forced-alignment timestamps (clock-time slots are a fail)
15. Logo, "Ryan Realty", phone number, or agent name visible in any frame of a viral/news/market cut (listing video footer bar is the only permitted location)
16. End card uses text-only "Ryan Realty" instead of `brand/stacked_logo_white.png`
17. Listing video: scrim or logo layer deviates from spec (Layer 1 rgba(0,0,0,0.40), Layer 2 rgba(0,0,0,0.70) 200 px footer, gold logo 580 px — no feathering, no drop shadows)
18. Audio silent or inaudible (RMS below -40 dBFS for > 1s during VO passages)
19. Spark × Supabase reconciliation delta > 1% on any figure for market report formats
20. AI disclosure pill absent for avatar/synthetic-media content (SB 942 California compliance)
21. `containsSyntheticMedia` flag not set in YouTube metadata when ElevenLabs VO is present
22. Hook frame (0.0s) is static — no motion by frame 12 (0.4s)
23. On-screen text absent by frame 30 (1.0s)
24. No register shift at 25% mark (± 3s tolerance)
25. No pattern interrupt at 50% mark (± 3s tolerance)
26. Final 15% does not contain kinetic stat reveal

## Auto-iteration policy

- **Cycle 1:** Detect all failures. Attempt automated fix for fixable classes (remove banned word from caption, re-run ElevenLabs forced-alignment, adjust blackdetect-triggering transition). Re-render if needed. Re-run full gate.
- **Cycle 2:** If failures remain, attempt second fix for any still-fixable class. Re-render if needed. Re-run full gate.
- **After 2 cycles:** If any hard refuse condition still fires, write `out/_failed/<asset>/qa_report.md` with all failure details. Do NOT surface the draft to Matt. Report: "QA failed after 2 auto-iteration cycles. See `out/_failed/<asset>/qa_report.md`." Stop.

Fixable classes (auto-iterate): banned word in editable text field, missing forced-alignment file, blackdetect from a single bad transition, audio level below threshold (ffmpeg normalize pass). Non-fixable classes (stop immediately): wrong codec, duration violation, Spark/Supabase reconciliation conflict, missing citations, scorecard auto-zero hit.

## Procedure

1. **Receive inputs:** render path, format type (listing/market/news/neighborhood/meme/earth-zoom), storyboard reference, citations.json path, scorecard.json path
2. **Banned-words grep:** `bash ${CLAUDE_SKILL_DIR}/../../../scripts/qa-banned-words.sh <render_dir>` — scans VO script, captions file, on-screen text manifest
3. **Citations validation:** verify `citations.json` exists; every figure in storyboard has a matching entry with `source`, `table_or_url`, `filter`, `row_count`, `fetched_at_iso`, `query`
4. **Spark × Supabase reconciliation:** if format is market report, run cross-check per CLAUDE.md §4; halt render if delta > 1%
5. **Scorecard validation:** verify `scorecard.json` exists, `total >= format_minimum`, `auto_zero_hits` is empty array
6. **ffprobe checks:** duration, codec, fps, file size
7. **blackdetect:** `ffmpeg -i <file> -vf blackdetect=d=0.01:pix_th=0.05:pic_th=0.98 -f null - 2>&1 | grep blackdetect` — must return zero lines
8. **Frame extraction + visual checks:** extract frames at 0s, 0.4s, 1.0s, 2.0s, 25%, 50%, final-15% start; run `scripts/qa-frame-checks.ts` for motion, text, register-shift, pattern-interrupt, kinetic-reveal
9. **Audio check:** `ffmpeg -i <file> -af volumedetect -f null -` — flag if mean_volume < -40 dBFS
10. **Caption zone check:** `scripts/qa-frame-checks.ts --caption-overlap` — pixel-diff between caption layer and all other layers for 30 sampled frames
11. **Caption transition check:** verify alignment JSON exists; verify no gap > 0 frames between chunk fade-out and next chunk fade-in
12. **Brand compliance:** frame-scan for logo/text in non-permitted zones; verify end card asset path is `brand/stacked_logo_white.png`; verify listing overlay spec values
13. **Platform pre-flight:** verify aspect ratio 1080×1920, duration ≤ 60s; if YouTube, check `containsSyntheticMedia` metadata; if CA audience, check SB 942 disclosure frame
14. **Generate `qa_report.md`** (schema below)
15. **Generate `gate.json`** (schema below)
16. **Decision:** all hard refuse conditions clear → hand path + gate.json to Matt review. Any failure → cycle 1 auto-iterate, then cycle 2, then failure report.

## qa_report.md schema

```json
{
  "asset": "out/market_report_bend_apr2026/market_report.mp4",
  "format": "market_data",
  "format_minimum": 80,
  "qa_timestamp": "2026-05-06T14:32:00Z",
  "iteration_cycle": 0,
  "result": "PASS",
  "checks": {
    "banned_words": { "pass": true, "hits": [] },
    "citations_complete": { "pass": true, "figure_count": 6, "verified_count": 6 },
    "spark_supabase_reconciliation": { "pass": true, "max_delta_pct": 0.3 },
    "scorecard": { "pass": true, "total": 83, "auto_zero_hits": [] },
    "ffprobe_duration_s": { "pass": true, "value": 43.2 },
    "ffprobe_codec": { "pass": true, "value": "h264" },
    "ffprobe_fps": { "pass": true, "value": 30 },
    "file_size_mb": { "pass": true, "value": 68.4 },
    "blackdetect": { "pass": true, "sequences": 0 },
    "frozen_frames": { "pass": true, "beats_checked": 14, "frozen_count": 0 },
    "black_bars": { "pass": true },
    "caption_zone_overlap": { "pass": true, "frames_sampled": 30, "overlap_count": 0 },
    "caption_transitions": { "pass": true },
    "caption_timing_source": { "pass": true, "source": "elevenlabs_forced_alignment" },
    "brand_compliance": { "pass": true, "logo_in_viral_frames": false },
    "end_card_asset": { "pass": true, "path": "brand/stacked_logo_white.png" },
    "audio_level": { "pass": true, "mean_volume_dbfs": -18.4 },
    "hook_motion_by_0_4s": { "pass": true },
    "text_by_1_0s": { "pass": true },
    "register_shift_25pct": { "pass": true },
    "pattern_interrupt_50pct": { "pass": true },
    "kinetic_reveal_final_15pct": { "pass": true },
    "ai_disclosure": { "pass": true, "not_applicable": true },
    "youtube_synthetic_media_flag": { "pass": true, "not_applicable": false, "flag_set": true }
  },
  "failures": [],
  "auto_fix_log": []
}
```

## gate.json schema

All fields required. The publish skill and post_scheduler reject any asset whose `gate.json` is absent, malformed, or shows `gate_passed: false`.

```json
{
  "gate_passed": true,
  "gate_timestamp": "2026-05-06T14:32:00Z",
  "iteration_cycles_used": 0,
  "asset_path": "out/market_report_bend_apr2026/market_report.mp4",
  "format": "market_data",
  "format_minimum": 80,
  "scorecard_total": 83,
  "auto_zero_hits": [],
  "citations_path": "out/market_report_bend_apr2026/citations.json",
  "scorecard_path": "out/market_report_bend_apr2026/scorecard.json",
  "qa_report_path": "out/market_report_bend_apr2026/qa_report.md",
  "postflight_path": null,
  "format_skill_name": "market-data-video",
  "format_skill_version": "2026-05-06",
  "spark_supabase_reconciled": true,
  "ai_disclosure_present": false,
  "youtube_synthetic_media_flag": true,
  "hard_refuse_conditions_checked": 26,
  "hard_refuse_conditions_failed": 0,
  "matt_approval_required": true,
  "approved_by_matt": false,
  "approved_at": null
}
```

`approved_by_matt` and `approved_at` remain `false`/`null` until Matt explicitly approves. The publish skill sets these fields — QA never sets them.

## Cost

| Check | Tool | Cost |
|---|---|---|
| Banned-words grep | local bash | $0 |
| ffprobe/blackdetect | local ffmpeg | $0 |
| Frame extraction + visual | local ffmpeg + ts | $0 |
| Scorecard scoring | Gemini 2.5 Flash via Vertex | ~$0.005/video |
| Citations validation | local | $0 |
| Audio level | local ffmpeg | $0 |
| **Total per pass** | | **< $0.01** |

## Reference scripts

- `scripts/qa-banned-words.sh` — grep manifesto list + CLAUDE.md list against VO script, captions, text manifest
- `scripts/qa-frame-checks.ts` — ffmpeg frame extraction; motion/text/register/interrupt/reveal checks; caption-overlap pixel diff
- `scripts/qa-scorecard.ts` — calls Vertex Gemini 2.5 Flash; writes `scorecard.json`; reads storyboard + frame stills

## See also

- `automation_skills/automation/post_scheduler/SKILL.md` — consumes `gate.json`; rejects posts without passing gate
- `automation_skills/automation/publish/SKILL.md` — hard pre-condition: `gate.json` with `gate_passed: true` and `approved_by_matt: true`
- `video_production_skills/VIDEO_PRODUCTION_SKILL.md` — production hard rules (§0 data, §0.5 captions, §Video Build Hard Rules)
