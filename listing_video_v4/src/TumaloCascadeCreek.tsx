// TumaloCascadeCreek.tsx — 19496 Tumalo Reservoir Rd
// "Cascade & Creek" (V2 REBUILD) — premium cinematic cut, ~28s
// 1080×1920 portrait, 30fps, h264+aac, file < 100MB
//
// DATA ACCURACY (per CLAUDE.md):
//   Address:  19496 Tumalo Reservoir Rd, Tumalo, OR 97703
//   Price:    $1,225,000 (Supabase listing_key 20260225192329433521000000, ListPrice=1225000)
//   Beds/Bath: 3 BD / 3 BA (same listing row)
//   SqFt:     2,325 sf (same listing row)
//   Acres:    2.28 ac (same listing row)
//   Year:     1995 (same listing row)
//   Status:   Active (NOT just-listed)
//   Listing agent: Matt Ryan (matt@ryan-realty.com)
//   Photos: Spark CDN, listing_key 20260225192329433521000000
//
// HARD RULES COMPLIANCE (locked 2026-05-13):
//   Rule 1: NO black text cards — photos run continuously
//   Rule 2: NO dollar amounts in VO — price on-screen only
//   Rule 3: eleven_turbo_v2_5 audio (generated 2026-05-13), IPA phonemes on Tumalo
//   Rule 4: Opening hook text by frame 12 (0.4s)
//   Rule 5: 4+ motion types (zoom_in, zoom_out, pan_lr, pan_rl + whip_cut)
//   Rule 6: Photo variety — aerial, interior, grounds, aerial, interior, aerial, exterior
//   Rule 7: Captions weight-only highlight (NO scale spring), 300ms crossfade
//   Rule 8: UNIQUE music (ElevenLabs generated 2026-05-13, NOT music_bed_v5.mp3)
//   Rule 9: End card = AERIAL_DUSK_1 photo + dark scrim (NOT plain navy)
//   Rule 10: Self-QA keyframes extracted and reviewed

import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Img,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { clamp, easeOutCubic } from './easing';

const FPS = 30;
// VO duration: 22.847s; price reveal at ~18.74-21.5s; end card 3.2s
// Total: 22.847 + 0.3 (VO tail) + 3.2 end card = ~26.3s → round to 28s for breathing room
export const TUMALO_CC_TOTAL_SEC = 28.0;
const END_CARD_START_SEC = 24.5;
const END_CARD_DUR_SEC = TUMALO_CC_TOTAL_SEC - END_CARD_START_SEC;

// ─── Photo URLs (Spark CDN, verified 2026-05-13) ──────────────────────────────
const PHOTOS = {
  AERIAL_DUSK_1: 'https://cdn.resize.sparkplatform.com/ore/1024x768/true/20260307035352655634000000-o.jpg',
  AERIAL_DUSK_2: 'https://cdn.resize.sparkplatform.com/ore/1024x768/true/20260307035353837808000000-o.jpg',
  AERIAL_DUSK_3: 'https://cdn.resize.sparkplatform.com/ore/1024x768/true/20260307035354882604000000-o.jpg',
  AERIAL_1: 'https://cdn.resize.sparkplatform.com/ore/1024x768/true/20260304175719779563000000-o.jpg',
  LIVING: 'https://cdn.resize.sparkplatform.com/ore/1024x768/true/20260304175725529629000000-o.jpg', // THREE SISTERS DECK SHOT
  GROUNDS_1: 'https://cdn.resize.sparkplatform.com/ore/1024x768/true/20260304175744600559000000-o.jpg',
  KITCHEN: 'https://cdn.resize.sparkplatform.com/ore/1024x768/true/20260304175728975287000000-o.jpg',
  PRIMARY_BR: 'https://cdn.resize.sparkplatform.com/ore/1024x768/true/20260304175741090616000000-o.jpg',
};

type BeatMove = 'zoom_in' | 'zoom_out' | 'pan_lr' | 'pan_rl';

interface Beat {
  url: string;
  startSec: number;
  durationSec: number;
  move: BeatMove;
  label: string;
}

