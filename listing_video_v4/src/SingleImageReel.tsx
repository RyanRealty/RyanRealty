// SingleImageReel.tsx — Animated text on single image, 9s portrait reel.
// 1080x1920, 30fps, 270 frames total.
//
// Spec: out/proof/2026-05-14/reels-spec.md (locked 2026-05-15)
// Rewrite 2026-05-15: verbatim text from approved statics, two layouts,
// stronger Ken Burns, blur intro, letterbox bands, spring stamp on big words,
// word-by-word stagger for pattern-b headline.
//
// Beat structure (270 frames):
//   00-12   Photo blurs in (10px -> 0px), Ken Burns engaged, letterbox slides in
//   10-30   Photo full opacity, top scrim ramps in
//   18-36   (s2) Eyebrow slides in via clip-path reveal
//   31-...  (s2) Big word(s) spring-stamp in. Sub fades up. Address fades up.
//   40-165  (pattern-b) Headline lines fade up word-by-word
//   180-200 Price line fades up (pattern-b)
//   240-270 Final hold; everything static
//   258-270 Letterbox bands slide out
//
// Layouts:
//   s2          — bottom-anchor stamp (Schoolhouse, Beaumont, Simpson)
//   pattern-b   — editorial top-left (Saghali)
//
// Typography:
//   Amboqia for display, Azo Sans for eyebrow/sub/address (tracked caps).
//   Cream #faf8f4 by default. Warm tints rgb(240,230,210)/rgb(220,210,180).
//
// Validation: text props are checked against lib/punctuation-guard.ts at
// the build-script layer (scripts/render-reels.mjs), not inside the comp.

