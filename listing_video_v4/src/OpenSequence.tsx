// OpenSequence.tsx — Reusable v9 boundary open, extracted from BoundaryDrawTest.
// 7s, 1080x1920. Satellite tile + soft gold glow over Vandevert Ranch area.
// Timing identical to BoundaryDrawTest v9 so renders match.
//
// Props:
//   fps: number — pass in the composition FPS
//
// Polygon: Vandevert Ranch Phase I + Phase II subdivision boundaries
// Source: Deschutes County GIS, OBJECTID 132 (Phase II, 461ac) + 133 (Phase I, 316ac)
// Projection: Web Mercator zoom 15, tile 1280x1280 displayed at 1080px wide.
// Property center 43.8383243, -121.4428004 projects to tile center (540,540).

import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig, Img, staticFile } from 'remotion';
import { CREAM, GOLD, FONT_SANS } from './brand';

// ─── Projection helpers ───────────────────────────────────────────────────────
const MAP_CENTER_LNG = -121.4428004;
const MAP_CENTER_LAT = 43.8383243;
const MAP_ZOOM = 15;
const TILE_SIZE = 256;
const TILE_PX = 1280;
const DISPLAY_W = 1080;
const TILE_DISPLAY_SCALE = DISPLAY_W / TILE_PX;
const TILE_TOP_OFFSET = (1920 - DISPLAY_W) / 2; // 420px

function lngToNorm(lng: number): number {
  return (lng + 180) / 360;
}
function latToNorm(lat: number): number {
  const sinLat = Math.sin((lat * Math.PI) / 180);
  return 0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI);
}

function toCanvas(lng: number, lat: number): [number, number] {
  const scale = TILE_SIZE * Math.pow(2, MAP_ZOOM);
  const cx = lngToNorm(MAP_CENTER_LNG) * scale;
  const cy = latToNorm(MAP_CENTER_LAT) * scale;
  const tilePx = lngToNorm(lng) * scale - cx + TILE_PX / 2;
  const tilePy = latToNorm(lat) * scale - cy + TILE_PX / 2;
  return [tilePx * TILE_DISPLAY_SCALE, tilePy * TILE_DISPLAY_SCALE + TILE_TOP_OFFSET];
}

// ─── Vandevert Ranch Phase II (129 vertices) ─────────────────────────────────
const PHASE2_COORDS: [number, number][] = [
  [-121.453381,43.830412],[-121.453758,43.830408],[-121.454129,43.830405],
  [-121.454502,43.830402],[-121.454885,43.830399],[-121.455258,43.830396],
  [-121.455635,43.830393],[-121.456014,43.830390],[-121.456399,43.830387],
  [-121.456501,43.830386],[-121.456501,43.830257],[-121.456498,43.829818],
  [-121.456499,43.829609],[-121.456497,43.829392],[-121.456496,43.829181],
  [-121.456496,43.828968],[-121.456494,43.828743],[-121.456493,43.828666],
  [-121.456494,43.828588],[-121.456492,43.828364],[-121.456493,43.828146],
  [-121.456491,43.827927],[-121.456489,43.827700],[-121.456489,43.827471],
  [-121.456488,43.827249],[-121.456486,43.827011],[-121.456486,43.826793],
  [-121.456486,43.826755],[-121.456485,43.826578],[-121.456483,43.826361],
  [-121.456484,43.826146],[-121.456482,43.825919],[-121.456482,43.825697],
  [-121.456481,43.825488],[-121.456479,43.825265],[-121.456480,43.825050],
  [-121.456478,43.824829],[-121.456478,43.824612],[-121.456477,43.824395],
  [-121.456475,43.824171],[-121.456476,43.823982],[-121.456475,43.823901],
  [-121.456475,43.823820],[-121.456472,43.823125],[-121.451472,43.823139],
  [-121.448575,43.823148],[-121.448138,43.823151],[-121.446472,43.823154],
  [-121.446474,43.823612],[-121.446475,43.823707],[-121.446464,43.825884],
  [-121.446463,43.826080],[-121.446461,43.826404],[-121.446459,43.826575],
  [-121.446459,43.826801],[-121.446459,43.827546],[-121.446456,43.827800],
  [-121.446454,43.827920],[-121.446455,43.828111],[-121.446458,43.828445],
  [-121.446329,43.828512],[-121.446196,43.828620],[-121.446132,43.828791],
  [-121.446084,43.828981],[-121.446078,43.829199],[-121.446075,43.829365],
  [-121.446026,43.829528],[-121.445985,43.829671],[-121.445982,43.829851],
  [-121.445952,43.830011],[-121.446005,43.830118],[-121.446112,43.830176],
  [-121.446271,43.830275],[-121.446345,43.830407],[-121.446333,43.830509],
  [-121.446221,43.830579],[-121.446217,43.830584],[-121.445926,43.830756],
  [-121.445693,43.830867],[-121.445574,43.830923],[-121.445530,43.831150],
  [-121.445961,43.831672],[-121.446259,43.831671],[-121.447178,43.831668],
  [-121.447076,43.832429],[-121.447070,43.832538],[-121.446973,43.833233],
  [-121.446952,43.833357],[-121.446464,43.837054],[-121.446447,43.837177],
  [-121.446377,43.837692],[-121.447797,43.837696],[-121.448575,43.837688],
  [-121.449009,43.837685],[-121.449203,43.837683],[-121.451382,43.837676],
  [-121.451382,43.837646],[-121.451384,43.837568],[-121.451386,43.837350],
  [-121.451390,43.837070],[-121.451393,43.836800],[-121.451396,43.836528],
  [-121.451399,43.836255],[-121.451403,43.835976],[-121.451406,43.835706],
  [-121.451409,43.835442],[-121.451413,43.835170],[-121.451418,43.834869],
  [-121.451420,43.834566],[-121.451425,43.834259],[-121.451427,43.834047],
  [-121.451428,43.833972],[-121.451429,43.833881],[-121.451431,43.833789],
  [-121.451434,43.833528],[-121.451438,43.833250],[-121.451441,43.832978],
  [-121.451447,43.832428],[-121.451455,43.831829],[-121.451458,43.831531],
  [-121.451463,43.831230],[-121.451463,43.831145],[-121.451464,43.831059],
  [-121.451473,43.830418],[-121.451867,43.830424],[-121.452244,43.830421],
  [-121.452619,43.830418],[-121.452992,43.830415],[-121.453381,43.830412],
];