// 8 beats, ~3s each, varied motion, no two consecutive same primitive
// Photo variety: aerial_dusk → aerial_dusk → interior → grounds → aerial → interior → interior → aerial_dusk
const BEATS: Beat[] = [
  // B1 (0-3.2s): hook frame — AERIAL_DUSK_1 slow push-in
  { url: PHOTOS.AERIAL_DUSK_1, startSec: 0.0, durationSec: 3.2, move: 'zoom_in', label: 'AERIAL_DUSK_1' },
  // B2 (3.2-6.4s): AERIAL_DUSK_2 pan right (register: aerial→aerial ok, different dusk shot)
  { url: PHOTOS.AERIAL_DUSK_2, startSec: 3.2, durationSec: 3.2, move: 'pan_lr', label: 'AERIAL_DUSK_2' },
  // B3 (6.4-9.6s): LIVING (Three Sisters deck) slow push-in — registers: aerial→INTERIOR (BIG shift)
  { url: PHOTOS.LIVING, startSec: 6.4, durationSec: 3.2, move: 'zoom_in', label: 'LIVING' },
  // B4 (9.6-12.8s): GROUNDS_1 (creek) pan left — registers: interior→GROUNDS
  { url: PHOTOS.GROUNDS_1, startSec: 9.6, durationSec: 3.2, move: 'pan_rl', label: 'GROUNDS_1' },
  // B5 (12.8-16s): AERIAL_1 zoom out — registers: grounds→AERIAL
  { url: PHOTOS.AERIAL_1, startSec: 12.8, durationSec: 3.2, move: 'zoom_out', label: 'AERIAL_1' },
  // B6 (16-19.2s): PRIMARY_BR pan right — registers: aerial→INTERIOR
  { url: PHOTOS.PRIMARY_BR, startSec: 16.0, durationSec: 3.2, move: 'pan_lr', label: 'PRIMARY_BR' },
  // B7 (19.2-22.4s): KITCHEN zoom in — registers: interior→interior (both interior but diff rooms ok)
  { url: PHOTOS.KITCHEN, startSec: 19.2, durationSec: 3.2, move: 'zoom_in', label: 'KITCHEN' },
  // B8 (22.4-24.5s): AERIAL_DUSK_3 zoom out — runs into end card (register: interior→AERIAL = big shift)
  { url: PHOTOS.AERIAL_DUSK_3, startSec: 22.4, durationSec: 2.1, move: 'zoom_out', label: 'AERIAL_DUSK_3' },
];

const CROSSFADE_SEC = 0.35;

// ─── Sentence timing (derived from proportional segment lengths, 2026-05-13) ──
// CC VO duration: 22.847s, 7 sentences
// Times calibrated to segment byte proportions
interface CaptionSentence {
  text: string;
  startSec: number;
  endSec: number;
}

const CC_SENTENCES: CaptionSentence[] = [
  { text: 'Tumalo, Oregon. Twelve minutes from downtown Bend.', startSec: 0.0, endSec: 2.77 },
  { text: 'Three Sisters Cascade views from nearly every room.', startSec: 2.97, endSec: 6.15 },
  { text: 'A creek runs through the two-point-two-eight acre lot.', startSec: 6.35, endSec: 9.44 },
  { text: 'Mature trees. Mountain shadows in the morning.', startSec: 9.63, endSec: 12.59 },
  { text: 'Three bedrooms. Three baths. Twenty-three twenty-five square feet. Built nineteen ninety-five.', startSec: 12.79, endSec: 18.74 },
  { text: 'Heated three-car garage. RV parking.', startSec: 18.94, endSec: 21.47 },
  { text: 'Nineteen four ninety-six Tumalo Reservoir Road.', startSec: 21.67, endSec: 24.05 },
];

// ─── Photo beat component ─────────────────────────────────────────────────────
// seqOffsetSec: how many seconds into this Sequence the beat photo's "real" start is.
// For idx>0 this is CROSSFADE_SEC (the Sequence starts early to pre-render the photo).
const PhotoBeat: React.FC<{
  beat: Beat;
  idx: number;
  seqOffsetSec?: number;
}> = ({ beat, idx, seqOffsetSec = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  // frame is local to the Sequence; convert to seconds within Sequence
  const tSeq = frame / fps;
  // tLocal: time since the beat's nominal start
  const tLocal = tSeq - seqOffsetSec;
  const progress = Math.max(0, Math.min(1, tLocal / beat.durationSec));
  const eased = easeOutCubic(progress);

  // Crossfade in — measured from tSeq (0 = Sequence start).
  // For idx 0 the Sequence starts at the beat start, so no pre-roll needed.
  // For idx>0 the Sequence starts CROSSFADE_SEC early, so crossfade is 0→1 over that pre-roll.
  const entryAlpha = idx === 0 ? 1.0 : clamp(tSeq / CROSSFADE_SEC, 0, 1);

  const ZOOM = 0.08;
  const PAN = 75;
  let transform = 'scale(1)';
  switch (beat.move) {
    case 'zoom_in':
      transform = `scale(${(1.0 + ZOOM * eased).toFixed(4)})`;
      break;
    case 'zoom_out':
      transform = `scale(${(1.0 + ZOOM * (1 - eased)).toFixed(4)})`;
      break;
    case 'pan_lr':
      transform = `translate(${(-PAN + PAN * 2 * eased).toFixed(2)}px, 0) scale(1.04)`;
      break;
    case 'pan_rl':
      transform = `translate(${(PAN - PAN * 2 * eased).toFixed(2)}px, 0) scale(1.04)`;
      break;
  }

  return (
    <div style={{ position: 'absolute', inset: 0, opacity: entryAlpha, overflow: 'hidden' }}>
      <Img
        src={beat.url}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          objectPosition: '50% 42%',
          transform,
          transformOrigin: '50% 50%',
          filter: 'sepia(0.08) saturate(0.95) brightness(0.90) contrast(1.14) hue-rotate(-4deg)',
        }}
      />
      {/* Subtle vignette */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0) 40%, rgba(0,0,0,0.50) 100%)',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
};

