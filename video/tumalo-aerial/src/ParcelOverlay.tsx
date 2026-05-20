/**
 * ParcelOverlay — draws the 19496 Tumalo Reservoir Rd tax-lot polygon
 * on the ground at the end of the earth-zoom.
 *
 * Source: Deschutes County GIS (DIAL) Taxlot layer, fetched 2026-05-20
 * via scripts/fetch-deschutes-parcel.mjs.
 *   TAXLOT 161136D000601
 *   Address: 19496 TUMALO RESERVOIR RD
 *   2.27 acres, 7 vertices
 *   Authoritative source per CLAUDE.md feedback_gis_authoritative_only.md.
 *
 * Renders a cream-tinted filled polygon + outline at ground level, fading
 * in during the final 30% of the zoom (t=0.70 to t=1.0). The viewer's eye
 * locks onto the actual parcel boundary at the end of the zoom — turning
 * the earth-zoom from a generic neighborhood reveal into "THIS is the
 * property."
 *
 * Coordinate system: vertices are lat/lng (WGS84). We project to local ENU
 * meters relative to the scene's `EastNorthUpFrame` origin, which is the
 * subject lat/lng. At Tumalo's latitude (44.14°), 1° of longitude ≈ 79,700m.
 */

import React, { useMemo } from 'react';
import { useCurrentFrame } from 'remotion';
import * as THREE from 'three';
import { clamp } from './easing';

// Polygon ring (lng, lat). 7 vertices including the closing duplicate of the first.
// Source: Deschutes County GIS DIAL Taxlot layer, TAXLOT 161136D000601.
const PARCEL_RING_LNGLAT: ReadonlyArray<readonly [number, number]> = [
  [-121.34843268539494, 44.13914050114],
  [-121.34906508498193, 44.13914123155858],
  [-121.34969748456888, 44.139141957464425],
  [-121.34969424075241, 44.13831805501581],
  [-121.34906201723521, 44.13831734650634],
  [-121.34842975958209, 44.138316635418086],
];

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
  /** Scene origin latitude (degrees). Should match the EastNorthUpFrame origin. */
  originLat: number;
  /** Scene origin longitude (degrees). */
  originLon: number;
  /** Total composition frames — used to compute the fade-in window. */
  totalFrames: number;
  /** Fraction of totalFrames at which the polygon starts fading in. Default 0.70. */
  fadeStart?: number;
  /** Z-offset above ground in meters (avoids z-fighting with tiles). Default 4m. */
  zLiftM?: number;
};

export const ParcelOverlay: React.FC<Props> = ({
  originLat,
  originLon,
  totalFrames,
  fadeStart = 0.70,
  zLiftM = 4,
}) => {
  const frame = useCurrentFrame();
  const t = clamp(frame / totalFrames, 0, 1);
  const opacity = clamp((t - fadeStart) / (1 - fadeStart), 0, 1);

  // Project the ring to local ENU once per origin change.
  const points = useMemo(() => {
    return PARCEL_RING_LNGLAT.map(([lng, lat]) =>
      lngLatToENU(lng, lat, originLon, originLat),
    );
  }, [originLat, originLon]);

  // Closed-loop line geometry — vertices include the closing vertex (lineLoop
  // connects last → first automatically; we keep the explicit closing point
  // for the filled-shape build below).
  const lineGeom = useMemo(() => {
    const vertices: THREE.Vector3[] = points.map(
      ([east, north]) => new THREE.Vector3(east, north, zLiftM),
    );
    const geom = new THREE.BufferGeometry().setFromPoints(vertices);
    return geom;
  }, [points, zLiftM]);

  // Filled-area geometry from a THREE.Shape.
  const fillGeom = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) {
      shape.lineTo(points[i][0], points[i][1]);
    }
    shape.closePath();
    return new THREE.ShapeGeometry(shape);
  }, [points]);

  if (opacity < 0.005) return null;

  return (
    <group>
      {/* Filled cream-tinted area — sits 1m above the ground, partial transparency. */}
      <mesh geometry={fillGeom} position={[0, 0, zLiftM - 3]}>
        <meshBasicMaterial
          color={'#faf8f4'}
          transparent
          opacity={opacity * 0.22}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* Outline — cream line at zLiftM. lineLoop closes back to the first vertex automatically. */}
      <lineLoop>
        <primitive object={lineGeom} attach={'geometry'} />
        <lineBasicMaterial color={'#faf8f4'} transparent opacity={opacity} depthWrite={false} />
      </lineLoop>
      {/* A second slightly-lower navy outline — provides contrast against bright terrain. */}
      <lineLoop position={[0, 0, -1]}>
        <primitive object={lineGeom} attach={'geometry'} />
        <lineBasicMaterial color={'#102742'} transparent opacity={opacity * 0.6} depthWrite={false} />
      </lineLoop>
    </group>
  );
};