import React from 'react';
import {
  AbsoluteFill,
  Img,
  staticFile,
  spring,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

const CREAM = '#faf8f4';
const WARM_SUB = 'rgb(240, 230, 210)';
const WARM_ADDR = 'rgb(220, 210, 180)';
const TEXT_SHADOW = '2px 2px 8px rgba(0,0,0,0.55)';
const TEXT_SHADOW_STRONG = '0 2px 12px rgba(0,0,0,0.75), 0 0 24px rgba(0,0,0,0.45)';

export const SINGLE_IMAGE_REEL_DURATION_FRAMES = 270; // 9.0s @ 30fps

export type ReelLayout = 's2' | 'pattern-b';

export type S2Props = {
  layout: 's2';
  photoPath: string;
  eyebrow?: string;            // optional; if absent no eyebrow row renders
  bigWords: string[];           // 1 or 2 lines, each gets spring-stamp
  sub: string;
  address: string;
  subColor?: string;            // default CREAM, Beaumont uses WARM_SUB
  addressColor?: string;        // default CREAM, Beaumont uses WARM_ADDR
  bigWordSize?: number;         // default 240
};

export type PatternBProps = {
  layout: 'pattern-b';
  photoPath: string;
  headline: string[];           // 3 lines
  price: string;
};

export type SingleImageReelProps = S2Props | PatternBProps;

// ─────────────────────────────────────────────────────────────────────────────
// Word-by-word fade-up for pattern-b headline.
//
// Each word: fade 0→1 over 8 frames + translateY 16→0. Stagger 4 frames per
// word. Returns total frames the line consumes so the next line can chain.
// ─────────────────────────────────────────────────────────────────────────────
const WordStaggerLine: React.FC<{
  text: string;
  startFrame: number;
  fontSize: number;
  lineHeight: number;
  color: string;
}> = ({ text, startFrame, fontSize, lineHeight, color }) => {
  const frame = useCurrentFrame();
  const words = text.split(/(\s+)/); // keep whitespace as tokens so layout stays intact

  let wordIndex = 0;
  return (
    <div
      style={{
        fontFamily: 'Amboqia',
        fontSize,
        color,
        lineHeight,
        letterSpacing: '-0.005em',
        textShadow: TEXT_SHADOW_STRONG,
        display: 'flex',
        flexWrap: 'wrap',
        rowGap: 0,
      }}
    >
      {words.map((tok, i) => {
        if (/^\s+$/.test(tok)) {
          return <span key={i} style={{ whiteSpace: 'pre' }}>{tok}</span>;
        }
        const wStart = startFrame + wordIndex * 4;
        wordIndex += 1;
        const p = interpolate(frame, [wStart, wStart + 8], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });
        const ty = (1 - p) * 16;
        return (
          <span
            key={i}
            style={{
              display: 'inline-block',
              opacity: p,
              transform: `translateY(${ty}px)`,
              willChange: 'transform, opacity',
            }}
          >
            {tok}
          </span>
        );
      })}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Spring-stamp word — initial scale 0.92, overshoots to 1.04, settles 1.00.
// Opacity 0 → 1 over 8 frames.
// ─────────────────────────────────────────────────────────────────────────────
const SpringStampWord: React.FC<{
  text: string;
  startFrame: number;
  fontSize: number;
  lineHeight?: number;
}> = ({ text, startFrame, fontSize, lineHeight = 0.95 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = Math.max(0, frame - startFrame);

  // Overshoot spring: damping 12, stiffness 90, mass 0.6.
  const springT = spring({
    frame: local,
    fps,
    config: { damping: 12, stiffness: 90, mass: 0.6 },
  });

  // Scale path: 0.92 (springT=0) → 1.04 (peak around springT~0.7) → 1.00 settle.
  // Approximate with two-phase interpolate keyed off springT itself.
  const scale = interpolate(springT, [0, 0.7, 1.0], [0.92, 1.04, 1.0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const opacity = interpolate(local, [0, 8], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        fontFamily: 'Amboqia',
        fontSize,
        color: CREAM,
        lineHeight,
        letterSpacing: '-0.01em',
        textShadow: TEXT_SHADOW_STRONG,
        opacity,
        transform: `scale(${scale})`,
        transformOrigin: 'left bottom',
        willChange: 'transform, opacity',
        whiteSpace: 'nowrap',
      }}
    >
      {text}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Simple fade-up-from-Y for sub/address/price lines.
// ─────────────────────────────────────────────────────────────────────────────
const FadeUp: React.FC<{
  startFrame: number;
  durationFrames?: number; // total fade ramp, default 18
  fromY?: number;
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ startFrame, durationFrames = 18, fromY = 12, children, style }) => {
  const frame = useCurrentFrame();
  const p = interpolate(
    frame,
    [startFrame, startFrame + durationFrames],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );
  const ty = (1 - p) * fromY;
  return (
    <div
      style={{
        ...style,
        opacity: p,
        transform: `translateY(${ty}px)`,
        willChange: 'transform, opacity',
      }}
    >
      {children}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Eyebrow row — slides in via clipPath reveal from left.
// ─────────────────────────────────────────────────────────────────────────────
const Eyebrow: React.FC<{
  text: string;
  startFrame: number;
  endFrame: number;
}> = ({ text, startFrame, endFrame }) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [startFrame, endFrame], [100, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <div
      style={{
        fontFamily: 'AzoSans',
        fontWeight: 500,
        fontSize: 20,
        color: CREAM,
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
        textShadow: TEXT_SHADOW,
        clipPath: `inset(0 ${p}% 0 0)`,
        WebkitClipPath: `inset(0 ${p}% 0 0)`,
        willChange: 'clip-path',
      }}
    >
      {text}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Letterbox bands — 36px solid black, top + bottom. Slide in 0..12, out 258..270.
// ─────────────────────────────────────────────────────────────────────────────
const LetterboxBands: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const BAND = 36;

  // In-progress 0..12 via spring for smooth ease.
  const inP = spring({
    frame,
    fps,
    config: { damping: 18, stiffness: 140, mass: 0.5 },
    durationInFrames: 12,
  });
  // Out-progress from frame 258 onwards.
  const outP = interpolate(
    frame,
    [durationInFrames - 12, durationInFrames],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  // Effective offset: in slides from -BAND to 0; out slides 0 to -BAND.
  const offset = -BAND * (1 - inP) + -BAND * outP;

  return (
    <>
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: offset,
          height: BAND,
          background: '#000',
          willChange: 'transform',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: offset,
          height: BAND,
          background: '#000',
          willChange: 'transform',
        }}
      />
    </>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────
export const SingleImageReel: React.FC<SingleImageReelProps> = (props) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // ── Photo Ken Burns: scale 1.04 → 1.22, drift (0,0) → (-45px, +18px).
  const motionT = spring({
    frame,
    fps,
    config: { damping: 200, stiffness: 18, mass: 1 },
    durationInFrames,
  });
  const photoScale = interpolate(motionT, [0, 1], [1.04, 1.22]);
  const photoTx = interpolate(motionT, [0, 1], [0, -45]);
  const photoTy = interpolate(motionT, [0, 1], [0, 18]);

  // ── Photo blur intro 0..20 frames: 10px → 0px.
  const photoBlur = interpolate(frame, [0, 20], [10, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // ── Photo opacity fade-in 0..30 frames, 0.55 → 1.0.
  const photoOpacity = interpolate(
    frame,
    [0, 9, 30],
    [0.55, 0.85, 1.0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  // ── Top scrim opacity 10..30.
  const scrimOpacity = interpolate(frame, [10, 30], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ background: '#000' }}>
      {/* Photo with Ken Burns + blur intro */}
      <AbsoluteFill
        style={{
          opacity: photoOpacity,
          transform: `scale(${photoScale}) translate(${photoTx}px, ${photoTy}px)`,
          transformOrigin: 'center center',
          filter: `blur(${photoBlur}px)`,
          willChange: 'transform, opacity, filter',
        }}
      >
        <Img
          src={staticFile(props.photoPath)}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
          }}
        />
      </AbsoluteFill>

      {/* Top scrim — gradient over top 42%, max 0.55 navy alpha */}
      <AbsoluteFill
        style={{
          background:
            'linear-gradient(to bottom, rgba(8,18,32,0.55) 0%, rgba(8,18,32,0.30) 60%, rgba(8,18,32,0) 100%)',
          height: '42%',
          opacity: scrimOpacity,
          willChange: 'opacity',
        }}
      />

      {/* Bottom scrim for s2 layout — gradient over bottom 55%, max 0.65 navy */}
      {props.layout === 's2' && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: '55%',
            background:
              'linear-gradient(to top, rgba(8,18,32,0.65) 0%, rgba(8,18,32,0.40) 45%, rgba(8,18,32,0) 100%)',
            opacity: scrimOpacity,
            willChange: 'opacity',
          }}
        />
      )}

      {/* ──────────────────────────────── Layout: s2 (bottom-anchor) */}
      {props.layout === 's2' && (
        <S2Block {...props} />
      )}

      {/* ──────────────────────────────── Layout: pattern-b (top-left) */}
      {props.layout === 'pattern-b' && (
        <PatternBBlock {...props} />
      )}

      {/* Letterbox bands — top + bottom 36px, slide in 0..12, slide out 258..270 */}
      <LetterboxBands />
    </AbsoluteFill>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// S2 layout block
// ─────────────────────────────────────────────────────────────────────────────
const S2Block: React.FC<S2Props> = ({
  eyebrow,
  bigWords,
  sub,
  address,
  subColor = CREAM,
  addressColor = CREAM,
  bigWordSize = 240,
}) => {
  const showTwoWords = bigWords.length >= 2;

  return (
    <>
      {/* Eyebrow — top-left, frames 18..36 clip-reveal */}
      {eyebrow && (
        <div
          style={{
            position: 'absolute',
            left: 60,
            top: 110,
            right: 60,
          }}
        >
          <Eyebrow text={eyebrow} startFrame={18} endFrame={36} />
        </div>
      )}

      {/* Big word block — anchored bottom-left. Address sits at bottom: 110,
          sub at bottom: 174 (above address), big words above sub. */}
      <div
        style={{
          position: 'absolute',
          left: 60,
          right: 60,
          bottom: 110,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
        }}
      >
        {/* Big word(s) — bottom of stack moves down to fit. Use a relative
            container with reverse stacking so the bottom edge is constant. */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', marginBottom: 28 }}>
          {showTwoWords && (
            <SpringStampWord
              text={bigWords[0]}
              startFrame={60}
              fontSize={bigWordSize}
              lineHeight={0.95}
            />
          )}
          <SpringStampWord
            text={bigWords[showTwoWords ? 1 : 0]}
            startFrame={showTwoWords ? 90 : 60}
            fontSize={bigWordSize}
            lineHeight={0.95}
          />
        </div>

        {/* Sub line */}
        <FadeUp
          startFrame={120}
          fromY={18}
          style={{
            fontFamily: 'AzoSans',
            fontWeight: 500,
            fontSize: 30,
            color: subColor,
            letterSpacing: '0.04em',
            textShadow: TEXT_SHADOW,
            marginBottom: 18,
          }}
        >
          {sub}
        </FadeUp>

        {/* Address */}
        <FadeUp
          startFrame={180}
          fromY={12}
          style={{
            fontFamily: 'AzoSans',
            fontWeight: 500,
            fontSize: 22,
            color: addressColor,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            textShadow: TEXT_SHADOW,
          }}
        >
          {address}
        </FadeUp>
      </div>
    </>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// pattern-b layout block — editorial top-left, word-by-word stagger.
// ─────────────────────────────────────────────────────────────────────────────
const PatternBBlock: React.FC<PatternBProps> = ({ headline, price }) => {
  // Word counts per line determine when next line starts.
  const wordsPerLine = headline.map((l) => l.split(/\s+/).filter(Boolean).length);
  // Each word consumes 4 frames stagger, fade ends at +8 frames after start.
  // So a line of N words completes at (startFrame + (N-1)*4 + 8).
  const line1Start = 40;
  const line1End = line1Start + (wordsPerLine[0] - 1) * 4 + 8;
  const line2Start = line1End + 4;
  const line2End = line2Start + (wordsPerLine[1] - 1) * 4 + 8;
  const line3Start = line2End + 4;
  const line3End = line3Start + (wordsPerLine[2] - 1) * 4 + 8;

  // Price starts at frame 180 OR right after line 3 ends + 8, whichever is later.
  const priceStart = Math.max(180, line3End + 8);

  return (
    <div
      style={{
        position: 'absolute',
        top: 130,
        left: 60,
        right: 60,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 0,
      }}
    >
      <WordStaggerLine
        text={headline[0]}
        startFrame={line1Start}
        fontSize={72}
        lineHeight={1.10}
        color={CREAM}
      />
      <WordStaggerLine
        text={headline[1]}
        startFrame={line2Start}
        fontSize={72}
        lineHeight={1.10}
        color={CREAM}
      />
      <WordStaggerLine
        text={headline[2]}
        startFrame={line3Start}
        fontSize={72}
        lineHeight={1.10}
        color={CREAM}
      />

      <FadeUp
        startFrame={priceStart}
        fromY={12}
        style={{
          fontFamily: 'Amboqia',
          fontSize: 36,
          color: CREAM,
          letterSpacing: '-0.005em',
          textShadow: TEXT_SHADOW_STRONG,
          marginTop: 36,
        }}
      >
        {price}
      </FadeUp>
    </div>
  );
};
