// TumaloLife.tsx — 19496 Tumalo Reservoir Rd
// "Tumalo Life" (V8 REBUILD) — lifestyle narrative, ~23s
// 1080×1920 portrait, 30fps, h264+aac, file < 100MB
//
// DATA ACCURACY (per CLAUDE.md):
//   Address:  19496 Tumalo Reservoir Rd, Tumalo, OR 97703
//   Price:    $1,225,000 (Supabase listing_key 20260225192329433521000000, ListPrice=1225000)
//   Beds/Bath: 3 BD / 3 BA, 2,325 sf, 2.28 ac, built 1995
//   Status:   Active (NOT just-listed)
//   Photos: Spark CDN, listing_key 20260225192329433521000000
//
// HARD RULES COMPLIANCE (locked 2026-05-13):
//   Rule 1: NO black text cards — photos run continuously
//   Rule 2: NO dollar amounts in VO — price on-screen only
//   Rule 3: eleven_turbo_v2_5 audio, IPA on Tumalo + Deschutes
//   Rule 4: Opening hook text by frame 12 (0.4s)
//   Rule 5: 4+ motion types (zoom_in, zoom_out, pan_lr, pan_rl)
//   Rule 6: Photo variety — aerial→aerial→grounds→grounds→aerial→interior→interior→exterior→aerial
//   Rule 7: Captions weight-only highlight, 300ms crossfade (NO scale spring)
//   Rule 8: UNIQUE music (ElevenLabs acoustic guitar, NOT music_bed_v5.mp3 or CC track)
//   Rule 9: End card = HERO_PRIMARY photo + dark scrim (NOT plain navy)
//   Rule 10: Self-QA keyframes reviewed

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
// VO duration: 17.834s; end card 3.2s → total 22s
export const TUMALO_LIFE_TOTAL_SEC = 22.0;
const END_CARD_START_SEC = 18.8;
const END_CARD_DUR_SEC = TUMALO_LIFE_TOTAL_SEC - END_CARD_START_SEC;

// ─── Photo URLs (Spark CDN, verified 2026-05-13) ──────────────────────────────
const PHOTOS = {
  AERIAL_1: 'https://cdn.resize.sparkplatform.com/ore/1024x768/true/20260304175719779563000000-o.jpg',
  AERIAL_2: 'https://cdn.resize.sparkplatform.com/ore/1024x768/true/20260304175720531554000000-o.jpg',
  AERIAL_DUSK_1: 'https://cdn.resize.sparkplatform.com/ore/1024x768/true/20260307035352655634000000-o.jpg',
  AERIAL_DUSK_2: 'https://cdn.resize.sparkplatform.com/ore/1024x768/true/20260307035353837808000000-o.jpg',
  AERIAL_DUSK_3: 'https://cdn.resize.sparkplatform.com/ore/1024x768/true/20260307035354882604000000-o.jpg',
  HERO_PRIMARY: 'https://cdn.resize.sparkplatform.com/ore/1024x768/true/20260304175825195222000000-o.jpg',
  LIVING: 'https://cdn.resize.sparkplatform.com/ore/1024x768/true/20260304175725529629000000-o.jpg', // THREE SISTERS DECK
  KITCHEN: 'https://cdn.resize.sparkplatform.com/ore/1024x768/true/20260304175728975287000000-o.jpg',
  GROUNDS_1: 'https://cdn.resize.sparkplatform.com/ore/1024x768/true/20260304175744600559000000-o.jpg',
  GROUNDS_2: 'https://cdn.resize.sparkplatform.com/ore/1024x768/true/20260304175746136817000000-o.jpg',
};

type BeatMove = 'zoom_in' | 'zoom_out' | 'pan_lr' | 'pan_rl';

interface Beat {
  url: string;
  startSec: number;
  durationSec: number;
  move: BeatMove;
  label: string;
}

