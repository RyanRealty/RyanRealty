// BoundaryDrawTest.tsx — Gate 3 boundary draw test clip
// 6s, 1080x1920. Shows satellite tile + animated SVG parcel polygon.
// Cover frame text (2.5s) → dissolve → boundary draw (2.5-6s) → subtitle at 5s.
//
// Parcel: Taxlot 201117C001000 at 56111 School House Rd, Vandevert Ranch
// Source: Deschutes County GIS, maps.deschutes.org/arcgis/rest/services/OpenData/LandFD/MapServer/2
// Queried 2026-04-24 via spatial intersect at lat=43.8383243, lng=-121.4428004

import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig, Img, staticFile } from 'remotion';
import { easeOutCubic } from './easing';
import { CREAM, FONT_SANS } from './brand';

// ─── Projection helpers ───────────────────────────────────────────────────────
// maps_z14.png is 1280x1280, displayed at 1080px wide in the SVG coordinate space.
// Display scale: 1080/1280 = 0.84375
// Tile center is at the property lat/lng (same as AerialMap origin in AerialMap.tsx)
// We project lng/lat → tile pixel → display pixel.

const MAP_CENTER_LNG = -121.4428004;
const MAP_CENTER_LAT = 43.8383243;
const MAP_ZOOM = 14;
const TILE_SIZE = 256;
const TILE_PX = 1280;    // physical resolution of maps_z14.png
const DISPLAY_W = 1080;  // displayed width in canvas
const TILE_DISPLAY_SCALE = DISPLAY_W / TILE_PX; // 0.84375

function lngToX(lng: number): number {
  return (lng + 180) / 360;
}

function latToY(lat: number): number {
  const sinLat = Math.sin((lat * Math.PI) / 180);
  return 0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI);
}

// Returns [displayX, displayY] in canvas pixels (0,0 = top-left of 1080px-wide tile display)
function toDisplay(lng: number, lat: number): [number, number] {
  const scale = TILE_SIZE * Math.pow(2, MAP_ZOOM);
  const cx = lngToX(MAP_CENTER_LNG) * scale;
  const cy = latToY(MAP_CENTER_LAT) * scale;
  const tilePx = lngToX(lng) * scale - cx + TILE_PX / 2;
  const tilePy = latToY(lat) * scale - cy + TILE_PX / 2;
  // Convert tile pixels to display pixels
  return [tilePx * TILE_DISPLAY_SCALE, tilePy * TILE_DISPLAY_SCALE];
}

