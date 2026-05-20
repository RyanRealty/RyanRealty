/**
 * Root — Remotion composition registry for map_route_video.
 *
 * Default props simulate a Bend→Tetherow route for Studio preview.
 * Real renders inject route data via props.json from build_map_route_video.py.
 */

import React from 'react'
import { Composition } from 'remotion'
import { MapRouteVideo, MapRouteInput } from './MapRouteVideo'

const FPS = 30
const W = 1080
const H = 1920
const DURATION_SEC = 42

/** Studio-preview default — Bend city center → Tetherow resort */
const defaultInput: MapRouteInput = {
  apiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '',

  originLat: 44.0582,
  originLng: -121.3153,
  originLabel: 'Downtown Bend',

  destLat: 43.9978,
  destLng: -121.3745,
  destinationLabel: 'Tetherow',

  driveTimeMin: 12,
  distanceMi: 7.8,
  polylineEncoded: '',  // populated by build script

  // Placeholder normalized route — straight line origin → dest
  routePointsNormalized: [
    { nx: 0.5,  ny: 0.65 },
    { nx: 0.48, ny: 0.57 },
    { nx: 0.44, ny: 0.50 },
    { nx: 0.42, ny: 0.42 },
    { nx: 0.39, ny: 0.36 },
  ],

  landmarks: [
    { name: 'Old Mill District', routeProgress: 0.3 },
    { name: 'Mt. Bachelor Rd', routeProgress: 0.6 },
  ],

  captionWords: [],
  voPath: '',

  cityZoom: 11,
  routeZoom: 12,
  destZoom: 14,
  durationSec: DURATION_SEC,
}

export const RemotionRoot: React.FC = () => (
  <Composition
    id="MapRouteVideo"
    component={MapRouteVideo}
    durationInFrames={DURATION_SEC * FPS}
    fps={FPS}
    width={W}
    height={H}
    defaultProps={defaultInput}
  />
)
