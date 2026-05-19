// TilesScene — reusable Three canvas wrapping Google Photorealistic 3D Tiles.
// Every 3D scene in the video (Aubrey Butte panoramic + 10 peak orbits) mounts
// this component.
//
// CRITICAL: scene children (camera rig, overlays, markers) MUST be mounted
// inside the EastNorthUpFrame so they inherit `tiles.group.matrixWorld *
// enuMatrix`. Without this, the default world-space camera sits at the scene
// origin but the tiles live at ECEF coordinates millions of meters away and
// nothing renders.
//
// Tile streaming: Google Photorealistic 3D Tiles is hierarchical and LOD-
// refined — the first `load-tile-set` event only means the root JSON arrived.
// For a stable Remotion still we block capture (via delayRender) until we've
// seen at least one tile model load AND then had a quiet period with no new
// loads. A generous timeout covers cold network starts.

import React, { useCallback, useEffect, useRef } from 'react';
import { continueRender, delayRender } from 'remotion';
import { ThreeCanvas } from '@remotion/three';
import * as THREE from 'three';
import {
  EastNorthUpFrame,
  TilesAttributionOverlay,
  TilesPlugin,
  TilesRenderer,
} from '3d-tiles-renderer/r3f';
import { GoogleCloudAuthPlugin } from '3d-tiles-renderer/plugins';

import { GOOGLE_MAPS_KEY, HEIGHT, WIDTH } from './config';

type TilesSceneProps = {
  /** Origin lat/lon for the EastNorthUpFrame (camera's local 0,0,0). */
  origin: { lat: number; lon: number; height?: number };
  /** Camera + content children rendered inside the ENU frame. */
  children: React.ReactNode;
  /** Optional override for canvas size. */
  width?: number;
  height?: number;
  /** Retained for API compatibility; camera-level props now live on CameraRig. */
  fov?: number;
  near?: number;
  far?: number;
  /**
   * Override tile-loading release thresholds. Defaults match the Cascade
   * Peaks orbit shots (95 loads / 10s quiet / 225s cap). Stills and tighter
   * framings can use much lower values.
   */
  minLoads?: number;
  quietMs?: number;
  maxWaitMs?: number;
};

export const TilesScene: React.FC<TilesSceneProps> = ({
  origin,
  children,
  width = WIDTH,
  height = HEIGHT,
  minLoads,
  quietMs,
  maxWaitMs,
}) => {
  if (!GOOGLE_MAPS_KEY) {
    throw new Error(
      'Cascade Peaks: set REMOTION_GOOGLE_MAPS_KEY or NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in repo .env.local (remotion.config syncs it into video/cascade-peaks/.env).',
    );
  }
  // delayRender handle held until tile loading is stable.
  const handleRef = useRef<number | null>(null);
  const releasedRef = useRef(false);
  const lastLoadRef = useRef<number>(Date.now());
  const loadCountRef = useRef(0);
  // Allow up to ~230s for the first batch to stream in (default).
  const MAX_WAIT_MS = maxWaitMs ?? 225_000;
  // Require at least this many tile/model loads before considering release.
  // Google Photorealistic 3D Tiles stream many tiles per LOD; a handful isn't
  // enough for the camera's current view. Bumped from 12 → 20 → 40 → 95 because
  // some peak configs (Washington's plug-dome spire, North Sister's jagged
  // summit) need more LOD detail in the foreground — early release produced
  // tile-tear artifacts and missing summit geometry. Stills with tight framing
  // can pass a much lower override (~25).
  const MIN_LOADS = minLoads ?? 95;
  // Quiet period with no new loads that signals "stable for now".
  const QUIET_MS = quietMs ?? 10_000;

  useEffect(() => {
    handleRef.current = delayRender('cascade-peaks-tiles-loading', {
      timeoutInMilliseconds: MAX_WAIT_MS,
    });

    const mountedAt = Date.now();
    const interval = setInterval(() => {
      if (releasedRef.current) return;

      const now = Date.now();
      const quiet = now - lastLoadRef.current;
      const elapsed = now - mountedAt;

      // Release when: (a) we've seen enough loads AND a quiet period, OR
      // (b) we've been waiting forever and need to unblock (safety net).
      const hasEnoughLoads = loadCountRef.current >= MIN_LOADS;
      const wasQuiet = quiet > QUIET_MS;
      const wayTooLong = elapsed > MAX_WAIT_MS - 2000;

      if ((hasEnoughLoads && wasQuiet) || wayTooLong) {
        releasedRef.current = true;
        if (handleRef.current !== null) continueRender(handleRef.current);
        clearInterval(interval);
      }
    }, 300);

    return () => {
      clearInterval(interval);
      if (handleRef.current !== null && !releasedRef.current) {
        releasedRef.current = true;
        continueRender(handleRef.current);
      }
    };
  }, []);

  const bumpLoad = useCallback(() => {
    loadCountRef.current += 1;
    lastLoadRef.current = Date.now();
  }, []);

  return (
    <ThreeCanvas
      width={width}
      height={height}
      gl={{
        antialias: true,
        preserveDrawingBuffer: true,
        toneMapping: THREE.ACESFilmicToneMapping,
        outputColorSpace: THREE.SRGBColorSpace,
      }}
      frameloop="always"
    >
      {/* Subtle atmospheric haze — 3D Tiles already include some baked fog,
          but a touch of distance falloff helps the depth read on mobile. */}
      <fog attach="fog" args={['#aac0d8', 12_000, 120_000]} />
      <color attach="background" args={['#0a1a2e']} />

      {/* Key light — warm, high angle to accent snow on volcanoes. */}
      <directionalLight
        position={[50_000, 80_000, 30_000]}
        intensity={1.1}
        color={'#fff1d9'}
      />
      <hemisphereLight
        intensity={0.45}
        color={'#bcd6ef'}
        groundColor={'#2a2418'}
      />
      <ambientLight intensity={0.25} />

      <TilesRenderer
        url="https://tile.googleapis.com/v1/3dtiles/root.json"
        errorTarget={2}
        errorThreshold={40}
        lruCache-minBytesSize={50 * 1024 * 1024}
        lruCache-maxBytesSize={180 * 1024 * 1024}
        downloadQueue-maxJobs={20}
        parseQueue-maxJobs={8}
        onLoadTileSet={bumpLoad}
        onLoadModel={bumpLoad}
      >
        <TilesPlugin
          plugin={GoogleCloudAuthPlugin}
          args={[
            {
              apiToken: GOOGLE_MAPS_KEY,
              autoRefreshToken: true,
            },
          ]}
        />
        <EastNorthUpFrame
          lat={(origin.lat * Math.PI) / 180}
          lon={(origin.lon * Math.PI) / 180}
          height={origin.height ?? 0}
        >
          {children}
        </EastNorthUpFrame>
        {/* Google attribution must be visible per TOS. */}
        <TilesAttributionOverlay />
      </TilesRenderer>
    </ThreeCanvas>
  );
};
