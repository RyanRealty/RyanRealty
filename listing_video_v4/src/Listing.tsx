// Listing.tsx — Schoolhouse v5.3 composition
// 1080×1920 portrait, 30fps, ~122.5s total
//
// v5.3 changes vs v5.2:
//   - Younger William portrait (02_william_plutarch_vandevert) replaces the older with-cane shot
//   - Family rockpile pan: multi_point_pan in WIDE-MODE so img is naturally wider than frame
//     (no more pan-into-black-space). Direction reversed to true L→R per Matt.
//   - Surrey pan amplitude bumped to actually traverse the whole group
//   - Sheep dip beat REMOVED. Replaced with vr_people_on_footbridge — kids on bridge
//     over water. Cinemagraph water_ripple mask brings the river surface to life.
//   - Barn / Newberry Crater: cinemagraph sky_drift mask = subtle cloud drift
//   - Hero exterior #2 = vignetteLetterbox mode (whole horizontal photo with
//     soft gradient bands top + bottom), photo shows the WHOLE house
//   - Window + Bachelor (#11): cinemagraph sky_drift on the upper sky area only
//   - All major interior beats use gimbal_walk: compound pan + push + bob, real
//     walkthrough register, not basic zoom
//   - Primary bath swapped: #29 (tub-only) -> #30 (walk-in shower w/ stonework)
//   - Beat 17 fire patio: cinemagraph flame_flicker mask on the fireplace area
//   - Beat 18: replaces #88 (horse, was mislabeled as elk) with
//     vr_elk_ford_little_deschutes — the actual elk fording the river photo
//   - Beat 21 closing aerial swapped: #60 -> #62 (pond-facing rear of home),
//     gimbal_walk pan instead of pull_out
//   - All historic photos carry a small white credit line at the bottom
//   - VO: drops sheep_dip line, splits ranch life into surrey + bridge,
//     adds short s05b "Built to wear in" between Locati and the spec line,
//     'meadow' -> 'river' on the elk line, 'duh-shoots' phonetic on Deschutes,
//     'trout fill the streams' added to s10
//   - VO sequencing reflows so no two adjacent VOs overlap
//   - Closing reveal adds 56111 SCHOOLHOUSE ROAD / VANDEVERT RANCH

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
import { BrandOutro } from './BrandOutro';
import { OpenSequence } from './OpenSequence';
import { PhotoBeat, CinemagraphMotion } from './PhotoBeat';
import { CameraMoveOpts } from './cameraMoves';
import { clamp, easeOutCubic } from './easing';

const FPS = 30;
export const LISTING_TOTAL_SEC = 122.5;

const VR_CREDIT = 'Photo: Vandevert Ranch family archive / vandevertranch.org';
const VR_HAYNES_CREDIT = 'Photo: Ted Haynes / vandevertranch.org';
const ELK_CREDIT = 'Photo: David M. / vandevertranch.org';
const LOCATI_CREDIT = 'Photo: Locati Architects';
const SNOWDRIFT_CREDIT = 'Photo: Snowdrift Visuals';

type BeatDef = {
  photo: string;
  startSec: number;
  durationSec: number;
  move: CameraMoveOpts;
  historic: boolean;
  cinemagraph?: CinemagraphMotion;
  vignetteLetterbox?: boolean;
  credit?: string;
};

