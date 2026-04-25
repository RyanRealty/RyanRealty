// Listing.tsx — Schoolhouse v5.8 VIRAL REELS CUT (45s)
// 1080×1920 portrait, 30fps, 45s total
//
// Per ../VIRAL_VIDEO_CONSTRAINTS.md:
//   - 45s target, 60s hard cap
//   - Frame 0 is the strongest visual (hero exterior + address overlay).
//     No boundary draw, no title card open.
//   - Text hook on screen by 0.5s, VO content by 2s.
//   - 13 photo beats at 2.5-3s each. No beat over 4s.
//   - Pattern interrupt at 25% (~11s) and 50% (~22.5s, history block).
//   - Reveal in final 15% (kinetic stat moment, no brokerage attribution).
//   - Music plays from frame 1.
//   - Zero brand elements in the video frame.

import React from 'react';
import {
  AbsoluteFill,
  Audio,
  interpolate,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { CHARCOAL, CREAM, GOLD, NAVY, FONT_SANS } from './brand';
import { PhotoBeat, CinemagraphMotion } from './PhotoBeat';
import { CameraMoveOpts } from './cameraMoves';
import { clamp, easeOutCubic } from './easing';

const FPS = 30;
export const LISTING_TOTAL_SEC = 45.0;

const VR_CREDIT = 'Photo: Vandevert Ranch family archive / vandevertranch.org';
const VR_HAYNES_CREDIT = 'Photo: Ted Haynes / vandevertranch.org';
const ELK_CREDIT = 'Photo: David M. / vandevertranch.org';
const LOCATI_CREDIT = 'Photo: Locati Architects';

type BeatDef = {
  photo: string;
  startSec: number;
  durationSec: number;
  move: CameraMoveOpts;
  historic: boolean;
  cinemagraph?: CinemagraphMotion;
  vignetteLetterbox?: boolean;
  credit?: string;
  objectPosition?: string;
  title?: string;
  sub?: string;
  titlePosition?: 'top' | 'bottom' | 'center' | 'none';
  crossfadeIn?: number;
  crossfadeOut?: number;
};

const BEATS: BeatDef[] = [
  // === HOOK (0-3s) — address over hero exterior. Strongest visual on frame 0.
  // Hook VO "This one never hit the market." plays 0.4–2.3s.
  { photo: 'v5_library/modern/2-web-or-mls-_DSC1055.jpg',
    startSec: 0, durationSec: 3,
    move: { move: 'still', focal: 'center', intensity: 1.0 },
    historic: false,
    vignetteLetterbox: true,
    title: '56111 SCHOOLHOUSE ROAD',
    sub: 'Vandevert Ranch · Bend, OR',
    titlePosition: 'center',
    crossfadeIn: 0 },

  // === Hero interiors (3-22s) — front-loaded for retention =================
  { photo: 'v5_library/modern/11-web-or-mls-_DSC0950.jpg',
    startSec: 3, durationSec: 3,
    move: { move: 'push_in', focal: 'center', intensity: 1.6 },
    historic: false,
    cinemagraph: { mask: 'v5_library/masks/mask_window_sky.png', type: 'sky_drift' } },
  { photo: 'v5_library/modern/27-web-or-mls-_DSC0961.jpg',
    startSec: 6, durationSec: 3,
    move: { move: 'push_in', focal: 'center', intensity: 1.3 },
    historic: false },
  // 25% mark (~11.25s) — re-hook into interior craft register.
  { photo: 'v5_library/modern/13-web-or-mls-_DSC0810.jpg',
    startSec: 9, durationSec: 2.5,
    move: { move: 'gimbal_walk', focal: 'center', intensity: 1.0, direction: 'lr' },
    historic: false },
  { photo: 'v5_library/modern/17-web-or-mls-_DSC0836.jpg',
    startSec: 11.5, durationSec: 2.5,
    move: { move: 'gimbal_walk', focal: 'center', intensity: 1.0, direction: 'lr' },
    historic: false },
  { photo: 'v5_library/modern/25-web-or-mls-_DSC0898.jpg',
    startSec: 14, durationSec: 2.5,
    move: { move: 'gimbal_walk', focal: 'center', intensity: 0.9, direction: 'rl' },
    historic: false },
  { photo: 'v5_library/modern/30-web-or-mls-_DSC0930.jpg',
    startSec: 16.5, durationSec: 2.5,
    move: { move: 'gimbal_walk', focal: 'center', intensity: 0.8, direction: 'lr' },
    historic: false },
  { photo: 'v5_library/modern/52-web-or-mls-_DSC1022.jpg',
    startSec: 19, durationSec: 3,
    move: { move: 'push_in', focal: 'center', intensity: 0.4 },
    historic: false,
    cinemagraph: { mask: 'v5_library/masks/mask_fire_patio.png', type: 'flame_flicker' },
    objectPosition: '88% 50%' },

  // === 50% mark (22-32.5s) — pattern interrupt: history block =============
  // Sepia portraits cut sharply against luxury color photos. Algorithm
  // signal: viewer keeps watching to find out why a sold luxury property
  // is suddenly showing 1890s family portraits.
  { photo: 'v5_library/historic/vr_sadie_girl.jpg',
    startSec: 22, durationSec: 2.5,
    move: { move: 'push_counter', focal: 'center', intensity: 0.6, counterDir: 'left' },
    historic: true,
    credit: VR_CREDIT },
  { photo: 'v5_library/historic/02_william_plutarch_vandevert.jpg',
    startSec: 24.5, durationSec: 2.5,
    move: { move: 'push_counter', focal: 'center', intensity: 0.6, counterDir: 'right' },
    historic: true,
    credit: VR_CREDIT },
  { photo: 'v5_library/historic/09_family_rockpile.jpg',
    startSec: 27, durationSec: 2.5,
    move: { move: 'multi_point_pan', focal: 'center', intensity: 1.0,
      anchors: [{x:30,y:0,scale:1.04},{x:0,y:0,scale:1.06},{x:-30,y:0,scale:1.04}] },
    historic: true,
    credit: VR_CREDIT },
  { photo: 'v5_library/historic/vr_barn_newberry_crater.jpg',
    startSec: 29.5, durationSec: 3,
    move: { move: 'push_in', focal: 'center', intensity: 0.5 },
    historic: false,
    cinemagraph: { mask: 'v5_library/masks/mask_barn_sky.png', type: 'sky_drift' },
    credit: VR_HAYNES_CREDIT },
  { photo: 'v5_library/historic/architect_locati.jpg',
    startSec: 32.5, durationSec: 3,
    move: { move: 'push_counter', focal: 'center', intensity: 1.0, counterDir: 'left' },
    historic: true,
    credit: LOCATI_CREDIT },

  // === Visual peak + close (35.5-41s) =====================================
  { photo: 'v5_library/historic/vr_elk_ford_little_deschutes.jpg',
    startSec: 35.5, durationSec: 3,
    move: { move: 'still', focal: 'center', intensity: 1.0 },
    historic: false,
    cinemagraph: { mask: 'v5_library/masks/mask_elk_river.png', type: 'water_flow' },
    vignetteLetterbox: true,
    credit: ELK_CREDIT },
  { photo: 'v5_library/modern/62-web-or-mls-DJI_20260127142754_0088_D.jpg',
    startSec: 38.5, durationSec: 2.5,
    move: { move: 'gimbal_walk', focal: 'center', intensity: 0.5, direction: 'lr' },
    historic: false,
    crossfadeOut: 0 },
];

// ─── Reveal — kinetic stat moment ─────────────────────────────────────────
// PENDING / $3,025,000 / address. NO brokerage line, NO logo.
// Final 15% of runtime (41-45s = 4s).
const RevealInner: React.FC<{ durationSec: number }> = ({ durationSec }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const navyAlpha = clamp(t / 0.4, 0, 1);
  const pendingAlpha = clamp((t - 0.4) / 0.4, 0, 1);
  const pendingScale = 1.2 - 0.2 * easeOutCubic(clamp((t - 0.4) / 0.4, 0, 1));
  const priceAlpha = clamp((t - 0.9) / 0.5, 0, 1);
  const priceTranslate = (1 - easeOutCubic(clamp((t - 0.9) / 0.5, 0, 1))) * 16;
  const addressAlpha = clamp((t - 1.6) / 0.5, 0, 1);
  const addressTranslate = (1 - easeOutCubic(clamp((t - 1.6) / 0.5, 0, 1))) * 12;
  return (
    <AbsoluteFill style={{ background: NAVY, opacity: navyAlpha }}>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: 60, fontWeight: 700, color: GOLD, letterSpacing: '0.18em', opacity: pendingAlpha, transform: `scale(${pendingScale})`, marginBottom: 18 }}>PENDING</div>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: 110, fontWeight: 400, color: CREAM, letterSpacing: '-0.01em', opacity: priceAlpha, transform: `translateY(${priceTranslate}px)`, marginBottom: 32 }}>$3,025,000</div>
        <div style={{ fontFamily: FONT_SANS, fontSize: 26, fontWeight: 600, color: CREAM, letterSpacing: '0.18em', textTransform: 'uppercase', opacity: addressAlpha, transform: `translateY(${addressTranslate}px)`, textAlign: 'center', lineHeight: 1.5 }}>
          56111 SCHOOLHOUSE ROAD
          <br />
          VANDEVERT RANCH
        </div>
      </div>
    </AbsoluteFill>
  );
};

