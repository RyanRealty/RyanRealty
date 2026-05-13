---
name: listing-tour-video
description: Use this skill whenever the user says "create a listing video for this address", "make a listing tour", "produce a property video for [address]", "MLS video for [ListingKey]", "coming-soon video for this listing", "property showcase video", "re-render the listing video with new photos", or "generate both MLS and branded cuts". For short 40-48s viral social reels use listing_reveal instead. Produce a fully automated 60-90s branded listing tour video from a single MLS ListingKey, with ElevenLabs VO, Google 3D aerial establishing shot, Wan 2.7 i2v animated hero photos, and Remotion render.
---

# Listing Tour Video Skill — Ryan Realty

## Required references — load these BEFORE producing any content

Two canonical rule layers are non-negotiable inheritance for every Ryan Realty piece. CLAUDE.md "Skill self-binding (2026-05-13)" makes this mandatory.

1. **[`design_system/ryan-realty/SKILL.md`](../../design_system/ryan-realty/SKILL.md)** — visual brand spec. Colors (navy `#102742`, cream `#faf8f4`, sand `#e8e2d4`), three type families (Amboqia Boriango display, Geist sans body/UI, Azo Sans Medium accent), heritage + modern register, mascot Jax, voice rules, banned vocab, the asset cheat sheet, the broker headshots (transparent PNGs).

2. **[`social_media_skills/platform-best-practices/SKILL.md`](../../social_media_skills/platform-best-practices/SKILL.md)** — 2026 platform rule layer. The cross-platform decision matrix (logo when, agent face when, aspect, length, hook, captions, posting cadence) + the Ryan Realty application matrix (per-surface decisions). Synthesized from research on 30+ top real estate creators.

A piece of content that ships without consulting BOTH of these is non-compliant.

---

## HARD RULES (locked 2026-05-13 after the Tumalo render failure)

These are non-negotiable. A listing video that violates any of these does not ship.

1. **No black text cards interrupting photo flow.** Photos run continuously — captions overlay the photo, they do not replace it. The video must NEVER show a frame that is text-on-black-or-navy except the final 2-3s end card. If you're rendering a beat where the VO says "Three bedrooms" — show the bedroom photo with "Three bedrooms" overlay. Don't cut to a black card.

2. **No dollar amounts spoken in VO.** Price is visual data only — show it on screen, never say it. ("Listed at one million two hundred twenty-five thousand" is banned in voiceover. The number can appear in an on-screen pill / end-card stat strip.)

3. **`eleven_turbo_v2_5` model — never `eleven_v3` for listing videos.** IPA phoneme tags are silently SKIPPED on v3. Tumalo must pronounce as TUM-uh-low (`ˈtʌm.ə.loʊ`), Deschutes as duh-shoots (`dəˈʃuːts`) — only turbo_v2_5 honors the phoneme tags.

4. **Opening hook frame (frames 0-30 = first 1s):** First frame is a photo (NOT logo, NOT text-only card) — already in motion at frame 0 (slow push-in / pan engaged). On-screen text overlay appears by frame 12-18 (0.4-0.6s) with the *hook* — neighborhood + key differentiator. For Tumalo example: "Tumalo, OR · Cascade views · 2.28 acres" Geist 500 cream pill bottom-third, NOT just the address. The opening tile is the social-feed thumbnail — it must read at 90×160 thumbnail size and make people stop scrolling.

5. **Motion variety — at least 4 different motion types per 30s video.** Acceptable primitives:
   - Slow push-in (Ken Burns subset, OK in moderation)
   - Slow pull-out
   - Slow pan (horizontal or vertical)
   - Multi-point pan
   - Parallax (foreground + background separation)
   - Hard cut on the beat
   - Cross-dissolve transition (200-400ms)
   - Whip pan transition
   - Cinemagraph (subtle motion on still: smoke, water, leaves)
   
   **Never repeat the same primitive on two consecutive beats.** A video that's all Ken Burns is rejected.

6. **Photo variety across beats — never two consecutive same-register beats.** Mix: aerial → interior → grounds → aerial → exterior → detail → aerial. Visual register changes every beat. No 3 aerial-dusks in a row.

7. **Captions: smooth, not choppy.**
   - Full sentence visible at all times (NEVER word-by-word fade-in)
   - Active-word highlight via weight transition only (500 → 700), NO scale spring (the 1.0→1.08 spring is what made the Tumalo video chop)
   - 300ms crossfade between sentences (NOT hard cut, NOT swap-on-frame)
   - White Geist 500 with subtle `text-shadow: 0 2px 4px rgba(0,0,0,0.6)` — never on a navy/colored pill, never with a colored background
   - Forced-alignment from ElevenLabs `/v1/forced-alignment` JSON — synced to actual spoken word timestamps, never to a generic clock

