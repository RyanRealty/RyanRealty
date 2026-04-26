// ClipTariffs — VIRAL REBUILD
// 28s, 1080×1920 portrait. TikTok / Reel register: animated hot gradient bg,
// kinetic captions, big stat reveals, materials bullet list, source pills.
//
// Verification trace per figure:
//   - "$10,900 per home" → NAHB / Wells Fargo Housing Market Index, April 2025
//     survey. https://www.nahb.org/blog/2025/05/tariff-uncertainty-impact-on-home-building
//     "On average, suppliers increased their prices by 6.3% ... builders
//     estimate a typical cost effect from recent tariff actions at $10,900 per
//     home."
//   - "450,000 fewer homes through 2030" → Center for American Progress
//     analysis. https://www.americanprogress.org/article/trump-administration-tariffs-could-result-in-450000-fewer-new-homes-through-2030/
//   - "6.3%" supplier price increase → same NAHB source.
//
// CUT (per CLAUDE.md data accuracy rule):
//   - "Central Oregon new construction is already limited" — Supabase shows
//     Bend's new construction share at 17.32% of active inventory.

import React from 'react';
import { AbsoluteFill, Sequence } from 'remotion';
import {
  AnimatedGradientBg,
  ParticleField,
  BreakingPill,
  KineticCaption,
  BigStat,
  Headline,
  SourcePill,
  BulletList,
  NewsTicker,
  BrandEndCard,
  RED_ALERT,
  FONT_BODY,
  FONT_HEAD,
} from './viral_primitives';

const FPS = 30;
export const CLIP_TARIFFS_TOTAL_SEC = 28.0;

const SRC_NAHB = 'NAHB / Wells Fargo HMI · April 2025';
const SRC_CAP = 'Center for American Progress · 2026';

// Beat 1 — Hook: BREAKING + huge $10,900 counter.
const BeatHook: React.FC = () => (
  <AbsoluteFill>
    <AnimatedGradientBg variant="hot" />
    <ParticleField count={50} color="rgba(212, 175, 55, 0.55)" />
    <BreakingPill startFrame={0} text="TARIFF IMPACT" color={RED_ALERT} />
    <Headline
      text="The cost of your next home"
      startFrame={6}
      position="upper-third"
      fontSize={50}
    />
    <BigStat
      startFrame={14}
      durationFrames={36}
      from={0}
      to={10900}
      format={(v) => `$${Math.round(v).toLocaleString('en-US')}`}
      fontSize={220}
      position={{ top: '52%', left: '50%' }}
    />
    <KineticCaption
      startFrame={56}
      words={['MORE', 'PER', 'NEW', 'HOME']}
      cadenceFrames={6}
      position="lower-third"
      fontSize={56}
      fontFamily={FONT_BODY}
      highlightWord={0}
    />
    <SourcePill text={SRC_NAHB} startFrame={70} />
  </AbsoluteFill>
);

// Beat 2 — Where it comes from: bullet list of materials + 6.3% framer.
const BeatMaterials: React.FC = () => (
  <AbsoluteFill>
    <AnimatedGradientBg variant="hot" />
    <ParticleField count={28} color="rgba(212, 175, 55, 0.40)" />
    <Headline
      text="Where the cost comes from"
      startFrame={4}
      position="top"
      fontSize={48}
    />
    <BulletList
      startFrame={20}
      staggerFrames={11}
      fontSize={50}
      items={[
        'Canadian softwood lumber',
        'Steel and aluminum',
        'Cabinets, drywall, doors',
      ]}
      position={{ top: '50%' }}
    />
    <KineticCaption
      startFrame={70}
      words={['BUILDER', 'COSTS', 'UP', '6.3%']}
      cadenceFrames={7}
      position="lower-third"
      fontSize={48}
      fontFamily={FONT_BODY}
      highlightWord={3}
    />
    <SourcePill text={SRC_NAHB} startFrame={86} />
  </AbsoluteFill>
);

