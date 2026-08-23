import {
  formatPaceShare,
  publicPaceHasRow,
  type PublicPaceRow,
} from '@/lib/data/market-truth/public-pace'

export function PublicPaceStats({
  cityName,
  row,
}: {
  cityName: string
  row: PublicPaceRow
}) {
  if (!publicPaceHasRow(row)) return null
  const items: Array<{ key: string; value: string; label: string }> = []
  if (row.daysToContract != null) {
    items.push({
      key: 'dtc',
      value: String(row.daysToContract),
      label: 'days to contract · 12 months',
    })
  }
  if (row.closedCount != null) {
    items.push({
      key: 'closed',
      value: row.closedCount.toLocaleString('en-US'),
      label: 'closed sales · 12 months',
    })
  }
  if (row.newListings != null) {
    items.push({
      key: 'new',
      value: row.newListings.toLocaleString('en-US'),
      label: 'new listings · 12 months',
    })
  }
  if (row.priceCutShare != null) {
    items.push({
      key: 'cut',
      value: formatPaceShare(row.priceCutShare),
      label: 'closed with a price cut · 12 months',
    })
  }
  if (row.daysToClose != null) {
    items.push({
      key: 'close',
      value: String(row.daysToClose),
      label: 'days to close · 12 months',
    })
  }
  if (items.length === 0) return null
  return (
    <div className="mkt-panel" aria-label={`${cityName} 12-month detached pace`}>
      <div className="mkt-phead">
        <span className="mono-lab">▸ 12-month pace · Market Truth</span>
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
