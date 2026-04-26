// ClipSunBeltCorrection — VIRAL REBUILD
// 28s, 1080×1920 portrait. TikTok / Reel register: animated cool-blue gradient
// bg, kinetic captions, comparison stat cards with growing bars, source pills.
//
// The honest narrative is: "pandemic-era boom markets are giving back, and
// Central Oregon is in the same correction. Pattern is cycle position, not
// geography."
//
// Verification trace per figure:
//   - Cape Coral -9.6% (Feb 2025 → Feb 2026, AEI Housing Center via Fortune
//     2026-04-11): https://fortune.com/2026/04/11/housing-prices-by-city-2026/
//   - Kansas City +8.6% (same source, same window): same article
//   - Bend -3.6% trailing-12-months: Supabase ryan-realty-platform
//     market_stats_cache, geo_slug='bend', period_type='monthly',
//     median-of-monthly-median_sale_price last-12mo vs prior-12mo computed
//     2026-04-26 (current month -10.0% YoY, prior month -12.2% YoY)
//
// CUT (per CLAUDE.md data accuracy rule):
//   - "Austin -4.1%" — not in cited Fortune source.

import React from 'react';
import { AbsoluteFill, Sequence } from 'remotion';
import {
  AnimatedGradientBg,
  ParticleField,
  BreakingPill,
  KineticCaption,
  Headline,
  StatCard,
  SourcePill,
  NewsTicker,
  BrandEndCard,
  BigStat,
  RED_ALERT,
  WHITE,
  FONT_BODY,
  FONT_HEAD,
} from './viral_primitives';

const FPS = 30;
export const CLIP_SBC_TOTAL_SEC = 28.0;

const SRC_FORTUNE = 'Fortune / AEI Housing Center · April 2026';
const SRC_BEND = 'ryan-realty-platform · MLS pull · 2026-04-26';

// Beat 1 — Hook: BREAKING + "Boom markets are giving back".
const BeatHook: React.FC = () => (
  <AbsoluteFill>
    <AnimatedGradientBg variant="cool" />
    <ParticleField count={40} color="rgba(120, 160, 220, 0.55)" />
    <BreakingPill startFrame={0} text="MARKET CORRECTION" color={RED_ALERT} />
    <KineticCaption
      startFrame={6}
      words={['THE', 'BOOM', 'MARKETS']}
      cadenceFrames={8}
      position="upper-third"
      fontSize={72}
      fontFamily={FONT_HEAD}
      fontWeight={700}
      letterSpacing="-0.005em"
    />
    <KineticCaption
      startFrame={36}
      words={['ARE', 'GIVING', 'IT', 'BACK.']}
      cadenceFrames={9}
      position="center"
      fontSize={96}
      fontFamily={FONT_HEAD}
      fontWeight={700}
      letterSpacing="-0.01em"
      highlightWord={2}
    />
    <KineticCaption
      startFrame={84}
      words={['HOME', 'PRICES', 'FEB', '2025', '→', 'FEB', '2026']}
      cadenceFrames={5}
      position="lower-third"
      fontSize={36}
      fontFamily={FONT_BODY}
    />
  </AbsoluteFill>
);

// Beat 2 — Comparison cards: Cape Coral / Bend / Kansas City.
const BeatBars: React.FC = () => (
  <AbsoluteFill>
    <AnimatedGradientBg variant="cool" />
    <ParticleField count={28} color="rgba(120, 160, 220, 0.35)" />
    <Headline
      text="Same year. Different cycles."
      startFrame={4}
      position="top"
      fontSize={48}
    />
    <StatCard
      startFrame={20}
      delayCard={0}
      city="Cape Coral, FL"
      pct={-9.6}
      yPct={36}
    />
    <StatCard
      startFrame={20}
      delayCard={18}
      city="Bend, OR"
      pct={-3.6}
      yPct={52}
    />
    <StatCard
      startFrame={20}
      delayCard={36}
      city="Kansas City, MO"
      pct={8.6}
      yPct={68}
    />
    <SourcePill text={SRC_FORTUNE} startFrame={70} />
  </AbsoluteFill>
);

