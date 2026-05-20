import React from 'react'
import { Composition } from 'remotion'
import {
  BendMedianPriceNews,
  BEND_MEDIAN_PRICE_NEWS_FRAMES,
} from './BendMedianPriceNews'

export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="BendMedianPriceNews"
      component={BendMedianPriceNews}
      durationInFrames={BEND_MEDIAN_PRICE_NEWS_FRAMES}
      fps={30}
      width={1080}
      height={1920}
    />
  </>
)
