import {
  subdivisionCountsHasRow,
  subdivisionCountItems,
  subdivisionExtraItems,
  type SubdivisionCounts,
} from '@/lib/data/market-truth/subdivision-counts'

export function PublicSubdivisionCounts({
  placeName,
  row,
}: {
  placeName: string
  row: SubdivisionCounts
}) {
  if (!subdivisionCountsHasRow(row)) return null
  const items = subdivisionCountItems(row)
  const extras = subdivisionExtraItems(row.extras ?? [])
  if (items.length === 0 && extras.length === 0) return null
  return (
    <>
      {items.length > 0 ? (
        <div className="mkt-panel" aria-label={`${placeName} recorded-plat counts`}>
          <div className="mkt-phead">
            <span className="mono-lab">▸ Detached counts · recorded plat · Market Truth</span>
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
      ) : null}
      {extras.length > 0 ? (
        <div className="mkt-panel" aria-label={`${placeName} other product types`}>
          <div className="mkt-phead">
            <span className="mono-lab">▸ Other product types · recorded plat · Market Truth</span>
          </div>
          <ul className="mkt-bars" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {extras.map((item) => (
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
      ) : null}
    </>
  )
}
