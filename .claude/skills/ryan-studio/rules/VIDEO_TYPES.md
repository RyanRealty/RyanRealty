# VIDEO_TYPES: one rule card per video type (Ryan Studio)

Status: v1, 2026-10-13. Source of truth for rules is still `RULEBOOK.md` (wins on any conflict). This file only applies those rules per type.
Machine-readable copy: `tools/video_types.json` (the gate reads it). Change both together.
Lines marked **PROPOSED** are new and are NOT rules until Matt says yes. The gate treats PROPOSED items as warnings, never failures.

**Hard rule (every type, every agent, Claude or Grok):** every video has a `brief.json` (schema `templates/brief.schema.json`) and a `timeline.json`, and passes `node tools/video_gate.mjs <brief.json> <timeline.json>` **before any render**, draft or final. A failing gate means no render.

## Core recipe (applies to every card; RULEBOOK §2a, §2, §2b, §1, §3, §4, §5, §6)
| # | Rule | Source |
|---|---|---|
| 1 | Hook in the first 1 to 2 s: the story or the tension, never a label/title card alone | §2a.1 |
| 2 | Story arc 15 to 30 s; over 30 s needs a written reason in the brief (data countdowns up to ~35 s; bend-busiest 39.45 s was a one-off ruling) | §2a.2, C11 |
| 3 | Real footage or photos in the piece; code maps/numbers sit on or between it | §2a.3 |
| 4 | 1 or 2 hero numbers (Matt's direct ask can override per piece, logged) | §2a.4, LEARNINGS 10-08 Redmond |
| 5 | Readable with the sound off | §2a.5 |
| 6 | Loopable ending back into frame 0 | §2a.6 |
| 7 | Locked end card: cream, real logo top, Quality/Local/Service ~1 s, "Call now 541.703.3095", no URL | §1 |
| 8 | Calm pacing: every beat and number holds >= 2.5 s, max one move per bar, slow eased camera, no montages/strobes | §2b |
| 9 | Everything animated, no sentences, ~4 words of label max | §2 |
| 10 | 1080x1920, 30 fps; critical text out of bottom 280 px and right 120 px (x <= 960, y <= 1640) | §2, motion-stats-craft |
| 11 | Copy: banned words, no "top team", no em/en dashes, no addresses, no buyer/seller names, describe homes not people | §3 |
| 12 | Every number from real data with definition, window, geography, property type, and an on-screen footer | §3 |
| 13 | Music: silent export, Matt adds the song in the IG picker, we give the start time, cue JSON, lyric check | §4 |
| 14 | Navy #102742 + cream #faf8f4 only (dated accent exceptions only when Matt asks); Amboqia display; logo only on end card | §6 |
| 15 | MLS photos never restyled (camera motion only); Imagine never draws numbers/words/maps/logos; Imagine via web UI on Matt's subscription | §6 |
| 16 | Watched start to finish with audio by Creative Desk before Matt; HOLD, Matt posts himself | §5, §8 |

Sequence for every type: **hook -> intro -> body -> payoff -> end card** (intro may merge into the hook when the hook already sets the place). The timeline's beats carry these roles.

---

## 1. Listing video (`listing`)
- **Hook:** the home's one standout fact (setting, view, a number), not "Just listed". 1 to 2 s.
- **Length:** 15 to 30 s.
- **Required:** only homes Ryan Realty lists, or photos whose license covers social reuse (§2a closings rule applied to listings). Every exterior/view photo checked at full size for house numbers (LEARNINGS 10-08). Slow Ken Burns, photo holds >= 2.5 s (§2b). 1 to 2 numbers (e.g. price, beds or sqft).
- **Sequence:** hook (standout) -> intro (area, not address) -> body (2 to 4 rooms/views, one per beat) -> payoff (price or one number) -> end card.
- **Captions/compliance:** no address on screen or in caption file names; no seller names; describe the home, not who it suits (fair housing).
- **PROPOSED:** street name allowed in Matt's own caption for active listings (needs Matt; today §3 says no addresses).

## 2. Market update / data Reel (`market_update`)
- **Hook:** the one tension in the data (e.g. "CUT YOUR PRICE? 71 DAYS"); B_brief v2 is the reference (LEARNINGS 10-08 9:35 PM).
- **Length:** 15 to 30 s; data countdowns up to ~35 s with a written reason.
- **Required:** 1 to 2 hero numbers, each with SQL + snapshot, exact window dates, footer line. Stats on ranked beats must agree with the ranking (LEARNINGS v6.2). Count-ups never roll through superseded values. Real footage or map on real place stills under the numbers. Tag enters and exits with its number.
- **Sequence:** hook (tension number) -> intro (place) -> body (context, one idea per beat) -> payoff (second number or the turn) -> end card.
- **Music:** biggest moment (#1 / hero number) on the drop.

## 3. News / civic (`news_civic`)
- **Hook:** the decision itself (what changed, where), neutral.
- **Length:** 15 to 30 s.
- **Required:** public meeting video allowed (§7); caption timestamps scrubbed +/-10 s; sources (meeting, date, clip id, document links) in the brief. Faces and nameplates checked at full res, blurred if needed (LEARNINGS Caldera).
- **Compliance:** report the decision only. No cheering, no resident testimony, no councilor faces as endorsements (§7).
- **Sequence:** hook (decision) -> intro (body/meeting, date) -> body (what it means, 1 number) -> payoff (next step/date) -> end card.

## 4. Closing (`closing`)
- **Hook:** the story of the deal (e.g. "2 DAYS / TO AN OFFER"), never "price + closed".
- **Length:** 15 to 30 s. **Never** a 3-second price + closed clip (§2a closings).
- **Required:** only homes Ryan Realty listed or sold. Listing photos only when Ryan was the listing side or the license covers social reuse; buyer-side deals use no listing-brokerage photos. House-number check on every exterior. Say "TO AN OFFER", never "DOM" unless the field truly is DOM; exact window dates.
- **Compliance:** no address, no buyer or seller names.

## 5. Neighborhood spotlight (`neighborhood_spotlight`)
- **Hook:** what makes this place itself (one real fact or number), not "Welcome to X".
- **Length:** 15 to 30 s.
- **Required:** real place footage or stills (Matt's phone, rights-clear photos, Imagine plates of the place type, never drawing maps or words). District/subdivision map allowed (Matt loves it, §2). Correct unit noun (neighborhood vs subdivision). Polygon counting rule stated in footer when ranking (LEARNINGS 10-08).
- **Compliance:** describe the place, never who should live there.

## 6. Buyer ad, Meta Housing category (`buyer_ad`)
- **Hook:** the first line picks the buyer by need (price band, area, lifestyle fact), because Housing ads cannot target by age, gender or ZIP. Housing Special Ad Category: age fixed 18 to 65+, all genders, no ZIP/postcode targeting, location minimum 15-mile radius, no lookalikes (secondary source quoting Meta, https://leadsync.me/blog/special-ad-category-meta/ , checked 2026-10-13; research round 2 #8).
- **Length:** 15 to 30 s (core recipe). **PROPOSED:** 6 to 15 s cutdowns for ad variants.
- **Required:** brief declares `persona` (relocator, first_time, move_up, second_home) as a creative label only, never a targeting field. Hook text in the 900x1500 safe zone within 1.5 s (round 2 buyer matrix). Numbers sourced like any data Reel; "buyer's market" wording only if months of supply >= 6 for that geography (buyer plan, 2026-10-13: say "buyers have leverage" for Bend at ~3 months). Destination = landing page or lead form with the creative id passed to CRM.
- **Compliance:** fair housing copy: no words describing who should live there (families, singles, age, religion, etc.); describe homes and places. Brief must state `special_ad_category: "housing"`.
- **Music:** ads may need licensed audio rather than the IG picker. **PROPOSED:** Matt picks: Meta Sound Collection track vs silent with captions.
- **PROPOSED:** 4:5 and 1:1 cuts from the same timeline for feed placements (Grok Imagine resize on brand plates only, never MLS).

## 7. Story / brand film (`brand_film`)
- **Hook:** first frame carries the story (imagine-video-craft `story_film`).
- **Length:** owned cut 45 to 90 s per imagine-video-craft; social cutdowns follow the core 15 to 30 s. Long cut must carry `length_reason` in the brief.
- **Required:** Imagine web UI only; human face gate; brand register (Shibuya calm, no corny). Silent picture default unless Matt asks for a bed. Real logo only on end card.
- **Sequence:** hook -> micro-conflict -> deadpan payoff -> end card.

## 8. Story / teaser loop (`story_teaser`)
- **Hook:** first frame, under 1.5 s.
- **Length:** 7 to 15 s (`reach_fast`, RULEBOOK C3 ruling: only for loops/teasers).
- **Required:** seamless loop (first frame = last frame), one number max. **PROPOSED:** Stories may skip the full end card and use a 1 s logo + phone sting (today §1 says every clip ends on the locked card, so the gate requires it).
- **Format:** 1080x1920; IG Stories UI covers top and bottom about 250 px. **PROPOSED** safe area for Stories (y 250 to 1670) pending a dated Meta source.

---
## Other PROPOSED items (need Matt's yes)
- P1. Listing street name in caption (card 1).
- P2. Buyer ad 6 to 15 s cutdowns (card 6).
- P3. Buyer ad audio: Meta Sound Collection vs silent (card 6).
- P4. Buyer ad 4:5 / 1:1 cuts (card 6).
- P5. Stories short sting instead of the full end card (card 8).
- P6. Stories safe area y 250 to 1670 (card 8).