const BeatWrapper: React.FC<{ beat: BeatDef }> = ({ beat }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <PhotoBeat
      photo={beat.photo}
      local={frame / fps}
      fps={fps}
      durationSec={beat.durationSec}
      move={beat.move}
      historic={beat.historic}
      vignetteLetterbox={beat.vignetteLetterbox}
      cinemagraph={beat.cinemagraph}
      credit={beat.credit}
      objectPosition={beat.objectPosition}
      title={beat.title}
      sub={beat.sub}
      titlePosition={beat.titlePosition ?? 'none'}
      scrim={beat.title ? 'full' : 'none'}
      crossfadeIn={beat.crossfadeIn ?? 0.4}
      crossfadeOut={beat.crossfadeOut ?? 0}
    />
  );
};

export const Listing: React.FC = () => {
  // Music starts frame 1, ducks under VO blocks, swells into reveal.
  const musicVolume = (frame: number) => {
    const t = frame / FPS;
    if (t < 0.3) return 0.45;                                                       // music ON from frame 1
    if (t < 2.5) return 0.30;                                                       // ducked under hook VO
    if (t < 3) return interpolate(t, [2.5, 3], [0.30, 0.55]);                       // up after hook
    if (t < 22) return 0.55;                                                        // bed under home tour
    if (t < 22.5) return interpolate(t, [22, 22.5], [0.55, 0.30]);                  // duck for history VO
    if (t < 35.5) return 0.30;                                                       // ducked under history block
    if (t < 41) return interpolate(t, [35.5, 41], [0.30, 0.60]);                    // swell toward reveal
    if (t < 42) return 0.60;
    if (t < 45) return interpolate(t, [42, 45], [0.60, 0.0], { extrapolateRight: 'clamp' });
    return 0;
  };

  // VO — 4 lines. No closing line in audio (reveal kinetic-stat carries the close).
  const VO = [
    { src: 'audio/v58_hook.mp3',         startSec: 0.4   },  // 1.93s — hook "This one never hit the market."
    { src: 'audio/v58_history.mp3',      startSec: 22.5  },  // 5.67s — pattern interrupt: history (Sadie + William)
    { src: 'audio/v58_subdivision.mp3',  startSec: 28.5  },  // 4.49s — payoff (Rockpile + Barn 1970)
    { src: 'audio/v58_locati.mp3',       startSec: 33.0  },  // 2.09s — architect tag
  ];

  return (
    <AbsoluteFill style={{ background: CHARCOAL }}>
      <Audio src={staticFile('audio/music_bed_v5.mp3')} volume={musicVolume} />

      {VO.map((v, i) => (
        <Sequence key={i} from={Math.round(v.startSec * FPS)} durationInFrames={Math.round(15 * FPS)}>
          <Audio src={staticFile(v.src)} volume={1.0} />
        </Sequence>
      ))}

      {BEATS.map((beat, i) => (
        <Sequence
          key={i}
          from={Math.round(Math.max(0, beat.startSec - 0.5) * FPS)}
          durationInFrames={Math.round((beat.durationSec + 0.5) * FPS)}
        >
          <BeatWrapper beat={beat} />
        </Sequence>
      ))}

      <Sequence from={Math.round(40.5 * FPS)} durationInFrames={Math.round(4.5 * FPS)}>
        <RevealInner durationSec={4.5} />
      </Sequence>
    </AbsoluteFill>
  );
};
