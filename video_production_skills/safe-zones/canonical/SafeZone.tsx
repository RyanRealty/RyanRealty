/**
 * <SafeZone> — Remotion dev-mode safe-zone visualizer.
 *
 * Visualizes the platform-UI avoid regions during local Remotion preview so
 * the composer can confirm critical content isn't drifting into the unsafe
 * areas. Returns null in production renders.
 *
 * Usage:
 *
 *   import { SafeZone } from '../../../video_production_skills/safe-zones/canonical/SafeZone'
 *
 *   <AbsoluteFill>
 *     {scene content}
 *     <SafeZone format="portrait" visible={true} />
 *   </AbsoluteFill>
 *
 * Set `visible={false}` (or omit) before rendering to production. Better
 * yet, gate via `process.env.NODE_ENV !== 'production'`.
 */

import React from 'react'
import {
  PORTRAIT_AVOID_TOP,
  PORTRAIT_AVOID_BOTTOM,
  PORTRAIT_AVOID_RIGHT,
  PORTRAIT_SAFE,
  LANDSCAPE_AVOID_TOP,
  LANDSCAPE_AVOID_BOTTOM,
  LANDSCAPE_SAFE,
  SQUARE_SAFE,
  CAPTION_PORTRAIT,
  CAPTION_LANDSCAPE,
  CAPTION_SQUARE,
  SafeRect,
  CaptionBand,
} from './safe-zones'

type Props = {
  format: 'portrait' | 'landscape' | 'square'
  visible?: boolean
  /** Show the working safe zone outline. Default true when visible. */
  showWorkingZone?: boolean
  /** Show the platform-UI avoid regions (red cross-hatch). Default true when visible. */
  showAvoidRegions?: boolean
  /** Show the caption band outline. Default true when visible. */
  showCaptionBand?: boolean
}

const RED_AVOID = 'rgba(220, 38, 38, 0.18)'
const RED_STROKE = 'rgba(220, 38, 38, 0.65)'
const GREEN_SAFE = 'rgba(34, 197, 94, 0.55)'
const BLUE_CAPTION = 'rgba(59, 130, 246, 0.55)'

export const SafeZone: React.FC<Props> = ({
  format,
  visible = false,
  showWorkingZone = true,
  showAvoidRegions = true,
  showCaptionBand = true,
}) => {
  if (!visible) return null

  const avoidRects = getAvoidRects(format)
  const safe = getSafe(format)
  const caption = getCaption(format)

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 10000,
      }}
    >
      {showAvoidRegions
        ? avoidRects.map((r, i) => (
            <DiagonalHatch key={`avoid-${i}`} rect={r} label={r.label} />
          ))
        : null}
      {showWorkingZone ? (
        <Outline
          rect={safe}
          stroke={GREEN_SAFE}
          label={`SAFE ${format.toUpperCase()} ${safe.width}×${safe.height}`}
        />
      ) : null}
      {showCaptionBand ? (
        <Outline
          rect={{ x: safe.x, y: caption.top, width: safe.width, height: caption.bottom - caption.top }}
          stroke={BLUE_CAPTION}
          label={`CAPTION centerY=${caption.centerY}`}
        />
      ) : null}
    </div>
  )
}

const DiagonalHatch: React.FC<{ rect: SafeRect; label?: string }> = ({ rect, label }) => (
  <div
    style={{
      position: 'absolute',
      left: rect.x,
      top: rect.y,
      width: rect.width,
      height: rect.height,
      background: `repeating-linear-gradient(45deg, ${RED_AVOID}, ${RED_AVOID} 8px, transparent 8px, transparent 24px)`,
      border: `2px solid ${RED_STROKE}`,
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'flex-end',
      padding: 8,
      fontFamily: 'system-ui, sans-serif',
      fontSize: 16,
      color: 'rgba(220, 38, 38, 0.95)',
      fontWeight: 700,
    }}
  >
    {label ?? 'AVOID'}
  </div>
)

const Outline: React.FC<{ rect: SafeRect; stroke: string; label: string }> = ({ rect, stroke, label }) => (
  <div
    style={{
      position: 'absolute',
      left: rect.x,
      top: rect.y,
      width: rect.width,
      height: rect.height,
      border: `2px dashed ${stroke}`,
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'flex-start',
      padding: 8,
      fontFamily: 'system-ui, sans-serif',
      fontSize: 14,
      color: stroke,
      fontWeight: 600,
    }}
  >
    {label}
  </div>
)

function getAvoidRects(
  format: 'portrait' | 'landscape' | 'square',
): Array<SafeRect & { label?: string }> {
  if (format === 'portrait') {
    return [
      { ...PORTRAIT_AVOID_TOP, label: 'IG / TIKTOK PROFILE UI' },
      { ...PORTRAIT_AVOID_BOTTOM, label: 'CAPTION / ENGAGEMENT UI' },
      { ...PORTRAIT_AVOID_RIGHT, label: 'ACTION COLUMN' },
    ]
  }
  if (format === 'landscape') {
    return [
      { ...LANDSCAPE_AVOID_TOP, label: 'YT TITLE OVERLAY' },
      { ...LANDSCAPE_AVOID_BOTTOM, label: 'YT CONTROL BAR' },
    ]
  }
  return [] // square has no major platform overlays
}

function getSafe(format: 'portrait' | 'landscape' | 'square'): SafeRect {
  if (format === 'portrait') return PORTRAIT_SAFE
  if (format === 'landscape') return LANDSCAPE_SAFE
  return SQUARE_SAFE
}

function getCaption(format: 'portrait' | 'landscape' | 'square'): CaptionBand {
  if (format === 'portrait') return CAPTION_PORTRAIT
  if (format === 'landscape') return CAPTION_LANDSCAPE
  return CAPTION_SQUARE
}
