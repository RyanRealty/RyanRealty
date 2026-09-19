import { cn } from '@/lib/utils'
import {
  bandGlance,
  bandLabel,
  bandPosition,
  type PpsfBand,
} from '@/components/search/ppsf-band'

/**
 * Visible comparison mark on a search card (SITE-110).
 *
 * SITE-44 shipped the track + tick, but the evaluator called it mute — no
 * label, no claim. The glance line is the information increment: one sentence
 * saying where this home sits among the homes currently in view.
 */
export function PpsfMark({
  band,
  value,
  className,
}: {
  band: PpsfBand | null | undefined
  value: number | null
  className?: string
}) {
  if (!band) return null
  const label = bandLabel(band, value)
  return (
    <span className={cn('srch-ppsf-wrap', className)}>
      <span className="srch-ppsf-glance">{bandGlance(band, value)}</span>
      <span className="srch-ppsf" role="img" aria-label={label} title={label}>
        <span
          className="srch-ppsf__mid"
          style={{
            left: `${bandPosition(band, band.q1)}%`,
            right: `${100 - bandPosition(band, band.q3)}%`,
          }}
        />
        {value != null && value > 0 ? (
          <span className="srch-ppsf__tick" style={{ left: `${bandPosition(band, value)}%` }} />
        ) : (
          <span className="srch-ppsf__none">no living area reported</span>
        )}
      </span>
    </span>
  )
}