// ─── Parcel coordinates (GeoJSON outer ring, 98 vertices) ─────────────────────
// Source: Deschutes County GIS taxlots, taxlot 201117C001000
// Retrieved 2026-04-24 via REST query with spatial intersect at property lat/lng
const RAW_COORDS: [number, number][] = [
  [-121.44226757,43.83796437],[-121.44226607,43.83797067],[-121.44226481,43.83797608],
  [-121.44226359,43.83798149],[-121.44226240,43.83798691],[-121.44226123,43.83799233],
  [-121.44226010,43.83799776],[-121.44225900,43.83800318],[-121.44225793,43.83800862],
  [-121.44225689,43.83801405],[-121.44225589,43.83801949],[-121.44225491,43.83802493],
  [-121.44225397,43.83803037],[-121.44225305,43.83803582],[-121.44225217,43.83804127],
  [-121.44225132,43.83804672],[-121.44225051,43.83805218],[-121.44224972,43.83805763],
  [-121.44224896,43.83806309],[-121.44224824,43.83806855],[-121.44224755,43.83807402],
  [-121.44224688,43.83807948],[-121.44224626,43.83808495],[-121.44224566,43.83809042],
  [-121.44224509,43.83809589],[-121.44224456,43.83810137],[-121.44224405,43.83810684],
  [-121.44224358,43.83811232],[-121.44224314,43.83811779],[-121.44224273,43.83812327],
  [-121.44224235,43.83812875],[-121.44224201,43.83813423],[-121.44224169,43.83813972],
  [-121.44224141,43.83814520],[-121.44224116,43.83815068],[-121.44224094,43.83815617],
  [-121.44224075,43.83816165],[-121.44224060,43.83816714],[-121.44224047,43.83817262],
  [-121.44224038,43.83817811],[-121.44224032,43.83818360],[-121.44224029,43.83818908],
  [-121.44224029,43.83819457],[-121.44224032,43.83820006],[-121.44224039,43.83820554],
  [-121.44224048,43.83821103],[-121.44224061,43.83821652],[-121.44224077,43.83822200],
  [-121.44224096,43.83822749],[-121.44224118,43.83823297],[-121.44224144,43.83823845],
  [-121.44224172,43.83824394],[-121.44224204,43.83824942],[-121.44224239,43.83825490],
  [-121.44224277,43.83826038],[-121.44224318,43.83826586],[-121.44224363,43.83827133],
  [-121.44224410,43.83827681],[-121.44224461,43.83828228],[-121.44224515,43.83828776],
  [-121.44224572,43.83829323],[-121.44224632,43.83829870],[-121.44224695,43.83830417],
  [-121.44224762,43.83830963],[-121.44224831,43.83831509],[-121.44224904,43.83832056],
  [-121.44224980,43.83832602],[-121.44225059,43.83833147],[-121.44225141,43.83833693],
  [-121.44225226,43.83834238],[-121.44225315,43.83834783],[-121.44225406,43.83835327],
  [-121.44225501,43.83835872],[-121.44225599,43.83836416],[-121.44225700,43.83836960],
  [-121.44225804,43.83837503],[-121.44225911,43.83838046],[-121.44230116,43.83858953],
  [-121.44230256,43.83859727],[-121.44230335,43.83860273],[-121.44230397,43.83860820],
  [-121.44230443,43.83861367],[-121.44230473,43.83861916],[-121.44230486,43.83862464],
  [-121.44230483,43.83863013],[-121.44230463,43.83863561],[-121.44230427,43.83864109],
  [-121.44230375,43.83864657],[-121.44230307,43.83865203],[-121.44230222,43.83865748],
  [-121.44230121,43.83866292],[-121.44230003,43.83866834],[-121.44229870,43.83867374],
  [-121.44229720,43.83867912],[-121.44305338,43.83874191],[-121.44316818,43.83808943],
  [-121.44233053,43.83770250],[-121.44226757,43.83796437]
];

// Project all coords to display pixels
const DISPLAY_COORDS = RAW_COORDS.map(([lng, lat]) => toDisplay(lng, lat));

