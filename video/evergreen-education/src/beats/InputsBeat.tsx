import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { ChapterBeat } from './ChapterBeat'
import { CREAM, FONT_BODY, FONT_HEAD, GOLD, NAVY_DEEP, NAVY_RICH, WHITE } from '../brand'

/**
 * InputsBeat — chapter 2: shows the locked illustrative inputs as a card.
 * Used so every subsequent chapter's number ties back to one explicit set.
 */
type Props = {
  chapterNumber: number
  durationInFrames: number
  inputs: {
    purchasePrice: number
    downPayment: number
    loanAmount: number
    interestRate: number
    monthlyRent: number
  }
}

const Row: React.FC<{ label: string; value: string; delay: number }> = ({ label, value, delay }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const f = Math.max(0, frame - delay)
  const enter = spring({ frame: f, fps, config: { damping: 14, stiffness: 110 } })
  const opacity = interpolate(f, [0, 8], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        padding: '16px 28px',
        borderBottom: `1px solid ${NAVY_RICH}`,
        opacity,
        transform: `translateX(${(1 - enter) * 16}px)`,
      }}
    >
      <span
        style={{
          color: WHITE,
          fontFamily: FONT_BODY,
          fontSize: 30,
          letterSpacing: 0.5,
          opacity: 0.8,
        }}
      >
        {label}
      </span>
      <span
        style={{
          color: GOLD,
          fontFamily: FONT_HEAD,
          fontSize: 38,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </span>
    </div>
  )
}

export const InputsBeat: React.FC<Props> = ({ chapterNumber, durationInFrames, inputs }) => {
  return (
    <ChapterBeat chapterNumber={chapterNumber} headline="Picture a rental property" durationInFrames={durationInFrames}>
      <div
        style={{
          width: 820,
          background: 'rgba(10,26,46,0.90)',
          border: `2px solid ${GOLD}`,
          borderRadius: 24,
          padding: '12px 0',
          boxShadow: '0 16px 60px rgba(0,0,0,0.5)',
        }}
      >
        <Row label="Purchase price" value={`$${inputs.purchasePrice.toLocaleString('en-US')}`} delay={0} />
        <Row label="Down payment (25%)" value={`$${inputs.downPayment.toLocaleString('en-US')}`} delay={6} />
        <Row label="Mortgage" value={`$${inputs.loanAmount.toLocaleString('en-US')} @ ${(inputs.interestRate * 100).toFixed(0)}%`} delay={12} />
        <Row label="Monthly rent" value={`$${inputs.monthlyRent.toLocaleString('en-US')}`} delay={18} />
      </div>
    </ChapterBeat>
  )
}
