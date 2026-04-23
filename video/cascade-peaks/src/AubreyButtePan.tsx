// AubreyButtePan — intro panoramic. Camera stands on Aubrey Butte at ~120m
// above terrain looking west at the Cascade skyline. Yaw pans from
// ~southwest (past Bachelor) to ~northwest (past Jefferson) over
// AUBREY_PAN_SEC. HUD markers pop on each peak as it crosses frame center.
//
// Paulina is not panned — it's south of the line (bearing ~170°) and isn't
// part of the "Cascade skyline" silhouette. It gets its own deep-dive scene.

import React from 'react';
import { useCurrentFrame, AbsoluteFill } from 'remotion';
import { TilesScene } from './TilesScene';
import { PanCameraRig } from './CameraRig';
import { HudCallout } from './HudCallout';
import {
  FONT_BODY,
  FONT_SERIF,
  GOLD,
  SAFE_LEFT,
  SAFE_RIGHT,
  SAFE_TOP,
  TEXT_SHADOW,
  WHITE,
} from './brand';
import { AUBREY_PAN_FOV, AUBREY_PAN_SEC, FPS } from './config';
import { AUBREY_BUTTE, PEAKS } from './peaks';
import { bearingDeg, tangentOffsetM } from './geo';
import { clamp, easeInOutQuart, easeOutCubic } from './easing';
import { projectEnuToScreen } from './project';

const FT_TO_M = 0.3048;
// Aubrey Butte summit ~4290 ft ≈ 1307 m; extra height from AUBREY_BUTTE.cameraHeightM.
const AUBREY_BASE_ELEV_M = 1307;
const CAMERA_ALT_M = AUBREY_BASE_ELEV_M + AUBREY_BUTTE.cameraHeightM;

// Pan window — chosen to frame the Cascade silhouette from Bachelor (SW)
// through the Sisters (W) to Jefferson (NNW). Paulina (S) is deliberately
// outside this window. Horizontal FOV is 18.3°, so a peak at bearing B is
// visible while camera azimuth A satisfies |B-A| < 9.15°.
//   Bachelor  — 252° from Aubrey: visible while az ∈ [243, 261]
//   Jefferson — 331° from Aubrey: visible while az ∈ [322, 340]
// Pan start has Bachelor ~8° right of frame center (entering from right),
// pan end has Jefferson ~6° left of center (exiting toward left). Previous
// 235→325 window wasted ~5 seconds of screen time with no peaks in frame.
const PAN_START_AZ = 244;
const PAN_END_AZ = 337;

// Peaks that will receive HUD markers on the pan (exclude Paulina — south).
const PAN_PEAKS = PEAKS.filter((p) => p.id !== 'paulina');

// Per-peak label vertical offset (px above the dot). Peaks with near-identical
// bearings from Aubrey (e.g., S. Sister 277.4° vs Broken Top 278.0°) get
// staggered offsets so their pills don't stack on top of each other. Peaks
// whose neighbors are >5° away on the bearing wheel use the base offset —
// staggering them unnecessarily just floats the pill far off the peak.
const LABEL_OFFSET_BY_ID: Record<string, number> = {
  bachelor: 110,
  broken_top: 100,
  south_sister: 170, // stack above Broken Top (bearing 277.4 vs 278.0, 0.6° apart)
  middle_sister: 100,
  north_sister: 170, // stack above Middle Sister (bearing 288.7 vs 282.6, 6° apart)
  washington: 110,
  three_fingered_jack: 110, // alone in its bearing band (318° vs Wash 309°, BB 327°)
  black_butte: 110,
  jefferson: 110, // alone at bearing 331°
};

type Props = {
  frameOffset: number;
};

