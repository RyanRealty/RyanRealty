import React from 'react';
import {
  AbsoluteFill,
  Img,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

const FPS = 30;
export const PAUL_IMPALA_TOTAL_SEC = 45;

type Beat = {
  startSec: number;
  durationSec: number;
  src: string;
};

const BEATS: Beat[] = [
  { startSec: 0.0, durationSec: 3.0, src: 'https://cdn.resize.sparkplatform.com/ore/1600x1200/true/20260510184655423941000000-o.jpg' },
  { startSec: 2.5, durationSec: 3.0, src: 'https://cdn.resize.sparkplatform.com/ore/1600x1200/true/20260510184630564946000000-o.jpg' },
  { startSec: 5.0, durationSec: 3.0, src: 'https://cdn.resize.sparkplatform.com/ore/1600x1200/true/20260510184758961750000000-o.jpg' },
  { startSec: 7.5, durationSec: 3.0, src: 'https://cdn.resize.sparkplatform.com/ore/1600x1200/true/20260510184734426993000000-o.jpg' },
  { startSec: 10.0, durationSec: 3.0, src: 'https://cdn.resize.sparkplatform.com/ore/1600x1200/true/20260510184955440998000000-o.jpg' },
  { startSec: 12.5, durationSec: 3.0, src: 'https://cdn.resize.sparkplatform.com/ore/1600x1200/true/20260510184816478772000000-o.jpg' },
  { startSec: 15.0, durationSec: 3.0, src: 'https://cdn.resize.sparkplatform.com/ore/1600x1200/true/20260510184552736538000000-o.jpg' },
  { startSec: 17.5, durationSec: 3.0, src: 'https://cdn.resize.sparkplatform.com/ore/1600x1200/true/20260510183054145705000000-o.jpg' },
  { startSec: 20.0, durationSec: 3.0, src: 'https://cdn.resize.sparkplatform.com/ore/1600x1200/true/20260510183218299972000000-o.jpg' },
  { startSec: 22.5, durationSec: 3.0, src: 'https://cdn.resize.sparkplatform.com/ore/1600x1200/true/20260510183326477723000000-o.jpg' },
  { startSec: 25.0, durationSec: 3.0, src: 'https://cdn.resize.sparkplatform.com/ore/1600x1200/true/20260510183347442712000000-o.jpg' },
  { startSec: 27.5, durationSec: 3.0, src: 'https://cdn.resize.sparkplatform.com/ore/1600x1200/true/20260510183907413833000000-o.jpg' },
  { startSec: 30.0, durationSec: 3.0, src: 'https://cdn.resize.sparkplatform.com/ore/1600x1200/true/20260510184025451841000000-o.jpg' },
  { startSec: 32.5, durationSec: 3.0, src: 'https://cdn.resize.sparkplatform.com/ore/1600x1200/true/20260510184223374224000000-o.jpg' },
];

const Overlay: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const tSec = frame / fps;
  const introAlpha = interpolate(tSec, [0, 0.4, 2.6, 3.0], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill>
      <AbsoluteFill
        style={{
          justifyContent: 'flex-end',
          padding: '0 64px 210px 64px',
          background: 'linear-gradient(180deg, rgba(0,0,0,0) 58%, rgba(0,0,0,0.62) 100%)',
        }}
      >
        <div
          style={{
            color: '#FFFFFF',
            fontFamily: 'Azo Sans, Arial, sans-serif',
            fontSize: 44,
            lineHeight: 1.2,
            fontWeight: 600,
            maxWidth: 890,
            opacity: introAlpha,
          }}
        >
          Just listed in Redmond
        </div>
      </AbsoluteFill>

      <AbsoluteFill
        style={{
          justifyContent: 'flex-end',
          padding: '0 64px 82px 64px',
          background:
            'linear-gradient(180deg, rgba(0,0,0,0) 64%, rgba(16,39,66,0.78) 100%)',
        }}
      >
        <div
          style={{
            color: '#FFFFFF',
            fontFamily: 'Azo Sans, Arial, sans-serif',
            fontSize: 66,
            fontWeight: 700,
            lineHeight: 1.05,
          }}
        >
          5663 SW Impala Avenue
        </div>
        <div
          style={{
            marginTop: 10,
            color: '#F2EBDD',
            fontFamily: 'Azo Sans, Arial, sans-serif',
            fontSize: 42,
            lineHeight: 1.15,
          }}
        >
          4 bedrooms • 2 bathrooms • 1,903 sq ft • $650,000
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const BeatLayer: React.FC<{ beat: Beat }> = ({ beat }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const beatStart = Math.round(beat.startSec * fps);
  const local = frame - beatStart;
  const drift = spring({
    frame: local,
    fps,
    durationInFrames: Math.round(beat.durationSec * fps),
    config: { damping: 100, stiffness: 60, mass: 0.8 },
  });
  const scale = interpolate(drift, [0, 1], [1.0, 1.08]);
  const tx = interpolate(drift, [0, 1], [-10, 10]);

  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      <Img
        src={beat.src}
        style={{
          width: '112%',
          height: '112%',
          marginLeft: '-6%',
          marginTop: '-6%',
          objectFit: 'cover',
          transform: `translate3d(${tx}px, 0px, 0px) scale(${scale})`,
        }}
      />
    </AbsoluteFill>
  );
};

export const PaulStevensonImpala: React.FC = () => {
  const totalFrames = Math.round(PAUL_IMPALA_TOTAL_SEC * FPS);

  return (
    <AbsoluteFill style={{ backgroundColor: '#0B1320' }}>
      {BEATS.map((beat, i) => (
        <Sequence
          key={`${beat.src}-${i}`}
          from={Math.round(beat.startSec * FPS)}
          durationInFrames={Math.round((beat.durationSec + 0.5) * FPS)}
        >
          <BeatLayer beat={beat} />
        </Sequence>
      ))}

      <Sequence from={0} durationInFrames={totalFrames}>
        <Overlay />
      </Sequence>
    </AbsoluteFill>
  );
};
