// PhotoBeat — full-bleed photo with cinemagraph motion + unified luxury
// color grade + shared vignette + optional vignette-letterbox + optional
// title card + optional cinemagraph mask layer for region-only motion.
//
// v5.4 additions:
//   - vignetteLetterbox: dead space above/below the photo is now a BLURRED
//     copy of the same photo (heavy blur + dark + slight desaturation),
//     not gradient bands. The photo bleeds out into the dead space.
//   - objectPosition prop for cover-mode IMG so we can bias toward
//     specific edge of source (e.g. fire patio fireplace at right edge).
//   - flame_flicker smoothed: was high-frequency jerky, now slow compound sin.

import React from 'react';
import { Img, staticFile } from 'remotion';
import {
  CREAM,
  FONT_BODY,
  FONT_SERIF,
  GOLD,
  HISTORIC_GRADE_FILTER,
  LUXURY_GRADE_FILTER,
  OFF_WHITE,
  SHARED_VIGNETTE,
  SUB_SHADOW,
  TEXT_SHADOW,
} from './brand';
import { CameraMoveOpts, cameraTransform } from './cameraMoves';
import { clamp, easeOutCubic, easeOutQuart } from './easing';

export type CinemagraphMotion = {
  /** Mask PNG path under public/images/. White = motion shows; black = static. */
  mask: string;
  /** Motion type — controls the sin-wave parameters of the masked layer. */
  type: 'water_ripple' | 'water_flow' | 'sky_drift' | 'flame_flicker' | 'pond_ripple';
};

type Props = {
  photo: string;
  local: number;
  fps: number;
  durationSec: number;
  move: CameraMoveOpts;
  /** Apply historic sepia treatment instead of luxury grade */
  historic?: boolean;
  title?: string;
  sub?: string;
  /** Photo credit line shown at the bottom of frame in micro white type */
  credit?: string;
  titlePosition?: 'top' | 'bottom' | 'center' | 'none';
  scrim?: 'none' | 'bottom' | 'top' | 'full';
  /** Vignette-letterbox: fits photo at native horizontal aspect (height auto)
   *  with a BLURRED copy of the photo filling the dead space top + bottom
   *  instead of black or gradient bands. */
  vignetteLetterbox?: boolean;
  /** CSS object-position for cover-mode IMG (e.g. 'right center', '88% 50%').
   *  Use to bias the cover crop toward a specific edge of the source. */
  objectPosition?: string;
  /** Crossfade in/out durations override */
  crossfadeIn?: number;
  crossfadeOut?: number;
  /** Cinemagraph mask + motion overlay applied on top of base photo */
  cinemagraph?: CinemagraphMotion;
};

// Sin-wave motion parameters for cinemagraph mask layer
function cinemagraphMotion(type: CinemagraphMotion['type'], frame: number): { tx: number; ty: number; scale: number } {
  switch (type) {
    case 'water_ripple': {
      const tx = Math.sin(frame / 38) * 1.2 + Math.sin(frame / 24) * 0.4;
      const ty = Math.cos(frame / 42) * 0.6;
      const scale = 1 + Math.sin(frame / 60) * 0.0015;
      return { tx, ty, scale };
    }
    case 'water_flow': {
      const tx = Math.sin(frame / 50) * 1.6 + Math.sin(frame / 30) * 0.5;
      const ty = Math.cos(frame / 35) * 0.8;
      const scale = 1 + Math.sin(frame / 70) * 0.002;
      return { tx, ty, scale };
    }
    case 'sky_drift': {
      const tx = (frame / 60) * 0.8 % 8 - 4;
      const ty = Math.cos(frame / 90) * 0.4;
      const scale = 1 + Math.sin(frame / 100) * 0.001;
      return { tx, ty, scale };
    }
    case 'flame_flicker': {
      // v5.4: smoothed. Was high-frequency (period ~4 frames = jerky).
      // Now slow compound sin so flicker reads as warmth, not seizure.
      const tx = Math.sin(frame / 22) * 0.5 + Math.sin(frame / 38) * 0.3;
      const ty = Math.cos(frame / 26) * 0.35 + Math.sin(frame / 44) * 0.2;
      const scale = 1 + Math.sin(frame / 18) * 0.0018 + Math.cos(frame / 30) * 0.0012;
      return { tx, ty, scale };
    }
    case 'pond_ripple': {
      const tx = Math.sin(frame / 45) * 1.0;
      const ty = Math.sin(frame / 32 + 1.2) * 0.7;
      const scale = 1 + Math.sin(frame / 80) * 0.001;
      return { tx, ty, scale };
    }
  }
}

