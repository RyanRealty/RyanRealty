// FlyoverTumalo — FPV-style banking aerial over 19496 Tumalo Reservoir Rd.

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
const TOTAL_SEC = 12;
const TOTAL_FRAMES = TOTAL_SEC * FPS;

type Waypoint = {
  t: number;
  east: number;
  north: number;
  altitude: number;
  lookEast?: number;
  lookNorth?: number;
  lookAlt?: number;
};

const PATH: Waypoint[] = [
  { t: 0.00, east: -1800, north: -1200, altitude: 900 },
  { t: 0.25, east: -900,  north: -700,  altitude: 500 },
  { t: 0.50, east: -150,  north: -250,  altitude: 200 },
  { t: 0.70, east: 500,   north: 100,   altitude: 250 },
  { t: 0.88, east: 900,   north: 700,   altitude: 600 },
  { t: 1.00, east: 600,   north: 800,   altitude: 800 },
];

const FOV_DEG = 50;

function lerpWaypoints(t: number): { pos: THREE.Vector3; target: THREE.Vector3 } {
  let i = 0;
  while (i < PATH.length - 1 && PATH[i + 1].t < t) i++;
  const a = PATH[i];
  const b = PATH[Math.min(i + 1, PATH.length - 1)];
  const segT = (t - a.t) / Math.max(b.t - a.t, 1e-6);
  const eased = easeInOutQuart(clamp(segT, 0, 1));
  const east = a.east + (b.east - a.east) * eased;
  const north = a.north + (b.north - a.north) * eased;
  const alt = a.altitude + (b.altitude - a.altitude) * eased;
  return {
    pos: new THREE.Vector3(east, north, alt),
    target: new THREE.Vector3(0, 0, 0),
  };
}

const FlyoverCameraRig: React.FC = () => {
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
    const t = clamp(frame / TOTAL_FRAMES, 0, 1);
    const { pos, target } = lerpWaypoints(t);
    const tNext = clamp((frame + 1) / TOTAL_FRAMES, 0, 1);
    const { pos: posNext } = lerpWaypoints(tNext);
    const horizV = new THREE.Vector2(posNext.x - pos.x, posNext.y - pos.y);
    const bankRad = horizV.length() > 0 ? clamp(horizV.x / 20, -0.45, 0.45) : 0;

    const up = new THREE.Vector3(0, 0, 1);
    const m = new THREE.Matrix4();
    m.lookAt(pos, target, up);
    cam.up.copy(up);
    cam.position.copy(pos);
    cam.quaternion.setFromRotationMatrix(m);
    const forward = new THREE.Vector3().subVectors(target, pos).normalize();
    cam.rotateOnAxis(forward, bankRad);
  });

  return (
    <perspectiveCamera ref={cameraRef} fov={FOV_DEG} near={2} far={50_000} />
  );
};

const BrandOverlay: React.FC = () => {
  const frame = useCurrentFrame();
  const t = clamp(frame / TOTAL_FRAMES, 0, 1);
  const eyebrowOpacity = clamp((t - 0.05) / 0.1, 0, 1) * (t > 0.85 ? Math.max(0, (1 - t) / 0.15) : 1);
  const barOpacity = clamp((t - 0.1) / 0.15, 0, 1);
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div
        style={{
          position: 'absolute',
          top: 60,
          left: 0,
          right: 0,
          textAlign: 'center',
          opacity: eyebrowOpacity,
          color: '#faf8f4',
          textShadow: '0 2px 16px rgba(0,0,0,0.5)',
        }}
      >
        <div style={{ fontFamily: 'Azo Sans, Geist, system-ui, sans-serif', fontSize: 22, letterSpacing: '0.20em', textTransform: 'uppercase' }}>
          Tumalo  ·  Bend  ·  Oregon
        </div>
        <div style={{ fontFamily: 'Amboqia Boriango, Playfair Display, serif', fontSize: 60, marginTop: 12, letterSpacing: '-0.005em' }}>
          2.28 acres on Reservoir Rd
        </div>
      </div>
      <div
        style={{
          position: 'absolute',
          left: 0, right: 0, bottom: 0,
          height: 144,
          background: '#102742',
          opacity: barOpacity,
          color: '#faf8f4',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 36px',
        }}
      >
        <div style={{ fontFamily: 'Amboqia Boriango, Playfair Display, serif', fontSize: 36 }}>Ryan Realty</div>
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

export const FlyoverTumalo: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <TilesScene
        origin={{ lat: TUMALO_LAT, lon: TUMALO_LON, height: TUMALO_GROUND_M }}
        minLoads={50}
        quietMs={5_000}
        maxWaitMs={180_000}
      >
        <FlyoverCameraRig />
      </TilesScene>
      <BrandOverlay />
    </AbsoluteFill>
  );
};
