# Locked end card (Matt, 2026-10-08)

| Step | Element | When | Motion |
|---|---|---|---|
| 1 | Cream `#faf8f4` field | cue `end` | cuts or wipes in on the hit |
| 2 | Real logo, top: `/workspace/studio/assets/endcard-logo.png` (= motion-clips/assets/logo-blue.png) | cue `end` | springs down into place (small overshoot), slight beat bob while holding |
| 3 | **Quality** | cue `end` (beat 0) | lands center, then **slides left** |
| 4 | **Local** | next beat | **flashes center** (card gives a small punch) |
| 5 | **Service** | next beat | **flashes center, then slides right** |
| 6 | **Call now** + **541.703.3095** | cue `call` | slams up from the bottom, holds |
| 7 | Out | cue `out` (at least 1.5 s after call; default 1.8 s) | hard out, never cut a held note |

- Steps 3 to 5 take **about 1 s total**. Poppy.
- No dot separators. No URL unless Matt asks. Navy type on cream only (no sage). Amboqia (with the capital-I patch) for the three words, bigger than v5, inside x 120..950.
- Guard (Imagine): end words must finish before `call` (v5 throws `end words run into call`).

## Implementation (component, updated 2026-10-08 10:16 PM PT, Imagine: Creative Desk 10:02 PM spec + no-overlap fix)
- **Use `templates/endcard_v5.js`** (symlink to `/workspace/motion-clips/endcard_v5.js`). Shared by v6 busiest, Redmond, Caldera, Reel B, clip2, clip4, spotlight*. Pure function of time, self-contained. Built from the final post-review v5 card (`bend_busiest_v5.html`, 21:48), then changed to this spec. `bend_busiest_v5.html` keeps its own inline copy (not edited).
- Motion: **Quality** pops at centre, then slides left. **Local** flashes in at centre. **Service** flashes in at centre at a reduced scale (capped so it clears Quality's right edge by 22 px, about 0.78x), holds 0.12 s, then grows to full 82 px as it slides right. Local is hidden while Service holds centre and comes back only once Service's left edge clears it. Local's own flash is capped the same way while Quality is still sliding out. The card's breathe and punches are capped so no word ever leaves x 120..950. **No frame ever shows two words overlapping or a clipped word.** Words in ~1 s (defaults 0 / 0.4 / 0.8 s). **Call now** + **541.703.3095** at 1.25 s, hold to out at 3.05 s (1.8 s hold; guard throws under 1.5 s).
- Look: navy `#102742` + cream `#faf8f4` only (no sage, no accent option). Logo at top (y 400). Words Amboqia with the capital-I patch (`AmbI`, injected from `assets/amboqia-i-patch.woff2`). Word size = the largest that fits x 120..950 with Local on the band centre (x 535) and a short slide (gap 0.3 em): **82 px** for Quality/Local/Service vs **76 px** in v5 (never below 78). Words span x 124..928 on the last frame. Call now pill 660 px (x 205..865, y 1130..1290); phone y 1320. Nothing in the top 220 or bottom 380 px.
```js
const EC = EndCardV5.mount('endwrap', { start: END, fps: 30 });           // start = cue 'end' (s); duration defaults 3.05
// song cues: EndCardV5.mount('endwrap', { start: 34.521, at: { local: 34.93, service: 35.34, call: 36.165, out: 39.452 }, beats: BEATS });
// loop transition in the last loopDur (0.3) s: { loop: (p, t, els, T) => { els.card.style.clipPath = `circle(${1250*(1-p)}px at 540px 960px)`; } }
function seek(t){ /* ...scene... */ EC.seek(t); }
window.DURATION = EC.times.out;
```
- Options: `start`, `duration`, `fps`, `offsets{quality,local,service,call}` (s from start), `at{...}` (absolute s), `beat_s`/`beats` (kick grid after Call now), `loop`, `loopDur`, `assetBase`, `logo`, `iPatch`, `words`, `cta`, `phone`, `minFs`, `maxFs`, `xMin`, `xMax`. `EC.times` / `EndCardV5.times(opts)` return seconds + frames + `duration`, `fps`, `loopFrom`. `EC.layout` gives fs / slots.
- Guards (throw): words out of order, words run into call, hold after Call now < 1.5 s, word line cannot fit x 120..950 at minFs, empty or dashed copy.
- **Every-frame check (2026-10-08 10:16 PM PT, Matthews-Mini):** `qa/endcard_v5/overlap_check.mjs` seeks every end-card frame at 30 fps on 7 pages (loop test page, clip2, clip4, spotlight, _v2, _v3, _v4; ~92 frames each) and checks the bounding boxes of every visible word (opacity > 0.01): **0 overlaps** (min gap 8 px required; actual min 15.7 px), **0 frames outside x 120..950** (actual x 120..932). Report `qa/endcard_v5/overlap_report.json`. Visual: `every_frame_words_strip.png` (40 consecutive frames, Quality hit to Service + 0.5 s). Per-page stills: 6 per page (Quality, Local, Service at centre, Service slid, Call now, last frame) + `sheet_all_pages.png` + `report.json`. Loop hook tested with an iris on `test_loop.html`. clip2/clip4 run over gray stand-in backgrounds (their `work/*_frames` are not on disk).
- Retired: `/workspace/motion-clips/endcard.js` (`templates/LEGACY_endcard.js`). Do not use.
