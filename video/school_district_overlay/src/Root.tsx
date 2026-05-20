/**
 * Root — Remotion composition registry for school_district_overlay.
 *
 * Default props: Bend-LaPine School District preview with placeholder boundary.
 * Real renders inject boundary + school data from build_school_district_overlay.py.
 */

import React from 'react'
import { Composition } from 'remotion'
import { SchoolDistrictOverlay, SchoolDistrictInput } from './SchoolDistrictOverlay'

const FPS = 30
const W = 1080
const H = 1920
const DURATION_SEC = 44

/** Studio preview — Bend-LaPine SD + 4 sample schools */
const defaultInput: SchoolDistrictInput = {
  apiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '',
  centerLat: 44.058,
  centerLng: -121.315,
  mapZoom: 12,

  districtName: 'Bend-LaPine',
  boundaryDataAvailable: false,  // triggers placeholder until ODE data is fed

  // Placeholder polygon roughly around central Bend
  boundaryPoints: [
    { nx: 0.15, ny: 0.25 },
    { nx: 0.85, ny: 0.20 },
    { nx: 0.88, ny: 0.75 },
    { nx: 0.12, ny: 0.80 },
  ],

  schools: [
    { name: 'Bear Creek Elem',  lat: 44.072, lng: -121.332, nx: 0.40, ny: 0.35, type: 'elementary' },
    { name: 'Cascade Middle',   lat: 44.061, lng: -121.298, nx: 0.62, ny: 0.45, type: 'middle' },
    { name: 'Mountain View HS', lat: 44.042, lng: -121.303, nx: 0.60, ny: 0.58, type: 'high' },
    { name: 'Elk Meadow Elem',  lat: 44.079, lng: -121.308, nx: 0.57, ny: 0.30, type: 'elementary' },
  ],

  subjectNx: 0.48,
  subjectNy: 0.52,
  nearbySchoolCount: 3,

  captionWords: [],
  voPath: '',
  durationSec: DURATION_SEC,
}

export const RemotionRoot: React.FC = () => (
  <Composition
    id="SchoolDistrictOverlay"
    component={SchoolDistrictOverlay}
    durationInFrames={DURATION_SEC * FPS}
    fps={FPS}
    width={W}
    height={H}
    defaultProps={defaultInput}
  />
)