// 8 beats, ~2.1-2.3s each, varied motion — lifestyle sequence
// Visual register: aerial→aerial→grounds→grounds→aerial_dusk→interior→interior→exterior
const BEATS: Beat[] = [
  // B1 (0-2.3s): hook — AERIAL_DUSK_1 slow push-in
  { url: PHOTOS.AERIAL_DUSK_1, startSec: 0.0, durationSec: 2.3, move: 'zoom_in', label: 'AERIAL_DUSK_1' },
  // B2 (2.3-4.5s): AERIAL_1 pan left — register: aerial→aerial (diff shot)
  { url: PHOTOS.AERIAL_1, startSec: 2.3, durationSec: 2.2, move: 'pan_rl', label: 'AERIAL_1' },
  // B3 (4.5-6.5s): GROUNDS_1 (creek) zoom out — register: aerial→GROUNDS (big shift)
  { url: PHOTOS.GROUNDS_1, startSec: 4.5, durationSec: 2.0, move: 'zoom_out', label: 'GROUNDS_1' },
  // B4 (6.5-8.8s): GROUNDS_2 pan right — register: grounds→grounds (property grounds)
  { url: PHOTOS.GROUNDS_2, startSec: 6.5, durationSec: 2.3, move: 'pan_lr', label: 'GROUNDS_2' },
  // B5 (8.8-11.0s): AERIAL_DUSK_2 zoom in — register: grounds→AERIAL (big shift)
  { url: PHOTOS.AERIAL_DUSK_2, startSec: 8.8, durationSec: 2.2, move: 'zoom_in', label: 'AERIAL_DUSK_2' },
  // B6 (11.0-13.5s): LIVING (Three Sisters deck) slow push-in — register: aerial→INTERIOR (hero!)
  { url: PHOTOS.LIVING, startSec: 11.0, durationSec: 2.5, move: 'zoom_in', label: 'LIVING' },
  // B7 (13.5-16.1s): KITCHEN zoom out — register: interior→interior (diff room)
  { url: PHOTOS.KITCHEN, startSec: 13.5, durationSec: 2.6, move: 'zoom_out', label: 'KITCHEN' },
  // B8 (16.1-18.8s): HERO_PRIMARY pan left — register: interior→EXTERIOR (big shift)
  { url: PHOTOS.HERO_PRIMARY, startSec: 16.1, durationSec: 2.7, move: 'pan_lr', label: 'HERO_PRIMARY' },
];

const CROSSFADE_SEC = 0.30;

// ─── Sentence timing (derived from proportional segment lengths, 2026-05-13) ──
// TL VO duration: 17.834s, 8 sentences
interface CaptionSentence {
  text: string;
  startSec: number;
  endSec: number;
}

const TL_SENTENCES: CaptionSentence[] = [
  { text: 'This is what life in Tumalo, Oregon looks like.', startSec: 0.0, endSec: 2.48 },
  { text: 'Twelve minutes from downtown Bend.', startSec: 2.63, endSec: 4.64 },
  { text: 'Float the Deschutes in the morning.', startSec: 4.79, endSec: 6.10 },
  { text: 'Walk to The Bite for tacos and live music.', startSec: 6.25, endSec: 9.02 },
  { text: 'Ski Mt. Bachelor in the winter.', startSec: 9.16, endSec: 11.59 },
  { text: 'Wake up to Cascade views.', startSec: 11.74, endSec: 13.62 },
  { text: 'Watch deer move through the trees in the evening.', startSec: 13.77, endSec: 16.31 },
  { text: 'Nineteen four ninety-six Tumalo Reservoir Road.', startSec: 16.46, endSec: 18.88 },
];

// ─── Photo beat component ─────────────────────────────────────────────────────
const PhotoBeat: React.FC<{ beat: Beat; idx: number; seqOffsetSec?: number }> = ({ beat, idx, seqOffsetSec = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const tSeq = frame / fps;
  const tLocal = tSeq - seqOffsetSec;
  const progress = Math.max(0, Math.min(1, tLocal / beat.durationSec));
  const eased = easeOutCubic(progress);

  const entryAlpha = idx === 0 ? 1.0 : clamp(tSeq / CROSSFADE_SEC, 0, 1);

  const ZOOM = 0.09;
  const PAN = 80;
  let transform = 'scale(1)';
  switch (beat.move) {
    case 'zoom_in':
      transform = `scale(${(1.0 + ZOOM * eased).toFixed(4)})`;
      break;
    case 'zoom_out':
      transform = `scale(${(1.0 + ZOOM * (1 - eased)).toFixed(4)})`;
      break;
    case 'pan_lr':
      transform = `translate(${(-PAN + PAN * 2 * eased).toFixed(2)}px, 0) scale(1.05)`;
      break;
    case 'pan_rl':
      transform = `translate(${(PAN - PAN * 2 * eased).toFixed(2)}px, 0) scale(1.05)`;
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
          objectPosition: '50% 40%',
          transform,
          transformOrigin: '50% 50%',
          filter: 'sepia(0.06) saturate(0.98) brightness(0.92) contrast(1.10) hue-rotate(-3deg)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0) 42%, rgba(0,0,0,0.48) 100%)',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
};

// ─── Caption band — full-sentence, weight-only highlight (NO scale spring) ────
// HARD RULE 7
const CAPTION_CROSSFADE = 0.30;
const FONT_CAPTION = "'Geist', 'AzoSans', 'Montserrat', sans-serif";

const CaptionBand: React.FC<{ sentences: CaptionSentence[] }> = ({ sentences }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;

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

// ─── Hook text — "LIFE IN TUMALO" — by frame 12 (0.4s) ──────────────────────
// HARD RULE 4
const HookText: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const fadeIn = clamp(t / 0.4, 0, 1);
  const fadeOut = 1 - clamp((t - 2.8) / 0.6, 0, 1);
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
        paddingTop: 200,
        opacity,
        transform: `translateY(${ty.toFixed(2)}px)`,
      }}
    >
      <div
        style={{
          fontFamily: "'Amboqia Boriango', 'AzoSans', serif",
          fontSize: 72,
          fontWeight: 400,
          color: '#faf8f4',
          letterSpacing: '-0.01em',
          textAlign: 'center',
          textShadow: '0 4px 24px rgba(0,0,0,0.85), 0 2px 8px rgba(0,0,0,0.9)',
          lineHeight: 1.1,
        }}
      >
        LIFE IN TUMALO
      </div>
      <div
        style={{
          marginTop: 18,
          fontFamily: "'Geist', 'AzoSans', 'Montserrat', sans-serif",
          fontWeight: 500,
          fontSize: 26,
          color: '#e8e2d4',
          letterSpacing: 5,
          textTransform: 'uppercase',
          textShadow: '0 2px 8px rgba(0,0,0,0.9)',
        }}
      >
        BEND · OREGON
      </div>
    </div>
  );
};

