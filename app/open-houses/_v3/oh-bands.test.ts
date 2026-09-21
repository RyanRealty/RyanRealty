import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { openHouseWhenBands } from './oh-bands'
import { OH_FIELD_TRACE } from './oh-constants'
import type { OpenHouseFieldItem } from './oh-field-items'
import { isWeekendIso } from './oh-when'

function item(over: Partial<OpenHouseFieldItem> = {}): OpenHouseFieldItem {
  return {
    id: 'oh-1',
    href: '/homes-for-sale/bend/123-pine-st-220000001',
    priceLabel: '$625,000',
    title: '123 Pine St, Bend',
    eventDate: '2026-08-15',
    weekend: true,
    when: 'Sat, Aug 15, 2026 · 2pm-4pm',
    meta: 'Sat, Aug 15, 2026 · 2pm-4pm · 3 bd · 2 ba · 1,800 sqft',
    ...over,
  }
}

describe('isWeekendIso', () => {
  it('names Saturday and Sunday and rejects a weekday or a junk date', () => {
    expect(isWeekendIso('2026-08-15')).toBe(true)
    expect(isWeekendIso('2026-08-16')).toBe(true)
    expect(isWeekendIso('2026-08-17')).toBe(false)
    expect(isWeekendIso('2026-02-31')).toBe(false)
    expect(isWeekendIso('')).toBe(false)
  })
})

describe('openHouseWhenBands', () => {
  it('omits an empty weekend band', () => {
    const bands = openHouseWhenBands([item({ id: 'wd', eventDate: '2026-08-17', weekend: false })])
    expect(bands.map((band) => band.key)).toEqual(['later'])
  })

  it('leads with this weekend when both exist', () => {
    const bands = openHouseWhenBands([
      item({ id: 'wd', eventDate: '2026-08-17', weekend: false }),
      item({ id: 'we', eventDate: '2026-08-15', weekend: true }),
    ])
    expect(bands.map((band) => band.key)).toEqual(['weekend', 'later'])
    expect(bands[0]?.items.map((row) => row.id)).toEqual(['we'])
  })
})

describe('SITE-169 source line', () => {
  it('does not talk about the pipeline', () => {
    expect(OH_FIELD_TRACE.toLowerCase()).not.toContain('the same openhouses pull as the count above')
    expect(OH_FIELD_TRACE).toMatch(/MLS OpenHouses field/i)
  })
})

describe('SITE-169 catalog', () => {
  it('the fold imports the installed shadcn carousel', () => {
    const src = readFileSync(join(process.cwd(), 'app/open-houses/_v3/OpenHouseFold.client.tsx'), 'utf8')
    expect(src).toContain('@/components/ui/carousel')
    expect(src).toContain('CarouselPrevious')
    expect(src).toContain('CarouselNext')
  })
})
