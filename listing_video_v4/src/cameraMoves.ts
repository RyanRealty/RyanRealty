// Camera-move primitives — v5.3 PHOTO-TO-CINEMA MOTION
//
// Two render contexts:
//   wide-mode (set by PhotoBeat): IMG sized at height:100% width:auto so
//     image natural width exceeds frame width. Translate dx in px shifts
//     within the wide image. Used for: slow_pan_*, multi_point_pan,
//     gimbal_walk. Allows real pan distance with no black space.
//   cover-mode (default): IMG at width:100% height:100% objectFit:cover.
//     Translate moves the box. Used for: push_in, pull_out, push_counter
//     (where pan distance is small).
//
// Direction convention:
//   L→R camera pan = camera reveals LEFT side first, RIGHT side last.
//   In wide-mode, that means the IMG translates from +dx (right shift,
//   exposing left of image) to -dx (left shift, exposing right of image).
//   So L→R uses anchors [+x, 0, -x] or slow_pan_lr.
//   R→L uses anchors [-x, 0, +x] or slow_pan_rl.

import { easeInOutCubic, easeOutCubic, easeOutQuart } from './easing';

type FocalPoint =
  | 'center'
  | 'center-top'
  | 'center-bottom'
  | 'left-center'
  | 'right-center'
  | { x: number; y: number };

type Move =
  | 'push_in'
  | 'pull_out'
  | 'parallax'
  | 'vertical_reveal'
  | 'orbit_fake'
  | 'cinemagraph'
  | 'push_counter'
  | 'slow_pan_lr'
  | 'slow_pan_rl'
  | 'slow_pan_tb'
  | 'slow_pan_bt'
  | 'multi_point_pan'
  | 'gimbal_walk'
  | 'still';

const focalToOrigin = (f: FocalPoint): string => {
  if (f === 'center') return '50% 50%';
  if (f === 'center-top') return '50% 30%';
  if (f === 'center-bottom') return '50% 70%';
  if (f === 'left-center') return '30% 50%';
  if (f === 'right-center') return '70% 50%';
  return `${f.x}% ${f.y}%`;
};

export type CameraMoveOpts = {
  move: Move;
  focal?: FocalPoint;
  intensity?: number;
  /** push_counter: which way the counter-translate goes (default 'right') */
  counterDir?: 'left' | 'right' | 'up' | 'down';
  /** slow_pan / gimbal_walk direction override */
  direction?: 'lr' | 'rl';
  /** multi_point_pan: 3 anchors as { x, y, scale } in % units (x ~ ±40 max) */
  anchors?: Array<{ x: number; y: number; scale: number }>;
};

export type CameraResult = {
  transform: string;
  transformOrigin: string;
  /** Optional brightness/saturation modulation overlay multiplier (1.0 = no change). */
  brightnessMod?: number;
  saturationMod?: number;
  /** True if this motion expects wide-mode IMG sizing (height:100%, width:auto). */
  wideMode: boolean;
};

// Move kinds that pan across a wide image and need wide-mode rendering
const WIDE_MOVES: Move[] = ['slow_pan_lr', 'slow_pan_rl', 'multi_point_pan', 'gimbal_walk'];

// 3-anchor eased interpolation. Each segment is eased so the move dwells at
// each anchor briefly. Velocity is 0 at the midpoint anchor (smooth).
function tripleEase(t: number): { seg: number; u: number } {
  if (t < 0.5) return { seg: 0, u: easeInOutCubic(t / 0.5) };
  return { seg: 1, u: easeInOutCubic((t - 0.5) / 0.5) };
}

