/**
 * Chart Room on the city page: Time / Relate / Rank as V3Chart cards.
 * Face copy is buyer voice. Warehouse names stay in the collapsed Source.
 */
import { v3Text, type V3ChartCardProps, type V3ChartProps } from '@/components/site/v3'

export type ChartRoom = 'Time' | 'Relate' | 'Rank'

export function buyerFaceLine(raw: string): string {
  const next = raw
    .replace(/Market Truth leftover,?\s*/gi, '')
    .replace(/leftover membership,?\s*/gi, '')
    .replace(/leftover 90-day list-to-pending/gi, '90-day list to pending')
    .replace(/\s+,/g, ',')
    .replace(/,\s*,/g, ',')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+\./g, '.')
    .replace(/^[,\s]+|[,\s]+$/g, '')
    .trim()
  return next || raw.trim()
}

function cardIdSuffix(id: string | undefined): string {
  return (id ?? '').replace(/^city-town-/, '')
}

function withBuyerChart(chart: V3ChartProps): V3ChartProps {
  return { ...chart, caption: v3Text(buyerFaceLine(String(chart.caption))) }
}

function asRoom(card: V3ChartCardProps, room: ChartRoom): V3ChartCardProps {
  const chart = card.chart ? withBuyerChart(card.chart) : undefined
  return {
    ...card,
    id: `chart-room-${room.toLowerCase()}`,
    line: v3Text(room),
    wide: true,
    ...(chart ? { chart } : {}),
  }
}

/**
 * Pick live Chart Room forms: year line = Time, sale-to-ask = Relate,
 * months of supply (else days to pending) = Rank. Omit a view with no rows.
 */
export function cityChartRoomCards(cards: readonly V3ChartCardProps[]): V3ChartCardProps[] {
  const bySuffix = new Map(cards.map((card) => [cardIdSuffix(card.id), card]))
  const time = bySuffix.get('year')
  const relate = bySuffix.get('sto')
  const rank = bySuffix.get('mos') ?? bySuffix.get('dtp')
  const out: V3ChartCardProps[] = []
  if (time?.chart) out.push(asRoom(time, 'Time'))
  if (relate?.chart) out.push(asRoom(relate, 'Relate'))
  if (rank?.chart) out.push(asRoom(rank, 'Rank'))
  return out
}
