// ClipGoldenHandcuffs — viral rebuild, 30s news clip, 1080×1920 portrait.
//
// Source: Coldwell Banker 2026 Home Shopping Season Report (PRNewswire
// 2026-04-23, n=727 Coldwell Banker affiliated agents, fielded Mar 23–Apr 6,
// 2026).
// https://www.prnewswire.com/news-releases/coldwell-banker-mortgage-rate-lock-in-effect-eases-one-in-three-home-sellers-are-giving-up-a-sub-5-rate-to-list-this-spring-302751081.html
//
// Verification trace per figure:
//   - "1 in 3 / 35%" of sellers giving up sub-5% rate to list this spring → Coldwell Banker, body of release
//   - "80% of agents say buyers aren't waiting on rates" → same release
//   - "43% of agents report a busier shopping season than last year" → same release
//
// Visual rebuild (Apr 26): swapped plain-black backdrops for animated mesh
// gradient + house-row silhouette, kinetic word-by-word captions, hero
// percent ring around the giant counter, breaking-news pill at top, and
// brand-styled source pill. No stock photos used (no API keys configured)
// and no AI imagery — pure code-driven backdrops, so no Rule 2 / Rule 5
// disclosure required.

import React from 'react';
import { AbsoluteFill, Audio, Sequence, staticFile, useVideoConfig } from 'remotion';
import { CREAM, FONT_BODY, FONT_SERIF, TEXT_SHADOW } from '../brand';
import {
  GradientMeshBg,
  HouseRowSilhouette,
  KineticHook,
  WordReveal,
  GiantNumber,
  PercentRing,
  TickerTape,
  CaptionTrack,
  BreakingBadge,
  SourcePill,
  BrandWatermark,
  NewsEndCard,
  SlamLine,
  BigQuote,
  GOLD_BRAND,
  formatPct,
} from './viral_primitives';

const FPS = 30;
export const CLIP_GH_TOTAL_SEC = 45.0;

// Persistent ticker — every value traces to the Coldwell Banker spring 2026
// release cited in this file's header. "Lock-in effect: easing" is editorial
// framing, not a falsifiable stat.
const STAT_TICKER = [
  { label: 'Sub-5% sellers listing', value: '35%', tone: 'down' as const },
  { label: 'Buyers not waiting', value: '80%', tone: 'up' as const },
  { label: 'Agents reporting busier spring', value: '43%', tone: 'up' as const },
  { label: 'Lock-in effect', value: 'Easing', tone: 'down' as const },
];

// ─── Beat 1: Hook ─────────────────────────────────────────────────────────
const BeatHook: React.FC = () => {
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill>
      <GradientMeshBg palette="navy" />
      <HouseRowSilhouette bottom={0} height={320} fill="rgba(0,0,0,0.62)" />
      <BreakingBadge label="MARKET ALERT" startFrame={0} />
      <KineticHook
        text="Lock-in"
        startFrame={2}
        fontSize={180}
        top="34%"
        color={CREAM}
      />
      <KineticHook
        text="just broke."
        startFrame={Math.round(fps * 0.45)}
        fontSize={150}
        top="52%"
        color={GOLD_BRAND}
        fontFamily={FONT_SERIF}
        fontWeight={700}
      />
      <WordReveal
        text="1 IN 3 SELLERS WALKED |AWAY"
        startFrame={Math.round(fps * 1.0)}
        perWordFrames={5}
        fontSize={44}
        top="68%"
        color={CREAM}
        highlightColor={GOLD_BRAND}
        letterSpacing={3}
      />
      <BrandWatermark startFrame={14} />
    </AbsoluteFill>
  );
};

