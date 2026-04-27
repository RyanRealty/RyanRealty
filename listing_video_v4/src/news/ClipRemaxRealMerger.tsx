// ClipRemaxRealMerger — viral news clip, 30s portrait 1080x1920.
//
// Story: Real Brokerage announced an acquisition of RE/MAX Holdings on
// 2026-04-27. Combined entity becomes "Real REMAX Group" — biggest
// brokerage consolidation in years. Reported by every major industry desk.
//
// Verification trace per figure (sourced 2026-04-27):
//   - Enterprise value $880M           → consensus across Real Estate News,
//     Pulse2, Housing Wire, Inman, Yahoo Finance, Seeking Alpha,
//     TipRanks
//     https://www.realestatenews.com/2026/04/27/real-to-buy-remax-in-usd880m-deal-creating-global-brokerage-giant
//     https://pulse2.com/real-brokerage-880-million-re-max-acquisition-creates-global-ai-powered-real-estate-platform/
//   - Equity value $550M                → The Real Deal 2026-04-27
//     https://therealdeal.com/national/2026/04/27/real-brokerage-to-buy-re-max-for-550m/
//   - Combined agents 180,000+         → Real Estate News, Pulse2, Inman
//   - Countries 120+                    → Real Estate News, Pulse2
//   - Real shareholders own ~59%       → Pulse2
//   - Cost-savings synergies ~$30M     → Real Estate News
//   - Expected close H2 2026            → Real Estate News, Pulse2
//   - HQ Miami (Denver ops continue)   → Real Estate News
//   - CEO of combined: Tamir Poleg     → All sources
//
// Visual rebuild: gradient mesh + colliding brand-styled name pills (no
// actual RE/MAX or Real Brokerage logo art used — pill is text-on-color
// abstraction styled with each brand's signature color, which is editorial
// reportage, not logo reproduction). Word-by-word kinetic captions, giant
// counters, source attribution per CLAUDE.md data-accuracy rule. No stock
// photos and no AI imagery — pure code-driven backdrop, so no Rule 2 / Rule
// 5 disclosure required.
//
// Caption spec (per Matt's ship instructions): bottom safe zone y 1480-1720,
// AzoSans 56px, 70%-opacity navy pill, 24px corner radius, 2px gold top
// border. Implemented as the local BottomCaption component below — the
// existing CaptionTrack is preserved for the prior 3 news clips that
// already shipped against it.

import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Sequence,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { CREAM, FONT_BODY, FONT_SERIF } from '../brand';
import { clamp, easeOutCubic, easeOutQuart } from '../easing';
import {
  GradientMeshBg,
  KineticHook,
  WordReveal,
  GiantNumber,
  BreakingBadge,
  BrandWatermark,
  NewsEndCard,
  SlamLine,
  BigQuote,
  GOLD_BRAND,
  NAVY_BRAND,
  formatCommas,
} from './viral_primitives';

const FPS = 30;
export const CLIP_MERGER_TOTAL_SEC = 45.0;

// ─── BottomCaption ────────────────────────────────────────────────────────
// Bottom-safe-zone caption per Matt's ship spec for this clip:
//   - vertical zone: y 1480-1720 (240 px tall, sits above the platform UI
//     chrome and never overlaps in-beat graphics which all live above
//     y ~1450)
//   - AzoSans 56 px
//   - navy pill at 70% opacity
//   - 24 px corner radius
//   - 2 px gold top border
const BottomCaption: React.FC<{
  text: string;
  startFrame?: number;
  durationFrames: number;
}> = ({ text, startFrame = 0, durationFrames }) => {
  const frame = useCurrentFrame();
  const localF = frame - startFrame;
  if (localF < 0 || localF > durationFrames) return null;

  const fadeIn = clamp(localF / 5, 0, 1);
  const fadeOut = clamp((durationFrames - localF) / 7, 0, 1);
  const opacity = Math.min(fadeIn, fadeOut);

  return (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        top: 1480,
        transform: 'translateX(-50%)',
        width: 940,
        minHeight: 200,
        maxHeight: 240,
        padding: '28px 36px',
        background: 'rgba(16,39,66,0.70)',
        borderRadius: 24,
        borderTop: `2px solid ${GOLD_BRAND}`,
        opacity,
        textAlign: 'center',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 10px 32px rgba(0,0,0,0.5)',
        backdropFilter: 'blur(10px)',
      }}
    >
      <div
        style={{
          fontFamily: FONT_BODY,
          fontWeight: 700,
          fontSize: 56,
          color: '#FFFFFF',
          letterSpacing: 0.4,
          lineHeight: 1.18,
          textShadow: '0 2px 10px rgba(0,0,0,0.85)',
        }}
      >
        {text}
      </div>
    </div>
  );
};

