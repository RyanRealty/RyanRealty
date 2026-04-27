// Viral news-clip primitives — built fully in code (no stock photo deps).
//
// Design intent: TikTok / Reel grammar. Backgrounds are animated mesh
// gradients, blueprint grids, or skyline silhouettes generated as SVG.
// Typography is kinetic (word-by-word, slam-in, scale punch). Numbers
// are giant and animate in. Source attribution is always present per
// CLAUDE.md data-accuracy rule.
//
// Brand rules from VIDEO_PRODUCTION_SKILL.md §5 + ANTI_SLOP_MANIFESTO.md
// Rule 12: Navy #102742, Gold #D4AF37 (named GOLD_BRAND below — the body
// GOLD token in brand.ts is softened to #C8A864 for the listing reels;
// for the news clips we want the punchier #D4AF37 per Matt's spec),
// Cream #F2EBDD, Charcoal #1A1A1A. Amboqia for headlines, AzoSans body.

import React from 'react';
import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { CREAM, FONT_BODY, FONT_SERIF, NAVY } from '../brand';
import { clamp, easeOutCubic, easeOutQuart, easeInOutCubic } from '../easing';

// Punchy news-brand gold (per user spec). The listing reels use a softened
// gold; the news clips want the bolder D4AF37 to read on small screens.
export const GOLD_BRAND = '#D4AF37';
export const NAVY_BRAND = '#102742';
export const RED_DROP = '#E55454';
export const GREEN_RISE = '#4FB873';
export const BLUE_LINE = '#5BA9D6';

// ─── GradientMeshBg ───────────────────────────────────────────────────────
// Animated multi-stop radial gradient mesh. Blobs drift slowly. Used as
// the always-on backdrop replacement for plain black.
type MeshProps = {
  palette?: 'navy' | 'sunset' | 'forest' | 'crimson' | 'ember';
  intensity?: number; // 0–1
};

const PALETTES: Record<string, { base: string; blobs: string[] }> = {
  navy: {
    base: '#06101F',
    blobs: ['rgba(16,39,66,0.95)', 'rgba(91,169,214,0.35)', 'rgba(212,175,55,0.18)'],
  },
  sunset: {
    base: '#1a0e08',
    blobs: ['rgba(212,80,40,0.55)', 'rgba(212,175,55,0.45)', 'rgba(91,40,80,0.55)'],
  },
  forest: {
    base: '#0a1410',
    blobs: ['rgba(40,90,60,0.65)', 'rgba(212,175,55,0.18)', 'rgba(20,60,80,0.55)'],
  },
  crimson: {
    base: '#180808',
    blobs: ['rgba(180,40,40,0.55)', 'rgba(212,175,55,0.20)', 'rgba(40,8,8,0.85)'],
  },
  ember: {
    base: '#0e0703',
    blobs: ['rgba(212,90,30,0.50)', 'rgba(255,180,60,0.30)', 'rgba(40,12,4,0.80)'],
  },
};

