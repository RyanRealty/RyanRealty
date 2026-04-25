// Listing.tsx — Schoolhouse v5 full composition
// 1080×1920 portrait, 30fps, 144.0s total
// 27 photo beats + boundary open (7s) + closing reveal (5s) + brand outro (2.5s)
//
// Timeline:
//   0-7s     OpenSequence (boundary draw, 1892. → VANDEVERT RANCH → brokerage)
//   7-136.5s 27 photo beats
//   136.5s   ClosingReveal (5s)
//   141.5s   BrandOutro (2.5s)
//   144.0s   END

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
import { PhotoBeat } from './PhotoBeat';
import { clamp, easeOutCubic, easeOutQuart } from './easing';

const FPS = 30;

// ─── Total duration ────────────────────────────────────────────────────────────
export const LISTING_TOTAL_SEC = 144.0;

// ─── Beat definition ──────────────────────────────────────────────────────────
// All times are absolute seconds from composition start.
// PhotoBeat receives `local` = time within that beat (0..durationSec).

type BeatDef = {
  photo: string;     // path under public/images/ (PhotoBeat uses staticFile(`images/${photo}`))
  startSec: number;
  durationSec: number;
  move: import('./cameraMoves').CameraMoveOpts;
  historic: boolean;
};

// Photos live in public/v5_library/*; PhotoBeat prefixes with images/ —
// so paths here are relative to public/images/, which means v5_library/...

