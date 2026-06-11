/**
 * NeighborhoodHeroGeneric — config-driven 16:9 1920×1080 orbital flyover.
 *
 * Accepts a NeighborhoodConfig + preloaded ring array as props.
 * Identical visual logic to NeighborhoodHero.tsx — just param-driven
 * so the same component powers all 27 neighborhood hero renders.
 *
 * Used by Root.tsx for the batch of 26 areas (Tier 1 + Tier 2).
 * The Awbrey Butte pilot uses the original NeighborhoodHero.tsx.
 */

import React, { useEffect, useRef } from 'react';
import { useCurrentFrame, AbsoluteFill } from 'remotion';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

import { TilesScene } from './TilesScene';
import { NeighborhoodOverlay } from './NeighborhoodOverlay';
import { clamp, easeInOutQuart } from './easing';
import { NeighborhoodConfig } from './neighborhoodConfig';

type Props = {
  config: NeighborhoodConfig;
  ring: ReadonlyArray<readonly [number, number]>;
};

const HERO_W = 1920;
const HERO_H = 1080;
const FPS    = 30;
const HERO_SEC    = 15;
const HERO_FRAMES = HERO_SEC * FPS;

const HeroCameraRig: React.FC<{ config: NeighborhoodConfig }> = ({ config }) => {
  const frame = useCurrentFrame();
  const cameraRef = useRef<THREE.PerspectiveCamera>(null);
  const set = useThree((s) => s.set);
  const size = useThree((s) => s.size);
  const { heroOrbit } = config;

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
    const tRaw = clamp(frame / HERO_FRAMES, 0, 1);
    const t = easeInOutQuart(tRaw);

    const azDeg = heroOrbit.azStart + (heroOrbit.azEnd - heroOrbit.azStart) * t;
    const az    = (azDeg * Math.PI) / 180;
    const pitch = (heroOrbit.pitchDeg * Math.PI) / 180;

    const groundRadius = heroOrbit.radiusM * Math.sin(pitch);
    const camEast  = -Math.sin(az) * groundRadius;
    const camNorth = -Math.cos(az) * groundRadius;
    const camAlt   = heroOrbit.altitudeM;

    const pos    = new THREE.Vector3(camEast, camNorth, camAlt);
    const target = new THREE.Vector3(0, 0, 0);
    const up     = new THREE.Vector3(0, 0, 1);

    const m = new THREE.Matrix4();
    m.lookAt(pos, target, up);
    cam.up.copy(up);
    cam.position.copy(pos);
    cam.quaternion.setFromRotationMatrix(m);
    cam.fov = heroOrbit.fovDeg;
    cam.aspect = HERO_W / HERO_H;
    cam.updateProjectionMatrix();
  });

  return (
    <perspectiveCamera
      ref={cameraRef}
      fov={heroOrbit.fovDeg}
      aspect={HERO_W / HERO_H}
      near={10}
      far={300_000}
    />
  );
};

export const NeighborhoodHeroGeneric: React.FC<Props> = ({ config, ring }) => {
  const tc = config.tileConfig ?? {};
  return (
    <AbsoluteFill style={{ backgroundColor: '#0a1a2e' }}>
      <TilesScene
        origin={config.origin}
        width={HERO_W}
        height={HERO_H}
        minLoads={tc.minLoads ?? 80}
        quietMs={tc.quietMs ?? 8_000}
        maxWaitMs={tc.maxWaitMs ?? 240_000}
      >
        <HeroCameraRig config={config} />
        <NeighborhoodOverlay
          ring={ring}
          originLat={config.origin.lat}
          originLon={config.origin.lon}
          totalFrames={HERO_FRAMES}
          fadeStart={0.0}
          pulseEnabled={true}
          zLiftM={5}
        />
      </TilesScene>
    </AbsoluteFill>
  );
};
