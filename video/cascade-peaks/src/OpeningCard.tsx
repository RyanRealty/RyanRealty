// OpeningCard — hero IG-grid frame. Color-graded Jefferson photo under a
// navy scrim, headline in Amboqia asking the viewer to test themselves.
//
// Matt's hook: "How many Cascade peaks can you name from Bend?"
// Subline:     "Here are all 10 — and how to spot them."

import React from 'react';
import { staticFile, useCurrentFrame, Img } from 'remotion';
import {
  FONT_BODY,
  FONT_SERIF,
  GOLD,
  GOLD_SOFT,
  SAFE_LEFT,
  SAFE_RIGHT,
  TEXT_SHADOW,
  WHITE,
} from './brand';
import { FPS, OPENING_CARD_SEC } from './config';
import { clamp, easeOutCubic, easeOutQuart } from './easing';

type OpeningCardProps = {
  frameOffset: number;
};

export const OpeningCard: React.FC<OpeningCardProps> = ({ frameOffset }) => {
  const frame = useCurrentFrame();
  const local = frame - frameOffset;

  const totalFrames = OPENING_CARD_SEC * FPS;
  const tEntry = clamp(local / (0.4 * FPS), 0, 1);
  const tExit = clamp((local - (totalFrames - 0.5 * FPS)) / (0.5 * FPS), 0, 1);
  const alpha = easeOutCubic(tEntry) * (1 - tExit);

  // Slow Ken Burns on the background photo (1.00 → 1.06 over the card).
  const tKen = clamp(local / totalFrames, 0, 1);
  const kenScale = 1 + 0.06 * easeOutQuart(tKen);

  // Staggered headline rise
  const tH1 = clamp((local - 6) / (0.7 * FPS), 0, 1);
  const tH2 = clamp((local - 18) / (0.7 * FPS), 0, 1);
  const tH3 = clamp((local - 30) / (0.7 * FPS), 0, 1);

  return (
    <div style={{ position: 'absolute', inset: 0, opacity: alpha, overflow: 'hidden' }}>
      <Img
        src={staticFile('jefferson_opener_graded.jpg')}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: `scale(${kenScale})`,
          transformOrigin: 'center 40%',
        }}
      />
      {/* Navy scrim for legibility */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(to bottom, rgba(10,23,40,0.35) 0%, rgba(10,23,40,0.15) 45%, rgba(10,23,40,0.78) 100%)',
        }}
      />
      {/* Tiny top-left "10 peaks" kicker */}
      <div
        style={{
          position: 'absolute',
          top: 300,
          left: SAFE_LEFT,
          opacity: tH1,
          transform: `translateY(${(1 - tH1) * 18}px)`,
          padding: '7px 18px',
          background: GOLD,
          color: '#0a1a2e',
          fontFamily: FONT_BODY,
          fontWeight: 700,
          fontSize: 24,
          letterSpacing: 3,
          borderRadius: 3,
        }}
      >
        10 CASCADE PEAKS · ONE SKYLINE
      </div>
      {/* Headline block */}
      <div
        style={{
          position: 'absolute',
          left: SAFE_LEFT,
          right: 1080 - SAFE_RIGHT,
          bottom: 520,
        }}
      >
        <div
          style={{
            opacity: tH2,
            transform: `translateY(${(1 - tH2) * 24}px)`,
            fontFamily: FONT_SERIF,
            fontSize: 108,
            lineHeight: 1.02,
            color: WHITE,
            textShadow: TEXT_SHADOW,
            marginBottom: 32,
          }}
        >
          How many can you name
          <br />
          from Bend?
        </div>
        <div
          style={{
            opacity: tH3,
            transform: `translateY(${(1 - tH3) * 18}px)`,
            fontFamily: FONT_BODY,
            fontSize: 32,
            fontWeight: 500,
            lineHeight: 1.3,
            color: GOLD_SOFT,
            textShadow: TEXT_SHADOW,
            maxWidth: 900,
          }}
        >
          Here are all 10, and how to spot each.
        </div>
      </div>
    </div>
  );
};
