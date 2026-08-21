import type { HoodDCompareRow } from './types'

export function HoodDCompare({
  name,
  cityName,
  rows,
}: {
  name: string
  cityName: string
  rows: HoodDCompareRow[]
}) {
  if (rows.length === 0) return null

  return (
    <section className="hood-d-section" id="compare">
      <div className="hood-d-wrap">
        <div className="hood-d-section-head">
          <span className="hood-d-eyebrow">Live figures</span>
          <h2 className="hood-d-display">
            Compare {name} | {cityName}
          </h2>
        </div>
        <table className="hood-d-compare">
          <thead>
            <tr>
              <th scope="col"> </th>
              <th scope="col">{name}</th>
              <th scope="col">{cityName}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label}>
                <th scope="row">{row.label}</th>
                <td>{row.here}</td>
                <td>{row.city}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