// ─── Beat 2: 35% hero stat with percent ring ─────────────────────────────
const BeatThirtyFive: React.FC = () => {
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill>
      <GradientMeshBg palette="navy" />
      <WordReveal
        text="SELLERS WITH RATES |BELOW 5%"
        startFrame={2}
        perWordFrames={5}
        fontSize={38}
        top="20%"
        color={CREAM}
        highlightColor={GOLD_BRAND}
        letterSpacing={4}
      />
      <PercentRing
        pct={35}
        startFrame={Math.round(fps * 0.3)}
        durationFrames={Math.round(fps * 1.6)}
        size={680}
        stroke={26}
        color={GOLD_BRAND}
        centerY="50%"
      />
      <GiantNumber
        from={0}
        to={35}
        startFrame={Math.round(fps * 0.3)}
        durationFrames={Math.round(fps * 1.6)}
        format={formatPct}
        fontSize={300}
        color={GOLD_BRAND}
        top="50%"
      />
      <SlamLine
        text="ARE LISTING ANYWAY"
        startFrame={Math.round(fps * 2.0)}
        fontSize={50}
        top="78%"
        underline={GOLD_BRAND}
        color={CREAM}
        fontFamily={FONT_BODY}
        fontWeight={900}
        letterSpacing={6}
        textTransform="uppercase"
      />
      <SourcePill
        text="Coldwell Banker · Spring 2026 · n=727 agents"
        startFrame={Math.round(fps * 2.2)}
      />
      <TickerTape items={STAT_TICKER} y={1700} />
    </AbsoluteFill>
  );
};

// ─── Beat 3: 80% buyers stat with line chart melt ─────────────────────────
const BeatBuyers: React.FC = () => {
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill>
      <GradientMeshBg palette="ember" intensity={0.85} />
      <SlamLine
        text="BUYERS STOPPED WAITING."
        startFrame={2}
        fontSize={50}
        top="14%"
        underline={GOLD_BRAND}
        color={CREAM}
        fontFamily={FONT_BODY}
        fontWeight={900}
        letterSpacing={4}
        textTransform="uppercase"
      />
      <GiantNumber
        from={0}
        to={80}
        startFrame={Math.round(fps * 0.2)}
        durationFrames={Math.round(fps * 1.5)}
        format={formatPct}
        fontSize={380}
        color={GOLD_BRAND}
        top="46%"
      />
      <WordReveal
        text="OF AGENTS SAY BUYERS |ARE IN THE MARKET NOW"
        startFrame={Math.round(fps * 1.6)}
        perWordFrames={5}
        fontSize={36}
        top="74%"
        color={CREAM}
        highlightColor={GOLD_BRAND}
        letterSpacing={2.4}
      />
      <SourcePill
        text="Coldwell Banker spring survey 2026"
        startFrame={Math.round(fps * 1.8)}
      />
      <TickerTape items={STAT_TICKER} y={1700} />
    </AbsoluteFill>
  );
};

// ─── Beat 4: 43% busier (warm sunset palette) ────────────────────────────
const BeatBusier: React.FC = () => {
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill>
      <GradientMeshBg palette="sunset" />
      <HouseRowSilhouette bottom={0} height={300} fill="rgba(0,0,0,0.55)" />
      <SlamLine
        text="BUSIER THAN LAST YEAR"
        startFrame={2}
        fontSize={50}
        top="14%"
        underline={GOLD_BRAND}
        color={CREAM}
        fontFamily={FONT_BODY}
        fontWeight={900}
        letterSpacing={4}
        textTransform="uppercase"
      />
      <GiantNumber
        from={0}
        to={43}
        startFrame={Math.round(fps * 0.2)}
        durationFrames={Math.round(fps * 1.5)}
        format={formatPct}
        fontSize={360}
        color={CREAM}
        top="42%"
      />
      <WordReveal
        text="OF AGENTS REPORT A |BUSIER SPRING THAN 2025"
        startFrame={Math.round(fps * 1.6)}
        perWordFrames={5}
        fontSize={34}
        top="66%"
        color={CREAM}
        highlightColor={GOLD_BRAND}
        letterSpacing={2.4}
      />
      <SourcePill
        text="Coldwell Banker spring survey 2026"
        startFrame={Math.round(fps * 1.8)}
      />
      <TickerTape items={STAT_TICKER} y={1700} />
    </AbsoluteFill>
  );
};