8. **Music — every video gets a UNIQUE track. Never reuse a clip across videos.** Maintain a per-render music manifest at `out/list-kits/<slug>/music-manifest.json` recording the source + clip ID used. If a track has been used in a prior render in the same season, source a different one. Acceptable sources in priority order:
   1. ElevenLabs Music API (`/v1/music/compose`) — generate unique track per video, parameterize by mood + tempo + duration
   2. Mixkit royalty-free library (https://mixkit.co/free-stock-music/) — curated, varied, downloadable, license-free
   3. Pixabay Music (https://pixabay.com/music/) — same, broader catalog
   
   **Banned (over-reused):** `audio/music_bed_v5.mp3` and any other track ending in `_v[1-9].mp3` that's been used >1 time. Check the music manifest before picking a track.

9. **End card has design treatment — not plain navy + logo.** Acceptable end-card patterns:
   - Property photo + dark scrim + stacked navy logo + address callout
   - Cascade silhouette / heritage illustration backdrop + stacked navy logo + address
   - Three-Sisters dusk aerial under-exposed + cream logo overlay + address
   
   **Banned:** solid navy bg + stacked logo + address line. That's the default and reads as boilerplate.

10. **Self-QA gate (mandatory).** After rendering, the producer (you, the agent) extracts 8-12 keyframes via `ffmpeg -vf 'select=...,scale=405:720'` and reviews them. If ANY of the following are visible, the video does not ship:
    - Black frame with text only (rule #1)
    - Same photo or visual register in 3 consecutive frames (rule #6)
    - No on-screen text in the first 30 frames (rule #4)
    - Plain end card (rule #9)
    
    Document the QA pass in the scorecard.json `qc_keyframes_reviewed: [paths]`.

---

**QC / anti-slideshow (mandatory in Cursor):** Use the project skill **`listing-tour-reel-qc`** (`.cursor/skills/listing-tour-reel-qc/SKILL.md`) after every render: run `node scripts/listing-tour-qc-render.mjs <mp4>` and **Read** the extracted PNGs. Do not sign off on “motion” without that pass.

**Scope:** Produce a fully automated 60–90s listing tour video from a single MLS `ListingKey`. Pulls listing data and photos from Supabase `ryan-realty-platform`, generates narration via ElevenLabs (Matt's voice clone), optionally opens with a Google Photorealistic 3D Tiles aerial establishing shot, animates hero photos via Replicate Wan 2.7 i2v, and renders + compresses in Remotion. Outputs two MP4s from one composition flag: branded (Ryan Realty logo, Matt's name, phone) and MLS-compliant unbranded (MLS number, "Contact your agent" card only).

**Status:** Stack fully keyed and tested as of 2026-04-21. Remotion 4.0.290, `@remotion/three`, `@react-three/fiber`, Three.js 0.171.0 verified in repo. Supabase (587k listings, 3.8M listing_history rows), ElevenLabs, Replicate, ffmpeg, and Resend all confirmed live.

**Use this skill whenever** the task is:
- "Create a listing video for this address" (resolve address -> `ListingKey` first)
- Producing a tour video for an active or sold listing by `ListingKey`
- Re-rendering an existing tour (price change, new photos, aspect ratio variant)
- Generating both the MLS-compliant and branded cut from one run

**Do NOT use this skill for:**
- Short 40-48s viral listing reels with 16-beat social format → use `listing_reveal`
- Neighborhood overview videos without a specific listing → use `neighborhood-overview` skill
- Market statistics reels (no specific property) → use `market-data-video` skill
- Development/new-construction showcase without an MLS key → use `development-showcase` skill
- Lifestyle/community content with no listing anchor → use `lifestyle-community` skill

---

## 1. Preconditions

Confirm every item before proceeding. Missing any one of these will fail the render mid-pipeline.

**1.1 — Environment variables.** All must be present in `/Users/matthewryan/RyanRealty/.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://[ref].supabase.co
SUPABASE_SERVICE_ROLE_KEY=...            # service role — bypasses RLS for listing pull
ELEVENLABS_API_KEY=...                   # Matt's voice clone key
ELEVENLABS_VOICE_ID=qSeXEcewz7tA0Q0qk9fH # Victoria — locked permanent 2026-04-27. Never substitute.
REPLICATE_API_TOKEN=...                  # Wan 2.7 i2v
OPENAI_API_KEY=...                       # narration script drafting
RESEND_API_KEY=...                       # delivery email to matt@ryan-realty.com
GOOGLE_MAPS_API_KEY=...                  # 3D Tiles + Maps Static API
```

Verify the six keys are non-empty before running:
```bash
grep -E "ELEVENLABS|REPLICATE|OPENAI|RESEND|GOOGLE_MAPS|SUPABASE_SERVICE" \
  /Users/matthewryan/RyanRealty/.env.local | \
  awk -F= '{print $1, (length($2)>0 ? "OK" : "MISSING")}'
```

**1.2 — Font files.** Both fonts must exist at the public path Remotion's `staticFile()` resolves to:

```
/Users/matthewryan/RyanRealty/public/fonts/Amboqia_Boriango.otf
/Users/matthewryan/RyanRealty/public/fonts/AzoSans-Medium.ttf
```

**1.3 — ffmpeg.** `ffmpeg -version` must return 4.x+. Used for compression and concat.

**1.4 — Node + Remotion.** `npx remotion --version` must return 4.0.290. Run from `/Users/matthewryan/RyanRealty/`.

**1.5 — 3D Tiles API key.** The same `GOOGLE_MAPS_API_KEY` covers Photorealistic 3D Tiles. Confirm the key has both `Map Tiles API` and `Maps JavaScript API` enabled in Google Cloud Console. If the key lacks those permissions, Act 1 is skipped automatically (see section 5).

---

## 2. Inputs

| Parameter | Type | Required | Default | Notes |
|---|---|---|---|---|
| `listingKey` | string | YES | — | MLS `ListingKey` from Supabase `listings` table |
| `heroPhotoOverride` | string | no | — | Full URL; replaces photo at `Order=0` if provided |
| `narrationScriptOverride` | string | no | — | Bypasses LLM draft + voice generation; must be pre-verified copy |
| `musicTrack` | string | no | `"ambient-warm"` | Filename (without extension) from `public/music/`. No auto-generation. |
| `branded` | boolean | no | `true` | `false` = MLS-compliant unbranded cut; skips Act 1, replaces closing card |
| `aspectRatio` | `"16:9"` \| `"9:16"` | no | **`"9:16"`** (implemented default) | Repo `video/listing-tour` renders **1080×1920** for Reels/TikTok. Optional 16:9 MLS web variant would be a second composition if needed later. |
| `durationTarget` | `60` \| `75` \| `90` | no | `90` | Seconds. Adjusts frame budgets proportionally. See section 5. |

Invoke example (API route or CLI):
```ts
await runListingTourVideo({
  listingKey: "20261104-ORMLS-1234567",
  branded: true,
  aspectRatio: "9:16",
  durationTarget: 90,
});
```

---

## 3. Data Pull — Supabase Queries

Run all three queries before touching the composition. Print the row counts and raw values. No number enters the render without a printed trace.

**3.1 — Listing row**

```sql
SELECT
  "ListingKey",
  "ListingId",
  "StreetNumber",
  "StreetName",
  "StreetSuffix",
  "City",
  "StateOrProvince",
  "PostalCode",
  "ListPrice",
  "BedroomsTotal",
  "BathroomsTotalInteger",
  "LivingArea",
  "LotSizeAcres",
  "YearBuilt",
  "SubdivisionName",
  "PublicRemarks",
  "Latitude",
  "Longitude",
  "PropertyType",
  "StandardStatus",
  "ClosePrice",      -- populated 2026-only; see gotcha #9
  "CloseDate"
FROM listings
WHERE "ListingKey" = '[INPUT_LISTING_KEY]'
  AND "PropertyType" = 'A';   -- SFR only; see gotcha #10

-- PRINT: row count must be exactly 1.
-- If 0: PropertyType may not be 'A'. Re-run without the PropertyType filter,
--       print what PropertyType returned, and confirm with Matt before proceeding.
```

**3.2 — Listing photos**

```sql
SELECT
  "MediaKey",
  "MediaURL",
  "Order",
  "ShortDescription",
  "MediaCategory"
FROM listing_media        -- table name; confirm exact name in schema if query fails
WHERE "ListingKey" = '[INPUT_LISTING_KEY]'
ORDER BY "Order" ASC;

-- PRINT: row count. A listing with <4 photos cannot produce a full tour.
-- Minimum usable: 6 photos. Ideal: 12-18.
-- If <6: halt, email Matt: "ListingKey [X] has only N photos — minimum 6 required."
```

If `listing_media` does not exist as a standalone table, photos may be denormalized onto the `listings` row as a JSON array column. Check:
```sql
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'listings'
  AND column_name ILIKE '%media%' OR column_name ILIKE '%photo%';
```

**3.3 — Neighborhood comp stats (ZIP-level, SFR)**

These numbers appear in Act 4. They must trace to this query — no hard-coded values.

```sql
SELECT
  COUNT(*)                                    AS total_closed,
  ROUND(AVG("DaysOnMarket"))                  AS avg_dom,
  PERCENTILE_CONT(0.5) WITHIN GROUP
    (ORDER BY "ListPrice" / NULLIF("LivingArea", 0))
                                              AS median_price_per_sqft,
  PERCENTILE_CONT(0.5) WITHIN GROUP
    (ORDER BY "ListPrice")                    AS median_list_price
FROM listings
WHERE "PropertyType" = 'A'
  AND "PostalCode"   = '[LISTING_ZIP]'
  AND "StandardStatus" IN ('Closed', 'Sold')
  AND "CloseDate" >= CURRENT_DATE - INTERVAL '90 days';

-- PRINT: total_closed, avg_dom, median_price_per_sqft, median_list_price.
-- If total_closed < 5: widen to 180 days; print new row count.
-- If total_closed still < 5 after 180 days: drop the neighborhood stat layer
-- from Act 4 entirely. Do not estimate.
-- ClosePrice data gap: pre-2026 CloseDate rows have NULL ClosePrice.
-- This query uses ListPrice as a proxy for active/pending, which is fine for
-- context stats (not a sale-price claim). If you need median ClosePrice,
-- filter CloseDate >= '2026-01-01' to avoid NULL contamination.
```

**Verification trace template** (fill before render):
```
ListingKey [X] — listings table, PropertyType='A', 1 row returned.
Photos: N rows from listing_media WHERE ListingKey='[X]', ordered by Order ASC.
ZIP comp stats: [ZIP], PropertyType='A', Closed/Sold, CloseDate >= [DATE],
  N rows → avg_dom=[D], median_price_per_sqft=[$X], median_list_price=[$Y].
```

---

## 4. Scene Architecture

Base: 90s @ 30fps = 2700 frames. For 75s: multiply budgets by 0.833. For 60s: multiply by 0.667.

```
Act 1:  frames 0–119     (0–4s)    — 3D Tiles aerial establishing shot
Act 2:  frames 120–419   (4–14s)   — Hero exterior + price/beds/baths/sqft overlay + voice
Act 3:  frames 420–1799  (14–60s)  — 8–12 interior photos, Ken Burns + selective i2v
Act 4:  frames 1800–2249 (60–75s)  — Exterior/lifestyle frames + neighborhood data layer
Act 5:  frames 2250–2699 (75–90s)  — CTA voice + closing card
```

**Act 1 — 3D Tiles aerial (branded only, 120 frames)**
- Skip entirely on `branded=false`. MLS does not permit Google promotional video in unbranded cuts, and the Google Photorealistic 3D Tiles promotional video cap is 30s per session — the full tour exceeds that if Act 1 is included in the unbranded file.
- Camera starts at ~500m altitude directly above `[Latitude, Longitude]` from the listing row, dolly-push to ~80m altitude over 4s.
- Google Maps attribution must be rendered in-frame (bottom-left, white, 12px AzoSans) on every frame of Act 1. This is a Google ToS requirement, not optional.
- Bend 3D Tiles vintage is ~2022–23 (see gotcha #1). For listings in post-2023 developments, verify the parcel renders as a completed structure before using. If it appears as dirt or missing: skip Act 1, begin at Act 2.

**Act 2 — Hero exterior (300 frames)**
- Hero photo = `Order=0` from the photo query (or `heroPhotoOverride`).
- Submit hero to Replicate Wan 2.7 i2v with a slow outward dolly prompt. Cache result by `ListingKey + MediaKey`. See section 7 for i2v call pattern.
- If i2v fails or returns in >90s: fall back to Ken Burns (slow zoom 1.0→1.08 over 300 frames).
- Animated stats overlay fades in at frame 150 (0.5s after act start):
  - Price: `$[ListPrice formatted with commas]`
  - Beds / Baths: `[BedroomsTotal] BD · [BathroomsTotalInteger] BA`
  - Square feet: `[LivingArea] SF`
  - Year built: `Built [YearBuilt]` (omit if null)
- Voice line over frames 150–420: "Welcome to [StreetNumber] [StreetName]. Here's what makes it home."

**Act 3 — Interior walk (1380 frames, ~46s)**
- Assign photos `Order=1` through `Order=N` (up to 12 photos). Skip `Order=0` (already used).
- Frame budget per photo at 90s target: `1380 / photo_count` (floor, with remainder added to last photo). Each photo gets 4–6s.
- Ken Burns on all photos. Select 2–3 for i2v (kitchen, primary suite, and the best view or outdoor shot). i2v prompts for interiors: slow horizontal track, no rotation.
- Voice covers each space in sequence. Narration is generated once (section 6) and sliced to match photo timing.

**Act 4 — Exterior + neighborhood stats (450 frames)**
- Pull `Order=N+1` onward for yard/deck/view shots. Use remaining photos.
- Neighborhood data layer (bottom third, fades in at frame 1900):
  - `Avg. Days on Market: [avg_dom]` — from comp query
  - `Median $/sqft in [PostalCode]: $[median_price_per_sqft]`
  - Only render this layer if comp query returned ≥ 5 rows.

**Act 5 — Closing card (450 frames)**
- Branded: solid navy `#102742` background + white Ryan Realty logo + `541.213.6706`. This card is locked per `feedback_market_report_closing_standard.md`. No gradient, no glow, no additional CTA text. Voice: "I'm Matt Ryan with Ryan Realty. Give me a call — I'd love to walk you through it."
- Unbranded: solid navy background + MLS listing number + "Contact your agent for a showing." No logo, no name, no phone. Voice: "Ask your agent about [StreetNumber] [StreetName] — MLS [ListingId]."

---

## 5. Remotion Composition Scaffold

**Implemented in repo:** `video/listing-tour/` (Remotion project + `scripts/prepare-tour.ts`). First run `npm run video:listing-tour:setup` (or rely on `prepare`, which re-runs `scripts/sync-listing-tour-assets.mjs`). Then `npm run video:listing-tour:prepare` → `npm run video:listing-tour:render` from the monorepo root.

File location (legacy spec reference): `src/video/listing-tour/ListingTour.tsx`

```tsx
import React from 'react';
import {
  Composition,
  AbsoluteFill,
  Sequence,
  Audio,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Easing,
  staticFile,
} from 'remotion';
import { ThreeCanvas } from '@remotion/three';
import { TilesRenderer } from '3d-tiles-renderer/r3f';
import { GoogleCloudAuthPlugin } from '3d-tiles-renderer/plugins';

// Font injection — MUST use CSS @font-face via DOM style tag,
// NOT the FontFace API. FontFace API blocks past delayRender timeout
// in long renders. Pattern from /work/jackstraw_video/src/fonts.ts.
import './fonts';

import { NAVY, GOLD, WHITE, FONT_SERIF, FONT_BODY } from './brand';

// ─── Types ───────────────────────────────────────────────────────────────────
export type ListingTourProps = {
  listing: ListingRow;
  photos: PhotoRow[];
  compStats: CompStats;
  voiceoverUrl: string;       // pre-generated ElevenLabs MP3, served from public/
  branded: boolean;
  tilesApiKey: string;
};

type ListingRow = {
  ListingKey: string;
  ListingId: string;
  StreetNumber: string;
  StreetName: string;
  StreetSuffix: string | null;
  City: string;
  PostalCode: string;
  ListPrice: number;
  BedroomsTotal: number;
  BathroomsTotalInteger: number;
  LivingArea: number;
  YearBuilt: number | null;
  Latitude: number;
  Longitude: number;
};

type PhotoRow = {
  MediaKey: string;
  MediaURL: string;
  Order: number;
  i2vUrl?: string;            // populated after Replicate returns
};

type CompStats = {
  avg_dom: number | null;
  median_price_per_sqft: number | null;
  total_closed: number;
};

// ─── Root registration ───────────────────────────────────────────────────────
export const ListingTourComposition: React.FC = () => (
  <Composition
    id="ListingTour"
    component={ListingTourVideo}
    durationInFrames={2700}   // 90s @ 30fps; override at CLI with --props
    fps={30}
    width={1920}
    height={1080}
    defaultProps={{} as ListingTourProps}
  />
);

// ─── Main composition ────────────────────────────────────────────────────────
const ListingTourVideo: React.FC<ListingTourProps> = ({
  listing,
  photos,
  compStats,
  voiceoverUrl,
  branded,
  tilesApiKey,
}) => {
  const { fps } = useVideoConfig();

  // Frame budgets
  const ACT1_END  = branded ? 120  : 0;
  const ACT2_END  = ACT1_END  + 300;
  const ACT3_END  = ACT2_END  + 1380;
  const ACT4_END  = ACT3_END  + 450;
  // ACT5: frames ACT4_END → 2700

  return (
    <AbsoluteFill style={{ backgroundColor: NAVY }}>
      {/* Global voiceover */}
      <Audio src={staticFile(voiceoverUrl)} />

      {/* Act 1: 3D Tiles aerial (branded only) */}
      {branded && (
        <Sequence from={0} durationInFrames={120}>
          <AerialScene
            lat={listing.Latitude}
            lng={listing.Longitude}
            tilesApiKey={tilesApiKey}
          />
        </Sequence>
      )}

      {/* Act 2: Hero exterior */}
      <Sequence from={ACT1_END} durationInFrames={300}>
        <HeroScene
          photo={photos[0]}
          listing={listing}
        />
      </Sequence>

      {/* Act 3: Interior walk */}
      <Sequence from={ACT2_END} durationInFrames={1380}>
        <InteriorWalk
          photos={photos.slice(1, 13)}
          totalFrames={1380}
        />
      </Sequence>

      {/* Act 4: Exterior + neighborhood stats */}
      <Sequence from={ACT3_END} durationInFrames={450}>
        <ExteriorStats
          photos={photos.slice(13)}
          compStats={compStats}
          postalCode={listing.PostalCode}
        />
      </Sequence>

      {/* Act 5: Closing card */}
      <Sequence from={ACT4_END} durationInFrames={450}>
        <ClosingCard
          branded={branded}
          listingId={listing.ListingId}
          streetAddress={`${listing.StreetNumber} ${listing.StreetName}${listing.StreetSuffix ? ' ' + listing.StreetSuffix : ''}`}
        />
      </Sequence>
    </AbsoluteFill>
  );
};

// ─── Ken Burns primitive ─────────────────────────────────────────────────────
// The canonical Ken Burns implementation: slow scale 1.0→1.08, subtle X
// translate to avoid static feeling. All interior photos use this unless
// replaced by an i2v clip.
const KenBurns: React.FC<{
  src: string;
  totalFrames: number;
  startScale?: number;
  endScale?: number;
}> = ({ src, totalFrames, startScale = 1.0, endScale = 1.08 }) => {
  const frame = useCurrentFrame();
  const scale = interpolate(frame, [0, totalFrames], [startScale, endScale], {
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.ease),
  });
  return (
    <AbsoluteFill>
      <img
        src={src}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: `scale(${scale})`,
          transformOrigin: 'center center',
        }}
      />
    </AbsoluteFill>
  );
};

// ─── i2v swap-in ─────────────────────────────────────────────────────────────
// When Replicate has returned a video URL for this photo, render the video.
// Otherwise fall back to KenBurns. Never block the render waiting for i2v.
const PhotoOrVideo: React.FC<{
  photo: PhotoRow;
  totalFrames: number;
}> = ({ photo, totalFrames }) => {
  if (photo.i2vUrl) {
    return (
      <AbsoluteFill>
        <video
          src={photo.i2vUrl}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          muted
          autoPlay
        />
      </AbsoluteFill>
    );
  }
  return <KenBurns src={photo.MediaURL} totalFrames={totalFrames} />;
};

// ─── Aerial scene (Act 1) ─────────────────────────────────────────────────────
// Uses 3d-tiles-renderer r3f path + GoogleCloudAuthPlugin.
// Google Maps attribution must appear in every frame — bottom-left, white text.
// Reference: https://github.com/NASA-AMMOS/3DTilesRendererJS
const AerialScene: React.FC<{
  lat: number;
  lng: number;
  tilesApiKey: string;
}> = ({ lat, lng, tilesApiKey }) => {
  const frame = useCurrentFrame();
  const altitude = interpolate(frame, [0, 120], [500, 80], {
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.ease),
  });

  return (
    <AbsoluteFill>
      <ThreeCanvas width={1920} height={1080} camera={{ fov: 38, near: 0.5, far: 5000 }}>
        <TilesRenderer
          url="https://tile.googleapis.com/v1/3dtiles/root.json"
          plugins={[new GoogleCloudAuthPlugin({ apiToken: tilesApiKey })]}
        />
        {/* Camera at [lng, lat, altitude] — implement as a useFrame hook */}
      </ThreeCanvas>

      {/* Google Maps attribution — ToS required, not optional */}
      <div style={{
        position: 'absolute',
        bottom: 16,
        left: 16,
        color: WHITE,
        fontFamily: FONT_BODY,
        fontSize: 12,
        opacity: 0.85,
      }}>
        Map data ©2025 Google
      </div>
    </AbsoluteFill>
  );
};

// ─── Hero scene (Act 2) ───────────────────────────────────────────────────────
const HeroScene: React.FC<{
  photo: PhotoRow;
  listing: ListingRow;
}> = ({ photo, listing }) => {
  const frame = useCurrentFrame();
  const overlayOpacity = interpolate(frame, [30, 60], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const formattedPrice = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(listing.ListPrice);

  return (
    <AbsoluteFill>
      <PhotoOrVideo photo={photo} totalFrames={300} />

      {/* Dark gradient scrim for text legibility */}
      <AbsoluteFill style={{
        background: 'linear-gradient(to top, rgba(0,0,0,0.65) 0%, transparent 55%)',
      }} />

      {/* Stats overlay */}
      <div style={{
        position: 'absolute',
        bottom: 80,
        left: 80,
        opacity: overlayOpacity,
        fontFamily: FONT_SERIF,
        color: WHITE,
      }}>
        <div style={{ fontSize: 64, fontWeight: 400, lineHeight: 1 }}>
          {formattedPrice}
        </div>
        <div style={{
          fontSize: 28,
          fontFamily: FONT_BODY,
          marginTop: 12,
          color: 'rgba(255,255,255,0.88)',
          letterSpacing: '0.06em',
        }}>
          {listing.BedroomsTotal} BD
          &nbsp;·&nbsp;
          {listing.BathroomsTotalInteger} BA
          &nbsp;·&nbsp;
          {listing.LivingArea.toLocaleString()} SF
          {listing.YearBuilt ? `  ·  Built ${listing.YearBuilt}` : ''}
        </div>
        <div style={{
          fontSize: 22,
          fontFamily: FONT_BODY,
          marginTop: 8,
          color: GOLD,
          letterSpacing: '0.04em',
        }}>
          {listing.StreetNumber} {listing.StreetName}
          {listing.StreetSuffix ? ' ' + listing.StreetSuffix : ''}
          , {listing.City}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ─── Interior walk (Act 3) ────────────────────────────────────────────────────
const InteriorWalk: React.FC<{
  photos: PhotoRow[];
  totalFrames: number;
}> = ({ photos, totalFrames }) => {
  const frame = useCurrentFrame();
  const framesPerPhoto = Math.floor(totalFrames / photos.length);

  const currentIndex = Math.min(
    Math.floor(frame / framesPerPhoto),
    photos.length - 1
  );
  const frameInPhoto = frame - currentIndex * framesPerPhoto;
  const photo = photos[currentIndex];

  return (
    <AbsoluteFill>
      <PhotoOrVideo
        key={photo.MediaKey}
        photo={photo}
        totalFrames={framesPerPhoto}
      />
    </AbsoluteFill>
  );
};

// ─── Exterior + neighborhood stats (Act 4) ────────────────────────────────────
const ExteriorStats: React.FC<{
  photos: PhotoRow[];
  compStats: CompStats;
  postalCode: string;
}> = ({ photos, compStats, postalCode }) => {
  const frame = useCurrentFrame();
  const showStats = compStats.total_closed >= 5;
  const statsOpacity = interpolate(frame, [100, 130], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const hero = photos[0] ?? null;

  return (
    <AbsoluteFill>
      {hero && (
        <KenBurns src={hero.MediaURL} totalFrames={450} startScale={1.0} endScale={1.05} />
      )}

      {showStats && (
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          padding: '28px 80px',
          background: `rgba(16,39,66,0.82)`,
          display: 'flex',
          gap: 60,
          opacity: statsOpacity,
          fontFamily: FONT_BODY,
          color: WHITE,
        }}>
          {compStats.avg_dom !== null && (
            <StatPill label="Avg. Days on Market" value={String(compStats.avg_dom)} />
          )}
          {compStats.median_price_per_sqft !== null && (
            <StatPill
              label={`Median $/sqft in ${postalCode}`}
              value={`$${Math.round(compStats.median_price_per_sqft)}`}
            />
          )}
        </div>
      )}
    </AbsoluteFill>
  );
};

const StatPill: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
    <div style={{ fontSize: 14, opacity: 0.7, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
      {label}
    </div>
    <div style={{ fontSize: 36, fontFamily: FONT_SERIF, color: GOLD }}>
      {value}
    </div>
  </div>
);

// ─── Closing card (Act 5) ─────────────────────────────────────────────────────
// LOCKED: solid navy + white logo + 541.213.6706.
// See memory: feedback_market_report_closing_standard.md.
// No gradient, no glow, no extra CTA.
const ClosingCard: React.FC<{
  branded: boolean;
  listingId: string;
  streetAddress: string;
}> = ({ branded, listingId, streetAddress }) => (
  <AbsoluteFill style={{
    backgroundColor: NAVY,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
  }}>
    {branded ? (
      <>
        <img
          src={staticFile('ryan-realty-logo-white.png')}
          style={{ width: 320, objectFit: 'contain' }}
        />
        <div style={{
          fontFamily: FONT_BODY,
          color: WHITE,
          fontSize: 32,
          letterSpacing: '0.08em',
        }}>
          541.213.6706
        </div>
        <div style={{
          fontFamily: FONT_BODY,
          color: 'rgba(255,255,255,0.55)',
          fontSize: 18,
        }}>
          ryan-realty.com
        </div>
      </>
    ) : (
      <>
        <div style={{ fontFamily: FONT_BODY, color: WHITE, fontSize: 22, opacity: 0.7 }}>
          MLS #{listingId}
        </div>
        <div style={{ fontFamily: FONT_SERIF, color: WHITE, fontSize: 36, textAlign: 'center' }}>
          Contact your agent for a showing.
        </div>
        <div style={{ fontFamily: FONT_BODY, color: 'rgba(255,255,255,0.5)', fontSize: 16 }}>
          {streetAddress}
        </div>
      </>
    )}
  </AbsoluteFill>
);
```

Font loader (copy this pattern exactly — do NOT use `FontFace` API):

```ts
// src/video/listing-tour/fonts.ts
// Pattern from /work/jackstraw_video/src/fonts.ts — verified working.
import { staticFile } from 'remotion';

const inject = (family: string, url: string, weight = '400') => {
  if (typeof document === 'undefined') return;
  const id = `ff-${family.replace(/\s+/g, '-')}`;
  if (document.getElementById(id)) return;
  const s = document.createElement('style');
  s.id = id;
  s.textContent = `@font-face {
    font-family: '${family}';
    src: url('${url}') format('opentype'), url('${url}') format('truetype');
    font-weight: ${weight};
    font-display: block;
  }`;
  document.head.appendChild(s);
};

inject('Amboqia Boriango', staticFile('fonts/Amboqia_Boriango.otf'));
inject('Azo Sans', staticFile('fonts/AzoSans-Medium.ttf'), '500');
```

---

## 6. Voice Generation

**6.1 — Draft the narration (LLM call)**

Narration is drafted via OpenAI API (model `gpt-4o`) with a strict prompt. Branding rule: authentic, genuine, service-oriented, historic Bend. No em dashes. No hyphens in prose. Never state the obvious about the reader. No salesy language. The draft is a plain script only — no stage directions, no asterisks, no parentheticals.

```python
import openai, os

def draft_narration(listing: dict, photos: list[dict]) -> str:
    rooms = [p.get("ShortDescription", "") for p in photos if p.get("ShortDescription")]
    rooms_str = ", ".join(r for r in rooms[:10] if r)

    prompt = f"""You are writing a 60-word voiceover script for a listing tour video.
The broker is Matt Ryan, Ryan Realty, Bend Oregon.
Listing: {listing['StreetNumber']} {listing['StreetName']}, {listing['City']} —
  {listing['BedroomsTotal']} beds, {listing['BathroomsTotalInteger']} baths,
  {listing['LivingArea']} sq ft, listed at ${listing['ListPrice']:,.0f}.
Photo sequence covers: {rooms_str}.
Public remarks excerpt: {str(listing.get('PublicRemarks', ''))[:300]}

Rules:
- Open with: "Welcome to [address]. Here's what makes it home."
- Describe 3-4 key spaces in order.
- Close (branded): "I'm Matt Ryan with Ryan Realty. Give me a call."
- Close (unbranded): "Ask your agent about [address] — MLS [ListingId]."
- No em dashes. No hyphens in prose. No salesy language.
- Authentic voice. Never state the obvious about the viewer.
- Plain text only. No stage directions.
Return the script only. Target 65-70 words."""

    resp = openai.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.6,
    )
    return resp.choices[0].message.content.strip()
```

**6.2 — Generate audio via ElevenLabs**

Cache by `ListingKey` so re-renders skip the API call.

```python
import requests, hashlib, os

ELEVENLABS_API_KEY = os.environ["ELEVENLABS_API_KEY"]
VOICE_ID           = os.environ["ELEVENLABS_VOICE_ID"]
CACHE_DIR          = "/Users/matthewryan/RyanRealty/public/voiceovers/"

def generate_voiceover(listing_key: str, script: str) -> str:
    """
    Returns the relative public path to the MP3.
    If cached, skips ElevenLabs and returns existing path.
    """
    slug = hashlib.md5(listing_key.encode()).hexdigest()[:12]
    out_path = os.path.join(CACHE_DIR, f"{slug}.mp3")

    if os.path.exists(out_path):
        print(f"[voice] cache hit: {out_path}")
        return f"voiceovers/{slug}.mp3"

    url = f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE_ID}"
    headers = {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
    }
    body = {
        "text": script,
        "model_id": "eleven_turbo_v2_5",
        "voice_settings": {
            # Updated 2026-05-07 per Matt directive — conversational delivery; canonical source: video_production_skills/elevenlabs_voice/SKILL.md
            "stability": 0.40,
            "similarity_boost": 0.80,
            "style": 0.50,
            "use_speaker_boost": True,
        },
    }

    resp = requests.post(url, json=body, headers=headers, timeout=60)
    resp.raise_for_status()    # raises on 429, 401, 500

    os.makedirs(CACHE_DIR, exist_ok=True)
    with open(out_path, "wb") as f:
        f.write(resp.content)

    print(f"[voice] generated {len(resp.content)/1024:.1f} KB → {out_path}")
    return f"voiceovers/{slug}.mp3"
```

Expected response: binary MP3 audio, `Content-Type: audio/mpeg`. If you get JSON back, it is an error — print it before raising.

**6.3 — Wan 2.7 i2v for hero + 2-3 interior hero photos**

```python
import replicate, time, urllib.request

def run_i2v(image_url: str, prompt: str, listing_key: str, media_key: str) -> str | None:
    """
    Submits image to Wan 2.7 i2v. Returns local MP4 path or None on failure.
    Caches by listing_key + media_key to avoid re-generation.
    """
    cache_key = f"{listing_key}_{media_key}"
    slug = hashlib.md5(cache_key.encode()).hexdigest()[:12]
    out_path = f"/Users/matthewryan/RyanRealty/public/i2v/{slug}.mp4"

    if os.path.exists(out_path):
        return f"i2v/{slug}.mp4"

    try:
        output = replicate.run(
            "wavespeedai/wan-2.1-i2v-480p",   # confirm slug against Replicate dashboard
            input={
                "image":  image_url,
                "prompt": prompt,
                "num_frames": 81,
                "fps": 16,
                "motion_bucket_id": 80,
            },
            timeout=120,
        )
        url = output if isinstance(output, str) else output[0]
        os.makedirs(os.path.dirname(out_path), exist_ok=True)
        urllib.request.urlretrieve(url, out_path)
        return f"i2v/{slug}.mp4"
    except Exception as e:
        print(f"[i2v] FAILED for {media_key}: {e} — falling back to Ken Burns")
        return None
```

Prompt templates:

```
# Exterior hero
"Slow outward dolly from {StreetNumber} {StreetName} exterior, golden hour,
 cinematic, photorealistic, no camera shake"

# Kitchen
"Slow horizontal track through bright kitchen, natural light, photorealistic,
 no shake, no people"

# Primary suite
"Slow push into primary bedroom, morning light, soft shadows, photorealistic,
 no people"
```

---

## 7. Render + Compress + Deliver

**7.1 — Remotion render**

```bash
# From /Users/matthewryan/RyanRealty/
npx remotion render \
  src/video/listing-tour/index.ts \
  ListingTour \
  /tmp/listing_tour_${LISTING_KEY}_branded.mp4 \
  --props='{"branded":true,...}' \
  --concurrency=1 \  # concurrency=1 required per render_pipeline/SKILL.md — Chrome OOMs higher
  --log=verbose
```

Render both cuts in sequence:
```bash
# Branded
npx remotion render ... --props='{"branded":true}' -o /tmp/${SLUG}_branded_16x9.mp4

# Unbranded (skip Act 1 automatically via branded=false prop)
npx remotion render ... --props='{"branded":false}' -o /tmp/${SLUG}_unbranded_16x9.mp4
```

9:16 variant (IG Reels): pass `aspectRatio:"9:16"` and override `width=1080 height=1920` via a second `<Composition>` registration.

**7.2 — ffmpeg compress**

Target: <4 MB for IG upload. Web/MLS cut: <15 MB, no hard size limit.

```bash
# IG Reels target (<4 MB for 90s)
ffmpeg -i /tmp/${SLUG}_branded_16x9.mp4 \
  -vcodec libx264 -crf 26 -preset slow \
  -acodec aac -b:a 128k \
  -movflags +faststart \
  -vf scale=1920:1080 \
  /tmp/${SLUG}_branded_16x9_compressed.mp4

# Check file size
du -sh /tmp/${SLUG}_branded_16x9_compressed.mp4
# If >4 MB: bump CRF to 28, re-run. Do not go above CRF 30 — quality degrades visibly.

# Unbranded MLS cut (no size target; use CRF 22 for quality)
ffmpeg -i /tmp/${SLUG}_unbranded_16x9.mp4 \
  -vcodec libx264 -crf 22 -preset slow \
  -acodec aac -b:a 192k \
  -movflags +faststart \
  /tmp/${SLUG}_unbranded_16x9_compressed.mp4
```

**7.3 — Resend email to Matt**

```python
import resend, os

def deliver(listing: dict, branded_path: str, unbranded_path: str) -> None:
    address = f"{listing['StreetNumber']} {listing['StreetName']}, {listing['City']}"
    resend.api_key = os.environ["RESEND_API_KEY"]

    with open(branded_path, "rb") as f:
        branded_bytes = f.read()
    with open(unbranded_path, "rb") as f:
        unbranded_bytes = f.read()

    resend.Emails.send({
        "from":    "listings@ryan-realty.com",
        "to":      "matt@ryan-realty.com",
        "subject": f"Listing Tour Ready: {address} — MLS {listing['ListingId']}",
        "html":    f"""
          <p>Both cuts rendered and attached.</p>
          <p><strong>{address}</strong> · MLS {listing['ListingId']}</p>
          <p>Branded: {os.path.basename(branded_path)}<br>
             Unbranded: {os.path.basename(unbranded_path)}</p>
        """,
        "attachments": [
            {"filename": os.path.basename(branded_path),   "content": list(branded_bytes)},
            {"filename": os.path.basename(unbranded_path), "content": list(unbranded_bytes)},
        ],
    })
    print(f"[resend] delivered to matt@ryan-realty.com")
```

If attachments exceed Resend's 40 MB combined limit: upload to Supabase Storage and email links instead.

---

## 8. QA Gate

Run this before the Resend call. Any failure blocks delivery.

**8.1 — Data verification trace**

Print one line per stat that appears in the rendered video:

```
ListPrice: $[X] — listings table, ListingKey='[KEY]', 1 row, ListPrice=[X]
BedroomsTotal: [N] — same row
BathroomsTotalInteger: [N] — same row
LivingArea: [N] — same row
YearBuilt: [N] — same row (or OMITTED — field is null)
avg_dom: [N] — listings, PropertyType='A', PostalCode='[ZIP]',
              StandardStatus IN ('Closed','Sold'), CloseDate >= [DATE],
              [N] rows, AVG(DaysOnMarket)=[X]
median_price_per_sqft: $[X] — same query, PERCENTILE_CONT(0.5)=[X]
```

If any stat line cannot be completed with an actual query result: cut that stat from the video. Re-render. Do not ship with a question mark next to any number.

**8.2 — Banned punctuation grep**

```bash
# Check narration script file for banned characters
grep -n "—\|–\| - " /tmp/narration_${SLUG}.txt && echo "FAIL: em/en dash or prose hyphen found" || echo "OK"
```

**8.3 — Closing card lock check**

Verify the composition's `ClosingCard` component has no gradient, no glow, and no text other than logo, phone, and (for unbranded) MLS number. If anything was modified from the pattern in section 5, revert.

**8.4 — Google attribution check (branded Act 1 only)**

Confirm the `AerialScene` component renders `"Map data ©2025 Google"` text in every frame of Act 1. If Act 1 was skipped due to missing tiles, this check is N/A.

---

## 9. Output Artifacts

**File naming convention:**

```
{address-slug}_{mls-id}_{branded|unbranded}_{aspect}.mp4

Examples:
  456-sw-cedar-dr_20261104ORMLS1234567_branded_16x9.mp4
  456-sw-cedar-dr_20261104ORMLS1234567_unbranded_16x9.mp4
  456-sw-cedar-dr_20261104ORMLS1234567_branded_9x16.mp4
```

Address slug: lowercase, spaces and special chars replaced with `-`, no double dashes.

```python
import re

def address_slug(listing: dict) -> str:
    raw = f"{listing['StreetNumber']}-{listing['StreetName']}"
    if listing.get('StreetSuffix'):
        raw += f"-{listing['StreetSuffix']}"
    raw = raw.lower().replace(' ', '-')
    return re.sub(r'-+', '-', re.sub(r'[^a-z0-9-]', '', raw))
```

**Idempotency / Supabase cache key:**

Store render metadata in a `listing_tour_renders` table (create if not present):

```sql
CREATE TABLE IF NOT EXISTS listing_tour_renders (
  id              BIGSERIAL PRIMARY KEY,
  listing_key     TEXT NOT NULL,
  branded         BOOLEAN NOT NULL,
  aspect_ratio    TEXT NOT NULL,
  duration_target INTEGER NOT NULL,
  rendered_at     TIMESTAMPTZ DEFAULT NOW(),
  branded_url     TEXT,
  unbranded_url   TEXT,
  voiceover_path  TEXT,
  comp_stats_json JSONB,
  narration_text  TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS listing_tour_renders_uq
  ON listing_tour_renders (listing_key, branded, aspect_ratio, duration_target);
```

On each run: INSERT ... ON CONFLICT DO UPDATE. Check `rendered_at` — if a render exists and is less than 24h old with no input changes, return the cached paths.

---

## 10. Gotchas

| # | Gotcha | Wrong | Right |
|---|--------|-------|-------|
| 1 | Google 3D Tiles Bend vintage is 2022–23. Post-2023 listings (Jackstraw, new NWX phases, etc.) appear as construction dirt. | Trust that tiles show the completed home | Query `reference_google_tiles_bend_predates_jackstraw.md`, do a spot-check render of Act 1 before delivering |
| 2 | Google Photorealistic 3D Tiles promotional-video cap is 30 seconds per usage session | Include Act 1 in the unbranded MLS cut | Act 1 is branded only. Unbranded cut starts at Act 2 |
| 3 | Google Maps attribution is a ToS hard requirement in every 3D Tiles frame | Omit attribution to keep the frame clean | `"Map data ©2025 Google"` bottom-left, white, 12px, every Act 1 frame |
| 4 | Wan 2.7 i2v occasionally fails on images it classifies as containing copyrighted interior elements (furniture brands, art) | Retry in a loop | On any non-2xx or timeout: set `i2vUrl = null`, Ken Burns fires automatically |
| 5 | ElevenLabs rate limit is 2 concurrent requests on most plans | Fire multiple voice requests in parallel | Generate serially. If you get 429: back off 10s and retry once |
| 6 | Font loading via `FontFace` API blocks past the `delayRender` timeout in Remotion long renders | `new FontFace(...).load().then(...)` | CSS `@font-face` via DOM `<style>` injection — see fonts.ts pattern in section 5 |
| 7 | `ClosePrice` on the `listings` table is populated for 2026 rows only | Use `ClosePrice` for pre-2026 YoY comparisons | Pre-2026 price data requires `listing_history` table. See `reference_closeprice_data_gap.md` |
| 8 | `PropertyType='A'` is SFR. Listing tours run on any property type the agent uploads, but comp stats must filter `PropertyType='A'` for apples-to-apples SFR stats | Mix property types in comp query | Comp stats query always includes `AND "PropertyType" = 'A'`. See `reference_listings_property_types.md` |
| 9 | `listing_media` may not exist as a standalone table. Photos may be a JSON array column on `listings`. | Fail silently and produce a zero-photo render | Query `information_schema.columns` first; handle both shapes |
| 10 | Remotion renders 9:16 and 16:9 compositions separately. They cannot share a single `<Composition>` registration with different aspect ratios | Pass `width` / `height` as props to one composition | Register two separate `<Composition>` IDs: `ListingTour16x9` and `ListingTour9x16` |
| 11 | Resend attachment limit is 40 MB combined. A 90s uncompressed render can exceed this before ffmpeg | Attach raw Remotion output | Always run ffmpeg compress (section 7.2) before attaching. If still >40 MB: Supabase Storage + link |
| 12 | No viral-content visual rules apply here. `feedback_no_real_estate_visuals.md` explicitly scopes to viral-lane content only | Remove house photos from a listing tour video | Listing tours are house photos. That rule does not apply |

---

## 11. Invoke When / Do Not Invoke When

**Invoke when:**
- Input includes a specific MLS `ListingKey` and the task is a tour video for that property
- Re-render requested after price change, new photos uploaded, or aspect ratio change
- Agent needs both branded and unbranded cuts for a listing (single run handles both)

**Do not invoke when:**
- No specific `ListingKey` — general market video → `market-data-video`
- Subdivision or development showcase without a specific active listing → `development-showcase`
- Neighborhood walkability or lifestyle reel → `lifestyle-community`
- Aerial-only or 3D Tiles map animation with no listing anchor → `neighborhood-overview`

---

## 12. Broker headshots — closing card

Three normalized broker headshots live at `design_system/ryan-realty/assets/team/`:

- `matt-ryan.jpg` — Matt Ryan (owner / principal broker)
- `paul-stevenson.jpg` — Paul Stevenson
- `rebecca-peterson.jpg` — Rebecca Peterson

All 800×1200 px, pure white bg, identical head height, natural color. Specs in `design_system/ryan-realty/MANIFEST.md` §"assets/team/".

**Closing card rule (branded cut only):** The branded video closing card must include the listing agent's headshot alongside the Ryan Realty logo and contact info. Resolve `ListAgentFullName` from the Supabase `listings` row to the correct headshot path. The headshot renders as a circular crop (`border-radius: 50%`, `120 px` diameter) beside the stacked white logo. Unbranded MLS cut: no headshot, no agent name — logo + MLS number only. For brand-led videos with no specific listing (market reports, neighborhood guides), omit the headshot; use Jax from `assets/brand/blue-dog.png` if a personality element is needed.

---

## 13. See Also

- `development-showcase/SKILL.md` — new-construction development videos using 3D massing models when MLS listing photos are insufficient
- `neighborhood-overview/SKILL.md` — Google 3D Tiles + Supabase neighborhood boundary flyovers with market stat overlays, no specific listing required
- `market-data-video/SKILL.md` — Remotion market report reels driven entirely by Supabase aggregate queries (monthly/quarterly stats, absorption, DOM trends)
- `lifestyle-community/SKILL.md` — community and lifestyle reels (parks, trails, downtown Bend, events) for top-of-funnel social, no listing anchor
- `reference_ai_virtual_tour_workflow.md` — full i2v pipeline notes: Wan 2.7 model versioning, room sequence ordering, ffmpeg concat patterns
- `feedback_market_report_closing_standard.md` — locked closing card spec (solid navy, white logo, 541.213.6706)
- `reference_google_tiles_bend_predates_jackstraw.md` — Bend 3D Tiles vintage verification; which neighborhoods are safe to use in Act 1
- `reference_closeprice_data_gap.md` — ClosePrice NULL issue for pre-2026 rows
- `reference_listings_property_types.md` — PropertyType code table; always filter `'A'` for SFR comp stats