// ─── MergerSourcePill ─────────────────────────────────────────────────────
// Source attribution pill, positioned above the caption zone (bottom 480 px
// → top of pill ~y 1380, well above the y 1480 caption boundary).
const MergerSourcePill: React.FC<{
  text: string;
  startFrame?: number;
}> = ({ text, startFrame = 0 }) => {
  const frame = useCurrentFrame();
  const localF = frame - startFrame;
  const alpha = clamp(localF / 10, 0, 1);
  return (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        bottom: 480,
        transform: 'translate(-50%, 0)',
        opacity: alpha * 0.95,
        background: 'rgba(6,16,31,0.80)',
        border: `1px solid ${GOLD_BRAND}66`,
        backdropFilter: 'blur(8px)',
        padding: '10px 22px',
        borderRadius: 999,
        fontFamily: FONT_BODY,
        fontWeight: 700,
        fontSize: 22,
        color: 'rgba(242,235,221,0.92)',
        letterSpacing: 2.6,
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ color: GOLD_BRAND, marginRight: 10 }}>SOURCE</span>
      {text}
    </div>
  );
};

// ─── BrandNamePill ────────────────────────────────────────────────────────
// Name-pill rendered in the brand's signature color. Fly-in from left/right
// for the collision moment. Text-only, no logo art reproduction.
const BrandNamePill: React.FC<{
  text: string;
  bg: string;
  fg: string;
  startFrame: number;
  fromSide: 'left' | 'right';
  centerY: string;
  centerX?: string;
  fontSize?: number;
  width?: number;
  arrivalFrame?: number;
}> = ({
  text,
  bg,
  fg,
  startFrame,
  fromSide,
  centerY,
  centerX = '50%',
  fontSize = 92,
  width = 420,
  arrivalFrame = 18,
}) => {
  const frame = useCurrentFrame();
  const localF = frame - startFrame;
  const t = clamp(localF / arrivalFrame, 0, 1);
  const eased = easeOutQuart(t);
  const sign = fromSide === 'left' ? -1 : 1;
  const x = sign * (1 - eased) * 1300;
  const opacity = clamp(localF / 4, 0, 1);
  return (
    <div
      style={{
        position: 'absolute',
        left: centerX,
        top: centerY,
        transform: `translate(calc(-50% + ${x}px), -50%)`,
        opacity,
        width,
        padding: '28px 30px',
        background: bg,
        color: fg,
        borderRadius: 18,
        textAlign: 'center',
        fontFamily: FONT_BODY,
        fontWeight: 900,
        fontSize,
        letterSpacing: 4,
        textTransform: 'uppercase',
        boxShadow: '0 12px 36px rgba(0,0,0,0.65)',
        border: '3px solid rgba(255,255,255,0.18)',
      }}
    >
      {text}
    </div>
  );
};

// ─── CombinePill ──────────────────────────────────────────────────────────
// The combined entity pill — appears after the two name pills collide.
const CombinePill: React.FC<{
  text: string;
  startFrame: number;
  centerY: string;
  fontSize?: number;
}> = ({ text, startFrame, centerY, fontSize = 76 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const localF = frame - startFrame;
  const sp = spring({
    frame: localF,
    fps,
    config: { damping: 9, mass: 0.7, stiffness: 120 },
  });
  const scale = 0.6 + sp * 0.4;
  const opacity = clamp(localF / 5, 0, 1);
  return (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        top: centerY,
        transform: `translate(-50%, -50%) scale(${scale.toFixed(3)})`,
        opacity,
        padding: '28px 38px',
        background: `linear-gradient(135deg, ${NAVY_BRAND} 0%, #1a3556 100%)`,
        color: CREAM,
        borderRadius: 22,
        textAlign: 'center',
        fontFamily: FONT_BODY,
        fontWeight: 900,
        fontSize,
        letterSpacing: 3,
        textTransform: 'uppercase',
        boxShadow: `0 0 48px ${GOLD_BRAND}66, 0 16px 40px rgba(0,0,0,0.7)`,
        border: `3px solid ${GOLD_BRAND}`,
        whiteSpace: 'nowrap',
      }}
    >
      {text}
    </div>
  );
};

