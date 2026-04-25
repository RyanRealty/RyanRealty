// SpecDrop — title card with address, price, beds/baths/sqft/lot all on
// screen at once. Stagger their entry so the eye lands on each.

import React from 'react';
import { FONT_BODY, FONT_SERIF, GOLD, NAVY_DARKER, NAVY_DEEP, WHITE } from './brand';
import { clamp, easeOutCubic, easeOutQuart } from './easing';

type Spec = { label: string; value: string };

type Props = {
  local: number;
  durationSec: number;
  address1: string;       // "56111 SCHOOL HOUSE RD"
  address2: string;       // "BEND, OREGON"
  price: string;          // e.g. "$3,895,000" — leave blank if not listed
  specs: Spec[];          // up to 5 — beds, baths, sqft, lot, garage
  /** Heading at top */
  kicker?: string;        // "VANDEVERT RANCH"
};

export const SpecDrop: React.FC<Props> = ({
  local,
  durationSec,
  address1,
  address2,
  price,
  specs,
  kicker = 'VANDEVERT RANCH',
}) => {
  const tEntry = clamp(local / 0.35, 0, 1);
  const tExit = clamp((local - (durationSec - 0.3)) / 0.3, 0, 1);
  const fade = 1 - tExit;
  const tKicker = clamp(local / 0.25, 0, 1);
  const tAddr = clamp((local - 0.2) / 0.4, 0, 1);
  const tSpecs = clamp((local - 0.55) / 0.45, 0, 1);
  const tPrice = clamp((local - 0.85) / 0.4, 0, 1);

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: `radial-gradient(ellipse at 50% 50%, ${NAVY_DEEP} 0%, ${NAVY_DARKER} 90%)`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 90px',
      }}
    >
      {/* Top kicker */}
      <div
        style={{
          fontFamily: FONT_BODY,
          fontWeight: 700,
          fontSize: 26,
          color: GOLD,
          letterSpacing: 6,
          textTransform: 'uppercase',
          marginBottom: 28,
          opacity: easeOutCubic(tKicker) * fade,
        }}
      >
        {kicker}
      </div>

      {/* Address — Amboqia hero (auto-wrap controlled to avoid orphan) */}
      <div
        style={{
          fontFamily: FONT_SERIF,
          fontSize: 84,
          lineHeight: 1.0,
          color: WHITE,
          textAlign: 'center',
          letterSpacing: '-0.02em',
          opacity: easeOutCubic(tAddr) * fade,
          transform: `translateY(${(1 - easeOutQuart(tAddr)) * 22}px)`,
          marginBottom: 14,
          maxWidth: 940,
        }}
      >
        {address1}
      </div>
      <div
        style={{
          fontFamily: FONT_BODY,
          fontWeight: 700,
          fontSize: 30,
          color: GOLD,
          letterSpacing: 5,
          textTransform: 'uppercase',
          marginBottom: 60,
          opacity: easeOutCubic(tAddr) * fade,
        }}
      >
        {address2}
      </div>

      {/* Spec row */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0 40px',
          rowGap: 18,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: easeOutCubic(tSpecs) * fade,
          transform: `translateY(${(1 - easeOutQuart(tSpecs)) * 18}px)`,
          maxWidth: 920,
        }}
      >
        {specs.map((s, i) => (
          <React.Fragment key={i}>
            {i > 0 ? <div style={{ width: 1, height: 50, background: 'rgba(212,175,55,0.5)' }} /> : null}
            <div style={{ textAlign: 'center', minWidth: 130 }}>
              <div
                style={{
                  fontFamily: FONT_SERIF,
                  fontSize: 56,
                  lineHeight: 1.0,
                  color: WHITE,
                  letterSpacing: '-0.01em',
                }}
              >
                {s.value}
              </div>
              <div
                style={{
                  marginTop: 6,
                  fontFamily: FONT_BODY,
                  fontWeight: 700,
                  fontSize: 18,
                  color: GOLD,
                  letterSpacing: 2.5,
                  textTransform: 'uppercase',
                }}
              >
                {s.label}
              </div>
            </div>
          </React.Fragment>
        ))}
      </div>

      {/* Price pill */}
      {price ? (
        <div
          style={{
            marginTop: 56,
            padding: '14px 36px',
            background: GOLD,
            color: NAVY_DARKER,
            fontFamily: FONT_BODY,
            fontWeight: 900,
            fontSize: 38,
            letterSpacing: 1.5,
            borderRadius: 4,
            opacity: easeOutCubic(tPrice) * fade,
            transform: `scale(${0.92 + 0.08 * easeOutQuart(tPrice)})`,
          }}
        >
          {price}
        </div>
      ) : null}
    </div>
  );
};