export const GradientMeshBg: React.FC<MeshProps> = ({
  palette = 'navy',
  intensity = 1,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const p = PALETTES[palette] ?? PALETTES.navy;

  const b1x = 30 + Math.sin(t * 0.18) * 15;
  const b1y = 30 + Math.cos(t * 0.21) * 12;
  const b2x = 70 + Math.cos(t * 0.14) * 18;
  const b2y = 65 + Math.sin(t * 0.11) * 14;
  const b3x = 50 + Math.sin(t * 0.09 + 1.5) * 22;
  const b3y = 80 + Math.cos(t * 0.13 + 0.6) * 10;

  return (
    <>
      <AbsoluteFill style={{ background: p.base }} />
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 60% 55% at ${b1x}% ${b1y}%, ${p.blobs[0]} 0%, transparent 70%)`,
          opacity: intensity,
        }}
      />
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 50% 45% at ${b2x}% ${b2y}%, ${p.blobs[1]} 0%, transparent 65%)`,
          opacity: intensity,
          mixBlendMode: 'screen',
        }}
      />
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 65% 50% at ${b3x}% ${b3y}%, ${p.blobs[2]} 0%, transparent 70%)`,
          opacity: intensity * 0.85,
          mixBlendMode: 'screen',
        }}
      />
      {/* film-grain overlay for texture */}
      <AbsoluteFill
        style={{
          background:
            'radial-gradient(circle at 25% 30%, rgba(255,255,255,0.025) 0%, transparent 40%), radial-gradient(circle at 80% 70%, rgba(255,255,255,0.018) 0%, transparent 45%)',
          mixBlendMode: 'overlay',
          opacity: 0.55,
        }}
      />
      {/* subtle vignette */}
      <AbsoluteFill
        style={{
          background:
            'radial-gradient(ellipse 80% 80% at 50% 50%, transparent 60%, rgba(0,0,0,0.55) 100%)',
        }}
      />
    </>
  );
};

// ─── BlueprintGrid ────────────────────────────────────────────────────────
// Architectural blueprint grid — used for the tariffs / construction beat.
// Pattern is generated as repeating linear gradients so it ships at any
// resolution without raster assets.
type BlueprintProps = {
  color?: string;
  drift?: boolean;
};
export const BlueprintGrid: React.FC<BlueprintProps> = ({
  color = 'rgba(212,175,55,0.18)',
  drift = true,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const dx = drift ? Math.sin(t * 0.15) * 14 : 0;
  const dy = drift ? Math.cos(t * 0.12) * 10 : 0;
  return (
    <AbsoluteFill
      style={{
        backgroundImage: `
          linear-gradient(${color} 1px, transparent 1px),
          linear-gradient(90deg, ${color} 1px, transparent 1px),
          linear-gradient(rgba(212,175,55,0.06) 1px, transparent 1px),
          linear-gradient(90deg, rgba(212,175,55,0.06) 1px, transparent 1px)
        `,
        backgroundSize: '120px 120px, 120px 120px, 24px 24px, 24px 24px',
        backgroundPosition: `${dx}px ${dy}px, ${dx}px ${dy}px, ${dx}px ${dy}px, ${dx}px ${dy}px`,
        opacity: 0.55,
      }}
    />
  );
};

// ─── SkylineSilhouette ────────────────────────────────────────────────────
// Pure-SVG city skyline. Used for Sun Belt vibe (Phoenix/Tampa/Cape Coral
// none have specific identifying features; this is generic skyline mood
// imagery, not a representation of a specific place — so no Rule 2 issue).
type SkylineProps = {
  fill?: string;
  bottom?: number;
  height?: number;
  drift?: boolean;
};
export const SkylineSilhouette: React.FC<SkylineProps> = ({
  fill = 'rgba(8,16,28,0.85)',
  bottom = 0,
  height = 360,
  drift = true,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const dx = drift ? Math.sin(t * 0.06) * 18 : 0;
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom,
        height,
        transform: `translateX(${dx}px)`,
      }}
    >
      <svg
        viewBox="0 0 1080 360"
        width="100%"
        height="100%"
        preserveAspectRatio="none"
      >
        <path
          d="
            M0 360
            L0 240 L60 240 L60 200 L120 200 L120 270 L160 270 L160 220 L210 220 L210 160 L260 160 L260 240
            L320 240 L320 180 L370 180 L370 220 L420 220 L420 130 L470 130 L470 200 L520 200 L520 250
            L580 250 L580 170 L640 170 L640 220 L700 220 L700 140 L750 140 L750 230 L810 230 L810 190
            L870 190 L870 250 L920 250 L920 160 L980 160 L980 230 L1040 230 L1040 200 L1080 200
            L1080 360 Z
          "
          fill={fill}
        />
      </svg>
    </div>
  );
};

// ─── HouseRowSilhouette ───────────────────────────────────────────────────
// A row of suburban houses (silhouette only). Used for Golden Handcuffs to
// suggest "neighborhood inventory" without claiming a specific property.
type HouseRowProps = {
  fill?: string;
  bottom?: number;
  height?: number;
};
export const HouseRowSilhouette: React.FC<HouseRowProps> = ({
  fill = 'rgba(8,16,28,0.78)',
  bottom = 0,
  height = 280,
}) => {
  // 6 houses, alternating shapes
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom,
        height,
      }}
    >
      <svg
        viewBox="0 0 1080 280"
        width="100%"
        height="100%"
        preserveAspectRatio="none"
      >
        <g fill={fill}>
          {/* H1 */}
          <polygon points="40,280 40,180 120,120 200,180 200,280" />
          <rect x="60" y="200" width="30" height="40" fill={NAVY_BRAND} />
          <rect x="140" y="195" width="40" height="35" fill={NAVY_BRAND} />
          {/* H2 (taller) */}
          <polygon points="220,280 220,160 320,90 420,160 420,280" />
          <rect x="260" y="190" width="35" height="50" fill={NAVY_BRAND} />
          <rect x="335" y="180" width="40" height="40" fill={NAVY_BRAND} />
          {/* H3 */}
          <polygon points="440,280 440,170 520,110 600,170 600,280" />
          <rect x="465" y="190" width="30" height="40" fill={NAVY_BRAND} />
          <rect x="540" y="185" width="35" height="35" fill={NAVY_BRAND} />
          {/* H4 (taller) */}
          <polygon points="620,280 620,150 720,80 820,150 820,280" />
          <rect x="650" y="180" width="30" height="50" fill={NAVY_BRAND} />
          <rect x="745" y="170" width="40" height="40" fill={NAVY_BRAND} />
          {/* H5 */}
          <polygon points="840,280 840,180 920,120 1000,180 1000,280" />
          <rect x="860" y="200" width="30" height="40" fill={NAVY_BRAND} />
          <rect x="945" y="195" width="35" height="35" fill={NAVY_BRAND} />
          {/* H6 partial */}
          <polygon points="1020,280 1020,170 1080,120 1080,280" />
        </g>
      </svg>
    </div>
  );
};

// ─── KineticHook ──────────────────────────────────────────────────────────
// Slam-in mega text. Spring scale + slight rotate for that physics feel
// every viral hook has. Optional shake on impact.
type KineticHookProps = {
  text: string;
  startFrame: number;
  fontSize?: number;
  color?: string;
  fontFamily?: string;
  fontWeight?: number;
  letterSpacing?: string | number;
  top?: string;
  shake?: boolean;
  maxWidth?: number;
  textTransform?: React.CSSProperties['textTransform'];
};
export const KineticHook: React.FC<KineticHookProps> = ({
  text,
  startFrame,
  fontSize = 110,
  color = CREAM,
  fontFamily = FONT_SERIF,
  fontWeight = 700,
  letterSpacing = '-0.02em',
  top = '50%',
  shake = true,
  maxWidth = 940,
  textTransform = 'none',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const localF = frame - startFrame;
  const sp = spring({
    frame: localF,
    fps,
    config: { damping: 9, mass: 0.6, stiffness: 110 },
  });
  const scale = 0.5 + sp * 0.5;
  const opacity = clamp(localF / 4, 0, 1);
  // Deterministic shake (no Math.random — Remotion needs stable frames).
  const shakeAmp = shake ? Math.max(0, 1 - localF / 12) * 7 : 0;
  const shakeX = shakeAmp * Math.sin(localF * 1.7);
  const shakeY = shakeAmp * Math.cos(localF * 2.1);
  return (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        top,
        transform: `translate(calc(-50% + ${shakeX}px), calc(-50% + ${shakeY}px)) scale(${scale.toFixed(3)})`,
        opacity,
        maxWidth,
        textAlign: 'center',
        fontFamily,
        fontWeight,
        fontSize,
        color,
        letterSpacing,
        lineHeight: 1.05,
        textTransform,
        whiteSpace: 'nowrap',
        textShadow:
          '0 6px 32px rgba(0,0,0,0.85), 0 2px 10px rgba(0,0,0,0.85), 0 0 1px rgba(0,0,0,1)',
      }}
    >
      {text}
    </div>
  );
};

// ─── WordReveal ───────────────────────────────────────────────────────────
// TikTok-style word-by-word caption. Each word pops in with a quick scale
// + opacity. Optional highlight color for one word in the phrase.
type WordRevealProps = {
  text: string; // separate words with single spaces; use '|' to mark highlighted word
  startFrame: number;
  perWordFrames?: number;
  fontSize?: number;
  color?: string;
  highlightColor?: string;
  fontFamily?: string;
  fontWeight?: number;
  top?: string;
  letterSpacing?: string | number;
  maxWidth?: number;
  textTransform?: React.CSSProperties['textTransform'];
  align?: 'center' | 'left';
};
export const WordReveal: React.FC<WordRevealProps> = ({
  text,
  startFrame,
  perWordFrames = 6,
  fontSize = 60,
  color = CREAM,
  highlightColor = GOLD_BRAND,
  fontFamily = FONT_BODY,
  fontWeight = 800,
  top = '50%',
  letterSpacing = 1.2,
  maxWidth = 920,
  textTransform = 'uppercase',
  align = 'center',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = text.split(' ');
  return (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        top,
        transform: 'translate(-50%, -50%)',
        maxWidth,
        textAlign: align,
        fontFamily,
        fontWeight,
        fontSize,
        letterSpacing,
        lineHeight: 1.18,
        textTransform,
        textShadow:
          '0 4px 18px rgba(0,0,0,0.9), 0 2px 6px rgba(0,0,0,0.9)',
      }}
    >
      {words.map((w, i) => {
        const isHighlight = w.startsWith('|');
        const word = isHighlight ? w.slice(1) : w;
        const wStart = startFrame + i * perWordFrames;
        const localF = frame - wStart;
        const sp = spring({
          frame: localF,
          fps,
          config: { damping: 10, mass: 0.4, stiffness: 130 },
        });
        const scale = 0.7 + sp * 0.3;
        const opacity = clamp(localF / 3, 0, 1);
        return (
          <span
            key={i}
            style={{
              display: 'inline-block',
              margin: '0 0.18em',
              transform: `scale(${scale.toFixed(3)})`,
              opacity,
              color: isHighlight ? highlightColor : color,
            }}
          >
            {word}
          </span>
        );
      })}
    </div>
  );
};

// ─── GiantNumber ──────────────────────────────────────────────────────────
// Hero stat — count-up with land-punch (over-scale + settle).
type GiantNumberProps = {
  from?: number;
  to: number;
  startFrame: number;
  durationFrames?: number;
  format: (v: number) => string;
  color?: string;
  fontSize?: number;
  top?: string;
  fontFamily?: string;
};
export const GiantNumber: React.FC<GiantNumberProps> = ({
  from = 0,
  to,
  startFrame,
  durationFrames,
  format,
  color = GOLD_BRAND,
  fontSize = 320,
  top = '50%',
  fontFamily = FONT_SERIF,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const dur = durationFrames ?? Math.round(fps * 1.6);
  const localF = frame - startFrame;
  const t = clamp(localF / dur, 0, 1);
  const eased = easeOutCubic(t);
  const value = from + (to - from) * eased;
  // Land-punch: scale up to 1.06 at land then settle to 1.0
  const landF = localF - dur;
  const punch =
    landF >= 0 && landF < 14
      ? 1 + 0.06 * Math.sin((landF / 14) * Math.PI)
      : 1;
  const opacity = clamp(localF / 4, 0, 1);
  return (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        top,
        transform: `translate(-50%, -50%) scale(${punch.toFixed(4)})`,
        opacity,
        textAlign: 'center',
        fontFamily,
        fontWeight: 700,
        fontSize,
        color,
        letterSpacing: '-0.045em',
        lineHeight: 0.95,
        textShadow: `0 8px 36px rgba(0,0,0,0.9), 0 0 60px ${color}33`,
      }}
    >
      {format(value)}
    </div>
  );
};

// ─── TickerTape ───────────────────────────────────────────────────────────
// Horizontal scrolling text band. Stat-ticker vibe. Used at top or bottom
// to keep visual energy under static beats.
type TickerProps = {
  items: { label: string; value?: string; tone?: 'down' | 'up' | 'neutral' }[];
  y: number; // px from top
  pxPerSec?: number;
  fontSize?: number;
  height?: number;
};
export const TickerTape: React.FC<TickerProps> = ({
  items,
  y,
  pxPerSec = 120,
  fontSize = 26,
  height = 64,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const offset = (frame / fps) * pxPerSec;
  // Build double-loop content
  const loop = [...items, ...items, ...items];
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: y,
        height,
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        background: 'rgba(6,16,31,0.70)',
        borderTop: `1px solid ${GOLD_BRAND}55`,
        borderBottom: `1px solid ${GOLD_BRAND}55`,
        backdropFilter: 'blur(8px)',
      }}
    >
      <div
        style={{
          display: 'flex',
          gap: 64,
          transform: `translateX(${-offset}px)`,
          whiteSpace: 'nowrap',
          paddingLeft: 64,
        }}
      >
        {loop.map((it, i) => {
          const tone =
            it.tone === 'down' ? RED_DROP : it.tone === 'up' ? GREEN_RISE : CREAM;
          const arrow =
            it.tone === 'down' ? '▼' : it.tone === 'up' ? '▲' : '•';
          return (
            <div
              key={i}
              style={{
                display: 'inline-flex',
                gap: 14,
                alignItems: 'center',
                fontFamily: FONT_BODY,
                fontWeight: 800,
                fontSize,
                color: CREAM,
                letterSpacing: 2.8,
                textTransform: 'uppercase',
              }}
            >
              <span style={{ color: tone }}>{arrow}</span>
              <span>{it.label}</span>
              {it.value !== undefined && (
                <span style={{ color: tone, fontFamily: FONT_SERIF, fontWeight: 700, letterSpacing: 0 }}>
                  {it.value}
                </span>
              )}
              <span style={{ color: GOLD_BRAND, opacity: 0.55, marginLeft: 8 }}>///</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─── BarRace ──────────────────────────────────────────────────────────────
// Vertical stack of horizontal bars with animated fill + counting label.
// Each bar enters with a stagger.
type BarItem = {
  label: string;
  pct: number; // value, can be negative
  tone?: 'up' | 'down';
};
type BarRaceProps = {
  items: BarItem[];
  startFrame: number;
  staggerFrames?: number;
  growthFrames?: number;
  topPx?: number; // top of bar stack
  scale?: number; // px per percent unit
  rowHeight?: number;
  labelWidth?: number;
};
export const BarRace: React.FC<BarRaceProps> = ({
  items,
  startFrame,
  staggerFrames = 8,
  growthFrames = 26,
  topPx = 800,
  scale = 30,
  rowHeight = 130,
  labelWidth = 320,
}) => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        position: 'absolute',
        left: 90,
        right: 90,
        top: topPx,
      }}
    >
      {items.map((it, i) => {
        const sf = startFrame + i * staggerFrames;
        const localF = frame - sf;
        const t = clamp(localF / growthFrames, 0, 1);
        const eased = easeOutCubic(t);
        const animated = it.pct * eased;
        const width = Math.abs(animated) * scale;
        const tone = it.tone ?? (it.pct < 0 ? 'down' : 'up');
        const barColor = tone === 'down' ? RED_DROP : GREEN_RISE;
        const valueColor = tone === 'down' ? '#FF7B7B' : '#7DD9A0';
        const labelAlpha = clamp(localF / 8, 0, 1);
        return (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 24,
              height: rowHeight,
              opacity: labelAlpha,
            }}
          >
            <div
              style={{
                width: labelWidth,
                fontFamily: FONT_BODY,
                fontWeight: 800,
                fontSize: 36,
                color: CREAM,
                letterSpacing: 2,
                textTransform: 'uppercase',
                textAlign: 'right',
                paddingRight: 8,
                textShadow: '0 2px 8px rgba(0,0,0,0.85)',
              }}
            >
              {it.label}
            </div>
            <div
              style={{
                flex: 1,
                height: 38,
                background: 'rgba(255,255,255,0.06)',
                borderRadius: 8,
                position: 'relative',
                overflow: 'visible',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: `${width}px`,
                  background: `linear-gradient(90deg, ${barColor}cc, ${barColor})`,
                  borderRadius: 8,
                  boxShadow: `0 0 22px ${barColor}77, inset 0 1px 0 rgba(255,255,255,0.18)`,
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  left: width + 18,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  fontFamily: FONT_SERIF,
                  fontWeight: 700,
                  fontSize: 50,
                  color: valueColor,
                  textShadow: '0 2px 10px rgba(0,0,0,0.85)',
                }}
              >
                {it.pct > 0 ? '+' : ''}
                {animated.toFixed(1)}%
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ─── PulseDot ─────────────────────────────────────────────────────────────
// Map-marker style pulsing dot used to "place" cities. Can be used over a
// blank canvas as pure stylization (no false geographic claim).
type PulseDotProps = {
  x: string;
  y: string;
  color?: string;
  size?: number;
  startFrame: number;
};
export const PulseDot: React.FC<PulseDotProps> = ({
  x,
  y,
  color = RED_DROP,
  size = 22,
  startFrame,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const localF = frame - startFrame;
  if (localF < 0) return null;
  const t = (localF % (fps * 1.5)) / (fps * 1.5);
  const ringScale = 1 + t * 3.2;
  const ringOpacity = 1 - t;
  const enter = clamp(localF / 8, 0, 1);
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        transform: `translate(-50%, -50%) scale(${enter.toFixed(3)})`,
        width: size,
        height: size,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          background: color,
          boxShadow: `0 0 18px ${color}aa`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          border: `2px solid ${color}`,
          transform: `scale(${ringScale.toFixed(3)})`,
          opacity: ringOpacity,
        }}
      />
    </div>
  );
};

// ─── DrawnLineChart ───────────────────────────────────────────────────────
// SVG line chart with stroke-draw animation. Used for trend storytelling
// (e.g. "rate lock-in melting"). Points are plotted in clip-space coords.
type LineChartProps = {
  points: { x: number; y: number }[]; // 0–100 each
  startFrame: number;
  drawFrames?: number;
  width?: number;
  height?: number;
  top?: number;
  left?: number;
  color?: string;
  fillBelow?: boolean;
  axisColor?: string;
  axisLabels?: { x: number; text: string }[];
};
export const DrawnLineChart: React.FC<LineChartProps> = ({
  points,
  startFrame,
  drawFrames = 60,
  width = 880,
  height = 360,
  top = 0,
  left = 0,
  color = GOLD_BRAND,
  fillBelow = true,
  axisColor = 'rgba(242,235,221,0.35)',
  axisLabels,
}) => {
  const frame = useCurrentFrame();
  const localF = frame - startFrame;
  const t = clamp(localF / drawFrames, 0, 1);
  const eased = easeInOutCubic(t);
  const padX = 40;
  const padY = 20;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;
  const toCoord = (p: { x: number; y: number }) => ({
    cx: padX + (p.x / 100) * innerW,
    cy: padY + (1 - p.y / 100) * innerH,
  });
  const coords = points.map(toCoord);
  const d =
    'M' +
    coords.map((c) => `${c.cx.toFixed(1)},${c.cy.toFixed(1)}`).join(' L ');
  // Approx path length via segments
  let totalLen = 0;
  for (let i = 1; i < coords.length; i++) {
    const dx = coords[i].cx - coords[i - 1].cx;
    const dy = coords[i].cy - coords[i - 1].cy;
    totalLen += Math.sqrt(dx * dx + dy * dy);
  }
  const dashOffset = totalLen * (1 - eased);
  const fillD = fillBelow
    ? `${d} L ${coords[coords.length - 1].cx.toFixed(1)},${(padY + innerH).toFixed(1)} L ${coords[0].cx.toFixed(1)},${(padY + innerH).toFixed(1)} Z`
    : '';
  const fillAlpha = clamp((localF - drawFrames * 0.6) / 18, 0, 0.35);
  // Visible point at the head of the draw
  const headIdx = Math.min(coords.length - 1, Math.floor(eased * (coords.length - 1)));
  const head = coords[headIdx];
  return (
    <div style={{ position: 'absolute', left, top, width, height }}>
      <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`}>
        {/* axis baseline */}
        <line
          x1={padX}
          y1={padY + innerH}
          x2={padX + innerW}
          y2={padY + innerH}
          stroke={axisColor}
          strokeWidth="2"
        />
        {fillBelow && (
          <path d={fillD} fill={color} opacity={fillAlpha} style={{ filter: 'blur(0.5px)' }} />
        )}
        <path
          d={d}
          stroke={color}
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          strokeDasharray={totalLen}
          strokeDashoffset={dashOffset}
          style={{ filter: `drop-shadow(0 0 8px ${color}88)` }}
        />
        {/* head dot */}
        {eased > 0.05 && (
          <>
            <circle cx={head.cx} cy={head.cy} r="14" fill={color} opacity="0.35" />
            <circle cx={head.cx} cy={head.cy} r="7" fill={CREAM} />
          </>
        )}
        {/* axis labels */}
        {axisLabels?.map((al, i) => {
          const cx = padX + (al.x / 100) * innerW;
          return (
            <text
              key={i}
              x={cx}
              y={padY + innerH + 28}
              fontSize="22"
              fontFamily="AzoSans"
              fontWeight="700"
              fill="rgba(242,235,221,0.65)"
              textAnchor="middle"
              letterSpacing="2"
            >
              {al.text}
            </text>
          );
        })}
      </svg>
    </div>
  );
};

