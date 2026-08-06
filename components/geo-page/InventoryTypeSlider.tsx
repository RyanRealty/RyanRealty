'use client'

import Image from 'next/image'
import Link from 'next/link'
import TilesSlider, { TilesSliderItem } from '@/components/TilesSlider'
import { Card, CardContent } from '@/components/ui/card'
import type { InventoryBreakdown } from '@/app/actions/inventory-breakdown'
import { TILE_MIN_HEIGHT_PX } from '@/lib/tile-constants'
import { homesForSalePath } from '@/lib/slug'
import { INVENTORY_TILE_ASSETS, type InventoryTileKey } from '@/lib/inventory-type-tile-assets'

type Props = {
  placeLabel: string
  breakdown: InventoryBreakdown
  /** Display city name used to build /homes-for-sale/{city}/… links */
  browseCityName: string
  /** When set, links scope search to this MLS subdivision (community) */
  browseSubdivisionName?: string | null
}

const TILE_ORDER: InventoryTileKey[] = ['singleFamily', 'condoTownhome', 'landLot', 'manufacturedMobile']

const TILE_LABELS: Record<InventoryTileKey, { title: string; sub: string }> = {
  singleFamily: { title: 'Single family homes', sub: 'Detached homes currently active' },
  condoTownhome: { title: 'Condo and townhome', sub: 'Attached housing options' },
  landLot: { title: 'Lots and land', sub: 'Vacant land inventory' },
  manufacturedMobile: { title: 'Manufactured and mobile', sub: 'Factory-built active listings' },
}

export default function InventoryTypeSlider({
  placeLabel,
  breakdown,
  browseCityName,
  browseSubdivisionName = null,
}: Props) {
  const basePath = homesForSalePath(browseCityName, browseSubdivisionName)

  return (
    <TilesSlider
      title={`Property types in ${placeLabel}`}
      titleId="inventory-type-slider-heading"
      className="px-4 py-10 sm:px-6"
    >
      {TILE_ORDER.map((key) => {
        const asset = INVENTORY_TILE_ASSETS[key]
        const labels = TILE_LABELS[key]
        const count = breakdown[key]
        const href = `${basePath}?propertyType=${encodeURIComponent(asset.propertyTypeSearch)}`
        return (
          <TilesSliderItem key={key} style={{ minHeight: TILE_MIN_HEIGHT_PX }}>
            <Link href={href} className="block h-full">
              <Card className="h-full overflow-hidden">
                <div className="relative aspect-[16/10] w-full bg-muted">
                  <Image
                    src={asset.src}
                    alt={asset.alt}
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 85vw, (max-width: 1024px) 40vw, 320px"
                  />
                </div>
                <CardContent className="flex flex-col gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{labels.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{labels.sub}</p>
                  </div>
                  <p className="text-3xl font-bold text-primary tabular-nums">{count.toLocaleString()}</p>
                  <p className="text-xs font-medium text-accent-foreground">Browse listings →</p>
                </CardContent>
              </Card>
            </Link>
          </TilesSliderItem>
        )
      })}
    </TilesSlider>
  )
}