// Build SVG path in display pixel space (SVG coordinate space = display pixels)
function buildPath(coords: [number, number][]): string {
  return coords
    .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`)
    .join(' ') + ' Z';
}

const PATH_D = buildPath(DISPLAY_COORDS);

// Parcel bounding box in display pixels
const XS = DISPLAY_COORDS.map(([x]) => x);
const YS = DISPLAY_COORDS.map(([, y]) => y);
const MIN_X = Math.min(...XS);
const MAX_X = Math.max(...XS);
const MIN_Y = Math.min(...YS);
const MAX_Y = Math.max(...YS);
const PARCEL_W = MAX_X - MIN_X; // ~8.9px
const PARCEL_H = MAX_Y - MIN_Y; // ~14.2px

// To make the parcel visible we render the SVG at 1080x1920 using the full canvas
// coordinate space, then use CSS transform to scale/center the parcel region.
// Strategy: render SVG at canvas size (1080x1920), use a viewBox that zooms in ~30x
// on the parcel center, so the 8x14px parcel becomes ~240x420px on screen.

const VIEW_MARGIN_PX = 8; // margin around parcel in display pixels
const VIEW_SIZE = Math.max(PARCEL_W, PARCEL_H) + VIEW_MARGIN_PX * 2; // ~30px view
const VIEW_CX = (MIN_X + MAX_X) / 2;
const VIEW_CY = (MIN_Y + MAX_Y) / 2;
// The tile image is displayed centered in 1080x1920 (vertically centered = 1920/2=960 midpoint)
// The tile itself is 1080x1080 starting at y=420 (since (1920-1080)/2 = 420)
// Wait — we're using scaleY(1.778) to fill height, so it's a transform, not an offset.
// Simpler: both the Img and SVG use the same 1080-wide coordinate space.
// The SVG viewBox centers on the parcel coords. The tile occupies y=(1920-1080)/2 to y=(1920+1080)/2
// But we're scaling the tile to fill 1920 height via scaleY transform.
// For the SVG overlay, we need to account for the fact that the parcel y-coord
// refers to the tile coordinate system where the tile center is at (540, 540) in display px,
// which corresponds to y=(1920-1080*TILE_DISPLAY_SCALE... actually the tile is displayed at
// width=1080, height=1080 displayed, centered in the 1920-tall canvas.
// Center of displayed tile in 1920px canvas = (1920-1080)/2 = 420px from top.
// So parcel Y in canvas = MIN_Y + 420 (approximately), but scaleY(1.778) applies to tile display.
// For simplicity: use the SVG with overflow=visible at the same 1080-wide space,
// and shift the SVG vertically to account for the tile vertical centering offset.

const TILE_TOP_OFFSET = (1920 - 1080) / 2; // 420px — tile top in 1920 canvas
const VIEW_CY_CANVAS = VIEW_CY + TILE_TOP_OFFSET; // parcel center in full 1920 canvas

// SVG viewBox in canvas coordinate space (1080 wide, 1920 tall)
// We zoom to the parcel region using a small viewBox
const VB_X = VIEW_CX - VIEW_SIZE / 2;
const VB_Y = VIEW_CY_CANVAS - VIEW_SIZE / 2;

// PATH_D uses tile display coords (y=0 at tile top). Offset path to canvas space.
function buildPathOffset(coords: [number, number][], yOffset: number): string {
  return coords
    .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${(y + yOffset).toFixed(2)}`)
    .join(' ') + ' Z';
}
const PATH_D_CANVAS = buildPathOffset(DISPLAY_COORDS, TILE_TOP_OFFSET);

// Approx path length in the ZOOMED SVG coordinate system
// At VIEW_SIZE~30px displayed at 1080 SVG pixels, scale factor = 1080/VIEW_SIZE = ~36
// Path perimeter in display coords ≈ 2*(PARCEL_W+PARCEL_H) ≈ 46px
// In SVG display units = 46 * (1080/VIEW_SIZE... but SVG path uses raw coords.
// strokeDasharray must match the path in raw SVG coordinate units (display pixels).
// Estimated perimeter in display pixels:
const PERIMETER_DISPLAY_PX = 2 * (PARCEL_W + PARCEL_H) * 1.3; // rough estimate with shape factor

