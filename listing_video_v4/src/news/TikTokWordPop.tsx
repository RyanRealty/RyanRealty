// TikTokWordPop — single-word kinetic caption, bottom third of frame.
//
// One token (word) at a time. Pops in with a small spring scale + opacity fade,
// holds for its `start..end` window, then is replaced by the next token.
// Use Anton (TikTok-grade bold sans) at 140-180px with thick black outline +
// drop shadow for muted-feed legibility on any background.
//
// tokens[] schema:
//   { text: string; start: number /* sec */; end: number /* sec */ }
// Time is measured against the parent Sequence's local frame (Remotion Sequence
// resets useCurrentFrame() to 0 at its `from`).

import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

export type WordToken = { text: string; start: number; end: number };

type Props = {
  tokens: WordToken[];
  // Position of the caption (defaults tuned for bottom third).
  bottomPct?: number; // 0 = bottom edge, default 30 (bottom third)
  fontSize?: number;
  color?: string;
  outlineColor?: string;
  fontFamily?: string;
  // If true, every word is also rendered uppercase (TikTok signature).
  uppercase?: boolean;
};

export const TikTokWordPop: React.FC<Props> = ({
  tokens,
  bottomPct = 30,
  fontSize = 160,
  color = '#FFFFFF',
  outlineColor = '#000000',
  fontFamily = 'Anton, "Bebas Neue", "Montserrat", sans-serif',
  uppercase = true,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const tSec = frame / fps;

  // Find current token (last token whose start <= tSec)
  let current: WordToken | undefined;
  for (let i = tokens.length - 1; i >= 0; i--) {
    if (tokens[i].start <= tSec + 0.01) {
      current = tokens[i];
      break;
    }
  }
  if (!current) return null;

  // Local frame within this token (for the pop animation)
  const tokenStartFrame = Math.round(current.start * fps);
  const localF = frame - tokenStartFrame;
  const sp = spring({
    frame: localF,
    fps,
    config: { damping: 12, mass: 0.45, stiffness: 200 },
  });
  const scale = 0.85 + sp * 0.18; // 0.85 → 1.03 small overshoot
  const fadeIn = interpolate(localF, [0, 4], [0, 1], { extrapolateRight: 'clamp' });
  // Optional fade-out near the end of the token's window so the swap reads.
  const tokenEndFrame = Math.round(current.end * fps);
  const framesLeft = tokenEndFrame - frame;
  const fadeOut = interpolate(framesLeft, [0, 3], [0.4, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const opacity = Math.min(fadeIn, fadeOut);

  const display = uppercase ? current.text.toUpperCase() : current.text;
  // Long words can be too wide. Auto-shrink for >9 chars.
  const widthAdjust = display.length > 14 ? 0.66 : display.length > 11 ? 0.78 : display.length > 9 ? 0.88 : 1;
  const finalSize = fontSize * widthAdjust;

  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: `${bottomPct}%`,
        textAlign: 'center',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          display: 'inline-block',
          transform: `scale(${scale.toFixed(3)})`,
          opacity,
          fontFamily,
          fontSize: finalSize,
          fontWeight: 400,
          letterSpacing: 1,
          lineHeight: 1.0,
          color,
          // TikTok-style stroke + drop shadow stack for legibility on any bg.
          // Use multiple text-shadows to fake a stroke (better cross-browser).
          textShadow: [
            `4px 0 0 ${outlineColor}`,
            `-4px 0 0 ${outlineColor}`,
            `0 4px 0 ${outlineColor}`,
            `0 -4px 0 ${outlineColor}`,
            `3px 3px 0 ${outlineColor}`,
            `-3px 3px 0 ${outlineColor}`,
            `3px -3px 0 ${outlineColor}`,
            `-3px -3px 0 ${outlineColor}`,
            `0 8px 24px rgba(0,0,0,0.85)`,
            `0 4px 12px rgba(0,0,0,0.7)`,
          ].join(', '),
          padding: '0 60px',
        }}
      >
        {display}
      </div>
    </div>
  );
};
