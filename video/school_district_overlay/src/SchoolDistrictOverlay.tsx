/**
 * SchoolDistrictOverlay — animated school district boundary + school markers.
 *
 * 30-45s portrait 1080×1920. Per CLAUDE.md Video Build Hard Rules.
 *
 * Data flow:
 *   build script fetches/caches ODE GeoJSON → normalizes boundary polygons +
 *   school lat/lng → passes as SchoolDistrictInput props.
 *
 * Beats:
 *   Ph1  0:00-0:08   Wide map + district name hook
 *   Ph2  0:08-0:22   District boundary draws in (animated polygon)
 *   Ph3  0:22-0:32   School markers appear one by one
 *   Ph4  0:32-0:40   SUBJECT listing pin + stats (schools within 1 mile)
 *   Ph5  0:40-0:44   Source citation
 *
 * Map tiles: Google Static Maps API (gray roadmap base).
 * District boundary: SVG polygon animated via clip-path / stroke-dashoffset.
 * School markers: navy circles with name pills.
 * Subject property: cream circle with "SUBJECT" label.
 *
 * Safe zones: PORTRAIT_SAFE + CAPTION_PORTRAIT from canonical safe-zones.ts.
 *
 * Data source dependency:
 *   Oregon Department of Education school district boundaries:
 *   https://www.oregon.gov/ode/schools-and-districts/Pages/Data.aspx
 *   Cached to data/school-districts/<district-slug>.geojson
 *   If GeoJSON is not available, placeholder renders with a note.
 */

