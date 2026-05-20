/**
 * MapRouteVideo — animated polyline route from origin to listing.
 *
 * 30-45s portrait 1080×1920 per CLAUDE.md Video Build Hard Rules.
 *
 * Data flow:
 *   1. Script fetches Google Maps Directions API → polyline-encoded route
 *   2. Script decodes polyline → lat/lng array → normalizes to SVG viewport
 *   3. Props passed as MapRouteInput to this composition
 *
 * Beats:
 *   Ph1  0:00-0:08   Wide static map (city-level) — hook text
 *   Ph2  0:08-0:20   Route reveal — polyline draws in progressively
 *   Ph3  0:20-0:30   Zoom toward destination — map tiles shift
 *   Ph4  0:30-0:37   Destination pin + stats pill (distance / drive time)
 *   Ph5  0:37-0:42   Source citation ("via Google Maps Directions API")
 *
 * Map rendering: Google Static Maps API via <img> with `path=` param.
 *   City map:        zoom 11, size 1080x1920
 *   Route revealed:  zoom 12, path= with encoded polyline
 *   Destination:     zoom 14, markers= for listing pin
 *
 * Caption: single-word Amboqia via SingleWordCaption in portrait safe zone.
 *
 * Safe zones: PORTRAIT_SAFE + CAPTION_PORTRAIT from canonical safe-zones.ts
 */

import React from 'react'
import {
  AbsoluteFill,
  Audio,
  Sequence,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
  staticFile,
  Img,
  spring,
} from 'remotion'
import { SingleWordCaption, CaptionWord } from '../../../video_production_skills/captions/canonical/SingleWordCaption'
import {
  PORTRAIT_SAFE,
  CAPTION_PORTRAIT,
} from '../../../video_production_skills/safe-zones/canonical/safe-zones'

// ── Brand tokens ──────────────────────────────────────────────────────────────
const NAVY = '#102742'
const CREAM = '#faf8f4'
const WHITE = '#FFFFFF'
const FPS = 30
const W = 1080
const H = 1920
const FONT_HEAD = '"Amboqia Boriango", Amboqia, serif'
const FONT_BODY = 'Geist, system-ui, sans-serif'

// ── Easing ────────────────────────────────────────────────────────────────────
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

// ── Sub-components ────────────────────────────────────────────────────────────

/**
 * StaticMapImg — renders a Google Static Maps image.
 * apiKey from props avoids hard-coding it here.
 * Falls back to a navy placeholder when apiKey is empty.
 */
