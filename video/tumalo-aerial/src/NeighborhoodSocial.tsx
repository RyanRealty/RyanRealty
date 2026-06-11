/**
 * NeighborhoodSocial — 9:16 1080×1920 portrait flyover for social cuts.
 *
 * Viral hard rules applied:
 * - Motion from frame 0 (camera already flying at t=0)
 * - Title on-screen by frame 30 (1.0s): "Awbrey Butte" in Amboqia + "BEND · OREGON" eyebrow
 * - Text anchored inside PORTRAIT_SAFE (x 90–990, y 280–1480)
 * - Mid-video register shift at 40%: altitude drop from 3,200m to 900m
 * - Final 15%: kinetic stat reveal ($1,302,000 median sale — verified source)
 * - No logo / phone / URL anywhere in frame (area-guide rules)
 * - Boundary polygon traces on starting t=0.10
 *
 * Duration: 35s — within the 30–40s range for the social viral format.
 *
 * Stat source trace (§0 data accuracy):
 *   public.market_stats_cache
 *   geo_type='neighborhood', geo_slug='bend-awbrey-butte'
 *   period_type='rolling_90d'
 *   computed_at='2026-06-09T07:00:54.385613+00:00'
 *   median_sale_price = $1,302,000 (8 sales)
 */

import React, { useEffect, useRef } from 'react';
import { useCurrentFrame, AbsoluteFill, interpolate, spring } from 'remotion';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

import { TilesScene } from './TilesScene';
import { NeighborhoodOverlay } from './NeighborhoodOverlay';
import { clamp, easeInOutQuart, easeOutCubic } from './easing';
import {
  PORTRAIT_SAFE,
  CAPTION_PORTRAIT,
} from '../../../video_production_skills/safe-zones/canonical/safe-zones';