// ─── BreakingBadge ────────────────────────────────────────────────────────
// "BREAKING" / "ALERT" pill at the very top of frame. Pulsing.
type BadgeProps = {
  label?: string;
  startFrame?: number;
};
export const BreakingBadge: React.FC<BadgeProps> = ({
  label = 'MARKET ALERT',
  startFrame = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const localF = frame - startFrame;
  const enter = clamp(localF / 10, 0, 1);
  const pulse = 0.85 + 0.15 * Math.sin((localF / fps) * 6);
  return (
    <div
      style={{
        position: 'absolute',
        top: 80,
        left: '50%',
        transform: `translate(-50%, 0) scale(${enter.toFixed(3)})`,
        opacity: enter,
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        background: GOLD_BRAND,
        color: NAVY_BRAND,
        padding: '12px 26px',
        borderRadius: 999,
        fontFamily: FONT_BODY,
        fontWeight: 900,
        fontSize: 26,
        letterSpacing: 4,
        textTransform: 'uppercase',
        boxShadow: '0 6px 24px rgba(0,0,0,0.65)',
      }}
    >
      <span
        style={{
          width: 14,
          height: 14,
          borderRadius: '50%',
          background: '#C03030',
          opacity: pulse,
          boxShadow: `0 0 12px #C03030`,
        }}
      />
      {label}
    </div>
  );
};

// ─── SourcePill ───────────────────────────────────────────────────────────
// Refreshed source line — now a brand-styled pill instead of a tiny line.
type SourcePillProps = {
  text: string;
  startFrame?: number;
};
export const SourcePill: React.FC<SourcePillProps> = ({ text, startFrame = 0 }) => {
  const frame = useCurrentFrame();
  const localF = frame - startFrame;
  const alpha = clamp(localF / 10, 0, 1);
  return (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        bottom: 220,
        transform: `translate(-50%, 0)`,
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
      }}
    >
      <span style={{ color: GOLD_BRAND, marginRight: 10 }}>SOURCE</span>
      {text}
    </div>
  );
};

