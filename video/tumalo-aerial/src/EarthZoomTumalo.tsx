// EarthZoomTumalo — real Photorealistic 3D Tiles earth-zoom from low orbit
// down to 19496 Tumalo Reservoir Rd, Bend OR.

import React, { useEffect, useRef } from 'react';
import { useCurrentFrame, AbsoluteFill } from 'remotion';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

import { TilesScene } from './TilesScene';
import { clamp, easeInOutQuart } from './easing';

const TUMALO_LAT = 44.138729;
const TUMALO_LON = -121.349064;
const TUMALO_GROUND_M = 1020;

const FPS = 30;
const TOTAL_SEC = 10;
const TOTAL_FRAMES = TOTAL_SEC * FPS;

const ALT_START_M = 80_000;
const ALT_END_M = 250;
const AZIMUTH_START_DEG = -20;
const AZIMUTH_END_DEG = 55;
const PITCH_START_DEG = 85;
const PITCH_END_DEG = 35;
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

const BrandOverlay: React.FC = () => {
  const frame = useCurrentFrame();
  const t = clamp(frame / TOTAL_FRAMES, 0, 1);
  const titleOpacity =
    t < 0.18 ? t / 0.18 : t > 0.85 ? Math.max(0, (1 - t) / 0.15) : 1;
  const barOpacity = clamp((t - 0.05) / 0.15, 0, 1);
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

      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: 144,
          background: '#102742',
          opacity: barOpacity,
          color: '#faf8f4',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 36px',
        }}
      >
        <div style={{ fontFamily: 'Amboqia Boriango, Playfair Display, serif', fontSize: 36, lineHeight: 1 }}>
          Ryan Realty
        </div>
        <div style={{ fontFamily: 'Azo Sans, Geist, system-ui, sans-serif', fontSize: 18, fontStyle: 'italic', opacity: 0.92 }}>
          It's About Relationships.
        </div>
        <div style={{ fontFamily: 'Azo Sans, Geist, system-ui, sans-serif', fontSize: 17, textAlign: 'right' }}>
          <div>541.213.6706</div>
          <div style={{ opacity: 0.85, fontSize: 14 }}>ryan-realty.com</div>
        </div>
      </div>
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
      </TilesScene>
      <BrandOverlay />
    </AbsoluteFill>
  );
};
