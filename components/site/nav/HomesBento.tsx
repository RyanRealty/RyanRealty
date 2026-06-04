import Link from 'next/link'
import type { MegaMenuHomes } from '@/lib/data'
import { Price, TabularNumber } from '@/components/site/primitives'
import { Tile, PanelHeading, PanelLink } from './megaShared'

/**
 * HomesBento — the Homes panel. A total-active-count stat tile plus a column per
 * city (active count + median + that city's top popular searches), then a Browse
 * row. Every stat is null-guarded, so a city with no live data still renders its
 * links without a fabricated number.
 */

const BROWSE_LINKS = [
  { href: '/homes-for-sale', label: 'All homes for sale' },
  { href: '/search', label: 'Map search' },
  { href: '/open-houses', label: 'Open houses' },
  { href: '/compare', label: 'Compare homes' },
]

export function HomesBento({ data }: { data: MegaMenuHomes }) {
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
      {/* Lead stat tile */}
      <Tile className="flex flex-col justify-between lg:col-span-3">
        <div>
          <PanelHeading>Homes for sale</PanelHeading>
          {data.totalActiveCount != null && (
            <p className="mt-4 font-display text-4xl leading-none tracking-[-0.01em] tabular-nums text-foreground">
              <TabularNumber value={data.totalActiveCount} />
            </p>
          )}
          {data.totalActiveCount != null && (
            <p className="mt-1.5 text-[13px] leading-[1.55] text-muted-foreground">
              Active homes across the cities we cover
            </p>
          )}
        </div>
        <Link
          href="/homes-for-sale"
          className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-primary transition hover:text-primary/80"
        >
          Browse every listing
          <span aria-hidden>&rarr;</span>
        </Link>
      </Tile>

      {/* City columns */}
      <div className="grid grid-cols-2 gap-5 lg:col-span-9 lg:grid-cols-4">
        {data.cities.slice(0, 4).map((city) => (
          <div key={city.citySlug} className="min-w-0">
            <Link
              href={city.href}
              className="block truncate font-display text-sm font-semibold tracking-[-0.01em] text-primary transition hover:text-primary/80"
            >
              {city.name}
            </Link>
            {(city.activeCount != null || city.medianListPrice != null) && (
              <p className="mt-1 text-xs leading-[1.5] tabular-nums text-muted-foreground">
                {city.activeCount != null && (
                  <>
                    <TabularNumber value={city.activeCount} /> active
                  </>
                )}
                {city.activeCount != null && city.medianListPrice != null && ' · '}
                {city.medianListPrice != null && (
                  <>
                    <Price value={city.medianListPrice} compact /> median
                  </>
                )}
              </p>
            )}
            <ul className="mt-2 space-y-0.5">
              {city.popularSearches.map((search) => (
                <li key={search.href}>
                  <PanelLink href={search.href}>{search.label}</PanelLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Browse row */}
      <div className="lg:col-span-12">
        <ul className="flex flex-wrap gap-2">
          {BROWSE_LINKS.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="inline-flex items-center rounded-full border border-border bg-muted px-4 py-2 text-sm font-medium text-foreground transition hover:bg-primary hover:text-primary-foreground"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