// ─── BrandWatermark ───────────────────────────────────────────────────────
// Persistent corner watermark — small Ryan Realty wordmark. Optional.
export const BrandWatermark: React.FC<{ startFrame?: number }> = ({
  startFrame = 0,
}) => {
  const frame = useCurrentFrame();
  const localF = frame - startFrame;
  const alpha = clamp(localF / 14, 0, 1) * 0.85;
  return (
    <div
      style={{
        position: 'absolute',
        left: 60,
        bottom: 100,
        opacity: alpha,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <div
        style={{
          width: 14,
          height: 14,
          background: GOLD_BRAND,
          transform: 'rotate(45deg)',
          boxShadow: `0 0 10px ${GOLD_BRAND}77`,
        }}
      />
      <div
        style={{
          fontFamily: FONT_BODY,
          fontWeight: 900,
          fontSize: 22,
          color: CREAM,
          letterSpacing: 4,
          textTransform: 'uppercase',
        }}
      >
        Ryan Realty
      </div>
    </div>
  );
};

// ─── EndCard ──────────────────────────────────────────────────────────────
// 3-second navy end card with logo wordmark + tagline. Replaces the
// existing BrandOutroCard for the news clips (denser, more "news show"
// brand stamp instead of luxury slow fade).
type EndCardProps = {
  startFrame: number;
  tagline?: string;
};
export const NewsEndCard: React.FC<EndCardProps> = ({
  startFrame,
  tagline = 'Bend / Central Oregon · Market Intel',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const localF = frame - startFrame;
  const navyAlpha = clamp(localF / 8, 0, 1);
  const sp = spring({
    frame: localF - 4,
    fps,
    config: { damping: 11, mass: 0.5, stiffness: 120 },
  });
  const wordScale = 0.85 + sp * 0.15;
  const tagAlpha = clamp((localF - 18) / 14, 0, 1);
  const dividerWidth = clamp((localF - 14) / 18, 0, 1) * 380;
  return (
    <AbsoluteFill style={{ background: NAVY, opacity: navyAlpha }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(ellipse 70% 60% at 50% 40%, rgba(212,175,55,0.18) 0%, transparent 70%)',
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
        }}
      >
        <div
          style={{
            transform: `scale(${wordScale.toFixed(3)})`,
            opacity: clamp(localF / 10, 0, 1),
            marginBottom: 36,
          }}
        >
          <Img
            src={staticFile('brand/stacked_logo_white.png')}
            style={{
              width: 540,
              height: 'auto',
              display: 'block',
              filter: 'drop-shadow(0 6px 24px rgba(0,0,0,0.7))',
            }}
          />
        </div>
        <div
          style={{
            width: dividerWidth,
            height: 2,
            background: GOLD_BRAND,
            opacity: 0.85,
            marginBottom: 28,
          }}
        />
        <div
          style={{
            fontFamily: FONT_BODY,
            fontWeight: 700,
            fontSize: 28,
            color: GOLD_BRAND,
            letterSpacing: 5,
            textTransform: 'uppercase',
            opacity: tagAlpha,
          }}
        >
          {tagline}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ─── Helpers ──────────────────────────────────────────────────────────────
export const formatPct = (v: number) => `${Math.round(v)}%`;
export const formatDollars = (v: number) =>
  `$${Math.round(v).toLocaleString('en-US')}`;
export const formatCommas = (v: number) =>
  `${Math.round(v).toLocaleString('en-US')}`;

// ─── PercentRing ──────────────────────────────────────────────────────────
// Big circular percent ring. Fills like a stopwatch dial. Pairs with the
// hero number to keep the eye on the percent.
type RingProps = {
  pct: number;
  startFrame: number;
  durationFrames?: number;
  size?: number;
  stroke?: number;
  color?: string;
  trackColor?: string;
  centerX?: string;
  centerY?: string;
};
export const PercentRing: React.FC<RingProps> = ({
  pct,
  startFrame,
  durationFrames,
  size = 600,
  stroke = 22,
  color = GOLD_BRAND,
  trackColor = 'rgba(255,255,255,0.10)',
  centerX = '50%',
  centerY = '50%',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const dur = durationFrames ?? Math.round(fps * 1.4);
  const localF = frame - startFrame;
  const t = clamp(localF / dur, 0, 1);
  const eased = easeOutCubic(t);
  const r = (size - stroke) / 2;
  const C = 2 * Math.PI * r;
  const filled = (pct / 100) * C * eased;
  const dashArray = `${filled} ${C}`;
  return (
    <div
      style={{
        position: 'absolute',
        left: centerX,
        top: centerY,
        transform: 'translate(-50%, -50%)',
        width: size,
        height: size,
      }}
    >
      <svg width={size} height={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={trackColor}
          strokeWidth={stroke}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={dashArray}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ filter: `drop-shadow(0 0 14px ${color}aa)` }}
        />
      </svg>
    </div>
  );
};

// ─── SlamLine ─────────────────────────────────────────────────────────────
// Single phrase with a horizontal swipe-in reveal mask + bold underline.
type SlamLineProps = {
  text: string;
  startFrame: number;
  fontSize?: number;
  color?: string;
  underline?: string;
  top?: string;
  fontFamily?: string;
  letterSpacing?: string | number;
  fontWeight?: number;
  textTransform?: React.CSSProperties['textTransform'];
};
export const SlamLine: React.FC<SlamLineProps> = ({
  text,
  startFrame,
  fontSize = 78,
  color = CREAM,
  underline = GOLD_BRAND,
  top = '50%',
  fontFamily = FONT_SERIF,
  letterSpacing = '-0.01em',
  fontWeight = 700,
  textTransform = 'none',
}) => {
  const frame = useCurrentFrame();
  const localF = frame - startFrame;
  const reveal = clamp(localF / 12, 0, 1);
  const easedReveal = easeOutQuart(reveal);
  const underlineW = clamp((localF - 8) / 18, 0, 1) * 100;
  return (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        top,
        transform: 'translate(-50%, -50%)',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          overflow: 'hidden',
          clipPath: `inset(0 ${(1 - easedReveal) * 100}% 0 0)`,
          fontFamily,
          fontWeight,
          fontSize,
          color,
          letterSpacing,
          lineHeight: 1.12,
          textTransform,
          textShadow: '0 4px 22px rgba(0,0,0,0.9)',
          paddingBottom: 14,
        }}
      >
        {text}
      </div>
      <div
        style={{
          height: 6,
          width: `${underlineW}%`,
          background: underline,
          margin: '0 auto',
          boxShadow: `0 0 14px ${underline}aa`,
        }}
      />
    </div>
  );
};

// ─── BigQuote ─────────────────────────────────────────────────────────────
// Pull-quote treatment for editorial close lines.
type BigQuoteProps = {
  text: string;
  startFrame: number;
  fontSize?: number;
  maxWidth?: number;
};
export const BigQuote: React.FC<BigQuoteProps> = ({
  text,
  startFrame,
  fontSize = 60,
  maxWidth = 920,
}) => {
  const frame = useCurrentFrame();
  const localF = frame - startFrame;
  const alpha = clamp(localF / 14, 0, 1);
  const rise = (1 - clamp(localF / 18, 0, 1)) * 30;
  return (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        top: '50%',
        transform: `translate(-50%, calc(-50% + ${rise}px))`,
        opacity: alpha,
        maxWidth,
        textAlign: 'center',
        fontFamily: FONT_SERIF,
        fontWeight: 400,
        fontSize,
        color: CREAM,
        letterSpacing: '-0.005em',
        lineHeight: 1.28,
        textShadow: '0 4px 22px rgba(0,0,0,0.9)',
      }}
    >
      <div
        style={{
          width: 80,
          height: 4,
          background: GOLD_BRAND,
          margin: '0 auto 28px',
          boxShadow: `0 0 12px ${GOLD_BRAND}aa`,
        }}
      />
      {text}
    </div>
  );
};

