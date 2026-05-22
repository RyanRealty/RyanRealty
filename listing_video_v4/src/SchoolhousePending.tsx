// SchoolhousePending — re-export shim (2026-05-22).
//
// The original SchoolhousePending.tsx was the first listing-reel composition
// and also served as the canonical export site for shared primitives used by
// SunstoneLoop.tsx and BeaumontDrive.tsx. The composition was retired but the
// shared exports were never migrated to a permanent home.
//
// This shim re-exports the color constants from brand.ts and provides a
// KenBurnsBeat component that wraps PhotoBeat with the legacy scale/translate
// API (scaleFrom, scaleTo, translateXTo, translateYTo) that BeaumontDrive and
// SunstoneLoop rely on.
//
// TODO: migrate KenBurnsBeat callers to PhotoBeat + CameraMoveOpts directly,
// then delete this shim.

import React from 'react';
import { Img, staticFile } from 'remotion';
import { LUXURY_GRADE_FILTER, SHARED_VIGNETTE } from './brand';
import { CinemagraphMotion } from './PhotoBeat';
import { clamp, easeOutCubic, easeOutQuart } from './easing';

// ─── Color constants (used by SunstoneLoop.tsx LuxuryListingOverlay) ─────────

export const CHAMPAGNE = '#C8A864';
export const CHAMPAGNE_DEEP = '#9C7E3D';
export const CHAMPAGNE_HIGHLIGHT = '#E0C580';
export const CREAM_TEXT = '#F8F4EA';

// ─── Cinemagraph type alias (re-exported for SunstoneLoop beat type) ─────────

export type Cinemagraph = CinemagraphMotion;

// ─── KenBurnsBeat ─────────────────────────────────────────────────────────────
//
// Legacy Ken Burns photo beat component with direct scale/translate props.
// Used by BeaumontDrive.tsx and SunstoneLoop.tsx.

type KenBurnsBeatProps = {
  photo: string;
  local: number;
  fps: number;
  durationSec: number;
  scaleFrom: number;
  scaleTo: number;
  objectPosition?: string;
  transformOrigin?: string;
  translateXTo?: number;
  translateYTo?: number;
  cinemagraph?: Cinemagraph | Cinemagraph[];
  crossfadeIn?: number;
  crossfadeOut?: number;
};

export const KenBurnsBeat: React.FC<KenBurnsBeatProps> = ({
  photo,
  local,
  durationSec,
  scaleFrom,
  scaleTo,
  objectPosition = '50% 50%',
  transformOrigin = '50% 50%',
  translateXTo = 0,
  translateYTo = 0,
  crossfadeIn = 0.5,
  crossfadeOut = 0.5,
}) => {
  const t = durationSec > 0 ? clamp(local / durationSec, 0, 1) : 0;

  // Eased progress for scale and translate
  const eased = easeOutCubic(t);
  const scale = scaleFrom + (scaleTo - scaleFrom) * eased;
  const tx = translateXTo * eased;
  const ty = translateYTo * eased;
  const transform = `translate(${tx.toFixed(2)}px, ${ty.toFixed(2)}px) scale(${scale.toFixed(4)})`;

  // Crossfade opacity
  const tEntry = crossfadeIn > 0 ? clamp(local / crossfadeIn, 0, 1) : 1;
  const tExit =
    crossfadeOut > 0
      ? clamp((local - (durationSec - crossfadeOut)) / crossfadeOut, 0, 1)
      : 0;
  const photoAlpha = easeOutCubic(tEntry) * (1 - tExit);

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: 'transparent',
        overflow: 'hidden',
      }}
    >
      <Img
        src={staticFile(`images/${photo}`)}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          objectPosition,
          transform,
          transformOrigin,
          filter: LUXURY_GRADE_FILTER,
          opacity: photoAlpha,
        }}
      />

      {/* Shared vignette — matches PhotoBeat treatment */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: SHARED_VIGNETTE,
          opacity: 0.85 * photoAlpha,
          pointerEvents: 'none',
        }}
      />
    </div>
  );
};
