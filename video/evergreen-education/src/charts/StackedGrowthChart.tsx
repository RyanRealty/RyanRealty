import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion'
import { CREAM, FONT_BODY, FONT_HEAD, GOLD, GOLD_SOFT, NAVY_RICH, PILLAR_COLORS, WHITE } from '../brand'

/**
 * StackedGrowthChart — 4 separate growth curves overlaid showing each pillar's
 * contribution year-over-year. Total at year 20 is the headline number.
 *
 * Replaces the v1 4-bar endpoint chart with the actual *journey*.
 */
type Series = {
  year: number
  cashFlow: number
  appreciation: number
  loanPaydown: number
  taxSavings: number
  total: number
}

type Props = {
  series: Series[]
  enterDelaySec?: number
}

const W = 960
const H = 700

export const StackedGrowthChart: React.FC<Props> = ({ series, enterDelaySec = 0 }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const f = Math.max(0, frame - Math.round(enterDelaySec * fps))
  const reveal = interpolate(f, [0, fps * 1.8], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })

  const PAD_X = 80
  const TOP = 110
  const HEIGHT = 380
  const BOTTOM = TOP + HEIGHT
  const maxY = series.length ? Math.max(...series.map((s) => s.total)) : 700_000
  const maxX = series.length ? series[series.length - 1].year : 20

  const xAt = (yr: number) => PAD_X + (yr / maxX) * (W - PAD_X * 2)
  const yAt = (v: number) => BOTTOM - (v / maxY) * HEIGHT

  // Per-pillar staggered reveal — each curve appears 0.4s after the previous,
  // so the viewer sees each pillar contribute one at a time.
  const PILLAR_STAGGER = Math.round(fps * 0.4)
  const apprStart = 0
  const paydownStart = PILLAR_STAGGER
  const taxStart = PILLAR_STAGGER * 2
  const cfStart = PILLAR_STAGGER * 3
  const totalStart = PILLAR_STAGGER * 4

  const revealFor = (startFrame: number) => {
    const localF = f - startFrame
    return interpolate(localF, [0, fps * 1.2], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  }

  const buildPath = (key: keyof Series, startFrame: number) => {
    const r = revealFor(startFrame)
    if (r <= 0) return ''
    const visCount = Math.max(2, Math.round(series.length * r))
    const v = series.slice(0, visCount)
    return `M ${v.map((s) => `${xAt(s.year).toFixed(1)},${yAt(s[key] as number).toFixed(1)}`).join(' L ')}`
  }
  const apprPath = buildPath('appreciation', apprStart)
  const paydownPath = buildPath('loanPaydown', paydownStart)
  const taxPath = buildPath('taxSavings', taxStart)
  const cfPath = buildPath('cashFlow', cfStart)
  const totalPath = buildPath('total', totalStart)

  const visibleCount = Math.max(2, Math.round(series.length * revealFor(totalStart)))
  const vis = series.slice(0, visibleCount)

  // Total area under curve
  const totalArea =
    vis.length >= 2
      ? `M ${vis.map((s) => `${xAt(s.year).toFixed(1)},${yAt(s.total).toFixed(1)}`).join(' L ')} L ${xAt(vis[vis.length - 1].year).toFixed(1)},${BOTTOM.toFixed(1)} L ${PAD_X.toFixed(1)},${BOTTOM.toFixed(1)} Z`
      : ''

  const last = vis[vis.length - 1]

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '100%', maxWidth: 960, maxHeight: 700 }}>
      {/* Headline */}
      <text x={W / 2} y={48} fill={WHITE} fontFamily={FONT_HEAD} fontSize={40} textAnchor="middle">
        Equity built per year — all 4 pillars
      </text>

      {/* Total area (faint backdrop) */}
      <path d={totalArea} fill={GOLD} opacity={0.10} />

      {/* Axes */}
      <line x1={PAD_X} y1={BOTTOM} x2={W - PAD_X} y2={BOTTOM} stroke={NAVY_RICH} strokeWidth={2} />
      <line x1={PAD_X} y1={TOP} x2={PAD_X} y2={BOTTOM} stroke={NAVY_RICH} strokeWidth={2} />

      {/* Per-pillar curves */}
      <path d={apprPath} fill="none" stroke={PILLAR_COLORS.appreciation} strokeWidth={4} strokeLinecap="round" />
      <path d={paydownPath} fill="none" stroke={PILLAR_COLORS.loanPaydown} strokeWidth={4} strokeLinecap="round" />
      <path d={taxPath} fill="none" stroke={PILLAR_COLORS.taxSavings} strokeWidth={4} strokeLinecap="round" />
      <path d={cfPath} fill="none" stroke={PILLAR_COLORS.cashFlow} strokeWidth={3} strokeLinecap="round" />

      {/* Total curve on top */}
      <path d={totalPath} fill="none" stroke={GOLD} strokeWidth={6} strokeLinecap="round" />

      {/* Year markers */}
      {[3, 5, 10, 20].map((y) => (
        <g key={y}>
          <text
            x={xAt(y)}
            y={BOTTOM + 30}
            fill={CREAM}
            fontFamily={FONT_BODY}
            fontSize={22}
            textAnchor="middle"
            opacity={0.75}
          >
            y{y}
          </text>
        </g>
      ))}

      {/* Total at end (year 20) */}
      {last && last.year >= maxX ? (
        <g>
          <circle cx={xAt(last.year)} cy={yAt(last.total)} r={9} fill={GOLD} stroke={WHITE} strokeWidth={2} />
          <text
            x={xAt(last.year) - 16}
            y={yAt(last.total) - 18}
            fill={GOLD}
            fontFamily={FONT_HEAD}
            fontSize={42}
            textAnchor="end"
          >
            ${(last.total / 1000).toFixed(0)}K
          </text>
        </g>
      ) : null}

      {/* Legend */}
      <g transform={`translate(${PAD_X}, ${BOTTOM + 64})`}>
        {[
          ['appreciation', 'Appreciation'],
          ['loanPaydown', 'Loan paydown'],
          ['taxSavings', 'Tax savings'],
          ['cashFlow', 'Cash flow'],
        ].map(([key, label], i) => (
          <g key={key} transform={`translate(${i * 220}, 0)`}>
            <rect x={0} y={-14} width={18} height={18} fill={PILLAR_COLORS[key as keyof typeof PILLAR_COLORS]} />
            <text x={26} y={1} fill={WHITE} fontFamily={FONT_BODY} fontSize={20}>{label}</text>
          </g>
        ))}
      </g>
    </svg>
  )
}
