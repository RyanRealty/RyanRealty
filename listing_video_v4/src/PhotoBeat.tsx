// PhotoBeat — full-bleed photo with cinemagraph motion + unified luxury
// color grade + shared vignette + optional letterbox cinema bars + optional
// title card. Modern photos and historic B&W photos share this component
// for visual cohesion; only the filter chain differs.

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
  /** Photo credit line shown bottom-right in micro type */
  credit?: string;
  titlePosition?: 'top' | 'bottom' | 'center' | 'none';
  scrim?: 'none' | 'bottom' | 'top' | 'full';
  /** Letterbox cinema bars top + bottom (charcoal) */
  letterbox?: boolean;
  /** Crossfade in/out durations override */
  crossfadeIn?: number;
  crossfadeOut?: number;
  /** "Museum frame" mode for landscape originals — fits the photo
   *  inside the frame on a sepia/textured matte instead of cropping it. */
  framed?: boolean;
};

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
  letterbox = false,
  crossfadeIn = 0.5,
  crossfadeOut = 0.5,
  framed = false,
}) => {
  const totalFrames = Math.round(durationSec * fps);
  const localFrame = Math.round(local * fps);
  const cam = cameraTransform(localFrame, totalFrames, move);

  // Long crossfades for smooth transitions between beats — magazine-style
  const tEntry = clamp(local / crossfadeIn, 0, 1);
  const tExit = clamp((local - (durationSec - crossfadeOut)) / crossfadeOut, 0, 1);
  const photoAlpha = easeOutCubic(tEntry) * (1 - tExit);

  const tTitle = clamp((local - 0.7) / 0.7, 0, 1);
  const titleAlpha = easeOutCubic(tTitle) * (1 - tExit);
  const titleY = (1 - easeOutQuart(tTitle)) * 26;

  // Filter chain — luxury grade or historic sepia
  const baseFilter = historic ? HISTORIC_GRADE_FILTER : LUXURY_GRADE_FILTER;
  // Apply cinemagraph brightness/saturation modulation if present
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

  const titleColor = historic ? OFF_WHITE : OFF_WHITE;
  const subColor = GOLD;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: '#0c0a08',
        overflow: 'hidden',
      }}
    >
      {/* Optional museum-frame matte for landscape historic originals */}
      {framed ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(ellipse at 50% 50%, #2a221d 0%, #1a1411 70%, #0c0805 100%)',
            opacity: photoAlpha,
          }}
        />
      ) : null}

      {/* The photo itself, with all motion + grade */}
      <Img
        src={staticFile(`images/${photo}`)}
        style={
          framed
            ? {
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                padding: '180px 60px',
                transform: cam.transform,
                transformOrigin: cam.transformOrigin,
                filter: finalFilter,
                opacity: photoAlpha,
                boxSizing: 'border-box',
              }
            : {
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                transform: cam.transform,
                transformOrigin: cam.transformOrigin,
                filter: finalFilter,
                opacity: photoAlpha,
              }
        }
      />

      {/* Shared vignette — exists on every photo (modern + historic) */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: SHARED_VIGNETTE,
          opacity: 0.85 * photoAlpha,
          pointerEvents: 'none',
        }}
      />

      {/* Subtle film grain texture via CSS noise */}
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
          }}
        />
      ) : null}

      {/* Letterbox bars — cinema feel */}
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

      {title && titlePosition !== 'none' ? (
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

      {/* Photo credit (micro type, bottom-right) */}
      {credit ? (
        <div
          style={{
            position: 'absolute',
            right: 48,
            bottom: letterbox ? 130 : 80,
            fontFamily: FONT_BODY,
            fontWeight: 500,
            fontSize: 14,
            color: 'rgba(232,221,199,0.55)',
            letterSpacing: 1.5,
            textTransform: 'uppercase',
            opacity: photoAlpha,
          }}
        >
          {credit}
        </div>
      ) : null}
    </div>
  );
};
