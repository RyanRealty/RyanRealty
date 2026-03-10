import type { ListingRow } from '@/app/actions/communities'
import Card from '@/components/ui/Card'

type ResortContent = Record<string, unknown>

type Props = {
  description: string | null
  isResort: boolean
  resortContent: ResortContent | null
  communityName: string
  city: string
  listings: ListingRow[]
}

function formatPrice(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

export default function CommunityOverview({
  description,
  isResort,
  resortContent,
  communityName,
  city,
  listings,
}: Props) {
  const prices = listings
    .map((l) => l.ListPrice)
    .filter((p): p is number => p != null && Number.isFinite(p) && p > 0)
  const minPrice = prices.length > 0 ? Math.min(...prices) : null
  const maxPrice = prices.length > 0 ? Math.max(...prices) : null
  const propertyTypes = Array.from(
    new Set(listings.map((l) => (l as { PropertyType?: string }).PropertyType).filter(Boolean))
  ) as string[]
  const lotSizes = listings
    .map((l) => (l as { LotSizeAcres?: number; LotSizeSqFt?: number }).LotSizeAcres ?? (l as { LotSizeSqFt?: number }).LotSizeSqFt)
    .filter((n): n is number => n != null && Number.isFinite(n) && n > 0)
  const avgLot = lotSizes.length > 0 ? lotSizes.reduce((a, b) => a + b, 0) / lotSizes.length : null
  const years = listings
    .map((l) => (l as { YearBuilt?: number }).YearBuilt)
    .filter((n): n is number => n != null && Number.isFinite(n) && n > 0)
  const yearRange = years.length > 0 ? { min: Math.min(...years), max: Math.max(...years) } : null
  const hasHoa = listings.some((l) => (l as { AssociationYN?: boolean }).AssociationYN === true)
  const waterfront = listings.some((l) => (l as { WaterfrontYN?: boolean }).WaterfrontYN === true)

  return (
    <section className="bg-white px-4 py-12 sm:px-6 sm:py-16" aria-labelledby="community-overview-heading">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-8 lg:grid-cols-[1fr_400px]">
          <div className="min-w-0">
            <h2 id="community-overview-heading" className="text-2xl font-bold tracking-tight text-[var(--brand-navy)]">
              About {communityName}
            </h2>
            {description ? (
              <div className="mt-4 prose prose-[var(--brand-navy)] max-w-none">
                {description.split(/\n\n+/).map((p, i) => (
                  <p key={i} className="mt-3 text-[var(--text-secondary)]">
                    {p.trim()}
                  </p>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-[var(--text-secondary)]">
                {communityName} is a community in {city}, Oregon. Browse active listings below for the latest homes for sale.
              </p>
            )}
            {isResort && resortContent && typeof resortContent === 'object' && Object.keys(resortContent).length > 0 && (
              <div className="mt-8 space-y-6">
                {Object.entries(resortContent).map(([key, value]) => (
                  <div key={key}>
                    <h3 className="text-lg font-semibold text-[var(--brand-navy)]">
                      {key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                    </h3>
                    <div className="mt-2 text-[var(--text-secondary)]">
                      {typeof value === 'string' ? value : JSON.stringify(value)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div>
            <Card className="p-6">
              <h3 className="font-bold text-[var(--brand-navy)]">Quick facts</h3>
              <dl className="mt-4 space-y-3 text-sm">
                {propertyTypes.length > 0 && (
                  <>
                    <dt className="text-[var(--text-muted)]">Property types</dt>
                    <dd className="text-[var(--text-primary)]">{propertyTypes.slice(0, 5).join(', ')}</dd>
                  </>
                )}
                {(minPrice != null || maxPrice != null) && (
                  <>
                    <dt className="text-[var(--text-muted)]">Price range</dt>
                    <dd className="text-[var(--text-primary)]">
                      {minPrice != null && maxPrice != null
                        ? `${formatPrice(minPrice)} – ${formatPrice(maxPrice)}`
                        : minPrice != null
                          ? formatPrice(minPrice) + '+'
                          : formatPrice(maxPrice!)}
                    </dd>
                  </>
                )}
                {avgLot != null && (
                  <>
                    <dt className="text-[var(--text-muted)]">Avg lot size</dt>
                    <dd className="text-[var(--text-primary)]">
                      {avgLot >= 1 ? `${avgLot.toFixed(1)} ac` : `${(avgLot * 43560).toFixed(0)} sq ft`}
                    </dd>
                  </>
                )}
                {yearRange && (
                  <>
                    <dt className="text-[var(--text-muted)]">Year built</dt>
                    <dd className="text-[var(--text-primary)]">
                      {yearRange.min === yearRange.max ? yearRange.min : `${yearRange.min} – ${yearRange.max}`}
                    </dd>
                  </>
                )}
                <dt className="text-[var(--text-muted)]">HOA</dt>
                <dd className="text-[var(--text-primary)]">{hasHoa ? 'Yes' : 'No'}</dd>
                <dt className="text-[var(--text-muted)]">Waterfront</dt>
                <dd className="text-[var(--text-primary)]">{waterfront ? 'Yes' : 'No'}</dd>
                {isResort && (
                  <>
                    <dt className="text-[var(--text-muted)]">Golf</dt>
                    <dd className="text-[var(--text-primary)]">Resort community</dd>
                  </>
                )}
              </dl>
            </Card>
          </div>
        </div>
      </div>
    </section>
  )
}
