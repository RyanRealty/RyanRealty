# Story films

Vintage home-movie pieces for Instagram Reels, TikTok and Facebook Reels. One true story,
told in a different year each time: someone from somewhere busier comes to Bend for a few
days, lives the place, and does not want to leave. The first piece is **Winter, 1982**: a
couple's Super 8 reel of a ski weekend that ends with him pulling a smartphone out of his
coat to call Ryan Realty.

This is a lane of the Studio (CLAUDE.md §4), not a second factory. Every generation goes
through `lib/grok`, every prompt through `lib/studio/craft.ts`, every dollar through the
Studio spend ledger, and nothing posts without Matt (§1).

Read with [`GROK_CRAFT_CANON.md`](GROK_CRAFT_CANON.md) and the creative brain
(`.claude/skills/creative-brain/`).

## The one idea underneath every piece

The reel obeys its era completely, and breaks exactly once. Every frame is what an amateur
in that year would have shot on that format: handheld, 4:3, people mugging for the lens,
zooms instead of dollies. Then a modern phone comes out of a period coat, and at that beat
the film gives way to a crisp present-day phone screen, the only sharp frame in the piece,
with the brand on it. The joke and the name land in the same beat (humor's vampire effect
is avoided because the brand IS the joke).

## The parts

| Part | File | What it owns |
|---|---|---|
| Era packs | `lib/studio/story/eras.ts` | What a year looks like: format, period content cues (hair per person, wardrobe for extras, cars, rooms, streets), amateur camera grammar, anachronisms the judge rejects, and the film-lab stock parameters |
| Beat library | `lib/studio/story/beats.ts` | Things visitors do in Bend, each with the years it can honestly appear in, its seasons, its real reference stills, one action, and which era cues it needs |
| Visitor arc | `lib/studio/story/arc.ts` | The timed skeleton (hook, arrive, play, play together, eat, town, stroll, discover, sign, phone, BREAK, call, end) and the planner that fills it, refusing out-of-era beats |
| Cast | `lib/studio/story/cast.ts` | Two invented people, a reference sheet each, wardrobe per scene |
| Pieces | `lib/studio/story/pieces.ts` | A piece is a row: era, season, cast, pinned beats, continuity, payoff, captions |
| Prompts | `lib/studio/craft.ts` (`buildPeriodStillPrompt`, `buildPeriodMotionPrompt`, `HOME_MOVIE_MOVES`) | Wording and order of every generator prompt |
| Judge | `lib/grok/vision.ts` (`STORY_FRAME_DEFECTS`, references) | People allowed; anachronism, cast mismatch, hands, faces rejected; judged against the cast sheets by `GROK_MODELS.judge` |
| Production desk | `scripts/studio/story-film.ts` | Staged, resumable CLI over `out/story/<piece>/manifest.json` |
| Film lab | `scripts/studio/filmlab.py` | One stock for every shot: cadence, zoom, weave, resolve, stock curve, halation, grain, dust, start flash, gate |
| Reel | `scripts/studio/story_reel.py` | Sign composite, film-strip canvas, phone break, run-out end card, the sound mix |
| Phone screen | `scripts/studio/story/phone-ui.html` | The present-day screen in the site's v3 tokens, rendered with live figures |

## Making a piece

```bash
npx tsx scripts/studio/story-film.ts plan   --piece winter-1982          # the board, with warnings
npx tsx scripts/studio/story-film.ts cast   --piece winter-1982 --takes 3
npx tsx scripts/studio/story-film.ts select --piece winter-1982 --cast A --take 2
npx tsx scripts/studio/story-film.ts stills --piece winter-1982 --roles hook,arrive --takes 3
npx tsx scripts/studio/story-film.ts select --piece winter-1982 --role hook --still 4 [--note "why"]
npx tsx scripts/studio/story-film.ts motion --piece winter-1982 --roles hook
npx tsx scripts/studio/story-film.ts payoff --piece winter-1982          # live figure, two reads, citations.json
npx tsx scripts/studio/story-film.ts phone  --piece winter-1982          # renders the break screens
python3 scripts/studio/story_reel.py sign  --dir out/story/winter-1982   # our sign art onto the blank panel
python3 scripts/studio/story_reel.py edl   --dir out/story/winter-1982   # first edit decision list
python3 scripts/studio/story_reel.py build --dir out/story/winter-1982   # the reel
npx tsx scripts/studio/story-film.ts look --piece winter-1982 --era cine16_1978   # same footage, another stock (free)
python3 scripts/studio/story_reel.py build --dir out/story/winter-1982 --lab lab-cine16_1978.json --name reel-cine16_1978
```

