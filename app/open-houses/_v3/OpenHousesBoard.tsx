'use client'

/**
 * Open-houses Field. City/ZIP opener: compact H1, then V3Field photo doors.
 * No page stylesheet. Pagination lives on Field so the count matches the
 * photographs (PUBLIC_UI.md §3: counts honest to the viewport).
 */
import { useState } from 'react'
import { V3Field, V3Heading } from '@/components/site/v3'
import { OH_FIELD_TRACE, addIsoDays, thisWeekendIso } from './oh-constants'
import type { OpenHouseFieldItem } from './oh-field-items'

export const OH_PAGE_SIZE = 12

function windowNoun(kind: 'week' | 'today' | 'weekend', count: number): string {
  const house = count === 1 ? 'open house' : 'open houses'
  if (kind === 'today') return `${house} today`
  if (kind === 'weekend') return `${house} this weekend`
  return `${house} this week`
}

export function OpenHousesBoard({
  heading,
  items,
  todayIso,
  dateFrom,
  dateTo,
  emptyMessage,
}: {
  heading: string
  items: OpenHouseFieldItem[]
  todayIso: string
  dateFrom: string
  dateTo: string
  emptyMessage: string
}) {
  const weekTo = addIsoDays(todayIso, 6)
  const weekend = thisWeekendIso(todayIso)
  const kind: 'week' | 'today' | 'weekend' =
    dateFrom === todayIso && dateTo === todayIso
      ? 'today'
      : dateFrom === weekend.dateFrom && dateTo === weekend.dateTo
        ? 'weekend'
        : 'week'
  const total = items.length
  const [shown, setShown] = useState(() => Math.min(OH_PAGE_SIZE, total))
  const visible = items.slice(0, shown)
  const moreLeft = total - shown

  return (
    <>
      <V3Heading level={1} size="field" className="v3-field-place-name">
        {heading}
      </V3Heading>
      <V3Field
        id="calendar"
        ariaLabel={heading}
        items={visible}
        photoMax={visible.length}
        count={
          visible.length > 0
            ? {
                value: visible.length.toLocaleString('en-US'),
                label:
                  moreLeft > 0
                    ? `shown · ${total.toLocaleString('en-US')} ${windowNoun(kind, total)}`
                    : windowNoun(kind, visible.length),
                source: OH_FIELD_TRACE,
              }
            : undefined
        }
        more={
          moreLeft > 0
            ? {
                label: `Show ${Math.min(OH_PAGE_SIZE, moreLeft).toLocaleString('en-US')} more`,
                onClick: () => setShown((n) => Math.min(n + OH_PAGE_SIZE, total)),
              }
            : undefined
        }
        footNote={
          visible.some((item) => item.photoSrc)
            ? 'Each photograph opens the listing.'
            : undefined
        }
        emptyMessage={emptyMessage}
      />
    </>
  )
}
