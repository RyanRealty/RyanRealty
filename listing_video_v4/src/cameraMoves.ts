// Camera-move primitives — v3 PHOTO-TO-CINEMA MOTION
// Replaces "Ken Burns on every photo" with film-grade motion:
//   - push_counter: scale + counter-translate (highest ROI interior move)
//   - slow_pan_lr / slow_pan_tb: REAL pan (translate at fixed scale)
//   - multi_point_pan: 3-anchor cinematic path with eased dwell
//   - parallax_3layer: fake 3D depth via 3D-transform stacks
//   - cinemagraph: legacy multi-axis sine drift (kept for hero stills only)

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
  | 'multi_point_pan';

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
  /** multi_point_pan: 3 anchors as { x, y, scale } in viewport-percent units */
  anchors?: Array<{ x: number; y: number; scale: number }>;
};

export type CameraResult = {
  transform: string;
  transformOrigin: string;
  /** Optional brightness/saturation modulation overlay multiplier (1.0 = no change). */
  brightnessMod?: number;
  saturationMod?: number;
};

// 3-anchor eased interpolation. Each segment is eased so the move dwells at
// each anchor. Spring-ish without the import.
function tripleEase(t: number): { seg: number; u: number } {
  // 0..0.5 = anchor1->anchor2, 0.5..1 = anchor2->anchor3
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

  switch (move) {
    case 'push_in': {
      const eased = easeOutCubic(t);
      const scale = 1.0 + 0.08 * intensity * eased;
      return { transform: `scale(${scale.toFixed(4)})`, transformOrigin: origin };
    }
    case 'pull_out': {
      const eased = easeOutQuart(t);
      const scale = 1.12 - 0.12 * intensity * eased;
      return { transform: `scale(${scale.toFixed(4)})`, transformOrigin: origin };
    }
    case 'parallax': {
      const eased = easeInOutCubic(t);
      const scale = 1.06;
      const dx = -30 * intensity * eased;
      return {
        transform: `translateX(${dx.toFixed(2)}px) scale(${scale})`,
        transformOrigin: origin,
      };
    }
    case 'vertical_reveal': {
      const eased = easeInOutCubic(t);
      const scale = 1.08;
      const dy = 25 - 40 * intensity * eased;
      return {
        transform: `translateY(${dy.toFixed(2)}px) scale(${scale})`,
        transformOrigin: origin,
      };
    }
    case 'orbit_fake': {
      const eased = easeInOutCubic(t);
      const scale = 1.02 + 0.04 * intensity * eased;
      const rot = 0.5 * intensity * Math.sin(t * Math.PI);
      return {
        transform: `rotate(${rot.toFixed(3)}deg) scale(${scale.toFixed(4)})`,
        transformOrigin: origin,
      };
    }

    // ─── PHOTO-TO-CINEMA MOTION primitives ────────────────────────────────

    case 'push_counter': {
      // The single highest-ROI interior move: scale 1.00→1.12 plus a
      // 1.5% counter-translate to fake camera parallax. Phase-shift so
      // scale peaks slightly after translate.
      const scaleEase = easeOutCubic(t);
      const transEase = easeInOutCubic(Math.min(1, t * 1.05));
      const scale = 1.0 + 0.12 * intensity * scaleEase;
      const dir = opts.counterDir ?? 'right';
      const px = 28 * intensity * transEase; // ~1.5% of 1920px = 28-29px
      const tx = dir === 'left' ? -px : dir === 'right' ? px : 0;
      const ty = dir === 'up' ? -px : dir === 'down' ? px : 0;
      // Subtle hand-held shake at <1px amplitude
      const u = localFrame;
      const shakeX = Math.sin(u / 12) * 0.6;
      const shakeY = Math.cos(u / 14) * 0.4;
      return {
        transform: `translate(${(tx + shakeX).toFixed(2)}px, ${(ty + shakeY).toFixed(
          2,
        )}px) scale(${scale.toFixed(4)})`,
        transformOrigin: origin,
      };
    }

    case 'slow_pan_lr': {
      // Real horizontal pan. Hold scale at 1.15 (so the translate has
      // headroom without revealing letterbox), translate left→right.
      const eased = easeInOutCubic(t);
      const scale = 1.15;
      const dx = -60 + 120 * intensity * eased; // -60..+60px = ~6% pan range
      const u = localFrame;
      const shakeY = Math.cos(u / 14) * 0.4;
      return {
        transform: `translate(${dx.toFixed(2)}px, ${shakeY.toFixed(2)}px) scale(${scale})`,
        transformOrigin: origin,
      };
    }
    case 'slow_pan_rl': {
      const eased = easeInOutCubic(t);
      const scale = 1.15;
      const dx = 60 - 120 * intensity * eased;
      const u = localFrame;
      const shakeY = Math.cos(u / 14) * 0.4;
      return {
        transform: `translate(${dx.toFixed(2)}px, ${shakeY.toFixed(2)}px) scale(${scale})`,
        transformOrigin: origin,
      };
    }
    case 'slow_pan_tb': {
      const eased = easeInOutCubic(t);
      const scale = 1.15;
      const dy = -50 + 100 * intensity * eased;
      const u = localFrame;
      const shakeX = Math.sin(u / 12) * 0.5;
      return {
        transform: `translate(${shakeX.toFixed(2)}px, ${dy.toFixed(2)}px) scale(${scale})`,
        transformOrigin: origin,
      };
    }
    case 'slow_pan_bt': {
      const eased = easeInOutCubic(t);
      const scale = 1.15;
      const dy = 50 - 100 * intensity * eased;
      const u = localFrame;
      const shakeX = Math.sin(u / 12) * 0.5;
      return {
        transform: `translate(${shakeX.toFixed(2)}px, ${dy.toFixed(2)}px) scale(${scale})`,
        transformOrigin: origin,
      };
    }

    case 'multi_point_pan': {
      // 3-anchor cinematic path: anchor1 → anchor2 → anchor3.
      // anchors expressed in % offset from center (negative = left/up).
      const a = opts.anchors ?? [
        { x: -3, y: -2, scale: 1.08 },
        { x: 1, y: 0, scale: 1.14 },
        { x: 4, y: 2, scale: 1.18 },
      ];
      const { seg, u } = tripleEase(t);
      const A = a[seg];
      const B = a[seg + 1];
      const lerp = (p: number, q: number) => p + (q - p) * u;
      const fx = lerp(A.x, B.x);
      const fy = lerp(A.y, B.y);
      const fs = lerp(A.scale, B.scale);
      // Convert % to px (assuming 1920×1920 canvas reference)
      const dx = fx * 19.2 * intensity;
      const dy = fy * 19.2 * intensity;
      const localF = localFrame;
      const shakeX = Math.sin(localF / 12) * 0.6;
      const shakeY = Math.cos(localF / 14) * 0.4;
      return {
        transform: `translate(${(dx + shakeX).toFixed(2)}px, ${(dy + shakeY).toFixed(
          2,
        )}px) scale(${fs.toFixed(4)})`,
        transformOrigin: origin,
      };
    }

    case 'cinemagraph': {
      // Legacy "breathing photograph" — kept for hero stills where you
      // want gentle organic drift across the whole frame. New rule:
      // do NOT use this for interiors (use push_counter or multi_point_pan).
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
      };
    }
  }
}
