// ClipGoldenHandcuffs — VIRAL REBUILD
// 28s, 1080×1920 portrait. TikTok / Reel register: animated gradient bg,
// word-by-word kinetic captions, big stat reveals, news ticker, source pills.
//
// Source: Coldwell Banker 2026 Home Shopping Season Report (PRNewswire
// 2026-04-23, n=727 Coldwell Banker affiliated agents, fielded Mar 23–Apr 6,
// 2026).
// https://www.prnewswire.com/news-releases/coldwell-banker-mortgage-rate-lock-in-effect-eases-one-in-three-home-sellers-are-giving-up-a-sub-5-rate-to-list-this-spring-302751081.html
//
// Verification trace per figure:
//   - "35%" of sellers giving up sub-5% rate to list this spring → Coldwell
//     Banker, body of release ("35% of sellers currently working with Coldwell
//     Banker affiliated agents have mortgage rates below 5% and are still
//     planning to sell this spring")
//   - "80%" of agents say buyers aren't waiting on rates → same release
//   - "43%" of agents report a busier shopping season than last year → same
//   - "61%" still call lock-in a major or moderate factor → same
//
// CUT (per CLAUDE.md data accuracy rule):
//   - "8% would stay in a bad relationship for their rate" — DOES NOT EXIST
//     in the cited source.
//   - Bend-specific overlay — Supabase shows Bend at 5.80 months of supply
//     (balanced/buyer-leaning, not seller territory). National story carries.

import React from 'react';
import { AbsoluteFill, Sequence, useVideoConfig } from 'remotion';
import {
  AnimatedGradientBg,
  ParticleField,
  BreakingPill,
  KineticCaption,
  BigStat,
  Headline,
  SourcePill,
  NewsTicker,
  BrandEndCard,
  FONT_BODY,
  FONT_HEAD,
} from './viral_primitives';

const FPS = 30;
export const CLIP_GH_TOTAL_SEC = 28.0;

const SRC = 'Coldwell Banker · April 2026 · n=727';

// Beat 1 — Hook: BREAKING + "1 in 3 sellers" + giant 35%.
const BeatHook: React.FC = () => (
  <AbsoluteFill>
    <AnimatedGradientBg variant="hot" />
    <ParticleField count={42} color="rgba(212, 175, 55, 0.55)" />
    <BreakingPill startFrame={0} text="MARKET SHIFT" />
    <Headline
      text="The lock-in is breaking"
      startFrame={6}
      position="upper-third"
      fontSize={64}
    />
    <BigStat
      startFrame={14}
      durationFrames={32}
      from={0}
      to={35}
      format={(v) => `${Math.round(v)}%`}
      fontSize={380}
      position={{ top: '52%', left: '50%' }}
    />
    <KineticCaption
      startFrame={48}
      words={['1', 'IN', '3', 'SELLERS']}
      cadenceFrames={6}
      position="lower-third"
      fontSize={62}
      fontFamily={FONT_BODY}
    />
    <SourcePill text={SRC} startFrame={60} />
  </AbsoluteFill>
);

// Beat 2 — Sub-5% rate holders are listing anyway.
const BeatSubFive: React.FC = () => (
  <AbsoluteFill>
    <AnimatedGradientBg variant="hot" />
    <ParticleField count={32} color="rgba(212, 175, 55, 0.40)" />
    <Headline
      text="Sub-5% rate holders"
      startFrame={4}
      position="upper-third"
      fontSize={56}
    />
    <KineticCaption
      startFrame={20}
      words={['ARE', 'LISTING', 'ANYWAY']}
      cadenceFrames={9}
      position="center"
      fontSize={84}
      fontFamily={FONT_HEAD}
      fontWeight={700}
      letterSpacing="-0.005em"
      highlightWord={2}
    />
    <KineticCaption
      startFrame={64}
      words={[
        '35%',
        'OF',
        'SPRING',
        'SELLERS',
        'HOLD',
        'A',
        'RATE',
        'BELOW',
        '5%',
      ]}
      cadenceFrames={5}
      position="lower-third"
      fontSize={40}
      fontFamily={FONT_BODY}
    />
    <SourcePill text={SRC} startFrame={70} />
  </AbsoluteFill>
);

