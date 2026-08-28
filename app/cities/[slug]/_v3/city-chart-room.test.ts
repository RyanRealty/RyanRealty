import { describe, expect, it } from 'vitest'
import { v3Text, type V3ChartCardProps } from '@/components/site/v3'
import { buyerFaceLine, cityChartRoomCards } from './city-chart-room'

function card(id: string, caption: string): V3ChartCardProps {
  return {
    id,
    title: v3Text('Finding'),
    source: v3Text('Source disclosure'),
    chart: {
      caption: v3Text(caption),
      kind: 'line',
      series: [{ name: v3Text('Series'), points: [{ value: 1, tick: v3Text('2024'), label: v3Text('$1') }] }],
    },
  }
}

describe('buyerFaceLine', () => {
  it('strips warehouse words from the face caption', () => {
    expect(buyerFaceLine('Months of supply by town, leftover membership, single-family.')).toBe(
      'Months of supply by town, single-family.',
    )
    expect(buyerFaceLine('Median close by month, Market Truth leftover, Redmond')).toBe(
      'Median close by month, Redmond',
    )
    expect(buyerFaceLine('Median days to pending by town, leftover 90-day list-to-pending.')).toBe(
      'Median days to pending by town, 90-day list to pending.',
    )
  })
})

describe('cityChartRoomCards', () => {
  it('orders Time, Relate, Rank from live cards and skips missing views', () => {
    const room = cityChartRoomCards([
      card('city-town-dtp', 'Days to pending, leftover membership'),
      card('city-town-year', 'Median detached close price per year, 2018–2025.'),
      card('city-town-sto', 'Sale to original ask by town.'),
      card('city-town-mos', 'Months of supply by town, leftover membership, single-family.'),
    ])
    expect(room.map((c) => c.id)).toEqual(['chart-room-time', 'chart-room-relate', 'chart-room-rank'])
    expect(room.map((c) => c.line)).toEqual(['Time', 'Relate', 'Rank'])
    expect(room[0]?.chart?.caption).toBe('Median detached close price per year, 2018–2025.')
    expect(room[2]?.chart?.caption).toBe('Months of supply by town, single-family.')
  })

  it('uses days-to-pending for Rank when months of supply is missing', () => {
    const room = cityChartRoomCards([card('city-town-dtp', 'Days to pending by town.')])
    expect(room.map((c) => c.id)).toEqual(['chart-room-rank'])
    expect(room[0]?.line).toBe('Rank')
  })
})
