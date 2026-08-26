# Grok craft canon

The rules that keep Ryan Realty's generated media from reading as AI slop.
Enforced in code by [`lib/studio/craft.ts`](../lib/studio/craft.ts) and
[`lib/grok/vision.ts`](../lib/grok/vision.ts); this file is the why.

Read with CLAUDE.md §0 (every number traces to a source) and §3 (design system).
Nothing here overrides either.

---

## 1. The capability map

What the xAI account actually serves, verified 2026-08-26 against `GET /v1/models`
and the published rate card. `npm run ci:grok-models` re-checks the ids so a
deprecation fails a gate instead of a render.

| Capability | Endpoint | Model | Rate |
|---|---|---|---|
| Reasoning text, captions, editorial | `POST /v1/chat/completions` | `grok-4.6` | $2.00 / $6.00 per 1M in/out |
| Structured JSON (schema enforced) | same, `response_format.json_schema` | `grok-4.6` | same |
| Live web + X research | `POST /v1/responses` with `web_search`, `x_search` | `grok-4.6` | tokens + per tool call |
| Image understanding (our QA gate) | `POST /v1/chat/completions`, `image_url` part | `grok-4.6` | tokens |
| Stills | `POST /v1/images/generations` | `grok-imagine-image-2.0` | $0.04 / image |
| Image edit, up to 3 sources | `POST /v1/images/edits` | `grok-imagine-image-2.0` | in + out |
| Motion (t2v, i2v, reference) | `POST /v1/videos/generations` | `grok-imagine-video-1.5` | $0.08 / second |

Two API facts that cost us if forgotten:

- **Live Search is dead.** The old `search_parameters` field returns HTTP 410.
  Research goes through the Agent Tools API at `/v1/responses`.
- **`generate_audio` defaults to `true`.** Native generated audio is the
  loudest tell that a clip is AI, and a hallucinated voice on a brokerage feed
  is a compliance problem, not a taste problem. `lib/grok/video.ts` defaults it
  to `false` and only turns it on for a bed someone has listened to.

Reference-to-video also accepts up to 3 preset voices (`reference_audios`,
`voice_id`) and up to 3 subject reference images tagged `<IMAGE_1>`..`<IMAGE_3>`.
That is the path to a brand presenter when we want one. It is capped at 720p.

## 2. The method: still first, then motion

Motion costs $0.08/sec against $0.04 for a still, and it is the step where
things go wrong. So:

1. Build a hero still at the exact delivery aspect.
2. Send the still back through Grok vision and inspect it.
3. Animate only a frame that passed, with `image` locking frame one.

Pure text-to-video is previz. It never ships. This is also why our QA gate
inspects stills and not clips: a frame can be judged, and the temporal defects
we cannot judge from one frame are the ones we prevent by constraining motion
instead (one axis, stated amplitude, six seconds).

## 3. The prompt skeleton

Written in this order, always, by `buildStillPrompt` / `buildMotionPrompt`:

> glass and format → light → camera move with amplitude → subject with ONE verb → materials → hard negatives

- **Real glass.** `35mm spherical, T2.8`, not "cinematic lens".
- **Gaffer light.** Direction, quality, colour temperature, falloff, and
  explicitly no second sun.
- **Quantified move.** "slow dolly-in 30cm over 6 seconds, no pan, no tilt".
  An unstated motion amount defaults too hot for paid work.
- **One verb.** One completable action per beat. No walks-plus-talks-plus-hands.
- **Six seconds.** Identity and background geometry degrade at the tails.

### Never
Booster tokens (`8k`, `masterpiece`, `photoreal`, `ultra-detailed`,
`trending on artstation`, `unreal engine`, `stunning`). They read as craft and
do the opposite: they pull the model toward the oversaturated plastic-HDR
centre of its training distribution, which is precisely the look people mean
by slop. The full list is `BANNED_PROMPT_TOKENS`; `assertCraftClean()` throws.

Also never: readable signage, phone UI, or brand marks in-camera. Generated
letterforms hold for two frames and collapse into glyph soup, and a mark that
almost matches ours is worse than no mark. Type is composited afterward.

## 4. The reject list

`FRAME_DEFECTS` in `lib/grok/vision.ts` is a closed enum on purpose: a
free-text critique cannot be counted, trended, or gated. Any defect is a hard
fail regardless of score.

`rendered_text` · `logo_or_watermark` · `warped_architecture` ·
`impossible_geometry` · `melted_or_merged_hands` · `malformed_face` ·
`person_present` · `inconsistent_lighting` · `detached_contact_shadow` ·
`oversaturated_ai_look` · `plastic_hdr_skin` · `wrong_region` ·
`duplicated_object` · `nonsense_detail`

`wrong_region` earns its place here. Central Oregon is high desert: juniper,
sage, ponderosa, basalt rimrock, the Cascades to the west. A generator reaching
for "beautiful landscape" returns palms, saguaro, or eastern hardwoods, and a
Bend audience spots it instantly.

## 5. What the Studio does NOT own

The live site's own video is separate and stays: the city and community hero
clips resolved through `data/city-hero-videos.resolved.json`, and the MLS
embeds in `lib/video-embed.ts`. Neither is generated, and neither goes through
this pipeline. §0 still applies to any number on screen in them.

## 6. Real-estate specific limits

- **An MLS photo is not ours to edit.** `editGrokImage` is for brand and
  background plates. Altering how a listed home looks misrepresents a real
  property and is a licence problem. Listing motion animates the real photo
  with a locked first frame and a push; it does not change the house.
- **No invented property.** A generated house is a generated house. It never
  stands in for a listing.
- **No deepfake of a real identifiable person** without consent. Our own
  brokers, with consent, are fine.
- **Every number still traces** (§0). Search citations are context, never a
  source for a figure.

## 7. Provenance of these rules

The craft rules in §3 and §4 were pulled from working practitioners via
`x_search` and `web_search` on 2026-08-26, then reconciled against the API
behaviour we verified directly. The handles that search surfaced as the
strongest Grok Imagine work — cited here as leads, not independently verified
by us — include @VOLDEMORT2X, @crusadersen, @dvorahfr, @art_muse, @scarlettzen1,
@andyorsow, @Diesol, @ianmiles and @keepgoingAnnie. The consistent pattern
across all of them is the one encoded above: a locked starting frame plus one
clean motion beat, finished outside the generator.