// Beat 3 — Forward-looking: 450,000 fewer homes through 2030.
const BeatProjection: React.FC = () => (
  <AbsoluteFill>
    <AnimatedGradientBg variant="hot" />
    <ParticleField count={50} color="rgba(232, 197, 82, 0.55)" />
    <Headline
      text="Through 2030"
      startFrame={4}
      position="upper-third"
      fontSize={56}
    />
    <BigStat
      startFrame={14}
      durationFrames={42}
      from={0}
      to={450000}
      format={(v) => Math.round(v).toLocaleString('en-US')}
      fontSize={210}
      position={{ top: '52%', left: '50%' }}
    />
    <KineticCaption
      startFrame={62}
      words={['FEWER', 'NEW', 'HOMES', 'BUILT']}
      cadenceFrames={6}
      position="lower-third"
      fontSize={52}
      fontFamily={FONT_BODY}
      highlightWord={0}
    />
    <SourcePill text={SRC_CAP} startFrame={76} />
  </AbsoluteFill>
);

// Beat 4 — What this means.
const BeatExisting: React.FC = () => (
  <AbsoluteFill>
    <AnimatedGradientBg variant="hot" />
    <ParticleField count={32} color="rgba(212, 175, 55, 0.50)" />
    <KineticCaption
      startFrame={4}
      words={['LESS', 'NEW', 'SUPPLY.']}
      cadenceFrames={8}
      position="upper-third"
      fontSize={68}
      fontFamily={FONT_HEAD}
      fontWeight={700}
      letterSpacing="-0.005em"
    />
    <KineticCaption
      startFrame={36}
      words={['SAME', 'DEMAND.']}
      cadenceFrames={8}
      position="center"
      fontSize={84}
      fontFamily={FONT_HEAD}
      fontWeight={700}
      letterSpacing="-0.005em"
    />
    <KineticCaption
      startFrame={68}
      words={['EXISTING', 'HOMES', 'BECOME', 'THE', 'PLAY.']}
      cadenceFrames={6}
      position="lower-third"
      fontSize={50}
      fontFamily={FONT_BODY}
      highlightWord={0}
    />
  </AbsoluteFill>
);

// Beat 5 — Closer + ticker.
const BeatClose: React.FC = () => (
  <AbsoluteFill>
    <AnimatedGradientBg variant="hot" />
    <ParticleField count={42} color="rgba(212, 175, 55, 0.55)" />
    <KineticCaption
      startFrame={6}
      words={['WHEN', 'NEW', 'BUILDS', 'GET', 'HARDER']}
      cadenceFrames={6}
      position="upper-third"
      fontSize={54}
      fontFamily={FONT_BODY}
    />
    <KineticCaption
      startFrame={48}
      words={['THE', 'HOME', 'YOU', 'OWN']}
      cadenceFrames={7}
      position="center"
      fontSize={70}
      fontFamily={FONT_HEAD}
      fontWeight={700}
      letterSpacing="-0.005em"
    />
    <KineticCaption
      startFrame={82}
      words={['GETS', 'STRONGER.']}
      cadenceFrames={10}
      position="lower-third"
      fontSize={92}
      fontFamily={FONT_HEAD}
      fontWeight={700}
      letterSpacing="-0.01em"
      highlightWord={1}
    />
    <NewsTicker text="$10,900 PER NEW HOME · BUILDERS UP 6.3% · 450,000 FEWER HOMES BY 2030 · EXISTING SUPPLY GAINS" />
  </AbsoluteFill>
);

export const ClipTariffs: React.FC = () => {
  // Beat layout (frames at 30fps, 28s total):
  //   0–150    (0–5s)     Hook ($10,900)
  //   150–300  (5–10s)    Materials + 6.3%
  //   300–450  (10–15s)   Projection (450,000)
  //   450–600  (15–20s)   What it means
  //   600–750  (20–25s)   Closer + ticker
  //   750–840  (25–28s)   Brand end card
  return (
    <AbsoluteFill style={{ background: '#050d18' }}>
      <Sequence from={0} durationInFrames={156}>
        <BeatHook />
      </Sequence>
      <Sequence from={150} durationInFrames={156}>
        <BeatMaterials />
      </Sequence>
      <Sequence from={300} durationInFrames={156}>
        <BeatProjection />
      </Sequence>
      <Sequence from={450} durationInFrames={156}>
        <BeatExisting />
      </Sequence>
      <Sequence from={600} durationInFrames={156}>
        <BeatClose />
      </Sequence>
      <Sequence from={750} durationInFrames={90}>
        <BrandEndCard startFrame={0} />
      </Sequence>
    </AbsoluteFill>
  );
};
