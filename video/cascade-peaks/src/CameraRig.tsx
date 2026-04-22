// CameraRig — the camera MUST live inside the EastNorthUpFrame so it inherits
// the tile set's world transform (tiles.group.matrixWorld * enuMatrix). Without
// this, the default camera sits at world origin but the tiles are at ECEF
// coordinates (~ millions of meters from origin) so nothing renders.
//
// We mount a <perspectiveCamera> as a child of the ENU frame, register it as
// the default camera via useThree().set(), then drive its position/lookAt in
// LOCAL ENU coordinates (+X east, +Y north, +Z up, meters from origin).
//
// Azimuth convention: 0° = looking north (+Y), 90° = looking east (+X),
// measured clockwise. Matches compass bearings.

import React, { useEffect, useRef } from 'react';
import { useCurrentFrame } from 'remotion';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

import { FPS, HEIGHT, WIDTH } from './config';
import { clamp, easeInOutQuart, easeOutCubic } from './easing';

export type PanRigProps = {
  startAzimuthDeg: number;
  endAzimuthDeg: number;
  pitchDeg?: number; // negative = looking down; 0 = horizon
  heightM?: number; // height above ENU origin (default 0 = origin height)
  durationSec: number;
  /** Frame offset from composition start where this scene begins. */
  frameOffset?: number;
  /** Camera FOV (vertical) in degrees. Default 38. */
  fov?: number;
  /** Near/far in meters. */
  near?: number;
  far?: number;
};

const aspect = WIDTH / HEIGHT;

/**
 * Pan camera: fixed position inside the ENU frame, rotates yaw from start →
 * end over the scene. Position uses local ENU (+Z = up, meters).
 */
export const PanCameraRig: React.FC<PanRigProps> = ({
  startAzimuthDeg,
  endAzimuthDeg,
  pitchDeg = -1.5,
  heightM = 0,
  durationSec,
  frameOffset = 0,
  fov = 38,
  near = 50,
  far = 200_000,
}) => {
  const frame = useCurrentFrame();
  const cameraRef = useRef<THREE.PerspectiveCamera>(null);
  const set = useThree((s) => s.set);
  const size = useThree((s) => s.size);

  useEffect(() => {
    if (cameraRef.current) {
      set({ camera: cameraRef.current });
    }
  }, [set]);

  useEffect(() => {
    if (cameraRef.current) {
      cameraRef.current.aspect = size.width / size.height;
      cameraRef.current.updateProjectionMatrix();
    }
  }, [size]);

  useFrame(() => {
    const cam = cameraRef.current;
    if (!cam) return;
    const localFrame = frame - frameOffset;
    const totalFrames = durationSec * FPS;
    const tRaw = clamp(localFrame / totalFrames, 0, 1);
    const t = easeInOutQuart(tRaw);

    const azDeg = startAzimuthDeg + (endAzimuthDeg - startAzimuthDeg) * t;
    const az = (azDeg * Math.PI) / 180;
    const pitch = (pitchDeg * Math.PI) / 180;

    // ENU convention: +X east, +Y north, +Z up. az=0 → look +Y (north).
    // Build the camera's LOCAL rotation matrix — Three.js lookAt interprets
    // the target in world coords, so we compute our own local lookAt matrix
    // and assign quaternion directly.
    const camPos = new THREE.Vector3(0, 0, heightM);
    const fwdX = Math.sin(az) * Math.cos(pitch);
    const fwdY = Math.cos(az) * Math.cos(pitch);
    const fwdZ = Math.sin(pitch);
    const tgtPos = new THREE.Vector3(
      fwdX * 10_000,
      fwdY * 10_000,
      heightM + fwdZ * 10_000,
    );
    const up = new THREE.Vector3(0, 0, 1);
    const m = new THREE.Matrix4();
    m.lookAt(camPos, tgtPos, up);
    cam.up.copy(up);
    cam.position.copy(camPos);
    cam.quaternion.setFromRotationMatrix(m);
  });

  return (
    <perspectiveCamera
      ref={cameraRef}
      fov={fov}
      near={near}
      far={far}
      aspect={aspect}
    />
  );
};

