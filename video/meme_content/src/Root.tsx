/**
 * Root — Remotion composition registry for the meme_content project.
 *
 * Default props: library-empty state (clipUrl: null) so studio preview and tsc
 * pass without a real Vlipsy clip. The build script injects a real clip from
 * data/meme-library.jsonl (a PASS-flagged entry). If the library is empty
 * the build script surfaces a "library not populated" error and exits 1.
 *
 * To populate the library: run scripts/scrape-meme-library.mjs
 */

import React from 'react'
import { Composition } from 'remotion'

import { MemeComp, MemeInput } from './MemeComp'

const FPS = 30
const WIDTH = 1080
const HEIGHT = 1920

// Default: 20s comp (mid-range for 15-25s format window)
const DEFAULT_DURATION_FRAMES = 20 * FPS

const DEFAULT_PROPS: MemeInput = {
  clipUrl: null,
  durationFrames: DEFAULT_DURATION_FRAMES,
  contextLine: 'When you offer asking price',
  punchlineLine: '4 other buyers did too',
  captionWords: [],
}

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="MemeComp"
        component={MemeComp}
        durationInFrames={DEFAULT_DURATION_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={DEFAULT_PROPS}
        calculateMetadata={({ props }) => ({
          durationInFrames: props.durationFrames,
        })}
      />
    </>
  )
}
