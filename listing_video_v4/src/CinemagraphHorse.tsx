// CinemagraphHorse — true cinemagraph technique on the hook beat.
//
// The frame is photographically still (locked photo as base layer).
// On top, the horse alpha-masked PNG is composited with subtle, organic
// motion: a tiny rise-and-fall (breathing) plus a faint mane sway. The
// rest of the frame does not move — exactly the magic of a cinemagraph.
//
// Alpha mask was extracted from 01_horse_hook.jpg via rembg
// (isnet-general-use) and saved as 01_horse_alpha.png. The png contains
// only the horse + immediate environment with transparent background.

import React from 'react';
import { Img, staticFile } from 'remotion';
import {
  FONT_BODY,
  FONT_SERIF,
  GOLD,
  LUXURY_GRADE_FILTER,
  OFF_WHITE,
  SHARED_VIGNETTE,
  SUB_SHADOW,
  TEXT_SHADOW,
} from './brand';
import { clamp, easeOutCubic, easeOutQuart } from './easing';

type Props = {
  local: number;
  fps: number;
  durationSec: number;
  title?: string;
  sub?: string;
  titlePosition?: 'top' | 'bottom' | 'center';
  scrim?: 'none' | 'bottom';
  letterbox?: boolean;
  crossfadeIn?: number;
  crossfadeOut?: number;
};

export const CinemagraphHorse: React.FC<Props> = ({
  local,
  fps,
  durationSec,
  title,
  sub,
  titlePosition = 'bottom',
  scrim = 'bottom',
  letterbox = true,
  crossfadeIn = 0.5,
  crossfadeOut = 0.5,
}) => {
  // Crossfade
  const tEntry = clamp(local / crossfadeIn, 0, 1);
  const tExit = clamp((local - (durationSec - crossfadeOut)) / crossfadeOut, 0, 1);
  const photoAlpha = easeOutCubic(tEntry) * (1 - tExit);

  // Title
  const tTitle = clamp((local - 0.7) / 0.7, 0, 1);
  const titleAlpha = easeOutCubic(tTitle) * (1 - tExit);
  const titleY = (1 - easeOutQuart(tTitle)) * 26;

  // Base photo: tiny push-in (1.0 → 1.04) over the beat. Locked otherwise.
  const tNorm = clamp(local / durationSec, 0, 1);
  const baseScale = 1.0 + 0.04 * easeOutCubic(tNorm);

  // Horse breathing: organic vertical rise/fall.
  // Period ~3.5s. Amplitude ±2.2px on Y. Scale wave ±0.4% on a longer
  // 5.2s period so the breathing feels lung-driven, not metronomic.
  const u = local;
  const breatheY = Math.sin((u / 3.5) * Math.PI * 2) * 2.2;
  const breatheScale = 1.0 + Math.sin((u / 5.2) * Math.PI * 2 + 0.6) * 0.004;

  // Mane sway: faint rotation, very low amplitude, much slower
  const manePhase = Math.sin((u / 6.4) * Math.PI * 2 + 1.1);
  const maneRot = manePhase * 0.18; // ±0.18°

  // Horse layer's combined transform — sits in same coordinates as base
  const horseTransform = `translateY(${breatheY.toFixed(
    2,
  )}px) rotate(${maneRot.toFixed(3)}deg) scale(${(baseScale * breatheScale).toFixed(4)})`;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: '#0c0a08',
        overflow: 'hidden',
      }}
    >
      {/* BASE: locked still photograph (no per-frame motion on this layer) */}
      <Img
        src={staticFile('images/01_horse_hook.jpg')}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: `scale(${baseScale.toFixed(4)})`,
          transformOrigin: '50% 50%',
          filter: LUXURY_GRADE_FILTER,
          opacity: photoAlpha,
        }}
      />

      {/* HORSE LAYER: alpha-masked PNG, breathing on top of locked base */}
      <Img
        src={staticFile('images/01_horse_alpha.png')}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: horseTransform,
          transformOrigin: '50% 50%',
          filter: LUXURY_GRADE_FILTER,
          opacity: photoAlpha,
          // Soft drop-shadow under the breathing element to sell the parallax
          mixBlendMode: 'normal',
        }}
      />

      {/* Shared vignette */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: SHARED_VIGNETTE,
          opacity: 0.85 * photoAlpha,
          pointerEvents: 'none',
        }}
      />

      {/* Film grain texture */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(circle at 20% 30%, rgba(255,235,200,0.02) 0%, transparent 50%), radial-gradient(circle at 80% 70%, rgba(255,235,200,0.015) 0%, transparent 50%)',
          mixBlendMode: 'overlay',
          opacity: 0.7,
          pointerEvents: 'none',
        }}
      />

      {scrim === 'bottom' ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(to top, rgba(15,10,6,0.78) 0%, rgba(15,10,6,0.35) 35%, rgba(15,10,6,0) 60%)',
            opacity: photoAlpha,
          }}
        />
      ) : null}

      {/* Letterbox bars */}
      {letterbox ? (
        <>
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: 110,
              background: '#0a0805',
              opacity: photoAlpha,
            }}
          />
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: 110,
              background: '#0a0805',
              opacity: photoAlpha,
            }}
          />
        </>
      ) : null}

      {/* Title */}
      {title ? (
        <div
          style={{
            position: 'absolute',
            left: 90,
            right: 90,
            ...(titlePosition === 'top'
              ? { top: letterbox ? 180 : 240 }
              : titlePosition === 'center'
              ? { top: '50%', transform: `translateY(calc(-50% + ${-titleY}px))` }
              : { bottom: letterbox ? 200 : 280, transform: `translateY(${-titleY}px)` }),
            opacity: titleAlpha,
            textAlign: titlePosition === 'center' ? 'center' : 'left',
          }}
        >
          <div
            style={{
              fontFamily: FONT_SERIF,
              fontSize: 92,
              lineHeight: 1.02,
              color: OFF_WHITE,
              letterSpacing: '-0.01em',
              textShadow: TEXT_SHADOW,
            }}
          >
            {title}
          </div>
          {sub ? (
            <div
              style={{
                marginTop: 18,
                fontFamily: FONT_BODY,
                fontWeight: 700,
                fontSize: 28,
                color: GOLD,
                letterSpacing: 4,
                textTransform: 'uppercase',
                textShadow: SUB_SHADOW,
              }}
            >
              {sub}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};
