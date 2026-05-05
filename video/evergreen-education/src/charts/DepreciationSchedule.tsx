import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion'
import { CREAM, FONT_BODY, FONT_HEAD, GOLD, NAVY_RICH, WHITE } from '../brand'

/**
 * DepreciationSchedule — 27.5-year staircase showing $14,545 written off each year.
 * Each year's bar = depreciation amount; cumulative line on top.
 */
type Props = {
  yearlyAmount: number
  years: number
  /** Optional tax bracket — if provided, shows annual tax savings callout */
  taxBracket?: number
  enterDelaySec?: number
}

const W = 960
const H = 600

export const DepreciationSchedule: React.FC<Props> = ({ yearlyAmount, years, taxBracket, enterDelaySec = 0 }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const f = Math.max(0, frame - Math.round(enterDelaySec * fps))
  const reveal = interpolate(f, [0, fps * 1.5], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })

  const PAD_X = 80
  const TOP = 110
  const HEIGHT = 320
  const BOTTOM = TOP + HEIGHT
  const totalYears = Math.ceil(years) // 28 for 27.5
  const cumulative = yearlyAmount * years

  const visibleYears = Math.max(1, Math.round(totalYears * reveal))
  const BAR_W = (W - PAD_X * 2 - (totalYears - 1) * 4) / totalYears

  // Cumulative line builder
  const cumulativeLine: string[] = []
  for (let yi = 0; yi < visibleYears; yi++) {
    const x = PAD_X + yi * (BAR_W + 4) + BAR_W / 2
    const cum = (yi + 1) * yearlyAmount
    const y = BOTTOM - (cum / cumulative) * HEIGHT
    cumulativeLine.push(`${x.toFixed(1)},${y.toFixed(1)}`)
  }

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '100%', maxWidth: 960, maxHeight: 600 }}>
      <text x={W / 2} y={50} fill={WHITE} fontFamily={FONT_HEAD} fontSize={40} textAnchor="middle">
        Depreciation: ${yearlyAmount.toLocaleString('en-US')}/yr × 27.5 yrs
      </text>
      <text x={W / 2} y={82} fill={GOLD} fontFamily={FONT_BODY} fontSize={26} textAnchor="middle">
        ≈ ${Math.round(cumulative).toLocaleString('en-US')} total written off
      </text>

      {/* Yearly bars */}
      {Array.from({ length: visibleYears }).map((_, yi) => {
        const x = PAD_X + yi * (BAR_W + 4)
        const barH = HEIGHT * 0.18
        return (
          <rect
            key={yi}
            x={x}
            y={BOTTOM - barH}
            width={BAR_W}
            height={barH}
            fill={GOLD}
            opacity={0.6}
          />
        )
      })}

      {/* Cumulative line */}
      {cumulativeLine.length >= 2 ? (
        <polyline
          points={cumulativeLine.join(' ')}
          fill="none"
          stroke={GOLD}
          strokeWidth={4}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : null}

      {/* Baseline */}
      <line x1={PAD_X} y1={BOTTOM} x2={W - PAD_X} y2={BOTTOM} stroke={NAVY_RICH} strokeWidth={2} />

      {/* Year axis labels (1, 10, 20, 28) */}
      {[1, 10, 20, 27].map((y) => (
        <text
          key={y}
          x={PAD_X + (y - 1) * (BAR_W + 4) + BAR_W / 2}
          y={BOTTOM + 32}
          fill={CREAM}
          fontFamily={FONT_BODY}
          fontSize={22}
          textAnchor="middle"
          opacity={0.75}
        >
          y{y}
        </text>
      ))}

      {/* Tax savings callout at bottom — appears after staircase fully reveals */}
      {taxBracket ? (() => {
        const cF = f - Math.round(fps * 1.7)
        const cOp = interpolate(cF, [0, 12], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
        const annualSavings = Math.round(yearlyAmount * taxBracket)
        return (
          <g opacity={cOp}>
            <rect
              x={W / 2 - 230}
              y={BOTTOM + 64}
              width={460}
              height={70}
              fill="rgba(212, 175, 55, 0.15)"
              stroke={GOLD}
              strokeWidth={2}
              rx={14}
            />
            <text
              x={W / 2}
              y={BOTTOM + 110}
              fill={GOLD}
              fontFamily={FONT_HEAD}
              fontSize={36}
              textAnchor="middle"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              ≈ ${annualSavings.toLocaleString('en-US')}/yr you keep
            </text>
          </g>
        )
      })() : null}
    </svg>
  )
}
