import { publicPaceHasRow, publicPaceItems, type PublicPaceRow } from '@/lib/data/market-truth/public-pace'
import { MetricHowLink } from '@/components/site/kb/MetricHowLink.client'
import { PANEL_HOW } from '@/lib/market/how-we-get-our-numbers'

export function PublicPaceStats({
  cityName,
  row,
}: {
  cityName: string
  row: PublicPaceRow
}) {
  if (!publicPaceHasRow(row)) return null
  const items = publicPaceItems(row)
  if (items.length === 0) return null
  return (
    <div className="mkt-panel" aria-label={`${cityName} detached leftover stats`}>
      <div className="mkt-phead">
        <span className="mono-lab">
          ▸ Detached leftover · Market Truth
          <MetricHowLink anchor={PANEL_HOW.pace} label="Detached leftover strip" />
        </span>
      </div>
      <ul className="mkt-bars" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {items.map((item) => (
          <li className="mkt-bar" key={item.key}>
            <span className="bhd">
              <span>
                <b>{item.value}</b> {item.label}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
