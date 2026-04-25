// AerialMap v2 — grand multi-stage zoom from PNW context all the way down
// to the property. Six layered satellite tiles cross-fade with continuous
// scale interpolation so the motion feels truly continuous, not stepped.
// Pin pulses at the property location once we're close enough to see it.

import React from 'react';
import { Img, staticFile } from 'remotion';
import {
  CREAM,
  FONT_BODY,
  FONT_SERIF,
  GOLD,
  GOLD_WARM,
  OFF_WHITE,
  SHARED_VIGNETTE,
  TEXT_SHADOW,
} from './brand';
import { clamp, easeInOutCubic, easeInOutQuart, easeOutCubic } from './easing';

type Props = {
  local: number;
  fps: number;
  durationSec: number;
  label?: string;
  sub?: string;
};

// Six zoom levels — start far, end at the lot
const ZOOMS = [7, 10, 12, 14, 16, 18];

export const AerialMap: React.FC<Props> = ({ local, fps, durationSec, label, sub }) => {
  const t = clamp(local / durationSec, 0, 1);
  const eased = easeInOutQuart(t); // slow-fast-slow zoom feels cinematic

  const zoomFloat = eased * (ZOOMS.length - 1);
  const baseIdx = Math.floor(zoomFloat);
  const blend = zoomFloat - baseIdx;

  // Continuous magnification on each layer to imply smooth zoom
  const layerScale = 1.04 + 1.6 * eased;

  // Vignette intensifies as we zoom in
  const vignetteAlpha = 0.6 + 0.3 * eased;

  // Pin only visible from z14+ onward (last 50% of timeline)
  const pinAlpha = clamp((eased - 0.55) / 0.35, 0, 1);
  const pinPulse = Math.sin(local * Math.PI * 1.5) * 0.5 + 0.5;

  // Title intro at the back half
  const tTitle = clamp((local - durationSec * 0.5) / (durationSec * 0.5), 0, 1);
  const titleAlpha = easeOutCubic(tTitle);

  const tEntry = clamp(local / 0.5, 0, 1);
  const tExit = clamp((local - (durationSec - 0.5)) / 0.5, 0, 1);
  const beatAlpha = easeOutCubic(tEntry) * (1 - tExit);

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: '#0c0a08',
        opacity: beatAlpha,
        overflow: 'hidden',
      }}
    >
      {/* Base zoom level */}
      <Img
        src={staticFile(`images/maps_z${ZOOMS[baseIdx]}.png`)}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: `scale(${layerScale})`,
          transformOrigin: '50% 50%',
          filter: 'sepia(0.08) saturate(1.1) brightness(1.05) contrast(1.05) hue-rotate(-3deg)',
          opacity: 1 - blend,
        }}
      />
      {baseIdx + 1 < ZOOMS.length ? (
        <Img
          src={staticFile(`images/maps_z${ZOOMS[baseIdx + 1]}.png`)}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform: `scale(${layerScale * 0.7})`,
            transformOrigin: '50% 50%',
            filter: 'sepia(0.08) saturate(1.1) brightness(1.05) contrast(1.05) hue-rotate(-3deg)',
            opacity: blend,
          }}
        />
      ) : null}

      {/* Pin appears once we're close */}
      {pinAlpha > 0 ? (
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            opacity: pinAlpha * 0.95,
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              width: 70 + pinPulse * 60,
              height: 70 + pinPulse * 60,
              borderRadius: '50%',
              border: `3px solid ${GOLD_WARM}`,
              opacity: 0.75 - pinPulse * 0.4,
              position: 'absolute',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
            }}
          />
          <div
            style={{
              width: 24,
              height: 24,
              borderRadius: '50%',
              background: GOLD_WARM,
              boxShadow: `0 0 28px ${GOLD_WARM}, 0 0 60px ${GOLD}`,
              position: 'absolute',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
            }}
          />
        </div>
      ) : null}

      {/* Vignette grows as we zoom in */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0) 35%, rgba(10,8,5,${vignetteAlpha}) 100%)`,
          pointerEvents: 'none',
        }}
      />

      {/* Title at the bottom */}
      {label ? (
        <div
          style={{
            position: 'absolute',
            left: 90,
            right: 90,
            bottom: 220,
            opacity: titleAlpha * beatAlpha,
            textAlign: 'left',
          }}
        >
          <div
            style={{
              fontFamily: FONT_SERIF,
              fontSize: 86,
              lineHeight: 1.02,
              color: OFF_WHITE,
              letterSpacing: '-0.01em',
              textShadow: TEXT_SHADOW,
            }}
          >
            {label}
          </div>
          {sub ? (
            <div
              style={{
                marginTop: 16,
                fontFamily: FONT_BODY,
                fontWeight: 700,
                fontSize: 26,
                color: GOLD,
                letterSpacing: 4,
                textTransform: 'uppercase',
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
