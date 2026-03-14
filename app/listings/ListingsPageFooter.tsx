import Link from 'next/link'
import SaveSearchButton from '@/components/SaveSearchButton'
import { homesForSalePath } from '@/lib/slug'
import type { CityForIndex } from '@/lib/cities'

const PRICE_LINKS = [
  { label: 'Under $300K', maxPrice: '300000' },
  { label: 'Under $500K', maxPrice: '500000' },
  { label: 'Under $750K', maxPrice: '750000' },
  { label: 'Under $1M', maxPrice: '1000000' },
  { label: 'Under $1.5M', maxPrice: '1500000' },
]

const BED_LINKS = [1, 2, 3, 4, 5] as const

type Props = {
  cities: CityForIndex[]
  signedIn: boolean
  /** Base path for listing links (e.g. /listings). */
  basePath?: string
}

function formatPrice(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}k`
  return `$${n.toLocaleString()}`
}

export default function ListingsPageFooter({ cities, signedIn, basePath = '/listings' }: Props) {
  return (
    <footer className="border-t border-border bg-card px-4 py-8">
      {/* Save this search CTA */}
      <section className="mb-8">
        <p className="text-sm text-muted-foreground">
          Save this search to get email alerts when new listings match your criteria.
        </p>
        {signedIn && (
          <div className="mt-2">
            <SaveSearchButton user={true} />
          </div>
        )}
        {!signedIn && (
          <p className="mt-2 text-sm text-muted-foreground">
            <Link href="/login" className="font-medium text-primary hover:underline">
              Sign in
            </Link>
            {' to save searches and get alerts.'}
          </p>
        )}
      </section>

      {/* MLS / IDX disclaimer */}
      <section className="mb-8 text-xs text-muted-foreground">
        <p>
          Listing data is provided in part by Oregon Datashare (KCAR | MLSCO | SOMLS). All information provided is
          deemed reliable but is not guaranteed and should be independently verified. Listing content is for consumers’
          personal, non-commercial use.
        </p>
      </section>

      {/* Explore: by bedroom */}
      <section className="mb-8">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Search by bedroom size
        </h3>
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {BED_LINKS.map((n) => (
            <li key={n}>
              <Link
                href={`${basePath}?beds=${n}`}
                className="text-primary hover:underline"
              >
                {n} Bedroom Homes for Sale
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* Explore: by price */}
      <section className="mb-8">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Homes by price
        </h3>
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {PRICE_LINKS.map(({ label, maxPrice }) => (
            <li key={maxPrice}>
              <Link
                href={`${basePath}?maxPrice=${maxPrice}`}
                className="text-primary hover:underline"
              >
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* Nearby cities */}
      {cities.length > 0 && (
        <section className="mb-8">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Nearby city homes
          </h3>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {cities.slice(0, 18).map((c) => (
              <li key={c.slug}>
                <Link
                  href={homesForSalePath(c.name)}
                  className="text-sm font-medium text-primary hover:underline"
                >
                  {c.name} Homes for Sale
                </Link>
                <span className="ml-2 text-xs text-muted-foreground">
                  {c.activeCount.toLocaleString()} {c.medianPrice != null ? ` · ${formatPrice(c.medianPrice)}` : ''}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Popular searches */}
      <section>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Popular searches
        </h3>
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <li>
            <Link href={`${basePath}?sort=newest`} className="text-primary hover:underline">
              Newest listings
            </Link>
          </li>
          <li>
            <Link href={`${basePath}?hasOpenHouse=1`} className="text-primary hover:underline">
              Open house
            </Link>
          </li>
          <li>
            <Link href={`${basePath}?newListingsDays=7`} className="text-primary hover:underline">
              Listed in last 7 days
            </Link>
          </li>
          <li>
            <Link href={`${basePath}?newListingsDays=30`} className="text-primary hover:underline">
              Listed in last 30 days
            </Link>
          </li>
          <li>
            <Link href={`${basePath}?hasPool=1`} className="text-primary hover:underline">
              Homes with pool
            </Link>
          </li>
          <li>
            <Link href={`${basePath}?hasView=1`} className="text-primary hover:underline">
              Homes with view
            </Link>
          </li>
        </ul>
      </section>
    </footer>
  )
}
