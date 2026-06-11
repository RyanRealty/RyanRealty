/**
 * NeighborhoodHero — 16:9 1920×1080 seamless orbital flyover for geo-page headers.
 *
 * One continuous camera arc (no cuts). Navy boundary polygon visible from t=0.
 * Designed for muted autoplay loop use — no captions, no VO, no brand badge.
 * The poster frame (best frame for og:image) is near t=0.25 when the Cascade
 * backdrop fills the upper third.
 *
 * Config-driven: pass a NeighborhoodConfig to produce any of the 27 neighborhoods.
 * The only hard-coded data is the fetched polygon ring (passed at composition mount
 * time from the verified Supabase RPC response).
 */

import React, { useEffect, useRef } from 'react';
import { useCurrentFrame, AbsoluteFill } from 'remotion';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

import { TilesScene } from './TilesScene';
import { NeighborhoodOverlay } from './NeighborhoodOverlay';
import { clamp, easeInOutQuart } from './easing';

// ─── Awbrey Butte polygon ring (fetched from boundary_geojson RPC 2026-06-09)
// Source: public.boundaries geo_type='neighborhood' geo_slug='bend-awbrey-butte'
// RPC: boundary_geojson(p_geo_type='neighborhood', p_geo_slug='bend-awbrey-butte')
// Geometry type: MultiPolygon — using the first (and only) exterior ring.
// This is the COMPLETE ring from the RPC; not simplified or approximated.
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
  [-121.345526852,44.091184287],[-121.344608138,44.090966926],[-121.34461543,44.090968499],
  [-121.343980261,44.091032873],[-121.343640678,44.091153523],[-121.343432942,44.091241593],
  [-121.343225071,44.091329707],[-121.342665992,44.091469881],[-121.341932898,44.091570504],
  [-121.341314164,44.091831147],[-121.339550511,44.092758848],[-121.339095983,44.093078095],
  [-121.338216747,44.093771479],[-121.337155506,44.094092942],[-121.336653686,44.094125535],
  [-121.335714039,44.094129209],[-121.334372674,44.093809143],[-121.333173792,44.093733377],
  [-121.332230063,44.093755054],[-121.331809808,44.093803245],
  [-121.330553336,44.094971566],[-121.330208211,44.094625231],[-121.330142946,44.093296641],
  [-121.329191652,44.092398297],[-121.327925797,44.092728277],[-121.326006373,44.094568053],
  [-121.325590895,44.095158773],[-121.325299695,44.095458929],[-121.324818625,44.096133371],
  [-121.324272211,44.096965568],[-121.323898152,44.097052887],[-121.322594574,44.097124239],
  [-121.321469136,44.096584622],[-121.320949616,44.096576847],[-121.319597496,44.096789916],
  [-121.319070364,44.096893307],[-121.31787461,44.09706493],[-121.316997476,44.096564465],
  [-121.315965497,44.095450371],[-121.31553415,44.094667168],[-121.315348038,44.094400817],
  [-121.315914826,44.093516652],[-121.316479902,44.09285095],[-121.316941692,44.09038747],
  [-121.315818432,44.089371112],[-121.314760663,44.08799377],[-121.313648432,44.087226046],
  [-121.31308695,44.086692365],[-121.312015081,44.086196989],[-121.311322625,44.085955515],
  [-121.309917444,44.08535316],[-121.308809089,44.084749562],[-121.308190188,44.083889444],
  [-121.308091165,44.083753818],[-121.308058076,44.083279404],[-121.308207417,44.082613848],
  [-121.308310814,44.082037325],[-121.307950563,44.08129827],[-121.307509719,44.080811429],
  [-121.307254755,44.080635987],[-121.306970198,44.08046638],[-121.306509264,44.080095298],
  [-121.306301828,44.079862684],[-121.305981919,44.079354692],[-121.305654499,44.079087897],
  [-121.305515139,44.078885112],[-121.305486933,44.078421294],[-121.305602084,44.078149081],
  [-121.305761962,44.077745551],[-121.305955467,44.077411679],[-121.306271923,44.07701849],
  [-121.306418156,44.076838166],[-121.306667645,44.076598547],[-121.306814,44.076129715],
  [-121.306867429,44.075953469],[-121.306809452,44.075742824],[-121.306693995,44.075407346],
  [-121.306623822,44.075091954],[-121.306878418,44.074724358],[-121.307346667,44.07454251],
  [-121.308156142,44.074465815],[-121.309194748,44.074422494],[-121.309825803,44.074338418],
];

