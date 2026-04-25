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
export const LISTING_TOTAL_SEC = 127.0;

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
  objectPosition?: string;
  /** Per-beat crossfade overrides (default 0.5 each) */
  crossfadeIn?: number;
  crossfadeOut?: number;
};

const BEATS: BeatDef[] = [
  // === Act 1: Family (3 beats) ================================================
  { photo: 'v5_library/historic/vr_sadie_girl.jpg',
    startSec: 7, durationSec: 6,
    move: { move: 'push_counter', focal: 'center', intensity: 0.6, counterDir: 'left' },
    historic: true,
    credit: VR_CREDIT },
  { photo: 'v5_library/historic/02_william_plutarch_vandevert.jpg',
    startSec: 13, durationSec: 6,
    move: { move: 'push_counter', focal: 'center', intensity: 0.6, counterDir: 'right' },
    historic: true,
    credit: VR_CREDIT },
  { photo: 'v5_library/historic/09_family_rockpile.jpg',
    startSec: 19, durationSec: 7,
    move: { move: 'multi_point_pan', focal: 'center', intensity: 1.0,
      anchors: [{x:30,y:0,scale:1.04},{x:0,y:0,scale:1.06},{x:-30,y:0,scale:1.04}] },
    historic: true,
    credit: VR_CREDIT },

  // === Act 2: Ranch life ======================================================
  { photo: 'v5_library/historic/vr_people_with_surrey.jpg',
    startSec: 26, durationSec: 5,
    move: { move: 'slow_pan_lr', focal: 'center', intensity: 1.4 },
    historic: true,
    credit: VR_CREDIT },
  { photo: 'v5_library/historic/vr_people_on_footbridge.jpg',
    startSec: 31, durationSec: 7,
    move: { move: 'push_in', focal: 'center', intensity: 0.6 },
    historic: true,
    cinemagraph: { mask: 'v5_library/masks/mask_footbridge_water.png', type: 'water_ripple' },
    credit: VR_CREDIT },

  // === Act 3: Subdivision bridge ==============================================
  // Beat 6 — barn / Newberry Crater. v5.6: extended to 8s for longer s04.
  { photo: 'v5_library/historic/vr_barn_newberry_crater.jpg',
    startSec: 38, durationSec: 8,
    move: { move: 'push_in', focal: 'center', intensity: 0.5 },
    historic: false,
    cinemagraph: { mask: 'v5_library/masks/mask_barn_sky.png', type: 'sky_drift' },
    credit: VR_HAYNES_CREDIT },

  // === Act 4: Architect & entry ===============================================
  { photo: 'v5_library/historic/architect_locati.jpg',
    startSec: 46, durationSec: 5,
    move: { move: 'push_counter', focal: 'center', intensity: 1.0, counterDir: 'left' },
    historic: true,
    credit: LOCATI_CREDIT },
  { photo: 'v5_library/modern/5-web-or-mls-_DSC0771.jpg',
    startSec: 51, durationSec: 4,
    move: { move: 'push_in', focal: 'center', intensity: 1.5 },
    historic: false },

  // === Act 5: Modern home tour ================================================
  // Beat 9 — hero exterior, vignetteLetterbox (blurred photo backdrop fills dead space).
  { photo: 'v5_library/modern/2-web-or-mls-_DSC1055.jpg',
    startSec: 55, durationSec: 4.5,
    move: { move: 'push_in', focal: 'center', intensity: 0.3 },
    historic: false,
    vignetteLetterbox: true },
  // Beat 10 — window + Mt. Bachelor. Cinemagraph sky_drift on upper sky.
  { photo: 'v5_library/modern/11-web-or-mls-_DSC0950.jpg',
    startSec: 59.5, durationSec: 5.5,
    move: { move: 'push_in', focal: 'center', intensity: 1.6 },
    historic: false,
    cinemagraph: { mask: 'v5_library/masks/mask_window_sky.png', type: 'sky_drift' } },
  // Beat 11 — hearth. gimbal_walk.
  { photo: 'v5_library/modern/13-web-or-mls-_DSC0810.jpg',
    startSec: 65, durationSec: 4.5,
    move: { move: 'gimbal_walk', focal: 'center', intensity: 1.0, direction: 'lr' },
    historic: false },
  // Beat 12 — dining/kitchen. v5.6: 7s for the longer s06c finishes line.
  { photo: 'v5_library/modern/17-web-or-mls-_DSC0836.jpg',
    startSec: 69.5, durationSec: 7,
    move: { move: 'gimbal_walk', focal: 'center', intensity: 1.0, direction: 'lr' },
    historic: false },
  // Beat 13 — primary bedroom.
  { photo: 'v5_library/modern/25-web-or-mls-_DSC0898.jpg',
    startSec: 76.5, durationSec: 4,
    move: { move: 'gimbal_walk', focal: 'center', intensity: 0.9, direction: 'rl' },
    historic: false },
  // Beat 14 — view doors HERO push.
  { photo: 'v5_library/modern/27-web-or-mls-_DSC0961.jpg',
    startSec: 80.5, durationSec: 4,
    move: { move: 'push_in', focal: 'center', intensity: 1.3 },
    historic: false },
  // Beat 15 — sunroom.
  { photo: 'v5_library/modern/28-web-or-mls-_DSC1010.jpg',
    startSec: 84.5, durationSec: 4,
    move: { move: 'gimbal_walk', focal: 'center', intensity: 0.9, direction: 'lr' },
    historic: false },
  // Beat 16 — primary bath walk-in shower.
  { photo: 'v5_library/modern/30-web-or-mls-_DSC0930.jpg',
    startSec: 88.5, durationSec: 4,
    move: { move: 'gimbal_walk', focal: 'center', intensity: 0.8, direction: 'lr' },
    historic: false },
  // Beat 17 — fire patio. objectPosition right-bias so fireplace is in frame.
  { photo: 'v5_library/modern/52-web-or-mls-_DSC1022.jpg',
    startSec: 92.5, durationSec: 5,
    move: { move: 'push_in', focal: 'center', intensity: 0.4 },
    historic: false,
    cinemagraph: { mask: 'v5_library/masks/mask_fire_patio.png', type: 'flame_flicker' },
    objectPosition: '88% 50%' },

  // === Act 6: Outdoor / wildlife ==============================================
  // Beat 18 — elk fording the river. STILL motion + vignetteLetterbox so the
  // whole photo stays in frame (both herd + lone elk visible). Cinemagraph
  // water_flow on the river.
  { photo: 'v5_library/historic/vr_elk_ford_little_deschutes.jpg',
    startSec: 97.5, durationSec: 5.5,
    move: { move: 'still', focal: 'center', intensity: 1.0 },
    historic: false,
    cinemagraph: { mask: 'v5_library/masks/mask_elk_river.png', type: 'water_flow' },
    vignetteLetterbox: true,
    credit: ELK_CREDIT },
  // v5.6: Beat 19 (elk herd #86) DROPPED — only one elk photo.

  // === Act 7: River and aerial close ==========================================
  // Beat 20 — Snowdrift area guide.
  { photo: 'v5_library/snowdrift/Area Guide - Vandevert Ranch - 02.JPG',
    startSec: 103, durationSec: 7,
    move: { move: 'push_in', focal: 'center', intensity: 0.4 },
    historic: false,
    credit: SNOWDRIFT_CREDIT },
  // Beat 21 — pond-facing aerial. v5.6: 8s long final hold. crossfadeOut 0 so
  // the photo stays at full opacity until the Reveal Sequence (started earlier
  // with overlap) has already faded its navy fully opaque on top. Eliminates
  // the dark/black flash that v5.6 v1 had at the Beat 21 → Reveal transition.
  { photo: 'v5_library/modern/62-web-or-mls-DJI_20260127142754_0088_D.jpg',
    startSec: 110, durationSec: 8,
    move: { move: 'gimbal_walk', focal: 'center', intensity: 0.5, direction: 'lr' },
    historic: false,
    crossfadeOut: 0 },
];

