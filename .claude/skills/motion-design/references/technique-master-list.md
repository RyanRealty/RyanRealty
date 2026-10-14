# Ryan Realty motion technique master list

Built 2026-10-14 for the multi-day build that turns our ads from boxes on drone footage into real motion design. Research only: nothing in the repo was changed.

## 0. What this is built from, and how to read it

**Sources read in full or entry by entry.** GitHub was reachable; all four repositories were shallow-cloned into the session scratchpad (never into the repo) and read, not run.

| Repository | Commit read | License | What was read |
|---|---|---|---|
| `Leonxlnx/cinetic` | `bee5d78` (2026-10-05) | MIT, (c) 2026 Leonxlnx | All 273 entries of `skills/cinetic/assets/library/techniques.json` (summary, use, avoid, and full recipe and timing for every entry ranked in section 2); the 14 category intros; `SKILL.md`; `references/review-loop.md` (rubric, rounds, severity, ship gate, thresholds); `assets/critics/` (director, forensics, sound-sync, art-copy-ui, verifier); `references/taste-and-slop.md` (HB1 to HB11 and the A to L tell catalogue); `references/sound.md`, `formats.md`, `motion-tokens.md`. |
| `Rieranthony/product-film-skill` | `fe11efc` (2026-09-26) | MIT, (c) 2026 Rieranthony | `SKILL.md`, every file in `reference/`, the kit (`spring.ts`, `punchlines.tsx`, `dither.ts`, `camera.ts`, `move.ts`). |
| `heygen-com/hyperframes-community-skills` | `ba7a0bb` (2026-09-24) | Apache-2.0 | All eight skills' `SKILL.md`; every `vox-explainer` reference; `session-story` motion, score and NOTICE; `day-in-my-life` look; `camera-3d-captions` rules. |
| `buildfastwithai/buildfast-skills` | `c91416c` (2026-10-08) | MIT, (c) 2026 Build Fast with AI; bundled fonts OFL | `motion-studio-skill` (SKILL, transitions, QC, camera, typography, formats, engine API, the 10 motion languages, 51 visual styles, 13 templates), `generative-film-skill/SKILL.md`, `html-animation-skill`, the `create-svg-skill` style registry. |
| prompt-motion.com | live 2026-10-14 (234 entries) | none stated; prompts are quotes of X posts | All 234 entry pages scraped; the spec-grade prompts read in full (Appendix A). |

**Repo context read first:** `.claude/skills/motion-design/references/prompt-motion.md` and `SKILL.md`; `.claude/skills/ryan-studio/SKILL.md`, `references/RULEBOOK.md`, `rules/VIDEO_TYPES.md`; `.claude/skills/creative-brain/SKILL.md`; the technique registry. **The 28-entry registry is not on this branch or on `main`** (both carry the older 15-entry file). It lives on the unmerged `integ/one-factory` branch (worktree `.claude/worktrees/integ`, registry version `2026-10-13c`): 19 entries `ready`, 9 `planned` (Appendix B). The buyer-ad figures come from the Current block of `docs/plans/CROSS_AGENT_HANDOFF.md` (commit `0255fcd25`).

**Verdicts.**
- **BUILD**: fits our brand and subjects as written, once the standard token mapping below is applied.
- **ADAPT**: fits only with the named change, beyond the token mapping.
- **SKIP**: with the reason.

**Standard token mapping (applies to every BUILD and ADAPT row).**
- cinetic's "stage" is cream `#faf8f4` (or navy on a navy act); "ink" is navy `#102742` (or cream on navy).
- cinetic's one "accent" has no third colour to map to. Its job (marking the one thing that matters) is done by full navy against navy-alpha context, or by a navy/cream inversion. Navy at reduced alpha (`rgba(16,39,66,x)`) is the "mute"/"grey" tone; CLAUDE.md already uses navy alpha for borders and hover states. Confirm the motion page test accepts navy-alpha before building (`lib/studio/motion/page.test.ts` fails "any other hex or rgba").
- White and black only as a legibility layer or scrim on footage (CLAUDE.md 3). The `--rr-exception` accent and the dated "HOTTEST" accent exist only where Matt asks (RULEBOOK 6).
- Type: Amboqia Boriango for display words and unit lines, Geist for every figure, label and caption (RULEBOOK 6; `eased_number_reveal.md`).
- Footage keeps its true colour. MLS photos are never restyled; camera motion only (RULEBOOK 6).

**Frame rates.** cinetic's frame counts and px/f speeds are at 60 fps. Our masters are 1080x1920 at 30 fps (VIDEO_TYPES core 10). Read every cinetic duration in seconds (60 f = 1 s), and double a px/f speed to get our per-frame speed, or work in px/s. cinetic argues 30 fps visibly steps slow drifts; subframe motion blur (Tier 0) is our answer while the 30 fps rule stands.

**The rules behind most SKIPs and ADAPTs.**
- **RULEBOOK 2b (calm pacing):** every beat and number holds at least 2.5 s; at most one move per bar; slow eased camera; no snap zooms, no rapid montages, no strobing; count-ups may land fast, then hold. cinetic is tuned for fast launch films (45 to 60 events per 30 s, median shot 1 to 1.5 s), so its energetic moves are SKIP or slowed.
- **RULEBOOK 1 and 6:** the end card is locked and the logo appears nowhere else. Most of cinetic's 18 lockup builds are SKIP.
- **CLAUDE.md 0 and `figureLeaks`:** any digit drawn on screen without a `brief.numbers` row kills the draft, and count-ups never roll through superseded values (VIDEO_TYPES market_update). Scrambles, odometers and 85%-start count-ups therefore change.
- **No UI in our ads.** About a third of cinetic (UI choreography, product demo, micro-interaction, cursors) assumes a software product on screen. SKIP unless the move works without UI.
- **No people generated; real footage for places; fair housing; no addresses or client names** (RULEBOOK 3, creative-brain law 1).
- **cinetic's own hard bans HB4 (serif) and HB5 (cream) contradict our heritage register.** They were not adopted on 2026-10-07 and are treated as brand-supplied exceptions in the rubric (section 3.6).

**Counts.** 273 cinetic entries: 53 BUILD, 94 ADAPT, 126 SKIP. 93 further techniques from the other three libraries and the gallery: 40 BUILD, 42 ADAPT, 11 SKIP. cinetic has no map, sound or loop category, so its entries are regrouped into the ten groups asked for; each row keeps cinetic's own category in brackets.

**Contents.**
1. The full catalogue by group (hook, type, scene, data viz, map, transition, texture and finish, sound, loop, end).
2. The ranked BUILD/ADAPT list: Tier 0 foundations, then 30 ranked items with build approach, showcase render and size, and how they compose the buyer ad.
3. cinetic's 11-dimension rubric, the critic lenses, the verifier, severity and the ship gate, written out for our separate reviewer, with our adjusted hard-ban list.
4. License notes.
Appendix A: the gallery's spec-grade prompts. Appendix B: registry status today. Appendix C: questions for Matt.

---

## 1. The full catalogue

### 1.1 Hook

How the first 1 to 2 s stops the scroll. cinetic entries here: 12; from the other libraries and the gallery: 3. Verdicts: 4 BUILD, 6 ADAPT, 5 SKIP.

cinetic (`Leonxlnx/cinetic` `skills/cinetic/assets/library/techniques.json`, by entry id; the same entries are written out in `skills/cinetic/references/technique-library.md`). The bracket after each id is cinetic's own category.

