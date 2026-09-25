'use client'

/**
 * Photographed open houses on the listing dial.
 *
 * WHAT IT WAS. The installed shadcn carousel (`components/ui/carousel.tsx`),
 * one slide per open house with its day and hours, the ask, the street and
 * the specs, and an "01 / 12" readout under the track.
 *
 * WHAT IT IS (Matt 2026-09-24, "Let's get all of those carousels in place").
 * V3ListingDial: one open house large with its photograph and the card's copy,
 * the rest of the band as thumbnails on the dial's rail, "03 / 12" at its
 * head. The same homes in the same order (this weekend first, then by day and
 * start time, in openHouseFieldItems), each drawn from the row the Field list
 * lists (`item.listing`, built in the same pass). The day and hours ride the
 * photograph as the open badge in the card's own words, and the two soonest
 * still sit in the timetable over the dial (SITE-169) so a visitor can read
 * when two opens happen without turning it.
 *
 * One dial per "when" band, inside the switch; only one shows at a time, so
 * the page reads as one dial and takes the dial's default rail.
 */
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { V3_ROOT_CLASS, V3ChartSwitch, V3ListingDial, v3Text } from '@/components/site/v3'
import { openHouseWhenBands } from './oh-bands'
import type { OpenHouseFieldItem } from './oh-field-items'
import './open-house-field.css'

function OpenHousePhotos({
  id,
  items,
  label,
}: {
  /** The dial's root id, unique on the page (one per band). */
  id: string
  items: readonly OpenHouseFieldItem[]
  label: string
}) {
  const photographed = items.filter((item) => Boolean(item.photoSrc?.trim()))
  const rail = photographed.length > 0 ? photographed : items
  if (rail.length === 0) return null

  return (
    <div className="oh-rail-wrap">
      <V3ListingDial
        id={id}
        label={label}
        listings={rail.map((item) => item.listing)}
        className="oh-dial"
      />
    </div>
  )
}

export function OpenHouseFold({
  items,
  railLabel,
}: {
  items: readonly OpenHouseFieldItem[]
  railLabel: string
}) {
  const upcoming = items.filter((item) => Boolean(item.when)).slice(0, 2)
  const bands = openHouseWhenBands(items)

  if (items.length === 0) return null

  return (
    <div className={cn(V3_ROOT_CLASS, 'oh-fold')}>
      {upcoming.length > 0 ? (
        <ol className="oh-upcoming" aria-label="When these homes are open">
          {upcoming.map((item) => (
            <li key={item.id}>
              <Link href={item.href} className="oh-upcoming__link">
                <span className="oh-upcoming__when">{item.when}</span>
                <span className="oh-upcoming__place">{item.title}</span>
              </Link>
            </li>
          ))}
        </ol>
      ) : null}
      {bands.length > 1 ? (
        <V3ChartSwitch
          label={v3Text('When')}
          items={bands.map((band) => ({ key: band.key, label: v3Text(band.label) }))}
          defaultKey={bands[0]?.key}
          className="oh-bands"
        >
          {bands.map((band) => (
            <OpenHousePhotos
              key={band.key}
              id={`oh-when-${band.key}`}
              items={band.items}
              label={`${railLabel} · ${band.label}`}
            />
          ))}
        </V3ChartSwitch>
      ) : bands.length === 1 && bands[0] ? (
        <OpenHousePhotos id={`oh-when-${bands[0].key}`} items={bands[0].items} label={railLabel} />
      ) : (
        <OpenHousePhotos id="oh-when" items={items} label={railLabel} />
      )}
    </div>
  )
}
