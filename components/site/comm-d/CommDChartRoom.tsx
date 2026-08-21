import { V3ChartCard, v3Text } from '@/components/site/v3'
import type { CommDChartCard } from '@/lib/communities/comm-d-chart-room'

export function CommDChartRoom({ cards }: { cards: readonly CommDChartCard[] }) {
  if (cards.length === 0) return null
  return (
    <section className="comm-d-section" aria-labelledby="comm-d-charts">
      <div className="comm-d-wrap">
        <div className="comm-d-section-head">
          <span className="comm-d-eyebrow">Chart Room</span>
          <h2 id="comm-d-charts" className="comm-d-display">
            Time, Relate, Rank
          </h2>
        </div>
        <div className="comm-d-charts">
          {cards.map((card) => (
            <V3ChartCard
              key={card.id}
              id={`comm-d-${card.id}`}
              title={v3Text(card.title)}
              line={v3Text(card.line)}
              source={v3Text(card.source)}
              wide
              chart={{
                caption: v3Text(card.line),
                kind: card.kind,
                layout: card.layout,
                series: card.series.map((series) => ({
                  name: v3Text(series.name),
                  points: series.points.map((point) => ({
                    value: point.value,
                    tick: v3Text(point.tick),
                    label: v3Text(point.label),
                    at: point.at,
                  })),
                })),
                emptyReason: card.emptyReason ? v3Text(card.emptyReason) : undefined,
              }}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
