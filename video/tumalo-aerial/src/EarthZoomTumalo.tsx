// EarthZoomTumalo — real Photorealistic 3D Tiles earth-zoom from low orbit
// down to 19496 Tumalo Reservoir Rd, Bend OR.

import React, { useEffect, useRef } from 'react';
import { useCurrentFrame, AbsoluteFill } from 'remotion';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

import { TilesScene } from './TilesScene';
import { ParcelOverlay } from './ParcelOverlay';
import { clamp, easeInOutQuart } from './easing';

const TUMALO_LAT = 44.138729;
const TUMALO_LON = -121.349064;
const TUMALO_GROUND_M = 1020;

const FPS = 30;
const TOTAL_SEC = 10;
const TOTAL_FRAMES = TOTAL_SEC * FPS;

const ALT_START_M = 80_000;
// Final altitude tightened 2026-05-20 per Matt review: 250m read as
// "neighborhood" — the final frame should clearly be THE PARCEL, not the
// area. 100m brings 19496 Tumalo Reservoir Rd's 2.28-acre lot to fill the
// frame at the end of the zoom.
const ALT_END_M = 100;
const AZIMUTH_START_DEG = -20;
const AZIMUTH_END_DEG = 55;
const PITCH_START_DEG = 85;
// Tighter pitch at end (was 35°) so the final frame is more top-down on
// the parcel — pairs with the lower altitude for parcel-level framing.
const PITCH_END_DEG = 28;
const FOV_DEG = 38;

const ZoomCameraRig: React.FC = () => {
  const frame = useCurrentFrame();
  const cameraRef = useRef<THREE.PerspectiveCamera>(null);
  const set = useThree((s) => s.set);
  const size = useThree((s) => s.size);

  useEffect(() => {
    if (cameraRef.current) {
      set({ camera: cameraRef.current });
      cameraRef.current.aspect = size.width / size.height;
      cameraRef.current.updateProjectionMatrix();
    }
  }, [set, size]);

  useFrame(() => {
    const cam = cameraRef.current;
    if (!cam) return;
    const tRaw = clamp(frame / TOTAL_FRAMES, 0, 1);
    const t = easeInOutQuart(tRaw);
    const logStart = Math.log(ALT_START_M);
    const logEnd = Math.log(ALT_END_M);
    const altitudeM = Math.exp(logStart + (logEnd - logStart) * t);
    const azDeg = AZIMUTH_START_DEG + (AZIMUTH_END_DEG - AZIMUTH_START_DEG) * t;
    const pitchDeg = PITCH_START_DEG + (PITCH_END_DEG - PITCH_START_DEG) * t;
    const az = (azDeg * Math.PI) / 180;
    const pitch = (pitchDeg * Math.PI) / 180;
    const distance = altitudeM / Math.tan(pitch);
    const camPos = new THREE.Vector3(
      -Math.sin(az) * distance,
      -Math.cos(az) * distance,
      altitudeM,
    );
    const target = new THREE.Vector3(0, 0, 0);
    const up = new THREE.Vector3(0, 0, 1);
    const m = new THREE.Matrix4();
    m.lookAt(camPos, target, up);
    cam.up.copy(up);
    cam.position.copy(camPos);
    cam.quaternion.setFromRotationMatrix(m);
  });

  return (
    <perspectiveCamera
      ref={cameraRef}
      fov={FOV_DEG}
      near={5}
      far={1_000_000}
    />
  );
};

// Brand overlay — TOP eyebrow only (locked 2026-05-20 per Matt review).
// The bottom 144px navy bar that used to live here got overlaid by the IG/
// TikTok/FB platform action UI (caption box + engagement chrome occupies
// the bottom ~440px of a 1080×1920 frame). Brand attribution now anchors
// at the top eyebrow only — inside the working safe zone per
// video_production_skills/safe-zones/SKILL.md.
//
// The brand wordmark + tagline + contact line moved to the dedicated
// EndCard frame at t=9.5–10s (separate Sequence in Root.tsx, not in
// this overlay).
const BrandOverlay: React.FC = () => {
  const frame = useCurrentFrame();
  const t = clamp(frame / TOTAL_FRAMES, 0, 1);
  const titleOpacity =
    t < 0.18 ? t / 0.18 : t > 0.85 ? Math.max(0, (1 - t) / 0.15) : 1;
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div
        style={{
          position: 'absolute',
          top: '14%',
          left: 0,
          right: 0,
          textAlign: 'center',
          opacity: titleOpacity,
          color: '#faf8f4',
          textShadow: '0 2px 24px rgba(0,0,0,0.55), 0 0 8px rgba(0,0,0,0.4)',
        }}
      >
        <div
          style={{
            fontFamily: 'Amboqia Boriango, Playfair Display, serif',
            fontSize: 72,
            lineHeight: 1.05,
            letterSpacing: '-0.01em',
          }}
        >
          19496 Tumalo Reservoir Rd
        </div>
        <div
          style={{
            fontFamily: 'Azo Sans, Geist, system-ui, sans-serif',
            fontSize: 22,
            letterSpacing: '0.18em',
            marginTop: 14,
            textTransform: 'uppercase',
          }}
        >
          Bend  ·  Oregon  ·  2.28 acres
        </div>
      </div>
      {/* Bottom navy bar removed 2026-05-20. Use the dedicated EndCard frame at t=9.5–10s for brand attribution. */}
    </AbsoluteFill>
  );
};

export const EarthZoomTumalo: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <TilesScene
        origin={{ lat: TUMALO_LAT, lon: TUMALO_LON, height: TUMALO_GROUND_M }}
        minLoads={60}
        quietMs={8_000}
        maxWaitMs={240_000}
      >
        <ZoomCameraRig />
        {/* Lot polygon overlay — Deschutes County GIS DIAL Taxlot 161136D000601.
            Fades in during the final 30% of the zoom (t=7s to t=10s) so the
            viewer sees the actual property boundary at the end of the reveal. */}
        <ParcelOverlay
          originLat={TUMALO_LAT}
          originLon={TUMALO_LON}
          totalFrames={TOTAL_FRAMES}
          fadeStart={0.70}
        />
      </TilesScene>
      <BrandOverlay />
    </AbsoluteFill>
  );
};
