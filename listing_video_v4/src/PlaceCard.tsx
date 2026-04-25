// PlaceCard v2 — warm luxury treatment with photo background.

import React from 'react';
import { Img, staticFile } from 'remotion';
import {
  CHARCOAL,
  ESPRESSO,
  FONT_BODY,
  FONT_SERIF,
  GOLD,
  GOLD_WARM,
  OFF_WHITE,
  LUXURY_GRADE_FILTER,
} from './brand';
import { clamp, easeInOutCubic, easeOutCubic, easeOutQuart } from './easing';

type Fact = { label: string; value: string };

type Props = {
  local: number;
  durationSec: number;
  bgPhoto: string;
  title: string;
  tagline: string;
  facts: Fact[];
  /** "VANDEVERT RANCH" small caps over the title */
  kicker?: string;
};

export const PlaceCard: React.FC<Props> = ({
  local,
  durationSec,
  bgPhoto,
  title,
  tagline,
  facts,
  kicker = 'The Place',
}) => {
  const t = clamp(local / durationSec, 0, 1);
  const eased = easeInOutCubic(t);
  const dx = -(eased - 0.5) * 28;
  const dy = (eased - 0.5) * 10;
  const scale = 1.08;

  const tKicker = clamp(local / 0.45, 0, 1);
  const tTitle = clamp((local - 0.2) / 0.5, 0, 1);
  const tTagline = clamp((local - 0.5) / 0.55, 0, 1);
  const tFacts = clamp((local - 0.8) / 0.6, 0, 1);
  const tExit = clamp((local - (durationSec - 0.4)) / 0.4, 0, 1);
  const fade = 1 - tExit;

  return (
    <div style={{ position: 'absolute', inset: 0, background: CHARCOAL, overflow: 'hidden' }}>
      <Img
        src={staticFile(`images/${bgPhoto}`)}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: `translate(${dx}px, ${dy}px) scale(${scale})`,
          transformOrigin: '50% 50%',
          filter: `${LUXURY_GRADE_FILTER} brightness(0.5)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `linear-gradient(180deg, rgba(20,15,10,0.55) 0%, rgba(20,15,10,0.7) 60%, ${CHARCOAL} 100%)`,
        }}
      />

      <div
        style={{
          position: 'absolute',
          left: 90,
          right: 90,
          top: '50%',
          transform: 'translateY(-50%)',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            fontFamily: FONT_BODY,
            fontWeight: 700,
            fontSize: 22,
            color: GOLD,
            letterSpacing: 8,
            textTransform: 'uppercase',
            marginBottom: 32,
            opacity: easeOutCubic(tKicker) * fade,
          }}
        >
          {kicker}
        </div>
        <div
          style={{
            fontFamily: FONT_SERIF,
            fontSize: 110,
            lineHeight: 1.0,
            color: OFF_WHITE,
            letterSpacing: '-0.02em',
            opacity: easeOutCubic(tTitle) * fade,
            transform: `translateY(${(1 - easeOutQuart(tTitle)) * 26}px)`,
            marginBottom: 22,
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontFamily: FONT_SERIF,
            fontStyle: 'italic',
            fontSize: 30,
            lineHeight: 1.4,
            color: 'rgba(232,221,199,0.85)',
            opacity: easeOutCubic(tTagline) * fade,
            marginBottom: 56,
            maxWidth: 880,
            marginLeft: 'auto',
            marginRight: 'auto',
          }}
        >
          {tagline}
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: 36,
            opacity: easeOutCubic(tFacts) * fade,
          }}
        >
          {facts.map((f, i) => (
            <div key={i} style={{ textAlign: 'center', maxWidth: 280 }}>
              <div
                style={{
                  fontFamily: FONT_SERIF,
                  fontSize: 64,
                  lineHeight: 1.0,
                  color: GOLD_WARM,
                  letterSpacing: '-0.02em',
                }}
              >
                {f.value}
              </div>
              <div
                style={{
                  marginTop: 8,
                  fontFamily: FONT_BODY,
                  fontWeight: 700,
                  fontSize: 18,
                  color: OFF_WHITE,
                  letterSpacing: 3,
                  textTransform: 'uppercase',
                }}
              >
                {f.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