// Beat 3 — The pattern: cycle position.
const BeatPattern: React.FC = () => (
  <AbsoluteFill>
    <AnimatedGradientBg variant="mixed" />
    <ParticleField count={36} color="rgba(212, 175, 55, 0.40)" />
    <KineticCaption
      startFrame={4}
      words={['THE', 'PATTERN', 'IS', 'NOT']}
      cadenceFrames={7}
      position="upper-third"
      fontSize={56}
      fontFamily={FONT_BODY}
    />
    <KineticCaption
      startFrame={36}
      words={['GEOGRAPHY.']}
      cadenceFrames={1}
      position="center"
      fontSize={92}
      fontFamily={FONT_HEAD}
      fontWeight={700}
      letterSpacing="-0.01em"
    />
    <KineticCaption
      startFrame={64}
      words={['IT', 'IS', 'CYCLE', 'POSITION.']}
      cadenceFrames={9}
      position="lower-third"
      fontSize={72}
      fontFamily={FONT_HEAD}
      fontWeight={700}
      letterSpacing="-0.01em"
      highlightWord={3}
    />
  </AbsoluteFill>
);

// Beat 4 — Bend localization with the -3.6% number front and center.
const BeatBendLocal: React.FC = () => (
  <AbsoluteFill>
    <AnimatedGradientBg variant="cool" />
    <ParticleField count={36} color="rgba(180, 80, 80, 0.45)" />
    <Headline
      text="Bend, Oregon"
      startFrame={4}
      position="upper-third"
      fontSize={64}
      color={WHITE}
    />
    <BigStat
      startFrame={16}
      durationFrames={32}
      from={0}
      to={-3.6}
      format={(v) => `${v.toFixed(1)}%`}
      fontSize={300}
      color={RED_ALERT}
      glowColor="rgba(230, 57, 70, 0.55)"
      position={{ top: '52%', left: '50%' }}
    />
    <KineticCaption
      startFrame={56}
      words={['MEDIAN', 'SALE', 'PRICE']}
      cadenceFrames={6}
      position="lower-third"
      fontSize={46}
      fontFamily={FONT_BODY}
    />
    <KineticCaption
      startFrame={84}
      words={['TRAILING', '12', 'MONTHS']}
      cadenceFrames={6}
      position="bottom"
      fontSize={36}
      fontFamily={FONT_BODY}
    />
    <SourcePill text={SRC_BEND} startFrame={88} />
  </AbsoluteFill>
);

// Beat 5 — Takeaway: kinetic punchline + ticker.
const BeatTakeaway: React.FC = () => (
  <AbsoluteFill>
    <AnimatedGradientBg variant="mixed" />
    <ParticleField count={36} color="rgba(212, 175, 55, 0.45)" />
    <KineticCaption
      startFrame={4}
      words={['BOOM', 'MARKETS', 'CORRECT.']}
      cadenceFrames={8}
      position="upper-third"
      fontSize={64}
      fontFamily={FONT_HEAD}
      fontWeight={700}
      letterSpacing="-0.005em"
    />
    <KineticCaption
      startFrame={42}
      words={['STABLE', 'MARKETS', 'GAIN.']}
      cadenceFrames={8}
      position="center"
      fontSize={64}
      fontFamily={FONT_HEAD}
      fontWeight={700}
      letterSpacing="-0.005em"
    />
    <KineticCaption
      startFrame={84}
      words={['WHEN', 'YOU', 'BOUGHT', 'MATTERS', 'MORE', 'THAN', 'WHERE.']}
      cadenceFrames={5}
      position="lower-third"
      fontSize={42}
      fontFamily={FONT_BODY}
      highlightWord={3}
    />
    <NewsTicker text="CAPE CORAL -9.6% · BEND -3.6% · KANSAS CITY +8.6% · CYCLE POSITION OVER GEOGRAPHY" />
  </AbsoluteFill>
);

export const ClipSunBeltCorrection: React.FC = () => {
  // Beat layout (frames at 30fps, 28s total):
  //   0–150    (0–5s)     Hook
  //   150–300  (5–10s)    Comparison cards
  //   300–450  (10–15s)   Pattern: cycle position
  //   450–600  (15–20s)   Bend -3.6%
  //   600–750  (20–25s)   Takeaway + ticker
  //   750–840  (25–28s)   Brand end card
  return (
    <AbsoluteFill style={{ background: '#050d18' }}>
      <Sequence from={0} durationInFrames={156}>
        <BeatHook />
      </Sequence>
      <Sequence from={150} durationInFrames={156}>
        <BeatBars />
      </Sequence>
      <Sequence from={300} durationInFrames={156}>
        <BeatPattern />
      </Sequence>
      <Sequence from={450} durationInFrames={156}>
        <BeatBendLocal />
      </Sequence>
      <Sequence from={600} durationInFrames={156}>
        <BeatTakeaway />
      </Sequence>
      <Sequence from={750} durationInFrames={90}>
        <BrandEndCard startFrame={0} />
      </Sequence>
    </AbsoluteFill>
  );
};