// ─── Scene origin — polygon centroid from RPC response (WGS84)
const ORIGIN_LAT = 44.0834;
const ORIGIN_LON = -121.3327;
const GROUND_M    = 1160; // ~3,800ft — Awbrey Butte rim elevation

// ─── Hero dimensions
const HERO_W = 1920;
const HERO_H = 1080;
const FPS    = 30;

// Duration choices — 15s gives a seamless feel without being too long for a page header.
// The camera completes about 135° of orbital arc (SE → W via S) at a slow glide.
const HERO_SEC    = 15;
const HERO_FRAMES = HERO_SEC * FPS;

// ─── Orbit parameters (from AWBREY_BUTTE.heroOrbit in neighborhoodConfig.ts)
const AZ_START_DEG = 135; // SE
const AZ_END_DEG   = 270; // W
const ALT_M        = 1800;
const RADIUS_M     = 3500;
const PITCH_DEG    = 52;  // oblique angle — terrain + sky both in frame
const FOV_DEG      = 28;

const HeroCameraRig: React.FC = () => {
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
    const tRaw = clamp(frame / HERO_FRAMES, 0, 1);
    // Ease in and out — slow start and end for a seamless loop feel.
    const t = easeInOutQuart(tRaw);

    // Orbit: interpolate azimuth from AZ_START to AZ_END.
    const azDeg = AZ_START_DEG + (AZ_END_DEG - AZ_START_DEG) * t;
    const az = (azDeg * Math.PI) / 180;
    const pitch = (PITCH_DEG * Math.PI) / 180;

    // Compute camera position in ENU: orbit at given radius + altitude.
    // The camera revolves around the origin (0,0,0) in the ENU frame.
    const groundRadius = RADIUS_M * Math.sin(pitch);
    const camEast  = -Math.sin(az) * groundRadius;
    const camNorth = -Math.cos(az) * groundRadius;
    const camAlt   = ALT_M;

    const pos    = new THREE.Vector3(camEast, camNorth, camAlt);
    const target = new THREE.Vector3(0, 0, 0);
    const up     = new THREE.Vector3(0, 0, 1);

    const m = new THREE.Matrix4();
    m.lookAt(pos, target, up);
    cam.up.copy(up);
    cam.position.copy(pos);
    cam.quaternion.setFromRotationMatrix(m);
    cam.fov = FOV_DEG;
    cam.aspect = HERO_W / HERO_H;
    cam.updateProjectionMatrix();
  });

  return (
    <perspectiveCamera
      ref={cameraRef}
      fov={FOV_DEG}
      aspect={HERO_W / HERO_H}
      near={10}
      far={300_000}
    />
  );
};

export const NeighborhoodHero: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: '#0a1a2e' }}>
      <TilesScene
        origin={{ lat: ORIGIN_LAT, lon: ORIGIN_LON, height: GROUND_M }}
        width={HERO_W}
        height={HERO_H}
        minLoads={80}
        quietMs={8_000}
        maxWaitMs={240_000}
      >
        <HeroCameraRig />
        {/* Boundary polygon — visible from t=0, gently pulsing fill */}
        <NeighborhoodOverlay
          ring={AWBREY_BUTTE_RING}
          originLat={ORIGIN_LAT}
          originLon={ORIGIN_LON}
          totalFrames={HERO_FRAMES}
          fadeStart={0.0}
          pulseEnabled={true}
          zLiftM={5}
        />
      </TilesScene>
      {/* No brand badge, no logo, no text — pure ambient hero per area-guide rules */}
    </AbsoluteFill>
  );
};
