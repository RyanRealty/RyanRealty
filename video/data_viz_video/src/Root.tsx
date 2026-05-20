import React from 'react'
import { Composition } from 'remotion'
import { DataVizComp, DATA_VIZ_FRAMES } from './DataVizComp'

export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="DataVizVideo"
      component={DataVizComp}
      durationInFrames={DATA_VIZ_FRAMES}
      fps={30}
      width={1080}
      height={1920}
    />
  </>
)
