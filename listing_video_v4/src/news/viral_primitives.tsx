// Viral news-clip primitives. TikTok / Reel register: animated gradient
// backgrounds, kinetic word-by-word captions, big stat reveals, news ticker,
// chart bars, source pills.
//
// Brand rules (per ANTI_SLOP_MANIFESTO §12 + VIDEO_PRODUCTION_SKILL §5):
//   - Navy #102742, Gold #D4AF37, White, Charcoal only
//   - Amboqia for headlines, AzoSans for body
//   - Source attribution on every cited stat
//   - 90px safe-zone margin every edge (1080×1920 → 900×1740 inner)
//   - No real estate photos required: backgrounds are CSS gradients + SVG so
//     these clips render with zero external image dependencies

import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring } from 'remotion';
import { clamp, easeOutCubic, easeOutQuart } from '../easing';

// Brand tokens (per Matt's spec — D4AF37 gold, not the softened C8A864).
export const NAVY = '#102742';
export const NAVY_DEEP = '#0a1a2e';
export const NAVY_DARKEST = '#050d18';
export const GOLD = '#D4AF37';
export const GOLD_DEEP = '#A8852B';
export const GOLD_BRIGHT = '#E8C552';
export const WHITE = '#FFFFFF';
export const CHARCOAL = '#1A1A1A';
export const RED_ALERT = '#E63946';
export const GREEN_GAIN = '#5BB47A';

export const FONT_HEAD = 'Amboqia';
export const FONT_BODY = 'AzoSans';

// ─── AnimatedGradientBg ────────────────────────────────────────────────────
// Slow rotating navy → gold radial gradient. Replaces the old dark-only
// backdrop. Adds an amber tilt for the hot/heating clips and a cool-blue tilt
// for the cooling/correction clip.
type GradientBgProps = {
  variant?: 'hot' | 'cool' | 'mixed';
};

export const AnimatedGradientBg: React.FC<GradientBgProps> = ({ variant = 'hot' }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const t = frame / Math.max(1, durationInFrames);
  // Slowly drift the spotlight across the canvas.
  const x = 50 + Math.sin(t * Math.PI * 2) * 14;
  const y = 38 + Math.cos(t * Math.PI * 2) * 10;

  const palette = {
    hot: {
      core: 'rgba(212, 175, 55, 0.32)',
      mid: 'rgba(168, 133, 43, 0.18)',
      base1: NAVY,
      base2: '#0c1e36',
      tint: 'rgba(232, 197, 82, 0.10)',
    },
    cool: {
      core: 'rgba(60, 110, 200, 0.28)',
      mid: 'rgba(20, 60, 120, 0.16)',
      base1: NAVY_DEEP,
      base2: NAVY_DARKEST,
      tint: 'rgba(120, 160, 220, 0.08)',
    },
    mixed: {
      core: 'rgba(212, 175, 55, 0.22)',
      mid: 'rgba(60, 110, 200, 0.18)',
      base1: NAVY,
      base2: NAVY_DEEP,
      tint: 'rgba(212, 175, 55, 0.06)',
    },
  }[variant];

  return (
    <>
      <AbsoluteFill
        style={{
          background: `linear-gradient(160deg, ${palette.base1} 0%, ${palette.base2} 100%)`,
        }}
      />
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at ${x}% ${y}%, ${palette.core} 0%, ${palette.mid} 30%, transparent 60%)`,
        }}
      />
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse at 50% 110%, ${palette.tint} 0%, transparent 55%)`,
          mixBlendMode: 'screen',
        }}
      />
      {/* Subtle grid overlay — gives a "data" feel */}
      <AbsoluteFill
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)',
          backgroundSize: '80px 80px',
          opacity: 0.55,
        }}
      />
      {/* Top + bottom vignettes for caption legibility */}
      <AbsoluteFill
        style={{
          background:
            'linear-gradient(180deg, rgba(0,0,0,0.40) 0%, transparent 14%, transparent 78%, rgba(0,0,0,0.50) 100%)',
        }}
      />
    </>
  );
};

