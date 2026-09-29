'use client'

/**
 * Opening breakdown + photographed Field. Count stays a caption on the
 * server; this island is what the reader does with it — cut-size bands
 * that swap the listing dial, and city doors a crawler can follow.
 */
import Link from 'next/link'
import { V3ChartSwitch, V3_ROOT_CLASS, v3Text } from '@/components/site/v3'
import { cn } from '@/lib/utils'
import { PriceDropPhotos } from './PriceDropPhotos.client'
import { priceDropBands, priceDropCityDoors } from './drops-bands'
import type { PriceDropFieldItem } from './drops-field-items'
import './price-drops-field.css'

export function PriceDropsFold({
  items,
  railLabel,
  showCityDoors = true,
}: {
  items: readonly PriceDropFieldItem[]
  railLabel: string
  showCityDoors?: boolean
}) {
  const bands = priceDropBands(items)
  // Ranked, most cuts first, so the bars read as a chart and not a list in
  // the order the towns were named (2026-09-29).
  const doors = showCityDoors
    ? [...priceDropCityDoors(items)].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    : []
  // The cuts in a town with no page of its own (Terrebonne, Powell Butte...)
  // are counted on their own row, so the rows add up to the homes above
  // (2026-09-25: seven towns summed to 47 under "48 shown below").
  const elsewhere = items.length - doors.reduce((sum, door) => sum + door.count, 0)
  const maxDoor = Math.max(1, elsewhere, ...doors.map((door) => door.count))

  if (bands.length === 0) return null

  return (
    <div className={cn(V3_ROOT_CLASS, 'pd-fold-stage')}>
      <V3ChartSwitch
        label={v3Text('Cut size')}
        items={bands.map((band) => ({ key: band.key, label: v3Text(band.label) }))}
        className="pd-bands"
      >
        {bands.map((band, i) => (
          <PriceDropPhotos
            key={band.key}
            id={`pd-cuts-${band.key}`}
            items={band.items}
            label={`${railLabel} · ${band.label}`}
            // The switch opens on the first band; only its first photograph is
            // the fold's largest paint (the others are hidden panels).
            priority={i === 0}
          />
        ))}
      </V3ChartSwitch>
      {doors.length > 0 ? (
        // Each city's door carries how many of the cuts above are there, as a
        // count and a bar on one scale (2026-09-25: a bare row of names).
        <nav className="pd-cities" aria-label="Price cuts by city">
          {doors.map((door) => (
            <Link key={door.slug} href={door.href} className="pd-cities__link">
              <span className="pd-cities__name">{door.label}</span>
              <span className="pd-cities__bar" aria-hidden="true">
                <span style={{ width: `${((door.count / maxDoor) * 100).toFixed(1)}%` }} />
              </span>
              <span className="pd-cities__count">
                {door.count} {door.count === 1 ? 'cut' : 'cuts'}
              </span>
            </Link>
          ))}
          {elsewhere > 0 ? (
            <span className="pd-cities__link pd-cities__link--rest">
              <span className="pd-cities__name">Other towns</span>
              <span className="pd-cities__bar" aria-hidden="true">
                <span style={{ width: `${((elsewhere / maxDoor) * 100).toFixed(1)}%` }} />
              </span>
              <span className="pd-cities__count">
                {elsewhere} {elsewhere === 1 ? 'cut' : 'cuts'}
              </span>
            </span>
          ) : null}
        </nav>
      ) : null}
    </div>
  )
}