// ─── Beat 5: Editorial close ─────────────────────────────────────────────
const BeatClose: React.FC = () => {
  return (
    <AbsoluteFill>
      <GradientMeshBg palette="navy" intensity={0.85} />
      <BigQuote
        text="If you have been waiting on rates to sell, the market is no longer waiting on you."
        startFrame={4}
        fontSize={62}
        maxWidth={920}
      />
      <BrandWatermark startFrame={10} />
    </AbsoluteFill>
  );
};

export const ClipGoldenHandcuffs: React.FC = () => {
  // Beat layout (frames at 30fps):
  // 45s timeline @ 30fps = 1350 frames. Pacing Rule: hook beat ≥3s, every
  // readable-text beat ≥2.5s. Breath padding between VO sentences so it
  // sounds like a person, not a TTS rush.
  //
  //   0–105     (0–3.5s)    Hook            VO s01 @ 9 (1.62s, ends 58)
  //   90–360    (3.0–12.0s) 35% hero ring   VO s02 @ 99 (4.96s, ends 247)
  //   345–660   (11.5–22.0s) 80% buyers     VO s03 @ 369 (3.37s, ends 470)
  //   645–960   (21.5–32.0s) 43% busier     VO s04 @ 669 (3.84s, ends 784)
  //   945–1215  (31.5–40.5s) Close          VO s05 @ 969 (4.55s, ends 1106)
  //   1200–1350 (40–45s)    End card with white stacked logo
  return (
    <AbsoluteFill style={{ background: '#06101F' }}>
      <Sequence from={0} durationInFrames={105}>
        <BeatHook />
      </Sequence>
      <Sequence from={90} durationInFrames={270}>
        <BeatThirtyFive />
      </Sequence>
      <Sequence from={345} durationInFrames={315}>
        <BeatBuyers />
      </Sequence>
      <Sequence from={645} durationInFrames={315}>
        <BeatBusier />
      </Sequence>
      <Sequence from={945} durationInFrames={270}>
        <BeatClose />
      </Sequence>
      <Sequence from={1200} durationInFrames={150}>
        <NewsEndCard startFrame={0} />
      </Sequence>

      {/* ─── VO + Captions (Ellen voice, prosody-chained, breath padding) ─── */}
      <Sequence from={9} durationInFrames={75}>
        <Audio src={staticFile('audio/news_gh_s01.mp3')} />
        <CaptionTrack text="The lock-in effect just broke." startFrame={0} durationFrames={75} />
      </Sequence>
      <Sequence from={99} durationInFrames={155}>
        <Audio src={staticFile('audio/news_gh_s02.mp3')} />
        <CaptionTrack text="1 in 3 sellers with sub-5% rates are listing anyway." startFrame={0} durationFrames={155} fontSize={34} />
      </Sequence>
      <Sequence from={369} durationInFrames={110}>
        <Audio src={staticFile('audio/news_gh_s03.mp3')} />
        <CaptionTrack text="80% of agents say buyers aren't waiting on rates." startFrame={0} durationFrames={110} fontSize={34} />
      </Sequence>
      <Sequence from={669} durationInFrames={120}>
        <Audio src={staticFile('audio/news_gh_s04.mp3')} />
        <CaptionTrack text="43% report a busier spring than 2025." startFrame={0} durationFrames={120} />
      </Sequence>
      <Sequence from={969} durationInFrames={145}>
        <Audio src={staticFile('audio/news_gh_s05.mp3')} />
        <CaptionTrack text="The market isn't waiting on you anymore." startFrame={0} durationFrames={145} />
      </Sequence>
    </AbsoluteFill>
  );
};
