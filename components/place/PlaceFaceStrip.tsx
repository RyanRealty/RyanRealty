import type { PlaceFaceStat } from '@/lib/market/publish-place-face'
import '@/components/search/search-ledger.css'

/** Face KPI strip. Only cells the publisher emitted. Miss omits. */
export function PlaceFaceStrip({ stats }: { stats: readonly PlaceFaceStat[] }) {
  if (stats.length === 0) return null
  return (
    <div className="place-face">
      {stats.map((stat) => (
        <div key={stat.id} className="place-face__cell">
          <div className="place-face__value">{stat.value}</div>
          <div className="place-face__label">{stat.label}</div>
        </div>
      ))}
    </div>
  )
}
