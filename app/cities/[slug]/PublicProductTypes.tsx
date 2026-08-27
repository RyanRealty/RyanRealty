import {
  publicSegmentBrowseHref,
  publicSegmentDisplayBits,
  publicSegmentNoun,
  type PublicSegmentRow,
} from '@/lib/data/market-truth/public-segments'
import { MetricHowLink } from '@/components/site/kb/MetricHowLink.client'
import { PANEL_HOW } from '@/lib/market/how-we-get-our-numbers'

export function PublicProductTypes({
  cityName,
  citySlug,
  postalCode,
  rows,
}: {
  cityName: string
  citySlug: string
  postalCode?: string | null
  rows: readonly PublicSegmentRow[]
}) {
  if (rows.length === 0) return null
  return (
    <div className="mkt-panel" aria-label={`${cityName} other product types`}>
      <div className="mkt-phead">
        <span className="mono-lab">
          ▸ Other product types · Market Truth
          <MetricHowLink anchor={PANEL_HOW.products} label="Other product types" />
        </span>
      </div>
      <ul className="mkt-bars" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {rows.map((row) => {
          const noun = publicSegmentNoun(row.segment, row.activeCount ?? 0)
          const bits = publicSegmentDisplayBits(row)
          return (
            <li className="mkt-bar" key={row.segment}>
              <a
                href={publicSegmentBrowseHref(citySlug, row.segment, { postalCode })}
                className="bhd"
                style={{ color: 'inherit', textDecoration: 'none' }}
              >
                <span>
                  <b>{row.activeCount?.toLocaleString('en-US')}</b> {noun}
                </span>
                {/* Each stat fragment carries its trailing separator inside one
                    inline-block, so a wrap breaks BETWEEN fragments and never
                    strands a bare "·" at a line edge (375px mobile QA
                    2026-08-26). Text content is byte-identical to the old
                    bits.join(' · '). */}
                <b>
                  {bits.map((bit, i) => (
                    <span key={i} className="inline-block">
                      {i < bits.length - 1 ? `${bit} ·` : bit}
                    </span>
                  )).flatMap((node, i) => (i > 0 ? [' ', node] : [node]))}
                </b>
              </a>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