// ─── CaptionTrack ─────────────────────────────────────────────────────────
// Bottom safe-zone subtitle box. Fades in fast, holds, fades out. Designed
// to sit just above the ticker on news clips. Use one CaptionTrack per VO
// sentence, sequenced to match audio timing.
type CaptionProps = {
  text: string;
  startFrame?: number;
  durationFrames: number;
  fontSize?: number;
  bottom?: number;
};

export const CaptionTrack: React.FC<CaptionProps> = ({
  text,
  startFrame = 0,
  durationFrames,
  fontSize = 38,
  bottom = 280,
}) => {
  const frame = useCurrentFrame();
  const localF = frame - startFrame;
  if (localF < 0 || localF > durationFrames) return null;

  const fadeIn = clamp(localF / 4, 0, 1);
  const fadeOut = clamp((durationFrames - localF) / 6, 0, 1);
  const opacity = Math.min(fadeIn, fadeOut);

  return (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        bottom,
        transform: 'translateX(-50%)',
        maxWidth: 940,
        padding: '14px 28px',
        background: 'rgba(0,0,0,0.82)',
        borderRadius: 8,
        opacity,
        textAlign: 'center',
      }}
    >
      <div
        style={{
          fontFamily: FONT_BODY,
          fontWeight: 700,
          fontSize,
          color: '#FFFFFF',
          letterSpacing: 0.5,
          lineHeight: 1.25,
          textShadow: '0 2px 8px rgba(0,0,0,0.95)',
        }}
      >
        {text}
      </div>
    </div>
  );
};

// Re-export the spring/interpolate util so clip files have a single import.
export { interpolate };
