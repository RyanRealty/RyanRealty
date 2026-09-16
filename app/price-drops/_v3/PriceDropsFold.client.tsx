'use client'

/**
 * Opening breakdown + photographed Field. Count stays a caption on the
 * server; this island is what the reader does with it — cut-size bands
 * that swap the shadcn carousel, and city doors a crawler can follow.
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
  const doors = showCityDoors ? priceDropCityDoors(items) : []

  if (bands.length === 0) return null

  return (
    <div className={cn(V3_ROOT_CLASS, 'pd-fold-stage')}>
      <V3ChartSwitch
        label={v3Text('Cut size')}
        items={bands.map((band) => ({ key: band.key, label: v3Text(band.label) }))}
        className="pd-bands"
      >
        {bands.map((band) => (
          <PriceDropPhotos
            key={band.key}
            items={band.items}
            label={`${railLabel} · ${band.label}`}
          />
        ))}
      </V3ChartSwitch>
      {doors.length > 0 ? (
        <nav className="pd-cities" aria-label="Price cuts by city">
          {doors.map((door) => (
            <Link key={door.slug} href={door.href} className="pd-cities__link">
              {door.label}
            </Link>
          ))}
        </nav>
      ) : null}
    </div>
  )
}
