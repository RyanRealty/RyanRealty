// PeakOrbit — per-peak dramatic flyby. Camera orbits the peak summit at
// camera.orbitRadiusM / camera.cameraHeightM, sweeping camera.sweepDeg over
// PER_PEAK_SEC. FactCard overlays the text stack. This is the scene that
// repeats for each of the 10 peaks in the deep-dive sequence.

import React from 'react';
import { AbsoluteFill } from 'remotion';
import { TilesScene } from './TilesScene';
import { OrbitCameraRig } from './CameraRig';
import { FactCard } from './FactCard';
import { PER_PEAK_SEC } from './config';
import type { Peak } from './peaks';

// The FactCard's solid info panel starts at y=1050 in a 1920-tall frame.
// Without compensation, lookAt(summit) puts the summit at the optical center
// (y=960), which is just above the panel — cramming the peak into the bottom
// sliver of the 3D hero area.
//
// A positive viewOffsetYPx shifts the looked-at summit UP in the frame. We
// want the summit to sit around y=600 — roughly the vertical center of the
// 3D hero area that's visible between the title (ends ~y=230) and panel top
// (y=1050). With 1920-tall frame, summit at y=600 = 360px above center,
// Wide / high orbit: less offset so more summit + ridgeline stay in frame.
const DEFAULT_VIEW_OFFSET_Y = 520;

type Props = {
  peak: Peak;
  displayOrder: number; // 1..10
  frameOffset: number;
};

const FT_TO_M = 0.3048;

export const PeakOrbit: React.FC<Props> = ({ peak, displayOrder, frameOffset }) => {
  const summitElevM = peak.elevationFt * FT_TO_M;

  return (
    <AbsoluteFill style={{ background: '#0a1a2e' }}>
      {/* 3D canvas — ENU origin is the peak summit (lat,lon) at sea level.
          Camera lifts to summit elevation + cameraHeightM. Target is the
          summit itself at local [0, 0, summitElevM]. */}
      <TilesScene
        origin={{ lat: peak.lat, lon: peak.lon, height: 0 }}
        fov={50}
        near={80}
        far={280_000}
      >
        <OrbitCameraRig
          target={[0, 0, summitElevM]}
          orbitRadiusM={peak.camera.orbitRadiusM}
          cameraHeightM={peak.camera.cameraHeightM}
          startAzimuthDeg={peak.camera.startAzimuthDeg}
          sweepDeg={peak.camera.sweepDeg}
          durationSec={PER_PEAK_SEC}
          frameOffset={0}
          zoomStart={1.12}
          approachSec={2.2}
          approachRadiusMult={1.38}
          fov={50}
          near={80}
          far={240_000}
          viewOffsetYPx={DEFAULT_VIEW_OFFSET_Y}
        />
      </TilesScene>

      {/* 2D overlay with facts */}
      <FactCard
        peak={peak}
        displayOrder={displayOrder}
        durationSec={PER_PEAK_SEC}
        frameOffset={frameOffset}
      />
    </AbsoluteFill>
  );
};