import React from 'react'
import {
  AbsoluteFill,
  Audio,
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

// ── Sub-components ────────────────────────────────────────────────────────────

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

/**
 * StaticMapBase — Google Static Maps tile, or navy placeholder.
 */
const StaticMapBase: React.FC<{
  apiKey: string
  lat: number
  lng: number
  zoom: number
  style?: React.CSSProperties
}> = ({ apiKey, lat, lng, zoom, style }) => {
  if (!apiKey) {
    return (
      <div
        style={{
          position: 'absolute', top: 0, left: 0, width: W, height: H,
          background: '#e8e4dc',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          ...style,
        }}
      >
        <div
          style={{
            background: '#d4d0c8',
            width: W - 120, height: H - 400,
            borderRadius: 12,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <span style={{ fontFamily: FONT_BODY, fontSize: 36, color: '#888', textAlign: 'center' }}>
            Map (GOOGLE_MAPS_API_KEY not set)
          </span>
        </div>
      </div>
    )
  }
  const params = new URLSearchParams({
    center: `${lat},${lng}`,
    zoom: String(zoom),
    size: `${W}x${H}`,
    scale: '1',
    maptype: 'roadmap',
    key: apiKey,
  })
  const src = `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`
  return (
    <Img
      src={src}
      style={{ position: 'absolute', top: 0, left: 0, width: W, height: H, objectFit: 'cover', ...style }}
    />
  )
}

/**
 * DistrictBoundary — animated SVG polygon for school district boundary.
 * Uses stroke-dashoffset to draw the boundary perimeter progressively.
 */
const DistrictBoundary: React.FC<{
  points: Array<{ x: number; y: number }>
  progress: number  // 0-1
  districtName: string
}> = ({ points, progress, districtName }) => {
  if (points.length < 3) return null

  const pathData = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ') + ' Z'

  // Approximate perimeter length
  let totalLen = 0
  for (let i = 0; i < points.length; i++) {
    const next = points[(i + 1) % points.length]
    const dx = next.x - points[i].x
    const dy = next.y - points[i].y
    totalLen += Math.sqrt(dx * dx + dy * dy)
  }

  const dashOffset = totalLen * (1 - easeOutCubic(progress))

  return (
    <svg
      style={{ position: 'absolute', top: 0, left: 0, width: W, height: H }}
      viewBox={`0 0 ${W} ${H}`}
    >
      {/* Fill — very translucent navy */}
      <path
        d={pathData}
        fill={`rgba(16,39,66,${0.12 * progress})`}
      />
      {/* Boundary stroke — draws in */}
      <path
        d={pathData}
        fill="none"
        stroke={NAVY}
        strokeWidth={6}
        strokeLinejoin="round"
        strokeDasharray={totalLen}
        strokeDashoffset={dashOffset}
        opacity={0.9}
      />
      {/* Dashed inner border — same animation */}
      <path
        d={pathData}
        fill="none"
        stroke={CREAM}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeDasharray="16 10"
        opacity={0.5 * easeOutCubic(progress)}
      />
    </svg>
  )
}

/**
 * SchoolMarker — animated navy circle + name pill for each school.
 */
const SchoolMarker: React.FC<{
  x: number
  y: number
  name: string
  rating?: number
  delay: number  // frame offset for entrance spring
  scale: number  // 0-1 from spring
  labelSide?: 'left' | 'right'
}> = ({ x, y, name, rating, scale, labelSide = 'right' }) => {
  if (scale < 0.01) return null
  const r = 22 * scale
  const pillOffset = labelSide === 'right' ? r + 12 : -(name.length * 14 + 24 + r + 12)

  return (
    <svg
      style={{ position: 'absolute', top: 0, left: 0, width: W, height: H, overflow: 'visible' }}
      viewBox={`0 0 ${W} ${H}`}
    >
      {/* Marker circle */}
      <circle cx={x} cy={y} r={r} fill={NAVY} opacity={0.95} />
      <text
        x={x} y={y + 8}
        textAnchor="middle"
        fontSize={16 * scale}
        fill={CREAM}
        fontFamily={FONT_BODY}
        fontWeight="600"
      >
        ★
      </text>

      {/* Name pill background */}
      <rect
        x={x + pillOffset}
        y={y - 20}
        width={name.length * 13 + 24}
        height={40}
        rx={10}
        fill={`rgba(16,39,66,0.85)`}
        opacity={scale}
      />
      {/* Name text */}
      <text
        x={x + pillOffset + 12}
        y={y + 6}
        fontSize={22}
        fill={WHITE}
        fontFamily={FONT_BODY}
        fontWeight="500"
        opacity={scale}
      >
        {name}
        {rating !== undefined ? `  ${rating.toFixed(1)}` : ''}
      </text>
    </svg>
  )
}

/**
 * SubjectPin — highlighted listing marker.
 */
const SubjectPin: React.FC<{
  x: number
  y: number
  scale: number
}> = ({ x, y, scale }) => {
  if (scale < 0.01) return null
  const r = 30 * scale
  return (
    <svg
      style={{ position: 'absolute', top: 0, left: 0, width: W, height: H, overflow: 'visible' }}
      viewBox={`0 0 ${W} ${H}`}
    >
      {/* Pulse ring */}
      <circle cx={x} cy={y} r={r * 2.5} fill="none" stroke={CREAM} strokeWidth={3} opacity={0.4 * scale} />
      <circle cx={x} cy={y} r={r * 1.6} fill="none" stroke={CREAM} strokeWidth={2} opacity={0.3 * scale} />
      {/* Pin */}
      <circle cx={x} cy={y} r={r} fill={CREAM} stroke={NAVY} strokeWidth={4} />
      <text
        x={x} y={y + 8}
        textAnchor="middle"
        fontSize={18 * scale}
        fill={NAVY}
        fontFamily={FONT_BODY}
        fontWeight="700"
      >
        S
      </text>
    </svg>
  )
}

/**
 * HookOverlay — district name + "schools nearby" text.
 */
const HookOverlay: React.FC<{
  districtName: string
  schoolCount: number
  opacity: number
}> = ({ districtName, schoolCount, opacity }) => (
  <div
    style={{
      position: 'absolute',
      left: PORTRAIT_SAFE.x,
      top: 320,
      width: PORTRAIT_SAFE.width,
      opacity,
    }}
  >
    <div
      style={{
        fontFamily: FONT_BODY,
        fontSize: 36,
        color: WHITE,
        textAlign: 'center',
        textShadow: '0 2px 8px rgba(0,0,0,0.8)',
        fontWeight: 500,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
      }}
    >
      School District
    </div>
    <div
      style={{
        fontFamily: FONT_HEAD,
        fontSize: 96,
        color: WHITE,
        textAlign: 'center',
        textShadow: '0 4px 16px rgba(0,0,0,0.85), 0 2px 4px rgba(0,0,0,0.95)',
        lineHeight: 1.1,
        marginTop: 8,
      }}
    >
      {districtName}
    </div>
    <div
      style={{
        fontFamily: FONT_BODY,
        fontSize: 48,
        color: CREAM,
        textAlign: 'center',
        textShadow: '0 2px 8px rgba(0,0,0,0.8)',
        marginTop: 16,
        fontWeight: 500,
      }}
    >
      {schoolCount} school{schoolCount !== 1 ? 's' : ''} nearby
    </div>
  </div>
)

/**
 * StatsPanel — summary stats at bottom of frame.
 */
const StatsPanel: React.FC<{
  districtName: string
  schoolCount: number
  nearbyCount: number
  opacity: number
}> = ({ districtName, schoolCount, nearbyCount, opacity }) => (
  <div
    style={{
      position: 'absolute',
      left: PORTRAIT_SAFE.x,
      top: 900,
      width: PORTRAIT_SAFE.width,
      background: 'rgba(16,39,66,0.90)',
      borderRadius: 22,
      padding: '32px 44px',
      opacity,
    }}
  >
    <div
      style={{
        fontFamily: FONT_HEAD,
        fontSize: 72,
        color: WHITE,
        textAlign: 'center',
        lineHeight: 1,
      }}
    >
      {districtName}
    </div>
    <div
      style={{
        fontFamily: FONT_BODY,
        fontSize: 38,
        color: CREAM,
        textAlign: 'center',
        marginTop: 10,
        opacity: 0.85,
      }}
    >
      {schoolCount} total schools in district
    </div>
    <div
      style={{
        fontFamily: FONT_BODY,
        fontSize: 34,
        color: CREAM,
        textAlign: 'center',
        marginTop: 8,
        opacity: 0.65,
      }}
    >
      {nearbyCount} within 1 mile of this property
    </div>
  </div>
)

/**
 * DataPlaceholder — shown when school district GeoJSON is not yet available.
 * Per spec: ship placeholder with clear data source note rather than blocking.
 */
const DataPlaceholder: React.FC<{ opacity: number }> = ({ opacity }) => (
  <div
    style={{
      position: 'absolute',
      left: PORTRAIT_SAFE.x,
      top: 600,
      width: PORTRAIT_SAFE.width,
      background: 'rgba(16,39,66,0.85)',
      borderRadius: 18,
      padding: '40px 48px',
      opacity,
      textAlign: 'center',
    }}
  >
    <div style={{ fontFamily: FONT_HEAD, fontSize: 64, color: WHITE, lineHeight: 1.1 }}>
      School District
    </div>
    <div style={{ fontFamily: FONT_HEAD, fontSize: 80, color: CREAM, marginTop: 16 }}>
      Deschutes County
    </div>
    <div
      style={{
        fontFamily: FONT_BODY,
        fontSize: 32,
        color: CREAM,
        marginTop: 24,
        opacity: 0.8,
        lineHeight: 1.5,
      }}
    >
      School district boundary data source pending.
    </div>
    <div
      style={{
        fontFamily: FONT_BODY,
        fontSize: 26,
        color: CREAM,
        marginTop: 12,
        opacity: 0.6,
      }}
    >
      Source: Oregon Dept of Education GeoJSON feed
    </div>
    <div
      style={{
        fontFamily: FONT_BODY,
        fontSize: 24,
        color: CREAM,
        marginTop: 8,
        opacity: 0.5,
      }}
    >
      Cache: data/school-districts/
    </div>
  </div>
)

// ── Types ─────────────────────────────────────────────────────────────────────

export type SchoolLocation = {
  name: string
  lat: number
  lng: number
  /** GreatSchools or NCES rating, 1-10, if available from a public API */
  rating?: number
  type?: 'elementary' | 'middle' | 'high' | 'other'
}

/** Boundary vertex normalized to map viewport 0-1 */
export type BoundaryPoint = { nx: number; ny: number }

export type SchoolDistrictInput = {
  apiKey: string

  /** Map center for the district view */
  centerLat: number
  centerLng: number
  mapZoom?: number  // default 12

  /** Name of the school district */
  districtName: string

  /** Boundary polygon vertices (normalized to 0-1 viewport) */
  boundaryPoints: BoundaryPoint[]

  /** Whether authoritative GeoJSON was available (false = show placeholder) */
  boundaryDataAvailable: boolean

  /** School locations (normalized to viewport after build script) */
  schools: Array<SchoolLocation & { nx: number; ny: number }>

  /** Subject listing position (normalized) */
  subjectNx: number
  subjectNy: number

  /** Number of schools within 1-mile radius of listing */
  nearbySchoolCount: number

  captionWords: CaptionWord[]
  voPath?: string
  durationSec?: number
}

// ── Phase constants ───────────────────────────────────────────────────────────
const PH1_SEC = 8
const PH2_SEC = 14
const PH3_SEC = 10
const PH4_SEC = 8
const PH5_SEC = 4

const toF = (s: number) => Math.round(s * FPS)

export const SchoolDistrictOverlay: React.FC<SchoolDistrictInput> = (input) => {
  const {
    apiKey,
    centerLat, centerLng,
    mapZoom = 12,
    districtName,
    boundaryPoints,
    boundaryDataAvailable,
    schools,
    subjectNx, subjectNy,
    nearbySchoolCount,
    captionWords,
    voPath,
    durationSec = 44,
  } = input

  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  // Phase frame boundaries
  const ph1End = toF(PH1_SEC)
  const ph2End = ph1End + toF(PH2_SEC)
  const ph3End = ph2End + toF(PH3_SEC)
  const ph4End = ph3End + toF(PH4_SEC)

  // Ph2: boundary draw progress
  const boundaryProgress = frame < ph1End
    ? 0
    : frame > ph2End
    ? 1
    : easeOutCubic((frame - ph1End) / toF(PH2_SEC))

  // Hook opacity
  const hookOpacity = frame < toF(3)
    ? interpolate(frame, [0, toF(2)], [0, 1])
    : frame > ph2End - toF(2)
    ? interpolate(frame, [ph2End - toF(2), ph2End], [1, 0])
    : 1

  // Stats panel opacity
  const statsOpacity = frame >= ph3End
    ? interpolate(frame, [ph3End, ph3End + toF(2)], [0, 1])
    : 0

  // Placeholder opacity (full duration when no data)
  const placeholderOpacity = !boundaryDataAvailable
    ? (frame < toF(2) ? interpolate(frame, [0, toF(2)], [0, 1]) : 1)
    : 0

  // Source citation opacity
  const citationOpacity = frame >= ph4End
    ? interpolate(frame, [ph4End, ph4End + toF(2)], [0, 1])
    : 0

  // Subject pin spring
  const subjectScale = frame >= ph3End
    ? spring({ frame: frame - ph3End, fps, config: { stiffness: 80, damping: 14 } })
    : 0

  // School marker springs — stagger 6 frames each
  const schoolScales = schools.map((_, i) => {
    const startFrame = ph2End + i * 6
    return frame >= startFrame
      ? spring({ frame: frame - startFrame, fps, config: { stiffness: 100, damping: 16 } })
      : 0
  })

  // Pixel positions
  const boundaryPixels = boundaryPoints.map(p => ({ x: p.nx * W, y: p.ny * H }))
  const subjectPx = { x: subjectNx * W, y: subjectNy * H }

  return (
    <AbsoluteFill style={{ background: NAVY }}>
      {voPath ? <Audio src={staticFile(voPath)} /> : null}

      {/* Map base */}
      <StaticMapBase
        apiKey={apiKey}
        lat={centerLat}
        lng={centerLng}
        zoom={mapZoom}
      />

      {/* Light scrim for legibility */}
      <div
        style={{
          position: 'absolute', top: 0, left: 0, width: W, height: H,
          background: 'rgba(16,39,66,0.15)',
          pointerEvents: 'none',
        }}
      />

      {/* District boundary */}
      {boundaryDataAvailable && (
        <DistrictBoundary
          points={boundaryPixels}
          progress={boundaryProgress}
          districtName={districtName}
        />
      )}

      {/* School markers */}
      {schools.map((school, i) => (
        <SchoolMarker
          key={i}
          x={school.nx * W}
          y={school.ny * H}
          name={school.name}
          rating={school.rating}
          delay={i * 6}
          scale={schoolScales[i]}
          labelSide={school.nx > 0.6 ? 'left' : 'right'}
        />
      ))}

      {/* Subject pin */}
      <SubjectPin x={subjectPx.x} y={subjectPx.y} scale={subjectScale} />

      {/* Hook text */}
      <HookOverlay
        districtName={districtName}
        schoolCount={schools.length}
        opacity={hookOpacity}
      />

      {/* Stats panel */}
      {statsOpacity > 0 && (
        <StatsPanel
          districtName={districtName}
          schoolCount={schools.length}
          nearbyCount={nearbySchoolCount}
          opacity={statsOpacity}
        />
      )}

      {/* Placeholder (no GeoJSON data) */}
      {!boundaryDataAvailable && placeholderOpacity > 0 && (
        <DataPlaceholder opacity={placeholderOpacity} />
      )}

      {/* Citation */}
      {citationOpacity > 0 && (
        <div
          style={{
            position: 'absolute',
            bottom: 440,
            left: PORTRAIT_SAFE.x,
            width: PORTRAIT_SAFE.width,
            textAlign: 'center',
            opacity: citationOpacity,
          }}
        >
          <span
            style={{
              fontFamily: FONT_BODY,
              fontSize: 26,
              color: CREAM,
              background: 'rgba(16,39,66,0.70)',
              borderRadius: 10,
              padding: '6px 20px',
            }}
          >
            Oregon Dept. of Education · data/school-districts/
          </span>
        </div>
      )}

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