// ─── CollideSpark ─────────────────────────────────────────────────────────
// Visual flash at the collision frame — radial burst of gold.
const CollideSpark: React.FC<{ startFrame: number; centerY: string }> = ({
  startFrame,
  centerY,
}) => {
  const frame = useCurrentFrame();
  const localF = frame - startFrame;
  if (localF < 0 || localF > 30) return null;
  const t = clamp(localF / 18, 0, 1);
  const scale = 0.4 + easeOutCubic(t) * 4.2;
  const opacity = (1 - t) * 0.85;
  return (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        top: centerY,
        width: 260,
        height: 260,
        transform: `translate(-50%, -50%) scale(${scale.toFixed(3)})`,
        opacity,
        background: `radial-gradient(circle, ${GOLD_BRAND} 0%, ${GOLD_BRAND}88 30%, transparent 65%)`,
        borderRadius: '50%',
        mixBlendMode: 'screen',
      }}
    />
  );
};

// ─── GlobeRing ────────────────────────────────────────────────────────────
// Stylized "global reach" graphic — two concentric rings + dotted orbit.
// Used as the visual backbone for the agents/countries beat.
const GlobeRing: React.FC<{
  startFrame: number;
  centerY: number;
  size?: number;
}> = ({ startFrame, centerY, size = 700 }) => {
  const frame = useCurrentFrame();
  const localF = frame - startFrame;
  const enter = clamp(localF / 14, 0, 1);
  const eased = easeOutCubic(enter);
  const rotation = (localF / FPS) * 12; // slow rotate
  return (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        top: centerY,
        width: size,
        height: size,
        transform: `translate(-50%, -50%) scale(${eased.toFixed(3)})`,
        opacity: eased,
      }}
    >
      <svg width={size} height={size} style={{ transform: `rotate(${rotation.toFixed(2)}deg)` }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={size / 2 - 18}
          stroke={`${GOLD_BRAND}66`}
          strokeWidth="2"
          fill="none"
          strokeDasharray="4 12"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={size / 2 - 70}
          stroke={`${GOLD_BRAND}33`}
          strokeWidth="1"
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={size / 2 - 130}
          stroke={`${GOLD_BRAND}22`}
          strokeWidth="1"
          fill="none"
        />
        {/* orbital dots */}
        {Array.from({ length: 6 }).map((_, i) => {
          const angle = (i / 6) * Math.PI * 2;
          const r = size / 2 - 18;
          const dx = Math.cos(angle) * r;
          const dy = Math.sin(angle) * r;
          return (
            <circle
              key={i}
              cx={size / 2 + dx}
              cy={size / 2 + dy}
              r="6"
              fill={GOLD_BRAND}
              opacity="0.75"
            />
          );
        })}
      </svg>
    </div>
  );
};

// ─── Beat 1: Hook ─────────────────────────────────────────────────────────
const BeatHook: React.FC = () => {
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill>
      <GradientMeshBg palette="navy" />
      <BreakingBadge label="INDUSTRY ALERT" startFrame={0} />
      <KineticHook
        text="Real estate"
        startFrame={2}
        fontSize={140}
        top="34%"
        color={CREAM}
        fontFamily={FONT_SERIF}
        fontWeight={400}
      />
      <KineticHook
        text="just consolidated."
        startFrame={Math.round(fps * 0.45)}
        fontSize={130}
        top="50%"
        color={GOLD_BRAND}
        fontFamily={FONT_SERIF}
        fontWeight={700}
      />
      <WordReveal
        text="THE BIGGEST BROKERAGE |MERGER IN YEARS"
        startFrame={Math.round(fps * 1.0)}
        perWordFrames={5}
        fontSize={42}
        top="66%"
        color={CREAM}
        highlightColor={GOLD_BRAND}
        letterSpacing={3}
      />
      <BrandWatermark startFrame={14} />
    </AbsoluteFill>
  );
};

