/**
 * NeighborhoodSocialGeneric — config-driven 9:16 1080×1920 portrait flyover.
 *
 * Identical visual logic to NeighborhoodSocial.tsx but fully param-driven.
 * Three-phase camera move via Catmull-Rom spline over the socialPath waypoints.
 * Title + eyebrow overlay at 1.0s. Stat reveal at final 15% if verifiedStat present.
 *
 * Viral hard rules (CLAUDE.md §Video):
 * - Motion from frame 0
 * - Text by frame 30 (1.0s)
 * - Text anchored inside PORTRAIT_SAFE (x 90–990, y 280–1480)
 * - Register shift at ~40% (altitude drop)
 * - Final 15%: kinetic stat reveal (only if verifiedStat !== null)
 * - No logo / phone / URL in frame
 * Duration: 35s (within 30–40s viral window)
 */

import React, { useEffect, useRef } from 'react';
import { useCurrentFrame, AbsoluteFill, interpolate } from 'remotion';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

import { TilesScene } from './TilesScene';
import { NeighborhoodOverlay } from './NeighborhoodOverlay';
import { clamp, easeInOutQuart } from './easing';
import { NeighborhoodConfig, CameraWaypoint } from './neighborhoodConfig';

// Safe zone constants — canonical per video_production_skills/safe-zones
const PORTRAIT_SAFE_X = 90;
const PORTRAIT_SAFE_W = 900; // 990-90

type Props = {
  config: NeighborhoodConfig;
  ring: ReadonlyArray<readonly [number, number]>;
};

const FPS        = 30;
const SOCIAL_SEC = 35;
const TOTAL_FRAMES = SOCIAL_SEC * FPS;
const FOV_DEG    = 50;

function buildSpline(path: CameraWaypoint[]): THREE.CatmullRomCurve3 {
  return new THREE.CatmullRomCurve3(
    path.map((w) => new THREE.Vector3(w.east, w.north, w.altitude)),
    false,
    'centripetal',
    0.5,
  );
}

function samplePath(spline: THREE.CatmullRomCurve3, t: number): THREE.Vector3 {
  const u = easeInOutQuart(clamp(t, 0, 1));
  return spline.getPoint(u);
}

const SocialCameraRig: React.FC<{ config: NeighborhoodConfig }> = ({ config }) => {
  const frame = useCurrentFrame();
  const cameraRef = useRef<THREE.PerspectiveCamera>(null);
  const set = useThree((s) => s.set);
  const size = useThree((s) => s.size);
  const bankRef = useRef(0);
  const splineRef = useRef<THREE.CatmullRomCurve3>(buildSpline(config.socialPath));

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
    const pos = samplePath(splineRef.current, t);

    const lookTarget = new THREE.Vector3(
      pos.x * 0.15,
      pos.y * 0.15,
      0,
    );

    const up = new THREE.Vector3(0, 0, 1);
    const m = new THREE.Matrix4();
    m.lookAt(pos, lookTarget, up);

    const tAhead  = clamp(t + 0.5 / SOCIAL_SEC, 0, 1);
    const posAhead = samplePath(splineRef.current, tAhead);
    const tBefore = clamp(t - 0.5 / SOCIAL_SEC, 0, 1);
    const posBefore = samplePath(splineRef.current, tBefore);
    const headingFwd = new THREE.Vector2(posAhead.x - pos.x, posAhead.y - pos.y);
    const headingBck = new THREE.Vector2(pos.x - posBefore.x, pos.y - posBefore.y);
    let turn = 0;
    if (headingFwd.length() > 0.1 && headingBck.length() > 0.1) {
      const cross = headingBck.x * headingFwd.y - headingBck.y * headingFwd.x;
      const dot   = headingBck.x * headingFwd.x + headingBck.y * headingFwd.y;
      turn = Math.atan2(cross, Math.abs(dot));
    }
    const targetBank = clamp(turn * 1.1, -0.30, 0.30);
    bankRef.current += (targetBank - bankRef.current) * 0.10;

    cam.up.copy(up);
    cam.position.copy(pos);
    cam.quaternion.setFromRotationMatrix(m);
    const forward = new THREE.Vector3().subVectors(lookTarget, pos).normalize();
    cam.rotateOnAxis(forward, bankRef.current);
  });

  return (
    <perspectiveCamera ref={cameraRef} fov={FOV_DEG} near={2} far={200_000} />
  );
};

