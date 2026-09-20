import { bandLabel, bandPosition, type PpsfBand } from '@/components/search/ppsf-band'
import { bandReadout } from '@/lib/search/compare-readout'

/**
 * Visible comparison against the homes currently on this map.
 * SITE-110: the mute hairline from SITE-44 was not a comparison signal.
 */
export function SearchCompareMark({
  band,
  value,
}: {
  band: PpsfBand | null | undefined
  value: number | null
}) {
  if (!band) {
    return (
      <span className="srch-ppsf srch-ppsf--empty" data-taste="search-compare">
        <span className="srch-ppsf__none">no living area reported</span>
      </span>
    )
  }

  const readout = bandReadout(band, value)
  const label = bandLabel(band, value != null && value > 0 ? value : null)

  return (
    <span className="srch-ppsf srch-ppsf--labeled" role="img" aria-label={label} data-taste="search-compare">
      <span className="srch-ppsf__label">{readout}</span>
      <span className="srch-ppsf__track" aria-hidden>
        <span
          className="srch-ppsf__mid"
          style={{
            left: `${bandPosition(band, band.q1)}%`,
            right: `${100 - bandPosition(band, band.q3)}%`,
          }}
        />
        {value != null && value > 0 ? (
          <span className="srch-ppsf__tick" style={{ left: `${bandPosition(band, value)}%` }} />
        ) : null}
      </span>
    </span>
  )
}
