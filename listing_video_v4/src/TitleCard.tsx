// TitleCard — luxury cream-on-charcoal title moment for chapter breaks
// (e.g., "1892", "Today", "The Architect"). Letterboxed for cinema feel.

import React from 'react';
import { CHARCOAL, ESPRESSO, FONT_BODY, FONT_SERIF, GOLD, GOLD_WARM, OFF_WHITE } from './brand';
import { clamp, easeOutCubic, easeOutQuart } from './easing';

type Props = {
  local: number;
  durationSec: number;
  /** Top kicker (small caps gold) */
  kicker?: string;
  /** Big serif main */
  title: string;
  /** Sub line below */
  sub?: string;
  /** Tag line (small caps, gold, micro) */
  tag?: string;
};

export const TitleCard: React.FC<Props> = ({ local, durationSec, kicker, title, sub, tag }) => {
  const tEntry = clamp(local / 0.6, 0, 1);
  const tExit = clamp((local - (durationSec - 0.4)) / 0.4, 0, 1);
  const fade = 1 - tExit;
  const tKicker = clamp(local / 0.3, 0, 1);
  const tTitle = clamp((local - 0.2) / 0.5, 0, 1);
  const tSub = clamp((local - 0.45) / 0.5, 0, 1);
  const tTag = clamp((local - 0.7) / 0.4, 0, 1);

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: `radial-gradient(ellipse at 50% 50%, ${ESPRESSO} 0%, ${CHARCOAL} 90%)`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 90px',
      }}
    >
      {kicker ? (
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
      ) : null}

      <div
        style={{
          fontFamily: FONT_SERIF,
          fontSize: 130,
          lineHeight: 1.0,
          color: OFF_WHITE,
          textAlign: 'center',
          letterSpacing: '-0.02em',
          opacity: easeOutCubic(tTitle) * fade,
          transform: `translateY(${(1 - easeOutQuart(tTitle)) * 22}px)`,
          marginBottom: sub ? 28 : 0,
        }}
      >
        {title}
      </div>

      {sub ? (
        <div
          style={{
            fontFamily: FONT_SERIF,
            fontStyle: 'italic',
            fontSize: 36,
            lineHeight: 1.3,
            color: GOLD_WARM,
            textAlign: 'center',
            opacity: easeOutCubic(tSub) * fade,
            maxWidth: 880,
            marginBottom: tag ? 36 : 0,
          }}
        >
          {sub}
        </div>
      ) : null}

      {tag ? (
        <div
          style={{
            marginTop: 28,
            fontFamily: FONT_BODY,
            fontWeight: 500,
            fontSize: 18,
            color: 'rgba(232,221,199,0.65)',
            letterSpacing: 4,
            textTransform: 'uppercase',
            opacity: easeOutCubic(tTag) * fade,
          }}
        >
          {tag}
        </div>
      ) : null}

      {/* Subtle gold corner ornaments */}
      <div
        style={{
          position: 'absolute',
          top: 80,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 80,
          height: 2,
          background: GOLD,
          opacity: easeOutCubic(tKicker) * fade * 0.7,
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: 80,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 80,
          height: 2,
          background: GOLD,
          opacity: easeOutCubic(tTag || tSub || tTitle) * fade * 0.7,
        }}
      />
    </div>
  );
};