export function cameraTransform(
  localFrame: number,
  totalFrames: number,
  opts: CameraMoveOpts,
): CameraResult {
  const { move, focal = 'center', intensity = 1 } = opts;
  const origin = focalToOrigin(focal);
  const t = Math.max(0, Math.min(1, localFrame / Math.max(1, totalFrames)));
  const wideMode = WIDE_MOVES.includes(move);

  switch (move) {
    case 'still': {
      return { transform: 'scale(1)', transformOrigin: origin, wideMode: false };
    }

    case 'push_in': {
      const eased = easeOutCubic(t);
      const scale = 1.0 + 0.08 * intensity * eased;
      return { transform: `scale(${scale.toFixed(4)})`, transformOrigin: origin, wideMode: false };
    }
    case 'pull_out': {
      const eased = easeOutQuart(t);
      const scale = 1.12 - 0.12 * intensity * eased;
      // Add a tiny horizontal drift while pulling out, so it feels like a
      // camera reveal rather than a flat zoom.
      const dx = -8 * intensity * eased;
      return {
        transform: `translate(${dx.toFixed(2)}px, 0px) scale(${scale.toFixed(4)})`,
        transformOrigin: origin,
        wideMode: false,
      };
    }
    case 'parallax': {
      const eased = easeInOutCubic(t);
      const scale = 1.06;
      const dx = -30 * intensity * eased;
      return {
        transform: `translateX(${dx.toFixed(2)}px) scale(${scale})`,
        transformOrigin: origin,
        wideMode: false,
      };
    }
    case 'vertical_reveal': {
      const eased = easeInOutCubic(t);
      const scale = 1.08;
      const dy = 25 - 40 * intensity * eased;
      return {
        transform: `translateY(${dy.toFixed(2)}px) scale(${scale})`,
        transformOrigin: origin,
        wideMode: false,
      };
    }
    case 'orbit_fake': {
      const eased = easeInOutCubic(t);
      const scale = 1.02 + 0.04 * intensity * eased;
      const rot = 0.5 * intensity * Math.sin(t * Math.PI);
      return {
        transform: `rotate(${rot.toFixed(3)}deg) scale(${scale.toFixed(4)})`,
        transformOrigin: origin,
        wideMode: false,
      };
    }

    case 'push_counter': {
      // Scale 1.00→1.12 plus a counter-translate to fake camera parallax.
      const scaleEase = easeOutCubic(t);
      const transEase = easeInOutCubic(Math.min(1, t * 1.05));
      const scale = 1.0 + 0.12 * intensity * scaleEase;
      const dir = opts.counterDir ?? 'right';
      const px = 28 * intensity * transEase;
      const tx = dir === 'left' ? -px : dir === 'right' ? px : 0;
      const ty = dir === 'up' ? -px : dir === 'down' ? px : 0;
      const u = localFrame;
      const shakeX = Math.sin(u / 12) * 0.6;
      const shakeY = Math.cos(u / 14) * 0.4;
      return {
        transform: `translate(${(tx + shakeX).toFixed(2)}px, ${(ty + shakeY).toFixed(
          2,
        )}px) scale(${scale.toFixed(4)})`,
        transformOrigin: origin,
        wideMode: false,
      };
    }

    // ─── WIDE-MODE pan moves ──────────────────────────────────────────────
    // These assume IMG renders at height:100% width:auto so img natural
    // width >> frame width. Translate dx in px shifts the visible window.

    case 'slow_pan_lr': {
      // L→R camera: starts showing LEFT of image (img translated +panRange),
      // ends showing RIGHT (img translated -panRange).
      // panRange scales with intensity; default 1.0 = ±320px traverse (640px range).
      const eased = easeInOutCubic(t);
      const panRange = 320 * intensity;
      const dx = panRange - 2 * panRange * eased; // +panRange → -panRange
      const scale = 1.04;
      const u = localFrame;
      const shakeY = Math.cos(u / 16) * 0.4;
      return {
        transform: `translate(${dx.toFixed(2)}px, ${shakeY.toFixed(2)}px) scale(${scale.toFixed(4)})`,
        transformOrigin: origin,
        wideMode: true,
      };
    }
    case 'slow_pan_rl': {
      // R→L camera
      const eased = easeInOutCubic(t);
      const panRange = 320 * intensity;
      const dx = -panRange + 2 * panRange * eased;
      const scale = 1.04;
      const u = localFrame;
      const shakeY = Math.cos(u / 16) * 0.4;
      return {
        transform: `translate(${dx.toFixed(2)}px, ${shakeY.toFixed(2)}px) scale(${scale.toFixed(4)})`,
        transformOrigin: origin,
        wideMode: true,
      };
    }

    case 'slow_pan_tb': {
      const eased = easeInOutCubic(t);
      const scale = 1.10;
      const dy = -50 + 100 * intensity * eased;
      const u = localFrame;
      const shakeX = Math.sin(u / 12) * 0.5;
      return {
        transform: `translate(${shakeX.toFixed(2)}px, ${dy.toFixed(2)}px) scale(${scale.toFixed(4)})`,
        transformOrigin: origin,
        wideMode: false,
      };
    }
    case 'slow_pan_bt': {
      const eased = easeInOutCubic(t);
      const scale = 1.10;
      const dy = 50 - 100 * intensity * eased;
      const u = localFrame;
      const shakeX = Math.sin(u / 12) * 0.5;
      return {
        transform: `translate(${shakeX.toFixed(2)}px, ${dy.toFixed(2)}px) scale(${scale.toFixed(4)})`,
        transformOrigin: origin,
        wideMode: false,
      };
    }

    case 'multi_point_pan': {
      // 3-anchor cinematic path. anchor.x in % offset, dx scaled to px.
      // For wide-mode, dx of ±400 = real traverse across a wide image.
      const a = opts.anchors ?? [
        { x: 30, y: 0, scale: 1.04 },
        { x: 0, y: 0, scale: 1.06 },
        { x: -30, y: 0, scale: 1.04 },
      ];
      const { seg, u } = tripleEase(t);
      const A = a[seg];
      const B = a[seg + 1];
      const lerp = (p: number, q: number) => p + (q - p) * u;
      const fx = lerp(A.x, B.x);
      const fy = lerp(A.y, B.y);
      const fs = lerp(A.scale, B.scale);
      // Translate scale: anchor.x in [-40, +40] maps to dx [-700, +700] at
      // intensity=1 — wide enough to traverse 1.6-aspect photos.
      const dx = fx * 17.5 * intensity;
      const dy = fy * 17.5 * intensity;
      const localF = localFrame;
      const shakeX = Math.sin(localF / 14) * 0.5;
      const shakeY = Math.cos(localF / 16) * 0.35;
      return {
        transform: `translate(${(dx + shakeX).toFixed(2)}px, ${(dy + shakeY).toFixed(
          2,
        )}px) scale(${fs.toFixed(4)})`,
        transformOrigin: origin,
        wideMode: true,
      };
    }

    case 'gimbal_walk': {
      // Compound walkthrough motion: slow horizontal pan + slow forward push
      // + slight vertical bob + counter-translate. Phase-shifted so motion
      // feels like a person walking through a room with a gimbal, not a zoom.
      const dir = opts.direction ?? 'lr';
      const eased = easeInOutCubic(t);
      // Horizontal pan range scales with intensity (default = 280px = good gimbal traverse)
      const panRange = 280 * intensity;
      const dxBase = dir === 'lr'
        ? panRange - 2 * panRange * eased
        : -panRange + 2 * panRange * eased;
      // Forward push (camera-like z): scale 1.02 → 1.08 over duration
      const scaleEase = easeOutCubic(t);
      const scale = 1.02 + 0.06 * scaleEase;
      // Vertical bob — gentle sine, like a steady-cam floor
      const u = localFrame;
      const bobY = Math.sin(u / 24) * 1.4;
      // Slight counter-translate that lags pan: opposes pan slightly so
      // perspective parallax feels real
      const counterX = -dxBase * 0.04;
      const shakeX = Math.sin(u / 14) * 0.4;
      const dx = dxBase + counterX + shakeX;
      const dy = bobY;
      return {
        transform: `translate(${dx.toFixed(2)}px, ${dy.toFixed(2)}px) scale(${scale.toFixed(4)})`,
        transformOrigin: origin,
        wideMode: true,
      };
    }

    case 'cinemagraph': {
      // Legacy "breathing photograph". Multi-axis sin drift.
      // Use sparingly — produces the cropped-edge sin wave that drops
      // off-center subjects out of frame.
      const u = t * Math.PI * 2;
      const baseScale = 1.04 + 0.04 * easeInOutCubic(t) * intensity;
      const dx = Math.sin(u * 0.6) * 14 * intensity;
      const dy = Math.sin(u * 0.4 + 0.7) * 8 * intensity;
      const scaleWave = 1 + Math.sin(u * 0.5 + 1.2) * 0.01 * intensity;
      const scale = baseScale * scaleWave;
      const rotZ = Math.sin(u * 0.3 + 0.4) * 0.25 * intensity;
      const brightnessMod = 1 + Math.sin(u * 0.45 + 0.9) * 0.02 * intensity;
      const saturationMod = 1 + Math.sin(u * 0.35 + 1.6) * 0.015 * intensity;
      return {
        transform: `translate(${dx.toFixed(2)}px, ${dy.toFixed(
          2,
        )}px) rotate(${rotZ.toFixed(3)}deg) scale(${scale.toFixed(4)})`,
        transformOrigin: origin,
        brightnessMod,
        saturationMod,
        wideMode: false,
      };
    }
  }
}