const BEATS: BeatDef[] = [
  // === Act 1: Family (3 beats, brief) =========================================
  // Beat 1 — Sadie young
  { photo: 'v5_library/historic/vr_sadie_girl.jpg',
    startSec: 7, durationSec: 6,
    move: { move: 'push_counter', focal: 'center', intensity: 0.6, counterDir: 'left' },
    historic: true,
    credit: VR_CREDIT },
  // Beat 2 — William YOUNGER (was 03_william_p_with_cane). Same age range as Sadie.
  { photo: 'v5_library/historic/02_william_plutarch_vandevert.jpg',
    startSec: 13, durationSec: 6,
    move: { move: 'push_counter', focal: 'center', intensity: 0.6, counterDir: 'right' },
    historic: true,
    credit: VR_CREDIT },
  // Beat 3 — Family rockpile WIDE-MODE pan, L→R, traverses every face
  // anchors [+30, 0, -30] = camera reveals LEFT→CENTER→RIGHT
  { photo: 'v5_library/historic/09_family_rockpile.jpg',
    startSec: 19, durationSec: 7,
    move: { move: 'multi_point_pan', focal: 'center', intensity: 1.0,
      anchors: [{x:30,y:0,scale:1.04},{x:0,y:0,scale:1.06},{x:-30,y:0,scale:1.04}] },
    historic: true,
    credit: VR_CREDIT },

  // === Act 2: Ranch life (2 beats) ============================================
  // Beat 4 — surrey, slow_pan_lr WIDE-MODE, real traverse across the family
  { photo: 'v5_library/historic/vr_people_with_surrey.jpg',
    startSec: 26, durationSec: 5,
    move: { move: 'slow_pan_lr', focal: 'center', intensity: 1.4 },
    historic: true,
    credit: VR_CREDIT },
  // Beat 5 — footbridge (replaces sheep_dip). Cinemagraph: water ripple under bridge.
  { photo: 'v5_library/historic/vr_people_on_footbridge.jpg',
    startSec: 31, durationSec: 7.5,
    move: { move: 'push_in', focal: 'center', intensity: 0.6 },
    historic: true,
    cinemagraph: { mask: 'v5_library/masks/mask_footbridge_water.png', type: 'water_ripple' },
    credit: VR_CREDIT },

  // === Act 3: Bridge to modern ================================================
  // Beat 6 — barn / Newberry Crater. Cinemagraph: slow cloud drift in sky.
  { photo: 'v5_library/historic/vr_barn_newberry_crater.jpg',
    startSec: 38.5, durationSec: 5.5,
    move: { move: 'push_in', focal: 'center', intensity: 0.5 },
    historic: false,
    cinemagraph: { mask: 'v5_library/masks/mask_barn_sky.png', type: 'sky_drift' },
    credit: VR_HAYNES_CREDIT },

  // === Act 4: Architect & entry ===============================================
  { photo: 'v5_library/historic/architect_locati.jpg',
    startSec: 44, durationSec: 5,
    move: { move: 'push_counter', focal: 'center', intensity: 1.0, counterDir: 'left' },
    historic: true,
    credit: LOCATI_CREDIT },
  { photo: 'v5_library/modern/5-web-or-mls-_DSC0771.jpg',
    startSec: 49, durationSec: 4,
    move: { move: 'push_in', focal: 'center', intensity: 1.5 },
    historic: false },

  // === Act 5: Modern home tour ================================================
  // Beat 9 — hero exterior in VIGNETTE-LETTERBOX mode (show the whole horizontal house).
  { photo: 'v5_library/modern/2-web-or-mls-_DSC1055.jpg',
    startSec: 53, durationSec: 4,
    move: { move: 'push_in', focal: 'center', intensity: 0.3 },
    historic: false,
    vignetteLetterbox: true },
  // Beat 10 — window + Mt. Bachelor. Cinemagraph: subtle cloud drift in upper sky region.
  { photo: 'v5_library/modern/11-web-or-mls-_DSC0950.jpg',
    startSec: 57, durationSec: 5,
    move: { move: 'push_in', focal: 'center', intensity: 1.6 },
    historic: false,
    cinemagraph: { mask: 'v5_library/masks/mask_window_sky.png', type: 'sky_drift' } },
  // Beat 11 — hearth. gimbal_walk for real walkthrough register.
  { photo: 'v5_library/modern/13-web-or-mls-_DSC0810.jpg',
    startSec: 62, durationSec: 4.5,
    move: { move: 'gimbal_walk', focal: 'center', intensity: 1.0, direction: 'lr' },
    historic: false },
  // Beat 12 — dining/kitchen. gimbal_walk.
  { photo: 'v5_library/modern/17-web-or-mls-_DSC0836.jpg',
    startSec: 66.5, durationSec: 4.5,
    move: { move: 'gimbal_walk', focal: 'center', intensity: 1.0, direction: 'lr' },
    historic: false },
  // Beat 13 — primary bedroom. gimbal_walk RL.
  { photo: 'v5_library/modern/25-web-or-mls-_DSC0898.jpg',
    startSec: 71, durationSec: 4,
    move: { move: 'gimbal_walk', focal: 'center', intensity: 0.9, direction: 'rl' },
    historic: false },
  // Beat 14 — view doors HERO push (this is the money shot).
  { photo: 'v5_library/modern/27-web-or-mls-_DSC0961.jpg',
    startSec: 75, durationSec: 4,
    move: { move: 'push_in', focal: 'center', intensity: 1.3 },
    historic: false },
  // Beat 15 — sunroom. gimbal_walk LR.
  { photo: 'v5_library/modern/28-web-or-mls-_DSC1010.jpg',
    startSec: 79, durationSec: 4.5,
    move: { move: 'gimbal_walk', focal: 'center', intensity: 0.9, direction: 'lr' },
    historic: false },
  // Beat 16 — primary bath SWAPPED to #30 walk-in shower w/ stonework. gimbal_walk LR.
  { photo: 'v5_library/modern/30-web-or-mls-_DSC0930.jpg',
    startSec: 83.5, durationSec: 4,
    move: { move: 'gimbal_walk', focal: 'center', intensity: 0.8, direction: 'lr' },
    historic: false },
  // Beat 17 — fire patio. Cinemagraph: flame flicker mask on the fireplace.
  { photo: 'v5_library/modern/52-web-or-mls-_DSC1022.jpg',
    startSec: 87.5, durationSec: 5,
    move: { move: 'push_counter', focal: 'center', intensity: 0.5, counterDir: 'right' },
    historic: false,
    cinemagraph: { mask: 'v5_library/masks/mask_fire_patio.png', type: 'flame_flicker' } },

  // === Act 6: Outdoor / wildlife ==============================================
  // Beat 18 — elk fording the river. Replaces the horse close-up. Cinemagraph: river flow.
  { photo: 'v5_library/historic/vr_elk_ford_little_deschutes.jpg',
    startSec: 92.5, durationSec: 4.5,
    move: { move: 'push_in', focal: 'center', intensity: 0.5 },
    historic: false,
    cinemagraph: { mask: 'v5_library/masks/mask_elk_river.png', type: 'water_flow' },
    credit: ELK_CREDIT },
  // Beat 19 — elk herd in the meadow.
  { photo: 'v5_library/modern/86-web-or-mls-_DSC1090.jpg',
    startSec: 97, durationSec: 4,
    move: { move: 'slow_pan_lr', focal: 'center', intensity: 0.9 },
    historic: false },

  // === Act 7: River and aerial close ==========================================
  // Beat 20 — Snowdrift area guide.
  { photo: 'v5_library/snowdrift/Area Guide - Vandevert Ranch - 02.JPG',
    startSec: 101, durationSec: 8.5,
    move: { move: 'push_in', focal: 'center', intensity: 0.4 },
    historic: false,
    credit: SNOWDRIFT_CREDIT },
  // Beat 21 — POND-side aerial of the home (was front-facing #60). gimbal_walk pan.
  { photo: 'v5_library/modern/62-web-or-mls-DJI_20260127142754_0088_D.jpg',
    startSec: 109.5, durationSec: 5,
    move: { move: 'gimbal_walk', focal: 'center', intensity: 0.7, direction: 'lr' },
    historic: false },
];