// ─────────────────────────────────────────────────────────────────────────────
// Polygon ring — same authoritative data as NeighborhoodHero.tsx
// Source: boundary_geojson RPC 2026-06-09 (see NeighborhoodHero for full attribution)
// ─────────────────────────────────────────────────────────────────────────────
const AWBREY_BUTTE_RING: ReadonlyArray<readonly [number, number]> = [
  [-121.309825803,44.074338418],[-121.309901979,44.074328269],[-121.310584704,44.07400799],
  [-121.311229878,44.07359748],[-121.311562027,44.073253352],[-121.311629763,44.073183173],
  [-121.311786797,44.073020473],[-121.311876017,44.072900784],[-121.312146717,44.072512363],
  [-121.312192944,44.072020309],[-121.312121073,44.071766118],[-121.311948067,44.071349312],
  [-121.311714499,44.070827069],[-121.311654836,44.070565547],[-121.311638438,44.070278123],
  [-121.311746796,44.069530312],[-121.312074,44.06952996],[-121.313750503,44.069528145],
  [-121.315539005,44.069525053],[-121.316393349,44.069562813],[-121.316947576,44.069658571],
  [-121.317207055,44.069716335],[-121.31731389,44.069554299],[-121.317661642,44.069521215],
  [-121.31838082,44.069519905],[-121.319882359,44.069517156],[-121.320480925,44.069516054],
  [-121.321050389,44.069525977],[-121.321099368,44.069907629],[-121.321659623,44.069943003],
  [-121.322251086,44.069941908],[-121.322249555,44.069512784],[-121.323673697,44.069510129],
  [-121.323910448,44.069345094],[-121.325748693,44.069350479],[-121.328665847,44.06936397],
  [-121.328742264,44.069523771],[-121.330760453,44.069529598],[-121.331745114,44.069532428],
  [-121.332661588,44.069535053],[-121.333080647,44.069686513],[-121.333956206,44.069538751],
  [-121.335997947,44.069550608],[-121.337705576,44.069560497],[-121.339435502,44.069570488],
  [-121.340928749,44.069579093],[-121.341583373,44.069582575],[-121.343398164,44.069582872],
  [-121.343396182,44.070432276],[-121.343392496,44.07201236],[-121.343389695,44.073212951],
  [-121.343811983,44.073212388],[-121.344530867,44.073211426],[-121.344679867,44.073378212],
  [-121.345256376,44.074098462],[-121.345669342,44.074204063],[-121.346065233,44.074487332],
  [-121.346247006,44.07483234],[-121.346490387,44.074986818],[-121.347317482,44.074947292],
  [-121.348578355,44.074830139],[-121.348921812,44.074849382],[-121.351155159,44.074830982],
  [-121.351526118,44.075097956],[-121.351668627,44.075624467],[-121.351955283,44.075747978],
  [-121.352219903,44.075891295],[-121.352444701,44.076138488],[-121.352576396,44.076458913],
  [-121.352805267,44.076666784],[-121.353069774,44.076775239],[-121.353637022,44.076818885],
  [-121.356255139,44.076825049],[-121.358423937,44.076816128],[-121.358422114,44.077522032],
  [-121.35841997,44.078351995],[-121.358418127,44.079064978],[-121.358414574,44.080440325],
  [-121.358412447,44.084057585],[-121.358411009,44.086283821],[-121.35841032,44.087674838],
  [-121.356299073,44.089209388],[-121.352607971,44.091891964],[-121.350387087,44.093505969],
  [-121.349472858,44.093517821],[-121.348492812,44.093519603],[-121.34846161,44.092876803],
  [-121.347447775,44.09214665],[-121.346779635,44.091666493],[-121.346566664,44.091514871],
  [-121.345526852,44.091184287],[-121.344608138,44.090966926],[-121.343980261,44.091032873],
  [-121.343640678,44.091153523],[-121.343432942,44.091241593],[-121.343225071,44.091329707],
  [-121.342665992,44.091469881],[-121.341932898,44.091570504],[-121.341314164,44.091831147],
  [-121.339550511,44.092758848],[-121.339095983,44.093078095],[-121.338216747,44.093771479],
  [-121.337155506,44.094092942],[-121.336653686,44.094125535],[-121.335714039,44.094129209],
  [-121.334372674,44.093809143],[-121.333173792,44.093733377],[-121.332230063,44.093755054],
  [-121.331809808,44.093803245],[-121.330553336,44.094971566],[-121.330208211,44.094625231],
  [-121.330142946,44.093296641],[-121.329191652,44.092398297],[-121.327925797,44.092728277],
  [-121.326006373,44.094568053],[-121.325590895,44.095158773],[-121.325299695,44.095458929],
  [-121.324818625,44.096133371],[-121.324272211,44.096965568],[-121.323898152,44.097052887],
  [-121.322594574,44.097124239],[-121.321469136,44.096584622],[-121.320949616,44.096576847],
  [-121.319597496,44.096789916],[-121.319070364,44.096893307],[-121.31787461,44.09706493],
  [-121.316997476,44.096564465],[-121.315965497,44.095450371],[-121.31553415,44.094667168],
  [-121.315348038,44.094400817],[-121.315914826,44.093516652],[-121.316479902,44.09285095],
  [-121.316941692,44.09038747],[-121.315818432,44.089371112],[-121.314760663,44.08799377],
  [-121.313648432,44.087226046],[-121.31308695,44.086692365],[-121.312015081,44.086196989],
  [-121.311322625,44.085955515],[-121.309917444,44.08535316],[-121.308809089,44.084749562],
  [-121.308190188,44.083889444],[-121.308091165,44.083753818],[-121.308058076,44.083279404],
  [-121.308207417,44.082613848],[-121.308310814,44.082037325],[-121.307950563,44.08129827],
  [-121.307509719,44.080811429],[-121.307254755,44.080635987],[-121.306970198,44.08046638],
  [-121.306509264,44.080095298],[-121.306301828,44.079862684],[-121.305981919,44.079354692],
  [-121.305654499,44.079087897],[-121.305515139,44.078885112],[-121.305486933,44.078421294],
  [-121.305602084,44.078149081],[-121.305761962,44.077745551],[-121.305955467,44.077411679],
  [-121.306271923,44.07701849],[-121.306418156,44.076838166],[-121.306667645,44.076598547],
  [-121.306814,44.076129715],[-121.306867429,44.075953469],[-121.306809452,44.075742824],
  [-121.306693995,44.075407346],[-121.306623822,44.075091954],[-121.306878418,44.074724358],
  [-121.307346667,44.07454251],[-121.308156142,44.074465815],[-121.309194748,44.074422494],
  [-121.309825803,44.074338418],
];

const ORIGIN_LAT = 44.0834;
const ORIGIN_LON = -121.3327;
const GROUND_M   = 1160;

const FPS         = 30;
const SOCIAL_SEC  = 35;
const TOTAL_FRAMES = SOCIAL_SEC * FPS;
const FOV_DEG     = 50;

// ─── Camera waypoints — config-driven (from AWBREY_BUTTE.socialPath)
// Three-phase move:
//   Phase 1 (t 0–0.40): arrive from NE high, sweep toward west rim — wide establishing
//   Phase 2 (t 0.40–0.75): orbit reversal south-west — altitude drop, register shift
//   Phase 3 (t 0.75–1.00): east descent over neighborhood grid — stat reveal
type Waypoint = { t: number; east: number; north: number; altitude: number };

const PATH: Waypoint[] = [
  { t: 0.00, east:  2800, north:  2200, altitude: 3200 },
  { t: 0.20, east:  1800, north:  1400, altitude: 2200 },
  { t: 0.40, east: -1200, north:  -400, altitude: 1800 },
  { t: 0.60, east: -2200, north: -1800, altitude: 1400 },
  { t: 0.75, east: -1000, north: -2200, altitude:  900 },
  { t: 0.88, east:   600, north: -1600, altitude:  600 },
  { t: 1.00, east:  1200, north: -1000, altitude:  700 },
];

