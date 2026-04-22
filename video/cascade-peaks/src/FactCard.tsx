// FactCard — HERO + INFO PANEL layout.
//
// New architecture (Matt feedback: need to see the 3D terrain, not obscure it):
//   [0-300]     Top floating header over 3D: order badge + peak name
//                 (no scrim — text shadow only for legibility)
//   [300-1050]  3D hero stays fully visible
//   [1050-1920] Solid navy info panel with stats, hook, bullets, local knowledge
//
// This gets the gorgeous Photorealistic 3D Tiles terrain front-and-center
// while still delivering all the playful-teaching content underneath.

import React from 'react';
import { useCurrentFrame } from 'remotion';
import {
  FONT_BODY,
  FONT_SERIF,
  GOLD,
  GOLD_SOFT,
  NAVY_DEEP,
  TEXT_SHADOW,
  WHITE,
} from './brand';
import { FPS } from './config';
import type { Peak } from './peaks';
import { clamp, easeOutCubic, easeOutQuart } from './easing';

type FactCardProps = {
  peak: Peak;
  /** Total scene duration (for late-phase local-knowledge reveal timing). */
  durationSec: number;
  /** Frame offset where this card becomes visible. */
  frameOffset: number;
  /** 1-10 index for the "01/10" badge. */
  displayOrder: number;
};

// Vertical split: 3D hero occupies top 55% of 1920, info panel bottom 45%.
const PANEL_TOP = 1050;