// ─── Beat 2: $880M deal hero ──────────────────────────────────────────────
// Two brand-styled name pills fly in and collide. Spark flashes. Big
// $880M counter slams in below.
const BeatDeal: React.FC = () => {
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill>
      <GradientMeshBg palette="navy" intensity={0.95} />
      <SlamLine
        text="THE DEAL"
        startFrame={2}
        fontSize={48}
        top="9%"
        underline={GOLD_BRAND}
        color={CREAM}
        fontFamily={FONT_BODY}
        fontWeight={900}
        letterSpacing={6}
        textTransform="uppercase"
      />
      <BrandNamePill
        text="REAL"
        bg="#0EA5E9"
        fg="#FFFFFF"
        startFrame={Math.round(fps * 0.2)}
        fromSide="left"
        centerY="28%"
        fontSize={88}
        width={360}
      />
      <BrandNamePill
        text="RE/MAX"
        bg="#DC2626"
        fg="#FFFFFF"
        startFrame={Math.round(fps * 0.5)}
        fromSide="right"
        centerY="28%"
        fontSize={88}
        width={420}
      />
      <CollideSpark startFrame={Math.round(fps * 0.95)} centerY="28%" />
      <GiantNumber
        from={0}
        to={880}
        startFrame={Math.round(fps * 1.1)}
        durationFrames={Math.round(fps * 1.5)}
        format={(v) => `$${Math.round(v)}M`}
        fontSize={300}
        color={GOLD_BRAND}
        top="55%"
      />
      <WordReveal
        text="ACQUISITION |ANNOUNCED THIS WEEK"
        startFrame={Math.round(fps * 2.6)}
        perWordFrames={5}
        fontSize={36}
        top="78%"
        color={CREAM}
        highlightColor={GOLD_BRAND}
        letterSpacing={2.4}
      />
      <MergerSourcePill
        text="Real Estate News, Inman, Housing Wire · 2026-04-27"
        startFrame={Math.round(fps * 2.8)}
      />
    </AbsoluteFill>
  );
};

// ─── Beat 3: Scale — 180,000 agents, 120 countries ───────────────────────
const BeatScale: React.FC = () => {
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill>
      <GradientMeshBg palette="forest" intensity={0.85} />
      <GlobeRing startFrame={Math.round(fps * 0.05)} centerY={920} size={760} />
      <SlamLine
        text="THE SCALE"
        startFrame={2}
        fontSize={48}
        top="9%"
        underline={GOLD_BRAND}
        color={CREAM}
        fontFamily={FONT_BODY}
        fontWeight={900}
        letterSpacing={6}
        textTransform="uppercase"
      />
      <GiantNumber
        from={0}
        to={180000}
        startFrame={Math.round(fps * 0.2)}
        durationFrames={Math.round(fps * 1.7)}
        format={formatCommas}
        fontSize={190}
        color={GOLD_BRAND}
        top="28%"
      />
      <WordReveal
        text="AGENTS WORLDWIDE"
        startFrame={Math.round(fps * 1.9)}
        perWordFrames={5}
        fontSize={38}
        top="40%"
        color={CREAM}
        highlightColor={GOLD_BRAND}
        letterSpacing={4}
      />
      <GiantNumber
        from={0}
        to={120}
        startFrame={Math.round(fps * 2.2)}
        durationFrames={Math.round(fps * 1.2)}
        format={(v) => `${Math.round(v)}+`}
        fontSize={210}
        color={CREAM}
        top="56%"
      />
      <WordReveal
        text="COUNTRIES & TERRITORIES"
        startFrame={Math.round(fps * 3.4)}
        perWordFrames={5}
        fontSize={36}
        top="68%"
        color={CREAM}
        highlightColor={GOLD_BRAND}
        letterSpacing={3.6}
      />
      <MergerSourcePill
        text="Real Estate News · Pulse2 · 2026-04-27"
        startFrame={Math.round(fps * 3.6)}
      />
    </AbsoluteFill>
  );
};