// ─── Vandevert Ranch Phase I (55 vertices) ───────────────────────────────────
const PHASE1_COORDS: [number, number][] = [
  [-121.441496,43.834811],[-121.441497,43.834994],[-121.441440,43.841205],
  [-121.441576,43.841204],[-121.441807,43.841203],[-121.443697,43.841195],
  [-121.444150,43.841193],[-121.445630,43.841187],[-121.445808,43.841186],
  [-121.446033,43.841185],[-121.446462,43.841183],[-121.446531,43.840668],
  [-121.446548,43.840544],[-121.447037,43.836848],[-121.447057,43.836724],
  [-121.447154,43.836029],[-121.447160,43.835919],[-121.447262,43.835159],
  [-121.446343,43.835162],[-121.446046,43.835163],[-121.445615,43.834641],
  [-121.445659,43.834413],[-121.445777,43.834357],[-121.446010,43.834247],
  [-121.446302,43.834075],[-121.446305,43.834069],[-121.446418,43.834000],
  [-121.446526,43.833952],[-121.446541,43.832089],[-121.446543,43.831936],
  [-121.446540,43.831601],[-121.446538,43.831411],[-121.446540,43.831291],
  [-121.446544,43.831037],[-121.446544,43.830292],[-121.446544,43.830066],
  [-121.446545,43.829895],[-121.446548,43.829571],[-121.446548,43.829374],
  [-121.446560,43.827198],[-121.446558,43.827103],[-121.446557,43.826644],
  [-121.444018,43.826652],[-121.443893,43.826654],[-121.443054,43.826660],
  [-121.442868,43.826660],[-121.442076,43.826658],[-121.441873,43.826660],
  [-121.441547,43.826660],[-121.441542,43.827565],[-121.441538,43.828154],
  [-121.441522,43.831030],[-121.441516,43.832340],[-121.441507,43.833955],
  [-121.441496,43.834811],
];

const P2_CANVAS = PHASE2_COORDS.map(([lng, lat]) => toCanvas(lng, lat));
const P1_CANVAS = PHASE1_COORDS.map(([lng, lat]) => toCanvas(lng, lat));

const allCanvas = [...P2_CANVAS, ...P1_CANVAS];
const centroidX = allCanvas.reduce((s, [x]) => s + x, 0) / allCanvas.length;
const centroidY = allCanvas.reduce((s, [, y]) => s + y, 0) / allCanvas.length;

