import { describe, expect, it } from 'vitest'
import { mapPublishedHistoryEvent } from './map-published-history-event'

describe('mapPublishedHistoryEvent', () => {
  it('maps listed without raw.Field', () => {
    expect(
      mapPublishedHistoryEvent(
        { event: 'listed', event_date: '2026-07-22', price: 487000 },
        'RK-1',
        0,
      ),
    ).toMatchObject({
      event_type: 'new_listing',
      label: 'Listed at $487,000',
      price: 487000,
    })
  })

  it('maps pending without raw.Field', () => {
    expect(
      mapPublishedHistoryEvent(
        { event: 'pending', event_date: '2026-08-17', price: 649000 },
        'RK-2',
        1,
      ),
    ).toMatchObject({ event_type: 'status_change', label: 'Pending' })
  })
})
