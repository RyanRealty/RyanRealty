// TitleCard — kinetic intro slate for each Bend Policy Pulse part.
//
// 4-second branded opener: series name, gold accent rule, big title,
// subtitle, and "PART X OF 3" pill. Background is a blurred Council
// chambers clip (so the visual continues into the first bridge cleanly).
//
// Layout:
//   y=0-450    Background blur + dark gradient
//   y=120-280  "BEND POLICY PULSE" series mark + gold rule
//   y=600-1200 BIG title (kinetic word reveal, Anton)
//   y=1280-1380 Subtitle (Anton, gold)
//   y=1500-1800 "PART X OF 3" pill (gold pill, navy text)

import React from 'react';
import {
  AbsoluteFill,
  Img,
  Video,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { BrollCredit } from './BrollCredit';

export const TITLE_CARD_SEC = 4.0;

const GOLD = '#F2C44A';
const GOLD_DEEP = '#D4AF37';
const NAVY = '#06101F';
const CREAM = '#F2EBDD';
const WHITE = '#FFFFFF';

const FONT = "Anton, 'Bebas Neue', 'Montserrat', sans-serif";
const FONT_SUB = "'Bebas Neue', Anton, 'Montserrat', sans-serif";

type Props = {
  /** Series mark across the top, e.g. "BEND POLICY PULSE" */
  series?: string;
  /** Big title — the part's headline, e.g. "WHAT BEND IS PROPOSING" */
  title: string;
  /** Subtitle line under the title, e.g. "CLIMATE POLLUTION FEE · NEW HOMES" */
  subtitle?: string;
  /** Part number (1-based). Optional — omit (and set hidePartPill=true) for standalone clips. */
  part?: number;
  /** Total parts in the series. Optional — omit for standalone clips. */
  totalParts?: number;
  /** Suppress the "PART X OF Y" pill — use for standalone news clips. */
  hidePartPill?: boolean;
  /** Background b-roll video slug (from broll/) — heavily blurred + darkened. Optional. */
  backgroundClip?: string;
  /** Background still image path (from staticFile root) — used when backgroundClip is omitted. */
  backgroundImage?: string;
  /** Override the card duration (default TITLE_CARD_SEC = 4.0s). */
  durationSec?: number;
  /** Optional source credit (B-roll / still), top-right. */
  creditLine?: string;
};

export const TitleCard: React.FC<Props> = ({
  series = 'BEND POLICY PULSE',
  title,
  subtitle,
  part,
  totalParts,
  hidePartPill = false,
  backgroundClip,
  backgroundImage,
  durationSec,
  creditLine,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const totalSec = durationSec ?? TITLE_CARD_SEC;

  // Phase timing (relative to TitleCard start):
  //   0.0-0.4  : background fade in
  //   0.3-1.0  : series mark spring in
  //   0.6-1.2  : gold accent rule draws
  //   1.0-2.4  : title kinetic reveal (word-by-word)
  //   1.8-3.0  : subtitle fades in
  //   2.0-3.5  : part pill springs in (suppressed when hidePartPill)
  //   last 0.5 : exit fade

  const exitAlpha = interpolate(t, [totalSec - 0.5, totalSec], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Background blur + dark wash
  const bgFade = interpolate(t, [0, 0.4], [0, 1], { extrapolateRight: 'clamp' });

  // Series mark
  const seriesSpring = spring({
    frame: Math.max(0, frame - Math.round(0.3 * fps)),
    fps,
    config: { damping: 14, mass: 0.5, stiffness: 200 },
  });
  const seriesScale = 0.92 + seriesSpring * 0.08;
  const seriesAlpha = interpolate(t, [0.3, 0.9], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // Gold rule width
  const ruleWidth = interpolate(t, [0.6, 1.2], [0, 460], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Title — kinetic word reveal
  const titleWords = title.split(/\s+/).filter(Boolean);
  const titlePerWord = 0.12; // 120ms between words
  const titleStart = 1.0;

  // Subtitle fade
  const subAlpha = interpolate(t, [1.8, 3.0], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Part pill spring
  const pillSpring = spring({
    frame: Math.max(0, frame - Math.round(2.0 * fps)),
    fps,
    config: { damping: 12, mass: 0.5, stiffness: 220 },
  });
  const pillScale = 0.7 + pillSpring * 0.32;
  const pillAlpha = interpolate(t, [2.0, 3.0], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ background: NAVY, opacity: exitAlpha }}>
      {creditLine ? <BrollCredit text={creditLine} /> : null}
      {/* Background — video clip (Bend Pulse default) or still image (standalone clips). */}
      {backgroundClip ? (
        <Video
          src={staticFile(`source_clips/bend_pulse/broll/${backgroundClip}.mp4`)}
          startFrom={0}
          muted
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            opacity: bgFade * 0.55,
            filter: 'blur(20px) brightness(0.6) saturate(0.85)',
            transform: 'scale(1.10)',
          }}
        />
      ) : backgroundImage ? (
        <Img
          src={staticFile(backgroundImage)}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            opacity: bgFade * 0.7,
            filter: 'blur(8px) brightness(0.55) saturate(0.9)',
            transform: `scale(${(1.06 + t * 0.01).toFixed(4)})`,
          }}
        />
      ) : null}
      {/* Navy + gold radial wash on top */}
      <AbsoluteFill
        style={{
          background:
            'radial-gradient(ellipse 75% 60% at 50% 38%, rgba(212,175,55,0.18) 0%, transparent 65%), linear-gradient(180deg, rgba(6,16,31,0.55) 0%, rgba(6,16,31,0.30) 50%, rgba(6,16,31,0.85) 100%)',
        }}
      />

      {/* Series mark — top */}
      <div
        style={{
          position: 'absolute',
          top: 130,
          left: 0,
          right: 0,
          textAlign: 'center',
          opacity: seriesAlpha,
          transform: `scale(${seriesScale.toFixed(3)})`,
          transformOrigin: 'center',
        }}
      >
        <div
          style={{
            fontFamily: FONT,
            fontSize: 64,
            fontWeight: 400,
            letterSpacing: 8,
            color: CREAM,
            textShadow: '0 6px 20px rgba(0,0,0,0.85)',
          }}
        >
          {series}
        </div>
        {/* Gold accent rule */}
        <div
          style={{
            margin: '24px auto 0',
            height: 4,
            width: ruleWidth,
            background: `linear-gradient(90deg, transparent, ${GOLD} 20%, ${GOLD_DEEP} 80%, transparent)`,
            boxShadow: `0 0 14px ${GOLD}88`,
          }}
        />
      </div>

      {/* Big title — kinetic word reveal */}
      <div
        style={{
          position: 'absolute',
          left: 70,
          right: 70,
          top: 580,
          textAlign: 'center',
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          alignItems: 'baseline',
          gap: '12px 22px',
          lineHeight: 1.0,
        }}
      >
        {titleWords.map((w, i) => {
          const wordStart = titleStart + i * titlePerWord;
          const localF = Math.max(0, frame - Math.round(wordStart * fps));
          const wSpring = spring({
            frame: localF,
            fps,
            config: { damping: 14, mass: 0.4, stiffness: 200 },
          });
          const wScale = 0.6 + wSpring * 0.42;
          const wAlpha = interpolate(t, [wordStart, wordStart + 0.25], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });
          return (
            <span
              key={i}
              style={{
                display: 'inline-block',
                fontFamily: FONT,
                fontSize: 138,
                fontWeight: 400,
                color: WHITE,
                letterSpacing: 2,
                opacity: wAlpha,
                transform: `scale(${wScale.toFixed(3)})`,
                transformOrigin: 'center bottom',
                textShadow: [
                  '4px 0 0 #000',
                  '-4px 0 0 #000',
                  '0 4px 0 #000',
                  '0 -4px 0 #000',
                  '3px 3px 0 #000',
                  '-3px 3px 0 #000',
                  '3px -3px 0 #000',
                  '-3px -3px 0 #000',
                  '0 12px 32px rgba(0,0,0,0.85)',
                ].join(', '),
              }}
            >
              {w.toUpperCase()}
            </span>
          );
        })}
      </div>

      {/* Subtitle */}
      {subtitle ? (
        <div
          style={{
            position: 'absolute',
            top: 1280,
            left: 0,
            right: 0,
            textAlign: 'center',
            opacity: subAlpha,
            fontFamily: FONT_SUB,
            fontSize: 56,
            fontWeight: 400,
            letterSpacing: 6,
            color: GOLD,
            textShadow: '0 4px 16px rgba(0,0,0,0.85)',
            padding: '0 60px',
          }}
        >
          {subtitle}
        </div>
      ) : null}

      {/* "PART X OF Y" pill — bottom (suppressed for standalone clips) */}
      {!hidePartPill && part != null && totalParts != null ? (
        <div
          style={{
            position: 'absolute',
            bottom: 220,
            left: 0,
            right: 0,
            display: 'flex',
            justifyContent: 'center',
            opacity: pillAlpha,
            transform: `scale(${pillScale.toFixed(3)})`,
            transformOrigin: 'center',
          }}
        >
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 18,
              padding: '20px 42px',
              background: GOLD,
              color: NAVY,
              fontFamily: FONT,
              fontSize: 72,
              fontWeight: 400,
              letterSpacing: 6,
              borderRadius: 999,
              boxShadow: `0 12px 38px rgba(0,0,0,0.55), 0 0 24px ${GOLD}88`,
            }}
          >
            PART {part}
            <span
              style={{
                fontSize: 48,
                opacity: 0.65,
                letterSpacing: 4,
              }}
            >
              OF {totalParts}
            </span>
          </div>
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
