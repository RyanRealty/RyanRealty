/**
 * NeighborhoodOverlay — draws the authoritative neighborhood boundary polygon
 * on the 3D tiles terrain. Reusable across all 27 neighborhood flyovers.
 *
 * Color spec: navy #102742 stroke, 8% navy fill, gently pulsing opacity.
 * Polygon ring: GeoJSON coordinates passed as a prop (fetched via
 * boundary_geojson RPC — never hand-drawn per GIS rule).
 *
 * Projection: same lngLatToENU approach as ParcelOverlay.tsx, relative to the
 * EastNorthUpFrame origin. The polygon is placed 5m above terrain to avoid
 * z-fighting with the tiles surface.
 */

import React, { useMemo } from 'react';
import { useCurrentFrame } from 'remotion';
import * as THREE from 'three';
import { clamp, pulse } from './easing';

/** A single [lng, lat] coordinate pair. */
type LngLat = readonly [number, number];

/** Project (lng, lat) → local ENU (east_m, north_m) about an origin. */
function lngLatToENU(
  lng: number,
  lat: number,
  originLng: number,
  originLat: number,
): [number, number] {
  const cosLat = Math.cos((originLat * Math.PI) / 180);
  const east_m = (lng - originLng) * 111_000 * cosLat;
  const north_m = (lat - originLat) * 111_000;
  return [east_m, north_m];
}

type Props = {
  /** Exterior ring coordinates in [lng, lat] order (GeoJSON convention). */
  ring: ReadonlyArray<LngLat>;
  /** Scene origin latitude — must match the EastNorthUpFrame origin. */
  originLat: number;
  /** Scene origin longitude. */
  originLon: number;
  /** Total composition frames — for timing the fade + pulse animation. */
  totalFrames: number;
  /** Fraction of totalFrames at which the boundary starts fading in. Default 0.0 (visible from start). */
  fadeStart?: number;
  /** Z-offset above terrain in meters. Default 5m. */
  zLiftM?: number;
  /**
   * If true, the polygon "traces on" — the line draws progressively from
   * fadeStart to fadeStart+0.25, then holds full opacity. Social cut uses this
   * for a kinetic reveal; hero loop holds constant opacity from t=0.
   */
  traceOn?: boolean;
  /**
   * Pulse the fill alpha gently (like a heartbeat) to call attention to the
   * boundary without being distracting on a muted autoplay hero.
   */
  pulseEnabled?: boolean;
};

export const NeighborhoodOverlay: React.FC<Props> = ({
  ring,
  originLat,
  originLon,
  totalFrames,
  fadeStart = 0.0,
  zLiftM = 5,
  traceOn = false,
  pulseEnabled = false,
}) => {
  const frame = useCurrentFrame();
  const t = clamp(frame / totalFrames, 0, 1);

  // Overall opacity — fades in after fadeStart over ~8% of total duration.
  const fadeWindow = 0.08;
  const baseOpacity = clamp((t - fadeStart) / fadeWindow, 0, 1);

  // Pulse effect on the fill: slow sine wave, amplitude ±20% of fill base.
  const pulseFactor = pulseEnabled
    ? 1 + 0.2 * Math.sin((t * Math.PI * 2 * 3) - Math.PI / 2)
    : 1;

  // Project ring to ENU once.
  const points = useMemo(() => {
    return ring.map(([lng, lat]) => lngLatToENU(lng, lat, originLon, originLat));
  }, [ring, originLat, originLon]);

  // Line geometry (closed loop).
  const lineGeom = useMemo(() => {
    const verts = points.map(([e, n]) => new THREE.Vector3(e, n, zLiftM));
    return new THREE.BufferGeometry().setFromPoints(verts);
  }, [points, zLiftM]);

  // Fill geometry (Shape → ShapeGeometry, then rotated so XY is the ENU ground plane).
  const fillGeom = useMemo(() => {
    const shape = new THREE.Shape();
    if (points.length === 0) return new THREE.ShapeGeometry(shape);
    shape.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) {
      shape.lineTo(points[i][0], points[i][1]);
    }
    shape.closePath();
    return new THREE.ShapeGeometry(shape);
  }, [points]);

  if (baseOpacity < 0.01) return null;

  // Navy fill at 8% opacity (design spec). Multiply by pulse and base fade.
  const fillOpacity = baseOpacity * 0.08 * pulseFactor;
  // Navy stroke at full opacity once faded in.
  const strokeOpacity = baseOpacity;

  return (
    <group>
      {/* Navy fill — 8% opacity, sits just below the stroke line. */}
      <mesh geometry={fillGeom} position={[0, 0, zLiftM - 2]}>
        <meshBasicMaterial
          color={'#102742'}
          transparent
          opacity={fillOpacity}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Primary navy outline — the brand boundary stroke. */}
      <lineLoop>
        <primitive object={lineGeom} attach={'geometry'} />
        <lineBasicMaterial
          color={'#102742'}
          transparent
          opacity={strokeOpacity}
          depthWrite={false}
          linewidth={2}
        />
      </lineLoop>

      {/* Secondary cream outline just above — provides contrast against dark terrain. */}
      <lineLoop position={[0, 0, 1.5]}>
        <primitive object={lineGeom} attach={'geometry'} />
        <lineBasicMaterial
          color={'#faf8f4'}
          transparent
          opacity={strokeOpacity * 0.55}
          depthWrite={false}
          linewidth={1}
        />
      </lineLoop>
    </group>
  );
};
