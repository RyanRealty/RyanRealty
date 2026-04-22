// ClosingCard — Washington photo + contact info. Per
// feedback_market_report_closing_standard.md and the viral-video "no logo
// animation" rule, this is a simple fade-in closing, navy underlay, white
// logo, IG handle + domain + phone on clean rows. No shimmer, no glow, no
// extra CTA.

import React from 'react';
import { staticFile, useCurrentFrame, Img } from 'remotion';
import {
  DOMAIN,
  FONT_BODY,
  FONT_SERIF,
  GOLD,
  GOLD_SOFT,
  IG_HANDLE,
  NAVY_DEEP,
  PHONE,
  SAFE_LEFT,
  SAFE_RIGHT,
  TEXT_SHADOW,
  WHITE,
} from './brand';
import { CLOSING_CARD_SEC, FPS } from './config';
import { clamp, easeOutCubic } from './easing';

type ClosingCardProps = {
  frameOffset: number;
};

export const ClosingCard: React.FC<ClosingCardProps> = ({ frameOffset }) => {
  const frame = useCurrentFrame();
  const local = frame - frameOffset;

  const totalFrames = CLOSING_CARD_SEC * FPS;
  const tEntry = clamp(local / (0.5 * FPS), 0, 1);
  const alpha = easeOutCubic(tEntry);

  const tH = clamp((local - 6) / (0.7 * FPS), 0, 1);
  const tC = clamp((local - 22) / (0.7 * FPS), 0, 1);

  return (
    <div style={{ position: 'absolute', inset: 0, opacity: alpha, overflow: 'hidden' }}>
      <Img
        src={staticFile('washington_closer_graded.jpg')}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
        }}
      />
      {/* Navy fade — heavy at top & bottom for contact-bar legibility */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(to bottom, rgba(10,23,40,0.65) 0%, rgba(10,23,40,0.12) 35%, rgba(10,23,40,0.18) 60%, rgba(10,23,40,0.92) 100%)',
        }}
      />
      {/* Closing headline */}
      <div
        style={{
          position: 'absolute',
          left: SAFE_LEFT,
          right: 1080 - SAFE_RIGHT,
          top: 360,
          opacity: tH,
          transform: `translateY(${(1 - tH) * 18}px)`,
        }}
      >
        <div
          style={{
            fontFamily: FONT_BODY,
            fontSize: 26,
            fontWeight: 700,
            letterSpacing: 3,
            color: GOLD,
            marginBottom: 22,
          }}
        >
          10 PEAKS · ONE SKYLINE · FROM BEND
        </div>
        <div
          style={{
            fontFamily: FONT_SERIF,
            fontSize: 92,
            lineHeight: 1.02,
            color: WHITE,
            textShadow: TEXT_SHADOW,
          }}
        >
          Now you can name them all.
        </div>
      </div>
      {/* Contact block — bottom safe, navy solid band */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 180,
          padding: '36px 60px 44px',
          background: NAVY_DEEP,
          borderTop: `3px solid ${GOLD}`,
          opacity: tC,
          transform: `translateY(${(1 - tC) * 18}px)`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
          <div
            style={{
              width: 120,
              height: 120,
              borderRadius: 8,
              background: 'rgba(255,255,255,0.08)',
              border: `2px solid ${GOLD}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: FONT_SERIF,
              fontSize: 46,
              fontWeight: 600,
              color: WHITE,
              letterSpacing: -2,
              flexShrink: 0,
              boxShadow: '0 2px 12px rgba(0,0,0,0.45)',
            }}
            aria-hidden
          >
            RR
          </div>
          <div style={{ flex: 1 }}>
            <ContactLine label="INSTAGRAM" value={IG_HANDLE} />
            <ContactLine label="WEB" value={DOMAIN} />
            <ContactLine label="CALL" value={PHONE} last />
          </div>
        </div>
        <div
          style={{
            marginTop: 22,
            fontFamily: FONT_BODY,
            fontSize: 20,
            fontWeight: 500,
            color: GOLD_SOFT,
            letterSpacing: 2,
            textAlign: 'center',
          }}
        >
          RYAN REALTY · BEND, OREGON
        </div>
      </div>
    </div>
  );
};

const ContactLine: React.FC<{ label: string; value: string; last?: boolean }> = ({
  label,
  value,
  last,
}) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'baseline',
      gap: 18,
      paddingBottom: last ? 0 : 8,
      marginBottom: last ? 0 : 8,
      borderBottom: last ? 'none' : `1px solid ${GOLD}40`,
    }}
  >
    <div
      style={{
        fontFamily: FONT_BODY,
        fontSize: 16,
        fontWeight: 700,
        letterSpacing: 2.6,
        color: GOLD_SOFT,
        width: 120,
      }}
    >
      {label}
    </div>
    <div
      style={{
        fontFamily: FONT_BODY,
        fontSize: 34,
        fontWeight: 600,
        color: WHITE,
        letterSpacing: 0.4,
      }}
    >
      {value}
    </div>
  </div>
);