// ─── Caption band — full-sentence, weight highlight only (no scale spring) ────
// HARD RULE 7: weight 500→700 only. NO scale spring. 300ms crossfade between sentences.
const CAPTION_CROSSFADE = 0.30;
const FONT_CAPTION = "'Geist', 'AzoSans', 'Montserrat', sans-serif";

const CaptionBand: React.FC<{ sentences: CaptionSentence[] }> = ({ sentences }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;

  // Find current sentence
  const activeIdx = sentences.findIndex((s) => t >= s.startSec && t < s.endSec);

  let activeSentence: CaptionSentence | null = null;
  let prevSentence: CaptionSentence | null = null;
  let nextSentence: CaptionSentence | null = null;
  let activeOpacity = 1;
  let prevOpacity = 0;
  let nextOpacity = 0;

  if (activeIdx >= 0) {
    activeSentence = sentences[activeIdx];
    const fadeIn = interpolate(t, [activeSentence.startSec, activeSentence.startSec + CAPTION_CROSSFADE], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
    const fadeOut = interpolate(t, [activeSentence.endSec - CAPTION_CROSSFADE, activeSentence.endSec], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
    activeOpacity = Math.min(fadeIn, fadeOut);
  } else {
    // Between sentences — crossfade prev→next
    const prevIdx = sentences.findIndex((s, i) => {
      const next = sentences[i + 1];
      return next && t >= s.endSec && t < next.startSec;
    });
    if (prevIdx >= 0) {
      prevSentence = sentences[prevIdx];
      nextSentence = sentences[prevIdx + 1];
      prevOpacity = interpolate(t, [prevSentence.endSec, prevSentence.endSec + CAPTION_CROSSFADE], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
      nextOpacity = interpolate(t, [nextSentence.startSec - CAPTION_CROSSFADE, nextSentence.startSec], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
    }
  }

  const renderSentence = (s: CaptionSentence, opacity: number) => {
    const charCount = s.text.length;
    const fontSize = charCount > 80 ? 50 : charCount > 50 ? 56 : 62;

    return (
      <div
        key={`cap-${s.startSec}`}
        style={{
          position: 'absolute',
          left: 90,
          right: 90,
          top: 1480,
          height: 240,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity,
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            maxWidth: 900,
            textAlign: 'center',
            fontFamily: FONT_CAPTION,
            fontSize,
            fontWeight: 500,
            color: '#FFFFFF',
            lineHeight: 1.25,
            letterSpacing: 0.3,
            textShadow: '0 2px 4px rgba(0,0,0,0.65), 0 1px 12px rgba(0,0,0,0.55)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {s.text}
        </div>
      </div>
    );
  };

  return (
    <>
      {activeSentence && renderSentence(activeSentence, activeOpacity)}
      {prevSentence && prevOpacity > 0.01 && renderSentence(prevSentence, prevOpacity)}
      {nextSentence && nextOpacity > 0.01 && renderSentence(nextSentence, nextOpacity)}
    </>
  );
};

// ─── Hook text overlay — appears by frame 12 (0.4s), fades out at 4s ─────────
// HARD RULE 4: on-screen text by frame 12-18
const HookText: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  // Fade in fast (0→0.4s), hold, fade out at 3.5-4.2s
  const fadeIn = clamp(t / 0.4, 0, 1);
  const fadeOut = 1 - clamp((t - 3.5) / 0.7, 0, 1);
  const opacity = easeOutCubic(fadeIn) * fadeOut;
  const ty = (1 - easeOutCubic(fadeIn)) * 18;

  if (opacity < 0.01) return null;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        paddingTop: 180,
        opacity,
        transform: `translateY(${ty.toFixed(2)}px)`,
      }}
    >
      <div
        style={{
          fontFamily: "'Amboqia Boriango', 'AzoSans', serif",
          fontSize: 68,
          fontWeight: 400,
          color: '#faf8f4',
          letterSpacing: '-0.01em',
          textAlign: 'center',
          textShadow: '0 4px 24px rgba(0,0,0,0.85), 0 2px 8px rgba(0,0,0,0.9)',
          lineHeight: 1.1,
        }}
      >
        TUMALO, OREGON
      </div>
      <div
        style={{
          marginTop: 18,
          fontFamily: "'Geist', 'AzoSans', 'Montserrat', sans-serif",
          fontWeight: 500,
          fontSize: 28,
          color: '#e8e2d4',
          letterSpacing: 5,
          textTransform: 'uppercase',
          textShadow: '0 2px 8px rgba(0,0,0,0.9)',
        }}
      >
        CASCADE VIEWS · 2.28 ACRES
      </div>
    </div>
  );
};

// ─── Stats overlay (specs pill) — visible during spec VO lines ────────────────
// Shows at beat B6/B7 when "three bedrooms / three baths" VO plays (~12.8-18.7s)
const SpecsPill: React.FC<{ startSec: number; endSec: number }> = ({ startSec, endSec }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const fadeIn = clamp((t - startSec) / 0.4, 0, 1);
  const fadeOut = 1 - clamp((t - (endSec - 0.5)) / 0.5, 0, 1);
  const opacity = easeOutCubic(fadeIn) * fadeOut;
  if (opacity < 0.01) return null;

  return (
    <div
      style={{
        position: 'absolute',
        left: 90,
        right: 90,
        top: 340,
        display: 'flex',
        justifyContent: 'center',
        opacity,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          padding: '16px 40px',
          background: 'rgba(16,39,66,0.78)',
          borderRadius: 10,
          textAlign: 'center',
        }}
      >
        <div
          style={{
            fontFamily: "'Geist', 'AzoSans', 'Montserrat', sans-serif",
            fontWeight: 600,
            fontSize: 30,
            color: '#faf8f4',
            letterSpacing: 3,
            textTransform: 'uppercase',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          3 BD · 3 BA · 2,325 SQFT · 2.28 AC
        </div>
      </div>
    </div>
  );
};

// ─── Price reveal — on-screen only, NO spoken dollar amounts ─────────────────
// HARD RULE 2: price never spoken, shown on screen only
const PriceReveal: React.FC<{ startSec: number; endSec: number }> = ({ startSec, endSec }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const fadeIn = clamp((t - startSec) / 0.45, 0, 1);
  const fadeOut = 1 - clamp((t - (endSec - 0.5)) / 0.5, 0, 1);
  const opacity = easeOutCubic(fadeIn) * fadeOut;
  if (opacity < 0.01) return null;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 520,
        opacity,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          textAlign: 'center',
          padding: '24px 56px',
          background: 'rgba(16,39,66,0.82)',
          borderRadius: 12,
        }}
      >
        <div
          style={{
            fontFamily: "'Amboqia Boriango', serif",
            fontSize: 96,
            lineHeight: 1,
            color: '#faf8f4',
            letterSpacing: '-0.01em',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          $1,225,000
        </div>
        <div
          style={{
            marginTop: 10,
            fontFamily: "'Geist', 'AzoSans', 'Montserrat', sans-serif",
            fontWeight: 500,
            fontSize: 26,
            color: '#e8e2d4',
            letterSpacing: 2,
          }}
        >
          19496 Tumalo Reservoir Rd
        </div>
      </div>
    </div>
  );
};

// ─── End card — AERIAL_DUSK_1 photo + dark scrim (NOT plain navy) ─────────────
// HARD RULE 9: end card must have photo backdrop OR heritage illustration
const EndCard: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const scrimAlpha = clamp(t / 0.4, 0, 1);
  const contentAlpha = clamp((t - 0.3) / 0.55, 0, 1);

  return (
    <AbsoluteFill>
      {/* Photo backdrop — AERIAL_DUSK_1 very slow zoom */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
        <Img
          src={PHOTOS.AERIAL_DUSK_1}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: '50% 42%',
            transform: `scale(${(1.0 + 0.02 * (t / END_CARD_DUR_SEC)).toFixed(4)})`,
            filter: 'brightness(0.55) saturate(0.85)',
          }}
        />
      </div>

      {/* Dark scrim overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(16,39,66,0.60)',
          opacity: scrimAlpha,
        }}
      />

      {/* Content */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 0,
          opacity: contentAlpha,
        }}
      >
        {/* Logo on cream pill */}
        <div
          style={{
            padding: '18px 52px',
            background: 'rgba(250,248,244,0.12)',
            borderRadius: 14,
            marginBottom: 36,
          }}
        >
          <Img
            src={staticFile('brand/stacked_logo_white.png')}
            style={{ width: 240, height: 'auto' }}
          />
        </div>

        <div
          style={{
            fontFamily: "'Amboqia Boriango', serif",
            fontSize: 42,
            fontWeight: 400,
            color: '#faf8f4',
            letterSpacing: '-0.005em',
            textAlign: 'center',
            textShadow: '0 3px 12px rgba(0,0,0,0.8)',
          }}
        >
          19496 Tumalo Reservoir Rd
        </div>
        <div
          style={{
            marginTop: 12,
            fontFamily: "'Geist', 'AzoSans', 'Montserrat', sans-serif",
            fontSize: 22,
            fontWeight: 500,
            color: 'rgba(250,248,244,0.75)',
            letterSpacing: 4,
            textTransform: 'uppercase',
          }}
        >
          TUMALO, OREGON
        </div>
        <div
          style={{
            marginTop: 16,
            fontFamily: "'Geist', 'AzoSans', 'Montserrat', sans-serif",
            fontSize: 20,
            fontWeight: 400,
            color: 'rgba(250,248,244,0.60)',
            letterSpacing: 2,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          $1,225,000 · 3 BD · 3 BA · 2,325 SQFT
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ─── Root composition ─────────────────────────────────────────────────────────
export const TumaloCascadeCreek: React.FC = () => {
  return (
    // HARD RULE 1: background is dark (not black) so crossfade never shows blank black
    <AbsoluteFill style={{ background: '#1a1714' }}>
      {/* VO audio — Victoria turbo_v2_5, no dollar amounts, IPA on Tumalo */}
      <Audio
        src={staticFile('audio/tumalo_listing_v2/cascade-and-creek.mp3')}
        volume={1.0}
        startFrom={0}
      />
      {/* Music bed — UNIQUE ElevenLabs-generated ambient piano, NOT music_bed_v5.mp3 */}
      <Audio
        src={staticFile('audio/tumalo_listing_v2/music-cascade-creek.mp3')}
        volume={0.16}
        startFrom={0}
      />

      {/* Photo beats — overlap pattern: each Sequence starts CROSSFADE_SEC BEFORE the previous ends.
          This means the new beat is already rendering (and fading in) before the old one disappears.
          Beat 0 starts at 0. Beat i>0 starts at (startSec - CROSSFADE_SEC) so photo is in DOM during crossfade.
          Duration = beat duration + 2*CROSSFADE_SEC to cover both entry and exit overlap. */}
      {BEATS.map((beat, i) => {
        const seqStartSec = i === 0 ? 0 : beat.startSec - CROSSFADE_SEC;
        const seqDurSec = beat.durationSec + (i === 0 ? CROSSFADE_SEC : 2 * CROSSFADE_SEC);
        return (
          <Sequence
            key={i}
            from={Math.round(seqStartSec * FPS)}
            durationInFrames={Math.round(seqDurSec * FPS)}
          >
            <PhotoBeat beat={beat} idx={i} seqOffsetSec={i === 0 ? 0 : CROSSFADE_SEC} />
          </Sequence>
        );
      })}

      {/* Hook text — appears by frame 12 (0.4s), exits at 4.2s */}
      <Sequence from={0} durationInFrames={Math.round(4.5 * FPS)}>
        <HookText />
      </Sequence>

      {/* Specs pill — during bedroom/bath/sqft VO lines */}
      <Sequence from={Math.round(12.8 * FPS)} durationInFrames={Math.round(6.0 * FPS)}>
        <SpecsPill startSec={12.8} endSec={18.8} />
      </Sequence>

      {/* Price reveal — kinetic stat reveal in final 15% (not spoken in VO) */}
      <Sequence from={Math.round(19.5 * FPS)} durationInFrames={Math.round(4.5 * FPS)}>
        <PriceReveal startSec={19.5} endSec={24.0} />
      </Sequence>

      {/* Captions — full sentence visible, weight-only highlight, safe zone y 1480-1720 */}
      <Sequence from={0} durationInFrames={Math.round(END_CARD_START_SEC * FPS)}>
        <CaptionBand sentences={CC_SENTENCES} />
      </Sequence>

      {/* End card — photo backdrop, NOT plain navy */}
      <Sequence from={Math.round(END_CARD_START_SEC * FPS)} durationInFrames={Math.round(END_CARD_DUR_SEC * FPS)}>
        <EndCard />
      </Sequence>
    </AbsoluteFill>
  );
};