// ─── ClosingReveal staged text — v5.6: starts overlapped with Beat 21 so navy
// fades in fully on top of the still-visible photo (no charcoal flash). ──────
const RevealInner: React.FC<{ durationSec: number }> = ({ durationSec }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  // Navy fades in over 0.5s. Reveal Sequence starts 0.5s before Beat 21 ends,
  // so navy is fully opaque exactly when Beat 21's photo would otherwise vanish.
  const navyAlpha = clamp(t / 0.5, 0, 1);
  // All staged text shifted later by 0.5s to compensate for the earlier start.
  const pendingAlpha = clamp((t - 1.0) / 0.7, 0, 1);
  const pendingScale = 1.2 - 0.2 * easeOutCubic(clamp((t - 1.0) / 0.7, 0, 1));
  const priceAlpha = clamp((t - 1.8) / 0.9, 0, 1);
  const priceTranslate = (1 - easeOutCubic(clamp((t - 1.8) / 0.9, 0, 1))) * 16;
  const addressAlpha = clamp((t - 2.9) / 0.8, 0, 1);
  const addressTranslate = (1 - easeOutCubic(clamp((t - 2.9) / 0.8, 0, 1))) * 12;
  const brokerageAlpha = clamp((t - 4.1) / 0.9, 0, 1);
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
      objectPosition={beat.objectPosition}
      scrim="none"
      crossfadeIn={beat.crossfadeIn ?? 0.5}
      crossfadeOut={beat.crossfadeOut ?? 0}
    />
  );
};