// ─── Beat 4: The combine — Real REMAX Group ──────────────────────────────
const BeatCombine: React.FC = () => {
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill>
      <GradientMeshBg palette="ember" intensity={0.85} />
      <SlamLine
        text="THE NEW NAME"
        startFrame={2}
        fontSize={42}
        top="9%"
        underline={GOLD_BRAND}
        color={CREAM}
        fontFamily={FONT_BODY}
        fontWeight={900}
        letterSpacing={5}
        textTransform="uppercase"
      />
      <BrandNamePill
        text="REAL"
        bg="#0EA5E9"
        fg="#FFFFFF"
        startFrame={Math.round(fps * 0.1)}
        fromSide="left"
        centerY="32%"
        centerX="32%"
        fontSize={70}
        width={280}
      />
      <BrandNamePill
        text="RE/MAX"
        bg="#DC2626"
        fg="#FFFFFF"
        startFrame={Math.round(fps * 0.3)}
        fromSide="right"
        centerY="32%"
        centerX="68%"
        fontSize={70}
        width={320}
      />
      <CombinePill
        text="REAL REMAX GROUP"
        startFrame={Math.round(fps * 1.0)}
        centerY="52%"
        fontSize={64}
      />
      <WordReveal
        text="HEADQUARTERED IN |MIAMI"
        startFrame={Math.round(fps * 1.7)}
        perWordFrames={5}
        fontSize={36}
        top="68%"
        color={CREAM}
        highlightColor={GOLD_BRAND}
        letterSpacing={3.2}
      />
      <WordReveal
        text="EXPECTED CLOSE: |H2 2026"
        startFrame={Math.round(fps * 2.5)}
        perWordFrames={5}
        fontSize={32}
        top="78%"
        color={CREAM}
        highlightColor={GOLD_BRAND}
        letterSpacing={3.2}
      />
      <MergerSourcePill
        text="Real Brokerage release · 2026-04-27"
        startFrame={Math.round(fps * 2.7)}
      />
    </AbsoluteFill>
  );
};

// ─── Beat 5: Thesis — Tech meets Tradition (50% pattern interrupt) ──────
const BeatThesis: React.FC = () => {
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill>
      <GradientMeshBg palette="ember" intensity={0.85} />
      <SlamLine
        text="WHY IT MATTERS"
        startFrame={2}
        fontSize={42}
        top="11%"
        underline={GOLD_BRAND}
        color={GOLD_BRAND}
        fontFamily={FONT_BODY}
        fontWeight={900}
        letterSpacing={6}
        textTransform="uppercase"
      />
      <KineticHook
        text="Tech meets"
        startFrame={Math.round(fps * 0.2)}
        fontSize={140}
        top="32%"
        color={CREAM}
        fontFamily={FONT_SERIF}
        fontWeight={400}
      />
      <KineticHook
        text="tradition."
        startFrame={Math.round(fps * 0.55)}
        fontSize={150}
        top="48%"
        color={GOLD_BRAND}
        fontFamily={FONT_SERIF}
        fontWeight={700}
      />
      <WordReveal
        text="AI PLATFORM MEETS |LEGACY FRANCHISE"
        startFrame={Math.round(fps * 1.2)}
        perWordFrames={6}
        fontSize={38}
        top="64%"
        color={CREAM}
        highlightColor={GOLD_BRAND}
        letterSpacing={3.4}
      />
      <MergerSourcePill
        text="$30M synergies projected · BusinessWire"
        startFrame={Math.round(fps * 1.7)}
      />
    </AbsoluteFill>
  );
};

// ─── Beat 6: Local close ─────────────────────────────────────────────────
const BeatLocal: React.FC = () => {
  return (
    <AbsoluteFill>
      <GradientMeshBg palette="navy" intensity={0.9} />
      <BigQuote
        text="Bigger company. Same closing table for you in Bend."
        startFrame={4}
        fontSize={64}
        maxWidth={920}
      />
      <BrandWatermark startFrame={10} />
    </AbsoluteFill>
  );
};