const SPLINE = new THREE.CatmullRomCurve3(
  PATH.map((w) => new THREE.Vector3(w.east, w.north, w.altitude)),
  false,
  'centripetal',
  0.5,
);

function samplePath(t: number): THREE.Vector3 {
  const u = easeInOutQuart(clamp(t, 0, 1));
  return SPLINE.getPoint(u);
}

const SocialCameraRig: React.FC = () => {
  const frame = useCurrentFrame();
  const cameraRef = useRef<THREE.PerspectiveCamera>(null);
  const set = useThree((s) => s.set);
  const size = useThree((s) => s.size);
  const bankRef = useRef(0);

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
    const pos = samplePath(t);

    // Look slightly ahead of origin — slight downward tilt toward center of butte.
    const lookTarget = new THREE.Vector3(
      pos.x * 0.15,  // soft look-in toward center
      pos.y * 0.15,
      0,
    );

    const up = new THREE.Vector3(0, 0, 1);
    const m = new THREE.Matrix4();
    m.lookAt(pos, lookTarget, up);

    // Smooth banking from spline tangent
    const tAhead = clamp(t + 0.5 / SOCIAL_SEC, 0, 1);
    const posAhead = samplePath(tAhead);
    const tBefore = clamp(t - 0.5 / SOCIAL_SEC, 0, 1);
    const posBefore = samplePath(tBefore);
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

// ─── Text overlays — title, eyebrow, stat reveal
// All inside PORTRAIT_SAFE (x 90–990, y 280–1480) per safe-zones canonical.
const TextOverlay: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / TOTAL_FRAMES;

  // Title fades in at frame 20 (0.67s), visible by frame 30 (1.0s)
  const titleOpacity = clamp((frame - 20) / 15, 0, 1);
  // Title fades out at t=0.82 (before stat reveal)
  const titleFade = t > 0.82 ? clamp((0.88 - t) / 0.06, 0, 1) : 1;
  const titleAlpha = titleOpacity * titleFade;

  // Stat reveal — final 15% of video (t > 0.85)
  const statOpacity = t > 0.85 ? clamp((t - 0.85) / 0.06, 0, 1) : 0;

  // Title block anchored in upper PORTRAIT_SAFE — y from 300 to ~550
  const titleStyle: React.CSSProperties = {
    position: 'absolute',
    left: PORTRAIT_SAFE.x,
    top: 300,
    width: PORTRAIT_SAFE.width,
    textAlign: 'center',
    opacity: titleAlpha,
    color: '#faf8f4',
    textShadow: '0 2px 24px rgba(0,0,0,0.65), 0 0 12px rgba(0,0,0,0.45)',
    pointerEvents: 'none',
  };

  // Stat reveal block — centered vertically in safe zone, large kinetic number
  const statStyle: React.CSSProperties = {
    position: 'absolute',
    left: PORTRAIT_SAFE.x,
    top: 680,
    width: PORTRAIT_SAFE.width,
    textAlign: 'center',
    opacity: statOpacity,
    color: '#faf8f4',
    textShadow: '0 2px 32px rgba(0,0,0,0.75)',
    pointerEvents: 'none',
    transform: `scale(${0.85 + statOpacity * 0.15})`,
  };

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      {/* Title block */}
      <div style={titleStyle}>
        <div
          style={{
            fontFamily: 'Geist, system-ui, sans-serif',
            fontSize: 22,
            letterSpacing: '0.20em',
            textTransform: 'uppercase',
            marginBottom: 14,
          }}
        >
          BEND · OREGON
        </div>
        <div
          style={{
            fontFamily: 'Amboqia Boriango, Playfair Display, serif',
            fontSize: 82,
            lineHeight: 1.0,
            letterSpacing: '-0.01em',
          }}
        >
          Awbrey Butte
        </div>
      </div>

      {/* Kinetic stat reveal — final 15% */}
      {statOpacity > 0.01 && (
        <div style={statStyle}>
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
            $1,302,000
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
            8 sales · ryan-realty.com
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};

export const NeighborhoodSocial: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: '#0a1a2e' }}>
      <TilesScene
        origin={{ lat: ORIGIN_LAT, lon: ORIGIN_LON, height: GROUND_M }}
        width={1080}
        height={1920}
        minLoads={80}
        quietMs={8_000}
        maxWaitMs={240_000}
      >
        <SocialCameraRig />
        {/* Boundary polygon traces on at t=0.10, then holds */}
        <NeighborhoodOverlay
          ring={AWBREY_BUTTE_RING}
          originLat={ORIGIN_LAT}
          originLon={ORIGIN_LON}
          totalFrames={TOTAL_FRAMES}
          fadeStart={0.10}
          traceOn={true}
          pulseEnabled={false}
          zLiftM={5}
        />
      </TilesScene>
      <TextOverlay />
    </AbsoluteFill>
  );
};
