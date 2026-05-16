// StatPop — kinetic news-style stat overlay that pops in when Victoria
// mentions a specific option/number/date in the voiceover.
//
// Sits in the upper-third of the frame (above the TikTok caption band).
// One element shows at a time per bridge. Each pop has its own start/end
// window in seconds (relative to the parent Sequence's local frame).

import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

export type StatPopItem = {
  /** Big text to show (e.g. "$1,954", "JUNE 3", "EXISTING HOMES") */
  text: string;
  /** Optional smaller text below the main (e.g. "MAX PER HOME", "FIRST READING") */
  sub?: string;
  /** When the pop starts showing (seconds from Sequence start) */
  start: number;
  /** When it stops showing */
  end: number;
  /** Color of the main text. Default white (TikTok). Use 'gold' for emphasis. */
  color?: 'white' | 'gold' | 'red';
};

const COLORS = {
  white: '#FFFFFF',
  gold: '#F2C44A',
  red: '#FF4D4D',
};

type Props = {
  items: StatPopItem[];
  /** Vertical position from top of frame (px). Default 480 (upper-third). */
  top?: number;
  /** Main text font size in px. Default 168. */
  fontSize?: number;
};

export const StatPop: React.FC<Props> = ({ items, top = 480, fontSize = 168 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const tSec = frame / fps;

  // Find the active item (last one whose [start, end] window contains tSec)
  let active: StatPopItem | undefined;
  for (let i = items.length - 1; i >= 0; i--) {
    if (items[i].start <= tSec && tSec < items[i].end) {
      active = items[i];
      break;
    }
  }
  if (!active) return null;

  const localF = frame - Math.round(active.start * fps);
  const endF = Math.round((active.end - active.start) * fps);
  const sp = spring({
    frame: localF,
    fps,
    config: { damping: 12, mass: 0.4, stiffness: 220 },
  });
  const scale = 0.7 + sp * 0.32; // 0.70 → 1.02 small overshoot
  const fadeIn = interpolate(localF, [0, 5], [0, 1], { extrapolateRight: 'clamp' });
  const fadeOut = interpolate(endF - localF, [0, 5], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const opacity = Math.min(fadeIn, fadeOut);

  const mainColor = COLORS[active.color ?? 'white'];
  // Auto-shrink long text so it fits the 1080-wide safe zone.
  const len = active.text.length;
  const widthAdjust = len > 16 ? 0.55 : len > 12 ? 0.70 : len > 9 ? 0.85 : 1;
  const finalSize = fontSize * widthAdjust;

  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top,
        textAlign: 'center',
        pointerEvents: 'none',
        opacity,
      }}
    >
      <div
        style={{
          display: 'inline-block',
          transform: `scale(${scale.toFixed(3)})`,
          fontFamily: 'Anton, "Bebas Neue", sans-serif',
          fontWeight: 400,
          fontSize: finalSize,
          color: mainColor,
          letterSpacing: 1,
          lineHeight: 1.0,
          padding: '0 50px',
          textShadow: [
            `5px 0 0 #000`,
            `-5px 0 0 #000`,
            `0 5px 0 #000`,
            `0 -5px 0 #000`,
            `4px 4px 0 #000`,
            `-4px 4px 0 #000`,
            `4px -4px 0 #000`,
            `-4px -4px 0 #000`,
            `0 10px 28px rgba(0,0,0,0.9)`,
          ].join(', '),
        }}
      >
        {active.text}
      </div>
      {active.sub ? (
        <div
          style={{
            marginTop: 14,
            fontFamily: 'Bebas Neue, Anton, sans-serif',
            fontWeight: 400,
            fontSize: Math.round(finalSize * 0.32),
            color: '#FFFFFF',
            letterSpacing: 6,
            textTransform: 'uppercase',
            textShadow: '0 4px 12px rgba(0,0,0,0.85)',
            opacity: opacity * 0.95,
          }}
        >
          {active.sub}
        </div>
      ) : null}
    </div>
  );
};
