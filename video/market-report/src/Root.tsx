import { Composition } from 'remotion'
import { MarketReport, MarketReportInput, computeDurationFrames } from './MarketReport'
import { FPS, HEIGHT, WIDTH } from './brand'

// Default props match the new 9-stat sub-beat structure:
//   4 stats × 2 sub-beats (label + value) = 8 beats
//   1 active inventory beat = 1 beat
//   Total stat beats = 9
//   Plus intro (1) + outro (1) = 11 beatDurations total
const defaultStats: MarketReportInput = {
  city: 'Bend',
  period: '2026',
  subhead: 'YTD Market Report April 2026',
  citySlug: 'bend',
  voPath: '',
  captionWords: [],
  beatDurations: [4.0, 3.5, 4.5, 3.5, 4.5, 3.5, 4.5, 3.5, 4.5, 5.5, 6.0],
  stats: [
    // Stat 1: Median Sale Price
    { label: 'Median Sale Price', value: '', layout: 'label-only', bgVariant: 'navy' },
    { label: 'Median Sale Price', value: '$699K', layout: 'hero', bgVariant: 'navy', changeText: '7.3% vs 2025', changeDir: 'down', context: 'YTD 643 closed homes' },
    // Stat 2: Months of Supply
    { label: 'Months of Supply', value: '', layout: 'label-only', bgVariant: 'navy-rich' },
    { label: 'Months of Supply', value: '5.8', unit: 'mo', layout: 'callout', bgVariant: 'navy-rich', pillText: 'BALANCED MARKET', context: 'Buyers have options but the market is not soft.' },
    // Stat 3: Days on Market
    { label: 'Days on Market', value: '', layout: 'label-only', bgVariant: 'gold-tint' },
    { label: 'Days on Market', value: '57', unit: 'days', layout: 'hero', bgVariant: 'gold-tint', context: 'Thirteen days faster than last year.' },
    // Stat 4: Sale-to-List
    { label: 'Sale-to-List Ratio', value: '', layout: 'label-only', bgVariant: 'cream' },
    { label: 'Sale-to-List Ratio', value: '97.1', unit: '%', layout: 'bar', bgVariant: 'cream', barPct: 0.856, context: 'Negotiation is limited. Pricing has been firm.' },
    // Active Inventory (single beat)
    { label: 'Active Listings', value: '1,149', layout: 'compare', bgVariant: 'navy', context: '415 pending · 360 new last 30 days' },
  ],
}

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="MarketReport"
        component={MarketReport}
        durationInFrames={computeDurationFrames(defaultStats)}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={defaultStats}
        calculateMetadata={({ props }) => ({
          durationInFrames: computeDurationFrames(props),
        })}
      />
    </>
  )
}