function buildPath(coords: [number, number][]): string {
  return coords
    .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`)
    .join(' ') + ' Z';
}
const PATH2 = buildPath(P2_CANVAS);
const PATH1 = buildPath(P1_CANVAS);

const allXs = allCanvas.map(([x]) => x);
const allYs = allCanvas.map(([, y]) => y);
const bboxW = Math.max(...allXs) - Math.min(...allXs);
const bboxH = Math.max(...allYs) - Math.min(...allYs);
const gradRadius = Math.max(bboxW, bboxH) * 0.65;

function easeFill(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export const OpenSequence: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;

  // ── Timing v9 (matches BoundaryDrawTest exactly) ──────────────────────────
  // 0.0-0.3s: 1892. fades in
  // 0.3-1.5s: 1892. holds
  // 1.5-2.0s: 1892. crossfades to VANDEVERT RANCH
  // 2.0-4.0s: VANDEVERT RANCH holds
  // 3.5-5.5s: boundary glow fades in
  // 4.0-4.7s: VANDEVERT RANCH fades out
  // 5.5-6.2s: REPRESENTED BY RYAN REALTY appears
  // 6.2-7.0s: hold

  const year1892Alpha = interpolate(t, [0, 0.3, 1.5, 2.0], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  const vanchTagAlpha = interpolate(t, [1.6, 2.0, 4.0, 4.7], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  const rawBoundaryProg = interpolate(t, [3.5, 5.5], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const boundaryProg = easeFill(rawBoundaryProg);

  const fillAlphaCenter = boundaryProg * 0.45;
  const fillAlphaEdge = boundaryProg * 0.18;

  const breatheScale = 1 + interpolate(t, [3.5, 7.0], [0, 0.015], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  const subtitleAlpha = interpolate(t, [5.5, 6.2], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ background: '#0a0a08', overflow: 'hidden' }}>

      {/* Satellite tile: 1280x1280 at 1080px wide, centered vertically.
          v5.3: B&W + deeper contrast so the gold boundary glow + line pop. */}
      <div style={{
        position: 'absolute',
        left: 0,
        top: TILE_TOP_OFFSET,
        width: DISPLAY_W,
        height: DISPLAY_W,
        overflow: 'hidden',
      }}>
        <Img
          src={staticFile('images/maps_z15.png')}
          style={{
            width: DISPLAY_W,
            height: DISPLAY_W,
            objectFit: 'cover',
            filter: 'grayscale(1) brightness(0.78) contrast(1.18)',
          }}
        />
      </div>

      {/* Black bars top/bottom */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        height: TILE_TOP_OFFSET, background: '#0a0a08',
      }} />
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        height: TILE_TOP_OFFSET, background: '#0a0a08',
      }} />

      {/* Dark overlay for legibility — v5.3: deeper vignette so gold pops */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'rgba(0,0,0,0.32)',
        pointerEvents: 'none',
      }} />

      {/* SVG boundary overlay */}
      <svg
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: 1080,
          height: 1920,
          overflow: 'visible',
          transformOrigin: `${centroidX.toFixed(2)}px ${centroidY.toFixed(2)}px`,
          transform: `scale(${breatheScale})`,
        }}
        viewBox="0 0 1080 1920"
      >
        <defs>
          <radialGradient
            id="vandevertFillOpen"
            cx={centroidX}
            cy={centroidY}
            r={gradRadius}
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor={GOLD} stopOpacity={fillAlphaCenter} />
            <stop offset="100%" stopColor={GOLD} stopOpacity={fillAlphaEdge} />
          </radialGradient>
          <clipPath id="subdivisionClipOpen">
            <path d={PATH2} />
            <path d={PATH1} />
          </clipPath>
          <filter id="softGlowOpen" x="-25%" y="-25%" width="150%" height="150%">
            <feGaussianBlur stdDeviation="22" />
          </filter>
        </defs>

        <g filter="url(#softGlowOpen)">
          <rect
            x={0} y={0} width={1080} height={1920}
            fill="url(#vandevertFillOpen)"
            clipPath="url(#subdivisionClipOpen)"
          />
        </g>

        {/* v5.3: faint gold stroke lines on the actual boundary so it's a
            visible line, not just a glow. Draws along with the fill via
            stroke-dasharray animation. */}
        <g
          fill="none"
          stroke={GOLD}
          strokeWidth={1.3}
          strokeOpacity={Math.max(0, Math.min(0.85, boundaryProg * 0.95))}
          strokeLinejoin="round"
          strokeLinecap="round"
        >
          <path d={PATH2} />
          <path d={PATH1} />
        </g>
      </svg>

      {/* "1892." cover frame */}
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        opacity: year1892Alpha, pointerEvents: 'none',
      }}>
        <div style={{
          fontFamily: 'Georgia, serif',
          fontSize: 200,
          fontWeight: 700,
          color: GOLD,
          letterSpacing: '0.02em',
          textShadow: '0 4px 40px rgba(0,0,0,0.9), 0 2px 8px rgba(0,0,0,0.95)',
          lineHeight: 1,
        }}>
          1892
        </div>
      </div>

      {/* "VANDEVERT RANCH" hero */}
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        opacity: vanchTagAlpha, pointerEvents: 'none',
      }}>
        <div style={{
          fontFamily: 'Georgia, serif',
          fontSize: 110,
          fontWeight: 700,
          color: GOLD,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          textAlign: 'center',
          textShadow: '0 4px 40px rgba(0,0,0,0.9), 0 2px 8px rgba(0,0,0,0.95)',
          lineHeight: 1.05,
        }}>
          VANDEVERT<br />RANCH
        </div>
      </div>

      {/* "REPRESENTED BY RYAN REALTY" subtitle */}
      <div style={{
        position: 'absolute',
        bottom: 280,
        left: 0, right: 0,
        display: 'flex', justifyContent: 'center',
        opacity: subtitleAlpha, pointerEvents: 'none',
      }}>
        <div style={{
          fontFamily: FONT_SANS || 'Montserrat, sans-serif',
          fontSize: 24,
          fontWeight: 600,
          color: CREAM,
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          textShadow: '0 2px 16px rgba(0,0,0,0.9)',
        }}>
          REPRESENTED BY RYAN REALTY
        </div>
      </div>

      {/* Vignette — v5.3: deeper to cradle the boundary glow */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0) 28%, rgba(0,0,0,0.72) 100%)',
        pointerEvents: 'none',
      }} />
    </AbsoluteFill>
  );
};
