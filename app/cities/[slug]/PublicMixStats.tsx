import { publicMixHasRow, publicMixItems, type PublicMixRow } from '@/lib/data/market-truth/public-mix'
import { MetricHowLink } from '@/components/site/kb/MetricHowLink.client'
import { PANEL_HOW } from '@/lib/market/how-we-get-our-numbers'

export function PublicMixStats({
  cityName,
  row,
}: {
  cityName: string
  row: PublicMixRow
}) {
  if (!publicMixHasRow(row)) return null
  const items = publicMixItems(row)
  if (items.length === 0) return null
  return (
    <div className="mkt-panel" aria-label={`${cityName} detached leftover mix`}>
      <div className="mkt-phead">
        <span className="mono-lab">
          ▸ Detached mix · leftover
          <MetricHowLink anchor={PANEL_HOW.mix} label="Detached mix" />
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
