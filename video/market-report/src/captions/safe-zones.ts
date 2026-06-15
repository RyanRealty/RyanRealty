/**
 * safe-zones — canonical platform-aware safe-zone constants for every
 * Ryan Realty Remotion composition.
 *
 * Locked 2026-05-20. See video_production_skills/safe-zones/SKILL.md for
 * the full rule + per-format derivation.
 *
 * Usage from any Remotion comp:
 *
 *   import {
 *     PORTRAIT_SAFE,
 *     CAPTION_PORTRAIT,
 *   } from '../../../video_production_skills/safe-zones/canonical/safe-zones'
 *
 *   <div style={{
 *     position: 'absolute',
 *     left: PORTRAIT_SAFE.x,
 *     top: PORTRAIT_SAFE.y,
 *     width: PORTRAIT_SAFE.width,
 *     height: PORTRAIT_SAFE.height,
 *   }}>
 *     {scene content}
 *   </div>
 */

export type SafeRect = {
  x: number
  y: number
  width: number
  height: number
}

export type CaptionBand = {
  /** Vertical center pixel of the caption row */
  centerY: number
  /** Top of the caption band (inclusive) */
  top: number
  /** Bottom of the caption band (inclusive) */
  bottom: number
  /** Recommended font size for single-word captions in this format */
  fontSizePx: number
  /** Recommended max width of the caption row in px */
  maxWidthPx: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Portrait 1080×1920 — IG Reels / TikTok / FB Reels / YT Shorts
// ─────────────────────────────────────────────────────────────────────────────

/** Working safe zone for portrait — anchor all text + critical content inside. */
export const PORTRAIT_SAFE: SafeRect = {
  x: 90,
  y: 280,
  width: 900,
  height: 1200,
}

/** Platform-UI avoidance rect: IG / TikTok / FB Reels profile pill + follow button. */
export const PORTRAIT_AVOID_TOP: SafeRect = {
  x: 0,
  y: 0,
  width: 1080,
  height: 280,
}

/** Platform-UI avoidance rect: caption box / description / engagement chrome at the bottom. */
export const PORTRAIT_AVOID_BOTTOM: SafeRect = {
  x: 0,
  y: 1480,
  width: 1080,
  height: 440,
}

/** Platform-UI avoidance rect: IG / TikTok action column (like / comment / share / save). */
export const PORTRAIT_AVOID_RIGHT: SafeRect = {
  x: 960,
  y: 280,
  width: 120,
  height: 1200,
}

/** Single-word caption band for portrait — inside the working safe zone, at the bottom. */
export const CAPTION_PORTRAIT: CaptionBand = {
  centerY: 1370,
  top: 1280,
  bottom: 1460,
  fontSizePx: 120,
  maxWidthPx: 900,
}

// ─────────────────────────────────────────────────────────────────────────────
// Landscape 1920×1080 — YouTube long-form, YT player embed
// ─────────────────────────────────────────────────────────────────────────────

/** Working safe zone for landscape — inside YT player chrome (top title overlay + bottom control bar). */
export const LANDSCAPE_SAFE: SafeRect = {
  x: 90,
  y: 80,
  width: 1740,
  height: 920,
}

/** YT title overlay area (initial load + hover-reveal). */
export const LANDSCAPE_AVOID_TOP: SafeRect = {
  x: 0,
  y: 0,
  width: 1920,
  height: 80,
}

/** YT control bar (auto-hides; assume visible for safety). */
export const LANDSCAPE_AVOID_BOTTOM: SafeRect = {
  x: 0,
  y: 1000,
  width: 1920,
  height: 80,
}

export const CAPTION_LANDSCAPE: CaptionBand = {
  centerY: 940,
  top: 880,
  bottom: 1000,
  fontSizePx: 96,
  maxWidthPx: 1600,
}

// ─────────────────────────────────────────────────────────────────────────────
// Square 1080×1080 — IG feed post, FB feed, LinkedIn carousel slide
// ─────────────────────────────────────────────────────────────────────────────

/** Working safe zone for square — IG feed posts have minimal overlay; only edge padding needed. */
export const SQUARE_SAFE: SafeRect = {
  x: 90,
  y: 90,
  width: 900,
  height: 920,
}

export const CAPTION_SQUARE: CaptionBand = {
  centerY: 930,
  top: 850,
  bottom: 1010,
  fontSizePx: 96,
  maxWidthPx: 900,
}

// ─────────────────────────────────────────────────────────────────────────────
// Vertical 4:5 1080×1350 — IG feed crop (for posts that may be auto-cropped)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * If a 1080×1920 portrait video may be auto-cropped to 4:5 in IG feed, anchor
 * critical content inside this rect (defined in the 1080×1920 frame's coords)
 * so the 4:5 crop centered on the frame catches it.
 */
export const PORTRAIT_4_5_CROP_SAFE: SafeRect = {
  x: 90,
  y: 285,
  width: 900,
  height: 1350,
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Resolve the right safe-zone rect by format key. */
export function getSafeZone(format: 'portrait' | 'landscape' | 'square'): SafeRect {
  switch (format) {
    case 'portrait':
      return PORTRAIT_SAFE
    case 'landscape':
      return LANDSCAPE_SAFE
    case 'square':
      return SQUARE_SAFE
  }
}

/** Resolve the caption band by format key. */
export function getCaptionBand(format: 'portrait' | 'landscape' | 'square'): CaptionBand {
  switch (format) {
    case 'portrait':
      return CAPTION_PORTRAIT
    case 'landscape':
      return CAPTION_LANDSCAPE
    case 'square':
      return CAPTION_SQUARE
  }
}

/** Frame dimensions per format. */
export const FRAME_DIMS: Record<'portrait' | 'landscape' | 'square', { width: number; height: number }> = {
  portrait: { width: 1080, height: 1920 },
  landscape: { width: 1920, height: 1080 },
  square: { width: 1080, height: 1080 },
}