// ─── ParticleField ─────────────────────────────────────────────────────────
// Slow-drifting deterministic dots. Adds atmospheric motion behind big stats.
export const ParticleField: React.FC<{ count?: number; color?: string }> = ({
  count = 48,
  color = 'rgba(212, 175, 55, 0.45)',
}) => {
  const frame = useCurrentFrame();
  const dots = React.useMemo(() => {
    const arr: { x: number; y: number; size: number; phase: number; speed: number }[] = [];
    for (let i = 0; i < count; i++) {
      // Deterministic pseudo-random based on i
      const seed = (Math.sin(i * 12.9898) * 43758.5453) % 1;
      const seed2 = (Math.sin(i * 78.233) * 43758.5453) % 1;
      const seed3 = (Math.sin(i * 39.346) * 43758.5453) % 1;
      arr.push({
        x: ((seed + 1) % 1) * 100,
        y: ((seed2 + 1) % 1) * 100,
        size: 2 + ((seed3 + 1) % 1) * 5,
        phase: ((seed * seed2 + 1) % 1) * Math.PI * 2,
        speed: 0.3 + ((seed3 + 1) % 1) * 0.7,
      });
    }
    return arr;
  }, [count]);
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      {dots.map((d, i) => {
        const driftY = Math.sin(frame * 0.012 * d.speed + d.phase) * 30;
        const opacity = 0.4 + 0.6 * Math.sin(frame * 0.04 * d.speed + d.phase);
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: `${d.x}%`,
              top: `calc(${d.y}% + ${driftY}px)`,
              width: d.size,
              height: d.size,
              borderRadius: '50%',
              background: color,
              filter: 'blur(0.5px)',
              boxShadow: `0 0 ${d.size * 2}px ${color}`,
              opacity,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

// ─── BreakingPill ──────────────────────────────────────────────────────────
// Pulsing red "BREAKING" / "ALERT" pill, fixed top of frame. Hook accelerator.
type BreakingPillProps = {
  startFrame?: number;
  text?: string;
  color?: string;
};

export const BreakingPill: React.FC<BreakingPillProps> = ({
  startFrame = 0,
  text = 'BREAKING',
  color = RED_ALERT,
}) => {
  const frame = useCurrentFrame();
  const localF = frame - startFrame;
  const enter = clamp(localF / 8, 0, 1);
  const pulse = 0.85 + 0.15 * Math.sin(frame * 0.25);
  if (localF < 0) return null;
  return (
    <div
      style={{
        position: 'absolute',
        top: 130,
        left: '50%',
        transform: `translateX(-50%) scale(${enter})`,
        background: color,
        color: WHITE,
        fontFamily: FONT_BODY,
        fontWeight: 900,
        fontSize: 30,
        letterSpacing: 6,
        padding: '12px 28px',
        borderRadius: 999,
        opacity: enter * pulse,
        boxShadow: `0 0 28px ${color}aa, 0 6px 18px rgba(0,0,0,0.45)`,
        textTransform: 'uppercase',
      }}
    >
      <span
        style={{
          display: 'inline-block',
          width: 12,
          height: 12,
          borderRadius: '50%',
          background: WHITE,
          marginRight: 12,
          verticalAlign: 'middle',
          opacity: pulse,
        }}
      />
      {text}
    </div>
  );
};

// ─── KineticCaption ────────────────────────────────────────────────────────
// Word-by-word punch-in caption (TikTok/Reel style). Each word springs into
// place on a stagger. The current word is gold + scaled. Past words white.
type KineticCaptionProps = {
  startFrame: number;
  words: string[];
  cadenceFrames?: number; // frames between word reveals
  position?: 'top' | 'upper-third' | 'center' | 'lower-third' | 'bottom';
  fontSize?: number;
  highlightWord?: number; // index of the word that stays gold throughout
  fontFamily?: string;
  fontWeight?: number;
  letterSpacing?: number | string;
  maxWidth?: number;
  align?: 'center' | 'left';
};

export const KineticCaption: React.FC<KineticCaptionProps> = ({
  startFrame,
  words,
  cadenceFrames = 7,
  position = 'lower-third',
  fontSize = 64,
  highlightWord,
  fontFamily = FONT_BODY,
  fontWeight = 900,
  letterSpacing = 1.6,
  maxWidth = 940,
  align = 'center',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const top =
    position === 'top'
      ? '12%'
      : position === 'upper-third'
      ? '30%'
      : position === 'center'
      ? '50%'
      : position === 'lower-third'
      ? '66%'
      : '82%';
  return (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        top,
        transform: 'translate(-50%, -50%)',
        maxWidth,
        textAlign: align,
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: align === 'center' ? 'center' : 'flex-start',
        gap: 14,
      }}
    >
      {words.map((w, i) => {
        const wordStart = startFrame + i * cadenceFrames;
        const localF = frame - wordStart;
        if (localF < 0) return null;
        const s = spring({ frame: localF, fps, config: { damping: 12, stiffness: 180, mass: 0.6 } });
        const fade = clamp(localF / 6, 0, 1);
        const isCurrent =
          frame >= wordStart && frame < wordStart + cadenceFrames + 3;
        const isHighlight = highlightWord === i;
        const color = isHighlight || isCurrent ? GOLD : WHITE;
        const scale = 0.6 + 0.4 * s + (isCurrent ? 0.06 : 0);
        return (
          <span
            key={i}
            style={{
              display: 'inline-block',
              fontFamily,
              fontWeight,
              fontSize,
              color,
              letterSpacing,
              lineHeight: 1.08,
              transform: `scale(${scale.toFixed(3)})`,
              opacity: fade,
              textShadow: '0 4px 22px rgba(0,0,0,0.75), 0 2px 6px rgba(0,0,0,0.85)',
              transformOrigin: 'center',
              textTransform: 'uppercase',
            }}
          >
            {w}
          </span>
        );
      })}
    </div>
  );
};

// ─── BigStat ───────────────────────────────────────────────────────────────
// Hero stat reveal: counter scales up from 0.6 → 1.0, glows, holds.
type BigStatProps = {
  startFrame: number;
  durationFrames?: number;
  from: number;
  to: number;
  format: (v: number) => string;
  fontSize?: number;
  color?: string;
  glowColor?: string;
  position?: { top?: string | number; left?: string | number };
};

export const BigStat: React.FC<BigStatProps> = ({
  startFrame,
  durationFrames = 36,
  from,
  to,
  format,
  fontSize = 320,
  color = GOLD,
  glowColor = 'rgba(212, 175, 55, 0.55)',
  position = { top: '50%', left: '50%' },
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const localF = frame - startFrame;
  const t = clamp(localF / durationFrames, 0, 1);
  const eased = easeOutQuart(t);
  const value = from + (to - from) * eased;
  const scale = localF < 0 ? 0.6 : 0.6 + 0.4 * spring({ frame: localF, fps, config: { damping: 14, stiffness: 130 } });
  const fade = clamp(localF / 8, 0, 1);
  const pulse = 1 + 0.012 * Math.sin(frame * 0.15);
  return (
    <div
      style={{
        position: 'absolute',
        top: position.top,
        left: position.left,
        transform: `translate(-50%, -50%) scale(${(scale * pulse).toFixed(3)})`,
        opacity: fade,
        fontFamily: FONT_HEAD,
        fontWeight: 700,
        fontSize,
        color,
        lineHeight: 1,
        letterSpacing: '-0.04em',
        textShadow: `0 0 60px ${glowColor}, 0 0 30px ${glowColor}, 0 8px 32px rgba(0,0,0,0.85)`,
        whiteSpace: 'nowrap',
      }}
    >
      {format(value)}
    </div>
  );
};

// ─── StatCard ──────────────────────────────────────────────────────────────
// Comparison "card" with city + percent. Slides in, percent counts up.
type StatCardProps = {
  startFrame: number;
  city: string;
  pct: number;
  yPct: number; // vertical position as percent of canvas
  growthFrames?: number;
  delayCard?: number;
};

export const StatCard: React.FC<StatCardProps> = ({
  startFrame,
  city,
  pct,
  yPct,
  growthFrames = 20,
  delayCard = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const cardLocalF = frame - (startFrame + delayCard);
  const valueLocalF = frame - (startFrame + delayCard + 6);
  if (cardLocalF < 0) return null;

  const cardEnter = spring({ frame: cardLocalF, fps, config: { damping: 14, stiffness: 110 } });
  const fade = clamp(cardLocalF / 10, 0, 1);

  const t = clamp(valueLocalF / growthFrames, 0, 1);
  const animatedPct = pct * easeOutCubic(t);
  const isNeg = pct < 0;
  const accent = isNeg ? RED_ALERT : GREEN_GAIN;
  const arrow = isNeg ? '▼' : '▲';

  // Bar width relative to a 700px max axis, scaled by abs(pct)/12 (12% = full)
  const barWidth = Math.min(680, (Math.abs(animatedPct) / 12) * 680);

  return (
    <div
      style={{
        position: 'absolute',
        top: `${yPct}%`,
        left: '50%',
        transform: `translate(-50%, -50%) translateX(${(1 - cardEnter) * -120}px)`,
        opacity: fade,
        width: 920,
        background: 'rgba(255,255,255,0.06)',
        backdropFilter: 'blur(8px)',
        border: '1px solid rgba(255,255,255,0.10)',
        borderRadius: 18,
        padding: '22px 28px',
        boxShadow: '0 12px 40px rgba(0,0,0,0.40)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
        }}
      >
        <div
          style={{
            fontFamily: FONT_BODY,
            fontWeight: 800,
            fontSize: 36,
            color: WHITE,
            letterSpacing: 2,
            textTransform: 'uppercase',
          }}
        >
          {city}
        </div>
        <div
          style={{
            fontFamily: FONT_HEAD,
            fontWeight: 700,
            fontSize: 56,
            color: accent,
            letterSpacing: '-0.02em',
            textShadow: `0 0 22px ${accent}55`,
          }}
        >
          {arrow} {Math.abs(animatedPct).toFixed(1)}%
        </div>
      </div>
      <div
        style={{
          height: 14,
          width: '100%',
          background: 'rgba(255,255,255,0.06)',
          borderRadius: 7,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: barWidth,
            background: `linear-gradient(90deg, ${accent} 0%, ${accent}cc 100%)`,
            borderRadius: 7,
            boxShadow: `0 0 16px ${accent}99`,
          }}
        />
      </div>
    </div>
  );
};

// ─── SourcePill ────────────────────────────────────────────────────────────
// Required attribution. Fixed bottom safe zone.
type SourcePillProps = {
  text: string;
  startFrame?: number;
};

export const SourcePill: React.FC<SourcePillProps> = ({ text, startFrame = 0 }) => {
  const frame = useCurrentFrame();
  const localF = frame - startFrame;
  const alpha = clamp(localF / 14, 0, 1);
  if (localF < 0) return null;
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 110,
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(6px)',
        border: '1px solid rgba(212, 175, 55, 0.40)',
        borderRadius: 999,
        padding: '10px 22px',
        opacity: alpha * 0.95,
        fontFamily: FONT_BODY,
        fontWeight: 600,
        fontSize: 22,
        letterSpacing: 2,
        textTransform: 'uppercase',
        color: 'rgba(255,255,255,0.92)',
        maxWidth: 920,
        textAlign: 'center',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}
    >
      <span style={{ color: GOLD, marginRight: 8 }}>SOURCE</span>
      {text}
    </div>
  );
};

// ─── Headline ──────────────────────────────────────────────────────────────
// Animated headline that wipes in left-to-right with a gold accent bar.
type HeadlineProps = {
  text: string;
  startFrame: number;
  position?: 'top' | 'upper-third' | 'center' | 'lower-third';
  fontSize?: number;
  color?: string;
  align?: 'center' | 'left';
  maxWidth?: number;
};

export const Headline: React.FC<HeadlineProps> = ({
  text,
  startFrame,
  position = 'upper-third',
  fontSize = 56,
  color = WHITE,
  align = 'center',
  maxWidth = 940,
}) => {
  const frame = useCurrentFrame();
  const localF = frame - startFrame;
  const enter = clamp(localF / 14, 0, 1);
  const eased = easeOutCubic(enter);
  const tx = (1 - eased) * -40;
  const top =
    position === 'top'
      ? '14%'
      : position === 'upper-third'
      ? '28%'
      : position === 'center'
      ? '50%'
      : '66%';
  if (localF < 0) return null;
  return (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        top,
        transform: `translate(-50%, -50%) translateX(${tx}px)`,
        opacity: enter,
        maxWidth,
        textAlign: align,
        fontFamily: FONT_HEAD,
        fontWeight: 700,
        fontSize,
        color,
        letterSpacing: '-0.01em',
        lineHeight: 1.15,
        textShadow: '0 6px 28px rgba(0,0,0,0.85)',
      }}
    >
      <div
        style={{
          width: 88,
          height: 6,
          background: GOLD,
          margin: align === 'center' ? '0 auto 24px' : '0 0 24px',
          borderRadius: 3,
          boxShadow: `0 0 16px ${GOLD}`,
          transform: `scaleX(${eased})`,
          transformOrigin: align === 'center' ? 'center' : 'left',
        }}
      />
      {text}
    </div>
  );
};

// ─── NewsTicker ────────────────────────────────────────────────────────────
// Bottom news-ticker bar that scrolls right-to-left.
type NewsTickerProps = {
  text: string;
  speedPxPerFrame?: number;
};

export const NewsTicker: React.FC<NewsTickerProps> = ({ text, speedPxPerFrame = 5 }) => {
  const frame = useCurrentFrame();
  const offset = (frame * speedPxPerFrame) % 2400;
  const repeated = `${text}    •    ${text}    •    ${text}    •    `;
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 60,
        left: 0,
        right: 0,
        height: 44,
        background: 'rgba(0,0,0,0.7)',
        borderTop: `2px solid ${GOLD}`,
        borderBottom: `2px solid ${GOLD}`,
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
      }}
    >
      <div
        style={{
          whiteSpace: 'nowrap',
          transform: `translateX(${-offset}px)`,
          fontFamily: FONT_BODY,
          fontWeight: 700,
          fontSize: 22,
          color: WHITE,
          letterSpacing: 3,
          textTransform: 'uppercase',
        }}
      >
        {repeated}
      </div>
    </div>
  );
};

