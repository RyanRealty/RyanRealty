import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion'
import { CREAM, FONT_BODY, FONT_HEAD, GOLD, GOLD_SOFT, NAVY_RICH, WHITE } from '../brand'

/**
 * AmortizationCurve — interest vs principal split per month over 360 months.
 * Two stacked areas: interest (gold-soft, top) shrinking and principal (gold, bottom) growing.
 * Year-1 + year-30 callouts.
 */
type Props = {
  /** loan amount */
  loan: number
  /** annual rate (e.g., 0.07) */
  rate: number
  /** term years (e.g., 30) */
  termYears: number
  enterDelaySec?: number
}

function amortizationSchedule(loan: number, annualRate: number, termYears: number) {
  const r = annualRate / 12
  const n = termYears * 12
  const PI = (loan * r) / (1 - Math.pow(1 + r, -n))
  let balance = loan
  const months: Array<{ month: number; interest: number; principal: number }> = []
  for (let m = 1; m <= n; m++) {
    const interest = balance * r
    const principal = PI - interest
    balance -= principal
    months.push({ month: m, interest, principal })
  }
  return { PI, months }
}

const W = 960
const H = 600

export const AmortizationCurve: React.FC<Props> = ({ loan, rate, termYears, enterDelaySec = 0 }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const f = Math.max(0, frame - Math.round(enterDelaySec * fps))
  const reveal = interpolate(f, [0, fps * 1.5], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })

  const { months } = amortizationSchedule(loan, rate, termYears)
  const PAD_X = 80
  const TOP = 90
  const HEIGHT = 360
  const BOTTOM = TOP + HEIGHT
  const PI = months[0].interest + months[0].principal // total monthly P&I

  const xAt = (m: number) => PAD_X + ((m - 1) / (months.length - 1)) * (W - PAD_X * 2)
  const yAt = (v: number) => BOTTOM - (v / PI) * HEIGHT

  const visibleCount = Math.max(2, Math.round(months.length * reveal))
  const visMonths = months.slice(0, visibleCount)

  // Two paths: principal area (bottom) + interest area (top)
  // Interest path: from BOTTOM along (x, BOTTOM - principal/PI*H) going UP, then back along the bottom
  const principalPts = visMonths.map((m) => ({ x: xAt(m.month), y: yAt(m.principal) }))
  const principalArea =
    `M ${PAD_X.toFixed(1)},${BOTTOM.toFixed(1)} ` +
    principalPts.map((p) => `L ${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ') +
    ` L ${principalPts[principalPts.length - 1].x.toFixed(1)},${BOTTOM.toFixed(1)} Z`

  // Interest sits above principal: bottom line of interest = top line of principal; top line of interest = TOP
  const interestArea =
    `M ${PAD_X.toFixed(1)},${TOP.toFixed(1)} ` +
    `L ${principalPts[principalPts.length - 1].x.toFixed(1)},${TOP.toFixed(1)} ` +
    principalPts
      .slice()
      .reverse()
      .map((p) => `L ${p.x.toFixed(1)},${p.y.toFixed(1)}`)
      .join(' ') +
    ' Z'

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '100%', maxWidth: 960, maxHeight: 600 }}>
      {/* Background contrast band */}
      <rect x={PAD_X - 20} y={TOP - 30} width={W - PAD_X * 2 + 40} height={HEIGHT + 60} fill="#0A1A2E" opacity={0.35} rx={16} />

      <text x={W / 2} y={50} fill={WHITE} fontFamily={FONT_HEAD} fontSize={38} textAnchor="middle">
        Interest vs principal over 30 years
      </text>

      {/* Areas */}
      <path d={principalArea} fill={GOLD} opacity={0.95} />
      <path d={interestArea} fill={GOLD_SOFT} opacity={0.55} />

      {/* Axis baseline */}
      <line x1={PAD_X} y1={BOTTOM} x2={W - PAD_X} y2={BOTTOM} stroke={NAVY_RICH} strokeWidth={2} />

      {/* Year markers (1, 10, 20, 30) */}
      {[1, 10, 20, 30].map((y) => (
        <text
          key={y}
          x={xAt(y * 12)}
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

      {/* Annotation: year 1 = mostly interest */}
      {(() => {
        const aF = f - Math.round(fps * 1.2)
        const aOp = interpolate(aF, [0, 12], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
        return (
          <g opacity={aOp}>
            <text x={xAt(12)} y={TOP + 80} fill={GOLD_SOFT} fontFamily={FONT_BODY} fontSize={22} textAnchor="start">
              year 1: mostly interest
            </text>
            <line x1={xAt(12) - 4} y1={TOP + 90} x2={xAt(12) - 4} y2={TOP + HEIGHT * 0.45} stroke={GOLD_SOFT} strokeWidth={1} opacity={0.6} />
          </g>
        )
      })()}

      {/* Annotation: year 30 = tenant paid it off */}
      {(() => {
        const aF = f - Math.round(fps * 1.7)
        const aOp = interpolate(aF, [0, 12], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
        return (
          <g opacity={aOp}>
            <text x={W - PAD_X - 12} y={TOP + 250} fill={GOLD} fontFamily={FONT_BODY} fontSize={22} textAnchor="end">
              year 30: tenant paid it off
            </text>
          </g>
        )
      })()}

      {/* Legend */}
      <g transform={`translate(${PAD_X}, ${TOP - 12})`}>
        <rect x={0} y={-18} width={18} height={18} fill={GOLD} />
        <text x={26} y={-3} fill={WHITE} fontFamily={FONT_BODY} fontSize={22}>principal (paid down)</text>
        <rect x={360} y={-18} width={18} height={18} fill={GOLD_SOFT} opacity={0.55} />
        <text x={386} y={-3} fill={WHITE} fontFamily={FONT_BODY} fontSize={22}>interest</text>
      </g>
    </svg>
  )
}