export const PhotoBeat: React.FC<Props> = ({
  photo,
  local,
  fps,
  durationSec,
  move,
  historic = false,
  title,
  sub,
  credit,
  titlePosition = 'bottom',
  scrim = 'bottom',
  vignetteLetterbox = false,
  objectPosition,
  crossfadeIn = 0.5,
  crossfadeOut = 0.5,
  cinemagraph,
}) => {
  const totalFrames = Math.round(durationSec * fps);
  const localFrame = Math.round(local * fps);
  const cam = cameraTransform(localFrame, totalFrames, move);

  const tEntry = crossfadeIn > 0 ? clamp(local / crossfadeIn, 0, 1) : 1;
  const tExit = crossfadeOut > 0
    ? clamp((local - (durationSec - crossfadeOut)) / crossfadeOut, 0, 1)
    : 0;
  const photoAlpha = easeOutCubic(tEntry) * (1 - tExit);

  const tTitle = clamp((local - 0.7) / 0.7, 0, 1);
  const titleAlpha = easeOutCubic(tTitle) * (1 - tExit);
  const titleY = (1 - easeOutQuart(tTitle)) * 26;

  const baseFilter = historic ? HISTORIC_GRADE_FILTER : LUXURY_GRADE_FILTER;
  let finalFilter = baseFilter;
  if (cam.brightnessMod !== undefined) {
    finalFilter = `${baseFilter} brightness(${cam.brightnessMod.toFixed(4)}) saturate(${(
      cam.saturationMod ?? 1
    ).toFixed(4)})`;
  }

  let scrimGradient = 'transparent';
  if (scrim === 'bottom')
    scrimGradient =
      'linear-gradient(to top, rgba(15,10,6,0.78) 0%, rgba(15,10,6,0.35) 35%, rgba(15,10,6,0) 60%)';
  else if (scrim === 'top')
    scrimGradient =
      'linear-gradient(to bottom, rgba(15,10,6,0.65) 0%, rgba(15,10,6,0.18) 30%, rgba(15,10,6,0) 50%)';
  else if (scrim === 'full')
    scrimGradient =
      'linear-gradient(180deg, rgba(15,10,6,0.45) 0%, rgba(15,10,6,0.22) 50%, rgba(15,10,6,0.65) 100%)';

  const renderPhoto = () => {
    if (vignetteLetterbox) {
      return (
        <>
          {/* Blurred backdrop layer — same photo, full-frame cover, heavy blur,
              dark + slightly desaturated. Fills the dead space above and below
              the letterboxed sharp photo with a glass-blur extension instead of
              black bars. */}
          <Img
            src={staticFile(`images/${photo}`)}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              filter: `${finalFilter} blur(28px) brightness(0.95) saturate(1.05)`,
              transform: 'scale(1.30)',
              opacity: photoAlpha,
            }}
          />
          {/* Sharp letterboxed photo on top, native horizontal aspect */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
            }}
          >
            <Img
              src={staticFile(`images/${photo}`)}
              style={{
                width: '100%',
                height: 'auto',
                display: 'block',
                transform: cam.transform,
                transformOrigin: cam.transformOrigin,
                filter: finalFilter,
                opacity: photoAlpha,
              }}
            />
          </div>
        </>
      );
    }

    if (cam.wideMode) {
      return (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          <Img
            src={staticFile(`images/${photo}`)}
            style={{
              height: '100%',
              width: 'auto',
              display: 'block',
              transform: cam.transform,
              transformOrigin: cam.transformOrigin,
              filter: finalFilter,
              opacity: photoAlpha,
            }}
          />
        </div>
      );
    }

    return (
      <Img
        src={staticFile(`images/${photo}`)}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          objectPosition: objectPosition ?? '50% 50%',
          transform: cam.transform,
          transformOrigin: cam.transformOrigin,
          filter: finalFilter,
          opacity: photoAlpha,
        }}
      />
    );
  };

  const renderCinemagraph = () => {
    if (!cinemagraph) return null;
    const m = cinemagraphMotion(cinemagraph.type, localFrame);
    const innerTransform = `translate(${m.tx.toFixed(3)}px, ${m.ty.toFixed(3)}px) scale(${m.scale.toFixed(4)})`;
    const maskUrl = `url(${staticFile(`images/${cinemagraph.mask}`)})`;

    if (vignetteLetterbox) {
      return (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            pointerEvents: 'none',
            WebkitMaskImage: maskUrl,
            maskImage: maskUrl,
            WebkitMaskSize: '100% auto',
            maskSize: '100% auto',
            WebkitMaskPosition: 'center',
            maskPosition: 'center',
            WebkitMaskRepeat: 'no-repeat',
            maskRepeat: 'no-repeat',
          }}
        >
          <Img
            src={staticFile(`images/${photo}`)}
            style={{
              width: '100%',
              height: 'auto',
              display: 'block',
              transform: `${cam.transform} ${innerTransform}`,
              transformOrigin: cam.transformOrigin,
              filter: finalFilter,
              opacity: photoAlpha,
            }}
          />
        </div>
      );
    }

    if (cam.wideMode) {
      return (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            pointerEvents: 'none',
            WebkitMaskImage: maskUrl,
            maskImage: maskUrl,
            WebkitMaskSize: 'auto 100%',
            maskSize: 'auto 100%',
            WebkitMaskPosition: 'center',
            maskPosition: 'center',
            WebkitMaskRepeat: 'no-repeat',
            maskRepeat: 'no-repeat',
          }}
        >
          <Img
            src={staticFile(`images/${photo}`)}
            style={{
              height: '100%',
              width: 'auto',
              display: 'block',
              transform: `${cam.transform} ${innerTransform}`,
              transformOrigin: cam.transformOrigin,
              filter: finalFilter,
              opacity: photoAlpha,
            }}
          />
        </div>
      );
    }

    return (
      <Img
        src={staticFile(`images/${photo}`)}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          objectPosition: objectPosition ?? '50% 50%',
          transform: `${cam.transform} ${innerTransform}`,
          transformOrigin: cam.transformOrigin,
          filter: finalFilter,
          opacity: photoAlpha,
          pointerEvents: 'none',
          WebkitMaskImage: maskUrl,
          maskImage: maskUrl,
          WebkitMaskSize: '100% 100%',
          maskSize: '100% 100%',
          WebkitMaskPosition: 'center',
          maskPosition: 'center',
          WebkitMaskRepeat: 'no-repeat',
          maskRepeat: 'no-repeat',
        }}
      />
    );
  };

  const titleColor = historic ? OFF_WHITE : OFF_WHITE;
  const subColor = GOLD;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        // v5.6 final: parent ALWAYS transparent. With Sequence overlap pattern
        // (each beat's Sequence starts 0.5s before the previous ends), the
        // previous beat must be visible through this beat during fade-in. An
        // opaque dark parent here blocks the previous layer and creates a
        // brief dark frame at every transition.
        background: 'transparent',
        overflow: 'hidden',
      }}
    >
      {renderPhoto()}
      {renderCinemagraph()}

      {/* Shared vignette — skip on vignetteLetterbox so the corners don't dim
          the blurred backdrop into looking like black bars. */}
      {!vignetteLetterbox && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: SHARED_VIGNETTE,
            opacity: 0.85 * photoAlpha,
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Subtle film-grain noise */}
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

      {scrim !== 'none' ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: scrimGradient,
            opacity: photoAlpha,
            pointerEvents: 'none',
          }}
        />
      ) : null}

      {title && titlePosition !== 'none' ? (
        <div
          style={{
            position: 'absolute',
            left: 90,
            right: 90,
            ...(titlePosition === 'top'
              ? { top: 240 }
              : titlePosition === 'center'
              ? { top: '50%', transform: `translateY(calc(-50% + ${-titleY}px))` }
              : { bottom: 280, transform: `translateY(${-titleY}px)` }),
            opacity: titleAlpha,
            textAlign: titlePosition === 'center' ? 'center' : 'left',
          }}
        >
          <div
            style={{
              fontFamily: FONT_SERIF,
              fontSize: 92,
              lineHeight: 1.02,
              color: titleColor,
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
                color: subColor,
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

      {credit ? (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 56,
            display: 'flex',
            justifyContent: 'center',
            opacity: photoAlpha * 0.85,
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              fontFamily: FONT_BODY,
              fontWeight: 500,
              fontSize: 16,
              color: 'rgba(255,255,255,0.78)',
              letterSpacing: 1.6,
              textTransform: 'none',
              textShadow: '0 1px 4px rgba(0,0,0,0.85)',
              padding: '6px 14px',
            }}
          >
            {credit}
          </div>
        </div>
      ) : null}
    </div>
  );
};