export const BoundaryDrawTest: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;

  // Phase 1: cover frame (0-2.5s) — text visible, full opacity
  // Phase 2: text dissolves (2.0-2.8s)
  // Phase 3: boundary draws (2.5-6.0s, 3.5s draw)
  // Phase 4: subtitle appears at 5.0s

  const textAlpha = interpolate(t, [2.0, 2.8], [1, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  const pathAlpha = interpolate(t, [2.3, 2.8], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  const drawProgress = interpolate(t, [2.5, 6.0], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const drawEased = easeOutCubic(drawProgress);
  const strokeDashoffset = PERIMETER_DISPLAY_PX * (1 - drawEased);

  const subtitleAlpha = interpolate(t, [5.0, 5.6], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // Stroke width in display pixels — 2px will be visible at zoomed viewBox
  const STROKE_W = 0.6; // display px — maps_z14 parcel is ~8x14 display px

  return (
    <AbsoluteFill style={{ background: '#0a0a08', overflow: 'hidden' }}>

      {/* ── Satellite tile: 1280x1280 displayed at 1080x1080, centered in 1920 frame ── */}
      <div style={{
        position: 'absolute',
        left: 0,
        top: TILE_TOP_OFFSET,
        width: DISPLAY_W,
        height: DISPLAY_W,
        overflow: 'hidden',
      }}>
        <Img
          src={staticFile('images/maps_z14.png')}
          style={{
            width: DISPLAY_W,
            height: DISPLAY_W,
            objectFit: 'cover',
            filter: 'sepia(0.05) saturate(1.08) brightness(0.96) contrast(1.06) hue-rotate(-3deg)',
          }}
        />
      </div>

      {/* ── Black bars (above/below satellite tile) ── */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        height: TILE_TOP_OFFSET, background: '#0a0a08',
      }} />
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        height: TILE_TOP_OFFSET, background: '#0a0a08',
      }} />

      {/* ── Dark overlay for legibility ── */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'rgba(0,0,0,0.25)',
        pointerEvents: 'none',
      }} />

      {/* ── SVG parcel boundary overlay (full canvas, viewBox zooms to parcel) ── */}
      <svg
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: 1080,
          height: 1920,
          opacity: pathAlpha,
          overflow: 'visible',
        }}
        viewBox={`${VB_X} ${VB_Y} ${VIEW_SIZE} ${VIEW_SIZE}`}
      >
        <defs>
          <filter id="goldGlow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation={STROKE_W * 2.5} result="blur" />
            <feFlood floodColor="#C8A864" floodOpacity="0.7" result="color" />
            <feComposite in="color" in2="blur" operator="in" result="glow" />
            <feMerge>
              <feMergeNode in="glow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Glow pass */}
        <path
          d={PATH_D_CANVAS}
          fill="none"
          stroke="#C8A864"
          strokeWidth={STROKE_W * 3}
          strokeOpacity={0.4}
          strokeLinecap="round"
          strokeLinejoin="round"
          filter="url(#goldGlow)"
        />

        {/* Animated draw pass */}
        <path
          d={PATH_D_CANVAS}
          fill="rgba(200,168,100,0.05)"
          stroke="#C8A864"
          strokeWidth={STROKE_W}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={PERIMETER_DISPLAY_PX}
          strokeDashoffset={strokeDashoffset}
        />
      </svg>

      {/* ── Cover frame text: "1892." (Option A hook, Gate 3 placeholder) ── */}
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        opacity: textAlpha, pointerEvents: 'none',
      }}>
        <div style={{
          fontFamily: 'Georgia, serif',
          fontSize: 200,
          fontWeight: 700,
          color: '#C8A864',
          letterSpacing: '0.02em',
          textShadow: '0 4px 40px rgba(0,0,0,0.9), 0 2px 8px rgba(0,0,0,0.95)',
          lineHeight: 1,
        }}>
          1892.
        </div>
      </div>

      {/* ── Subtitle: VANDEVERT RANCH (appears at 5s) ── */}
      <div style={{
        position: 'absolute',
        bottom: 280,
        left: 0, right: 0,
        display: 'flex', justifyContent: 'center',
        opacity: subtitleAlpha, pointerEvents: 'none',
      }}>
        <div style={{
          fontFamily: FONT_SANS || 'Montserrat, sans-serif',
          fontSize: 36,
          fontWeight: 600,
          color: CREAM,
          letterSpacing: '0.25em',
          textTransform: 'uppercase',
          textShadow: '0 2px 16px rgba(0,0,0,0.9)',
        }}>
          VANDEVERT RANCH
        </div>
      </div>

      {/* ── Vignette ── */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0) 40%, rgba(0,0,0,0.55) 100%)',
        pointerEvents: 'none',
      }} />
    </AbsoluteFill>
  );
};
