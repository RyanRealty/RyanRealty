import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Img,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import './fonts';

/**
 * AlgorithmPrefers — "the edit vs. the number" trend Reel (June 2026).
 * Action row 924bd206. Part 1 (0-12s): kinetic edit of three verified May
 * stats over four distinct Bend aerials. Hard cut at 12s to silence + a
 * deadpan navy-on-cream card cycling the same numbers. 30s exactly.
 *
 * Every figure traces to citations.json next to the render:
 * market_stats_cache (bend, monthly, 2026-05-01) + market_pulse_live
 * (bend, SFR), both pulled live 2026-06-09/10.
 */

export const ALGO_PREFERS_TOTAL_SEC = 30;

const NAVY = '#102742';
const CREAM = '#faf8f4';
const WHITE = '#ffffff';
const SHADOW = '0 2px 28px rgba(0,0,0,0.55), 0 1px 6px rgba(0,0,0,0.45)';

// Working safe zone, 1080x1920 portrait: x 90-990, y 280-1480.
const SAFE = { left: 90, top: 280, width: 900, height: 1200 };

const XFADE = 6; // crossfade frames between photo beats

type Motion = 'push_in' | 'slow_pan' | 'push_counter' | 'vertical_drift';

type Beat = {
  src: string;
  from: number; // first frame (with XFADE overlap into prior beat)
  to: number; // last frame (exclusive)
  motion: Motion;
  big: string; // Amboqia display line
  small?: string; // Geist label line
  bigSize: number;
};

// Part 1 — four beats, four distinct photos (no repeats per render),
// four motion types. Beat lengths 2.5-3.5s, all under the 4s ceiling.
const BEATS: Beat[] = [
  {
    src: 'trend/a-oldmill.jpg',
    from: 0,
    to: 81,
    motion: 'push_in',
    big: '$797,000',
    small: 'median sale price · may',
    bigSize: 138,
  },
  {
    src: 'trend/b-pilotbutte.jpg',
    from: 75,
    to: 171,
    motion: 'slow_pan',
    big: '↑ 3.6%',
    small: 'vs last may',
    bigSize: 128,
  },
  {
    src: 'trend/c-river.jpg',
    from: 165,
    to: 261,
    motion: 'push_counter',
    big: '12 days',
    small: 'median time to pending',
    bigSize: 128,
  },
  {
    src: 'trend/d-road.jpg',
    from: 255,
    to: 366,
    motion: 'vertical_drift',
    big: '56.6%',
    small: 'still closed under asking',
    bigSize: 138,
  },
];

const CUT = 360; // the hard cut to deadpan (12.0s)

// Part 2 — deadpan card lines, one per 3s beat, then the closing reveal.
const CARD_LINES: Array<{ from: number; to: number; text: string; font: 'display' | 'body'; size: number }> = [
  { from: 360, to: 450, text: 'or, without the edit:', font: 'body', size: 56 },
  { from: 450, to: 540, text: '$797,000.', font: 'display', size: 120 },
  { from: 540, to: 630, text: '12 days.', font: 'display', size: 112 },
  { from: 630, to: 720, text: '56.6% under asking.', font: 'display', size: 84 },
  { from: 720, to: 810, text: 'real either way.', font: 'body', size: 60 },
];

function photoTransform(motion: Motion, local: number, len: number): string {
  const t = local / len;
  switch (motion) {
    case 'push_in': {
      const s = interpolate(t, [0, 1], [1.0, 1.07]);
      return `scale(${s})`;
    }
    case 'slow_pan': {
      const x = interpolate(t, [0, 1], [-2, 2]);
      return `scale(1.08) translateX(${x}%)`;
    }
    case 'push_counter': {
      const s = interpolate(t, [0, 1], [1.08, 1.0]);
      return `scale(${s})`;
    }
    case 'vertical_drift': {
      const y = interpolate(t, [0, 1], [2, -2]);
      return `scale(1.06) translateY(${y}%)`;
    }
  }
}