const BEATS: BeatDef[] = [
  // ─── Beat 1 — vr_sadie_girl.jpg (historic portrait) ─────────────────────
  // t=7-13, 6s, push_counter right
  {
    photo: 'v5_library/historic/vr_sadie_girl.jpg',
    startSec: 7,
    durationSec: 6,
    move: { move: 'push_counter', focal: 'center', intensity: 0.9, counterDir: 'right' },
    historic: true,
  },

  // ─── Beat 2 — 03_william_p_with_cane.jpg (historic portrait) ─────────────
  // t=13-19, 6s, push_counter left (opposite to beat 1)
  {
    photo: 'v5_library/historic/03_william_p_with_cane.jpg',
    startSec: 13,
    durationSec: 6,
    move: { move: 'push_counter', focal: 'center', intensity: 0.9, counterDir: 'left' },
    historic: true,
  },

  // ─── Beat 3 — 09_family_rockpile.jpg (historic landscape) ────────────────
  // t=19-25, 6s, multi_point_pan
  {
    photo: 'v5_library/historic/09_family_rockpile.jpg',
    startSec: 19,
    durationSec: 6,
    move: {
      move: 'multi_point_pan',
      focal: 'center',
      intensity: 1.0,
      anchors: [
        { x: -4, y: -1, scale: 1.08 },
        { x: 0, y: 0, scale: 1.13 },
        { x: 4, y: 1, scale: 1.18 },
      ],
    },
    historic: true,
  },

  // ─── Beat 4 — vr_workshop_barn_looking_east.jpg (historic landscape) ──────
  // t=25-30, 5s, multi_point_pan
  {
    photo: 'v5_library/historic/vr_workshop_barn_looking_east.jpg',
    startSec: 25,
    durationSec: 5,
    move: {
      move: 'multi_point_pan',
      focal: 'center',
      intensity: 1.0,
      anchors: [
        { x: -3, y: -1, scale: 1.08 },
        { x: 0, y: 0, scale: 1.12 },
        { x: 3, y: 1, scale: 1.16 },
      ],
    },
    historic: true,
  },

  // ─── Beat 5 — vr_people_with_surrey.jpg (historic landscape wide) ─────────
  // t=30-35, 5s, multi_point_pan (wide source — full horizontal traverse)
  {
    photo: 'v5_library/historic/vr_people_with_surrey.jpg',
    startSec: 30,
    durationSec: 5,
    move: {
      move: 'multi_point_pan',
      focal: 'center',
      intensity: 1.2,
      anchors: [
        { x: -5, y: 0, scale: 1.10 },
        { x: 0, y: 0, scale: 1.15 },
        { x: 5, y: 0, scale: 1.20 },
      ],
    },
    historic: true,
  },

  // ─── Beat 6 — 07_sheep_with_cattle.jpg (historic landscape) ──────────────
  // t=35-40, 5s, multi_point_pan
  {
    photo: 'v5_library/historic/07_sheep_with_cattle.jpg',
    startSec: 35,
    durationSec: 5,
    move: {
      move: 'multi_point_pan',
      focal: 'center',
      intensity: 1.0,
      anchors: [
        { x: -3, y: -1, scale: 1.08 },
        { x: 1, y: 0, scale: 1.13 },
        { x: 4, y: 1, scale: 1.18 },
      ],
    },
    historic: true,
  },

  // ─── Beat 7 — vr_sheep_dip.jpg (historic PANORAMA, very wide 2.65ar) ──────
  // t=40-47.5, 7.5s, multi_point_pan FULL TRAVERSE
  {
    photo: 'v5_library/historic/vr_sheep_dip.jpg',
    startSec: 40,
    durationSec: 7.5,
    move: {
      move: 'multi_point_pan',
      focal: 'center',
      intensity: 1.5,
      anchors: [
        { x: -7, y: 0, scale: 1.12 },
        { x: 0, y: 0, scale: 1.18 },
        { x: 7, y: 0, scale: 1.24 },
      ],
    },
    historic: true,
  },

  // ─── Beat 8 — vr_barn_newberry_crater.jpg (bridge, MODERN COLOR) ──────────
  // t=47.5-54.5, 7s, vignette+scale push (push_counter very low intensity)
  {
    photo: 'v5_library/historic/vr_barn_newberry_crater.jpg',
    startSec: 47.5,
    durationSec: 7,
    move: { move: 'push_counter', focal: 'center', intensity: 0.15, counterDir: 'right' },
    historic: false,  // modern color treatment despite vr_ prefix
  },

  // ─── Beat 9 — architect_locati.jpg (portrait, historic-style) ────────────
  // t=54.5-61.5, 7s, push_counter
  {
    photo: 'v5_library/historic/architect_locati.jpg',
    startSec: 54.5,
    durationSec: 7,
    move: { move: 'push_counter', focal: 'center', intensity: 0.85, counterDir: 'right' },
    historic: true,
  },

  // ─── Beat 10 — #5 entry hallway ───────────────────────────────────────────
  // t=61.5-66.5, 5s, multi_point_pan
  {
    photo: 'v5_library/modern/5-web-or-mls-_DSC0771.jpg',
    startSec: 61.5,
    durationSec: 5,
    move: {
      move: 'multi_point_pan',
      focal: 'center',
      intensity: 1.0,
      anchors: [
        { x: -2, y: -2, scale: 1.08 },
        { x: 0, y: 0, scale: 1.13 },
        { x: 2, y: 2, scale: 1.18 },
      ],
    },
    historic: false,
  },

  // ─── Beat 11 — #2 ─────────────────────────────────────────────────────────
  // t=66.5-70.5, 4s, multi_point_pan
  {
    photo: 'v5_library/modern/2-web-or-mls-_DSC1055.jpg',
    startSec: 66.5,
    durationSec: 4,
    move: {
      move: 'multi_point_pan',
      focal: 'center',
      intensity: 1.0,
      anchors: [
        { x: -3, y: -1, scale: 1.08 },
        { x: 0, y: 0, scale: 1.13 },
        { x: 3, y: 1, scale: 1.18 },
      ],
    },
    historic: false,
  },

  // ─── Beat 12 — #8 ─────────────────────────────────────────────────────────
  // t=70.5-74.5, 4s, multi_point_pan
  {
    photo: 'v5_library/modern/8-web-or-mls-_DSC0792.jpg',
    startSec: 70.5,
    durationSec: 4,
    move: {
      move: 'multi_point_pan',
      focal: 'center',
      intensity: 1.0,
      anchors: [
        { x: -3, y: -1, scale: 1.08 },
        { x: 0, y: 0, scale: 1.13 },
        { x: 3, y: 1, scale: 1.18 },
      ],
    },
    historic: false,
  },

  // ─── Beat 13 — #11 window+Bachelor ────────────────────────────────────────
  // t=74.5-78.5, 4s, push_in (frame the mountain through window)
  {
    photo: 'v5_library/modern/11-web-or-mls-_DSC0950.jpg',
    startSec: 74.5,
    durationSec: 4,
    move: { move: 'push_in', focal: 'center', intensity: 1.0 },
    historic: false,
  },

  // ─── Beat 14 — #13 ────────────────────────────────────────────────────────
  // t=78.5-82.5, 4s, multi_point_pan
  {
    photo: 'v5_library/modern/13-web-or-mls-_DSC0810.jpg',
    startSec: 78.5,
    durationSec: 4,
    move: {
      move: 'multi_point_pan',
      focal: 'center',
      intensity: 1.0,
      anchors: [
        { x: -3, y: -1, scale: 1.08 },
        { x: 0, y: 0, scale: 1.13 },
        { x: 3, y: 1, scale: 1.18 },
      ],
    },
    historic: false,
  },

  // ─── Beat 15 — #17 dining+kitchen (antler chandelier) ────────────────────
  // t=82.5-86.5, 4s, multi_point_pan (chandelier→table)
  {
    photo: 'v5_library/modern/17-web-or-mls-_DSC0836.jpg',
    startSec: 82.5,
    durationSec: 4,
    move: {
      move: 'multi_point_pan',
      focal: 'center-top',
      intensity: 1.0,
      anchors: [
        { x: 0, y: -3, scale: 1.08 },  // chandelier
        { x: 0, y: 0, scale: 1.13 },   // mid
        { x: 0, y: 2, scale: 1.18 },   // table
      ],
    },
    historic: false,
  },

  // ─── Beat 16 — #24 kitchen+walkout ────────────────────────────────────────
  // t=86.5-90.5, 4s, multi_point_pan (island→walkout)
  {
    photo: 'v5_library/modern/24-web-or-mls-_DSC0871.jpg',
    startSec: 86.5,
    durationSec: 4,
    move: {
      move: 'multi_point_pan',
      focal: 'center',
      intensity: 1.0,
      anchors: [
        { x: -3, y: 0, scale: 1.08 },  // island
        { x: 0, y: 0, scale: 1.13 },   // mid
        { x: 3, y: 0, scale: 1.18 },   // walkout
      ],
    },
    historic: false,
  },

  // ─── Beat 17 — #25 primary bedroom ────────────────────────────────────────
  // t=90.5-94.5, 4s, multi_point_pan (fireplace→bed→window)
  {
    photo: 'v5_library/modern/25-web-or-mls-_DSC0898.jpg',
    startSec: 90.5,
    durationSec: 4,
    move: {
      move: 'multi_point_pan',
      focal: 'center',
      intensity: 1.0,
      anchors: [
        { x: -3, y: -1, scale: 1.08 },  // fireplace
        { x: 0, y: 0, scale: 1.13 },    // bed
        { x: 3, y: 1, scale: 1.18 },    // window
      ],
    },
    historic: false,
  },

  // ─── Beat 18 — #27 ────────────────────────────────────────────────────────
  // t=94.5-98.5, 4s, multi_point_pan
  {
    photo: 'v5_library/modern/27-web-or-mls-_DSC0961.jpg',
    startSec: 94.5,
    durationSec: 4,
    move: {
      move: 'multi_point_pan',
      focal: 'center',
      intensity: 1.0,
      anchors: [
        { x: -3, y: -1, scale: 1.08 },
        { x: 0, y: 0, scale: 1.13 },
        { x: 3, y: 1, scale: 1.18 },
      ],
    },
    historic: false,
  },

  // ─── Beat 19 — #28 sunroom ────────────────────────────────────────────────
  // t=98.5-102.5, 4s, multi_point_pan (stone→sectional→pond)
  {
    photo: 'v5_library/modern/28-web-or-mls-_DSC1010.jpg',
    startSec: 98.5,
    durationSec: 4,
    move: {
      move: 'multi_point_pan',
      focal: 'center',
      intensity: 1.0,
      anchors: [
        { x: -3, y: 1, scale: 1.08 },  // stone floor
        { x: 0, y: 0, scale: 1.13 },   // sectional
        { x: 3, y: -1, scale: 1.18 },  // pond view
      ],
    },
    historic: false,
  },

  // ─── Beat 20 — #29 primary bath ───────────────────────────────────────────
  // t=102.5-106.5, 4s, multi_point_pan (vanity→tub)
  {
    photo: 'v5_library/modern/29-web-or-mls-_DSC0925.jpg',
    startSec: 102.5,
    durationSec: 4,
    move: {
      move: 'multi_point_pan',
      focal: 'center',
      intensity: 1.0,
      anchors: [
        { x: -3, y: 0, scale: 1.08 },  // vanity
        { x: 0, y: 0, scale: 1.13 },   // mirror
        { x: 3, y: 0, scale: 1.18 },   // tub
      ],
    },
    historic: false,
  },

  // ─── Beat 21 — #30 walk-in shower ─────────────────────────────────────────
  // t=106.5-110.5, 4s, multi_point_pan (window→tile)
  {
    photo: 'v5_library/modern/30-web-or-mls-_DSC0930.jpg',
    startSec: 106.5,
    durationSec: 4,
    move: {
      move: 'multi_point_pan',
      focal: 'center',
      intensity: 1.0,
      anchors: [
        { x: -2, y: -2, scale: 1.08 },  // window
        { x: 0, y: 0, scale: 1.13 },    // mid
        { x: 2, y: 2, scale: 1.18 },    // tile
      ],
    },
    historic: false,
  },

  // ─── Beat 22 — #31 ────────────────────────────────────────────────────────
  // t=110.5-114.5, 4s, multi_point_pan
  {
    photo: 'v5_library/modern/31-web-or-mls-_DSC0935.jpg',
    startSec: 110.5,
    durationSec: 4,
    move: {
      move: 'multi_point_pan',
      focal: 'center',
      intensity: 1.0,
      anchors: [
        { x: -3, y: -1, scale: 1.08 },
        { x: 0, y: 0, scale: 1.13 },
        { x: 3, y: 1, scale: 1.18 },
      ],
    },
    historic: false,
  },

  // ─── Beat 23 — #52 fire patio ─────────────────────────────────────────────
  // t=114.5-118.5, 4s, multi_point_pan (fire→pond)
  {
    photo: 'v5_library/modern/52-web-or-mls-_DSC1022.jpg',
    startSec: 114.5,
    durationSec: 4,
    move: {
      move: 'multi_point_pan',
      focal: 'center',
      intensity: 1.0,
      anchors: [
        { x: -3, y: 0, scale: 1.08 },  // fire
        { x: 0, y: 0, scale: 1.13 },   // mid
        { x: 3, y: 0, scale: 1.18 },   // pond
      ],
    },
    historic: false,
  },

  // ─── Beat 24 — #88 two elk closer ─────────────────────────────────────────
  // t=118.5-123, 4.5s, multi_point_pan
  {
    photo: 'v5_library/modern/88-web-or-mls-_DSC1105.jpg',
    startSec: 118.5,
    durationSec: 4.5,
    move: {
      move: 'multi_point_pan',
      focal: 'center',
      intensity: 1.0,
      anchors: [
        { x: -3, y: 0, scale: 1.08 },  // first elk
        { x: 0, y: 0, scale: 1.13 },   // mid
        { x: 3, y: 0, scale: 1.18 },   // second elk
      ],
    },
    historic: false,
  },

  // ─── Beat 25 — #86 elk herd+Bachelor ──────────────────────────────────────
  // t=123-127.5, 4.5s, multi_point_pan (herd→Bachelor)
  {
    photo: 'v5_library/modern/86-web-or-mls-_DSC1090.jpg',
    startSec: 123,
    durationSec: 4.5,
    move: {
      move: 'multi_point_pan',
      focal: 'center',
      intensity: 1.0,
      anchors: [
        { x: -3, y: 0, scale: 1.08 },  // herd
        { x: 0, y: 0, scale: 1.13 },   // mid
        { x: 3, y: 0, scale: 1.18 },   // Bachelor
      ],
    },
    historic: false,
  },

  // ─── Beat 26 — Snowdrift Area Guide 02 ────────────────────────────────────
  // t=127.5-132.5, 5s, vignette+scale push (push_counter very low)
  {
    photo: 'v5_library/snowdrift/Area Guide - Vandevert Ranch - 02.JPG',
    startSec: 127.5,
    durationSec: 5,
    move: { move: 'push_counter', focal: 'center', intensity: 0.15, counterDir: 'right' },
    historic: false,
  },

  // ─── Beat 27 — drone #60 pull-out ─────────────────────────────────────────
  // t=132.5-136.5, 4s, pull_out (scale 1.20→1.00)
  {
    photo: 'v5_library/modern/60-web-or-mls-DJI_20260127142652_0078_D.jpg',
    startSec: 132.5,
    durationSec: 4,
    move: { move: 'pull_out', focal: 'center', intensity: 1.0 },
    historic: false,
  },
];

