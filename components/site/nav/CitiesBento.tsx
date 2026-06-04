import Link from 'next/link'
import type { MegaMenuCities } from '@/lib/data'
import { Price, TabularNumber, DaysCount } from '@/components/site/primitives'
import { Tile, PanelHeading } from './megaShared'

/**
 * CitiesBento — the Cities panel. A card per city with active count, median list
 * price, and median days-to-pending. Every stat is null-guarded so a city with
 * partial data shows only what it has, never a 0.
 */

export function CitiesBento({ data }: { data: MegaMenuCities }) {
  return (
    <div className="grid grid-cols-1 gap-5">
      <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-5">
        {data.cities.map((city) => (
          <Tile key={city.citySlug} className="flex flex-col gap-3">
            <Link
              href={city.href}
              className="font-display text-base font-semibold tracking-[-0.01em] text-primary transition hover:text-primary/80"
            >
              {city.name}
            </Link>
            <dl className="space-y-2">
              {city.activeCount != null && (
                <div>
                  <dt className="text-xs leading-[1.5] text-muted-foreground">
                    Active homes
                  </dt>
                  <dd className="font-display text-lg leading-none tabular-nums text-foreground">
                    <TabularNumber value={city.activeCount} />
                  </dd>
                </div>
              )}
              {city.medianListPrice != null && (
                <div>
                  <dt className="text-xs leading-[1.5] text-muted-foreground">
                    Median list price
                  </dt>
                  <dd className="font-display text-lg leading-none tabular-nums text-foreground">
                    <Price value={city.medianListPrice} />
                  </dd>
                </div>
              )}
              {city.medianDaysToPending != null && (
                <div>
                  <dt className="text-xs leading-[1.5] text-muted-foreground">
                    Median to pending
                  </dt>
                  <dd className="font-display text-lg leading-none tabular-nums text-foreground">
                    <DaysCount value={city.medianDaysToPending} />
                  </dd>
                </div>
              )}
            </dl>
          </Tile>
        ))}
      </div>

      <div>
        <PanelHeading>
          <Link href="/cities" className="transition hover:text-primary/80">
            See every city we cover &rarr;
          </Link>
        </PanelHeading>
      </div>
    </div>
  )
}
