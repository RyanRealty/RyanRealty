// FactCard — IG/TikTok-first: full-bleed 3D, minimal copy in the safe zone.
// Only: peak name + elevation + one “hook” fact + how to spot it
// (distinguishing feature). Large type, short lines, bottom gradient legibility.

import React from 'react';
import { useCurrentFrame } from 'remotion';
import {
  FONT_BODY,
  FONT_SERIF,
  GOLD,
  GOLD_SOFT,
  SAFE_BOTTOM_INSET,
  SAFE_LEFT,
  SAFE_RIGHT,
  TEXT_SHADOW,
  WHITE,
} from './brand';
import { FPS } from './config';
import type { Peak } from './peaks';
import { clamp, easeOutCubic, easeOutQuart } from './easing';

type FactCardProps = {
  peak: Peak;
  durationSec: number;
  frameOffset: number;
  displayOrder: number;
};

/** Keep on-screen lines short for 1080×1920 @ thumb distance (IG best practice). */
function briefLine(s: string, maxChars: number): string {
  const t = s.replace(/\s+/g, ' ').trim();
  if (t.length <= maxChars) return t;
  return `${t.slice(0, maxChars - 1).trim()}…`;
}

export const FactCard: React.FC<FactCardProps> = ({
  peak,
  durationSec,
  frameOffset,
  displayOrder,
}) => {
  const frame = useCurrentFrame();
  const local = frame - frameOffset;

  const entryFrames = 0.55 * FPS;
  const tEntry = clamp(local / entryFrames, 0, 1);
  const entryAlpha = easeOutCubic(tEntry);
  const entryY = (1 - easeOutQuart(tEntry)) * 16;

  const totalFrames = durationSec * FPS;
  const exitStart = totalFrames - 0.45 * FPS;
  const tExit = clamp((local - exitStart) / (0.45 * FPS), 0, 1);
  const alpha = entryAlpha * (1 - tExit);

  const base = 0.35 * FPS;
  const step = 0.55 * FPS;
  const line = (i: number) =>
    clamp((local - (base + i * step)) / (0.38 * FPS), 0, 1);
  const tBadge = clamp((local - 4) / (0.32 * FPS), 0, 1);

  const elevLine = `${peak.elevationFt.toLocaleString()} ft`;
  const coolFact = briefLine(peak.hook, 150);
  const spotIt = briefLine(peak.distinguishingFeature, 160);

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        opacity: alpha,
        pointerEvents: 'none',
      }}
    >
      {/* Light bottom scrim only — keeps terrain visible full-frame */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: '46%',
          background:
            'linear-gradient(to top, rgba(10,23,40,0.92) 0%, rgba(10,23,40,0.55) 42%, rgba(10,23,40,0.12) 78%, transparent 100%)',
        }}
      />

      <div
        style={{
          position: 'absolute',
          left: SAFE_LEFT,
          right: 1080 - SAFE_RIGHT,
          bottom: SAFE_BOTTOM_INSET + 8,
          transform: `translateY(${entryY}px)`,
        }}
      >
        <div
          style={{
            fontFamily: FONT_BODY,
            fontSize: 15,
            fontWeight: 700,
            letterSpacing: 3,
            color: GOLD,
            marginBottom: 6,
            opacity: tBadge,
          }}
        >
          {String(displayOrder).padStart(2, '0')} / 10
        </div>

        <div
          style={{
            fontFamily: FONT_SERIF,
            fontSize: 56,
            lineHeight: 1.05,
            color: WHITE,
            textShadow: TEXT_SHADOW,
            marginBottom: 14,
            opacity: line(0),
            transform: `translateY(${(1 - easeOutQuart(line(0))) * 10}px)`,
          }}
        >
          {peak.name}
        </div>

        <FactLine
          label="Elevation"
          text={elevLine}
          t={line(1)}
          size={30}
        />
        <div style={{ height: 10 }} />
        <FactLine
          label="Did you know"
          text={coolFact}
          t={line(2)}
          size={28}
        />
        <div style={{ height: 10 }} />
        <FactLine
          label="How to spot it"
          text={spotIt}
          t={line(3)}
          size={28}
        />
      </div>
    </div>
  );
};

const FactLine: React.FC<{
  label: string;
  text: string;
  t: number;
  size: number;
}> = ({ label, text, t, size }) => {
  const o = easeOutQuart(t);
  return (
    <div
      style={{
        opacity: o,
        transform: `translateY(${(1 - o) * 12}px)`,
      }}
    >
      <div
        style={{
          fontFamily: FONT_BODY,
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: 2.4,
          textTransform: 'uppercase',
          color: GOLD_SOFT,
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: FONT_BODY,
          fontSize: size,
          fontWeight: 600,
          lineHeight: 1.28,
          color: WHITE,
          textShadow: TEXT_SHADOW,
          maxWidth: 980,
        }}
      >
        {text}
      </div>
    </div>
  );
};
