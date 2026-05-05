import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { CREAM, FONT_BODY, FONT_HEAD, GOLD, NAVY_RICH, WHITE } from '../brand'

/**
 * CashFlowBreakdown — line-by-line waterfall:
 *   + $3,000 rent in
 *   − $2,495 mortgage
 *   − $625   property tax
 *   − $80    insurance
 *   − $200   reserves
 *   = $200/mo net (highlighted gold)
 *
 * Each line stagger-reveals so a beginner can follow along as the VO speaks.
 */
type Props = {
  rent: number
  mortgage: number
  taxes: number
  insurance: number
  reserves: number
  net: number
  enterDelaySec?: number
}

const W = 960
const H = 700

export const CashFlowBreakdown: React.FC<Props> = ({
  rent,
  mortgage,
  taxes,
  insurance,
  reserves,
  net,
  enterDelaySec = 0,
}) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const f = Math.max(0, frame - Math.round(enterDelaySec * fps))

  const ROW_H = 90
  const GAP = 12
  const PAD_X = 60
  const ROW_Y0 = 60

  // Stagger reveal: each row enters with a 14-frame delay
  const STAGGER = 14
  const rows = [
    { label: 'Rent in', amount: rent, sign: '+', color: GOLD, delay: 0 },
    { label: 'Mortgage', amount: mortgage, sign: '−', color: WHITE, delay: STAGGER },
    { label: 'Property tax', amount: taxes, sign: '−', color: WHITE, delay: STAGGER * 2 },
    { label: 'Insurance', amount: insurance, sign: '−', color: WHITE, delay: STAGGER * 3 },
    { label: 'Reserves & repairs', amount: reserves, sign: '−', color: WHITE, delay: STAGGER * 4 },
  ]
  const totalDelay = STAGGER * 5 + 8 // total appears after all rows + extra beat

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '100%', maxWidth: 960, maxHeight: 700 }}>
      {/* Headline */}
      <text x={W / 2} y={36} fill={WHITE} fontFamily={FONT_HEAD} fontSize={36} textAnchor="middle">
        One month, in detail
      </text>

      {/* Rows */}
      {rows.map((row, i) => {
        const rowF = f - row.delay
        const rowOpacity = interpolate(rowF, [0, 12], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
        const rowY = ROW_Y0 + i * (ROW_H + GAP)
        const rowEnter = rowF >= 0 ? 1 : 0
        const slideX = (1 - rowOpacity) * 30
        return (
          <g key={i} transform={`translate(${slideX}, 0)`} opacity={rowOpacity * rowEnter}>
            <rect
              x={PAD_X}
              y={rowY}
              width={W - PAD_X * 2}
              height={ROW_H}
              fill={NAVY_RICH}
              opacity={0.55}
              rx={14}
            />
            <text
              x={PAD_X + 28}
              y={rowY + ROW_H / 2 + 12}
              fill={CREAM}
              fontFamily={FONT_BODY}
              fontSize={32}
              opacity={0.95}
            >
              {row.label}
            </text>
            <text
              x={W - PAD_X - 28}
              y={rowY + ROW_H / 2 + 14}
              fill={row.color}
              fontFamily={FONT_HEAD}
              fontSize={42}
              fontWeight={700}
              textAnchor="end"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {row.sign} ${row.amount.toLocaleString('en-US')}
            </text>
          </g>
        )
      })}

      {/* Equals divider */}
      {(() => {
        const dF = f - totalDelay
        const dOpacity = interpolate(dF, [0, 8], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
        const dividerY = ROW_Y0 + rows.length * (ROW_H + GAP) + 8
        return (
          <line
            x1={PAD_X + 60}
            x2={W - PAD_X - 60}
            y1={dividerY}
            y2={dividerY}
            stroke={GOLD}
            strokeWidth={3}
            opacity={dOpacity * 0.8}
          />
        )
      })()}

      {/* Total */}
      {(() => {
        const tF = f - totalDelay
        const tEnter = spring({ frame: Math.max(0, tF), fps, config: { damping: 14, stiffness: 110 } })
        const tOpacity = interpolate(tF, [0, 10], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
        const totalY = ROW_Y0 + rows.length * (ROW_H + GAP) + 36
        const scale = 0.9 + 0.1 * tEnter
        return (
          <g
            transform={`translate(${W / 2}, ${totalY + 56}) scale(${scale}) translate(${-W / 2}, ${-totalY - 56})`}
            opacity={tOpacity}
          >
            <rect
              x={PAD_X + 80}
              y={totalY + 8}
              width={W - PAD_X * 2 - 160}
              height={120}
              fill="rgba(212, 175, 55, 0.12)"
              stroke={GOLD}
              strokeWidth={3}
              rx={18}
            />
            <text
              x={PAD_X + 110}
              y={totalY + 78}
              fill={CREAM}
              fontFamily={FONT_BODY}
              fontSize={32}
            >
              Net cash flow
            </text>
            <text
              x={W - PAD_X - 110}
              y={totalY + 84}
              fill={GOLD}
              fontFamily={FONT_HEAD}
              fontSize={64}
              textAnchor="end"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              ${net.toLocaleString('en-US')}/mo
            </text>
          </g>
        )
      })()}
    </svg>
  )
}