export const AubreyButtePan: React.FC<Props> = ({ frameOffset }) => {
  const frame = useCurrentFrame();
  const local = frame - frameOffset;

  const totalFrames = AUBREY_PAN_SEC * FPS;
  const tRaw = clamp(local / totalFrames, 0, 1);
  const t = easeInOutQuart(tRaw);
  const currentAz = PAN_START_AZ + (PAN_END_AZ - PAN_START_AZ) * t;

  // Entry/exit fade for the overlays
  const tEntry = clamp(local / (0.5 * FPS), 0, 1);
  const tExit = clamp((local - (totalFrames - 0.5 * FPS)) / (0.5 * FPS), 0, 1);
  const overlayAlpha = easeOutCubic(tEntry) * (1 - tExit);

  return (
    <AbsoluteFill style={{ background: '#0a1a2e' }}>
      {/* 3D canvas — note the ENU frame origin is ~sea level; we sit the
          camera at the real ground elevation of Aubrey Butte + drone height. */}
      <TilesScene
        origin={{ lat: AUBREY_BUTTE.lat, lon: AUBREY_BUTTE.lon, height: 0 }}
        fov={AUBREY_PAN_FOV}
        near={50}
        far={250_000}
      >
        <PanCameraRig
          startAzimuthDeg={PAN_START_AZ}
          endAzimuthDeg={PAN_END_AZ}
          pitchDeg={-2.75}
          heightM={CAMERA_ALT_M}
          durationSec={AUBREY_PAN_SEC}
          fov={AUBREY_PAN_FOV}
          near={50}
          far={250_000}
        />
      </TilesScene>

      {/* HUD markers overlayed on the canvas — projected in JS using the
          same pan math the camera rig uses. */}
      {PAN_PEAKS.map((peak) => {
        const [e, n] = tangentOffsetM(
          { lat: AUBREY_BUTTE.lat, lon: AUBREY_BUTTE.lon },
          { lat: peak.lat, lon: peak.lon }
        );
        const u = peak.elevationFt * FT_TO_M;
        const proj = projectEnuToScreen({
          cameraAzimuthDeg: currentAz,
          // MUST match the pitch passed to <PanCameraRig/> above, or the JS-
          // projected dots will sit at a different y than the rendered peaks.
          cameraPitchDeg: -2.75,
          cameraHeightM: CAMERA_ALT_M,
          target: [e, n, u],
        });

        if (!proj.visible) return null;

        // Per-peak "arrival" time: when this peak's bearing matches
        // current camera azimuth. Compute bearing from Aubrey.
        const bearing = bearingDeg(
          { lat: AUBREY_BUTTE.lat, lon: AUBREY_BUTTE.lon },
          { lat: peak.lat, lon: peak.lon }
        );
        // Map bearing to a pan-progress tBearing in [0,1]
        const tBearing = clamp(
          (bearing - PAN_START_AZ) / (PAN_END_AZ - PAN_START_AZ),
          0,
          1
        );
        // Invert easing so arrivalFrame lines up with camera crossing
        // the peak (easeInOutQuart is monotonic so just binary search
        // numerically).
        const arrivalT = invertEaseInOutQuart(tBearing);
        const arrivalFrame = arrivalT * totalFrames;
        const markerLocal = local - arrivalFrame;

        if (markerLocal < 0) return null;

        return (
          <HudCallout
            key={peak.id}
            x={proj.x}
            y={proj.y}
            label={peak.shortName || peak.name}
            localFrame={markerLocal}
            fps={FPS}
            holdSec={1.4}
            fadeOutSec={0.5}
            labelOffsetPx={LABEL_OFFSET_BY_ID[peak.id] ?? 110}
          />
        );
      })}

      {/* Scene title — frosted panel so copy reads over 3D (not “floating on
          a gold bar” alone). Tighter FOV above makes the skyline larger. */}
      <div
        style={{
          position: 'absolute',
          left: SAFE_LEFT,
          top: SAFE_TOP + 8,
          maxWidth: SAFE_RIGHT - SAFE_LEFT,
          opacity: overlayAlpha,
          zIndex: 1,
          padding: '22px 26px 26px',
          borderRadius: 8,
          border: `1px solid rgba(212,175,55,0.45)`,
          background: 'rgba(10,26,46,0.48)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          boxShadow: '0 8px 28px rgba(0,0,0,0.35)',
        }}
      >
        <div
          style={{
            display: 'inline-block',
            padding: '5px 14px',
            background: GOLD,
            color: '#0a1a2e',
            fontFamily: FONT_BODY,
            fontWeight: 700,
            fontSize: 20,
            letterSpacing: 2.5,
            borderRadius: 3,
            marginBottom: 10,
          }}
        >
          AUBREY BUTTE · LOOKING WEST
        </div>
        <div
          style={{
            fontFamily: FONT_SERIF,
            fontSize: 56,
            lineHeight: 1.05,
            color: WHITE,
            textShadow: TEXT_SHADOW,
            maxWidth: SAFE_RIGHT - SAFE_LEFT - 52,
          }}
        >
          The Cascade skyline,
          <br />
          south to north.
        </div>
      </div>

      {/* Soft lower read — no solid navy wall so tiles stay visible */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 760,
          bottom: 0,
          background:
            'linear-gradient(to bottom, rgba(10,26,46,0) 0%, rgba(10,26,46,0.22) 35%, rgba(10,26,46,0.5) 70%, rgba(10,26,46,0.72) 100%)',
          pointerEvents: 'none',
        }}
      />

      {/* Magazine-spread stat row filling the bottom half of the frame.
          From Aubrey Butte (1427m ASL), the Cascades at 50+ km subtend only
          ~2° above horizon — so the skyline is naturally a thin band. Rather
          than fight the physics with a wider FOV (which distorts) or a tighter
          zoom (which breaks streaming), we fill the lower space with data.
          Every figure traces to peaks.ts:
            - 9 pan peaks (PEAKS.length=10 minus Paulina)
            - 48 miles = haversine Bachelor→Jefferson = 48.3 mi
            - 10,497 ft = Jefferson elevationFt */}
      <AubreyStatRow alpha={overlayAlpha} />

      {/* Compass indicator bottom-right */}
      <CompassHud az={currentAz} alpha={overlayAlpha} />
    </AbsoluteFill>
  );
};

