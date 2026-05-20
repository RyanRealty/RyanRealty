/**
 * Root — Remotion composition registry for the area_guides project.
 *
 * Default subject: Tumalo neighborhood (canonical fixture per the repo's
 * 19496 Tumalo Reservoir Rd exemplar). The build script (scripts/build_area_guides.py)
 * injects real Pexels photo URLs and VO caption words at render time.
 */

import React from 'react'
import { Composition } from 'remotion'

import { AreaGuide, AreaGuideInput } from './AreaGuide'
import { FPS, HEIGHT, TOTAL_FRAMES, WIDTH } from './config'

const DEFAULT_PROPS: AreaGuideInput = {
  neighborhood: 'Tumalo',
  city: 'Bend, Oregon',
  hookText: 'Wide open space. Ten minutes from downtown.',
  amenityLabels: [
    'Tumalo State Park',
    'Deschutes River access',
    'Wide lots · No HOA',
  ],
  statValue: '$847K',
  statLabel: 'Median sale price · 2025',
  captionWords: [],
  photoUrls: [null, null, null, null, null, null],
}

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="AreaGuide"
        component={AreaGuide}
        durationInFrames={TOTAL_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={DEFAULT_PROPS}
      />
    </>
  )
}
