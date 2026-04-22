// HudCallout — animated pin-style marker that "lands" on a peak during the
// Aubrey Butte panoramic pan. Visual: a gold dot with a small vertical stem,
// peak shortName in an Azo Sans pill above. Elastic-snap entrance per Matt's
// spec ("HUD overlay identifying each mountain as you scan across").

import React from 'react';
import { interpolate } from 'remotion';
import {
  FONT_BODY,
  GOLD,
  GOLD_SOFT,
  NAVY_DEEP,
  TEXT_SHADOW,
} from './brand';
import { easeOutElastic, easeOutCubic, clamp } from './easing';

type HudCalloutProps = {
  /** Screen-space pixel X of the peak summit. */
  x: number;
  /** Screen-space pixel Y of the peak summit. */
  y: number;
  /** Short label shown in the pill. */
  label: string;
  /** Frames since the callout started animating in (0 = just popped). */
  localFrame: number;
  /** FPS of the composition. */
  fps: number;
  /** Seconds to hold on screen before fading out. */
  holdSec?: number;
  /** Seconds for fade-out tail. */
  fadeOutSec?: number;
  /** Offset label above the dot (px). Default 88. */
  labelOffsetPx?: number;
};

const POP_IN_SEC = 0.45;

export const HudCallout: React.FC<HudCalloutProps> = ({
  x,
  y,
  label,
  localFrame,
  fps,
  holdSec = 1.8,
  fadeOutSec = 0.55,
  labelOffsetPx = 88,
}) => {
  const popFrames = POP_IN_SEC * fps;
  const holdFrames = holdSec * fps;
  const fadeFrames = fadeOutSec * fps;

  // Three envelopes
  const tPop = clamp(localFrame / popFrames, 0, 1);
  const popScale = 0.3 + easeOutElastic(tPop) * 0.7; // 0.3 → 1.0 with bounce
  const popAlpha = easeOutCubic(tPop);

  const fadeStart = popFrames + holdFrames;
  const tFade = clamp((localFrame - fadeStart) / fadeFrames, 0, 1);
  const alpha = popAlpha * (1 - tFade);

  if (alpha <= 0.001) return null;

  // Small vertical stem from dot up to label
  const stemH = labelOffsetPx - 18;

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        transform: `translate(-50%, -50%) scale(${popScale})`,
        opacity: alpha,
        pointerEvents: 'none',
      }}
    >
      {/* The dot */}
      <div
        style={{
          width: 18,
          height: 18,
          borderRadius: '50%',
          background: GOLD,
          boxShadow: `0 0 18px ${GOLD_SOFT}, 0 0 36px ${GOLD_SOFT}, 0 2px 6px rgba(0,0,0,0.6)`,
          position: 'absolute',
          left: -9,
          top: -9,
        }}
      />
      {/* Pulsing ring */}
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: '50%',
          border: `2px solid ${GOLD_SOFT}`,
          position: 'absolute',
          left: -18,
          top: -18,
          opacity: 0.55 * Math.max(0, 1 - interpolate(
            localFrame % (fps * 1.2),
            [0, fps * 1.2],
            [0, 1],
          )),
          transform: `scale(${1 + interpolate(
            localFrame % (fps * 1.2),
            [0, fps * 1.2],
            [0, 1.4],
          )})`,
        }}
      />
      {/* Stem */}
      <div
        style={{
          width: 2,
          height: stemH,
          background: `linear-gradient(to top, ${GOLD} 0%, ${GOLD_SOFT} 100%)`,
          position: 'absolute',
          left: -1,
          top: -stemH - 10,
          boxShadow: `0 0 6px ${GOLD_SOFT}`,
        }}
      />
      {/* Label pill */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: -labelOffsetPx - 30,
          transform: 'translateX(-50%)',
          padding: '8px 16px',
          background: NAVY_DEEP,
          color: '#fff',
          fontFamily: FONT_BODY,
          fontWeight: 600,
          fontSize: 28,
          letterSpacing: 1.3,
          textTransform: 'uppercase',
          borderRadius: 4,
          border: `1px solid ${GOLD}`,
          boxShadow: `0 4px 16px rgba(0,0,0,0.7), 0 0 20px ${GOLD_SOFT}40`,
          whiteSpace: 'nowrap',
          textShadow: TEXT_SHADOW,
        }}
      >
        {label}
      </div>
    </div>
  );
};
