import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Img,
  OffthreadVideo,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
} from 'remotion';
import '../fonts';
import { SingleWordCaption } from '../../../video_production_skills/captions/canonical/SingleWordCaption';
import { EP1_WORDS } from './captions-data';

/**
 * Then & Now — Episode 1: "The hotel Bend tore down" (Pilot Butte Inn).
 * Action row 87478c7c. v2 art direction after Matt's review of v1
 * ("too much AI slop, needs polish"):
 *
 *  - "Archive plate" canvas: warm cream field + film grain, every photo
 *    presented as a mounted print with a museum label. No blurred-background
 *    letterbox anywhere (the v1 slop signal).
 *  - The 1917 distant Wan clip is CUT (architecture warped — worst asset).
 *    Only the faithful 1928 animation survives, hook + return + coda.
 *  - Warm archival tone on the B&W plates (documentary treatment; also
 *    carries the t=0 thumbnail gate's saturation floor).
 *  - Quieter typography: navy editorial cards, no slam-scaling.
 *  - Captions suppressed during typographic cards (white-on-cream contrast
 *    fail in v1) and during the hook headline (text clutter in v1).
 */

export const THEN_NOW_EP1_SEC = 44.5;
export const THEN_NOW_EP1_FRAMES = 1335;

const NAVY = '#102742';
const CREAM = '#faf8f4';
const WHITE = '#ffffff';
const TEXT_SHADOW = '0 2px 22px rgba(0,0,0,0.55), 0 1px 5px rgba(0,0,0,0.45)';

const XFADE = 8;

// The mounted print window (full width minus margins, tall portrait crop).
const PRINT = { left: 38, top: 250, width: 1004, height: 1280 };

type Motion = 'slow_pan' | 'push_in' | 'vertical_drift' | 'multi_point_pan' | 'none';

type Plate = {
  kind: 'plate';
  src: string;
  video?: boolean;
  startFromSec?: number;
  motion: Motion;
  pos?: string; // object-position inside the print
  zoom?: number;
  era: 'then' | 'now';
  grade?: 'dark';
  label: string; // museum label, top-left on the print
  ai?: boolean; // AI-animated disclosure tag
};
type Card = { kind: 'card'; card: 'nrhp' | 'demo' | 'end' };
type Beat = { id: string; from: number; to: number; media: Plate | Card };

