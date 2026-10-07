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
almost matches ours is worse than no mark. Type is composited afterward, by
the Studio's motion stage (`lib/studio/motion`, Matt 2026-10-07): every figure
on screen is a verified figure, drawn in Geist over the finished footage.

## 4. The sequence

One shot is a post. A film is a small number of beats, cut, and the order is
not decoration. Encoded in [`lib/studio/shotlist.ts`](../lib/studio/shotlist.ts):

> establish outside → step into the main room → the room that sells the house
> → one specific thing you would remember → back outside

Three rules, each of which fixed a real fault in a real cut:

- **Never the same subject twice in one film.** The first film we cut opened
  and closed on the same front porch. Non-adjacent is not far enough apart.
- **Never the same camera move twice in a row.** A listing film's beats are
  pans across the real photographs (below), alternating direction beat to
  beat; a generated film prefers a move it has not used.
- **Fewer beats beats padding.** A two-beat film of good frames beats a
  five-beat film carrying two bad ones. When nothing qualifies, make nothing.

The frames come from the listing's own photographs, which is the half nobody
else has; the grammar is the half the best people on the platform worked out.

**Choose what to grade by striding across the set, not by taking the head.**
MLS order front-loads the exterior and the main living space: grading photos
0-7 of a 41-photo set returned three exteriors, five living rooms, and no
kitchen, so the film had nothing for its third beat.

**A listing photograph is never handed to the generator (Matt 2026-10-07).**
Grok was asked for a 9:16 clip from a 3:2 MLS photo and squeezed the whole
frame into the portrait one: every listing film came out with tall, thin
houses, and all eleven ready drafts were killed. Listing beats are now pans
across the real photograph (`lib/video/pan.ts`): one uniform scale until the
photo fills the frame, then a frame-sized window eased across it, so the whole
house passes through at its true shape. `pan.test.ts` holds a square square.
For every other generation, the still must already be the clip's shape: the
shape gate in `produce.ts` refuses to animate one that is not.

**Always re-encode the cut.** Four stream-copied 1080p beats ran ~96MB and
the storage bucket rejected it. One pass at CRF 21 keeps a film postable.

## 5. The reject list

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

## 6. What the Studio does NOT own

The live site's own video is separate and stays: the city and community hero
clips resolved through `data/city-hero-videos.resolved.json`, and the MLS
embeds in `lib/video-embed.ts`. Neither is generated, and neither goes through
this pipeline. §0 still applies to any number on screen in them.

## 7. Real-estate specific limits

- **An MLS photo is not ours to edit.** `editGrokImage` is for brand and
  background plates. Altering how a listed home looks misrepresents a real
  property and is a licence problem. That includes its shape: listing motion
  pans across the real photo at its true proportions and never sends it to a
  generator.
- **No invented property.** A generated house is a generated house. It never
  stands in for a listing.
- **No deepfake of a real identifiable person** without consent. Our own
  brokers, with consent, are fine.
- **Every number still traces** (§0). Search citations are context, never a
  source for a figure.

## 8. Provenance of these rules

The craft rules in §3 and §4 were pulled from working practitioners via
`x_search` and `web_search` on 2026-08-26, then reconciled against the API
behaviour we verified directly. The handles that search surfaced as the
strongest Grok Imagine work — cited here as leads, not independently verified
by us — include @VOLDEMORT2X, @crusadersen, @dvorahfr, @art_muse, @scarlettzen1,
@andyorsow, @Diesol, @ianmiles and @keepgoingAnnie. The consistent pattern
across all of them is the one encoded above: a locked starting frame plus one
clean motion beat, finished outside the generator.
