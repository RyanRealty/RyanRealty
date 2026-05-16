// RyanRealtyOutro — market-report-style closing card for standalone news clips.
//
// Mirrors the locked S12 spec from video_production_skills/market-data-video/SKILL.md §11:
//   - Solid navy #102742 background (no gradient, no glow)
//   - White stacked Ryan Realty logo, vertically centered, fades in
//   - 541.213.6706 phone number below the logo, fades in offset
//   - Nothing else (no URL, no tagline, no DM copy, no shimmer)
//
// Use this for standalone news clips where the brand close is required
// (per Matt directive 2026-05-10). For multi-part series like Bend Pulse,
// keep using BrandOutro.tsx (logo only, no phone) so the series carries its
// own connective tissue.

import React from 'react';
import {
  AbsoluteFill,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

const NAVY = '#102742';
const FONT_SUB = "'AzoSans', 'Bebas Neue', 'Montserrat', sans-serif";

export const RYAN_REALTY_OUTRO_SEC = 3.0;

type Props = {
  /** Optional override of the total outro duration. */
  durationSec?: number;
  /** Show the phone number under the logo. Default: true (market report style). */
  showPhone?: boolean;
};

export const RyanRealtyOutro: React.FC<Props> = ({
  durationSec = RYAN_REALTY_OUTRO_SEC,
  showPhone = true,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;

  // Logo fade in: 0.2s → 1.0s (24f window starting at frame 6 @ 30fps)
  const logoAlpha = interpolate(t, [0.2, 1.0], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Phone fade in: 1.0s → 1.8s (offset behind the logo)
  const phoneAlpha = interpolate(t, [1.0, 1.8], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Exit fade in the last 0.4s — keeps a clean cut into post-render padding.
  const exitAlpha = interpolate(t, [durationSec - 0.4, durationSec], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Subtle scale-in on the logo (1.00 → 1.02) over the visible window.
  const logoScale = interpolate(t, [0.2, 1.6], [1.0, 1.02], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ backgroundColor: NAVY, opacity: exitAlpha }}>
      {/* Stacked white logo — vertically centered, slight lift */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: `translate(-50%, -60%) scale(${logoScale.toFixed(3)})`,
          opacity: logoAlpha,
        }}
      >
        <Img
          src={staticFile('brand/stacked_logo_white.png')}
          style={{ width: 620, height: 'auto', display: 'block' }}
        />
      </div>

      {/* Phone number — below the logo */}
      {showPhone ? (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, 60px)',
            opacity: phoneAlpha,
            fontFamily: FONT_SUB,
            fontSize: 44,
            fontWeight: 500,
            letterSpacing: 2,
            color: '#FFFFFF',
            textAlign: 'center',
          }}
        >
          541.213.6706
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