// ─── BulletList ────────────────────────────────────────────────────────────
// Staggered bullet items with gold marker, springing in.
type BulletListProps = {
  items: string[];
  startFrame: number;
  staggerFrames?: number;
  fontSize?: number;
  position?: { top?: string | number };
};

export const BulletList: React.FC<BulletListProps> = ({
  items,
  startFrame,
  staggerFrames = 10,
  fontSize = 50,
  position = { top: '50%' },
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div
      style={{
        position: 'absolute',
        top: position.top,
        left: '50%',
        transform: 'translate(-50%, -50%)',
        textAlign: 'left',
        display: 'flex',
        flexDirection: 'column',
        gap: 24,
      }}
    >
      {items.map((item, i) => {
        const itemStart = startFrame + i * staggerFrames;
        const localF = frame - itemStart;
        if (localF < 0) return null;
        const s = spring({ frame: localF, fps, config: { damping: 14, stiffness: 130 } });
        const fade = clamp(localF / 10, 0, 1);
        return (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 22,
              opacity: fade,
              transform: `translateX(${(1 - s) * -40}px)`,
            }}
          >
            <div
              style={{
                width: 18,
                height: 18,
                background: GOLD,
                borderRadius: 3,
                boxShadow: `0 0 16px ${GOLD}aa`,
                transform: `rotate(45deg) scale(${s})`,
                flexShrink: 0,
              }}
            />
            <div
              style={{
                fontFamily: FONT_BODY,
                fontWeight: 700,
                fontSize,
                color: WHITE,
                letterSpacing: 1,
                textShadow: '0 4px 22px rgba(0,0,0,0.85)',
              }}
            >
              {item}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ─── BrandEndCard ──────────────────────────────────────────────────────────
// 3s closing card. Logo lockup is text-only here (no logo image dependency).
// Per VIDEO_PRODUCTION_SKILL §5: Bend / Central Oregon tagline allowed.
type BrandEndCardProps = {
  startFrame: number;
};

export const BrandEndCard: React.FC<BrandEndCardProps> = ({ startFrame }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const localF = frame - startFrame;
  const navyAlpha = clamp(localF / 10, 0, 1);
  const wordmarkSpring = spring({ frame: localF - 4, fps, config: { damping: 14, stiffness: 110 } });
  const wordmarkAlpha = clamp((localF - 4) / 14, 0, 1);
  const tagAlpha = clamp((localF - 18) / 12, 0, 1);
  const ruleScale = clamp((localF - 12) / 20, 0, 1);
  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(160deg, ${NAVY} 0%, ${NAVY_DARKEST} 100%)`,
        opacity: navyAlpha,
      }}
    >
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at 50% 40%, rgba(212, 175, 55, 0.22) 0%, transparent 55%)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 24,
        }}
      >
        <div
          style={{
            fontFamily: FONT_HEAD,
            fontWeight: 700,
            fontSize: 110,
            color: WHITE,
            letterSpacing: '-0.01em',
            opacity: wordmarkAlpha,
            transform: `scale(${0.85 + 0.15 * wordmarkSpring})`,
            textShadow: `0 0 40px rgba(212, 175, 55, 0.35)`,
          }}
        >
          Ryan Realty
        </div>
        <div
          style={{
            width: 220,
            height: 4,
            background: GOLD,
            borderRadius: 2,
            transform: `scaleX(${ruleScale})`,
            boxShadow: `0 0 20px ${GOLD}`,
          }}
        />
        <div
          style={{
            fontFamily: FONT_BODY,
            fontWeight: 700,
            fontSize: 28,
            color: GOLD,
            letterSpacing: 6,
            textTransform: 'uppercase',
            opacity: tagAlpha,
          }}
        >
          Bend · Central Oregon
        </div>
      </div>
    </AbsoluteFill>
  );
};
