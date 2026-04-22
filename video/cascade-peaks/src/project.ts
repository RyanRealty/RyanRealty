// World-to-screen projection for HUD markers in the Aubrey Butte pan.
//
// We reproduce the same camera math used by <PanCameraRig/> so that 2D HUD
// labels can be placed over the canvas at the exact pixel where each peak
// lives in the frame. This keeps the 2D overlay logic decoupled from the
// Three.js canvas (no drei <Html>, no camera ref wiring through R3F context).

import { HEIGHT, WIDTH } from './config';

// Matches the FOV used by PanCameraRig in AubreyButtePan (32°).
const FOV_V_DEG = 32;
const ASPECT = WIDTH / HEIGHT;
const FOV_V_RAD = (FOV_V_DEG * Math.PI) / 180;
const TAN_HALF_V = Math.tan(FOV_V_RAD / 2);
const TAN_HALF_H = TAN_HALF_V * ASPECT;

export type ProjectedPoint = {
  /** Pixel X in the 1080x1920 frame. */
  x: number;
  /** Pixel Y in the 1080x1920 frame. */
  y: number;
  /** Depth along camera forward in meters (>0 = in front of camera). */
  depth: number;
  /** Whether the point lies inside the visible frame. */
  visible: boolean;
  /** Horizontal delta in radians from camera center (+right, -left). */
  hAngle: number;
};

type ProjectOpts = {
  cameraAzimuthDeg: number; // compass bearing the camera is looking at
  cameraPitchDeg?: number; // negative = looking down
  cameraHeightM?: number; // height above ENU origin
  /** Target position in local ENU meters (east, north, up). */
  target: [number, number, number];
};

/**
 * Project a local ENU point to screen-space pixels given a camera azimuth.
 */
// Mean Earth radius in meters. Used to correct ENU projection for Earth
// curvature: a flat ENU tangent plane at the camera is tangent to the globe,
// but at ~50+ km distance the real ground drops measurably below that plane.
// 3D Tiles renderer honors real ECEF coords (peaks appear curvature-dropped),
// so our flat ENU projection must apply the same correction or the dots
// float above the actual summits.
const EARTH_R_M = 6_371_000;

export const projectEnuToScreen = ({
  cameraAzimuthDeg,
  cameraPitchDeg = -1.5,
  cameraHeightM = 0,
  target,
}: ProjectOpts): ProjectedPoint => {
  const az = (cameraAzimuthDeg * Math.PI) / 180;
  const pitch = (cameraPitchDeg * Math.PI) / 180;

  const sinAz = Math.sin(az);
  const cosAz = Math.cos(az);
  const sinP = Math.sin(pitch);
  const cosP = Math.cos(pitch);

  // Peak offset from camera (camera at ENU 0,0,cameraHeightM).
  const [e, n, u] = target;
  // Apply curvature drop: for horizontal ENU distance d, the true Earth
  // surface sits ~d²/(2R) below the flat ENU tangent plane at the origin.
  // Effect is tiny for <20 km but material at 80-100 km (Aubrey→Jefferson).
  const dHoriz = Math.sqrt(e * e + n * n);
  const curvatureDrop = (dHoriz * dHoriz) / (2 * EARTH_R_M);
  const dz = u - cameraHeightM - curvatureDrop;

  // Camera basis (ENU):
  //   forward = (sinAz*cosP, cosAz*cosP, sinP)
  //   right   = (cosAz, -sinAz, 0)
  //   up      = (-sinAz*sinP, -cosAz*sinP, cosP)
  const xCam = e * cosAz - n * sinAz;
  const yCam = -e * sinAz * sinP - n * cosAz * sinP + dz * cosP;
  const zCam = e * sinAz * cosP + n * cosAz * cosP + dz * sinP;

  // Horizontal angle from look vector, signed (+ right, - left).
  const hAngle = Math.atan2(xCam, zCam);

  if (zCam <= 1) {
    // Behind camera or degenerate — emit an invisible marker.
    return { x: -9999, y: -9999, depth: zCam, visible: false, hAngle };
  }

  const ndcX = (xCam / zCam) / TAN_HALF_H;
  const ndcY = -(yCam / zCam) / TAN_HALF_V;

  const pxX = ((ndcX + 1) / 2) * WIDTH;
  const pxY = ((ndcY + 1) / 2) * HEIGHT;

  const visible =
    ndcX >= -1 && ndcX <= 1 && ndcY >= -1 && ndcY <= 1 && zCam > 1;

  return { x: pxX, y: pxY, depth: zCam, visible, hAngle };
};