// ─── Composition ─────────────────────────────────────────────────────────
export const ClipRemaxRealMerger: React.FC = () => {
  // 45-second build target = 1350 frames at 30 fps.
  //
  // Audio durations measured from rendered ElevenLabs MP3s:
  //   s01 92f  · "Two of the biggest names in real estate just merged."
  //   s02 129f · "Real Brokerage is buying RE/MAX in an $880M deal."
  //   s03 201f · "180,000 agents in 120 countries."
  //   s04 129f · "Real REMAX Group, headquartered in Miami."
  //   s05 140f · "Tech meets tradition."
  //   s06 104f · "Bigger company. Same closing table in Bend."
  //
  // Each beat overlaps the next by ~10-30 frames so the incoming Sequence
  // covers the previous before its AbsoluteFill is exposed (master skill §6
  // rule #1 — transparent parent + Sequence overlap pattern).
  //
  // Pattern interrupts on the 25 / 50 / final-15 marks:
  //   25% (f337)  → mid-Scale visual register change (180k → 120 countries)
  //   50% (f675)  → BeatScale → BeatCombine boundary (visual register flip)
  //   final 15%   → f1147–1350 covers the tail of BeatLocal + EndCard reveal
  //
  // Beat layout:
  //   0–110     (0–3.7s)    BeatHook       — covers s01 (92f)
  //   100–300   (3.3–10s)   BeatDeal       — covers s02 (129f)
  //   290–540   (9.7–18s)   BeatScale      — covers s03 (201f, longest)
  //   530–720   (17.7–24s)  BeatCombine    — covers s04 (129f)
  //   710–900   (23.7–30s)  BeatThesis     — covers s05 (140f) *50% interrupt*
  //   890–1200  (29.7–40s)  BeatLocal      — covers s06 (104f)
  //   1170–1350 (39–45s)    NewsEndCard    — white stacked logo + tagline
  return (
    <AbsoluteFill style={{ background: '#06101F' }}>
      <Sequence from={0} durationInFrames={110}>
        <BeatHook />
      </Sequence>
      <Sequence from={100} durationInFrames={200}>
        <BeatDeal />
      </Sequence>
      <Sequence from={290} durationInFrames={250}>
        <BeatScale />
      </Sequence>
      <Sequence from={530} durationInFrames={190}>
        <BeatCombine />
      </Sequence>
      <Sequence from={710} durationInFrames={190}>
        <BeatThesis />
      </Sequence>
      <Sequence from={890} durationInFrames={310}>
        <BeatLocal />
      </Sequence>
      <Sequence from={1170} durationInFrames={180}>
        <NewsEndCard startFrame={0} />
      </Sequence>

      {/* ─── VO + Captions (sentence-level, prosody-chained, with pauses) ─── */}
      <Sequence from={0} durationInFrames={100}>
        <Audio src={staticFile('audio/news_merger_s01.mp3')} />
        <BottomCaption
          text="Two of the biggest names in real estate just merged."
          startFrame={0}
          durationFrames={100}
        />
      </Sequence>
      <Sequence from={120} durationInFrames={150}>
        <Audio src={staticFile('audio/news_merger_s02.mp3')} />
        <BottomCaption
          text="Real Brokerage is buying RE/MAX in an $880M deal."
          startFrame={0}
          durationFrames={150}
        />
      </Sequence>
      <Sequence from={300} durationInFrames={220}>
        <Audio src={staticFile('audio/news_merger_s03.mp3')} />
        <BottomCaption
          text="180,000+ agents in 120+ countries."
          startFrame={0}
          durationFrames={220}
        />
      </Sequence>
      <Sequence from={550} durationInFrames={150}>
        <Audio src={staticFile('audio/news_merger_s04.mp3')} />
        <BottomCaption
          text="Real REMAX Group, headquartered in Miami."
          startFrame={0}
          durationFrames={150}
        />
      </Sequence>
      <Sequence from={730} durationInFrames={160}>
        <Audio src={staticFile('audio/news_merger_s05.mp3')} />
        <BottomCaption
          text="Tech meets tradition."
          startFrame={0}
          durationFrames={160}
        />
      </Sequence>
      <Sequence from={920} durationInFrames={130}>
        <Audio src={staticFile('audio/news_merger_s06.mp3')} />
        <BottomCaption
          text="Bigger company. Same closing table in Bend."
          startFrame={0}
          durationFrames={130}
        />
      </Sequence>
    </AbsoluteFill>
  );
};