export const FactCard: React.FC<FactCardProps> = ({
  peak,
  durationSec,
  frameOffset,
  displayOrder,
}) => {
  const frame = useCurrentFrame();
  const local = frame - frameOffset;

  // Entry envelope: 0.6s slide+fade in
  const entryFrames = 0.6 * FPS;
  const tEntry = clamp(local / entryFrames, 0, 1);
  const entryAlpha = easeOutCubic(tEntry);
  const entryY = (1 - easeOutQuart(tEntry)) * 30;

  // Exit envelope: last 0.5s
  const totalFrames = durationSec * FPS;
  const exitStart = totalFrames - 0.5 * FPS;
  const tExit = clamp((local - exitStart) / (0.5 * FPS), 0, 1);
  const exitAlpha = 1 - tExit;

  const alpha = entryAlpha * exitAlpha;

  // Sequential reveal for facts — one bullet per 0.7s after stats arrive
  const panelArriveFrame = 0.8 * FPS;
  const perFactFrames = 0.7 * FPS;
  const factAlpha = (i: number) => {
    const start = panelArriveFrame + i * perFactFrames;
    return clamp((local - start) / (0.4 * FPS), 0, 1);
  };
  const factY = (i: number) => (1 - easeOutQuart(factAlpha(i))) * 20;

  // Local-knowledge line arrives in the back half
  const lkStart =
    panelArriveFrame + peak.facts.length * perFactFrames + 0.3 * FPS;
  const tLk = clamp((local - lkStart) / (0.5 * FPS), 0, 1);

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        opacity: alpha,
        pointerEvents: 'none',
      }}
    >
      {/* ========================================================== */}
      {/* TOP FLOATING HEADER — sits over 3D, no scrim, text shadow only */}
      {/* ========================================================== */}
      <div
        style={{
          position: 'absolute',
          left: 60,
          right: 60,
          top: 80 + entryY,
        }}
      >
        {/* Order badge */}
        <div
          style={{
            display: 'inline-block',
            padding: '8px 18px',
            background: GOLD,
            color: NAVY_DEEP,
            fontFamily: FONT_BODY,
            fontWeight: 800,
            fontSize: 28,
            letterSpacing: 3,
            borderRadius: 3,
            marginBottom: 14,
            boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
          }}
        >
          {String(displayOrder).padStart(2, '0')} / 10
        </div>
        {/* Peak name — HUGE, over 3D, with heavy shadow so it reads */}
        <div
          style={{
            fontFamily: FONT_SERIF,
            fontSize: 128,
            lineHeight: 1.0,
            color: WHITE,
            textShadow:
              '0 0 18px rgba(10,23,40,1), 0 0 34px rgba(10,23,40,0.9), 0 3px 6px rgba(0,0,0,0.95)',
          }}
        >
          {peak.name}
        </div>
      </div>

      {/* ========================================================== */}
      {/* BOTTOM INFO PANEL — solid navy with stats, hook, bullets */}
      {/* ========================================================== */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: PANEL_TOP,
          bottom: 0,
          background: `linear-gradient(to bottom, rgba(10,23,40,0.92) 0%, ${NAVY_DEEP} 8%, ${NAVY_DEEP} 100%)`,
          padding: '38px 60px 52px 60px',
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
        }}
      >
        {/* Thin gold divider at the top edge */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            height: 3,
            background: `linear-gradient(to right, transparent 0%, ${GOLD} 20%, ${GOLD} 80%, transparent 100%)`,
            boxShadow: `0 0 12px ${GOLD_SOFT}`,
          }}
        />

        {/* Stats row */}
        <div
          style={{
            display: 'flex',
            gap: 14,
            flexWrap: 'wrap',
          }}
        >
          <StatPill label="ELEV" value={`${peak.elevationFt.toLocaleString()} ft`} />
          <StatPill
            label="DIST"
            value={`${peak.distanceMi.toFixed(1)} mi ${peak.bearing}`}
          />
          {peak.lastEruption ? (
            <StatPill label="ERUPTED" value={peak.lastEruption} />
          ) : null}
        </div>

        {/* Hook — gold italic feel */}
        <div
          style={{
            fontFamily: FONT_SERIF,
            fontSize: 40,
            lineHeight: 1.22,
            color: GOLD_SOFT,
            marginTop: 2,
          }}
        >
          {peak.hook}
        </div>

        {/* Fact bullets */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            marginTop: 4,
          }}
        >
          {peak.facts.map((f, i) => (
            <div
              key={i}
              style={{
                opacity: factAlpha(i),
                transform: `translateY(${factY(i)}px)`,
                display: 'flex',
                alignItems: 'flex-start',
                gap: 14,
              }}
            >
              <div
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: GOLD,
                  marginTop: 14,
                  flexShrink: 0,
                  boxShadow: `0 0 10px ${GOLD_SOFT}`,
                }}
              />
              <div
                style={{
                  fontFamily: FONT_BODY,
                  fontSize: 30,
                  fontWeight: 500,
                  lineHeight: 1.3,
                  color: WHITE,
                }}
              >
                {f}
              </div>
            </div>
          ))}
        </div>

        {/* Local knowledge — pinned bottom */}
        <div
          style={{
            marginTop: 'auto',
            padding: '14px 20px',
            background: 'rgba(255,255,255,0.08)',
            borderLeft: `3px solid ${GOLD}`,
            opacity: tLk,
            transform: `translateY(${(1 - tLk) * 12}px)`,
          }}
        >
          <div
            style={{
              fontFamily: FONT_BODY,
              fontSize: 20,
              fontWeight: 700,
              letterSpacing: 2.4,
              textTransform: 'uppercase',
              color: GOLD_SOFT,
              marginBottom: 3,
            }}
          >
            Local knowledge
          </div>
          <div
            style={{
              fontFamily: FONT_SERIF,
              fontSize: 28,
              lineHeight: 1.3,
              color: WHITE,
            }}
          >
            {peak.localKnowledge}
          </div>
        </div>
      </div>
    </div>
  );
};

const StatPill: React.FC<{ label: string; value: string }> = ({
  label,
  value,
}) => (
  <div
    style={{
      padding: '8px 14px',
      background: 'rgba(212,175,55,0.08)',
      border: `1px solid ${GOLD}`,
      borderRadius: 4,
      display: 'flex',
      flexDirection: 'column',
      lineHeight: 1.05,
    }}
  >
    <div
      style={{
        fontFamily: FONT_BODY,
        fontSize: 13,
        fontWeight: 700,
        letterSpacing: 2.2,
        color: GOLD_SOFT,
        marginBottom: 3,
      }}
    >
      {label}
    </div>
    <div
      style={{
        fontFamily: FONT_BODY,
        fontSize: 24,
        fontWeight: 700,
        color: WHITE,
        textShadow: TEXT_SHADOW,
      }}
    >
      {value}
    </div>
  </div>
);