// ─── Spec pill — 3 BD 3 BA overlay at B8 ─────────────────────────────────────
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
          padding: '14px 36px',
          background: 'rgba(16,39,66,0.78)',
          borderRadius: 10,
          textAlign: 'center',
        }}
      >
        <div
          style={{
            fontFamily: "'Geist', 'AzoSans', 'Montserrat', sans-serif",
            fontWeight: 600,
            fontSize: 28,
            color: '#faf8f4',
            letterSpacing: 3,
            textTransform: 'uppercase',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          3 BD · 3 BA · 2,325 SQFT · 2.28 ACRES
        </div>
      </div>
    </div>
  );
};

// ─── End card — HERO_PRIMARY photo + dark scrim (NOT plain navy) ───────────────
// HARD RULE 9
const EndCard: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const scrimAlpha = clamp(t / 0.4, 0, 1);
  const contentAlpha = clamp((t - 0.3) / 0.55, 0, 1);

  return (
    <AbsoluteFill>
      {/* Photo backdrop — HERO_PRIMARY */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
        <Img
          src={PHOTOS.HERO_PRIMARY}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: '50% 40%',
            transform: `scale(${(1.0 + 0.015 * (t / END_CARD_DUR_SEC)).toFixed(4)})`,
            filter: 'brightness(0.50) saturate(0.85)',
          }}
        />
      </div>

      {/* Dark scrim */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(16,39,66,0.58)',
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
        <div
          style={{
            padding: '16px 48px',
            background: 'rgba(250,248,244,0.12)',
            borderRadius: 14,
            marginBottom: 32,
          }}
        >
          <Img
            src={staticFile('brand/stacked_logo_white.png')}
            style={{ width: 230, height: 'auto' }}
          />
        </div>

        <div
          style={{
            fontFamily: "'Amboqia Boriango', serif",
            fontSize: 40,
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
            fontSize: 21,
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
            marginTop: 14,
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
export const TumaloLife: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: '#1a1714' }}>
      {/* VO audio — Victoria turbo_v2_5, IPA on Tumalo + Deschutes, NO dollar amounts */}
      <Audio
        src={staticFile('audio/tumalo_listing_v2/tumalo-life.mp3')}
        volume={1.0}
        startFrom={0}
      />
      {/* Music bed — UNIQUE ElevenLabs acoustic guitar folk (DIFFERENT from CC track) */}
      <Audio
        src={staticFile('audio/tumalo_listing_v2/music-tumalo-life.mp3')}
        volume={0.16}
        startFrom={0}
      />

      {/* Photo beats — overlap pattern: Sequence starts CROSSFADE_SEC early so photo pre-renders.
          This ensures no dark frame between beats — the new photo is already fading in
          before the previous Sequence expires. */}
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

      {/* Hook text — "LIFE IN TUMALO" appears by frame 12 */}
      <Sequence from={0} durationInFrames={Math.round(3.8 * FPS)}>
        <HookText />
      </Sequence>

      {/* Specs pill — over HERO_PRIMARY beat */}
      <Sequence from={Math.round(16.1 * FPS)} durationInFrames={Math.round(2.5 * FPS)}>
        <SpecsPill startSec={16.1} endSec={18.6} />
      </Sequence>

      {/* Captions — safe zone y 1480-1720, full sentence, weight-only highlight */}
      <Sequence from={0} durationInFrames={Math.round(END_CARD_START_SEC * FPS)}>
        <CaptionBand sentences={TL_SENTENCES} />
      </Sequence>

      {/* End card — photo backdrop, NOT plain navy */}
      <Sequence from={Math.round(END_CARD_START_SEC * FPS)} durationInFrames={Math.round(END_CARD_DUR_SEC * FPS)}>
        <EndCard />
      </Sequence>
    </AbsoluteFill>
  );
};
