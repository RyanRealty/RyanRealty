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

// Catmull-Rom spline through the 6 waypoints — produces a path that is
// continuous in position + velocity (C1). The previous linear segment-lerp
// had visible velocity discontinuities at each waypoint, which is what
// Matt called "choppy" on 2026-05-19. Switching to Catmull-Rom + a global
// eased time parameter fixes the corners.
//
// Implementation: build a tension=0.5 (centripetal) spline through east,
// north, altitude separately. THREE.CatmullRomCurve3 handles all three
// dimensions natively if we treat (east, north, altitude) as (x, y, z).

const SPLINE_POINTS = PATH.map(
  (w) => new THREE.Vector3(w.east, w.north, w.altitude),
);
const SPLINE_TS = PATH.map((w) => w.t);
const POSITION_CURVE = new THREE.CatmullRomCurve3(SPLINE_POINTS, false, 'centripetal', 0.5);

function lerpWaypoints(t: number): { pos: THREE.Vector3; target: THREE.Vector3 } {
  // Map global t (0..1) onto the spline's parameter (0..1) — both
  // parameterized over the same range, so identity. Apply a gentle global
  // ease so the camera accelerates from a stop and slows toward the end.
  const u = easeInOutQuart(clamp(t, 0, 1));
  const pos = POSITION_CURVE.getPoint(u);
  return {
    pos,
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

  // Smoothed bank — sample velocity from the spline tangent and low-pass
  // filter across frames. The previous frame-to-frame raw difference
  // produced abrupt roll jumps at waypoints; the smoothed version eases
  // through corners.
  const bankRef = useRef(0);
  const TURN_LOOK_AHEAD_SEC = 0.6;

  useFrame(() => {
    const cam = cameraRef.current;
    if (!cam) return;
    const t = clamp(frame / TOTAL_FRAMES, 0, 1);
    const { pos, target } = lerpWaypoints(t);
    // Sample TURN_LOOK_AHEAD_SEC ahead on the spline to determine where we
    // ARE heading, not just our instantaneous velocity. Smoother bank cue.
    const tAhead = clamp(t + TURN_LOOK_AHEAD_SEC / TOTAL_SEC, 0, 1);
    const { pos: posAhead } = lerpWaypoints(tAhead);
    const heading = new THREE.Vector2(posAhead.x - pos.x, posAhead.y - pos.y);
    // Bank based on horizontal turn rate — sample TURN_LOOK_AHEAD_SEC before
    // AND after to estimate the curvature, then map to bank angle.
    const tBefore = clamp(t - TURN_LOOK_AHEAD_SEC / TOTAL_SEC, 0, 1);
    const { pos: posBefore } = lerpWaypoints(tBefore);
    const headingBefore = new THREE.Vector2(pos.x - posBefore.x, pos.y - posBefore.y);
    let turn = 0;
    if (heading.length() > 0.1 && headingBefore.length() > 0.1) {
      const cross = headingBefore.x * heading.y - headingBefore.y * heading.x;
      const dot = headingBefore.x * heading.x + headingBefore.y * heading.y;
      turn = Math.atan2(cross, Math.abs(dot)); // signed turn angle
    }
    // Target bank: -0.35..0.35 rad mapped from turn rate, with damping.
    const targetBank = clamp(turn * 1.2, -0.35, 0.35);
    // First-order low-pass filter — every frame, ease bank toward target.
    // Frame-rate-independent decay so the visual smoothing is consistent.
    const decay = 0.12; // higher = snappier; lower = smoother
    bankRef.current += (targetBank - bankRef.current) * decay;

    const up = new THREE.Vector3(0, 0, 1);
    const m = new THREE.Matrix4();
    m.lookAt(pos, target, up);
    cam.up.copy(up);
    cam.position.copy(pos);
    cam.quaternion.setFromRotationMatrix(m);
    const forward = new THREE.Vector3().subVectors(target, pos).normalize();
    cam.rotateOnAxis(forward, bankRef.current);
  });

  return (
    <perspectiveCamera ref={cameraRef} fov={FOV_DEG} near={2} far={50_000} />
  );
};

// Brand overlay — TOP eyebrow only. Bottom 144px navy bar removed 2026-05-21
// per Matt review (was overlaid by IG/TikTok/FB action UI per safe-zones rule).
// Eyebrow visible from t=0 to satisfy the first-frame thumbnail gate (the
// flyover start pose at the highest waypoint is sky-heavy without title).
const BrandOverlay: React.FC = () => {
  const frame = useCurrentFrame();
  const t = clamp(frame / TOTAL_FRAMES, 0, 1);
  // Visible from t=0 (was t > 0.05 fade-in) — needed for thumbnail.
  const eyebrowOpacity = t > 0.85 ? Math.max(0, (1 - t) / 0.15) : 1;
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
      {/* Bottom navy bar removed 2026-05-21 — covered by platform action UI per safe-zones rule. */}
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