// ─── Main composition ────────────────────────────────────────────────────────
export const Listing: React.FC = () => {
  // Music volume curve for v5.6 (~127s) — slower swell into the reveal.
  const musicVolume = (frame: number) => {
    const t = frame / FPS;
    if (t < 7) return interpolate(t, [0, 7], [0.30, 0.55], { extrapolateRight: 'clamp' });
    if (t < 8) return interpolate(t, [7, 8], [0.55, 0.20]);
    if (t < 115) return 0.20;
    if (t < 118) return interpolate(t, [115, 118], [0.20, 0.50]);
    if (t < 121.5) return 0.50;
    if (t < 124) return interpolate(t, [121.5, 124], [0.50, 0.0], { extrapolateRight: 'clamp' });
    return 0;
  };

  // v5.6 VO sequencing — re-synthed s04/s05/s05b/s06/s06c/s10/s11 with previous_text
  // chaining for prosody continuity. Beat 19 (second elk photo) dropped.
  // All adjacent gaps verified positive (no overlap).
  const VO = [
    { src: 'audio/v51_s01.mp3',  startSec: 7.5   },  // 8.62s — Beats 1+2
    { src: 'audio/v51_s02.mp3',  startSec: 19.8  },  // 2.46s — Beat 3
    { src: 'audio/v53_s03a.mp3', startSec: 26.5  },  // 4.49s — Beat 4 surrey
    { src: 'audio/v54_s03b.mp3', startSec: 31.5  },  // 2.69s — Beat 5 footbridge
    { src: 'audio/v56_s04.mp3',  startSec: 38.5  },  // 7.34s — Beat 6 barn (1970 subdivision)
    { src: 'audio/v56_s05.mp3',  startSec: 46.5  },  // 8.80s — Beats 7+8 architect+entry
    { src: 'audio/v56_s05b.mp3', startSec: 56.0  },  // 1.49s — Beat 9 hero ext "Made to wear in"
    { src: 'audio/v56_s06.mp3',  startSec: 60.0  },  // 10.89s — Beats 10+11 modern intro (Cascades)
    { src: 'audio/v56_s06c.mp3', startSec: 71.5  },  // 7.89s — Beat 12 dining finishes
    { src: 'audio/v54_s06b.mp3', startSec: 81.0  },  // 3.11s — Beat 14 view doors "looking glass"
    { src: 'audio/v51_s07.mp3',  startSec: 85.0  },  // 4.60s — Beat 15 sunroom
    { src: 'audio/v51_s08.mp3',  startSec: 93.0  },  // 3.16s — Beat 17 fire patio
    { src: 'audio/v53_s09.mp3',  startSec: 98.0  },  // 2.82s — Beat 18 elk river
    { src: 'audio/v56_s10.mp3',  startSec: 103.5 },  // 7.37s — Beat 20 Snowdrift (Deschutes literal)
    { src: 'audio/v56_s11.mp3',  startSec: 113.0 },  // 2.04s — Beat 21 "honored to be a part of it"
  ];

  return (
    <AbsoluteFill style={{ background: CHARCOAL }}>
      <Audio src={staticFile('audio/music_bed_v5.mp3')} volume={musicVolume} />

      {VO.map((v, i) => (
        <Sequence key={i} from={Math.round(v.startSec * FPS)} durationInFrames={Math.round(15 * FPS)}>
          <Audio src={staticFile(v.src)} volume={1.0} />
        </Sequence>
      ))}

      {/* OpenSequence runs 0.5s longer (7.5s) so Beat 1's fade-in (6.5–7.0)
          overlaps the open's final state. No charcoal flash at the transition. */}
      <Sequence from={0} durationInFrames={Math.round(7.5 * FPS)}>
        <OpenSequence />
      </Sequence>

      {/* Every beat Sequence starts 0.5s before its declared startSec and
          runs 0.5s longer. Combined with default crossfadeOut=0, the previous
          beat stays at full opacity while the next beat's crossfadeIn fades in
          on top of it — no AbsoluteFill background ever shows through during
          transitions. */}
      {BEATS.map((beat, i) => (
        <Sequence
          key={i}
          from={Math.round(Math.max(0, beat.startSec - 0.5) * FPS)}
          durationInFrames={Math.round((beat.durationSec + 0.5) * FPS)}
        >
          <BeatWrapper beat={beat} />
        </Sequence>
      ))}

      <Sequence from={Math.round(117.5 * FPS)} durationInFrames={Math.round(6.5 * FPS)}>
        <RevealInner durationSec={6.5} />
      </Sequence>

      <BrandOutro startFrame={Math.round(124 * FPS)} durationSec={3} />
    </AbsoluteFill>
  );
};
