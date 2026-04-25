// PhotoBeat — full-bleed photo with cinemagraph motion + unified luxury
// color grade + shared vignette + optional vignette-letterbox + optional
// title card + optional cinemagraph mask layer for region-only motion.
//
// v5.3 additions:
//   - wide-mode IMG sizing (height:100% width:auto, flex-centered) when the
//     active motion expects to pan across a wide image. Eliminates the
//     "pan into black space" failure mode.
//   - vignette letterbox: top/bottom dead space filled with a soft
//     gradient + film grain rather than pure black.
//   - cinemagraph mask layer: a duplicate of the photo with a sin-wave
//     translate, masked to a region (water, sky, fire) so motion only
//     shows through that region while the rest of the frame stays static.
//   - per-photo credit line as small white text at the bottom of frame.

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
   *  with soft gradient bands top + bottom instead of crop-cover. */
  vignetteLetterbox?: boolean;
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
      // Slow horizontal sway + tiny vertical, sub-pixel scale wobble
      const tx = Math.sin(frame / 38) * 1.2 + Math.sin(frame / 24) * 0.4;
      const ty = Math.cos(frame / 42) * 0.6;
      const scale = 1 + Math.sin(frame / 60) * 0.0015;
      return { tx, ty, scale };
    }
    case 'water_flow': {
      // Steady horizontal drift + slight vertical for moving river
      const tx = Math.sin(frame / 50) * 1.6 + Math.sin(frame / 30) * 0.5;
      const ty = Math.cos(frame / 35) * 0.8;
      const scale = 1 + Math.sin(frame / 70) * 0.002;
      return { tx, ty, scale };
    }
    case 'sky_drift': {
      // Very slow horizontal cloud drift, almost no vertical
      const tx = (frame / 60) * 0.8 % 8 - 4; // gentle linear-ish drift, 8px range
      const ty = Math.cos(frame / 90) * 0.4;
      const scale = 1 + Math.sin(frame / 100) * 0.001;
      return { tx, ty, scale };
    }
    case 'flame_flicker': {
      // Erratic small jitters + brightness pulse via scale wobble
      const tx = (Math.sin(frame / 4) + Math.sin(frame / 7) * 0.6) * 0.5;
      const ty = (Math.cos(frame / 5) + Math.sin(frame / 9) * 0.7) * 0.4;
      const scale = 1 + Math.sin(frame / 3) * 0.004 + Math.cos(frame / 5) * 0.003;
      return { tx, ty, scale };
    }
    case 'pond_ripple': {
      // Slow concentric-feeling wobble — small amplitude, dual-axis
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
  crossfadeIn = 0.5,
  crossfadeOut = 0.5,
  cinemagraph,
}) => {
  const totalFrames = Math.round(durationSec * fps);
  const localFrame = Math.round(local * fps);
  const cam = cameraTransform(localFrame, totalFrames, move);

  const tEntry = clamp(local / crossfadeIn, 0, 1);
  const tExit = clamp((local - (durationSec - crossfadeOut)) / crossfadeOut, 0, 1);
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

  // ─── IMG style by render mode ─────────────────────────────────────────
  // wideMode: height:100% width:auto, flex-centered. Allows pan via
  //   transform translate without exposing background.
  // vignetteLetterbox: width:100% height:auto, top/bottom gradient bands.
  //   Photo shown at its native horizontal aspect inside 9:16 frame.
  // default (cover): inset:0 width:100% height:100% objectFit:cover.

  const renderPhoto = () => {
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
          transform: cam.transform,
          transformOrigin: cam.transformOrigin,
          filter: finalFilter,
          opacity: photoAlpha,
        }}
      />
    );
  };

  // ─── Cinemagraph mask overlay ────────────────────────────────────────
  // A duplicate of the photo with a sin-wave motion, masked to a region.
  // Renders on TOP of the base photo. Same camera transform as base, plus
  // a tiny additional sin-wave translate. The mask hides everything outside
  // the motion region so the static base shows through there.
  const renderCinemagraph = () => {
    if (!cinemagraph) return null;
    const m = cinemagraphMotion(cinemagraph.type, localFrame);
    // Compose: base camera transform ON the same wrapper, then small
    // additional sin-translate inside.
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

  // Vignette-letterbox bands: gradient + film-grain texture on the dead
  // space above and below the photo, NOT pure black.
  const renderVignetteLetterboxBands = () => {
    if (!vignetteLetterbox) return null;
    return (
      <>
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '50%',
            background:
              'linear-gradient(to bottom, #0a0805 0%, rgba(10,8,5,0.92) 50%, rgba(10,8,5,0) 100%)',
            opacity: photoAlpha,
            pointerEvents: 'none',
            mixBlendMode: 'normal',
            // The actual photo height in 1080 frame is much less than 50%,
            // so this gradient lands on the dead space top + naturally
            // fades over the photo edge.
            mask: 'linear-gradient(to bottom, black 0%, black 35%, transparent 50%)',
            WebkitMask: 'linear-gradient(to bottom, black 0%, black 35%, transparent 50%)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '50%',
            background:
              'linear-gradient(to top, #0a0805 0%, rgba(10,8,5,0.92) 50%, rgba(10,8,5,0) 100%)',
            opacity: photoAlpha,
            pointerEvents: 'none',
            mask: 'linear-gradient(to top, black 0%, black 35%, transparent 50%)',
            WebkitMask: 'linear-gradient(to top, black 0%, black 35%, transparent 50%)',
          }}
        />
      </>
    );
  };

  const titleColor = historic ? OFF_WHITE : OFF_WHITE;
  const subColor = GOLD;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: '#0a0805',
        overflow: 'hidden',
      }}
    >
      {/* Base photo */}
      {renderPhoto()}

      {/* Cinemagraph masked motion layer (on top of base, same transform + small sine) */}
      {renderCinemagraph()}

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

      {/* Vignette-letterbox bands (replaces black letterbox) */}
      {renderVignetteLetterboxBands()}

      {/* Bottom/top scrim for legibility */}
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

      {/* Photo credit line — small white type, bottom of frame, centered */}
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
