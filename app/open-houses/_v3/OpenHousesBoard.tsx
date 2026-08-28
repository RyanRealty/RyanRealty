'use client'

/**
 * Open-houses inventory: compact H1 + honest count, date/city doors that
 * already exist as URL params, photographed cards, and Show more when the
 * mosaic would otherwise lie about the total.
 */
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { V3Button, V3Field, V3Heading, V3_ROOT_CLASS } from '@/components/site/v3'
import { getSavedListingKeys } from '@/app/actions/saved-listings'
import { cn } from '@/lib/utils'
import {
  OH_CITY_SLUGS,
  OH_FIELD_TRACE,
  addIsoDays,
  cityLabel,
  thisWeekendIso,
} from './oh-constants'
import type { OpenHouseFieldItem } from './oh-field-items'
import './open-houses-board.css'

export const OH_PAGE_SIZE = 12

function withDates(path: string, dateFrom: string, dateTo: string, weekFrom: string, weekTo: string): string {
  if (dateFrom === weekFrom && dateTo === weekTo) return path
  const q = new URLSearchParams({ dateFrom, dateTo })
  return `${path}?${q.toString()}`
}

function windowNoun(kind: 'week' | 'today' | 'weekend', count: number): string {
  const house = count === 1 ? 'open house' : 'open houses'
  if (kind === 'today') return `${house} today`
  if (kind === 'weekend') return `${house} this weekend`
  return `${house} this week`
}

export function OpenHousesBoard({
  heading,
  items,
  citySlug = '',
  todayIso,
  dateFrom,
  dateTo,
  emptyMessage,
}: {
  heading: string
  items: OpenHouseFieldItem[]
  citySlug?: string
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
  const [savedKeys, setSavedKeys] = useState<ReadonlySet<string>>(new Set())
  useEffect(() => {
    void getSavedListingKeys().then((keys) => setSavedKeys(new Set(keys)))
  }, [])
  const visible = useMemo(
    () =>
      items.slice(0, shown).map((item) => ({
        ...item,
        saved: item.listingKey ? savedKeys.has(item.listingKey) : false,
      })),
    [items, shown, savedKeys],
  )
  const moreLeft = total - shown
  const basePath = citySlug ? `/open-houses/${citySlug}` : '/open-houses'

  const dateDoors = [
    {
      label: 'This week',
      href: withDates(basePath, todayIso, weekTo, todayIso, weekTo),
      active: kind === 'week',
    },
    {
      label: 'Today',
      href: withDates(basePath, todayIso, todayIso, todayIso, weekTo),
      active: kind === 'today',
    },
    {
      label: 'This weekend',
      href: withDates(basePath, weekend.dateFrom, weekend.dateTo, todayIso, weekTo),
      active: kind === 'weekend',
    },
  ]

  const cityDoors = [
    {
      label: 'All cities',
      href: withDates('/open-houses', dateFrom, dateTo, todayIso, weekTo),
      active: citySlug === '',
    },
    ...OH_CITY_SLUGS.map((slug) => ({
      label: cityLabel(slug),
      href: withDates(`/open-houses/${slug}`, dateFrom, dateTo, todayIso, weekTo),
      active: citySlug === slug,
    })),
  ]

  return (
    <div className={cn(V3_ROOT_CLASS, 'oh-board')}>
      <header className="oh-board__head">
        <V3Heading level={1} size="field">
          {heading}
        </V3Heading>
        {total > 0 ? (
          <p className="oh-board__count">
            <span className="oh-board__count-value">{total.toLocaleString('en-US')}</span>
            {` ${windowNoun(kind, total)}`}
            {moreLeft > 0
              ? ` · ${visible.length.toLocaleString('en-US')} on this screen`
              : ''}
          </p>
        ) : null}
        <nav aria-label="Open house dates" className="oh-board__filters">
          {dateDoors.map((door) => (
            <Link
              key={door.label}
              href={door.href}
              className={cn('oh-board__chip', door.active && 'is-active')}
              aria-current={door.active ? 'page' : undefined}
            >
              {door.label}
            </Link>
          ))}
        </nav>
        <nav aria-label="Open house cities" className="oh-board__filters">
          {cityDoors.map((door) => (
            <Link
              key={door.label}
              href={door.href}
              className={cn('oh-board__chip', door.active && 'is-active')}
              aria-current={door.active ? 'page' : undefined}
            >
              {door.label}
            </Link>
          ))}
        </nav>
      </header>

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
        footNote={
          visible.some((item) => item.photoSrc)
            ? 'Each photograph opens the listing.'
            : undefined
        }
        emptyMessage={emptyMessage}
      />

      {moreLeft > 0 ? (
        <div className="oh-board__more">
          <V3Button
            variant="ghost"
            onClick={() => setShown((n) => Math.min(n + OH_PAGE_SIZE, total))}
          >
            {`Show ${Math.min(OH_PAGE_SIZE, moreLeft).toLocaleString('en-US')} more`}
          </V3Button>
        </div>
      ) : null}
    </div>
  )
}