const PhotoBeat: React.FC<{ beat: Beat; index: number }> = ({ beat, index }) => {
  const frame = useCurrentFrame(); // local to the sequence
  const { fps } = useVideoConfig();
  const len = beat.to - beat.from;

  // Crossfade in (except the first beat) and out at the seam.
  const fadeIn = index === 0 ? 1 : interpolate(frame, [0, XFADE], [0, 1], { extrapolateRight: 'clamp' });
  const fadeOut =
    beat.to >= CUT
      ? 1 // the last beat hard-cuts, no fade
      : interpolate(frame, [len - XFADE, len], [1, 0], { extrapolateLeft: 'clamp' });

  // Number slam: present from frame 0 (thumbnail rule), springs to rest.
  const slam = spring({ frame, fps, config: { damping: 14, mass: 0.6 }, durationInFrames: 12 });
  const bigScale = interpolate(slam, [0, 1], [0.9, 1]);
  const smallOpacity = interpolate(frame, [16, 26], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ opacity: Math.min(fadeIn, fadeOut) }}>
      <Img
        src={staticFile(beat.src)}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: photoTransform(beat.motion, frame, len),
        }}
      />
      <div
        style={{
          position: 'absolute',
          ...SAFE,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            fontFamily: 'Amboqia',
            fontSize: beat.bigSize,
            color: WHITE,
            textShadow: SHADOW,
            lineHeight: 1.05,
            transform: `scale(${bigScale})`,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {beat.big}
        </div>
        {beat.small ? (
          <div
            style={{
              fontFamily: 'Geist',
              fontWeight: 600,
              fontSize: 52,
              color: WHITE,
              textShadow: SHADOW,
              marginTop: 26,
              opacity: smallOpacity,
              letterSpacing: '0.01em',
            }}
          >
            {beat.small}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};

const DeadpanCard: React.FC = () => {
  const frame = useCurrentFrame(); // local: 0 at CUT
  const lines = CARD_LINES.map((l) => ({ ...l, from: l.from - CUT, to: l.to - CUT }));
  const finalFrom = 810 - CUT;
  const finalLen = 900 - 810;
  const finalScale = interpolate(frame, [finalFrom, finalFrom + finalLen], [1.0, 1.045], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ backgroundColor: CREAM }}>
      <div
        style={{
          position: 'absolute',
          ...SAFE,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
        }}
      >
        {lines.map((l) => {
          const opacity = interpolate(
            frame,
            [l.from, l.from + 8, l.to - 8, l.to],
            [0, 1, 1, 0],
            { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
          );
          if (frame < l.from || frame >= l.to) return null;
          return (
            <div
              key={l.text}
              style={{
                position: 'absolute',
                fontFamily: l.font === 'display' ? 'Amboqia' : 'Geist',
                fontWeight: l.font === 'display' ? 400 : 500,
                fontSize: l.size,
                color: NAVY,
                opacity,
                lineHeight: 1.15,
                maxWidth: 900,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {l.text}
            </div>
          );
        })}
        {frame >= finalFrom ? (
          <div
            style={{
              position: 'absolute',
              fontFamily: 'Amboqia',
              fontSize: 132,
              color: NAVY,
              opacity: interpolate(frame, [finalFrom, finalFrom + 8], [0, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              }),
              transform: `scale(${finalScale})`,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            $797,000
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};

export const AlgorithmPrefers: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: CREAM }}>
      {/* Part 1 — the edit. SFX hits on beat boundaries; riser dies at the cut. */}
      {BEATS.map((beat, i) => (
        <Sequence key={beat.src} from={beat.from} durationInFrames={beat.to - beat.from}>
          <PhotoBeat beat={beat} index={i} />
        </Sequence>
      ))}
      <Sequence from={0} durationInFrames={40}>
        <Audio src={staticFile('trend/hit.mp3')} volume={0.85} />
      </Sequence>
      <Sequence from={75} durationInFrames={30}>
        <Audio src={staticFile('trend/whoosh.mp3')} volume={0.6} />
      </Sequence>
      <Sequence from={165} durationInFrames={30}>
        <Audio src={staticFile('trend/whoosh.mp3')} volume={0.6} />
      </Sequence>
      <Sequence from={255} durationInFrames={40}>
        <Audio src={staticFile('trend/hit.mp3')} volume={0.8} />
      </Sequence>
      <Sequence from={315} durationInFrames={45}>
        <Audio src={staticFile('trend/riser.mp3')} volume={0.7} />
      </Sequence>

      {/* Part 2 — the number. Total silence by design. */}
      <Sequence from={CUT} durationInFrames={900 - CUT}>
        <DeadpanCard />
      </Sequence>
    </AbsoluteFill>
  );
};
