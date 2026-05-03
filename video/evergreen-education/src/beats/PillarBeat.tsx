import { AbsoluteFill, Img, OffthreadVideo, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion'
import { FONT_HEAD, GOLD, NAVY_DEEP, WHITE } from '../brand'
import { BarFillViz } from '../components/BarFillViz'
import { BarShrinkViz } from '../components/BarShrinkViz'
import { CountUpPill } from '../components/CountUpPill'
import { StackedTaxList } from '../components/StackedTaxList'

export type PillarKind = 'cashFlow' | 'appreciation' | 'loanPaydown' | 'taxBenefits'

type Props = {
  kind: PillarKind
  pillarNumber: 1 | 2 | 3 | 4
  headline: string
  illustrationPath: string
  videoOverlayPath?: string | null
  durationInFrames?: number
  params: PillarParams
}

export type PillarParams =
  | { kind: 'cashFlow'; cashFlowMonthly: number }
  | { kind: 'appreciation'; ratePercent: number; firstYearGain: number }
  | { kind: 'loanPaydown'; initialLoan: number; year1Paydown: number }
  | {
      kind: 'taxBenefits'
      depreciationYearly: number
      taxBracket: number
      taxSavingsYearly: number
    }

/**
 * PillarBeat — three vertically-stacked zones:
 *
 *   y    0 – 280   header band (PILLAR N + headline)
 *   y  300 – 880   illustration zone (580px tall, square)
 *   y  920 – 1380  data-viz zone (460px tall)
 *   y 1480 – 1720  caption safe zone (CaptionBand renders here, never us)
 *
 * No nested AbsoluteFills. Explicit absolute positioning everywhere.
 */
export const PillarBeat: React.FC<Props> = ({
  kind,
  pillarNumber,
  headline,
  illustrationPath,
  videoOverlayPath,
  params,
}) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const headerEnter = spring({ frame, fps, config: { damping: 14, stiffness: 110 } })
  const headerOpacity = interpolate(frame, [0, 12], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })

  const VIZ_DELAY = 12

  return (
    <AbsoluteFill style={{ backgroundColor: NAVY_DEEP }}>
      {/* Header band — top zone */}
      <div
        style={{
          position: 'absolute',
          top: 90,
          left: 0,
          right: 0,
          textAlign: 'center',
          opacity: headerOpacity,
          transform: `translateY(${(1 - headerEnter) * 20}px)`,
        }}
      >
        <div
          style={{
            color: WHITE,
            fontFamily: FONT_HEAD,
            fontSize: 36,
            letterSpacing: 6,
            opacity: 0.7,
          }}
        >
          PILLAR {pillarNumber}
        </div>
        <div
          style={{
            color: GOLD,
            fontFamily: FONT_HEAD,
            fontSize: 80,
            letterSpacing: 4,
            textTransform: 'uppercase',
            marginTop: 8,
            textShadow: '0 6px 20px rgba(0,0,0,0.5)',
          }}
        >
          {headline}
        </div>
      </div>

      {/* Illustration zone — cream backing panel keeps the editorial vector vibe consistent */}
      <div
        style={{
          position: 'absolute',
          top: 290,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            width: 620,
            height: 620,
            background: '#faf8f4',
            borderRadius: 28,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 16px 60px rgba(0,0,0,0.45)',
            border: `2px solid ${GOLD}`,
            overflow: 'hidden',
          }}
        >
          {videoOverlayPath ? (
            <OffthreadVideo
              src={staticFile(videoOverlayPath)}
              style={{
                width: 580,
                height: 580,
                objectFit: 'contain',
              }}
              muted
            />
          ) : (
            <Img
              src={staticFile(illustrationPath)}
              style={{
                width: 580,
                height: 580,
                objectFit: 'contain',
              }}
            />
          )}
        </div>
      </div>

      {/* Data-viz zone */}
      <div
        style={{
          position: 'absolute',
          top: 940,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-start',
        }}
      >
        {kind === 'cashFlow' && params.kind === 'cashFlow' ? (
          <CountUpPill
            target={params.cashFlowMonthly}
            prefix="+$"
            suffix="/mo"
            label="Net cash flow"
            variant="large"
            enterDelayFrames={VIZ_DELAY}
          />
        ) : null}

        {kind === 'appreciation' && params.kind === 'appreciation' ? (
          <BarFillViz
            percent={Math.min(100, params.ratePercent * 20)}
            primaryLabel={`${params.ratePercent}% / yr`}
            subLabel={`first-year gain: $${params.firstYearGain.toLocaleString('en-US')}`}
            enterDelayFrames={VIZ_DELAY}
          />
        ) : null}

        {kind === 'loanPaydown' && params.kind === 'loanPaydown' ? (
          <BarShrinkViz
            initialValue={params.initialLoan}
            finalValue={params.initialLoan - params.year1Paydown}
            subLabel={`year 1: $${params.year1Paydown.toLocaleString('en-US')} paid down`}
            enterDelayFrames={VIZ_DELAY}
          />
        ) : null}

        {kind === 'taxBenefits' && params.kind === 'taxBenefits' ? (
          <StackedTaxList
            items={[
              {
                headline: `$${params.depreciationYearly.toLocaleString('en-US')} / yr depreciation`,
                sub: `≈ $${params.taxSavingsYearly.toLocaleString('en-US')} / yr saved at ${params.taxBracket}% bracket`,
              },
              {
                headline: 'Mortgage interest deductible',
                sub: 'Reduces taxable rental income',
              },
              {
                headline: '1031 exchange',
                sub: 'Defer capital gains by rolling into next property',
              },
            ]}
            enterDelayFrames={VIZ_DELAY}
          />
        ) : null}
      </div>
    </AbsoluteFill>
  )
}