// ─── ClosingReveal staged text (with address per Matt) ───────────────────────
const RevealInner: React.FC<{ durationSec: number }> = ({ durationSec }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const navyAlpha = clamp(t / 0.4, 0, 1);
  const pendingAlpha = clamp((t - 0.3) / 0.4, 0, 1);
  const pendingScale = 1.2 - 0.2 * easeOutCubic(clamp((t - 0.3) / 0.4, 0, 1));
  const priceAlpha = clamp((t - 0.7) / 0.6, 0, 1);
  const priceTranslate = (1 - easeOutCubic(clamp((t - 0.7) / 0.6, 0, 1))) * 16;
  const addressAlpha = clamp((t - 1.5) / 0.6, 0, 1);
  const addressTranslate = (1 - easeOutCubic(clamp((t - 1.5) / 0.6, 0, 1))) * 12;
  const brokerageAlpha = clamp((t - 2.4) / 0.7, 0, 1);
  return (
    <AbsoluteFill style={{ background: NAVY, opacity: navyAlpha }}>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: 56, fontWeight: 700, color: GOLD, letterSpacing: '0.16em', opacity: pendingAlpha, transform: `scale(${pendingScale})`, marginBottom: 16 }}>PENDING</div>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: 96, fontWeight: 400, color: CREAM, letterSpacing: '-0.01em', opacity: priceAlpha, transform: `translateY(${priceTranslate}px)`, marginBottom: 28 }}>$3,025,000</div>
        <div style={{ fontFamily: FONT_SANS, fontSize: 22, fontWeight: 600, color: CREAM, letterSpacing: '0.18em', textTransform: 'uppercase', opacity: addressAlpha, transform: `translateY(${addressTranslate}px)`, textAlign: 'center', lineHeight: 1.5 }}>
          56111 SCHOOLHOUSE ROAD
          <br />
          VANDEVERT RANCH
        </div>
        <div style={{ marginTop: 36, fontFamily: FONT_SANS, fontSize: 22, fontWeight: 600, color: GOLD, letterSpacing: '0.30em', textTransform: 'uppercase', opacity: brokerageAlpha }}>REPRESENTED BY RYAN REALTY</div>
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
      scrim="none"
      crossfadeIn={0.5}
      crossfadeOut={0.5}
    />
  );
};