const BEATS: Beat[] = [
  { id: 'hook', from: 0, to: 120, media: { kind: 'plate', src: 'then-now/inn-1928-anim.mp4', video: true, startFromSec: 0, motion: 'none', pos: '50% 30%', era: 'then', label: 'PILOT BUTTE INN · 1928', ai: true } },
  { id: 'gable', from: 112, to: 224, media: { kind: 'plate', src: 'then-now/inn-1928-still.jpg', motion: 'slow_pan', pos: '30% 20%', zoom: 1.35, era: 'then', label: 'WALL STREET AT NEWPORT · 1928' } },
  { id: 'river', from: 216, to: 296, media: { kind: 'plate', src: 'then-now/bend-waterfront-1910.jpg', motion: 'vertical_drift', pos: '50% 55%', era: 'then', label: 'DESCHUTES RIVERFRONT · 1910' } },
  { id: 'entrance', from: 288, to: 400, media: { kind: 'plate', src: 'then-now/inn-1928-still.jpg', motion: 'push_in', pos: '36% 78%', zoom: 1.7, era: 'then', label: 'THE DINING ROOM ENTRANCE · 1928' } },
  { id: 'street', from: 392, to: 494, media: { kind: 'plate', src: 'then-now/inn-1928-still.jpg', motion: 'slow_pan', pos: '82% 88%', zoom: 1.75, era: 'then', label: 'HOTEL GUESTS ON WALL STREET · 1928' } },
  { id: 'pano', from: 486, to: 606, media: { kind: 'plate', src: 'then-now/bend-panorama-1910.jpg', motion: 'multi_point_pan', pos: '50% 60%', zoom: 1.5, era: 'then', label: 'BEND FROM THE WEST · 1910' } },
  { id: 'hardtimes', from: 598, to: 714, media: { kind: 'plate', src: 'then-now/bend-residential-1910.jpg', motion: 'push_in', pos: '50% 45%', era: 'then', grade: 'dark', label: 'BEND · 1910' } },
  { id: 'nrhp', from: 706, to: 826, media: { kind: 'card', card: 'nrhp' } },
  { id: 'return', from: 818, to: 938, media: { kind: 'plate', src: 'then-now/inn-1928-anim.mp4', video: true, startFromSec: 0.9, motion: 'none', pos: '50% 35%', era: 'then', label: 'PILOT BUTTE INN · 1928', ai: true } },
  { id: 'demo', from: 930, to: 1034, media: { kind: 'card', card: 'demo' } },
  { id: 'now-wall', from: 1026, to: 1102, media: { kind: 'plate', src: 'then-now/now-wall-street.jpg', motion: 'push_in', pos: '55% 35%', era: 'now', label: 'WALL STREET · TODAY' } },
  { id: 'now-river', from: 1094, to: 1164, media: { kind: 'plate', src: 'then-now/NOW-drake-park-2018.jpg', motion: 'slow_pan', pos: '50% 45%', era: 'now', label: 'MIRROR POND · TODAY' } },
  { id: 'now-butte', from: 1156, to: 1232, media: { kind: 'plate', src: 'then-now/NOW-pilot-butte-view-2018.jpg', motion: 'vertical_drift', pos: '50% 40%', era: 'now', label: 'BEND FROM PILOT BUTTE · TODAY' } },
  { id: 'coda', from: 1224, to: 1290, media: { kind: 'plate', src: 'then-now/inn-1928-anim.mp4', video: true, startFromSec: 0.4, motion: 'none', pos: '50% 28%', era: 'then', label: 'PILOT BUTTE INN · 1917–1973', ai: true } },
  { id: 'end', from: 1282, to: 1335, media: { kind: 'card', card: 'end' } },
];

// Captions are suppressed while typographic cards or the hook headline are up.
const SUPPRESS: Array<[number, number]> = [
  [706, 826],
  [930, 1034],
  [1282, 1335],
];

function motionTransform(motion: Motion, t: number): string {
  switch (motion) {
    case 'push_in':
      return `scale(${interpolate(t, [0, 1], [1.0, 1.08])})`;
    case 'slow_pan':
      return `scale(1.08) translateX(${interpolate(t, [0, 1], [-1.8, 1.8])}%)`;
    case 'vertical_drift':
      return `scale(1.07) translateY(${interpolate(t, [0, 1], [1.6, -1.6])}%)`;
    case 'multi_point_pan':
      return `scale(1.12) translateX(${interpolate(t, [0, 0.55, 1], [2.8, -0.8, -2.8])}%)`;
    case 'none':
      return '';
  }
}

const Grain: React.FC<{ opacity?: number }> = ({ opacity = 0.05 }) => (
  <AbsoluteFill
    style={{
      backgroundImage: `url(${staticFile('then-now/grain.png')})`,
      backgroundRepeat: 'repeat',
      mixBlendMode: 'overlay',
      opacity,
      pointerEvents: 'none',
    }}
  />
);

