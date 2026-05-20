import React from 'react'
import { Composition } from 'remotion'
import { ListingRevealComp, LISTING_REVEAL_FRAMES } from './ListingRevealComp'

export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="ListingReveal"
      component={ListingRevealComp}
      durationInFrames={LISTING_REVEAL_FRAMES}
      fps={30}
      width={1080}
      height={1920}
    />
  </>
)