export type OrbitRigProps = {
  /** Target the camera looks at, local ENU meters. Default [0,0,0]. */
  target?: [number, number, number];
  orbitRadiusM: number;
  /** Camera height above target (meters). */
  cameraHeightM: number;
  startAzimuthDeg: number;
  /** Sweep in degrees (clockwise positive). */
  sweepDeg: number;
  durationSec: number;
  frameOffset?: number;
  /** Zoom-in envelope: camera starts at radiusM*zoomStart, ends at radiusM. */
  zoomStart?: number; // default 1.35
  fov?: number;
  near?: number;
  far?: number;
  /**
   * Vertical view-offset in pixels. Shifts the projection's principal point
   * DOWN by this many pixels, which pushes the looked-at target UP in the
   * rendered frame. Useful when the bottom of the frame is covered by a fixed
   * info panel — set to +N to compose the target in the upper portion.
   */
  viewOffsetYPx?: number;
  /** Full render height in pixels — used when viewOffsetYPx is set. */
  fullRenderHeight?: number;
  /** Full render width in pixels — used when viewOffsetYPx is set. */
  fullRenderWidth?: number;
};

/**
 * Orbit camera: circles target at radius/height in local ENU, azimuth sweeps
 * over scene. Mounts the perspectiveCamera INSIDE the ENU frame so it inherits
 * the tile set's world transform — essential for tiles to be visible.
 */
export const OrbitCameraRig: React.FC<OrbitRigProps> = ({
  target = [0, 0, 0],
  orbitRadiusM,
  cameraHeightM,
  startAzimuthDeg,
  sweepDeg,
  durationSec,
  frameOffset = 0,
  zoomStart = 1.35,
  fov = 36,
  near = 50,
  far = 80_000,
  viewOffsetYPx = 0,
  fullRenderHeight = HEIGHT,
  fullRenderWidth = WIDTH,
}) => {
  const frame = useCurrentFrame();
  const cameraRef = useRef<THREE.PerspectiveCamera>(null);
  const set = useThree((s) => s.set);
  const size = useThree((s) => s.size);

  useEffect(() => {
    if (cameraRef.current) {
      set({ camera: cameraRef.current });
    }
  }, [set]);

  useEffect(() => {
    const cam = cameraRef.current;
    if (!cam) return;
    cam.aspect = size.width / size.height;
    // Apply view-offset so the looked-at target renders higher in the frame.
    // setViewOffset( fullW, fullH, x, y, width, height ) picks a sub-rectangle
    // of a larger virtual frame. To push the target UP in the rendered image,
    // we render the BOTTOM portion of a virtual frame that extends below —
    // i.e. sub-rect y-origin is positive. Three.js interprets the offset in
    // CSS-pixel coords (origin top-left).
    if (viewOffsetYPx && viewOffsetYPx > 0) {
      cam.setViewOffset(
        fullRenderWidth,
        fullRenderHeight + viewOffsetYPx,
        0,
        viewOffsetYPx,
        fullRenderWidth,
        fullRenderHeight,
      );
    } else {
      cam.clearViewOffset();
    }
    cam.updateProjectionMatrix();
  }, [size, viewOffsetYPx, fullRenderHeight, fullRenderWidth]);

  useFrame(() => {
    const cam = cameraRef.current;
    if (!cam) return;
    const localFrame = frame - frameOffset;
    const totalFrames = durationSec * FPS;
    const tRaw = clamp(localFrame / totalFrames, 0, 1);
    const tOrbit = easeInOutQuart(tRaw);
    const tZoom = easeOutCubic(tRaw);

    const azDeg = startAzimuthDeg + sweepDeg * tOrbit;
    const az = (azDeg * Math.PI) / 180;

    const radius = orbitRadiusM * (zoomStart + (1 - zoomStart) * tZoom);

    const camX = target[0] + Math.sin(az) * radius;
    const camY = target[1] + Math.cos(az) * radius;
    const camZ = target[2] + cameraHeightM;

    // Build local rotation via Matrix4.lookAt so the camera's quaternion is
    // set in its PARENT frame (the EastNorthUpFrame group). Calling
    // `cam.lookAt(localTarget)` is wrong here because Three.js treats the
    // target as world coords and the camera's parent is not the scene root.
    const camPos = new THREE.Vector3(camX, camY, camZ);
    const tgtPos = new THREE.Vector3(target[0], target[1], target[2]);
    const up = new THREE.Vector3(0, 0, 1);
    const m = new THREE.Matrix4();
    m.lookAt(camPos, tgtPos, up);
    cam.up.copy(up);
    cam.position.copy(camPos);
    cam.quaternion.setFromRotationMatrix(m);
  });

  return (
    <perspectiveCamera
      ref={cameraRef}
      fov={fov}
      near={near}
      far={far}
      aspect={aspect}
    />
  );
};