/** A photo (or clip) mounted as an archival print on the cream canvas. */
const PlateBeat: React.FC<{ beat: Beat; index: number }> = ({ beat, index }) => {
  const frame = useCurrentFrame();
  const len = beat.to - beat.from;
  const t = frame / len;
  const m = beat.media as Plate;

  const fadeIn = index === 0 ? 1 : interpolate(frame, [0, XFADE], [0, 1], { extrapolateRight: 'clamp' });
  const fadeOut = interpolate(frame, [len - XFADE, len], [1, 0], { extrapolateLeft: 'clamp' });

  // Warm archival tone on "then" plates; honest color on "now" plates.
  const tone =
    m.era === 'then'
      ? `sepia(0.38) saturate(1.18) contrast(1.04) brightness(${m.grade === 'dark' ? 0.7 : 1.02})`
      : 'saturate(1.04) contrast(1.02)';

  const mediaStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    objectPosition: m.pos ?? '50% 40%',
    filter: tone,
  };

  return (
    <AbsoluteFill style={{ opacity: Math.min(fadeIn, fadeOut) }}>
      {/* mounted print */}
      <div
        style={{
          position: 'absolute',
          left: PRINT.left,
          top: PRINT.top,
          width: PRINT.width,
          height: PRINT.height,
          background: WHITE,
          padding: 10,
          borderRadius: 2,
          boxShadow: '0 24px 70px rgba(16,39,66,0.22), 0 2px 10px rgba(16,39,66,0.12)',
        }}
      >
        <div style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
          <div style={{ width: '100%', height: '100%', transform: `${motionTransform(m.motion, t)} scale(${m.zoom ?? 1})`.trim() || undefined }}>
            {m.video ? (
              <OffthreadVideo src={staticFile(m.src)} startFrom={Math.round((m.startFromSec ?? 0) * 30)} muted style={mediaStyle} />
            ) : (
              <Img src={staticFile(m.src)} style={mediaStyle} />
            )}
          </div>
          {/* museum label — top-left, on the print */}
          <div
            style={{
              position: 'absolute',
              left: 42,
              top: 40,
              fontFamily: 'Geist',
              fontWeight: 600,
              fontSize: 27,
              letterSpacing: '0.16em',
              color: WHITE,
              textShadow: TEXT_SHADOW,
              opacity: 0.92,
            }}
          >
            {m.label}
          </div>
          {m.ai ? (
            <div
              style={{
                position: 'absolute',
                right: 42,
                bottom: 34,
                fontFamily: 'Geist',
                fontWeight: 500,
                fontSize: 22,
                letterSpacing: '0.08em',
                color: WHITE,
                opacity: 0.6,
                textShadow: TEXT_SHADOW,
              }}
            >
              AI-ANIMATED ARCHIVAL PHOTO
            </div>
          ) : null}
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** Hook headline — sits on the photo, frames 0-118. Thumbnail-readable at t=0. */
const HookHeadline: React.FC = () => {
  const frame = useCurrentFrame();
  const rise = interpolate(frame, [0, 14], [10, 0], { extrapolateRight: 'clamp' });
  const out = interpolate(frame, [108, 118], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <div style={{ position: 'absolute', left: 90, top: 1080, width: 900, textAlign: 'center', opacity: out, transform: `translateY(${rise}px)` }}>
      <div style={{ fontFamily: 'Amboqia', fontSize: 74, lineHeight: 1.1, color: WHITE, textShadow: TEXT_SHADOW }}>
        The hotel Bend tore down
      </div>
      <div style={{ fontFamily: 'Geist', fontWeight: 600, fontSize: 32, color: WHITE, opacity: 0.9, textShadow: TEXT_SHADOW, marginTop: 16, letterSpacing: '0.16em' }}>
        PILOT BUTTE INN · 1917–1973
      </div>
    </div>
  );
};

const CardShell: React.FC<{ children: React.ReactNode; bg: string; len: number; noFadeOut?: boolean }> = ({ children, bg, len, noFadeOut }) => {
  const frame = useCurrentFrame();
  const fadeIn = interpolate(frame, [0, XFADE], [0, 1], { extrapolateRight: 'clamp' });
  const fadeOut = noFadeOut ? 1 : interpolate(frame, [len - XFADE, len], [1, 0], { extrapolateLeft: 'clamp' });
  return (
    <AbsoluteFill style={{ background: bg, opacity: Math.min(fadeIn, fadeOut), justifyContent: 'center', alignItems: 'center' }}>
      {children}
    </AbsoluteFill>
  );
};

const CardNrhp: React.FC = () => {
  const frame = useCurrentFrame();
  const rise = interpolate(frame, [0, 16], [12, 0], { extrapolateRight: 'clamp' });
  return (
    <CardShell bg={CREAM} len={120}>
      <div style={{ width: 880, textAlign: 'center', transform: `translateY(${rise}px)` }}>
        <div style={{ fontFamily: 'Geist', fontWeight: 600, fontSize: 38, color: NAVY, opacity: 0.65, letterSpacing: '0.18em' }}>JUNE 24, 1972</div>
        <div style={{ width: 64, height: 2, background: NAVY, opacity: 0.25, margin: '34px auto' }} />
        <div style={{ fontFamily: 'Amboqia', fontSize: 84, lineHeight: 1.16, color: NAVY }}>National Register of Historic Places</div>
        <div style={{ fontFamily: 'Geist', fontWeight: 500, fontSize: 36, color: NAVY, opacity: 0.8, marginTop: 34 }}>the first in Deschutes County</div>
      </div>
    </CardShell>
  );
};

const CardDemo: React.FC = () => {
  const frame = useCurrentFrame();
  const reveal = interpolate(frame, [10, 26], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <CardShell bg={NAVY} len={104}>
      <div style={{ width: 880, textAlign: 'center' }}>
        <div style={{ fontFamily: 'Geist', fontWeight: 600, fontSize: 38, color: CREAM, opacity: 0.6, letterSpacing: '0.18em' }}>JUNE 1973</div>
        <div style={{ width: 64, height: 2, background: CREAM, opacity: 0.2, margin: '34px auto' }} />
        <div style={{ fontFamily: 'Amboqia', fontSize: 116, color: CREAM, opacity: reveal }}>demolished</div>
      </div>
    </CardShell>
  );
};

const CardEnd: React.FC = () => (
  <CardShell bg={NAVY} len={53} noFadeOut>
    <Img src={staticFile('brand/stacked_logo_white.png')} style={{ width: 500 }} />
    <div style={{ fontFamily: 'Geist', fontWeight: 500, fontSize: 32, color: CREAM, opacity: 0.85, marginTop: 46, letterSpacing: '0.16em' }}>
      THEN &amp; NOW · BEND · OREGON
    </div>
    <div style={{ fontFamily: 'Geist', fontWeight: 500, fontSize: 22, color: CREAM, opacity: 0.5, marginTop: 22, letterSpacing: '0.08em' }}>
      archival photographs · AI-animated · sources in caption
    </div>
  </CardShell>
);

export const ThenAndNowEp1: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: CREAM }}>
      {/* faint navy wash at the very top and bottom of the canvas keeps the
          cream field from reading flat on small screens */}
      <AbsoluteFill
        style={{
          background:
            'linear-gradient(180deg, rgba(16,39,66,0.10) 0%, rgba(16,39,66,0.02) 12%, rgba(16,39,66,0) 30%, rgba(16,39,66,0) 72%, rgba(16,39,66,0.06) 100%)',
        }}
      />

      {BEATS.map((b, i) => (
        <Sequence key={b.id} from={b.from} durationInFrames={b.to - b.from} name={b.id}>
          {b.media.kind === 'card' ? (
            b.media.card === 'nrhp' ? <CardNrhp /> : b.media.card === 'demo' ? <CardDemo /> : <CardEnd />
          ) : (
            <PlateBeat beat={b} index={i} />
          )}
        </Sequence>
      ))}

      <Sequence from={0} durationInFrames={118} name="headline">
        <HookHeadline />
      </Sequence>

      <Grain />

      <Audio src={staticFile('then-now/vo/ep1.mp3')} />

      <SingleWordCaption words={EP1_WORDS} suppressBeforeSec={4.2} suppressFrames={SUPPRESS} />
    </AbsoluteFill>
  );
};