const AubreyStatRow: React.FC<{ alpha: number }> = ({ alpha }) => {
  const stats = [
    { big: '9', unit: 'VOLCANIC', label: 'PEAKS IN FRAME' },
    { big: '48', unit: 'MILES', label: 'OF CASCADE CREST' },
    { big: '10,497', unit: 'FT', label: 'HIGHEST — JEFFERSON' },
  ];
  return (
    <div
      style={{
        position: 'absolute',
        left: SAFE_LEFT,
        right: 1080 - SAFE_RIGHT,
        bottom: 640,
        opacity: alpha,
        display: 'flex',
        flexDirection: 'column',
        gap: 22,
      }}
    >
      {/* Section eyebrow — gold rule + tiny label */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
        }}
      >
        <div style={{ height: 2, width: 48, background: GOLD }} />
        <div
          style={{
            fontFamily: FONT_BODY,
            fontWeight: 700,
            fontSize: 18,
            letterSpacing: 3,
            color: GOLD,
          }}
        >
          ONE VANTAGE · NINE PEAKS
        </div>
      </div>

      {/* Three-column stat grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: 10,
          background: 'rgba(10,23,40,0.42)',
          border: `1px solid ${GOLD}`,
          borderRadius: 6,
          padding: '22px 16px',
          backdropFilter: 'blur(5px)',
        }}
      >
        {stats.map((s, i) => (
          <div
            key={s.label}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              padding: '0 8px',
              borderRight:
                i < stats.length - 1 ? `1px solid rgba(212,175,55,0.35)` : 'none',
            }}
          >
            <div
              style={{
                fontFamily: FONT_SERIF,
                fontSize: 68,
                lineHeight: 1,
                color: WHITE,
                textShadow: TEXT_SHADOW,
              }}
            >
              {s.big}
            </div>
            <div
              style={{
                marginTop: 6,
                fontFamily: FONT_BODY,
                fontWeight: 700,
                fontSize: 18,
                letterSpacing: 2.5,
                color: GOLD,
              }}
            >
              {s.unit}
            </div>
            <div
              style={{
                marginTop: 4,
                fontFamily: FONT_BODY,
                fontWeight: 500,
                fontSize: 13,
                letterSpacing: 1.5,
                color: WHITE,
                opacity: 0.82,
              }}
            >
              {s.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * Bisect to invert easeInOutQuart(t) = target; t in [0,1].
 * Fast and branch-free.
 */
const invertEaseInOutQuart = (target: number): number => {
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 18; i++) {
    const mid = (lo + hi) / 2;
    const v = easeInOutQuart(mid);
    if (v < target) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
};

const CompassHud: React.FC<{ az: number; alpha: number }> = ({ az, alpha }) => {
  // Show a compact compass row that scrolls under the current azimuth.
  const labels = [
    { deg: 180, t: 'S' },
    { deg: 225, t: 'SW' },
    { deg: 270, t: 'W' },
    { deg: 315, t: 'NW' },
    { deg: 360, t: 'N' },
  ];
  return (
    <div
      style={{
        position: 'absolute',
        left: SAFE_LEFT,
        bottom: 360,
        right: 1080 - SAFE_RIGHT,
        opacity: alpha,
      }}
    >
      <div
        style={{
          position: 'relative',
          height: 44,
          overflow: 'hidden',
          borderTop: `1px solid ${GOLD}`,
          borderBottom: `1px solid ${GOLD}`,
        }}
      >
        {labels.map((l) => {
          const delta = l.deg - az; // tick offset, normalize to [-90,90]
          if (Math.abs(delta) > 50) return null;
          const x = (delta / 100) * (SAFE_RIGHT - SAFE_LEFT) +
            (SAFE_RIGHT - SAFE_LEFT) / 2;
          return (
            <div
              key={l.t}
              style={{
                position: 'absolute',
                left: x,
                top: 0,
                bottom: 0,
                transform: 'translateX(-50%)',
                display: 'flex',
                alignItems: 'center',
                color: WHITE,
                fontFamily: FONT_BODY,
                fontWeight: 700,
                fontSize: 22,
                letterSpacing: 2,
              }}
            >
              {l.t}
            </div>
          );
        })}
        {/* Center crosshair */}
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: 0,
            bottom: 0,
            width: 2,
            background: GOLD,
            transform: 'translateX(-50%)',
          }}
        />
      </div>
      <div
        style={{
          marginTop: 6,
          textAlign: 'center',
          fontFamily: FONT_BODY,
          fontSize: 18,
          fontWeight: 600,
          letterSpacing: 2,
          color: GOLD,
        }}
      >
        {Math.round(az)}°
      </div>
    </div>
  );
};