// Beat 3 — Buyers aren't waiting either: 80%.
const BeatBuyers: React.FC = () => (
  <AbsoluteFill>
    <AnimatedGradientBg variant="hot" />
    <ParticleField count={42} color="rgba(232, 197, 82, 0.55)" />
    <Headline
      text="Buyers aren't waiting either"
      startFrame={4}
      position="upper-third"
      fontSize={54}
    />
    <BigStat
      startFrame={14}
      durationFrames={28}
      from={0}
      to={80}
      format={(v) => `${Math.round(v)}%`}
      fontSize={360}
      position={{ top: '52%', left: '50%' }}
    />
    <KineticCaption
      startFrame={48}
      words={['DONE', 'WAITING', 'ON', 'RATES']}
      cadenceFrames={6}
      position="lower-third"
      fontSize={50}
      fontFamily={FONT_BODY}
    />
    <SourcePill text={SRC} startFrame={60} />
  </AbsoluteFill>
);

// Beat 4 — Busier season: 43% say it's hotter than last year.
const BeatBusier: React.FC = () => (
  <AbsoluteFill>
    <AnimatedGradientBg variant="hot" />
    <ParticleField count={50} color="rgba(212, 175, 55, 0.55)" />
    <Headline
      text="Spring is heating up"
      startFrame={4}
      position="upper-third"
      fontSize={56}
    />
    <BigStat
      startFrame={14}
      durationFrames={28}
      from={0}
      to={43}
      format={(v) => `${Math.round(v)}%`}
      fontSize={340}
      position={{ top: '52%', left: '50%' }}
    />
    <KineticCaption
      startFrame={48}
      words={['BUSIER', 'THAN', 'LAST', 'SPRING']}
      cadenceFrames={6}
      position="lower-third"
      fontSize={50}
      fontFamily={FONT_BODY}
    />
    <SourcePill text={SRC} startFrame={60} />
  </AbsoluteFill>
);

// Beat 5 — The closer: kinetic punchline.
const BeatClose: React.FC = () => (
  <AbsoluteFill>
    <AnimatedGradientBg variant="hot" />
    <ParticleField count={36} color="rgba(212, 175, 55, 0.45)" />
    <KineticCaption
      startFrame={6}
      words={['IF', 'YOU', 'HAVE', 'BEEN', 'WAITING']}
      cadenceFrames={6}
      position="upper-third"
      fontSize={58}
      fontFamily={FONT_BODY}
    />
    <KineticCaption
      startFrame={42}
      words={['THE', 'MARKET', 'IS', 'NOT']}
      cadenceFrames={7}
      position="center"
      fontSize={72}
      fontFamily={FONT_HEAD}
      fontWeight={700}
      letterSpacing="-0.005em"
    />
    <KineticCaption
      startFrame={75}
      words={['WAITING', 'ON', 'YOU.']}
      cadenceFrames={9}
      position="lower-third"
      fontSize={92}
      fontFamily={FONT_HEAD}
      fontWeight={700}
      letterSpacing="-0.01em"
      highlightWord={0}
    />
    <NewsTicker text="LOCK-IN BREAKING · 35% OF SUB-5% SELLERS LISTING THIS SPRING · BUYERS NOT WAITING" />
  </AbsoluteFill>
);

export const ClipGoldenHandcuffs: React.FC = () => {
  // Beat layout (frames at 30fps, 28s total):
  //   0–150    (0–5s)     Hook (35% / 1 in 3)
  //   150–300  (5–10s)    Sub-5% — listing anyway
  //   300–450  (10–15s)   Buyers — 80% not waiting
  //   450–600  (15–20s)   Busier — 43% hotter
  //   600–750  (20–25s)   Closer kinetic line + ticker
  //   750–840  (25–28s)   Brand end card
  //
  // Sequences overlap by 6 frames so the next beat fades in over the previous,
  // preventing the parent-div-flash bug from §7.1 of VIDEO_PRODUCTION_SKILL.md.
  return (
    <AbsoluteFill style={{ background: '#050d18' }}>
      <Sequence from={0} durationInFrames={156}>
        <BeatHook />
      </Sequence>
      <Sequence from={150} durationInFrames={156}>
        <BeatSubFive />
      </Sequence>
      <Sequence from={300} durationInFrames={156}>
        <BeatBuyers />
      </Sequence>
      <Sequence from={450} durationInFrames={156}>
        <BeatBusier />
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