Stages run in dependency order: a shot with `continuity` (the phone beat takes the sign
beat's house) waits for its parent's selected still. Stages can run in parallel (stills for
one beat while another animates): every save merges into the manifest on disk (takes
unioned by file, spend lines appended, a selection taken from the process that made it)
instead of overwriting it. The judge picks the best passing take; a person can select a take
the judge failed only with `--note`, which is written into the manifest.

## Rules, each learned the hard way (2026-09-23)

1. **Ask the generator for period content, never for a vintage look.** The lab owns the
   look so eleven generations become one reel of one stock. Model-baked grain differs take
   to take.
2. **Era cues are scene content; apply only the ones a beat needs.** A shared "brick
   storefronts" cue put a downtown main street under the ski run and on the road to the
   mountain. Beats declare `periodCues`; vehicles are phrased conditionally ("any car in
   frame is...") or cars appear in every frame.
3. **Hair and grooming cues are per person.** A shared "full moustaches" cue put a
   moustache on the woman in two of three cast takes.
4. **The era camera line carries no action.** "People look into the lens and wave" made
   them wave mid-toast. Waves belong to beats.
5. **Period wardrobe is specific or it drifts a decade.** "Color-blocked one-piece" came
   back as a 1990s teal-and-magenta suit. 1982 is solid colors with a chest stripe, bibs,
   matte nylon, straight skis with no sidecut.
6. **The brand never goes through a generator.** The yard sign is our real sign art
   (`design_system/ryan-realty/assets/brand/yard-sign.png`, with the tracked number
   541.703.3095 per the social skills) warped onto a blank panel in a still and moved by
   the lab. The phone screen is HTML.
7. **Zooms are exact, in the lab.** A zoom asked of a generator breathes; a crop keyframe
   does not. Every motion prompt says "no zoom".
8. **Resolution loss is the look.** Grain on a sharp 1080p frame reads as a modern photo
   with noise on it. The lab resolves to ~68% of gate width before grain.
9. **Numbers on the phone are live and traced.** `payoff` reads the figure through two
   independent DAL paths and stops if they differ by more than 1% (§0). A mock-up house is
   allowed (Matt 2026-09-23); a made-up price is not.

## Adding the next piece

- **New era:** add a row to `ERAS`. It starts `draft`; it becomes `proven` when a piece on
  it ships past Matt. Tune `lab` against a probe clip before any motion spend.
- **New season or activity:** add beats with honest year ranges (sources in `yearsWhy`)
  and real reference stills registered in the asset library
  (`node lib/asset-library.mjs register ... --source loc|usgs|wikimedia`). Only public
  domain, CC, owned, or licensed images condition a frame; museum and newspaper archives are
  mood board only.
- **New couple:** a new cast in the piece row. Invented people only; never a real person,
  never a broker's words.

Period facts worth reusing (verified 2026-09-23): Bend was ~17,263 people in 1980; the
mountain was **Bachelor Butte** until 1983 (Summit lift 1983); Brooks-Scanlon Mill A closed
1983 and the mills ran until 1994, so early-80s smokestacks smoke; the Old Mill District
shops opened 2001; Deschutes Brewery opened 1988; Awbrey Butte was raw lots until 1984; the
Pilot Butte Inn was demolished in 1973; the Drake Park neighborhood's 83 Craftsman-era
houses date 1910-1954; Highway 97 ran through town (the Parkway is 2001).

## Cost (Matt 2026-09-23: be fiscally responsible with Imagine)

The first piece cost about $30 of xAI credit at the first defaults: 3 stills per shot, a
grok-4.7 judge call on every still (with the cast sheets attached), and 6s clips at 1080p.
The published rate card only explains about $8 of that (63 images at $0.04, 72s of video at
$0.08); the rest is judge reasoning tokens and/or resolution-tiered video pricing the rate
card does not show. The ledger now records the raw `cost_in_usd_ticks` of every call so the
next piece reconciles to the invoice instead of guessing.

The defaults now:

| Lever | Default | Why it costs nothing on screen |
|---|---|---|
| Motion resolution | `480p` (`--res`) | the lab resolves to ~650px wide; a 4:3 480p source is 640px |
| Motion length | `4s` (`--seconds`) | no trim in the first cut used more than 2.9s of a clip |
| Stills per shot | `2` (`--takes`) | curation picked from the first two in most shots |
| Frame judge | off (`--judge on` to enable) | `sheets/<role>.jpg` is written for every shot; curate by eye and `select` |
| Sign shot | no motion | the sign is a still moved by the lab |
| Piece cap | $12 | leaves room for one round of retakes |

Rate-card estimate for a new piece at these defaults: about 24 stills ($0.96) + 10 clips x 4s
($3.20) = ~$4.20, before retakes.

**Separate creative billing.** Production (CRM reply intent, the broker SMS agent, the CMA
pipeline) and the Studio share one xAI team today, so a creative batch that empties the
prepaid balance blocks production too (it did, 2026-09-23). Create a second xAI team for
creative work with its own prepaid credit, put its key in `XAI_CREATIVE_API_KEY`, and story
films bill to it automatically (`GROK_BILLING=creative`, set by the CLI).

**The Grok app route (SuperGrok, no API spend).** xAI's consumer subscription is not
available to code, and scripting grok.com would breach its terms, so the handoff is files:

```bash
npx tsx scripts/studio/story-film.ts sheet  --piece <id>             # out/story/<id>/grok-app/SHOTSHEET.md
# a person runs each folder in Grok Imagine: upload ref-*.jpg, paste still-prompt.txt, 4:3,
# then animate the chosen still with motion-prompt.txt; save as <role>-anything.jpg|mp4
npx tsx scripts/studio/story-film.ts ingest --piece <id> --from <folder>   # crops to 4:3, records, sheets
```

Everything downstream (select, the lab, the sign composite, the reel) is the same.

## A second register: 16mm cinema, 1978 (`cine16_1978`, draft)

Matt's reference for the vibe (2026-09-23): Studio Shibuya on Instagram. "Vintage Bend, not
Tokyo." Their language: composed, centered, deadpan frames on a tripod; a character with a
signature look; the brand worn in-world as merch (a knit "I ♥" scarf); a muted pastel
stock. Measured on their frame: median saturation ~0.15, a faint green-olive cast through
every tone, warm mid-tones, highlights rolled off near 0.93, blacks lifted to ~0.04. The
`cine_pastel` stock in the lab encodes that; `HOME_MOVIE_MOVES.tripod` is the camera grammar.
An A/B of the first piece's footage in both stocks is at `out/story/winter-1982/abtest/`.
The `look` stage regrades any finished piece in another era's stock for free: same selected
footage, same edit, each shot keeping its own exposure; `build --lab --name` writes it beside
the original instead of over it.
Borrow the register, never the character: our in-world merch is ours (a Ryan Realty knit cap
or pennant, composited in post, never generated).

## "Winter, 1982" v2: Matt's notes, and the ending the lane now defaults to

Matt picked the pastel stock and gave four notes (2026-09-23). Each became a reusable part:

| Note | What changed | Where |
|---|---|---|
| Dinner downtown with the Tower behind them, something from then on the marquee | Beat `supper-tower-window`: a window table on Wall Street, the Tower across the street, an 85mm lens so the marquee is large between their profiles. The marquee boards are plated in post (`marquee` composite) with a film that was actually in wide release that week: *On Golden Pond* was #1 nationally the weekend of Feb 5-7, 1982 (Box Office Mojo weekend chart). The Tower was a single-screen movie house until it was twinned in March 1983 (Cinema Treasures; Oregon Theater Project). The reference photo is the 2012 restored facade (CC BY-SA 3.0, Another Believer); the 1982 marquee is undocumented. | `lib/studio/story/beats.ts`, `story_reel.py sign-clip --panel` |
| The ski shot: one following the other | Beat `ski-follow`: framed up the fall line at 85mm, she in front and he a few turns behind. "Keeps his place behind her, following her exact line" stopped them weaving through each other. | `beats.ts` |
| Don't make it corny at the end | No tagline on the card (`endLine` is optional). The last shot is `call-deadpan`: a centered tripod tableau, phone at his ear, straight faces, our sign on the lawn. The music stops dead on the cut, the line rings once in the hush, a pickup click, then the card lands on the last chord. | `beats.ts`, `pieces.ts`, `story_reel.py` |
| The website phone scene is lame | The full-frame phone takeover is gone. `phone-glow` keeps the phone inside the film: he holds it up to the lens, and after the lab the lit blank screen is found per frame and our page (`phone-ui.html` state `glance`) is laid on it. That makes the screen the only sharp, ungraded thing in the frame. A slow lab push-in makes the figure readable. `planStory` drops the break whenever the phone beat is a `phone_screen` composite. | `arc.ts`, `story_reel.py composite_screen`, `phone-ui.html` |

The phone's hero photo is a real, public-domain photo of Drake Park (Carol M. Highsmith,
Library of Congress, via `phoneHeroRef`), never a frame of the cast. The phone is the present,
so it shows the real place. It never shows a listing: the live Old Bend page carries other
brokers' listings with prices, and those don't belong in our ad.

Post, in order, for a v2-style piece (after `select`):

```bash
npx tsx scripts/studio/story-film.ts payoff --piece <id>           # figure, two reads
npx tsx scripts/studio/story-film.ts phone  --piece <id>           # renders phone-glance.png
npx tsx scripts/studio/story-film.ts look   --piece <id> --era cine16_1978
# plates: a still-size quad on a 2x-upscaled clip keeps lettering crisp
python3 scripts/studio/story_reel.py sign-clip --dir out/story/<id> --role eat  --panel assets/marquee-panel.png --corners ...
python3 scripts/studio/story_reel.py sign-clip --dir out/story/<id> --role call --corners ...
# edl.json: the phone segment carries "screen": {"image": "assets/phone-glance.png", "search": [x0,y0,x1,y1]}
python3 scripts/studio/story_reel.py build --dir out/story/<id> --lab lab-cine16_1978.json --name reel-v2
```

v3 (Matt: "make it interesting"): a black Lab in the car opens the reel (`car-wave-lab`), après
with friends by the fire is a new optional arc role (`apres`, kept only where a beat fits, so a
summer piece skips it), and the same Lab sits deadpan between them in the last frame
(`call-deadpan-lab`). One prompt line, "a young black Labrador retriever with a red collar",
held the dog across generations. Billed $1.42.

Cost of the v2 reshoot: 8 stills and 5 motion clips, $2.73 as billed by xAI (the ledger now
books xAI's own `cost_in_usd_ticks`, 1e10 ticks to the dollar). Reference-conditioned stills
bill about $0.075 each, not the $0.04 rate card, so the piece cap trips on real spend.

## Distribution notes

Label every piece as AI-generated on each platform (TikTok AIGC label, Meta "AI info"); the
end card carries "Made with AI". If boosted, it runs in Meta's Housing special ad category.
The score is original (ElevenLabs Music on the pay-as-you-go plan); no commercial tracks.