| Entry id (source) | What it looks like on screen | Verdict | For Ryan Realty |
|---|---|---|---|
| `cam-inside-object-pullout` (camera) | What reads as a full-bleed colour field turns out, in one long pull, to be the face of a small object among neighbours. | **BUILD** | Open inside the counter of the "0" in $10,000 (a navy or cream field) and pull out to the whole figure. Buyer-ad hook. |
| `dn-metric-cold-open` (data and numbers) | The film opens on its proof number already moving, no title, no logo; brand waits for the lockup. | **BUILD** | This is dollar_first_hook made into motion: first change by frame 1, settled by about 0.7 s, readable for at least 2.5 s (our floor beats cinetic's 72 f at 60 fps). |
| `oh-cropped-word-pull-back` (opening hook) | The film opens inside one giant word, its first letter cropped by the frame edge; the camera pulls back to the line at reading size. | **BUILD** | Pure camera on type; works for an Amboqia word or the Geist hero figure. |
| `oh-macro-scramble-snap-out` (opening hook) | Huge digits overflow the frame re-rolling every frame, then one frame snaps back to the whole figure, which locks column by column and holds. | **ADAPT** | Drop the scramble: random digits are drawn figures (figureLeaks fails, CLAUDE.md 0) and per-frame re-rolls read as strobing (2b). Keep the macro scale and the left-to-right column lock, each column holding only blank or its true digit. Buyer-ad hook. |
| `oh-pile-up-freeze-turn` (opening hook) | Cards or alerts pile in faster and faster while a counter climbs; freeze on true silence; the turn hits on the downbeat. | **ADAPT** | The pile-up must be real records (price-cut sales landing as pins) at a calm cadence, not an accelerating montage (2b); any counter shows only a brief.numbers figure at rest. |
| `oh-quiet-intro-drop` (opening hook) | First 2 s are light plucks or a filtered pad under the opening type; low end and kick land on the first hard cut. | **ADAPT** | Keep the soft-then-arrive shape but no kick, sub or drop (motion-design SKILL bans them): the pad opens and the first chord sounds on the hook figure's landing. Moot on a silent IG export. |
| `oh-result-first-rewind` (opening hook) | Opens on the finished end state, holds a beat, visibly rewinds to empty, then plays forward. | **ADAPT** | Works on the finished summer pin map rewinding to an empty Bend; rewind pins as a group (cinetic caps it near 30 state changes) and never show a count passing through other values. |
| `oh-click-starts-film` (opening hook) | From frame 0 a cursor travels to the one button; the press floods open into scene one. | **SKIP** | UI and cursor demo. |
| `oh-cursor-search-push` (opening hook) | A cursor drifts into a search pill, the camera pushes twice to a macro, a provocative query types in. | **SKIP** | UI and cursor demo; typed headline is a letter gimmick. |
| `oh-live-grid-cold-open` (opening hook) | No title: a flush 2x2 grid, every cell already mid-action from frame 2 (a line, a counter, an orbit, a pin). | **SKIP** | Four simultaneous motions break RULEBOOK 2b (one idea per beat, at most one move per bar); cells fall under 540 px wide in 9:16. |
| `oh-mark-build-and-throw` (opening hook) | Frame 1 a dot swells into the logo, which is thrown into a frame-filling macro of itself. | **SKIP** | Logo only on the end card (RULEBOOK 6); the real logo is a PNG and is never rebuilt from a dot. |
| `oh-oversize-fly-then-small` (opening hook) | A huge headline fragment brakes in from the side and dissolves; three frames later the line restarts small and centred. | **SKIP** | Built for dark high-energy launches; reads as a false start and nothing in it holds 2.5 s. |

From the other three libraries and the prompt-motion.com spec-grade prompts:

| Technique | What it looks like on screen | Verdict | For Ryan Realty | Source |
|---|---|---|---|---|
| Something moves in the first second; slow intros cut | No logo build, no fade-up; the hero state is already moving on frame 0. | **BUILD** | Principle behind every hook; logo-draw part of the source does not apply (logo is a locked PNG). | `Rieranthony/product-film-skill plugins/product-film/skills/product-film/reference/ingredients.md (Opening)` |
| Frame 0 is real footage, full-bleed, pulling back into a composition | The first frame is one real clip filling the screen; the camera pulls back until it is a window inside the layout. | **ADAPT** | Frame 0 is Bend footage that pulls back into the counter of the "0", the reverse of the iris; pick one direction per film. | `prompt-motion.com/antonio-kodheli-490109` |
| One-word title with a dictionary gloss | A single word set large with a dictionary-style definition under it. | **ADAPT** | brand_film only, and only if it survives the trope test (creative-brain kill tests). | `buildfastwithai/buildfast-skills generative-film-skill/SKILL.md (Title)` |

### 1.2 Type

How words and numbers arrive, hold and leave. cinetic entries here: 39; from the other libraries and the gallery: 13. Verdicts: 16 BUILD, 26 ADAPT, 10 SKIP.

cinetic (`Leonxlnx/cinetic` `skills/cinetic/assets/library/techniques.json`, by entry id; the same entries are written out in `skills/cinetic/references/technique-library.md`). The bracket after each id is cinetic's own category.

| Entry id (source) | What it looks like on screen | Verdict | For Ryan Realty |
|---|---|---|---|
| `cl-ink-resolve` (colour and light) | Text never simply fades in: it arrives pale and darkens (or brightens) to full ink as it settles. | **BUILD** | Navy from navy-alpha to full on cream; cream from cream-alpha to full on navy. |
| `cl-read-state-tone-ladder` (colour and light) | Items being read sit at full ink; read ones step to mid grey; upcoming ones wait dim. | **BUILD** | Caption and stack lines: current full navy, past at half alpha, next faint. |
| `dn-tucked-unit-label` (data and numbers) | A small lowercase unit word sits right-aligned under a big number's last digits, overlapping its baseline. | **BUILD** | "a month" tucked under the Geist figure; per eased_number_reveal the unit line is Amboqia, the value Geist. |
| `lc-gap-open-insert` (layout) | Inside a finished line the words slide apart and an object pops into the gap. | **BUILD** | A pin glyph or an owned place photo opens into the claim line. |
| `ps-beat-quantized-chunks` (pacing) | A line arrives in two or three meaning chunks, each landing exactly on the next beat. | **BUILD** | With VO, chunks on spoken phrases; with an IG song, on the cue JSON (measured_drop_sync). |
| `ty-centre-out-unmask` (typography) | A short line opens from its own centre outward behind a soft mask while the letters stay still. | **BUILD** | Result lines under a figure ("Sellers are paying to close"). |
| `ty-inplace-light-up-beats` (typography) | The finished line is laid out from the start and its words light up in place, chunk by chunk, on the beat. | **BUILD** | Words light at their VO word times (lib/studio/voice/words.ts); suits the one promoted line per act. |
| `ty-masked-baseline-rise` (typography) | Each word rises out of an invisible line at its own baseline, tops of the glyphs first. | **BUILD** | Default entrance for Amboqia words set directly on footage; replaces the card fade-in. |
| `ty-phrase-clamp-junction` (typography) | Two halves of a phrase arrive from opposite directions and lock on one baseline at a fixed junction. | **BUILD** | The payment-math lockup: the $10K half and the "about $169 a month" half clamp together. Once per film. |
| `ty-reading-order-exit` (typography) | Words leave one by one in reading order, each lifting a few pixels, until only the hero remains. | **BUILD** | Isolates the figure before a zoom or iris. |
| `ty-staggered-word-roll` (typography) | The words of a phrase roll up and away one after another while replacements rise in, so the sentence mutates instead of cutting. | **BUILD** | Swap the payoff line into the topic CTA line in place. |
| `ty-vertical-word-stack` (typography) | In a tall frame each new word lands on its own line while the stack rises one line, newest on the optical centre. | **BUILD** | Built for 9:16; default for VO-paced statements inside the safe zone. |
| `cl-accent-on-newest` (colour and light) | Whatever just arrived wears the accent for a moment, then settles to neutral. | **ADAPT** | Newest pin lands filled navy and relaxes to its category shape; newest word full navy, older words step down in alpha. |
| `cl-tone-band-fill` (colour and light) | A word fills through a travelling band (dark, accent, light) and settles on its final ink. | **ADAPT** | A navy-alpha to navy band through one Amboqia hero word. |
| `cl-type-solidity-arc` (colour and light) | Early statements are translucent; the closing line and lockup are solid. | **ADAPT** | Navy-alpha early lines to full navy payoff; brand films and the buyer ad. |
| `lc-hero-flips-to-inline-glyph` (layout) | The centred hero icon shrinks into a slot in a sentence and the claim spills out of it. | **ADAPT** | Our pin glyph becomes the bullet of the claim; no stock icons. |
| `lc-icon-ragged-stack` (layout) | A lead word, then three or four keywords on staggered lines, each with a small icon. | **ADAPT** | Words only (no stock icons), e.g. three neighborhoods; each holds 2.5 s. |
| `lc-symmetric-flank` (layout) | A narrow centre object holds the middle while matching elements sit on both sides. | **ADAPT** | 9:16 version: flanks above and below the figure (cinetic says stack in vertical). |
| `mi-stretch-tab-indicator` (micro-interaction) | A selected pill shoots to a new option, its leading edge first, stretching mid-travel. | **ADAPT** | Two edges on two springs, applied to the navy highlight bar or underline under a word. |
| `ty-blur-focus-word-rise` (typography) | Words materialise one per beat out of a soft blur, rising a few pixels and darkening as they sharpen. | **ADAPT** | Calm and VO-paced, which suits us. Chromium steps blur radii, so drive blur through pre-baked copies or skip it and keep the ink resolve. |
| `ty-blur-swap-rescale` (typography) | A big word blurs out and instantly re-forms smaller as the start of the full line. | **ADAPT** | Hook figure to the claim sentence; overlap under about 0.17 s; blur from pre-baked copies. |
| `ty-front-restyle-sweep` (typography) | A front sweeps across a settled word and restyles each glyph in colour or weight. | **ADAPT** | Two colours only: navy-to-cream inversion per glyph under a crisp band, or a Geist weight wave; never serif to italic. |
| `ty-line-rebreak-glide` (typography) | A one-line statement re-breaks into a two-line stack with every word gliding to its new slot. | **ADAPT** | Vertical already stacks; use only to free space when the map rises. |
| `ty-occlusion-spill-from-mark` (typography) | A glyph or icon slides aside and the words shoot out from behind it, clipped at its edge. | **ADAPT** | The mark is our device (pin or dot), never the logo. |
| `ty-oversize-blur-slide-in` (typography) | A huge word arrives streaked from beside the frame and brakes on a long tail; a trailing word closes the gap. | **ADAPT** | Calm brake only, no streak past the blur ceiling; two-word claims such as a place-name pair. |
| `ty-recentre-line-build` (typography) | Words join a centred line one at a time while the whole line glides to stay centred. | **ADAPT** | product-film forbids re-centring while building; in 9:16 prefer the vertical word stack; use only on 2-3 word lines with a critically damped glide. |
| `ty-scaled-echo-extrusion` (typography) | A hero title carries two or three faint scaled copies behind it, a short depth extrusion that compresses as it lands. | **ADAPT** | Navy copies at stepped alpha behind one Amboqia hero word; one echo device per film; figureLeaks must read the copies as the same text. |
| `ty-shared-letter-morph` (typography) | One word turns into another: shared letters slide into place, new ones tumble in and click upright. | **ADAPT** | Only for two related words sharing 2+ letters; needs Amboqia glyph metrics; low priority. |
| `ty-slot-roller-fixed-phrase` (typography) | A fixed phrase holds still while the word in its slot rolls through alternatives, speeding up until the last lands. | **ADAPT** | Accelerating run conflicts with 2b; use the 3-step version (one roll per bar) and every slot word must be true (real place names). |
| `ty-swell-on-drop` (typography) | A small low-contrast word waits through the build, then swells to hero size with 90% of the growth on the beat drop. | **ADAPT** | We have no drops: land the swell on the VO stress or the hit Matt picks in the IG song's cue JSON. |
| `ui-lens-list-scroll` (UI choreography) | A list scrolls past an invisible lens line; each item's size and tint depend on its distance from it. | **ADAPT** | A picker wheel of Central Oregon place names landing on Bend; one slow roll; low priority. |
| `lc-mark-as-inline-word` (layout) | A logo sits inside a sentence at cap height as if it were a word. | **SKIP** | Logo only on the end card. |
| `ty-kinetic-word-slams` (typography) | A line read one huge word at a time; each hits oversized and blurred, then is sucked away. | **SKIP** | Slams retired by RULEBOOK 2b (calm eased entrances, 2026-10-09). |
| `ty-multi-direction-assemble` (typography) | Each word flies in from a different side, oversized and streaked, assembling at once. | **SKIP** | High-energy burst; 2b. |
| `ty-scramble-decode` (typography) | Random glyphs lock into the real text left to right. | **SKIP** | Random digits and letters on screen; letter gimmick; figureLeaks. |
| `ty-slice-band-assembly` (typography) | Each letter builds up from thin horizontal slices sliding in at offsets. | **SKIP** | Digital/pixel look, off the heritage register. |
| `ty-slice-glitch-streak` (typography) | A word jolts into displaced slices, then stretches into a capsule that races off. | **SKIP** | Glitch; 2b. |
| `ty-step-edit-performs-copy` (typography) | The headline acts out its copy with one-frame edits (broken words click straight, words delete faster and faster). | **SKIP** | Deadpan joke device; one-frame steps read as glitches; off-tone. |
| `ty-typeon-timeboxed` (typography) | Text types in, most of it in the first frames, every line finishing in the same musical length. | **SKIP** | Typing is a UI idea and a letter gimmick in our register (cinetic's own C9). |

From the other three libraries and the prompt-motion.com spec-grade prompts:

| Technique | What it looks like on screen | Verdict | For Ryan Realty | Source |
|---|---|---|---|---|
| Punchline words keep their slots | Big words land one by one on the beat; every word holds its final slot from the start (opacity, not unmount), so a centred line never re-centres. | **BUILD** | The engine for promoted lines and the payoff line; product-film lands words in 0.3 s with 16 px blur and 36 px rise; we keep our brand ease and pre-baked blur. | `Rieranthony/product-film-skill plugins/product-film/skills/product-film/templates/kit/punchlines.tsx` |
| Credit slot: names always in the same place | Credits and labels always live in one fixed margin slot so the eye knows where to look. | **BUILD** | Our one-line footer (definition, window, geography, type: RULEBOOK 3) always in the same slot. | `heygen-com/hyperframes-community-skills skills/vox-explainer/references/vox-text-overlays.md` |
| Quiet verbatim caption rail with suppression | A small caption rail cuts hard between cues and goes silent wherever promoted text already shows the words. | **BUILD** | Pair with tiktok_caption_burn: suppress the caption cue while the promoted line carries the same words. | `heygen-com/hyperframes-community-skills skills/vox-explainer/references/vox-text-overlays.md` |
| Kinetic phrase sequence, one move per phrase on the beat | Each phrase gets one move, landing on the beat grid. | **BUILD** | Same as ps-beat-quantized-chunks. | `buildfastwithai/buildfast-skills motion-studio-skill/reference/engine-api.md (MS.kinetic)` |
| Staircase promoted sentence, one per act | One sentence steps across 2-3 lines in fast cadence, each line a different treatment, the block settling from 1.24 to 1.0. | **ADAPT** | One per film; treatments limited to Amboqia, Geist and the navy highlight bar. | `heygen-com/hyperframes-community-skills skills/vox-explainer/references/vox-text-overlays.md` |
| Highlight bar sweeps on behind words | A solid bar grows left to right behind the words, never hard-appearing. | **ADAPT** | Navy bar with the words inverting to cream as it passes; leading and trailing edges on two springs (twoclipping-5cba86). | `heygen-com/hyperframes-community-skills skills/vox-explainer/references/vox-text-overlays.md` |
| Anchor word plus a drawn arrow touching its subject | A bold 3-word anchor ("THIS ROAD") with a curved arrow whose tip touches the feature. | **ADAPT** | Arrow tip measured onto the feature's pixel position in the real footage; navy stroke drawn on; at most once per film. | `heygen-com/hyperframes-community-skills skills/vox-explainer/references/vox-text-overlays.md` |
| Captions lead the voice by about 0.2 s | Each caption group arrives a fifth of a second before the word is heard. | **ADAPT** | Use the word clock from lib/studio/voice; skip the 15 fps posterize. | `heygen-com/hyperframes-community-skills skills/camera-3d-captions/SKILL.md (Rules)` |
| Text set on a circle as a seal | A short phrase set round a circle like a stamp or seal. | **ADAPT** | Heritage "stamped moment" in Amboqia round a figure, once; never as an eyebrow label. | `buildfastwithai/buildfast-skills generative-film-skill/SKILL.md (Unconventional devices)` |
| Words with architectural roles | Words become structure: one is a lintel, one a load, one a support, one an opening; the last line stands on a platform built from earlier words. | **ADAPT** | Registry words_become_structure (planned); real glyph paths, counters kept legible. | `prompt-motion.com/gdgtify-287ddf` |
| Zoom smear made of scaled copies | A fast pull-out leaves 20-30 scaled, faded copies of the word as a streak. | **ADAPT** | Only on the hook pull-out, navy alpha copies, and only if subframe blur cannot carry it. | `prompt-motion.com/notdwd-7de38a` |
| Caption groups at different depths around a speaker | Caption groups float at several depths; camera moves pull them apart; hero word hides behind the speaker. | **SKIP** | Needs a talking head and a matte; buyer ads carry no person (people are never generated). | `heygen-com/hyperframes-community-skills skills/camera-3d-captions/SKILL.md` |
| Handwriting write-on | Pencil handwriting writes itself onto ruled paper. | **SKIP** | Off register for ads; brand art is Matt's real artwork only. | `heygen-com/hyperframes-community-skills skills/p5-paint-animation/SKILL.md (Flow A)` |

### 1.3 Scene

The picture devices that carry a beat: camera, composition, pacing and structure, 3D, and product UI. cinetic entries here: 100; from the other libraries and the gallery: 9. Verdicts: 16 BUILD, 17 ADAPT, 76 SKIP.

#### Camera

cinetic (`Leonxlnx/cinetic` `skills/cinetic/assets/library/techniques.json`, by entry id; the same entries are written out in `skills/cinetic/references/technique-library.md`). The bracket after each id is cinetic's own category.

| Entry id (source) | What it looks like on screen | Verdict | For Ryan Realty |
|---|---|---|---|
| `cam-detail-first-pullback` (camera) | A shot opens tight on the one thing that matters, then pulls back to show it in context. | **BUILD** | Open tight on a pin's tag or the figure, pull back to the Bend map. |
| `cam-isolating-push` (camera) | The camera pushes into one row or card while everything around it fades or slides off. | **BUILD** | Push into one neighborhood on the map while the others dim. |
| `cam-living-hold` (camera) | Under every hold the frame keeps a barely visible push, pull or sideways drift. | **BUILD** | Matches holdDrift in reveal.ts; extend to a camera creep on footage and maps so 2.5 s holds never freeze. |
| `cam-pull-lands-event` (camera) | A long gentle pull-back lands the next event on its settle. | **BUILD** | Pull from a neighborhood to the city as the overlap count lands. |
| `cam-reframe-to-subject` (camera) | When something new appears the camera glides a few hundred px and pushes slightly to frame it. | **BUILD** | After a pin cluster lands off-centre. |
| `cam-breathing-zoom` (camera) | After a reveal the camera pulls back, coasts through a stop, and turns into a slow push onto the next point. | **ADAPT** | For a 4-10 s map act with several call-outs; no UI. |
| `cam-crane-push` (camera) | The camera tilts down a long page while a slow push-in builds behind it. | **ADAPT** | A tall 9:16 composition (map above, figure below); low priority. |
| `cam-parallax-truck` (camera) | The camera trucks sideways across 2-3 depth planes moving at different rates. | **ADAPT** | Only on our own stills cut into layers (paper_cutout_layers); never on MLS photos (cutting them into planes restyles them, RULEBOOK 6). |
| `cam-crash-zoom-through` (camera) | An object extrudes toward camera and the camera slams into it. | **SKIP** | Violent; 2b. |
| `cam-cursor-whip-orbit` (camera) | The camera swings fast across the product following a cursor. | **SKIP** | Cursor, UI, whip. |
| `cam-dolly-surge-foreground` (camera) | The camera surges into a 3x close-up and a near object rushes past the lens. | **SKIP** | Layered 3D world; energetic. |
| `cam-hero-push-yaw` (camera) | One continuous 2.5x push into a panel while yawing it toward camera. | **SKIP** | 3D UI. |
| `cam-impact-kick` (camera) | On a true impact the whole frame jolts a few pixels and settles. | **SKIP** | Camera shake; 2b and every gallery ban list. |
| `cam-offframe-whip-relay` (camera) | The cursor leaves frame, the camera whips while it is hidden, the cursor re-enters. | **SKIP** | Cursor; whip. |
| `cam-punch-in-insert` (camera) | A hard cut jumps to a 2-4.5x close-up of the exact control being used, animations still running. | **SKIP** | UI walkthrough; a hard punch reads as a snap zoom (2b). |
| `cam-push-dutch-roll` (camera) | A dive into a UI corner rolling a few degrees off level. | **SKIP** | UI; roll on maps or footage reads as wobble. |
| `cam-z-field-flythrough` (camera) | The camera flies forward through dozens of flat screens floating at depth. | **SKIP** | Floating-screenshot breadth (cinetic H1). |

#### Composition and layout

cinetic (`Leonxlnx/cinetic` `skills/cinetic/assets/library/techniques.json`, by entry id; the same entries are written out in `skills/cinetic/references/technique-library.md`). The bracket after each id is cinetic's own category.

| Entry id (source) | What it looks like on screen | Verdict | For Ryan Realty |
|---|---|---|---|
| `lc-one-centred-subject` (layout) | Every frame has exactly one subject, centred and large. | **BUILD** | Default framing for the ads (RULEBOOK 2, one idea per beat). |
| `lc-subtract-to-one` (layout) | A busy board loses elements one by one until a single survivor remains. | **BUILD** | All pins fade except one neighborhood's set; never single out one property. |
| `lc-vertical-band-stack` (layout) | In 9:16 the caption and subject stack inside the band the feed leaves clear. | **BUILD** | Our safe zone (x<=960, y<=1640): the layout grammar for every vertical piece. |
| `mi-pre-event-tell` (micro-interaction) | Just before a state change exactly one small thing moves while everything else holds. | **BUILD** | Before the map act the dot turns toward the map. |
| `lc-negative-space-caption` (layout) | Each move ends with the subject on two-thirds of the frame and a clean band for the caption. | **ADAPT** | Compose camera moves on footage to leave a top or bottom band for the line; in 9:16 the band is top or bottom only. |
| `ui-push-aside-reflow` (UI choreography) | An incoming panel enters and its neighbours move aside, bound to its edge. | **ADAPT** | When the map rises it pushes the line up: one motion moves two things, nothing overlaps. |
| `lc-arc-carousel` (layout) | A row of cards rides a smile-shaped arc across the lower frame. | **SKIP** | Card inventory; tight in 9:16. |
| `lc-bento-cell-takeover` (layout) | In a flush four-cell grid one cell grows to fill the frame. | **SKIP** | Breadth grid; cells too small in 9:16. |
| `lc-headline-over-ghost-ui` (layout) | A headline inks in over a faint copy of the product UI. | **SKIP** | UI. |
| `lc-hub-spoke-diagram` (layout) | A central tile inside rings with inputs on the left and outputs on the right. | **SKIP** | Integrations diagram. |
| `lc-live-split-view` (layout) | Two live panels side by side, cause and effect. | **SKIP** | UI; vertical stacks instead. |
| `lc-opposite-corner-relay` (layout) | One caption fades from one corner while the next builds in the mirrored corner. | **SKIP** | Corners of 9:16 sit in platform UI zones. |
| `lc-swarm-cluster-burst` (layout) | About twenty cards fly in, pack into a cluster, then blow past camera to uncover a hero. | **SKIP** | Swarm burst; 2b. |

From the other three libraries and the prompt-motion.com spec-grade prompts:

| Technique | What it looks like on screen | Verdict | For Ryan Realty | Source |
|---|---|---|---|---|
| Evidence stack of photo cards | Uniform photo cards pile almost on top of each other with jitter, one per spoken phrase. | **ADAPT** | Owned or licensed place photos only; never MLS photos for spotlights we did not list; cards are boxes, so neighborhood spotlights only. | `heygen-com/hyperframes-community-skills skills/vox-explainer/references/vox-collage-layout.md` |
| Background-dropped cutout docks into a layout | A subject is lifted off its photo and moves as a cutout, docking into a grid or riding a camera move. | **ADAPT** | A landmark (Pilot Butte, Old Mill stacks) from our own footage; cutting a photo restyles it, so never MLS. | `heygen-com/hyperframes-community-skills skills/vox-explainer/SKILL.md (Technique floor)` |

#### Pacing and structure

cinetic (`Leonxlnx/cinetic` `skills/cinetic/assets/library/techniques.json`, by entry id; the same entries are written out in `skills/cinetic/references/technique-library.md`). The bracket after each id is cinetic's own category.

| Entry id (source) | What it looks like on screen | Verdict | For Ryan Realty |
|---|---|---|---|
| `ps-continuity-thread` (pacing) | One small accent object recurs across shots and acts, carrying the idea as one causal chain. | **BUILD** | one_dot_thread (registry, planned): the navy dot. |
| `ps-direction-per-act` (pacing) | Each act owns one direction of travel; it turns only at an act seam. | **BUILD** | Vertical films ride a rising vector; matches the vox "current". |
| `ps-luma-act-map` (pacing) | Acts are planned by stage polarity: dark for the problem, light for the product. | **BUILD** | Footage or navy for the tension, cream for the answer: our two colours are the act map. |
| `ps-breath-envelope` (pacing) | Every card arrives fast and decelerates, keeps moving gently through its hold, then accelerates away into the cut. | **ADAPT** | Our 2.5 s holds with drift; exits accelerate (motion-design contract 6); not a fast-cut film. |
| `ps-empty-ground-after-cut` (pacing) | After a hard cut the new stage shows two empty frames before its type appears. | **ADAPT** | Two frames at 60 fps is one at 30; optional and must not trip the pop or freeze checks. |
| `ps-faster-each-repeat` (pacing) | The first instance of a repeated action plays full length, the second about 40% quicker, later ones faster. | **ADAPT** | First pin lands at full read; the rest land as a group; nothing with text shorter than its read time. |
| `ps-image-act-then-type-act` (pacing) | A short spot splits: first half pure imagery, second half pure type. | **ADAPT** | Hook text must land by 2 s, so: image with one figure, then the type act; for 6-15 s cutdowns (PROPOSED P2). |
| `ps-locked-camera-holds` (pacing) | After each move the camera stops dead and only the caption and one element move for a 1-4 s read. | **ADAPT** | Camera near-locked (creep only, so freezedetect passes) while pins land, so the data is the motion. |
| `ps-long-tail-beat-lengths` (pacing) | Most beats sit near a median length, a few connective beats snap past, one or two hero beats run three times as long. | **ADAPT** | The 2.5 s floor (2b) rules out short connectives; let the hero beat (the map act) run long instead. |
| `ps-one-long-hold` (pacing) | In a film that never stops, one key claim sits nearly still for over a second. | **ADAPT** | Every beat already holds 2.5 s; make the payoff claim the one near-still hold (keep the 8 px drift) under a score thin-out. |
| `ps-oner-morph-chain` (pacing) | The whole film is one continuous shot; every scene grows out of an object already on screen. | **ADAPT** | Footage beats break it; aim for one take inside each graphic act. |
| `ps-accelerando-to-climax` (pacing) | Shot lengths shrink toward the climax, then one freeze on silence resets the clock. | **SKIP** | Shrinking shots; 2b. |
| `ps-fixed-ask-variable-answer` (pacing) | A fixed-length ask beat repeats, each followed by an answer whose length varies. | **SKIP** | Prompt-to-result demo rhythm. |
| `ps-four-sequence-launch` (pacing) | Spectacle open, concept diagram, long product walkthrough, brand close. | **SKIP** | 30-60 s launch structure; our arc is hook, intro, body, payoff, end card. |
| `ps-machine-grid-human-gaps` (pacing) | Product work ticks on a strict metronome while a person's actions arrive on uneven gaps. | **SKIP** | Person-versus-product UI rhythm. |

From the other three libraries and the prompt-motion.com spec-grade prompts:

| Technique | What it looks like on screen | Verdict | For Ryan Realty | Source |
|---|---|---|---|---|
| One brand element with placement(t) and arcing leaps | One instance of a mark or mascot travels the whole film between named spots on arcing leaps. | **BUILD** | Implementation pattern for one_dot_thread (never the logo). | `Rieranthony/product-film-skill plugins/product-film/skills/product-film/reference/engine.md and ingredients.md` |
| Every phase owned by a motion route; no idle wobble | Between entry and exit something narrative is always mid-flight: staged reveals, camera with intent, sequenced life, an animated sequence. | **BUILD** | Gate for our 2.5 s holds: drift keeps freezedetect quiet but does not count as an event. | `heygen-com/hyperframes-community-skills skills/vox-explainer/references/motion-continuity.md (Part 2)` |
| Stillness before climax, 0.3-0.75 s | A short dramatic comma between the action and its result. | **BUILD** | Before the overlap count or the payoff line. | `heygen-com/hyperframes-community-skills skills/vox-explainer/references/motion-continuity.md` |
| Chaos to control to clarity arc; three extraordinary moments over ten mediocre | One continuous thought instead of a feature list. | **BUILD** | Principle for 15-30 s ads: hook, the map, the payment, the card. | `prompt-motion.com/daniel-haida-8691d4` |
| At least one 400 ms moment of absolute stillness | One true freeze makes the change after it feel earned. | **ADAPT** | Must stay under the freezedetect threshold of video:check check 6. | `prompt-motion.com/gdgtify-287ddf` |
| Persistent element connecting shots | One narrow element (a player bar) stays put across shots, tying them together. | **ADAPT** | The footer line or the navy dot plays this role; never a box. | `prompt-motion.com/brainextends-e19ac3` |

#### 3D

cinetic (`Leonxlnx/cinetic` `skills/cinetic/assets/library/techniques.json`, by entry id; the same entries are written out in `skills/cinetic/references/technique-library.md`). The bracket after each id is cinetic's own category.

| Entry id (source) | What it looks like on screen | Verdict | For Ryan Realty |
|---|---|---|---|
| `d3-coin-edge-to-face` (depth and 3D) | An edge-on sliver snaps open into a face-on coin or badge. | **SKIP** | Coin/badge reveal. |
| `d3-cube-turn-face` (depth and 3D) | Words slide under an icon that turns 90 degrees like a cube to show a blank face. | **SKIP** | 3D UI. |
| `d3-extruded-slab-orbit` (depth and 3D) | Live UI on a thick slab whose edge shows as the camera orbits. | **SKIP** | 3D product turntable. |
| `d3-flip-face-swap` (depth and 3D) | An icon or card turns over in 3D and comes back changed. | **SKIP** | 3D flip; gallery prompts ban 3D flips. |
| `d3-fold-out-channel` (depth and 3D) | A card bent into a U-channel flattens and its contents fan into a row. | **SKIP** | 3D UI. |
| `d3-icon-lift-to-hero` (depth and 3D) | A small icon peels out of a settings row and floats to centre as a 3D hero. | **SKIP** | UI. |
| `d3-impact-morph-stretch` (depth and 3D) | Something hits a 3D tile, which swaps shape and colour and stretches as the floor ripples. | **SKIP** | 3D impact. |
| `d3-orbit-ring-collapse` (depth and 3D) | Icons orbit a central mark on a tilted ellipse, then collapse into it. | **SKIP** | Integrations ecosystem. |
| `d3-peek-launch-recede` (depth and 3D) | A device peeks up, pauses, shoots to centre tilted, settles away. | **SKIP** | Hardware hero. |
| `d3-press-tilt-swap` (depth and 3D) | A card tips toward a click and the content swaps on the peak tilt. | **SKIP** | UI clicks. |
| `d3-spotlit-tilted-object` (depth and 3D) | A card lies in perspective on a dark surface under one pool of light. | **SKIP** | 3D object styling. |

#### Product UI and micro-interaction

cinetic (`Leonxlnx/cinetic` `skills/cinetic/assets/library/techniques.json`, by entry id; the same entries are written out in `skills/cinetic/references/technique-library.md`). The bracket after each id is cinetic's own category.

| Entry id (source) | What it looks like on screen | Verdict | For Ryan Realty |
|---|---|---|---|
| `mi-anticipation-dip-unlock` (micro-interaction) | Light builds on a locked card, it darkens as the shackle opens, then pops clean. | **SKIP** | Lock/unlock; brightness flash. |
| `mi-chip-bloom` (micro-interaction) | A container grows out of its content and floods with the accent. | **SKIP** | UI chip. |
| `mi-cursor-glyph-context` (micro-interaction) | The pointer changes shape with what it is over. | **SKIP** | Cursor. |
| `mi-drag-lift-seat` (micro-interaction) | A chip lifts under the cursor and drops into its slot with a squash. | **SKIP** | Cursor drag. |
| `mi-drag-select-highlight` (micro-interaction) | An I-beam drags a highlight across a phrase and an action bar grows from it. | **SKIP** | Text UI. |
| `mi-field-focus-caret` (micro-interaction) | An I-beam clicks a field, a caret blinks, typing starts. | **SKIP** | UI. |
| `mi-guide-cursor-hover-press` (micro-interaction) | A cursor arcs to an element, it shows its hover state, a press triggers the response. | **SKIP** | Cursor. |
| `mi-in-place-char-rewrite` (micro-interaction) | A monospace status field is overwritten left to right by its new state. | **SKIP** | UI status. |
| `mi-launch-hop` (micro-interaction) | An app icon hops up and the camera leaves before it lands. | **SKIP** | App icon. |
| `mi-radial-dash-burst` (micro-interaction) | Short dashes burst outward round a hero word on the beat. | **SKIP** | Burst decoration. |
| `mi-send-ghost-handoff` (micro-interaction) | On send, composer text drifts up and reappears as a posted message. | **SKIP** | Chat UI. |
| `mi-shared-highlight-walk` (micro-interaction) | One rounded highlight slides from row to row of a menu. | **SKIP** | Menu UI. |
| `mi-spinner-to-check` (micro-interaction) | A spinner resolves into a check with a short tag. | **SKIP** | UI. |
| `mi-two-beat-confirm-cascade` (micro-interaction) | Rows of toggles confirm one by one, label first, fill a beat later. | **SKIP** | UI. |
| `pd-agent-status-then-answer` (product demo) | A working status capsule holds, then dissolves as the answer streams. | **SKIP** | Agent UI. |
| `pd-blur-resolve-load` (product demo) | A generated view appears soft and snaps into crisp UI. | **SKIP** | Generation UI. |
| `pd-device-rise-on-cut` (product demo) | A phone or window enters from below already moving and settles. | **SKIP** | Device mockup. |
| `pd-diff-hunks-apply` (product demo) | A change lands as a diff, hunk by hunk. | **SKIP** | Code/doc UI. |
| `pd-drag-assets-skeleton-fill` (product demo) | Images dragged in appear as skeletons that fill one by one. | **SKIP** | Upload UI. |
| `pd-fast-prompt-true-scale` (product demo) | A long prompt fills the real bar at full size in about a second. | **SKIP** | Prompt UI. |
| `pd-flick-scroll-lands-target` (product demo) | A list flicks and glides on an exponential tail to the target row. | **SKIP** | Scrolling UI. |
| `pd-ghost-suggestion-accept` (product demo) | Ghost completion text appears and inks in when a key is pressed. | **SKIP** | Editor UI. |
| `pd-headline-becomes-input` (product demo) | The headline turns into the product's input bar. | **SKIP** | Input-led product. |
| `pd-mark-docks-into-app` (product demo) | An integration mark travels to an app tile and docks on its face. | **SKIP** | Integrations. |
| `pd-page-runway-flyover` (product demo) | A long page on a tilted plane is flown like a runway. | **SKIP** | Web page; vertical leaves no runway. |
| `pd-presence-cursors` (product demo) | Two or three named cursors work on one canvas at once. | **SKIP** | Collaboration UI. |
| `pd-single-control-hero` (product demo) | One native control, huge and centred, doing its native interaction. | **SKIP** | UI control. |
| `pd-terminal-burst-output` (product demo) | A typed command, then output printing in bursts. | **SKIP** | Terminal. |
| `pd-tilted-plane-flattens` (product demo) | A tilted product page rises and rotates flat to face the viewer. | **SKIP** | 3D UI. |
| `pd-ui-native-transitions` (product demo) | The film moves between areas the way the app does (window recedes, sheet slides). | **SKIP** | Product UI. |
| `ui-card-grid-arrival` (UI choreography) | Cards are dealt or dropped into a grid one after another. | **SKIP** | Cards over footage are the look we are leaving. |
| `ui-clutter-pileup-strip` (UI choreography) | Clicks spawn copies until the frame is a pile, then elements vanish to one. | **SKIP** | Abrupt jumps; UI. |
| `ui-discard-into-bin` (UI choreography) | Chips are tossed into a bin that catches them with one rebound. | **SKIP** | Playful bounce. |
| `ui-drag-reorder-makeway` (UI choreography) | An item lifts and travels to a new position as siblings make way. | **SKIP** | UI. |
| `ui-fan-resolve-to-slots` (UI choreography) | A fanned stack spreads into a row or flies into grid slots. | **SKIP** | Card UI. |
| `ui-genie-launch-from-icon` (UI choreography) | A dock icon flares into a funnel that fills the frame with the app inside. | **SKIP** | App launch. |
| `ui-live-reflow` (UI choreography) | A container resizes and its content reflows. | **SKIP** | UI. |
| `ui-orbit-gather-merge` (UI choreography) | Tokens swing into orbit round a node, then accelerate into one exit point. | **SKIP** | Diagram of a product pipeline. |
| `ui-outline-led-reveal` (UI choreography) | A thin outline appears first and opens into a new row or modal. | **SKIP** | UI. |
| `ui-path-fracture-fan` (UI choreography) | A line breaks into a fan of curves ending on obstacle pills, then funnels back. | **SKIP** | Diagram language for software flows. |
| `ui-row-cascade` (UI choreography) | List rows appear top to bottom, each rising as it fades in. | **SKIP** | A list of stats is "scrolling through stats" (RULEBOOK 2). |
| `ui-shell-first-build` (UI choreography) | The empty container arrives first, its contents fill, the primary button fills last. | **SKIP** | UI. |
| `ui-stalled-state` (UI choreography) | A token stops on its rail, the destination greys, the frame goes still. | **SKIP** | Problem-act UI. |
| `ui-top-insert-push` (UI choreography) | New items arrive at the top of a list pushing earlier items down. | **SKIP** | Feed UI. |

From the other three libraries and the prompt-motion.com spec-grade prompts:

| Technique | What it looks like on screen | Verdict | For Ryan Realty | Source |
|---|---|---|---|---|
| Foldable-phone plate, Strudel code video, X license card | Two app screens in a photographed foldable phone; live-coded music shown as lit code; a fake ID card video. | **SKIP** | Off brief; prod-by-claude also pulls @strudel/web (AGPL-3.0). | `heygen-com/hyperframes-community-skills skills/duo, skills/prod-by-claude, skills/x-posting-license` |

### 1.4 Data viz

Charts, counts, grids and comparisons. cinetic entries here: 21; from the other libraries and the gallery: 8. Verdicts: 3 BUILD, 21 ADAPT, 5 SKIP.

cinetic (`Leonxlnx/cinetic` `skills/cinetic/assets/library/techniques.json`, by entry id; the same entries are written out in `skills/cinetic/references/technique-library.md`). The bracket after each id is cinetic's own category.

| Entry id (source) | What it looks like on screen | Verdict | For Ryan Realty |
|---|---|---|---|
| `dn-line-draw-tracked-head` (data and numbers) | A line draws left to right behind a solid head dot that accelerates through the middle and creeps into its last point. | **BUILD** | Built as line_draw_riding_dot (chart.ts). Adopt the single rest-ending curve so the head never stops and restarts; no area-fill gradient. |
| `cl-accent-hit-envelope` (colour and light) | On a press or impact the element floods with the accent, peaks one frame with its label inverted, then bleeds back. | **ADAPT** | No presses: on the frame a figure lands its block floods navy with cream label; no one-frame flash peak. |
| `d3-exploded-layer-stack` (depth and 3D) | A component turns three-quarter and separates into its layers along depth, then snaps back. | **ADAPT** | In 2D: a monthly payment separating into its sourced parts (principal and interest, taxes, insurance), each part a brief row; low priority. |
| `dn-area-ratio-compare` (data and numbers) | A multiplier claim plays as a block shrinking in log space to its true area, leaving its old outline. | **ADAPT** | Only for verified, truly proportional ratios under 25x; navy block on cream. |
| `dn-bar-sweep-lit-caps` (data and numbers) | A row of bars grows in a constant-speed wave; each bar flashes a bright cap that relaxes to the bar tone. | **ADAPT** | Monthly closes as a skyline; the cap is a navy/cream inversion, not a lighter tint; slow wave per 2b. |
| `dn-delta-chip-compare` (data and numbers) | The old figure steps back to a small "before", the new one lands at hero size, a delta chip pops on the landing frame. | **ADAPT** | Before, after and delta are three numbers: market_update only, and only with Matt's per-piece override of the 1-2 number rule; chip navy with cream text. |
| `dn-digit-reel-detent` (data and numbers) | Odometer columns roll vertically; low columns spin, high ones step once, each clicking home. | **ADAPT** | Rolling through intermediate digits shows values that are not the figure. Adapt to a detent lock: each column strip holds blank and its final digit only, rolls once, clicks home on a near-critical spring. Buyer-ad hook figure. |
| `dn-ease-out-count-up` (data and numbers) | A proof figure counts up in place from 85-90% of its target and decelerates so the last units tick in. | **ADAPT** | Starting at 85% draws figures that are not in the brief, and for the buyer ad 85% of $10,000 is $8,500, which the 2026-10-14 handoff records as 2025's median credit: a real, superseded value (VIDEO_TYPES: count-ups never roll through superseded values). Count only where every integer shown is true by construction (a tally of pins actually drawn); otherwise use eased_number_reveal or the detent lock. |
| `dn-flag-then-select` (data and numbers) | Status marks cascade over a set of cards, then one card switches to the accent state. | **ADAPT** | Cards become pins or tiles of real sales; the selected one must not identify a property (no address, no photo unless ours); calm cascade. |
| `dn-hero-bar-pullback` (data and numbers) | The winning bar grows across a tight frame, then the camera eases back to show the whole chart with grey comparison bars. | **ADAPT** | Comparison bars in navy at reduced alpha; honest only when the hero bar truly wins (same window across years); no glow; six bars at most. |
| `dn-linked-control-counters` (data and numbers) | Dragging one slider drives several dependent figures in lockstep; the fill changes tint past a threshold. | **ADAPT** | No slider or cursor: drive by time. Every dependent value must be a brief row with a trace, which in practice limits it to one input and one output (the payment math). |
| `dn-ring-gauge-sync` (data and numbers) | A circular gauge sweeps to its value while the centre number counts on the same progress. | **ADAPT** | meter_fill_verdict already fills to its value; ring only for true parts of a whole (share of sales with a credit); centre number lands whole, never counts. |
| `dn-unit-grid-tally` (data and numbers) | A grid of small squares fills in a diagonal wave while a counter reaches the total; one cell lands in the accent. | **ADAPT** | One cell per real sale in the window (a quarter of Bend single-family closes fits a square grid at about 30 px cells in 9:16), filled navy over a navy-alpha track; the counter shows only the final verified figure; cells at least 30 px in 9:16. |
| `mi-badge-count-bump` (micro-interaction) | A badge digit rolls to the next value with a small pulse per increment. | **ADAPT** | A running tally beside landing pins, only if figureLeaks gains a tally rule (the value equals pins drawn); otherwise skip. |
| `pd-chart-scrub-readout` (product demo) | A hairline and dot ride a chart with a live readout stepping point to point until it lands on the claim. | **ADAPT** | No cursor; each readout value must be a published Market Truth cell in the brief; land on the latest month. |
| `ui-progress-spine-steps` (UI choreography) | A thin line grows down a step list with a dot at its head; each step resolves as the head reaches it. | **ADAPT** | "How a seller credit works" in three steps for an explainer; no spinners; wording reviewed for accuracy. |
| `d3-card-fan-bury-scatter` (depth and 3D) | A dozen cards swoop in and bury the frame, then scatter to leave one card with the number. | **SKIP** | Loud card swarm; 2b. |
| `dn-answer-card-bars` (data and numbers) | Inside a chat panel an answer arrives as a card of labelled horizontal bars. | **SKIP** | Chat/AI product UI. |
| `dn-count-glyph-swap` (data and numbers) | A small icon riding a counting number swaps to its destination state at a threshold. | **SKIP** | Needs a from-to icon; stock-icon risk (RULEBOOK 6 bans Lucide or stock icons standing in for brand art). |
| `dn-row-cascade-value-swap` (data and numbers) | A thin scan line crosses each table row in turn and its values change behind it. | **SKIP** | Table/leaderboard UI; reads as scrolling through stats (RULEBOOK 2). |
| `dn-status-pill-ring` (data and numbers) | A compact capsule with a live dot, step label, ring percentage and date. | **SKIP** | Process-status UI; reads as filler on a real-estate ad. |

From the other three libraries and the prompt-motion.com spec-grade prompts:

| Technique | What it looks like on screen | Verdict | For Ryan Realty | Source |
|---|---|---|---|---|
| Mechanism beat the viewer can verify | One claim demonstrated on screen (two panels, dots redistributed two ways, before/after at equal scale) rather than asserted. | **BUILD** | Principle for every data claim, with the 0 trace behind each figure. | `heygen-com/hyperframes-community-skills skills/vox-explainer/SKILL.md (storyline mine)` |
| Graph drawn from the same spring that moves the dot | A dot's motion and the graph it traces are one function, so they never disagree. | **BUILD** | Principle: the readout, the dot and the line share one curve (chart.ts already samples the dot from the line). | `prompt-motion.com/ultimaxbt-bbebf5` |
| Two-panel compare | Two near-full-frame panels side by side, asset left, word right. | **ADAPT** | 9:16 stacks them: then over now, same scale, both figures sourced. | `heygen-com/hyperframes-community-skills skills/vox-explainer/references/vox-collage-layout.md` |
| Specimen grid with one survivor | A grid of subjects where the highlighted cell stays bright and others dim to about 45%. | **ADAPT** | A grid of Central Oregon places dimming to the one in the story; navy alpha dims. | `heygen-com/hyperframes-community-skills skills/vox-explainer/references/vox-collage-layout.md` |
| Ingredients pour in with amounts | Each ingredient enters with its measurement until the whole is built. | **ADAPT** | Anatomy of a monthly payment, only with a primary rate source and a trace per part. | `prompt-motion.com/ror-fly-9950f1` |
| Token bucket draining | A bucket of tokens drains at a fixed rate as requests arrive. | **ADAPT** | Registry bucket_drain (planned): months of supply as actives drained by six months of closes; thresholds 4 and 6. | `prompt-motion.com/parkerrex-1a54fe` |
| Milestone timeline | A time axis draws on; years as big numerals; events pop at their dates; camera tracks along. | **ADAPT** | Registry milestone_timeline (planned): each point a sourced annual figure. | `prompt-motion.com/kloss-xyz-fe0c31 and buildfastwithai/buildfast-skills motion-studio-skill/styles/visual/information.json (timeline)` |
| Infographic beat template | Title with source line, headline number, chart, second insight, conclusion. | **ADAPT** | Compress to 1-2 numbers per RULEBOOK 2a. | `buildfastwithai/buildfast-skills motion-studio-skill/templates/infographic.json` |

### 1.5 Map

Places, pins, routes and the camera over a map. cinetic entries here: 11; from the other libraries and the gallery: 7. Verdicts: 5 BUILD, 13 ADAPT, 0 SKIP.

cinetic (`Leonxlnx/cinetic` `skills/cinetic/assets/library/techniques.json`, by entry id; the same entries are written out in `skills/cinetic/references/technique-library.md`). The bracket after each id is cinetic's own category.

| Entry id (source) | What it looks like on screen | Verdict | For Ryan Realty |
|---|---|---|---|
| `cam-fit-bounds-follow` (camera) | As a route or graph builds, the camera widens just enough to keep every piece in frame. | **BUILD** | Pins across Bend: open close on the first sale, widen to the city as the set completes. |
| `cam-lead-follow` (camera) | A small lead (dot, packet, line head) moves through the layout and the camera follows with a soft lag. | **BUILD** | A dot travelling a route across Bend or between pins; the lag is a pure function (sum from the shot's first frame). |
| `cam-zoom-out-hop` (camera) | To travel between two distant areas the camera eases back, crosses wide, and pushes back in. | **BUILD** | Travel between two neighborhoods on the map. |
| `mi-velocity-stretch-dot` (micro-interaction) | A small dot stretches into a capsule along its motion in proportion to speed and shrinks back when it stops. | **BUILD** | The travelling navy dot; once per film. |
| `ui-anchor-point-spawn` (UI choreography) | Menus and cards scale out of the exact point that caused them and collapse back into it. | **BUILD** | A tag spawns from its pin tip and collapses back into it. |
| `d3-pinned-label-world-swap` (depth and 3D) | A pin on a 3D place carries a data tag on a leader; on a cut the world switches 3D to flat while the tag holds. | **ADAPT** | The world is real drone footage, not a 3D render: track the pin on the footage, cut the world to the drawn map, the tag holds. Needs the footage registered to map coordinates. |
| `mi-focus-ring-pop-or-trim` (micro-interaction) | A thin outline pops outward on a click, or draws clockwise round a target and erases from the tail. | **ADAPT** | No clicks: the trim ring draws round a pin or round a landmark measured on the footage. |
| `pd-live-filter-narrows` (product demo) | A list narrows with each keystroke: non-matching rows fold away, survivors slide up. | **ADAPT** | The map narrows: as each filter word lands ("price cut", "seller credit"), non-matching pins fold away; survivors are the overlap Matt asked for. |
| `pd-pin-field-pullback` (product demo) | A map pulls back to reveal a field of pins dropping in as accent marks that relax to ink; a card grows from one pin. | **ADAPT** | Pins are real price-cut and credit sales; category by shape not hue (filled dot, ring, ring with a dot for both); no cursor; a card only for an aggregate tag, never an address. Buyer-ad core scene. |
| `ps-single-camera-journey` (pacing) | Every state lives on one large surface and the film is a single camera path between poses. | **ADAPT** | The Bend map as the one world of the data act (world container, log-space zoom). |
| `tx-dot-matrix-silhouette` (texture and finish) | Behind a claim a barely visible field of dots forms a meaningful silhouette (a region, a map). | **ADAPT** | Bend's limits as a navy dot field about 4% off cream behind the hook figure, from the stored boundary; pitch scaled up for 9:16. |

From the other three libraries and the prompt-motion.com spec-grade prompts:

| Technique | What it looks like on screen | Verdict | For Ryan Realty | Source |
|---|---|---|---|---|
| Zoom-isolation swap | The camera pushes into a photograph, the background drops to white leaving the subject as a cutout, which becomes the diagram. | **ADAPT** | Push into real Bend aerial footage; everything but the neighborhood's polygon (registered on the footage) drains to cream; the polygon becomes the drawn map. The cleanest "map sits on real footage" move. | `heygen-com/hyperframes-community-skills skills/vox-explainer/references/vox-collage-motion.md` |
| Grid unfolds from behind like a paper map | A square unfolds into a grid in stages (centre, plus, corners) like a road map opening. | **ADAPT** | The Bend map unfolds as creased cream paper with navy linework; creases are lines on the paper; folds overlap about 39% on the 7x ease. | `prompt-motion.com/twoclipping-221cab and heygen-com/hyperframes-community-skills skills/session-story/references/motion.md (Paper)` |
| Dotted landmass, animated routes, pins, camera flies between places | A documentary map: dotted land, routes drawing on, pins and dates, camera travelling. | **ADAPT** | Navy dots on cream from stored boundaries; routes only along real roads or the river. | `buildfastwithai/buildfast-skills motion-studio-skill/styles/visual/information.json (documentary-map)` |
| Courier dot follows a route to a pin | A dot travels a drawn route and arrives at a pin. | **ADAPT** | Route along real geometry; the pin never becomes the logo (logo only on end card). | `prompt-motion.com/ultimaxbt-2ddf1e` |
| Survey-plat linework with dimension lines | White linework on blueprint blue with construction and dimension lines drawing on. | **ADAPT** | Navy linework on cream for subdivision plats (PLACE_PAGES subdivision families); dimensions only from recorded plats. | `buildfastwithai/buildfast-skills motion-studio-skill/styles/visual/information.json (blueprint)` |
| One unbroken line drawing | A single continuous line draws a whole figure without lifting. | **ADAPT** | The Deschutes or Bend's outline as one line; we already draw outlines (outline_draw_zoom). | `buildfastwithai/buildfast-skills generative-film-skill/SKILL.md (repertoire)` |
| Hand-drawn ellipse measured onto a photo | A circle or arrow is drawn onto a photo exactly on the feature it points to. | **ADAPT** | Measured on the rendered frame (crop and verify the mark sits on the feature); navy stroke. | `heygen-com/hyperframes-community-skills skills/vox-explainer/references/vox-collage-layout.md (Annotations are measured)` |

### 1.6 Transition

How one beat becomes the next. cinetic entries here: 33; from the other libraries and the gallery: 15. Verdicts: 20 BUILD, 22 ADAPT, 6 SKIP.

cinetic (`Leonxlnx/cinetic` `skills/cinetic/assets/library/techniques.json`, by entry id; the same entries are written out in `skills/cinetic/references/technique-library.md`). The bracket after each id is cinetic's own category.

| Entry id (source) | What it looks like on screen | Verdict | For Ryan Realty |
|---|---|---|---|
| `cl-drain-stage-keep-hero` (colour and light) | Everything around the hero fades and the world drops to dark or white while the hero stays crisp in place. | **BUILD** | The bridge from footage to paper: Bend footage drains to cream, the outline or pin stays. |
| `pd-hard-swap-on-cause` (product demo) | On the cause frame the view or value changes in one frame with no crossfade. | **BUILD** | The map's category swap on the beat; numbers cut, never crossfade (cinetic data intro). |
| `tr-anchor-overlay-cut` (transition) | A foreground element (pin, figure, word) keeps its exact screen position while the world behind it hard-cuts. | **BUILD** | A pin or figure holds while the background swaps from real drone footage to the drawn map: the core fix for "boxes on drone footage". |
| `tr-conveyor-line-swap` (transition) | The current line floats up and fades, the stage is empty for an instant, the next rises into the same spot. | **BUILD** | Short claims in sequence on 9:16; four or five at most. |
| `tr-dot-relay` (transition) | The hero collapses into one small dot, the only survivor of the seam, which opens into the next object. | **BUILD** | The one_dot_thread device (registry, planned). |
| `tr-drift-matched-angle-cut` (transition) | A hard cut to a new angle of the same subject while the slow zoom carries on at exactly the same rate. | **BUILD** | Two drone angles of the same place: the calm cut 2b wants. |
| `tr-iris-from-glyph` (transition) | A dot appears on a word and balloons exponentially to swallow the frame, showing the next scene inside it. | **BUILD** | The counter of the "0" in $10,000 irises open onto real Bend footage. Buyer-ad hook. |
| `tr-path-relay` (transition) | A line and its lead dot carry the eye from one place to the next, bending round corners, continuing across cuts. | **BUILD** | Route lines across the Bend map with one_dot_thread. |
| `tr-scale-through-cut` (transition) | An object shrinks faster toward a fixed point, cut, and a matching larger object on the same point keeps shrinking as it brakes. | **BUILD** | Footage-to-map and figure-to-map handoffs with log-scale velocity matched across the cut; at most twice per film. |
| `tr-shape-match-cut` (transition) | The hero shape leaves one shot at a known point and size; the next opens on a matching shape at the same point. | **BUILD** | Pin to dot, the zero's counter to a circle, a figure block to a footage window. |
| `tr-subtract-reveal` (transition) | Clutter in front flies off or shrinks away, uncovering a hero already sitting at final size behind it. | **BUILD** | Pins clear away to uncover the payment line already in place. |
| `cl-graphic-blurs-into-stage` (colour and light) | A finished graphic loses its edges, widens and drifts until it becomes the backdrop for the next title. | **ADAPT** | Pre-baked soft copies of the pin field become the stage under the payoff line; no animated CSS blur. |
| `cl-rising-wash-carrier` (colour and light) | A single-hue field rises behind the type, sweeps up across the frame on the change, recedes off the top. | **ADAPT** | Ban-safe variant: a crisp-edged navy band driven by a clip-path carries the swap; no feathered wash. |
| `cl-rolling-band-flood` (colour and light) | A light frame fills with soft horizontal bands of brand colour rolling upward, absorbing the text. | **ADAPT** | Bands in navy-alpha steps rolling into a navy claim card; not into the end card, which is cream. |
| `cl-theme-flip-in-motion` (colour and light) | In the middle of a camera move the dark stage flashes to its light version, top first, without pausing. | **ADAPT** | Cream-to-navy flip during a map move, carried by a hard-edged band rather than a flash. |
| `mi-shape-handoff-morph` (micro-interaction) | A labelled capsule empties its text and collapses into the next shape. | **ADAPT** | The $10,000 block collapsing into the navy dot that starts the map act. |
| `pd-before-after-drag-wipe` (product demo) | A cursor drags a divider across, wiping the old state to reveal the new in the same layout. | **ADAPT** | No cursor: the divider moves on time between two aligned real plates or two map layers. |
| `pd-shared-element-page` (product demo) | A clicked row's icon stays exactly in place while the next page assembles round it. | **ADAPT** | No cursor: the figure stays put while the world swaps (an anchored overlay by another name). |
| `tr-band-wipe` (transition) | A band snaps across a region, lingers, whips off; the content changes along its edge. | **ADAPT** | Solid navy band, no light core, swapping the map's layer (price cuts to credits); slower whip per 2b. |
| `tr-defocus-cut` (transition) | The outgoing shot throws itself out of focus, cut to a still-defocused shot that snaps sharp as its content settles. | **ADAPT** | Pre-baked blur copies (no animated CSS blur); at most twice; never on a caption beat. |
| `tr-envelope-match-type-cut` (transition) | A big line cuts to a smaller, longer line whose spread words span the old width, then the gaps close. | **ADAPT** | Hook figure to claim sentence; the sideways drift must continue across the cut. |
| `tr-horizon-rise` (transition) | A huge disc rises from the bottom edge like a planet horizon; its core swallows the frame and becomes the next stage. | **ADAPT** | Ban-safe variant: a hard-edged navy disc rising over cream; once per film. |
| `tr-motion-masked-swap` (transition) | Content changes on the frame something else moves fastest, so the change hides inside the motion. | **ADAPT** | Swap footage plates under a passing navy band or a camera move at its peak; calm speeds. |
| `tr-polarity-flip-cut` (transition) | A hard cut flips the stage between near-black and near-white on a downbeat, a shared shape held in inverted colours. | **ADAPT** | Cream-to-navy is native to our palette; once or twice per film on a VO stress or song hit; three becomes strobing. |
| `tr-stepped-column-fill` (transition) | Columns rise from the bottom in a stepped pyramid until they close into one solid field. | **ADAPT** | Navy columns into a navy field behind a held figure; reads as a chart; once; never behind small type. |
| `tr-velocity-handoff-cut` (transition) | The outgoing shot speeds up one way and is cut on its fastest frame; the next opens already moving the same way and brakes to rest. | **ADAPT** | Our default seam, at the calm end of the range (2b: slow eased camera, no snap zooms). cinetic's px/f figures are at 60 fps; double them per frame at our 30 fps or think in px/s. |
| `ui-container-morph` (UI choreography) | One element changes shape into its next role. | **ADAPT** | The hook figure's block morphs into the payment-equation container; no UI. |
| `cl-light-swell-bridge` (colour and light) | Light swells round a panel until the frame is bright; cut on the brightest frame; light exhales. | **SKIP** | Glow and flash. |
| `tr-cover-wipe` (transition) | A product surface passes in front of the old shot and the scene changes behind it. | **SKIP** | Needs product UI; a plain slab is a preset wipe. |
| `tr-giant-word-punch-out` (transition) | Hard cut to an extreme close-up of an oversized word sliding fast, then a second cut out to the whole word. | **SKIP** | Two hard cuts within a second and a fast slide; 2b. oh-cropped-word-pull-back does it calmly. |
| `tr-portal-aspect-zoom` (transition) | A window opens inside a tile; tile and window zoom through while the square stretches to 16:9. | **SKIP** | App-icon portal; product UI. |
| `tr-select-retype-swap` (transition) | A finished headline is selected like editor text, then retyped in place. | **SKIP** | Text-editor UI. |
| `tr-tip-back-exit` (transition) | The outgoing scene tips away from camera like a sheet laid onto a table. | **SKIP** | 3D UI tilt; perspective on footage shears and on type fakes italics. |

From the other three libraries and the prompt-motion.com spec-grade prompts:

| Technique | What it looks like on screen | Verdict | For Ryan Realty | Source |
|---|---|---|---|---|
| Two-tone ordered-dither reveal | A reveal front sweeps the area and cells light in Bayer order, a dithered dissolve rather than a fade. | **BUILD** | Ordered dither is two-tone by nature: footage or map revealed through navy/cream dither cells; ownable and heritage-print. | `Rieranthony/product-film-skill plugins/product-film/skills/product-film/templates/kit/dither.ts` |
| Magic move: one shared element travels between scenes | An element present in both scenes travels to its new place and size while the rest blur-swaps. | **BUILD** | The hook figure travels into the payment equation; text never flies across text. | `Rieranthony/product-film-skill plugins/product-film/skills/product-film/reference/ingredients.md (Transitions)` |
| Continuation cut (default boundary) | The outgoing hero accelerates about 12% of the frame one way, the cut lands mid-motion, the incoming continues the same way and decelerates. | **BUILD** | Mirrored power4 in/out halves; exit fade done by 25-30% of travel, entry ignites at 0.35 opacity; calm speeds. | `heygen-com/hyperframes-community-skills skills/vox-explainer/references/velocity-matched-transitions.md (3)` |
| Three-phase slide | A group slides slow-fast-slow: a barely moving ramp, a linear burst, a long decaying tail. | **BUILD** | Repositioning the line when the map rises; reveal new content during the burst. | `heygen-com/hyperframes-community-skills skills/vox-explainer/references/velocity-matched-transitions.md (7)` |
| Keyframe overlap: stage two starts at 61% of stage one | One element's two moves overlap about 39% on a symmetric 7x ease so the corner becomes an arc. | **BUILD** | Any two-stage move (figure lands, then lifts to make room). | `heygen-com/hyperframes-community-skills skills/vox-explainer/references/animation-overlap.md` |
| Vector law, the current and reserved vectors | Every seam keeps axis, direction and speed; one dominant direction; up means conclusion, Z forward deeper, Z back arrival. | **BUILD** | Principle for all seams; vertical films ride up. | `heygen-com/hyperframes-community-skills skills/vox-explainer/references/motion-continuity.md (Part 1)` |
| Tile corner radius to zero at full-bleed | A tile's radius goes to 0 as it reaches full-bleed, so pull-backs and match-cuts are exact. | **BUILD** | The footage window inside the hook figure growing to full screen. | `prompt-motion.com/antonio-kodheli-490109` |
| Every shot enters already moving | No shot starts from rest: entries ease out at 12-19% of the remaining distance per frame (60 fps). | **BUILD** | Principle for every beat, converted to 30 fps. | `prompt-motion.com/notdwd-7de38a` |
| Stepped or iris wipes in two inks | Wipes built from two flat inks only. | **BUILD** | Navy and cream are the two inks. | `buildfastwithai/buildfast-skills generative-film-skill/SKILL.md` |
| Zoom-through and inverse zoom-through | Text grows toward camera and hard-swaps at peak blur (push), or the incoming arrives oversized and retracts (arrival). | **ADAPT** | Headline-scale only; peak blur from pre-baked copies; the inverse version for the payoff arrival. | `heygen-com/hyperframes-community-skills skills/vox-explainer/references/velocity-matched-transitions.md (1, 2)` |
| Word-cascade cut | Outgoing words ramp out one by one and incoming words cascade in mid-flight, a wave across the seam. | **ADAPT** | Between two big-text beats; calm timings. | `heygen-com/hyperframes-community-skills skills/vox-explainer/references/velocity-matched-transitions.md (4)` |
| Cascade entry with shrinking gaps | Words whip in from below, each starting before the previous settles, gaps shrinking. | **ADAPT** | Calmer offsets; binary opacity; anchors travel further than light words. | `heygen-com/hyperframes-community-skills skills/vox-explainer/references/velocity-matched-transitions.md (6)` |
| Object flood contracts into the next scene | A shape floods the whole frame past all four corners in about 0.3 s, then contracts into the next scene. | **ADAPT** | Navy flood from the pin or dot, a little slower for 2b; must overscale past the corners or half the screen changes in one frame. | `prompt-motion.com/twoclipping-221cab and ultimaxbt-2ddf1e` |
| Six-blade iris aperture | Iris blades close over a label and snap open onto a photo. | **ADAPT** | A camera-aperture iris onto footage, once per film; navy blades. | `prompt-motion.com/twoclipping-221cab` |
| Ink band wipe as the default seam; ragged ink iris twice per film | A band of ink wipes left across the frame; an ink blot swallows the frame as a ragged iris. | **ADAPT** | Crisp navy band (no brush texture) in paper acts. | `heygen-com/hyperframes-community-skills skills/day-in-my-life/references/look.md` |

### 1.7 Texture and finish

Colour, light, grain, blur, banding and the QA that proves the finish. cinetic entries here: 31; from the other libraries and the gallery: 16. Verdicts: 13 BUILD, 19 ADAPT, 15 SKIP.

cinetic (`Leonxlnx/cinetic` `skills/cinetic/assets/library/techniques.json`, by entry id; the same entries are written out in `skills/cinetic/references/technique-library.md`). The bracket after each id is cinetic's own category.

| Entry id (source) | What it looks like on screen | Verdict | For Ryan Realty |
|---|---|---|---|
| `cl-accent-claim-grounds` (colour and light) | Narrative shots sit on the neutral stage; the single full-bleed accent ground is saved for the hero claim or the close. | **BUILD** | A full-bleed navy ground with cream type for the one claim ("Sellers are paying to close"). |
| `tx-feathered-edge-mask` (texture and finish) | Lists and overflowing lines dissolve into the stage at a soft edge instead of a hard crop. | **BUILD** | The vertical word stack and caption rail fade at their top edge (dithered mask). |
| `tx-global-grain` (texture and finish) | A fine even grain sits over the whole film at one strength. | **BUILD** | Seeded noise tiles at 1.5-2%, a new tile every other frame; unifies footage and paper. |
| `tx-speed-gated-motion-blur` (texture and finish) | Fast moves streak like a real shutter while holds and drifts stay pin-sharp. | **BUILD** | subframe_motion_blur (registry, planned) in render.ts: subframes per output frame averaged in float, count chosen from measured speed. |
| `cl-brightness-rides-move` (colour and light) | A mark takes its brightness from the same progress that drives its scale, reaching full as it lands. | **ADAPT** | A pin or the figure goes from navy alpha to full navy on the same progress as its scale. |
| `cl-context-palette-shift` (colour and light) | The world's colour changes behind a steady foreground to say "new context". | **ADAPT** | With two colours the shift is cream to navy behind a held figure, or footage to paper. |
| `cl-duotone-until-featured` (colour and light) | Photos sit in a two-tone grade until their beat; full colour opens out from the point of interaction. | **ADAPT** | Navy/cream duotone on our own or licensed footage only, never MLS photos; colour opens on the featured place. |
| `cl-hue-tinted-shadow` (colour and light) | Lifted elements cast soft shadows in a dark step of the stage hue, not grey. | **ADAPT** | Navy-alpha shadows on cream, only where something truly lifts (CLAUDE.md allows navy alpha for borders and hover). |
| `cl-inversion-card` (colour and light) | In an otherwise dark film one card cuts to near-white with dark type for one second. | **ADAPT** | Mirror for a cream film: one navy card for the key promise; hold 2.5 s, not 1 s. |
| `cl-mono-one-accent` (colour and light) | Everything black, white and grey; one saturated accent marks the single element that carries meaning in each shot. | **ADAPT** | Our graphics layer is two-tone; footage keeps its true colour (MLS never restyled); the "accent" job is done by full navy (or a navy/cream inversion) against navy-alpha context. |
| `cl-one-hue-light-ramp` (colour and light) | Every lit thing comes from adjacent lightness steps of one hue on one stage. | **ADAPT** | Steps of navy alpha over cream (rgba(16,39,66,x)); no new hex values. |
| `cl-specular-sweep` (colour and light) | A soft bright band glides once across a settled number, word or logo face. | **ADAPT** | A cream band across a navy figure (white is reserved for legibility on photos); never across the logo; once per film. |
| `tx-gobo-studio-shadows` (texture and finish) | Huge soft diagonal shadows like window light through leaves cross an off-white backdrop. | **ADAPT** | Pine-shadow gobo over cream from our own footage, as a dithered PNG; low priority. |
| `tx-halftone-shading` (texture and finish) | A flat shape gains volume from a single-colour halftone dot field swelling on its shadow side. | **ADAPT** | Navy halftone on cream for a Cascades silhouette or a large pin; print/heritage feel; shapes over 200 px. |
| `tx-low-luma-photo-plate` (texture and finish) | A real photograph sits behind the type, graded almost to black or defocused, adding context without stealing contrast. | **ADAPT** | Real Bend footage under a dithered navy scrim (cream type) or cream scrim (navy type): how type sits on footage instead of in boxes. Pre-blur offline. |
| `tx-mixed-media-grade` (texture and finish) | Photos, 3D, maps and diagrams share one value range so they cut together; only the hero carries the accent. | **ADAPT** | Grade our own footage toward a range that sits with the drawn map; MLS photos excluded. |
| `tx-ramp-masked-stipple` (texture and finish) | A dithered stipple lives only inside lit edges and falloffs; the flat stage stays clean. | **ADAPT** | Inside scrim ramps over footage, navy stipple; this or global grain, never both. |
| `tx-ring-field` (texture and finish) | Families of huge overlapping ellipse outlines rotate slowly above and below a band of type. | **ADAPT** | Navy hairline ellipses on cream as a guilloche field behind the $10,000 (creative-brain law 6, banknote principle); crisp strokes, no glow; never imitate a real banknote. |
| `tx-surface-edge-finish` (texture and finish) | Every floating surface gets a 1 px edge and one soft key shadow. | **ADAPT** | Only on the few surfaces we keep (topic CTA card, footer chip): navy-alpha hairline and shadow. |
| `cl-key-light-edge-hairline` (colour and light) | Cards on a dark stage carry a hairline bright on the side facing a key light. | **SKIP** | Dark UI cards. |
| `cl-living-stage` (colour and light) | Soft colour pools breathe and drift behind static cards. | **SKIP** | Gradient haze (cinetic D13); the cream stage stays flat and banding-free. |
| `cl-rim-light-sweep` (colour and light) | A bright streak travels along a dark card's border. | **SKIP** | Rim light on cards; cards on footage are what we are removing. |
| `cl-tilt-linked-sheen` (colour and light) | A highlight band slides across a tilting card in step with its angle. | **SKIP** | 3D tilt. |
| `tx-brushed-micro-streaks` (texture and finish) | Fine directional streaks make a hero object read as machined material. | **SKIP** | Hardware material; nothing of ours is machined. |
| `tx-fog-floor` (texture and finish) | The bottom fifth lightens toward the stage's brightest tone like a lit floor. | **SKIP** | A gradient floor in the zone where 9:16 captions sit. |
| `tx-glyph-grid-pulse` (texture and finish) | On the biggest hit a grid of tiny marks bends outward like a shockwave. | **SKIP** | Shockwave burst. |
| `tx-locked-mosaic` (texture and finish) | Withheld content shows pixelated and locked until an unlock snaps it clean. | **SKIP** | Gating; pixelated photos read as broken. |
| `tx-mosaic-resolve` (texture and finish) | An image arrives as coarse blocks halving every two frames until it snaps in. | **SKIP** | Digital look. |
| `tx-on-twos-cadence` (texture and finish) | One layer updates every second frame for a crisp mechanical look. | **SKIP** | Mechanical brand; at 30 fps it reads as dropped frames. |
| `tx-scanline-transmute` (texture and finish) | A bright bar sweeps down an object turning it into its digital form above the bar. | **SKIP** | Digital/encryption metaphor. |
| `tx-wireframe-scan-build` (texture and finish) | A line sweeps a card: ahead of it a wireframe, behind it the finished UI. | **SKIP** | UI idea-to-product. |

From the other three libraries and the prompt-motion.com spec-grade prompts:

| Technique | What it looks like on screen | Verdict | For Ryan Realty | Source |
|---|---|---|---|---|
| Subframes blended for motion blur | 3, 4 or 8 subframes per output frame blended (ffmpeg tmix) for a real shutter. | **BUILD** | subframe_motion_blur; the gallery found 4 subframes leave ghost copies on fast moves: use 8 and slow the move. | `prompt-motion.com/twoclipping-6dd14e, ultimaxbt-2ddf1e` |
| Single-frame pop scan | Scan the render for frame-difference spikes three times their neighbours. | **BUILD** | Add to video:check. | `prompt-motion.com/twoclipping-221cab` |
| Dead-time gate with two metrics | Mean abs diff and a changed-pixel count per frame pair at 640x360 or larger; no still run over 3 s. | **BUILD** | Add the changed-pixel count to our freeze check so small reveals are not called dead. | `heygen-com/hyperframes-community-skills skills/vox-explainer/references/vox-collage-motion.md` |
| Event-density gate | No 3.0 s window of any beat without a discrete authored event; camera creep does not count. | **BUILD** | Our 2.5 s holds fit; drift is not an event. | `heygen-com/hyperframes-community-skills skills/vox-explainer/references/vox-collage-motion.md` |
| Sixteen automated QC checks | Duration, resolution, black frames, freezes, scene-change glitches, text clipping and size, reading speed at most 4.5 words/s, SFX within 30 ms, mux offset at most 1 frame, loudness. | **BUILD** | Adopt the ones video:check lacks (reading speed, SFX onset, mux offset). | `buildfastwithai/buildfast-skills motion-studio-skill/reference/qc.md` |
| Measure, never guess: positions printed into the frame | A debug overlay prints every target's box into the still. | **BUILD** | QA aid for registering pins and labels. | `Rieranthony/product-film-skill plugins/product-film/skills/product-film/templates/kit/debug.tsx` |
| Decode frame 0 of every deliverable and check colours | Decode the final file and check the pixel values (limited range, BT.601 traps). | **BUILD** | We already hold navy and cream to exact values in the int test. | `Rieranthony/product-film-skill plugins/product-film/skills/product-film/SKILL.md (Traps)` |
| Keyframe tables continuous in frame number | kf(frame, [[f, v]...], ease) lookups, no Math.floor on motion, seeded hashes not Math.random. | **BUILD** | Our seek(t) contract. | `prompt-motion.com/notdwd-7de38a` |
| Real footage decoded frame-exact in the page | Footage re-encoded all-intra and loaded as a blob, or extracted to an image sequence, awaited per frame. | **BUILD** | Lets the page own footage and graphics under one camera (prerequisite for anchored overlays). | `prompt-motion.com/twoclipping-221cab, twoclipping-6dd14e` |
| Strict two-tone ink world | Everything drawn in two tones only, enforced by an ink floor; linework boils at 8 fps. | **ADAPT** | Two-tone is our rule already; the boil conflicts with clean motion, brand_film only. | `heygen-com/hyperframes-community-skills skills/day-in-my-life/references/look.md` |
| Grade every frame: vignette plus grain overlay | A vignette and a noise overlay at about 6% on every frame. | **ADAPT** | Grain at 1.5-2% (cinetic) not 6%; no vignette gradient unless dithered. | `buildfastwithai/buildfast-skills html-animation-skill/html-animation-skill.md (section 3)` |
| Gate weave and flicker on archival photos only | Sub-pixel weave and exposure flicker on archival stills, never on text. | **ADAPT** | Only on our own historic stills (civic pieces); never MLS. | `heygen-com/hyperframes-community-skills skills/vox-explainer/references/motion-continuity.md (Film-texture exemption)` |
| Seam ledger and verifier | A ledger of every seam (time, exit and entry vectors) checked numerically: exit still moving, entry mid-flight, zero overlap, Z sign. | **ADAPT** | Fold into video:check as a seam section of timeline.json. | `heygen-com/hyperframes-community-skills skills/vox-explainer/references/seam-gate.md` |
| Photo repainted as brushstrokes | A photo or clip repainted as a brush painting, painting itself on. | **SKIP** | MLS photos are never restyled; place footage stays real. | `heygen-com/hyperframes-community-skills skills/p5-paint-animation/SKILL.md (Flow B, C)` |
| Risograph mis-registration and print-proof HUD | Mis-registered inks, registration marks, plate labels. | **SKIP** | Needs a second ink; plate labels are filler text. | `buildfastwithai/buildfast-skills generative-film-skill/SKILL.md` |
| Liquid glass, goo and iridescent glow | Glass refraction over the scene, gooey blob merges, rotating rainbow glows. | **SKIP** | Glass and glow are off-brand; two colours only. | `prompt-motion.com/twoclipping-221cab, ultimaxbt-2ddf1e, rossaxbt-3085b7` |

### 1.8 Sound

Score, effects, voice and sync. cinetic entries here: 6; from the other libraries and the gallery: 15. Verdicts: 10 BUILD, 7 ADAPT, 4 SKIP.

cinetic (`Leonxlnx/cinetic` `skills/cinetic/assets/library/techniques.json`, by entry id; the same entries are written out in `skills/cinetic/references/technique-library.md`). The bracket after each id is cinetic's own category.

| Entry id (source) | What it looks like on screen | Verdict | For Ryan Realty |
|---|---|---|---|
| `ps-score-mapped-to-acts` (pacing) | The arrangement tells the structure: sparse intro, body, a breakdown for the calm act, resolution at the lockup. | **BUILD** | composed_score sections keyed to the beat roles in timeline.json. |
| `ps-silent-ui-steady-bed` (pacing) | In dense sequences the elements make no sound of their own; a steady bed carries the energy. | **BUILD** | Hundreds of pins get no per-pin sound; coverage all-or-nothing is met by silence for the class. |
| `ps-music-hole-slam` (pacing) | The low end or the whole bed vanishes under a key statement, then slams back on a picture event. | **ADAPT** | No slam: the bed thins (filter down, pulse drops out) under the payoff and returns at normal level on the next beat. |
| `ps-silence-first-sound` (pacing) | No running music: sound only on decisive events, one swell for the reveal, cut dead as the value lands. | **ADAPT** | Stings and teasers under 15 s; not with VO. |
| `ps-silent-sign-off` (pacing) | Tension rises, the music stops dead, the picture freezes and the lockup arrives under one low stinger. | **SKIP** | Fast-brand grammar; our end-card words land on hits and stingers are booms. |
| `tx-micro-tick-ui-sound` (texture and finish) | Tiny dry ticks on typing and UI changes. | **SKIP** | No UI; pins take the progress motif or silence instead. |

From the other three libraries and the prompt-motion.com spec-grade prompts:

| Technique | What it looks like on screen | Verdict | For Ryan Realty | Source |
|---|---|---|---|---|
| Sound follows the personality | Pick the score's palette and dynamics from the brand's adjectives (calm: felt keys, warm pad, one bell; precise: sparse tones, low strings). | **BUILD** | Ours: calm and measured rows; already in motion-design SKILL. | `Leonxlnx/cinetic skills/cinetic/references/sound.md 5.5a` |
| Progress motif | Each step of a progress story gets one tuned note a scale step higher; the tonic resolves on the payoff. | **BUILD** | The map's filters (all sales, price cut, credit, overlap) climb; the payoff resolves. | `Leonxlnx/cinetic skills/cinetic/references/sound.md 5.5b` |
| The lockup is the most resolved moment, not the loudest | The music subtracts as the logo forms: near-silence, one soft resolved element, a long tail. | **BUILD** | Adopted (prompt-motion.md); end-card words still land on hits per RULEBOOK 1. | `Leonxlnx/cinetic skills/cinetic/references/sound.md 5.3` |
| The hook enters with intent | A sound with a visible cause on frame 0; the first 0.5 s within 12 dB of the median. | **BUILD** | For scored films; silent IG exports rely on picture. | `Leonxlnx/cinetic skills/cinetic/references/sound.md 5.3` |
| Harmony rules: one chord per bar, voice leading, every pitched effect in key | Chords change on downbeats, pads voice-lead, the V chord clears before its resolution, effects tuned to the chord root. | **BUILD** | Check lib/studio/score/harmony.ts against these. | `Leonxlnx/cinetic skills/cinetic/references/sound.md 6` |
| Three-band sidechain under the voice | Music ducks under VO in three bands (lows 30%, mids 85%, air 55%; 0.3 s hold, 50 ms look-ahead, 0.5 s release), voice about 9 dB over music at 300 Hz-4 kHz. | **BUILD** | lib/studio/voice/mix.ts for every voiced cut. | `prompt-motion.com/rossaxbt-3085b7` |
| Audio is the clock | Every cut, pop and highlight keys to a word time from the transcript of the performed read. | **BUILD** | Voiced films. | `heygen-com/hyperframes-community-skills skills/vox-explainer/SKILL.md (VO)` |
| Fold the loop's audio tail onto its start | Render audio a bar past the loop and overlap-add the overhang onto the start so the seam does not click. | **BUILD** | Scored loops. | `Leonxlnx/cinetic skills/cinetic/references/formats.md 4` |
| Every note from a visible collision | A machine where each note is caused by something visibly striking something. | **ADAPT** | Registry collision_notes (planned): each closed sale lands as a dot and a note pitched by price. | `prompt-motion.com/kamstudiolabs-447565` |
| Sonic signature: tick/tock pair and a 3-4 note motif | A tuned pair and a short motif belong to the brand like its colour; open and close on the same sound. | **ADAPT** | A Ryan Realty bell motif on the end card across all films: a brand asset, so Matt's yes first. | `Leonxlnx/cinetic skills/cinetic/references/sound.md 6` |
| VO takes, splice and per-segment alignment | Several full takes, regenerate a bad line and splice it; shorten long pauses; level phrases; transcribe per segment and align to the measured onset. | **ADAPT** | Pause and level edits only with Matt's OK; engine rules from the brief (ElevenLabs v3 or Grok TTS). | `prompt-motion.com/rossaxbt-3085b7` |
| Song grid measured from the audio; SFX placed by measured peak | Tempo by autocorrelation, downbeat from stem loudness, a per-bar song map; each effect placed at cue minus its peak. | **ADAPT** | Only for audio we may analyse; IG songs are never downloaded (RULEBOOK 4), so their grid comes from public cue data. | `Rieranthony/product-film-skill plugins/product-film/skills/product-film/reference/music.md, scripts/beats.py` |
| Every visual event gets a sound | Wipes get risers, drops get booms, letters get bells. | **ADAPT** | Conflicts with cinetic J7 and our palette: coverage all-or-nothing per class, about five designed effects per 10 s. | `buildfastwithai/buildfast-skills generative-film-skill/SKILL.md (Music first)` |
| Drops on silence, sucks, risers, sub booms | The music stops dead, ducks, a riser builds, a sub boom lands. | **SKIP** | Our personality bans kicks, booms, risers and drops. | `Leonxlnx/cinetic skills/cinetic/references/sound.md 5.3` |
| Tihai and cartoon scoring | A three-times phrase landing on a cut; every action scored like a cartoon. | **SKIP** | Off tone. | `buildfastwithai/buildfast-skills generative-film-skill/SKILL.md; heygen-com/hyperframes-community-skills skills/session-story/references/score.md` |

### 1.9 Loop

The seam from the last frame back into frame 0. cinetic entries here: 3; from the other libraries and the gallery: 4. Verdicts: 5 BUILD, 2 ADAPT, 0 SKIP.

cinetic (`Leonxlnx/cinetic` `skills/cinetic/assets/library/techniques.json`, by entry id; the same entries are written out in `skills/cinetic/references/technique-library.md`). The bracket after each id is cinetic's own category.

| Entry id (source) | What it looks like on screen | Verdict | For Ryan Realty |
|---|---|---|---|
| `cam-seamless-loop-orbit` (camera) | The camera drifts on a closed figure-eight and returns exactly to its first frame. | **BUILD** | Paper and map loops, and the camera under the end-card-to-frame-0 seam. |
| `le-bookend-replay` (logo and end card) | The ending reuses the opening's stage and mechanic, now carrying the brand. | **BUILD** | The loop seam: the end card's last frame flows back into the hook's first (lib/studio/timeline/seam.ts). |
| `ps-loop-seam-on-motion-peak` (pacing) | A loop wraps on the fastest frame of a move so the last frame flows into the first. | **ADAPT** | Films that end on the locked card loop through seam.ts; use the motion-peak seam for story_teaser loops without the card (PROPOSED P5). |

From the other three libraries and the prompt-motion.com spec-grade prompts:

| Technique | What it looks like on screen | Verdict | For Ryan Realty | Source |
|---|---|---|---|---|
| Loop as a cycle: conveyor, relay, state round-trip | The loop returns to its start through an action, never fade-out and fade-in; phase(f), loopDrift and loopNoise are periodic in the loop length. | **BUILD** | Teaser loops and the frame-0 side of every seam. | `Leonxlnx/cinetic skills/cinetic/references/formats.md 4` |
| Reset under full occlusion | While something covers the whole frame, hidden elements return to their opening positions so the seam is invisible. | **BUILD** | Behind the cream end card, rebuild the opening composition. | `prompt-motion.com/gdgtify-287ddf` |
| Last frame equals frame 0, velocity included | Decode and compare the two frames; the moving elements' speed matches too. | **BUILD** | Add velocity to the seam check. | `prompt-motion.com/twoclipping-5cba86, rossaxbt-94583b; Rieranthony/product-film-skill plugins/product-film/skills/product-film/reference/review.md` |
| The device travels back through every scene to frame 0 | In the last seconds the dot retraces the film back to its first position. | **ADAPT** | story_teaser loops without the end card only. | `prompt-motion.com/ultimaxbt-bbebf5` |

### 1.10 End

The close. Our end card is locked (RULEBOOK 1, lib/studio/motion/endcard.ts on integ/one-factory), so most of cinetic's lockup builds are SKIP and what survives works on the topic CTA card or the hand-off into the locked card. cinetic entries here: 17; from the other libraries and the gallery: 3. Verdicts: 1 BUILD, 3 ADAPT, 16 SKIP.

cinetic (`Leonxlnx/cinetic` `skills/cinetic/assets/library/techniques.json`, by entry id; the same entries are written out in `skills/cinetic/references/technique-library.md`). The bracket after each id is cinetic's own category.

| Entry id (source) | What it looks like on screen | Verdict | For Ryan Realty |
|---|---|---|---|
| `le-living-hold` (logo and end card) | Once resolved, the lockup never freezes: slow push, tightening, a dimming stage. | **BUILD** | Already in endcard.ts (bob on beats after the logo settles); keep it. |
| `le-accordion-cta-collapse` (logo and end card) | The end line starts with wide gaps between words that close as it settles. | **ADAPT** | Topic CTA card only, before the locked end card. |
| `le-device-becomes-mark` (logo and end card) | The film's last object lands on the mark's exact position and size and the mark replaces it. | **ADAPT** | The logo is never morphed. Apply to the topic CTA card ("Bend's Best Deals, link in bio") and to the hand-off: the device dot lands where the logo will drop from, then the locked card plays unchanged. |
| `le-stage-clears-to-brand` (logo and end card) | The last product element leaves and the brand, already waiting behind it, reveals on the uncover frame. | **ADAPT** | The map clears to cream and the locked end card starts on that exact frame (the cream field is already there). |
| `le-card-to-pill-flank` (logo and end card) | The last card shrinks to a pill while tagline words close in on both sides. | **SKIP** | Locked card; no taglines (RULEBOOK 3). |
| `le-clone-stack-morph` (logo and end card) | A brand shape collapses into a URL pill with staircase echoes. | **SKIP** | Locked; no URL unless Matt asks. |
| `le-gooey-merge-to-mark` (logo and end card) | Soft lobes merge into a liquid blob that snaps into the mark. | **SKIP** | Locked; goo. |
| `le-hot-to-neutral-cool` (logo and end card) | The app icon pops in the hot accent and cools to its neutral colours. | **SKIP** | App icon; accent heat. |
| `le-macro-pullout-breathe` (logo and end card) | The mark arrives as huge fragments, collapses just under size, breathes up to rest. | **SKIP** | Locked card already defines the logo's spring; a macro of a PNG pixelates. |
| `le-mark-glint-turn` (logo and end card) | A 3D mark turns a few degrees through a key light. | **SKIP** | Locked logo; a sheen on a flat mark reads as a preset. |
| `le-mark-slide-name-follow` (logo and end card) | The centred mark glides aside to open its slot and the name resolves beside it. | **SKIP** | End card is locked (RULEBOOK 1, endcard.ts): real stacked logo, Quality/Local/Service, Call now 541.703.3095. |
| `le-mark-ticks-in-lockup` (logo and end card) | The story device that became part of the mark ticks once or twice on the beat inside the finished lockup. | **SKIP** | Locked card; propose to Matt only if the dot thread ever joins the end card. |
| `le-reverse-type-recentre` (logo and end card) | The name appears from its last letter to its first while the mark is pushed outward. | **SKIP** | Locked card; the logo is never retyped. |
| `le-seed-stroke-build` (logo and end card) | The mark grows from a seed while its strokes draw on. | **SKIP** | The logo is a PNG, never redrawn. |
| `le-slam-spin-pullout` (logo and end card) | Giant low-contrast arms sweep, the mark rushes back to size spinning and brightening. | **SKIP** | Locked; spin and slam. |
| `le-strobe-sting` (logo and end card) | A burst of hard-cut brand states flickers past in under a second. | **SKIP** | Strobe; 2b. |
| `le-words-part-url-types` (logo and end card) | The closing line splits, the URL types into the gap. | **SKIP** | No URL on the end card unless Matt asks; typing. |

From the other three libraries and the prompt-motion.com spec-grade prompts:

| Technique | What it looks like on screen | Verdict | For Ryan Realty | Source |
|---|---|---|---|---|
| Logo reveal: stroke draw, fill, shine | The logo draws its strokes, fills, then a shine sweeps it. | **SKIP** | Locked card; logo is a PNG. | `buildfastwithai/buildfast-skills motion-studio-skill/reference/engine-api.md (Logo)` |
| Tagline word by word, logos flying into slots | The closing line builds word by word as marks fly into place. | **SKIP** | Locked card. | `Rieranthony/product-film-skill plugins/product-film/skills/product-film/reference/ingredients.md (Ending)` |
| Pin becomes the brand mark, wordmark wipes from behind it | A map pin morphs into the logo. | **SKIP** | Locked card; logo never morphed. | `prompt-motion.com/ultimaxbt-2ddf1e` |

---

## 2. The ranked BUILD/ADAPT list

How it was ranked: first, what most changes how a 15 to 30 s vertical real-estate ad feels (type and footage becoming one picture, figures that move as objects, seams that carry motion, holds that live); second, everything the buyer ad needs (marked **[BUYER AD]**). The buyer ad as briefed: a full-screen "$10,000" typographic hook; price-cut and seller-credit sales popping on a Bend map; the payment math ($10K toward the rate is about $169 a month); the locked cream end card.

**The buyer ad's two figures.** Both are verified in the 2026-10-14 handoff (`docs/plans/CROSS_AGENT_HANDOFF.md`, Current block):
- $10,000 median seller credit, Bend single-family, Jul to Sep, `market_report_series` mr-v1.
- $169.07 a month for $10K toward the rate, at 7.40% (`market_history_weekly`, week 2026-10-12), on $695,850 with 20% down and 1 point per 0.25%.

Each must sit in `brief.numbers` with that trace, and the footer must carry the scope. The 2026-10-14 handoff also lists claims that failed verification; do not use them.

**Our stack, as every build note assumes.**
- TypeScript under `lib/studio/motion`. Node computes the frame state as a pure function of t (`cues.ts frameState`); the page only applies it (`page.ts`, `__rrApply`).
- Headless Chromium captures each frame (`render.ts`); ffmpeg encodes BT.709.
- No Remotion, no CSS transitions, timers, `Date` or `Math.random`.
- One closed-form spring per target change, summed when a value retargets.
- Sound reads the same curves (`sound.ts`, `lib/studio/score`).
- Data only through `lib/data/studio` DAL reads.
- QA renders to `out/motion-qa/`, then a contact sheet and a separate-agent critic (motion-design SKILL, "Adding a scene type").

Durations below are in seconds; cinetic's 60 fps frame counts are converted.

### Tier 0: foundations (build first; most ranked items depend on them)

**F1. `lib/studio/motion/spring.ts`, closed-form springs.** Size S.
- `step(tau, omega, zeta)`: the step response for under-, critical and over-damped cases.
- `track(t, keys, cfg)`: first value plus the sum over keys of (v_i minus v_i-1) times `step(t minus t_i)`, keys sorted by time. This is the product-film kit's method: a value that retargets stays a pure function of t.
- `critical(omega)`; a clamp option for anything that could collide; snap to rest when within 1% (cinetic).
- `crossing(cfg, 0.5)` and `crossing(cfg, 0.97)`, so `sound.ts` cues a pop on its 50% frame and a landing on contact (cinetic: "typed sync points landed 8-11 f off").
- Move the private `spring()` in `endcard.ts` onto it; its golden test must stay green.
- Showcase (6 s): a navy dot retargets four times on cream; under it, its own y(t) traced by the same function (the bbebf5 rule); stills at each retarget plus and minus 2 frames, and a byte-identical re-render.

**F2. `lib/studio/motion/camera.ts`, one world camera.** Size M.
- Keys `[t, worldX, worldY, zoom]`, blended with zoom in log space (`lmix`). This generalises `map.ts cameraAt`.
- Each segment rides the brand curves (`.22,.61,.36,1` for arrivals, `.65,0,.35,1` for a draw or a camera move: motion-design contract 6) or a heavy critical spring via `track`.
- `holdCreep`: cinetic's living hold, pivoting on the focal point and released by the next move's own ease.
- Footage and graphics both read it.
- Tests: even perceived zoom speed in log space; a refusal of zoom-in followed by zoom-out (ultimaxbt-2ddf1e rule); a per-frame speed report for the blur pass.

**F3. Footage inside the page.** Size M.
- Extract each plate once to an image sequence at film fps (ffmpeg, PNG or JPEG q95, BT.709, all-intra) and draw the frame for t under the world camera; await image decode before capture (twoclipping-221cab, twoclipping-6dd14e).
- Reuse `lib/video/pan.ts` crop maths so shape is never stretched.
- This lets pins, outlines and type lock to the footage at frame accuracy instead of an ffmpeg overlay composite (`render.ts overlayGraph`).
- MLS photos still get camera motion only.
- Showcase (6 s): a Bend aerial pushing 8% with a navy dot locked to a landmark; dot-to-feature error measured on six stills.

**F4. Subframe motion blur (registry `subframe_motion_blur`, planned).** Size M.
- In `render.ts`, render N subframes per output frame across a shutter (cinetic: 240 degrees centred on the frame) and average in float, not 8-bit.
- Pick N per frame from measured element speed. cinetic, at 60 fps: 1 sample under 2 px/f, 4 up to 18, 14 at 60, 18 at 80.
- Never blend across a declared cut. Decide discrete states (digits, swaps) on whole frames so the subsamples agree.
- Gallery finding: 4 subframes leave ghost copies on fast moves; use 8 and slow the move (ultimaxbt-2ddf1e).
- Ceiling: nothing above about 60 to 80 px/f at 60 fps (120 to 160 px/f at our 30); redesign instead.
- Showcase (6 s): one navy dot sweep at three speeds, sharp beside blurred; the fastest frames at 100% crop.

**F5. Grain tiles and dithered ramps.** Size S.
- An offline, seeded generator (reuse `lib/studio/score/rng.ts`) writes 8 grain tiles (sigma about 1.5 to 2 code levels, centred on the stage's own luma), dithered navy-alpha scrim PNGs for type over footage, and dithered feather masks.
- cinetic: a CSS gradient spanning fewer than about 30 code values bands.
- Showcase (5 s): a cream field and a navy scrim over footage, with a 12x contrast-stretched still proving no banding.

**F6. Envelopes and schedulers.** Size S.
- `hitPulse(t, attack, tau)`: quarter-sine attack, exponential decay, peaking about 2 frames at 60 (1 at 30) after its cue.
- Contact squash.
- The keyframe-overlap scheduler: stage two starts at 61% of stage one on `cubic-bezier(.857,0,.143,1)` (vox `animation-overlap.md`).
- The three-phase slide: a ramp covering 10% of the distance in 20% of the time, a linear burst of 65% in 18%, a tail of 25% in 62%.

**F7. QA additions in `lib/studio/qa`.** Size M.
- A single-frame pop scan: d above 1.0 and above 2.5x the local median plus 0.3 (cinetic forensics; the gallery's "3x neighbours").
- Dead time on two metrics, mean diff and changed-pixel count at 640x360 or larger (vox).
- Event density: no 3.0 s window without an authored event; drift is not an event.
- Seam checks: exit still moving, entry mid-flight, zero overlap, same scale-velocity sign on Z seams (vox seam gate); loop velocity.
- Fastest-frame stills; reading speed at most 4.5 words/s (buildfast QC).
- A pins-equal-figures assert, and the rubric reviewer harness (section 3).

### The ranked list

**1. Type that lives on the footage, not in boxes** [BUYER AD]
- Techniques: `ty-masked-baseline-rise`, `cl-ink-resolve`, `tx-low-luma-photo-plate` (ADAPT), `lc-negative-space-caption` (ADAPT), `lc-vertical-band-stack`, `lc-one-centred-subject`, vox credit slot.
- Why first: the "boxes on drone footage" look is opaque cards fading in over a clip they have nothing to do with. Words that rise out of their own baseline on the footage, over a scrim that is part of the grade, inside a band the camera move leaves empty, make the type and the place one picture.
- Build: a `plate-line` cue.
  - Each word sits in an overflow-hidden line box (0.15 em bottom padding for descenders). The inner span moves translateY 110% to 0 on the brand ease over about 0.35 to 0.45 s (cinetic's 12 f is 0.2 s; calmer for 2b), staggered about 0.2 s, with opacity over the first 0.1 s.
  - Colour goes from navy alpha to full navy (or cream alpha to cream) over about 0.4 s.
  - Behind the line, a dithered scrim band from F5, tuned until the line reads, ramping to zero with no edges, so it is never a box.
  - The camera move (F2) is authored so the band falls on sky or ground.
  - Exit back into the mask on an accelerating ease. Safe zone x up to 960, y up to 1640.
- Showcase (7 s): our own Bend aerial, slow push. At 1.0 s "Bend" (Amboqia) rises out of its baseline in the sky band, ink-resolves and holds with drift; at 4.5 s it exits into its mask while the camera keeps moving. Stills at 0.5, 1.0, 1.4, 3.0 and 5.0 s, plus a 12x stretch of the scrim.
- Size M. Needs F2, F3, F5.

**2. The $10,000 hook: pull out of the zero, columns lock** [BUYER AD]
- Techniques: `cam-inside-object-pullout`, `oh-cropped-word-pull-back`, `dn-metric-cold-open`, `dn-digit-reel-detent` (ADAPT), `oh-macro-scramble-snap-out` (ADAPT, no scramble). Optional: `ty-scaled-echo-extrusion`, items 19 or 20 behind it.
- Why: a full-screen figure already moving on frame 0 and readable inside a second is cinetic's strongest scroll-stop. Doing it with a camera pull and a mechanical lock, not a fade or a count, is what reads as motion design.
- Build: a `figure-hook` cue on top of `dollar_first_hook` (`timeline/hooks.ts` already guarantees the figure is on screen by 1.0 s).
  - Lay out "$10,000" once in Geist tabular figures at about 0.9 of the safe width.
  - Frame 0: the camera sits inside the counter of the "0" at k0 = 1.04 x max(W / objW, H / objH), so the counter's curve just shows at the frame edges. It reads as a composed navy-and-cream field, not a blank one.
  - Pull to 1x over 25.7 x ln(k0) frames at 60 fps (about 0.9 to 1.1 s for k0 8 to 14) on a slow-start, slow-end curve; the log zoom rate peaks near 6% per 60 fps frame.
  - During the pull each digit column is a masked strip holding only blank and its true glyph. Columns lock left to right about 0.1 s apart, each on a near-critical spring (F1; clamp, or overshoot of 2% or less counted as one of the film's two landings).
  - The figure lands by about 1.2 s and holds at least 2.5 s with creep (item 8).
  - Assert that the drawn-text set is only "$10,000" (`figureLeaks` reads what the page drew).
- Showcase (6 s): stills every 0.2 s to 1.6 s, then the hold. Pass: frame 0 composed, no intermediate digits, figure readable by 1.2 s, held 2.5 s or more.
- Size M. Needs F1, F2, F4.

**3. The zero opens onto Bend** [BUYER AD]
- Techniques: `tr-iris-from-glyph`, tile corner radius to 0 at full-bleed (antonio-kodheli-490109).
- Why: real footage enters the hook without a cut. The mandatory rules require real footage in every piece, and the iris starts from content: the money opens onto the place.
- Build:
  - The incoming footage scene (F3) is clipped by a circle seeded at the counter of the "0"; the seed shows for about 0.2 s.
  - The radius runs `lmix(r0, R, p)` at a constant ratio to R, the distance to the farthest corner. cinetic runs it at about x1.25 to 1.29 per 60 fps frame (0.33 s); we stretch to about 0.6 to 0.8 s at a constant ratio.
  - The centre drifts to frame centre on the smooth curve; the footage is already moving when it is revealed; land on a beat or VO stress.
- Showcase (5 s): "$10,000" holds 2.5 s, the iris opens over about 0.7 s, then 1.5 s of footage carrying item 1's line. Stills at the seed, 25, 50 and 75% radius, and full.
- Size S. Needs F2, F3.

**4. Sales land on the Bend map, then the overlap** [BUYER AD]
- Techniques: `pd-pin-field-pullback` (ADAPT), `pd-live-filter-narrows` (ADAPT), `cam-fit-bounds-follow`, `ui-anchor-point-spawn`, `cl-accent-on-newest` (ADAPT), `ps-faster-each-repeat` (ADAPT), `ps-silent-ui-steady-bed`, the progress motif; registry `map_pins_pop`.
- Why: Matt (2026-10-13) asked for price drops and concessions on the map, then the overlap. A pin per real sale is proof the viewer sees for themselves; narrowing to the overlap is vox's "mechanism beat" instead of a stat card.
- Build: `lib/studio/motion/pins.ts`, as named in the registry.
  - Project lat/lng with the same Web Mercator maths as `map.ts`.
  - Pins come from a `lib/data/studio` DAL read of the publishable sale rows behind the verified counts, each with flags {priceCut, credit}. Never a raw `.from()`.
  - Category is shown by shape, because we have two colours: price cut is a navy ring, credit a filled navy dot, both a ring with a dot.
  - Each pin scales 0 to 1 and rises 12 px from its base on a critically damped spring. cinetic uses SPR.micro: a field of pins is not a landing, so no overshoot.
  - A group lands within 0.5 to 1 s, ordered by close date (truthful) or by a ripple from the centre (1 frame per 60 px, cinetic). The newest pins arrive full navy and relax to their category look over about 0.4 s.
  - The camera opens close on the first pin and widens to fit the set.
  - The overlap: as each filter word lands ("price cut", then "seller credit"), non-matching pins fold to their base over about 0.4 s and survivors stay. The swap cuts on the beat (`pd-hard-swap-on-cause`).
  - The city outline draws first (`outline_draw_zoom`).
  - Assert that pins drawn per category equal the verified counts in `brief.numbers`: the picture is the proof.
  - Privacy: city zoom only, no legible street, no tag carrying an address.
  - Sound: no per-pin sound (hundreds of events); one progress-motif note per filter stage, resolving on the overlap.
- Showcase (8 s): outline 0 to 1.5 s; rings ripple in 1.5 to 3.5 s; dots land 3.5 to 5.5 s; the filter narrows to the overlap 5.5 to 7 s; hold. A still each second, the assert passing, and a 100% crop showing no legible street.
- Size L. Needs F1, F2, a DAL read, `map.ts`. Open question for Matt in Appendix C.

**5. Real footage becomes the map** [BUYER AD]
- Techniques: vox zoom-isolation swap (ADAPT), `cl-drain-stage-keep-hero`, `tr-anchor-overlay-cut`, `d3-pinned-label-world-swap` (ADAPT), `tr-scale-through-cut`.
- Why: maps sit on real footage, never instead of it. The strongest version is one move: push into the aerial, everything but Bend drains to cream, and the outline that was registered on the footage is now the drawn map.
- Build:
  - Registration: on a chosen slow-push plate, mark four or more ground control points with known coordinates (Pilot Butte summit, the Old Mill stacks, a bridge). Fit a pixel-to-Mercator homography at keyframes about 0.5 s apart, interpolate, and verify on stills.
  - Project the city polygon through the homography and draw it on the footage.
  - Drain the footage outside the polygon to cream over about 0.8 to 1.2 s while the camera keeps moving, then inside it. The outline holds its screen position (cinetic: 0 px ideally, 30 px at most).
  - Continue in map space with matched log-scale velocity.
  - Seam check (vox): carrier centres within 30 px, sizes within 10%.
- Showcase (7 s): push 0 to 2.5 s; registered outline draws 2.5 to 3.5 s; drain 3.5 to 4.7 s; the map zooms to the first pin 4.7 to 7 s. Stills print the registration error (product-film's debug overlay).
- Size L. Needs F2, F3, F7.

**6. The $10,000 becomes the payment math** [BUYER AD]
- Techniques: product-film magic move, `ui-container-morph` (ADAPT), `mi-shape-handoff-morph` (ADAPT), `ty-phrase-clamp-junction`, `dn-tucked-unit-label`, vox keyframe overlap, `tr-subtract-reveal`.
- Why: one object carries the argument. The same $10,000 the viewer met in the hook travels into the equation, so the payment line reads as a consequence rather than another stat, and the piece stays at two numbers (RULEBOOK 2a.4).
- Build:
  - The figure is one instance across beats (product-film's `placement(t)`). It travels from the hook slot to the left half of the line, scale only (keep one line-height ratio so the move only scales), on a heavy critical spring (product-film: stiffness about 150, damping about 20) or `track` keys.
  - The right half ("about $169 a month") clamps against a fixed junction on one baseline with exactly one word space between the halves (`ty-phrase-clamp-junction`, calmed to about 0.4 to 0.6 s). "A month" sits tucked under the figure: Amboqia unit, Geist value.
  - Exact wording is Matt's.
  - The footer carries the rate, down payment and points basis in one line (RULEBOOK 3).
  - No intermediate values are ever drawn. $169.07 shown as $169 does not change the narrative (CLAUDE.md 0 rounding rule); the trace keeps $169.07.
- Showcase (7 s): "$10,000" holds; at 1.0 s it travels left; at 1.8 s the right half clamps; hold to 7 s. Stills at each landing; the drawn-figure set is exactly {$10,000, $169}; footer present.
- Size M. Needs F1, F2.

**7. Calm, velocity-matched seams**
- Techniques: `tr-velocity-handoff-cut` (ADAPT), vox continuation cut, keyframe overlap, three-phase slide, the vector law and "the current", `ps-direction-per-act`, every shot enters already moving (notdwd-7de38a).
- Why: cinetic, vox and the gallery agree this is what separates motion design from a slideshow. Something always crosses the seam: a velocity, a shape, a dot. Today our beats start and end at rest.
- Build: a seam plan in `timeline.json`.
  - Each beat boundary declares its exit and entry vector (axis, sign, speed), as vox's ledger does.
  - The outgoing element's last 0.3 to 0.4 s accelerates (cinetic: speed grows x1.1 to 1.2 per 60 fps frame) and the cut lands on its fastest frame.
  - The incoming element starts in the same direction at that speed and decelerates over 0.75 to 1.5 s (x0.92 to 0.94 per 60 fps frame).
  - Calm caps: partial travel of about 12% of the frame (vox), speeds at the low end.
  - The current for vertical films is upward; reserved vectors keep their meanings (up is a conclusion, Z back an arrival).
  - QA through F7.
- Showcase (6 s): figure, footage line and map joined by two upward continuation seams; a frame strip across each seam with per-frame displacement printed.
- Size M. Needs F2, F6, F7.

**8. Living holds**
- Techniques: `cam-living-hold`, `le-living-hold`, `ps-breath-envelope`, vox "every phase owned by a route".
- Why: our 2.5 s holds are the right length but nearly still.
  - Measured: `holdDrift` moves a card 8 px across its whole hold, about 3 px/s on a 2.5 s hold.
  - cinetic's living hold is 0.3 to 0.5 px/f at 60 fps for cards (18 to 30 px/s), 1.5 to 3 px/f for big display type (90 to 180 px/s), or a scale creep of 0.04 to 0.07% per frame (about 2.4 to 4.2% per second).
  - cinetic's forensics would flag our holds as quiet.
- Build: `holdCreep` in F2: a scale creep on the focal point (push on proof, pull on a busy board) or a lateral drift entering with an exponential ease so velocity is continuous at the seam, released by the next move. The rate is Matt's call on a side-by-side (Appendix C).
- Showcase (6 s): one 2.5 s figure hold three ways side by side: today's 8 px, cinetic's card rate, cinetic's scale creep.
- Size S. Needs F2.

**9. One navy claim ground for the payoff** [BUYER AD]
- Techniques: `cl-accent-claim-grounds`, `tr-polarity-flip-cut` (ADAPT), `ps-luma-act-map`, `cl-inversion-card` (ADAPT), object flood (twoclipping-221cab, ultimaxbt-2ddf1e), `cl-rising-wash-carrier` (ban-safe).
- Why: with two colours, polarity is our accent. Saving the one full-bleed navy ground for "Sellers are paying to close" makes it the loudest picture in the film without a third colour.
- Build:
  - A flood grows from an on-screen object (the last pin or the dot) and overscales past all four corners in about 0.5 to 0.7 s; the gallery's 0.3 to 0.35 s is too quick for 2b. If it falls short of the farthest corner, half the frame changes in one frame.
  - Or a hard polarity cut on the VO stress.
  - Cream type rises on navy and holds 2.5 s or more; the scene exits by contracting into the next object.
  - At most two polarity flips per film.
- Showcase (5 s): pins, a flood from the last pin, the navy ground, the line rises, hold.
- Size S. Needs F1, F2.

**10. One navy dot threads the film**
- Techniques: `ps-continuity-thread`, `tr-dot-relay`, `tr-path-relay`, `cam-lead-follow`, `mi-velocity-stretch-dot`, `mi-shape-handoff-morph`, `le-device-becomes-mark` (ADAPT), product-film `placement(t)`; registry `one_dot_thread`.
- Why: cinetic's second law. One story device that never blinks out at a cut keeps the film continuous and readable muted: the dot is the pin, the line's riding head and the point the camera follows.
- Build: `thread.ts`.
  - One dot with `placement(t)` over named spots and arcing leaps, full opacity through every seam.
  - It stretches along its velocity once per film (rest length plus about 4 to 5 frames of travel at 60 fps).
  - Routes use the path relay: a dash-offset reveal with the dot placed by pure arc-length maths at 8 to 16 px per 60 fps frame.
  - Camera follow uses a lag coefficient of 0.08 per 60 fps frame, computed as a pure sum from the shot's first frame (no stored state).
  - It ends where the topic CTA or the logo drop begins.
- Showcase (7 s): from the "0" counter to a map route, landing as a pin, leaving for the CTA position.
- Size M. Needs F1, F2.

**11. VO-paced words: stack, ladder, chunks, rail** [BUYER AD]
- Techniques: `ty-vertical-word-stack`, `cl-read-state-tone-ladder`, `ps-beat-quantized-chunks`, `ty-inplace-light-up-beats`, `tx-feathered-edge-mask`, vox caption-rail suppression, captions leading the voice by about 0.2 s (camera-3d-captions), product-film punchlines with kept slots.
- Why: the mandatory rules require burned-in captions synced to a female VO. Captions set as type (a stack rising, the current word full navy, past words stepped down, a feathered top edge) look designed; subtitles look like a template. Suppression stops the same words appearing twice.
- Build: in `lib/studio/voice/captions.ts` (integ):
  - Word times from `words.ts`, chunked by phrase.
  - Stack pitch 1.05x the font size; each word rises on the brand ease; the stack steps on a firm critical spring (cinetic SPR.firm: about 97% in 0.45 s).
  - The tone ladder in navy alpha; a dithered top feather.
  - Caption cues suppressed while a promoted line shows the same words.
  - Captions lead the voice by about 0.2 s, snapped to frames.
- Showcase (8 s): a four-phrase VO building the stack, with one promoted line suppressing its cue.
- Size M. Needs F5.

**12. Grain and one grade**
- Techniques: `tx-global-grain`, `tx-mixed-media-grade` (ADAPT); gate weave on archival stills only.
- Why: the cheapest way to make code-drawn paper and real footage one film (creative-brain stage 9: a unified grade plus grain).
- Build:
  - One top layer of F5 tiles at 1.5 to 2%, a new tile every frame at 30 fps, one strength for the whole film.
  - Grade only our own plates; never MLS photos.
  - QA: grain sigma on a flat crop, no compression smear after encode.
- Showcase (5 s): half paper, half footage, with and without grain; a 12x stretch still.
- Size S. Needs F5.

**13. From the payoff into the locked card** [BUYER AD]
- Techniques: `le-stage-clears-to-brand` (ADAPT), `le-device-becomes-mark` (ADAPT), `le-accordion-cta-collapse` (ADAPT), `ty-staggered-word-roll`, `tr-subtract-reveal`; the existing `send_invite_hook` and `endcard.ts`.
- Why: the locked card is right. What is missing is a hand-off that comes out of the story instead of a cut to a new card.
- Build:
  - "Bend's Best Deals, link in bio" (Matt's line) rolls in from the payoff line, or closes its word gaps.
  - The stage clears to cream and `endcard.ts` starts on that exact frame; its cream field is already the stage.
  - The thread dot ends at the logo's drop point just before the logo springs in.
  - `endcard.ts` timing is untouched: the card is the final 2.5 s, and `video_render_gate.py` must pass.
- Showcase (6 s): the payoff, the CTA card, the locked card, with the render gate run on the cut.
- Size S. Needs `endcard.ts` (integ) and item 10.

**14. The loop seam: reset under occlusion** [BUYER AD]
- Techniques: reset under full occlusion (gdgtify-287ddf), `le-bookend-replay`, `cam-seamless-loop-orbit`, last frame equals frame 0 with velocity (twoclipping-5cba86), the cinetic audio fold.
- Why: loopable is mandatory, and a seam that jumps reads as a restart.
- Build:
  - `timeline/seam.ts` already lays frame 0 under the card.
  - While the cream card fully covers the frame, rebuild the opening composition at its frame-0 state.
  - Check motion as well as pixels across the seam.
  - For scored cuts, render the score a bar past the end and overlap-add the tail onto the start.
  - The render gate's thresholds still apply: first-to-last mean diff at most 0.20, SSIM at least 0.35.
- Showcase (6 s): the last 3 s and the first 3 s looped twice; a seam strip.
- Size S.

**15. Calm cuts on footage: the drift-matched angle cut**
- Technique: `tr-drift-matched-angle-cut`, with `cam-living-hold`.
- Why: footage is our spine. Two angles of the same place, cut while the slow zoom continues at exactly the same rate, is the calmest cut that still feels designed (2b).
- Build: two plates of one place with the same creep rate (F2); cut on a beat; the angles at least 30 degrees apart; subject size and position matched.
- Showcase (6 s): two drone angles of the Old Mill, one cut at 3 s.
- Size S. Needs F2, F3.

**16. Scale-through and shape-match cuts**
- Techniques: `tr-scale-through-cut`, `tr-shape-match-cut`, `tr-dot-relay`, tile radius to 0 (antonio-kodheli-490109).
- Build:
  - Fix an anchor screen point. The outgoing object shrinks to about 0.75 over 0.3 to 0.4 s, accelerating.
  - The incoming object opens at 1.7 to 2x and settles over 0.5 to 0.7 s.
  - Log-scale velocity matches across the cut (cinetic: minus 7 to 9% per 60 fps frame on both sides); objects are centred within 30 px.
  - Twice per film at most.
- Showcase (5 s): a pin cuts to the same point as a footage window that keeps shrinking.
- Size M. Needs F2.

**17. Two-tone ordered-dither reveal**
- Techniques: product-film `dither.ts` (Bayer front), generative-film's two-ink wipes, day-in-my-life's ink band.
- Why: dither is two-tone by construction, reads as print, and no template ships it: an ownable transition for a heritage brand.
- Build:
  - Our own pure function: a 4x4 or 8x8 Bayer matrix; cells light under a sweeping front with a soft band (front = progress x (1 + band)).
  - Painted at cell resolution with integer cells, used as the mask between footage and cream or between two acts, sweeping upward.
  - Cells of 8 px or more at 1080 wide so the encode keeps them (cinetic's smear check).
- Showcase (5 s): footage dithers out to cream over about 1 s, then the map draws.
- Size M. Needs F3.

**18. Sound and sync off the same timeline**
- Techniques: `measured_drop_sync` (planned), `ps-score-mapped-to-acts`, the progress motif, `ps-music-hole-slam` (ADAPT), the lockup as the most resolved moment, a hook that enters with intent, the 3-band sidechain, effects placed by measured peak.
- Why: sound that lands on the picture's own events is half of "it feels designed". The score exists; sections, the progress motif and VO ducking make it follow the story.
- Build:
  - `sound.ts` maps beat roles to score sections: intro, body, a thin-out under the payoff, a resolve on the card.
  - The progress motif sounds the map's filter stages.
  - The VO bus ducks in three bands (lows 30%, mids 85%, air 55%; 0.3 s hold, 50 ms look-ahead, 0.5 s release), keeping the voice about 9 dB over the music from 300 Hz to 4 kHz (rossaxbt-3085b7).
  - IG-song cuts take their hits from the song's public cue JSON (RULEBOOK 4: never download).
  - Master: minus 14 LUFS, true peak at or under minus 1 dBTP after AAC (exists).
  - QA: onsets within 1 frame of their cues.
- Showcase (8 s): the map act with three filter stages climbing, the payoff thin-out, the resolve.
- Size M.

**19. Bend as a dot field behind the claim**
- Technique: `tx-dot-matrix-silhouette` (ADAPT).
- Build:
  - Dots on a grid inside the stored city polygon, read through the DAL. cinetic uses a 20 px pitch at 1080p; scale it up for 9:16.
  - Navy alpha about 4% off cream.
  - A scale creep of 1.00 to 1.02 across the shot; arrives and leaves on cuts, never fades.
- Showcase (5 s): behind the $10,000 hold.
- Size S.

**20. A guilloche field behind the hero figure**
- Technique: `tx-ring-field` (ADAPT), with creative-brain's banknote principle (law 6).
- Why: visible craft organised under one gestalt, and on subject (money).
- Build:
  - Parametric rosette and ellipse families (epitrochoids) drawn as crisp 1.5 to 2 px navy strokes at 15 to 60% alpha, counter-rotating slowly.
  - Generated per frame from t; no glow; never a copy of any real banknote design.
- Showcase (6 s): behind "$10,000" through its hold.
- Size M.

**21. Hand-drawn marks measured onto footage**
- Techniques: vox anchors and arrows, the measured hand-drawn ellipse, `mi-focus-ring-pop-or-trim` (ADAPT).
- Build:
  - A navy stroke ellipse or arrow drawn on in about 0.4 s.
  - The target comes from item 5's registration or a tracked point; verify on a crop that the mark sits on the feature.
  - An anchor of three words or fewer in Geist caps; once per film.
- Showcase (5 s): Pilot Butte circled on a slow aerial.
- Size M. Needs F3 and item 5.

**22. The unit-grid tally (market_update)**
- Technique: `dn-unit-grid-tally` (ADAPT).
- Build:
  - One cell per sale in the window, 30 px or larger in 9:16; the matching share fills navy over a navy-alpha track in a diagonal wave over about 0.5 s, each cell on a critically damped scale.
  - The counter shows only the final verified figure, never a count.
  - One accent cell pulses on `hitPulse`.
- Showcase (6 s): one quarter's price-cut share.
- Size M.

**23. Bars and before/after, done honestly**
- Techniques: `dn-hero-bar-pullback` (ADAPT), `dn-delta-chip-compare` (ADAPT), vox two-panel compare (stacked for 9:16).
- Build: a sibling of `chart.ts`. The hero bar grows in close-up, then the camera pulls back (F2); comparison bars in navy alpha; ruler gridlines as in the trend film. Three numbers need Matt's per-piece override.
- Size M.

**24. Readout scrub on the trend line**
- Technique: `pd-chart-scrub-readout` (ADAPT), on the existing `line_draw_riding_dot`.
- Build: after the draw, the dot rides back across the months with a hairline and a readout of each month's published value (each a Market Truth cell in the subject), landing on the latest. The readout steps on whole frames, and each label points at exactly one value (motion-design SKILL).
- Showcase (6 s): on `market_trend`.
- Size S.

**25. The map unfolds like a paper road map**
- Techniques: the twoclipping-221cab grid unfold (ADAPT), session-story's fold physics.
- Build:
  - The map is a sheet with creases. Folds apply latest-first about their crease lines as rigid panels (2D affine with a foreshortening factor, no 3D renderer), stages overlapping about 39% on the 7x curve.
  - Creases draw only once folded; navy alpha shades the tilted panels.
- Showcase (6 s): a folded square opens centre, plus, corners into the Bend map.
- Size L.

**26. Halftone heritage shading**
- Technique: `tx-halftone-shading` (ADAPT).
- Build: a navy dot field whose radii follow a light direction across a silhouette traced from our own reference still (creative-brain law 1), with the light drifting slowly; shapes 200 px or larger.
- Size M.

**27. Duotone until featured**
- Technique: `cl-duotone-until-featured` (ADAPT).
- Build: our own footage maps luma onto navy and cream until its beat, then colour opens from a point on the featured place. Never MLS photos.
- Size M. Needs F3.

**28. Big-to-small type hand-offs**
- Techniques: `tr-envelope-match-type-cut`, `ty-blur-swap-rescale`, `ty-reading-order-exit`, `ty-centre-out-unmask`, `lc-gap-open-insert`.
- Build: type helpers on F1 and F2, with blur from pre-rendered copies and overlaps under 0.17 s.
- Size S.

**29. One sweep across the landed figure**
- Techniques: `cl-specular-sweep` (ADAPT), `cl-tone-band-fill` (ADAPT).
- Build: a navy-alpha band (on cream) or a cream band (on navy) clipped to the glyphs, about 0.6 s, once per film, starting about 0.15 s after the landing.
- Size S.

**30. Real place names in a slot**
- Techniques: `ty-slot-roller-fixed-phrase` (ADAPT), `ui-lens-list-scroll` (ADAPT).
- Build: a fixed Amboqia phrase with a feathered slot column; three calm steps, each a real place.
- Size M.

**After the 30: the planned registry scenes**
- `bucket_drain` (M): feeds from the parkerrex-1a54fe gallery entry, `dn-area-ratio-compare`, item 22's cells.
- `words_become_structure` (L): gdgtify-287ddf, `ty-phrase-clamp-junction`, keyframe overlap.
- `collision_notes` (M): kamstudiolabs-447565 plus item 18.
- `milestone_timeline` (M): kloss-xyz-fe0c31, buildfast's timeline style, `cam-lead-follow`.
- `paper_cutout_layers` (L): `cam-parallax-truck` (ADAPT) on our own references only.

### How the ranked items compose the buyer ad

| Beat (Matt's calls, handoff 2026-10-14) | Items |
|---|---|
| Hook: the $10,000 typical seller credit | 2, 3, then 19 or 20 behind it; 11 for the captions |
| Real footage with the line | 1, 15, 7 |
| The map of this summer's price-cut and credit sales, then the overlap | 5, 4, 10, 18 |
| Payoff: "Sellers are paying to close" | 9 |
| Payment math | 6 |
| "Bend's Best Deals, link in bio", then the locked end card | 13 |
| Back to frame 0 | 14 |
| Under everything | F1 to F7, 8, 12 |

With every beat holding 2.5 s or more, this runs about 25 to 28 s, inside 15 to 30. The handoff puts the map last in the body, before the CTA and the end card; where the payment beat sits is Matt's call (Appendix C).

---

## 3. cinetic's 11-dimension rubric and critic lenses, for our reviewer

Source: `Leonxlnx/cinetic` `skills/cinetic/references/review-loop.md` sections 1 to 12, the five templates in `skills/cinetic/assets/critics/`, and `references/taste-and-slop.md`. Paraphrased; every dimension, anchor, lens step and threshold is kept. A "Ryan Realty reading" follows each item where our rules change how it is scored. Frame counts in cinetic's text are at 60 fps; converted to seconds where it matters.

### 3.1 The rubric (score each dimension 1 to 5)

Anchors are given for 1, 3 and 5; 2 and 4 sit between. The lead sets the final score per dimension: start from the owning lenses' `rubric:` lines, take the lower where lenses disagree, and cap a dimension at 3 while it has an open verified P0.

**1. Idea and device** (owned by the director)
- 1: a feature tour.
- 3: a clear idea, but the story device drops out, or the film would be just as true of a simpler product.
- 5: one idea specific to this product that reads muted. The device is an object the product owns, survives every cut, and resolves (into the mark; in a loop or product video, into the product's finished state).
- Evidence: the watch sheets viewed with sound off; the specificity answer in the treatment.
- Ryan Realty reading: the "product" is the place and the market. 5 means the idea is specific to this place and window: it would not be true of a generic market post (RULEBOOK 7 rejects generic national posts). The device is ours (the navy dot, the pin, the $10,000) and it carries to the hand-off into the locked end card; it never becomes the logo.

**2. Hook (0 to 2 s)** (director)
- 1: a blank or static frame.
- 3: motion, but the problem lands after 2 s.
- 5: frame 0 composed and moving; the problem felt by 1 s.
- Evidence: the first watch sheet; the first two seconds of the energy curve.
- Ryan Realty reading: RULEBOOK 2a.1 adds that the hook is the story or the tension, never a label; hook text by 2 s is a hard fail in `video_render_gate.py`.

**3. Copy and type** (art lens)
- 1: labels, bullets, more than 35 words, mixed fonts.
- 3: clean but generic lines.
- 5: at or under budget; lines that pay off the film's own words; one family on one token set; zero collisions.
- Evidence: the art lens; the grid check's word counts and holds.
- Ryan Realty reading: our families are Amboqia for display and Geist for figures and captions (two families by brand, not a fail). RULEBOOK 2 and 3 tighten it: about 4 words of label at most, no sentences on beats, the banned-word list, no "top team", no em or en dashes, no addresses or names. VO captions are mandatory and do not count against the word budget, but promoted lines must suppress duplicate caption cues.

**4. Colour and brand** (art lens)
- 1: gradients, neon, glass or beige defaults; the starter's look.
- 3: disciplined but generic: the accent means nothing, or the brand has no personality.
- 5: a look of its own that follows from the brand; one accent with one meaning on 8% of pixels or less; no banding; an ownable mark.
- Evidence: the art lens; the banding sheet; the mark sheet.
- Ryan Realty reading: score against navy `#102742` and cream `#faf8f4` only (white and black only as a legibility scrim). "Accent with one meaning" is full navy or a navy/cream inversion marking the one thing that matters. Cream and Amboqia are brand-supplied, so cinetic's beige and serif tells (D3, HB4, HB5) do not apply (3.6). Any third colour without Matt's dated ask is a P0.

**5. Composition** (director, art lens)
- 1: centred web layout, voids.
- 3: correct, but framing errors or crops that slice glyphs.
- 5: full-bleed, one focal point per shot, headroom kept.
- Evidence: the layout audit; the legibility sheet.
- Ryan Realty reading: 9:16 safe zone with critical text at x up to 960 and y up to 1640 (VIDEO_TYPES core 10). cinetic's 9:16 rule also applies: the content's mass sits in the middle of the safe band and the lower part of the frame is never bare.

**6. Motion** (director, forensics)
- 1: uniform fades and bounces.
- 3: good eases, with pops or stalls.
- 5: named curves, weight, zero-slope landings, contact squash.
- Evidence: the director; forensics spikes and stalls.
- Ryan Realty reading: our named curves are the brand ease-out and the draw/camera ease (motion-design contract 6). Overshoot only on a true landing, at most two per film; the locked logo drop counts as one.

**7. Transitions** (director)
- 1: crossfades and presets.
- 3: motivated, but with repeats.
- 5: velocity-matched cuts, relays and morphs; a signature move used three times (open, middle, close).
- Evidence: the director; the seam table.
- Ryan Realty reading: at calm speeds (RULEBOOK 2b). Something crosses every seam.

**8. Pacing** (director)
- 1: dead holds or cramming.
- 3: even, with flat energy.
- 5: one peak per bar, calm between peaks, results held long enough to land.
- Evidence: the energy curve; holds and quiet flags.
- Ryan Realty reading: RULEBOOK 2b caps us at one move per bar and requires every beat and number to hold 2.5 s or more. A 5 here is a calm film whose holds are alive (item 8) and whose hero beat runs longest. Never score our pacing down for being slower than cinetic's launch-film density (45 to 60 events per 30 s, median shot about 1 to 1.5 s).

**9. Product truth** (art lens). For us: data and place truth.
- 1: a fake dashboard.
- 3: real UI, but the naive version of the feature, or data or states that contradict the story.
- 5: the feature's non-obvious behaviour, shown; data that agrees with itself and with the story (roles, sums, ratios); state changes animate; counters count during the action.
- Evidence: the art lens; the pause test; the story asserts in the data module.
- Ryan Realty reading: every figure on screen equals its `brief.numbers` trace (`figureLeaks` on drawn text); the footer states definition, window, geography and property type; each label points at exactly one value; a meter fills to its value; pins drawn equal the verified counts; footage shows the place named; no invented listing, room or view. Under CLAUDE.md 0, any failure here is P0, not a score.

**10. Sound and sync** (sound lens)
- 1: stock sounds, or out of lock.
- 3: synced, but masked or out of key.
- 5: every event within 1 frame and audible, tuned, the payoff loudest, on its loudness target (minus 14 LUFS; minus 16 for a calm brand or a sting) and minus 1 dBTP.
- Evidence: the strict A/V audit; the sound lens.
- Ryan Realty reading: for a silent export where Matt adds the IG song, score N/A (cinetic scores a muted loop's sound N/A) but check the cue-JSON beat placement and that captions sit within 1 frame of their word times. For a scored Studio film: minus 14 LUFS integrated, true peak at or under minus 1 dBTP after AAC; the calm/measured personality; no kicks, booms, risers or drops.

**11. Finish** (forensics)
- 1: pops, ghosts, jitter or banding.
- 3: occasional P1-level artifacts.
- 5: zero failing forensics checks, every warning explained, clean blur, BT.709 tags.
- Evidence: the forensics report; the probe.
- Ryan Realty reading: plus brand navy landing on (16,39,66) and cream on (250,248,244) in the decoded file (our int test).

Formats missing a dimension score it against that format's own recipe: a muted loop scores sound N/A; a sting's product truth is its mark.

### 3.2 The lenses

Round 1 runs four lenses in parallel as separate agents: director, forensics, sound and sync, art/copy/UI. Later rounds drop the art lens unless copy, type, colour or UI changed. Each lens opens the sheets before any code ("first impressions are the audience's; after reading the code you will forgive things the audience will not"). Every lens returns the same JSON:

```json
{"issues":[{"id":"short-kebab-id","priority":"P0|P1|P2","frame":"a-b","problem":"","fix":{"file":"","change":""}}],
 "overall":"3-6 sentences ... \nrubric: dim=N ...","score":7.5}
```

**Filling a lens.** Every template is filled before handing over:
- the film name and its one-line idea;
- the spec (size, fps, length, tempo);
- the project root and the file under review (preview or master);
- the round's QA folder and a private work folder;
- the round number;
- exactly what changed since the last round, from the fixes file;
- every already-fixed issue id;
- the fixing time left;
- the brief, word for word.

**Prompt rules that pay off:**
- say what changed, so it is checked hardest;
- say "do not re-report fixed issues";
- say "do not propose adding text" (critics reach for captions when the picture does not read; the fix is the picture);
- ask for a ranking by impact per minute of fixing, with the time left;
- batch images into sheets.

**Director lens.** "The creative director of a top motion studio": viewer first, builder second.
1. Watch before reading: the 12 fps watch sheets in order, each row about 0.67 s; write first impressions before opening any code.
2. Run the hard-ban checklist on the sheets (3.6). A hit on any frame is P0 unless the brief lists it as brand-supplied.
3. Then answer, each with frame numbers:
   - the weakest 3 seconds, and why;
   - cheap, templated, slow, confusing or dead moments (check the tell catalogue);
   - specificity: would this film be as true of a simpler subject;
   - its own look, or the starter's, or a generic minimal template;
   - colour with character: a default framework blue on flat greys (D10), or a colourless film where a mid-film thumbnail shows no brand colour (D11); P1, or P0 when the brief asked for a distinctive brand;
   - the mark at a glance: what it reads as at 64 px in half a second (a misread is P0);
   - does each act's idea land inside 1 s;
   - does the story read with sound off, and does the device ever blink out;
   - the hook: frame 0 composed and moving, problem felt by 1 s and stated by 2 s; a soft first second is P1, P0 on a feed, loop or social deliverable;
   - can a stranger name it;
   - the end: lockup resolved 1.5 to 2 s and visibly building, URL readable 1.7 s or more, last frame works as the poster, and the brief's practical fact on the end card (missing is P0);
   - composition in motion: nothing moving covers text being read (I8), and in 9:16 the height is used (E8);
   - pacing: one peak per bar, calm of 0.5 to 1.2 s between peaks, the first 6 s about twice as dense as the middle, backed by the energy curve;
   - transitions: six to eight types, none more than twice, a signature move at open, middle and close, no default crossfade, no duplicated rest pose at a seam;
   - speed: on a blurred master the fastest frames at full size; stepped copies or long smears mean the move is too fast to blur and needs a redesign.
4. Re-check what changed at full frame rate.

Rules: at most 12 changes, ranked by impact per minute; each concrete and code-level (file, constant, values); start a problem with its tell ID; prefer moving picture timing over sound timing. Returns `rubric: idea hook composition motion transitions pacing`.

Ryan Realty reading:
- The "end" questions apply to our topic CTA card and to whether the locked card plays exactly (logo, then Quality/Local/Service, then "Call now" 541.703.3095, in the last 4 s). We never add a URL unless Matt asks.
- Pacing per RULEBOOK 2b, not cinetic density.
- "Six to eight transition types" relaxes for a 15 to 30 s calm ad: three or four types, none used more than twice.

**Forensics lens.** Hunts technical artifacts a viewer would read as broken, even for one frame. The scripts find candidates; the lens decides what is real.
1. Triage every flag, fails first: make a paired diff sheet of each flagged range (two frames either side), grab full-resolution stills, and decide **real** (report it), **designed** (the lead should declare it), or **false positive** (one clause why). The classes and their usual causes:
   - `pop` or `seam-pop`: a one or two frame change motion does not explain. Usually a property flipping at a cut, a fade collapsing into 1 to 2 frames, or an expo-out fade-out.
   - `hit`: the same change on a cue. Fine if designed; a pop if it is a reveal that finishes too fast.
   - `stall`: a repeated frame inside motion. A duplicated rest pose at a seam, or two moves easing to rest back to back.
   - `hold` (frozen or quiet): more than 0.8 s with almost nothing changing. A dead hold or a locked-off shot.
   - `ghost`: a one-frame image neither neighbour has. A promoted layer with an animated blur, or a stale layer.
   - `border`: a 1 to 3 px edge sliver for several frames. A camera exposing the stage edge, or layers without overscan.
   - `judder`: whole-pixel stairs in a slow move. Fractional left/top combined with a transform, or text snapping at the tail of an ease.
   - `sharpness`: a one-frame blur step. An animated CSS blur on a large layer.
   - `banding`: smooth gradients drawn as 8-bit plateaus. CSS gradients; use dithered PNGs.
   - `smear`: compression blotches of 1-level texture on flat fields. A dither the encoder half kept.
2. Hunt what the scripts cannot see, at full resolution:
   - z-order errors; clipped, overlapping or colliding text;
   - elements that appear or vanish without a transition;
   - thin lines and small text crawling at small scale;
   - faux italics from 3D shear;
   - motion-blur stamping and smears on the fastest frames (a move over about 60 to 80 px/f at 60 fps is a redesign, not more samples);
   - blur windows crossing a hard cut; double exposures;
   - colour shifts between preview and master (must be BT.709 tv range).
3. For each real issue, name the smallest code fix and the frames that prove it fixed.

Rules: report only what was verified on real frames with exact frame numbers. Returns `rubric: finish motion`.

**Sound and sync lens.** "You cannot listen, so you measure." Judges whether the sound makes the picture feel better: locked, tuned, audible, with an arc.
1. Lock:
   - the hit rate, median and p90 offsets, and misses from the strict audit run on stems;
   - a median offset beyond 1 frame is a systematic lag;
   - each miss is missing, early or late; common causes are a spring cued on its settle instead of its pop (50%) or contact (92 to 100%), a whoosh off the velocity peak, or a picture change starting on the cue instead of one frame before;
   - stray effects with no picture reason.
2. Picture against sound:
   - cuts and the velocity peaks of major moves sit on the grid; section changes and the hero reveal land on the music's own event (drop, stop, re-entry);
   - designed effects sit on discrete state changes only, about 5 per 10 s, clustered where the music is sparse;
   - a sounded class of action is sounded every time at one level (partial coverage is P1);
   - about two whooshes per film, only on camera-scale moves, starting 100 to 450 ms ahead with the apex on the visual peak;
   - continuous motion (scrolls, counters, progress) stays silent;
   - a designed silent moment is fine when it sits on a silence in the score.
3. Audibility: effects at least 6 dB over the music in their own band; name the masked ones that matter (key hits, payoff, logo).
4. Arc and finish:
   - integrated loudness on target within 1 LUFS (minus 14, or minus 16 for a calm brand or a sting) and true peak at or under minus 1 dBTP after AAC;
   - loudness range 3 to 8 LU, and at least 5 LU at 20 s or more (a thinned section before the turn, true silence before the drop, the payoff 2 to 3 LU over the median);
   - the loudest moment on the payoff, about 30 to 60% in;
   - the lockup the most resolved moment, not the loudest (a logo slam as the peak is P1, stings excepted);
   - no clicks; the head starts from silence; the tail decays to digital zero with at least 1 s of silence; no effect starts inside the end fade;
   - the hook's first 0.5 s within 12 dB of the median with a sound caused by something visible (a soft hook is P1, P0 on a feed or loop).
5. Personality: the score matches the brand's three adjectives. Drops, sub booms and risers on a calm brand are P1 (trailer noise); a timid bed under a fast launch is the opposite failure. A progress story's steps climb and resolve.
6. Composition:
   - every pitched effect in key; snaps and booms tuned to the chord root; dominant pads end before the downbeat they resolve into;
   - drops land on true silence;
   - typing follows the measured norms (P1 if every key of a fast type-on clicks);
   - one UI-click voice at one level; heavy thuds only for landings seen in shot;
   - effects dry, mono and centred; only whooshes, risers and the music are wide.

Rules: move the picture, not the sound, when a hit belongs on the beat (audio leading picture by more than 45 ms reads "sound first"); never propose stock or sampled sounds. Returns `rubric: sound`.

Ryan Realty reading: our calm/measured personality makes drops, booms and risers P1 whenever they appear. For VO films add: voice about 9 dB over the music from 300 Hz to 4 kHz, captions within 1 frame of word times. On an IG-picker export, score sound N/A and check the cue-JSON placement and the lyric clash check (RULEBOOK 4).

**Art direction, copy and UI truth lens.** Round 1, and again when copy, type, colour or UI changed. "Judge every frame literally, as a paused still, and judge the brand as a whole: would a stranger remember whose film this was?"
1. Hard bans first (3.6).
2. Copy:
   - grab every line at its resolved frame and check spelling, casing, punctuation, plurals and placeholders;
   - check reveals: no letter or sweep reveal spells another word on its way (C10);
   - check the budget: 5 words per line or fewer, 2 lines at most, one line on screen at a time, the total within the brief;
   - lines pay off the film's own words; flag stock phrasing;
   - the brief's practical fact is on the end card at the secondary size for 1.7 s or more (missing is P0).
3. Type:
   - one family on one token set (one display weight and tracking everywhere);
   - emphasis from size or motion; tabular figures;
   - statement 88 to 128 px, secondary 44 to 56 px, UI at least 22 px after camera scale (9:16: statements 110 to 140 px, secondary 60 px or more, UI 32 px or more);
   - no glyph collisions, no faux italics, no text left blurred for more than 0.1 s.
4. Brand and mark: choices follow the brand's adjectives; no starter look; the mark is ownable, passes 16 px, and passes the 64 px misread test (P0); the lockup sits at 28 to 45% of frame width; mark and name read as one object.
5. Colour and surface:
   - one accent with a stated meaning on 8% of pixels or less outside one flood;
   - no default palette (D10) and no colourless film (D11, P1);
   - no muddy washes; no banding.
6. Composition:
   - no "text left, card right" and no small centred floating card;
   - one focal action per shot;
   - margins 96 px at the sides, 64 px top and bottom, 24 px of headroom at peak punch;
   - no glyph-slicing crops or voids; no moving element covering text being read (I8);
   - in 9:16 the mass sits in the middle of the safe band and the bottom 40% is not bare (E8).
7. Product truth:
   - the non-obvious behaviour shown;
   - data named, specific and consistent (dates match weekdays, counts match what is shown, labels stay true after moves);
   - data agrees with the story (totals and ratios match, no number twice in a frame);
   - UI large enough to read on a phone; counters change on the landing frame of their cause (I3);
   - the feature named once;
   - the product changes only the future; one colour means one thing; no cursor once the product acts alone; no fake KPIs, lorem, stock icons or generic dashboards.

Rules: cite the tell ID; name the frame, the exact string and a code-level fix; cutting text is welcome, adding it is not. Returns `rubric: copy color composition product`.

Ryan Realty reading:
- Run `figureLeaks` and the 0 trace check as part of step 7: every drawn digit maps to `brief.numbers`, and the footer matches its trace.
- Add the RULEBOOK 3 copy rules and the fair-housing check (describe homes and places, never who should live there).
- The mark is our real logo PNG on the locked card only; check it is never retyped, recoloured or shown before the card.
- The 22/32 px floors are cinetic's; our caption style may be larger.

**Verifier.** The refute pass, run before any fixing ("critics are often confidently wrong"). One verifier per P0 or P1 issue, or per batch of up to five on one act, in parallel.
1. Look at the frames yourself (full-resolution grabs and diff sheets; for sound, cut the moment and measure onsets and levels).
2. Watch it at speed: a one-frame blemish on a small area inside a fast move is often invisible at normal playback; a pop on a large area, or anything on a key beat, is not.
3. Read the code the fix names: is the cause really there, would the fix work, could it break a seam, a sync point or a hold budget?
4. Reject an issue when the claim is wrong; it is exaggerated (demote it); it is invisible at normal speed and on no key beat; it is already fixed; or the fix would make the film worse. If the problem is real but the fix is wrong, keep the issue with a better fix.

Rules:
- evidence means frame numbers plus a measurement or a clearly described image;
- priorities may move with the evidence;
- hard-ban issues stay P0 wherever they show and are rejected only if the frames do not show them or the brief lists them as brand-supplied;
- the verifier adds no new issues (it notes them in `overall`).

Returns only confirmed issues, each starting `VERIFIED:` with its evidence, plus `rejected: id, reason` for the rest, and a confidence score. P2s skip verification and go to a backlog.

### 3.3 Severity

- **P0**: visible on a key beat (hook, payoff, logo, end card), or it breaks the story or a fact, or it breaks a hard ban on any frame. Examples: the lockup vanishing in 2 frames, a typo on the payoff, audio 3 frames late, the device blinking out at a seam.
- **P1**: noticeable on a normal viewing. Examples: a one-frame pop mid-act, a dead logo hold, a masked hit, a stall at a seam.
- **P2**: visible only on pause. Examples: a 1 px sliver for 3 frames in a fast move, a label 2 px off grid.

Ryan Realty reading: any figure without a trace, an address or a name, a non-locked end card, a logo before the end card, or a fair-housing problem is P0 regardless of where it shows.

### 3.4 Rounds, the ship gate, and the design-off

- **Rounds.** Launch films and walkthroughs get at least two rounds; stings and loops one if every script passes. Stop after five, or when the gate is met. Every round reviews a preview carrying the master's colour tags. The motion-blurred master is rendered once, after the last round, and gets a check, not a round: forensics and A/V audit on the master, the fastest frames at full size, and a director's glance; a problem in one act is re-rendered for that act and spliced.
- **One round.** Render; measure (forensics, A/V audit); make the 12 fps watch sheets (about 4 s per sheet) and a one-frame-per-second legibility sheet at phone size; read the flags yourself first and declare designed cuts, freezes and ignores (each with a written reason; never declare your way to a pass); run the lenses; verify every P0 and P1; fix by impact per minute; score.
- **Ship gate (all must hold).** Every dimension 3 or more; Finish and Sound and sync at 5; a mean of 4.2 or more; no open verified P0; every script passing (spec probe, mux sync check, forensics with zero fails and every warning explained, strict A/V audit with zero fails, the code lint, the grid check, the layout audit).
- **Design-off for a weak act.** When an act stays at 2 or below on any dimension for two rounds, or the director names it the weakest 3 seconds twice, stop patching. Three designers work in parallel, each with the brief, the act's slot and seams, the last two rounds' notes, and one bias:
  - story: what must the viewer understand, and what is its most direct image;
  - camera: one move or relay that carries the idea;
  - rhythm: start from the bars.

  Each writes a frame-level beat sheet with an honest build estimate. One judge scores each 1 to 5 on four things:
  - cinema: would it make someone rewatch;
  - clarity: does it read muted in one viewing;
  - restraint: one idea, one focal action, no decoration;
  - risk: can it be built clean in the time left.

  The judge checks each claim against the code, re-estimates time, picks a winner, grafts one or two ideas from the losers, and writes a cut list. The winner is built as a fresh act and gets a full round.
- **Ryan Realty reading.** The gate is necessary, not sufficient: our own gates must also pass (`video_gate.mjs` before render, `video:check`, `video_render_gate.py` on the final mp4, `figureLeaks`), then Creative Desk watches with audio, and nothing posts without Matt's approval (CLAUDE.md 1; drafts land `ready`).

### 3.5 Recurring issue classes (look for these first)

1. Seam pops and duplicate frames.
2. Sound on the settle instead of the pop or contact; whooshes off the velocity peak.
3. Dead holds (logo, post-hook, end card).
4. Collisions from overshoot or moving targets.
5. Chromium artifacts (ghost, judder, sharpness, banding, border).
6. Envelope shapes (half-sine pulses, expo-out fade-outs).
7. Data truth (wrong labels, counters flipping late).
8. Out-of-key or masked effects.
9. Templated layouts.
10. House-style convergence, and features shown in their naive version.
11. Moves too fast to blur.

Key thresholds (60 fps in the source; seconds here):
- A spike candidate is a frame difference over 1.0 and over 2.5x the local median plus 0.3.
- A frozen hold is under 0.1 for more than 0.8 s with 90% of frames changing under 16 px; a static end tail up to 2 s is allowed.
- The still-opening check warns if the first moving half-second starts after 1 s and fails after 2.5 s.
- The loop seam passes when the last-to-first difference is at most max(0.4, 1.5x the median step at the ends).
- Sync: 90% of onsets within 2 frames.
- Loudness on target within 1 LU; true peak at or under minus 1 dBTP; LRA 3 to 8 LU.
- No readable text faster than 20 px/f at 60 fps (40 px/f at our 30); readable text at least 22 px (32 px in 9:16).

### 3.6 Hard bans as our reviewer applies them

cinetic's HB1 to HB11, with our brand-supplied exceptions recorded (taste-and-slop.md: "when the user supplies a brand, the brand wins, and each exception is written in the brief"), then our own P0 additions.

| ID | cinetic ban | Our ruling |
|---|---|---|
| HB1 | Eyebrow or kicker labels above a headline | Keep. Conflict: our market films' `cues.ts` carries `heading.eyebrow`; decide once (Appendix C). |
| HB2 | Stacked taglines; "Introducing" | Keep (RULEBOOK 3 also bans taglines). |
| HB3 | Text walls, filler text, fake metrics | Keep. The one-line footer (definition, window, geography, type) is required by RULEBOOK 3 and is not filler. |
| HB4 | Serif or italic type | **Exception:** Amboqia Boriango display is brand-supplied. Italic and faux italic stay banned. |
| HB5 | Orange, amber, beige, cream, tan, sand | **Exception:** cream `#faf8f4` is brand-supplied. Orange and amber stay banned except Matt's dated "HOTTEST" ask. |
| HB6 | Neon, glow, bloom, halo | Keep. |
| HB7 | Purple, violet, indigo; multi-hue gradients | Keep. |
| HB8 | Glassmorphism | Keep. |
| HB9 | Emoji and stock icons | Keep (RULEBOOK 6 also). |
| HB10 | Effects standing in for ideas (sparkles, particles, confetti, flares, code rain) | Keep. |
| HB11 | Overshoot except on a true landing, at most two per film | Keep (motion-design contract 6). The locked logo drop counts as one. |
| RR1 | Any on-screen digit without a `brief.numbers` trace; any figure that disagrees with its trace; a count rolling through superseded values | P0 (CLAUDE.md 0, `figureLeaks`, VIDEO_TYPES). |
| RR2 | Logo anywhere but the locked end card; end card not exactly logo, Quality/Local/Service, "Call now" 541.703.3095 | P0 (RULEBOOK 1, 6; render gate). |
| RR3 | Addresses, buyer or seller names, identifiable clients; wording about who should live somewhere | P0 (RULEBOOK 3; fair housing). |
| RR4 | Em or en dashes; banned words; "top team" | P0 (RULEBOOK 3; `ci:no-public-em-dash`). |
| RR5 | Restyled MLS photos; generated people; generated places without a real reference; type or numbers inside a generated frame | P0 (RULEBOOK 6; creative-brain law 1). |
| RR6 | Any beat or number held under 2.5 s; rapid montage or strobe; a snap zoom | P1, P0 on the hook or payoff (RULEBOOK 2b). |
| RR7 | Third colour without a dated ask from Matt | P0 (RULEBOOK 6). |

---

## 4. License notes

This is a practical reading of the license files, not legal advice.

**The general rule.** We write our own code. Copyright protects code and text as written. It does not protect ideas, methods, techniques, or facts such as a timing value or a measured threshold (the 2026-10-07 research reached the same conclusion). We may therefore adopt every technique in this list as an idea, re-implement it in our own TypeScript, and use the numbers these libraries measured. A notice is needed only if we copy code, or substantial verbatim text, out of a repository.

| Source | License | Adopt as ideas | If code or text were copied |
|---|---|---|---|
| `Leonxlnx/cinetic` (repo `LICENSE` and `skills/cinetic/LICENSE.txt`) | MIT, (c) 2026 Leonxlnx | Everything: all 273 techniques, the rubric, the lenses, the hard bans and tells, the sound rules, the thresholds. | Keep the MIT copyright and permission notice with the copied portion. This covers, for example, `anim.ts` (`hitPulse`, `lmix`), `camera.ts`, `scripts/forensics.py`, `scripts/av-audit.py`, `scripts/audio/score.py`, `synth.py`, `master.py`, `accumulate.py`, `pick.py`. It also covers the recipe text in `techniques.json` and the critic templates: if any are pasted verbatim into our technique `.md` files or reviewer prompts, carry the notice, or paraphrase as this document does. Its Remotion starter needs Remotion's own company licence (free up to 3 people); we do not use Remotion. |
| `Rieranthony/product-film-skill` | MIT, (c) 2026 Rieranthony | Everything: closed-form springs summed per retarget, magic moves, punchlines with kept slots, Bayer dither reveals, `placement(t)`, measure-never-guess, the review checklist. | Keep the MIT notice with copied code, e.g. `templates/kit/spring.ts` (`step`, `track`, `critical`), `dither.ts`, `punchlines.tsx`, `scripts/beats.py`. Its Remotion parts carry Remotion's licence. |
| `heygen-com/hyperframes-community-skills` | Apache-2.0 (no root NOTICE file) | Everything: the vox seam law, the transition catalogue and its numbers, keyframe overlap, the gates, the provenance gate, the caption rules. | Apache-2.0 section 4 applies to a copy. Include a copy of the license. Mark modified files as changed. Keep the source's copyright and attribution notices. Carry any NOTICE text: the repo has no root NOTICE, but `skills/session-story/assets/engine/NOTICE.md` records third-party code (ClaudeAnimationBase by John Heibel, MIT). The license gives a patent grant and no trademark rights: never present our work as HeyGen's or HyperFrames', and the vox skill itself warns against implying any Vox affiliation. Dependencies its skills install carry their own terms: p5 (LGPL-2.1), p5.brush (MIT), and prod-by-claude's `@strudel/web` (AGPL-3.0, which we must not pull into our product). |
| `buildfastwithai/buildfast-skills` | MIT, (c) 2026 Build Fast with AI; fonts under SIL OFL (`motion-studio-skill/engine/fonts/LICENSE-*.txt`) | Everything: the 10 motion languages, 51 styles, QC checks, generative-film devices, canvas-documentary craft. | Keep the MIT notice with copied code; `generative-film-skill` asks that its `engine.py` and `audio_kit.py` be used verbatim, which would need the notice. Fonts we do not need (our faces are Amboqia and Geist); if one were ever used, its OFL text travels with it. |
| prompt-motion.com prompts | None stated. The site says each prompt "was taken directly from" a named X user's post. | The techniques and rules they describe. | Do not copy prompt text into the repo or into anything published; short quotes in internal research notes (as `prompt-motion.md` already has) are the most we keep. The preview MP4s and reels are the creators' work: never re-host or reuse them. |

**Already in the repo.** `references/prompt-motion.md` states that no code was copied on 2026-10-07. The technique registry's `source` field and each technique `.md`'s "Source:" line give provenance. Keep both habits for every new technique: name the repository path the idea came from, even though no notice is required for an idea.

---

## Appendix A. The prompt-motion.com spec-grade prompts

prompt-motion.com was reachable on 2026-10-14 with 234 entries (231 on 2026-10-07). All 234 entry pages were scraped and each prompt scored for spec markers:
- a pure function of time (`seek(t)`);
- fps and duration;
- a banned list;
- a beat grid;
- a loudness target;
- stills or one frame per beat before the full render;
- springs;
- a separate critic.

Fifteen entries carry four or more markers (fourteen distinct prompts: `demonugc-4c5753` is word for word `twoclipping-5cba86`). The 2026-10-07 count of 16 probably added one of the two next-longest prompts below the cut (`wani-shola-16ca7a`, `aschapmann-131210`). Which one cannot be confirmed, so both are listed as borderline. All were read in full; what each teaches:

| Entry | What it teaches us |
|---|---|
| `twoclipping-5cba86` (and `demonugc-4c5753`) | One shape never cut, morphing through states; every style from `seek(t)`; springs as closed-form steps summed per retarget; a tab indicator's two edges on two springs; drags as direct manipulation; a numpy beat grid; 4 subframes blended; one frame per beat before the render; last frame identical to the first, cursor speed included. |
| `twoclipping-221cab` | One continuous take where each scene is made from the last; a black flood that contracts into the next scene (overscale past the corners, about 0.3 s); a grid unfolding like a paper map; six-blade iris; footage re-encoded all-intra and awaited per frame; effects by measured peak; minus 14 LUFS; a single-frame pop scan (3x neighbours); a beat map and 4 stills first. |
| `twoclipping-6dd14e` | Real clips as image sequences swapped per frame; the grid calibrated to the real kick hits; 3 subframes at t minus, at, and plus 1/240 s; 20+ probe frames before render; no full stops on screen; a long ban list. |
| `ultimaxbt-bbebf5` | One dot connects every scene; the graph is drawn from the same spring that moves the dot; outgoing and incoming text on separate timing; a filling shape scales past all four corners; the loop matched. |
| `ultimaxbt-2ddf1e` | One eased camera move per scene, never zoom in then out consecutively; every handoff a shared element; the flood reaches the farthest corner in about 0.35 s; 8 subframes because 4 ghost; a courier dot along a route to a pin. |
| `notdwd-7de38a`, `notdwd-c2037d` (variant that maps the user's brand colours) | A frame-exact shot table; every shot enters moving and leaves accelerating or on a blur ramp; blur follows speed and direction; keyframe tables continuous in frame number with seeded hashes; zoom smear from scaled copies; measure text only after fonts load; synthesized effects at exact times; minus 14 LUFS, minus 1 dBTP. |
| `gdgtify-287ddf` | Words with architectural roles; at least one 400 ms of absolute stillness; critically damped loads, elastic only on the baseline; a periodic timeline with render(0) equal to render(T); reset hidden elements under full occlusion; the speech readable with no audio; inspect eight frames. |
| `antonio-kodheli-490109` | Cues in beats in `timeline.ts`, strings in `copy.ts`, no magic numbers; scrape real assets and quote them verbatim; the camera as focus x, y and log scale; tile radius to 0 at full-bleed; scan clips for cuts before looping them; a cursor that homes on the live button; a fresh critic who did not build it. |
| `rossaxbt-94583b` | One ball through one world; slider value computed from the ball's position; keys pressed match the text that appears; the loop matched, direction included. |
| `rossaxbt-3085b7` | The VO pipeline (four takes, per-line splice, pause shortening, phrase levelling, per-segment Whisper alignment); captions typed at the spoken time; a three-band sidechain with voice 9 dB over music; camera zoom continuity between scenes; a contact sheet, pop scan and voice-to-music check before showing anything. |
| `daniel-haida-8691d4` | Real product only, no invented metrics; one shot, one idea; object-driven transitions (a chart line becomes a document edge); overshoot under 2%; a timestamped storyboard; render representative frames and inspect them; inspect decoded frames of the final MP4; "do not declare success because the code compiles". |
| `brainextends-e19ac3` | A persistent element connecting shots; outgoing titles leave before incoming ones take the space; match-position transitions; 3 to 5 subframes; everything clipped to the stage. |
| `ik-builds-b8bdcf` | No invented results (no %, multipliers or names); hard light and dark switches; a sound on every hit; minus 14 LUFS and minus 2 dBTP re-measured after the AAC encode. |
| Borderline: `wani-shola-16ca7a` | Use only facts and numbers that are on the source site; cut every scene on the beat. |
| Borderline: `aschapmann-131210` | One soft sound per element that appears and silence otherwise; check the frames yourself and fix overlaps before showing. |

## Appendix B. Registry status today (integ/one-factory, version 2026-10-13c)

- **Ready (19):**
  - code: `eased_number_reveal`, `loop_seam_edit`, `tiktok_caption_burn`, `contact_sheet_review`, `dollar_first_hook`, `question_secret_hook`, `send_invite_hook`, `line_draw_riding_dot`, `outline_draw_zoom`, `meter_fill_verdict`, `true_shape_pan`, `data_sonification`, `composed_score`;
  - process: `draft_then_master`;
  - prompt and footage: `imagine_official_prompt`, `imagine_first_last_keyframe`, `imagine_seamless_loop`, `imagine_imperfection`, `behavior_not_emotion`.
- **Planned (9):** `subframe_motion_blur` (F4), `measured_drop_sync` (item 18), `map_pins_pop` (item 4), `one_dot_thread` (item 10), `bucket_drain`, `words_become_structure`, `collision_notes`, `milestone_timeline`, `paper_cutout_layers`.
- **Suggested new registry keys for the ranked items** (each needs a module and a test before `ready`; `ci:studio-techniques` checks both):

  | Key | Category | Item |
  |---|---|---|
  | `plate_line_rise` | type | 1 |
  | `figure_macro_pullout` | hook | 2 |
  | `iris_from_glyph` | transition | 3 |
  | `pin_overlap_filter` | scene | 4, extends `map_pins_pop` |
  | `footage_to_map_isolation` | transition | 5 |
  | `figure_magic_move` | type | 6 |
  | `velocity_seam` | transition | 7 |
  | `living_hold_creep` | type | 8 |
  | `claim_ground_flood` | transition | 9 |
  | `caption_word_stack` | type | 11 |
  | `global_grain` | footage | 12 |
  | `stage_clears_to_card` | cta | 13 |
  | `occlusion_reset_seam` | transition | 14 |
  | `drift_matched_angle_cut` | transition | 15 |
  | `scale_through_cut` | transition | 16 |
  | `dither_reveal` | transition | 17 |
  | `dot_field_silhouette` | scene | 19 |
  | `guilloche_field` | scene | 20 |
  | `measured_annotation` | scene | 21 |
  | `unit_grid_tally` | scene | 22 |
  | `paper_map_unfold` | scene | 25 |

## Appendix C. Questions for Matt (yes or no; recommended answer first)

1. Show every Bend single-family price-cut and credit sale as a pin in a paid ad, at city zoom with no streets or addresses legible? Recommended: yes, once you confirm the MLS's display rules allow other brokerages' sold data in advertising.
2. Drop the eyebrow line from the market films, since cinetic's reviewer treats eyebrows as a hard fail? Recommended: yes.
3. Raise the hold drift from today's 8 px per hold toward cinetic's living-hold rate, judged on a three-way side-by-side (item 8)? Recommended: yes, render the side-by-side first.
4. Make a short bell motif on the end card our sonic signature across all scored films? Recommended: yes, as a draft for you to hear.
5. Keep 30 fps masters for the buyer ad (subframe blur covers stepping), rather than 60? Recommended: yes, keep 30.
6. In the buyer ad, put the payment-math beat right after the hook and before the map, so the map still closes the body as you asked? Recommended: yes.