// ─── Closing Reveal (136.5-141.5s) ────────────────────────────────────────────

const ClosingRevealInner: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;

  // 0.0-0.4s: drone last frame fades out, navy fades in
  const navyAlpha = interpolate(t, [0, 0.4], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // 0.4-1.0s: PENDING slams in — scale 1.2→1.0
  const pendingAlpha = interpolate(t, [0.4, 0.7], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const pendingScale = interpolate(t, [0.4, 1.0], [1.2, 1.0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // 1.0-2.0s: $3,025,000 fades up
  const priceAlpha = interpolate(t, [1.0, 1.8], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // 2.0-3.0s: REPRESENTED BY RYAN REALTY fades up
  const brokerAlpha = interpolate(t, [2.0, 2.8], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill>
      {/* Navy background fade-in */}
      <div style={{
        position: 'absolute', inset: 0,
        background: NAVY,
        opacity: navyAlpha,
      }} />

      {/* Text stack, centered */}
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 32,
      }}>
        {/* PENDING */}
        <div style={{
          opacity: pendingAlpha,
          transform: `scale(${pendingScale})`,
          transformOrigin: 'center center',
          fontFamily: 'Georgia, serif',
          fontSize: 72,
          fontWeight: 700,
          color: GOLD,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          textShadow: '0 2px 20px rgba(0,0,0,0.8)',
        }}>
          PENDING
        </div>

        {/* $3,025,000 */}
        <div style={{
          opacity: priceAlpha,
          fontFamily: 'Georgia, serif',
          fontSize: 96,
          fontWeight: 400,
          color: CREAM,
          letterSpacing: '-0.01em',
          textShadow: '0 2px 20px rgba(0,0,0,0.8)',
          lineHeight: 1,
        }}>
          $3,025,000
        </div>

        {/* REPRESENTED BY RYAN REALTY */}
        <div style={{
          opacity: brokerAlpha,
          fontFamily: FONT_SANS || 'Montserrat, sans-serif',
          fontSize: 24,
          fontWeight: 600,
          color: GOLD,
          letterSpacing: '0.25em',
          textTransform: 'uppercase',
          textShadow: '0 2px 12px rgba(0,0,0,0.9)',
        }}>
          REPRESENTED BY RYAN REALTY
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ─── BeatWrapper — gives each beat its local time ─────────────────────────────

const BeatWrapper: React.FC<{ beat: BeatDef }> = ({ beat }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = frame / fps;

  return (
    <PhotoBeat
      photo={beat.photo}
      local={local}
      fps={fps}
      durationSec={beat.durationSec}
      move={beat.move}
      historic={beat.historic}
      letterbox={false}
      scrim="none"
    />
  );
};

// ─── Volume ramp helper ────────────────────────────────────────────────────────
// 0.6 from 0-7s (open), 0.25 from 7-95s (under VO), 0.5 from 95-136s (after VO),
// fade out 138-141s

function musicVolume(frame: number): number {
  const t = frame / FPS;
  if (t < 7) return 0.6;
  if (t < 7.5) return 0.6 - (t - 7) / 0.5 * 0.35; // ramp 0.6→0.25
  if (t < 95) return 0.25;
  if (t < 96) return 0.25 + (t - 95) * 0.25; // ramp 0.25→0.5
  if (t < 136) return 0.5;
  if (t < 141) return 0.5 * Math.max(0, (141 - t) / 5); // fade out
  return 0;
}

// ─── Main composition ─────────────────────────────────────────────────────────

export const Listing: React.FC = () => {
  const { fps } = useVideoConfig();

  const openDurationFrames = Math.round(7 * fps);
  const closingRevealStart = Math.round(136.5 * fps);
  const closingRevealDuration = Math.round(5 * fps);
  const outroStart = Math.round(141.5 * fps);
  const outroDuration = 2.5;

  return (
    <AbsoluteFill style={{ background: CHARCOAL }}>

      {/* ── Music bed (full duration, dynamic volume) ─────────────────────── */}
      <Audio
        src={staticFile('audio/music_bed_v5.mp3')}
        volume={(f) => musicVolume(f)}
      />

      {/* ── VO at t=7s ────────────────────────────────────────────────────── */}
      <Sequence from={Math.round(7 * fps)}>
        <Audio src={staticFile('audio/vo_v5_full.mp3')} volume={1.0} />
      </Sequence>

      {/* ── Brand sting at t=142s ──────────────────────────────────────────── */}
      <Sequence from={Math.round(142 * fps)}>
        <Audio src={staticFile('audio/brand_sting.mp3')} volume={1.0} />
      </Sequence>

      {/* ── Open (0-7s) ────────────────────────────────────────────────────── */}
      <Sequence from={0} durationInFrames={openDurationFrames} name="open">
        <OpenSequence />
      </Sequence>

      {/* ── 27 Photo beats ────────────────────────────────────────────────── */}
      {BEATS.map((beat, i) => {
        const startFrame = Math.round(beat.startSec * fps);
        const durationFrames = Math.round(beat.durationSec * fps);
        return (
          <Sequence
            key={i}
            from={startFrame}
            durationInFrames={durationFrames}
            name={`beat${i + 1}_${beat.photo.split('/').pop()?.replace(/\.[^.]+$/, '')}`}
          >
            <BeatWrapper beat={beat} />
          </Sequence>
        );
      })}

      {/* ── Closing reveal (136.5-141.5s) ─────────────────────────────────── */}
      <Sequence
        from={closingRevealStart}
        durationInFrames={closingRevealDuration}
        name="closing_reveal"
      >
        <ClosingRevealInner />
      </Sequence>

      {/* ── Brand outro (141.5-144.0s) ─────────────────────────────────────── */}
      <BrandOutro startFrame={outroStart} durationSec={outroDuration} />

    </AbsoluteFill>
  );
};