const StaticMapImg: React.FC<{
  apiKey: string
  lat: number
  lng: number
  zoom: number
  width?: number
  height?: number
  pathEncoded?: string
  markerLat?: number
  markerLng?: number
  style?: React.CSSProperties
}> = ({ apiKey, lat, lng, zoom, width = W, height = H, pathEncoded, markerLat, markerLng, style }) => {
  if (!apiKey) {
    return (
      <div
        style={{
          width,
          height,
          background: `${NAVY}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          ...style,
        }}
      >
        <span style={{ color: CREAM, fontFamily: FONT_BODY, fontSize: 40, opacity: 0.5 }}>
          GOOGLE_MAPS_API_KEY not set
        </span>
      </div>
    )
  }

  const base = 'https://maps.googleapis.com/maps/api/staticmap'
  const params = new URLSearchParams({
    center: `${lat},${lng}`,
    zoom: String(zoom),
    size: `${width}x${height}`,
    scale: '1',
    maptype: 'roadmap',
    style: 'feature:all|element:geometry|color:0xf5f5f0',
    key: apiKey,
  })
  if (pathEncoded) {
    params.append('path', `color:0x102742FF|weight:5|enc:${pathEncoded}`)
  }
  if (markerLat !== undefined && markerLng !== undefined) {
    params.append('markers', `color:0x102742|label:•|${markerLat},${markerLng}`)
  }
  const src = `${base}?${params.toString()}`

  return <Img src={src} style={{ width, height, objectFit: 'cover', ...style }} />
}

/**
 * RoutePath — draws the route as an animated SVG polyline over the map.
 * Points are pre-normalized to W×H space by the caller.
 */
const RoutePath: React.FC<{
  points: Array<{ x: number; y: number }>
  progress: number  // 0-1, controls stroke-dashoffset draw-on
}> = ({ points, progress }) => {
  if (points.length < 2) return null

  const d = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ')

  // Approximate path length (sum of segment lengths)
  let totalLen = 0
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x
    const dy = points[i].y - points[i - 1].y
    totalLen += Math.sqrt(dx * dx + dy * dy)
  }

  const dashOffset = totalLen * (1 - easeOutCubic(progress))

  return (
    <svg
      style={{ position: 'absolute', top: 0, left: 0, width: W, height: H }}
      viewBox={`0 0 ${W} ${H}`}
    >
      {/* Shadow path */}
      <path
        d={d}
        fill="none"
        stroke="rgba(0,0,0,0.3)"
        strokeWidth={12}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={totalLen}
        strokeDashoffset={dashOffset}
      />
      {/* Main route line — navy */}
      <path
        d={d}
        fill="none"
        stroke={NAVY}
        strokeWidth={8}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={totalLen}
        strokeDashoffset={dashOffset}
      />
    </svg>
  )
}

/**
 * DestinationPin — animated navy circle pin at the destination point.
 */
const DestinationPin: React.FC<{ x: number; y: number; scale: number }> = ({ x, y, scale }) => {
  const r = 28 * scale
  return (
    <svg
      style={{ position: 'absolute', top: 0, left: 0, width: W, height: H, overflow: 'visible' }}
      viewBox={`0 0 ${W} ${H}`}
    >
      {/* Pulse ring */}
      <circle cx={x} cy={y} r={r * 2.2} fill="none" stroke={NAVY} strokeWidth={3} opacity={0.4 * scale} />
      {/* Pin body */}
      <circle cx={x} cy={y} r={r} fill={NAVY} />
      <circle cx={x} cy={y} r={r * 0.45} fill={CREAM} />
    </svg>
  )
}

/**
 * OriginPin — cream circle at the start point.
 */
const OriginPin: React.FC<{ x: number; y: number }> = ({ x, y }) => (
  <svg
    style={{ position: 'absolute', top: 0, left: 0, width: W, height: H, overflow: 'visible' }}
    viewBox={`0 0 ${W} ${H}`}
  >
    <circle cx={x} cy={y} r={20} fill={CREAM} stroke={NAVY} strokeWidth={4} />
  </svg>
)

/**
 * HookOverlay — "12 min to downtown Bend" hero text on navy pill.
 */
const HookOverlay: React.FC<{
  driveTimeMin: number
  destinationLabel: string
  opacity: number
}> = ({ driveTimeMin, destinationLabel, opacity }) => {
  return (
    <div
      style={{
        position: 'absolute',
        left: PORTRAIT_SAFE.x,
        top: 340,
        width: PORTRAIT_SAFE.width,
        opacity,
      }}
    >
      {/* Drive time hero */}
      <div
        style={{
          fontFamily: FONT_HEAD,
          fontSize: 128,
          color: WHITE,
          textAlign: 'center',
          textShadow: '0 4px 16px rgba(0,0,0,0.85), 0 2px 4px rgba(0,0,0,0.95)',
          lineHeight: 1,
          letterSpacing: '-0.02em',
        }}
      >
        {driveTimeMin} min
      </div>
      {/* Destination label */}
      <div
        style={{
          fontFamily: FONT_BODY,
          fontSize: 52,
          color: WHITE,
          textAlign: 'center',
          textShadow: '0 2px 8px rgba(0,0,0,0.8)',
          marginTop: 20,
          fontWeight: 500,
        }}
      >
        to {destinationLabel}
      </div>
    </div>
  )
}

/**
 * StatsPanel — bottom stats pill showing distance + drive time.
 */
const StatsPanel: React.FC<{
  distanceMi: number
  driveTimeMin: number
  originLabel: string
  destinationLabel: string
  opacity: number
}> = ({ distanceMi, driveTimeMin, originLabel, destinationLabel, opacity }) => {
  return (
    <div
      style={{
        position: 'absolute',
        left: PORTRAIT_SAFE.x,
        top: 900,
        width: PORTRAIT_SAFE.width,
        background: `rgba(16,39,66,0.90)`,
        borderRadius: 22,
        padding: '36px 48px',
        opacity,
      }}
    >
      <div
        style={{
          fontFamily: FONT_HEAD,
          fontSize: 100,
          color: WHITE,
          textAlign: 'center',
          lineHeight: 1,
        }}
      >
        {driveTimeMin} min
      </div>
      <div
        style={{
          fontFamily: FONT_BODY,
          fontSize: 40,
          color: CREAM,
          textAlign: 'center',
          marginTop: 8,
          opacity: 0.85,
        }}
      >
        {distanceMi.toFixed(1)} miles
      </div>
      <div
        style={{
          fontFamily: FONT_BODY,
          fontSize: 34,
          color: CREAM,
          textAlign: 'center',
          marginTop: 16,
          opacity: 0.65,
        }}
      >
        {originLabel} → {destinationLabel}
      </div>
    </div>
  )
}

/**
 * LandmarkPills — named landmarks appear along the route at their map position.
 */
const LandmarkPills: React.FC<{
  landmarks: MapRouteLandmark[]
  routePoints: Array<{ x: number; y: number }>
  opacity: number
}> = ({ landmarks, routePoints, opacity }) => {
  if (!routePoints.length || !landmarks.length) return null

  return (
    <>
      {landmarks.map((lm, i) => {
        // Place pill offset from the route midpoint; simple placement strategy
        const midIdx = Math.floor(routePoints.length * (i + 1) / (landmarks.length + 1))
        const pt = routePoints[midIdx] || routePoints[routePoints.length - 1]
        const offsetX = i % 2 === 0 ? 40 : -240
        const offsetY = -60

        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: pt.x + offsetX,
              top: pt.y + offsetY,
              background: `rgba(16,39,66,0.80)`,
              borderRadius: 14,
              padding: '8px 20px',
              opacity,
              pointerEvents: 'none',
            }}
          >
            <span
              style={{
                fontFamily: FONT_BODY,
                fontSize: 28,
                color: WHITE,
                fontWeight: 500,
                whiteSpace: 'nowrap',
              }}
            >
              {lm.name}
            </span>
          </div>
        )
      })}
    </>
  )
}

/**
 * SourceCitation — "Via Google Maps Directions API" at the bottom.
 */
const SourceCitation: React.FC<{ opacity: number }> = ({ opacity }) => (
  <div
    style={{
      position: 'absolute',
      bottom: 440,
      left: PORTRAIT_SAFE.x,
      width: PORTRAIT_SAFE.width,
      textAlign: 'center',
      opacity,
    }}
  >
    <span
      style={{
        fontFamily: FONT_BODY,
        fontSize: 28,
        color: CREAM,
        background: `rgba(16,39,66,0.70)`,
        borderRadius: 10,
        padding: '6px 20px',
      }}
    >
      Via Google Maps Directions API
    </span>
  </div>
)

// ── Types ─────────────────────────────────────────────────────────────────────

export type MapRouteLandmark = {
  name: string
  /** Position along route 0-1 */
  routeProgress?: number
}

/**
 * Route point normalized to 0-1 in the map viewport.
 * The build script decodes the Google polyline and normalizes to this range.
 * (0,0) = top-left of the displayed map, (1,1) = bottom-right.
 */
export type NormalizedPoint = { nx: number; ny: number }

export type MapRouteInput = {
  /** Google Maps API key — read from NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in .env.local */
  apiKey: string

  /** Origin coords (e.g. downtown Bend) */
  originLat: number
  originLng: number
  originLabel: string

  /** Destination coords (the listing) */
  destLat: number
  destLng: number
  destinationLabel: string

  /** Drive time in minutes (from Directions API duration field) */
  driveTimeMin: number
  /** Route distance in miles */
  distanceMi: number

  /** Google polyline-encoded route string from Directions API overview_polyline.points */
  polylineEncoded: string

  /**
   * Route points normalized to the W×H map viewport.
   * Generated by the build script: decode polyline → project to pixel coords
   * at the zoom/center used for the map render → normalize by W and H.
   * E.g. { nx: 0.48, ny: 0.52 } = near center of the 1080×1920 map tile.
   */
  routePointsNormalized: NormalizedPoint[]

  /** Named landmarks that appear as pills along the route */
  landmarks?: MapRouteLandmark[]

  /** Word-level caption data from ElevenLabs forced alignment */
  captionWords: CaptionWord[]

  /** Path to VO mp3 relative to public/ */
  voPath?: string

  /** Map center zoom levels for each phase */
  cityZoom?: number      // default 11
  routeZoom?: number     // default 12
  destZoom?: number      // default 14

  /** Total video duration in seconds (30-45). Default 42. */
  durationSec?: number
}

// ── Composition ───────────────────────────────────────────────────────────────

// Phase durations (seconds)
const PH1_SEC = 8   // Wide city map + hook text
const PH2_SEC = 12  // Route reveal
const PH3_SEC = 10  // Zoom toward destination
const PH4_SEC = 7   // Destination pin + stats
const PH5_SEC = 5   // Citation fade-out

const toF = (s: number) => Math.round(s * FPS)

export const MapRouteVideo: React.FC<MapRouteInput> = (input) => {
  const {
    apiKey,
    originLat, originLng, originLabel,
    destLat, destLng, destinationLabel,
    driveTimeMin, distanceMi,
    polylineEncoded,
    routePointsNormalized,
    landmarks = [],
    captionWords,
    voPath,
    cityZoom = 11,
    routeZoom = 12,
    destZoom = 14,
    durationSec = 42,
  } = input

  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  // Pixel-space route points
  const routePoints = routePointsNormalized.map(p => ({
    x: p.nx * W,
    y: p.ny * H,
  }))

  // Origin and destination pixels
  const originPx = routePoints[0] || { x: W / 2, y: H * 0.6 }
  const destPx = routePoints[routePoints.length - 1] || { x: W / 2, y: H * 0.4 }

  // Phase frame boundaries
  const ph1End = toF(PH1_SEC)
  const ph2End = ph1End + toF(PH2_SEC)
  const ph3End = ph2End + toF(PH3_SEC)
  const ph4End = ph3End + toF(PH4_SEC)

  // Ph2: route draw progress
  const routeProgress = frame < ph1End
    ? 0
    : frame > ph2End
    ? 1
    : easeOutCubic((frame - ph1End) / toF(PH2_SEC))

  // Ph4: destination pin scale spring
  const pinScale = frame >= ph3End
    ? spring({ frame: frame - ph3End, fps, config: { stiffness: 80, damping: 14 } })
    : 0

  // Hook overlay opacity (Ph1 + Ph2)
  const hookOpacity = frame < toF(4)
    ? interpolate(frame, [0, toF(2)], [0, 1])
    : frame > ph2End
    ? interpolate(frame, [ph2End, ph2End + toF(2)], [1, 0])
    : 1

  // Stats panel opacity (Ph4)
  const statsOpacity = frame >= ph3End
    ? interpolate(frame, [ph3End, ph3End + toF(2)], [0, 1])
    : 0

  // Citation opacity (Ph5)
  const citationOpacity = frame >= ph4End
    ? interpolate(frame, [ph4End, ph4End + toF(2)], [0, 1])
    : 0

  // Landmark pills opacity (Ph2+)
  const landmarkOpacity = routeProgress > 0.7
    ? interpolate(routeProgress, [0.7, 1], [0, 1])
    : 0

  // Map zoom level: transitions Ph3 → Ph4
  const activeZoom = frame >= ph3End ? destZoom : frame >= ph1End ? routeZoom : cityZoom
  const mapCenterLat = frame >= ph3End ? destLat : (originLat + destLat) / 2
  const mapCenterLng = frame >= ph3End ? destLng : (originLng + destLng) / 2

  return (
    <AbsoluteFill style={{ background: NAVY }}>
      {/* VO */}
      {voPath ? <Audio src={staticFile(voPath)} /> : null}

      {/* Map tile layer */}
      <StaticMapImg
        apiKey={apiKey}
        lat={mapCenterLat}
        lng={mapCenterLng}
        zoom={activeZoom}
        pathEncoded={routeProgress > 0.05 ? polylineEncoded : undefined}
        markerLat={pinScale > 0.5 ? destLat : undefined}
        markerLng={pinScale > 0.5 ? destLng : undefined}
        style={{ position: 'absolute', top: 0, left: 0 }}
      />

      {/* Scrim — light navy overlay to ensure text legibility */}
      <div
        style={{
          position: 'absolute',
          top: 0, left: 0, width: W, height: H,
          background: 'rgba(16,39,66,0.18)',
          pointerEvents: 'none',
        }}
      />

      {/* Route SVG polyline draw-on animation */}
      <RoutePath points={routePoints} progress={routeProgress} />

      {/* Origin pin */}
      {routeProgress > 0.1 && <OriginPin x={originPx.x} y={originPx.y} />}

      {/* Destination pin (springs in at Ph4) */}
      {pinScale > 0 && <DestinationPin x={destPx.x} y={destPx.y} scale={pinScale} />}

      {/* Landmark pills along route */}
      <LandmarkPills
        landmarks={landmarks}
        routePoints={routePoints}
        opacity={landmarkOpacity}
      />

      {/* Hook text (Ph1-Ph2) */}
      <HookOverlay
        driveTimeMin={driveTimeMin}
        destinationLabel={destinationLabel}
        opacity={hookOpacity}
      />

      {/* Stats panel (Ph4) */}
      {statsOpacity > 0 && (
        <StatsPanel
          distanceMi={distanceMi}
          driveTimeMin={driveTimeMin}
          originLabel={originLabel}
          destinationLabel={destinationLabel}
          opacity={statsOpacity}
        />
      )}

      {/* Source citation (Ph5) */}
      {citationOpacity > 0 && <SourceCitation opacity={citationOpacity} />}

      {/* Single-word Amboqia captions */}
      <SingleWordCaption
        words={captionWords}
        suppressBeforeSec={2.0}
        centerY={CAPTION_PORTRAIT.centerY}
        fontSizePx={CAPTION_PORTRAIT.fontSizePx}
        maxWidthPx={CAPTION_PORTRAIT.maxWidthPx}
      />
    </AbsoluteFill>
  )
}