// ─── Main composition ────────────────────────────────────────────────────────
export const Listing: React.FC = () => {
  // Music volume curve for v5.3 (122.5s)
  const musicVolume = (frame: number) => {
    const t = frame / FPS;
    if (t < 7) return interpolate(t, [0, 7], [0.30, 0.55], { extrapolateRight: 'clamp' });
    if (t < 8) return interpolate(t, [7, 8], [0.55, 0.20]);
    if (t < 113) return 0.20;
    if (t < 114.5) return interpolate(t, [113, 114.5], [0.20, 0.45]);
    if (t < 117) return 0.45;
    if (t < 119) return interpolate(t, [117, 119], [0.45, 0.0], { extrapolateRight: 'clamp' });
    return 0;
  };

  // VO sequencing — start times tuned so no two adjacent sentences overlap.
  const VO = [
    { src: 'audio/v51_s01.mp3',  startSec: 7.5  },   // 8.62s — Beats 1+2 family
    { src: 'audio/v51_s02.mp3',  startSec: 19.8 },   // 2.46s — Beat 3 rockpile
    { src: 'audio/v53_s03a.mp3', startSec: 26.5 },   // 4.49s — Beat 4 surrey
    { src: 'audio/v53_s03b.mp3', startSec: 31.5 },   // 6.45s — Beat 5 footbridge
    { src: 'audio/v53_s04.mp3',  startSec: 39.0 },   // 4.73s — Beat 6 barn
    { src: 'audio/v51_s05.mp3',  startSec: 44.5 },   // 8.67s — Beats 7+8 architect+entry
    { src: 'audio/v53_s05b.mp3', startSec: 54.0 },   // 1.75s — Beat 9 hero ext
    { src: 'audio/v51_s06.mp3',  startSec: 57.0 },   // 10.68s — Beats 10+11 modern intro
    { src: 'audio/v51_s07.mp3',  startSec: 79.5 },   // 4.60s — Beat 15 sunroom
    { src: 'audio/v51_s08.mp3',  startSec: 88.0 },   // 3.16s — Beat 17 fire patio
    { src: 'audio/v53_s09.mp3',  startSec: 93.0 },   // 2.82s — Beat 18 elk river
    { src: 'audio/v53_s10.mp3',  startSec: 101.5 },  // 7.76s — Beat 20 Snowdrift
    { src: 'audio/v51_s11.mp3',  startSec: 110.0 },  // 4.18s — Beat 21 closing line
  ];

  return (
    <AbsoluteFill style={{ background: CHARCOAL }}>
      <Audio src={staticFile('audio/music_bed_v5.mp3')} volume={musicVolume} />

      {VO.map((v, i) => (
        <Sequence key={i} from={Math.round(v.startSec * FPS)} durationInFrames={Math.round(15 * FPS)}>
          <Audio src={staticFile(v.src)} volume={1.0} />
        </Sequence>
      ))}

      <Sequence from={0} durationInFrames={Math.round(7 * FPS)}>
        <OpenSequence />
      </Sequence>

      {BEATS.map((beat, i) => (
        <Sequence key={i} from={Math.round(beat.startSec * FPS)} durationInFrames={Math.round(beat.durationSec * FPS)}>
          <BeatWrapper beat={beat} />
        </Sequence>
      ))}

      <Sequence from={Math.round(114.5 * FPS)} durationInFrames={Math.round(5 * FPS)}>
        <RevealInner durationSec={5} />
      </Sequence>

      <BrandOutro startFrame={Math.round(119.5 * FPS)} durationSec={3} />
    </AbsoluteFill>
  );
};
