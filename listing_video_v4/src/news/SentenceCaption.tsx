// SentenceCaption — canonical news-clip caption, full-sentence with
// active-word highlight (TikTok / news-broadcast style).
//
// Matt directive 2026-05-07 (CLAUDE.md §0.5): full sentence on screen at
// once with the active word highlighted in gold + scale 1.0→1.08 spring.
// NEVER word-by-word fade-in/out. Smooth 200-300ms crossfade between
// sentences (NEVER hard cut). Sentence boundaries detected from periods.
//
// Reference impl this is patterned after: video/market-report/src/CaptionBand.tsx
// Adapted: Anton font (TikTok-grade bold sans), bottom-third placement,
// stronger black outline + drop shadow for legibility on any background.

import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

export type CaptionWord = { text: string; startSec: number; endSec: number };

const CROSSFADE_SEC = 0.20;
const GOLD = '#F2C44A';
const WHITE = '#FFFFFF';
const FONT = "Anton, 'Bebas Neue', 'Montserrat', sans-serif";

type Sentence = {
  words: CaptionWord[];
  startSec: number;
  endSec: number;
};

function groupIntoSentences(words: CaptionWord[]): Sentence[] {
  // Filter empty/whitespace tokens (forced-alignment pads spaces as empty text).
  const clean = words.filter((w) => w.text && w.text.trim().length > 0);
  const sentences: Sentence[] = [];
  let buf: CaptionWord[] = [];
  for (const w of clean) {
    buf.push(w);
    const trimmed = w.text.trim().replace(/[",;:)]+$/, '');
    if (/[.!?]$/.test(trimmed)) {
      sentences.push({
        words: buf,
        startSec: buf[0].startSec,
        endSec: buf[buf.length - 1].endSec,
      });
      buf = [];
    }
  }
  if (buf.length > 0) {
    sentences.push({
      words: buf,
      startSec: buf[0].startSec,
      endSec: buf[buf.length - 1].endSec,
    });
  }
  return sentences;
}

type Props = {
  words: CaptionWord[];
  /** Override: vertical center line of the caption band (default 1450). */
  centerY?: number;
  /** Override: max width of each line in px. Default 940. */
  maxWidth?: number;
  /** Override: font size in px. Default 64. */
  fontSize?: number;
};

export const SentenceCaption: React.FC<Props> = ({
  words,
  centerY = 1450,
  maxWidth = 940,
  fontSize = 64,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;

  if (!words || words.length === 0) return null;

  const sentences = groupIntoSentences(words);
  if (sentences.length === 0) return null;

  const activeIdx = sentences.findIndex((s) => t >= s.startSec && t < s.endSec);
  if (activeIdx === -1) {
    // Between sentences — render the crossfade transition
    const prevIdx = sentences.findIndex((s, i) => {
      const next = sentences[i + 1];
      return next && t >= s.endSec && t < next.startSec;
    });
    if (prevIdx === -1) return null;
    return renderTransition(sentences[prevIdx], sentences[prevIdx + 1], t, fps, centerY, maxWidth, fontSize);
  }

  const sentence = sentences[activeIdx];
  const fadeIn = interpolate(t, [sentence.startSec, sentence.startSec + CROSSFADE_SEC], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const fadeOut = interpolate(t, [sentence.endSec - CROSSFADE_SEC, sentence.endSec], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const opacity = Math.min(fadeIn, fadeOut);

  return <Box sentence={sentence} t={t} fps={fps} opacity={opacity} centerY={centerY} maxWidth={maxWidth} fontSize={fontSize} />;
};

function renderTransition(
  prev: Sentence,
  next: Sentence,
  t: number,
  fps: number,
  centerY: number,
  maxWidth: number,
  fontSize: number,
): React.ReactElement {
  const prevOpacity = interpolate(t, [prev.endSec, prev.endSec + CROSSFADE_SEC], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const nextOpacity = interpolate(t, [next.startSec - CROSSFADE_SEC, next.startSec], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <>
      {prevOpacity > 0.01 ? (
        <Box sentence={prev} t={t} fps={fps} opacity={prevOpacity} centerY={centerY} maxWidth={maxWidth} fontSize={fontSize} />
      ) : null}
      {nextOpacity > 0.01 ? (
        <Box sentence={next} t={t} fps={fps} opacity={nextOpacity} centerY={centerY} maxWidth={maxWidth} fontSize={fontSize} />
      ) : null}
    </>
  );
}

const Box: React.FC<{
  sentence: Sentence;
  t: number;
  fps: number;
  opacity: number;
  centerY: number;
  maxWidth: number;
  fontSize: number;
}> = ({ sentence, t, fps, opacity, centerY, maxWidth, fontSize }) => {
  const activeWordIdx = sentence.words.findIndex((w) => t >= w.startSec && t < w.endSec);
  const effectiveIdx = activeWordIdx >= 0 ? activeWordIdx : sentence.words.length - 1;

  // Auto-shrink long sentences so they fit ~3 lines max.
  const charCount = sentence.words.reduce((sum, w) => sum + w.text.length + 1, 0);
  const finalSize = charCount > 110 ? Math.round(fontSize * 0.78)
    : charCount > 75 ? Math.round(fontSize * 0.9)
    : fontSize;

  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: centerY - 200,
        height: 400,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
        opacity,
        padding: '0 60px',
      }}
    >
      <div
        style={{
          maxWidth,
          textAlign: 'center',
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          alignItems: 'baseline',
          gap: '8px 14px',
          lineHeight: 1.05,
        }}
      >
        {sentence.words.map((w, i) => {
          const isActive = i === effectiveIdx;
          const wordStartFrame = Math.round(w.startSec * fps);
          const localFrame = Math.max(0, Math.round(t * fps) - wordStartFrame);
          const scale = isActive
            ? spring({
                frame: localFrame,
                fps,
                from: 1.0,
                to: 1.10,
                config: { damping: 20, stiffness: 180 },
                durationInFrames: 6,
              })
            : 1.0;
          // Strip any trailing punctuation we don't want UPPERCASED awkwardly.
          const display = w.text.toUpperCase();
          return (
            <span
              key={`${w.startSec}-${i}`}
              style={{
                fontFamily: FONT,
                fontWeight: 400,
                fontSize: finalSize,
                color: isActive ? GOLD : WHITE,
                letterSpacing: 1,
                display: 'inline-block',
                transform: `scale(${scale.toFixed(3)})`,
                transformOrigin: 'center bottom',
                textShadow: [
                  '3px 0 0 #000',
                  '-3px 0 0 #000',
                  '0 3px 0 #000',
                  '0 -3px 0 #000',
                  '2.5px 2.5px 0 #000',
                  '-2.5px 2.5px 0 #000',
                  '2.5px -2.5px 0 #000',
                  '-2.5px -2.5px 0 #000',
                  '0 8px 22px rgba(0,0,0,0.85)',
                ].join(', '),
              }}
            >
              {display}
            </span>
          );
        })}
      </div>
    </div>
  );
};
