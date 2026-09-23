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

## Distribution notes

Label every piece as AI-generated on each platform (TikTok AIGC label, Meta "AI info"); the
end card carries "Made with AI". If boosted, it runs in Meta's Housing special ad category.
The score is original (ElevenLabs Music on the pay-as-you-go plan); no commercial tracks.