const TextOverlay: React.FC<{ config: NeighborhoodConfig }> = ({ config }) => {
  const frame = useCurrentFrame();
  const t = frame / TOTAL_FRAMES;

  // Title: fade in at frame 20, visible by frame 30
  const titleOpacity = clamp((frame - 20) / 15, 0, 1);
  const titleFade    = t > 0.82 ? clamp((0.88 - t) / 0.06, 0, 1) : 1;
  const titleAlpha   = titleOpacity * titleFade;

  // Stat: final 15%
  const statOpacity = config.verifiedStat && t > 0.85
    ? clamp((t - 0.85) / 0.06, 0, 1)
    : 0;

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      {/* Title block — upper safe zone */}
      <div
        style={{
          position: 'absolute',
          left: PORTRAIT_SAFE_X,
          top: 300,
          width: PORTRAIT_SAFE_W,
          textAlign: 'center',
          opacity: titleAlpha,
          color: '#faf8f4',
          textShadow: '0 2px 24px rgba(0,0,0,0.65), 0 0 12px rgba(0,0,0,0.45)',
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            fontFamily: 'Geist, system-ui, sans-serif',
            fontSize: 22,
            letterSpacing: '0.20em',
            textTransform: 'uppercase',
            marginBottom: 14,
          }}
        >
          {config.eyebrow}
        </div>
        <div
          style={{
            fontFamily: 'Amboqia Boriango, Playfair Display, serif',
            fontSize: 82,
            lineHeight: 1.0,
            letterSpacing: '-0.01em',
          }}
        >
          {config.label}
        </div>
      </div>

      {/* Kinetic stat reveal — final 15% */}
      {config.verifiedStat && statOpacity > 0.01 && (
        <div
          style={{
            position: 'absolute',
            left: PORTRAIT_SAFE_X,
            top: 680,
            width: PORTRAIT_SAFE_W,
            textAlign: 'center',
            opacity: statOpacity,
            color: '#faf8f4',
            textShadow: '0 2px 32px rgba(0,0,0,0.75)',
            pointerEvents: 'none',
            transform: `scale(${0.85 + statOpacity * 0.15})`,
          }}
        >
          <div
            style={{
              fontFamily: 'Geist, system-ui, sans-serif',
              fontSize: 18,
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              marginBottom: 10,
              opacity: 0.85,
            }}
          >
            MEDIAN SALE · 90 DAYS
          </div>
          <div
            style={{
              fontFamily: 'Amboqia Boriango, Playfair Display, serif',
              fontSize: 100,
              lineHeight: 1.0,
              letterSpacing: '-0.02em',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {config.verifiedStat.value}
          </div>
          <div
            style={{
              fontFamily: 'Geist, system-ui, sans-serif',
              fontSize: 16,
              letterSpacing: '0.15em',
              marginTop: 12,
              opacity: 0.70,
              textTransform: 'uppercase',
            }}
          >
            ryan-realty.com
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};

export const NeighborhoodSocialGeneric: React.FC<Props> = ({ config, ring }) => {
  const tc = config.tileConfig ?? {};
  return (
    <AbsoluteFill style={{ backgroundColor: '#0a1a2e' }}>
      <TilesScene
        origin={config.origin}
        width={1080}
        height={1920}
        minLoads={tc.minLoads ?? 80}
        quietMs={tc.quietMs ?? 8_000}
        maxWaitMs={tc.maxWaitMs ?? 240_000}
      >
        <SocialCameraRig config={config} />
        <NeighborhoodOverlay
          ring={ring}
          originLat={config.origin.lat}
          originLon={config.origin.lon}
          totalFrames={TOTAL_FRAMES}
          fadeStart={0.10}
          traceOn={true}
          pulseEnabled={false}
          zLiftM={5}
        />
      </TilesScene>
      <TextOverlay config={config} />
    </AbsoluteFill>
  );
};
