import Card from '@/components/ui/Card'

type QuickFacts = {
  population?: string | null
  elevation?: string | null
  county?: string | null
  schoolDistrict?: string | null
  priceRangeMin?: number | null
  priceRangeMax?: number | null
  avgLotSize?: string | null
  nearestAirport?: string | null
}

type Props = {
  cityName: string
  description: string | null
  quickFacts: QuickFacts
}

function formatPrice(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

export default function CityOverview({ cityName, description, quickFacts }: Props) {
  const isBend = cityName.toLowerCase() === 'bend'

  return (
    <section className="bg-white px-4 py-12 sm:px-6 sm:py-16" aria-labelledby="city-overview-heading">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-8 lg:grid-cols-[1fr_400px]">
          <div className="min-w-0">
            <h2 id="city-overview-heading" className="text-2xl font-bold tracking-tight text-[var(--brand-navy)]">
              About {cityName}
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
                {cityName} is one of Central Oregon&apos;s premier destinations. Browse active listings below to find your next home.
              </p>
            )}
            {isBend && (
              <div className="mt-6 text-[var(--text-secondary)]">
                <p>
                  Bend offers world-class outdoor recreation, craft breweries, skiing at Mt. Bachelor, and easy access to lakes and rivers. It&apos;s one of the most sought-after markets in the West.
                </p>
              </div>
            )}
          </div>
          <div>
            <Card className="p-6">
              <h3 className="font-bold text-[var(--brand-navy)]">Quick facts</h3>
              <dl className="mt-4 space-y-3 text-sm">
                {quickFacts.population && (
                  <>
                    <dt className="text-[var(--text-muted)]">Population</dt>
                    <dd className="text-[var(--text-primary)]">{quickFacts.population}</dd>
                  </>
                )}
                {quickFacts.elevation && (
                  <>
                    <dt className="text-[var(--text-muted)]">Elevation</dt>
                    <dd className="text-[var(--text-primary)]">{quickFacts.elevation}</dd>
                  </>
                )}
                {quickFacts.county && (
                  <>
                    <dt className="text-[var(--text-muted)]">County</dt>
                    <dd className="text-[var(--text-primary)]">{quickFacts.county}</dd>
                  </>
                )}
                {quickFacts.schoolDistrict && (
                  <>
                    <dt className="text-[var(--text-muted)]">School district</dt>
                    <dd className="text-[var(--text-primary)]">{quickFacts.schoolDistrict}</dd>
                  </>
                )}
                {(quickFacts.priceRangeMin != null || quickFacts.priceRangeMax != null) && (
                  <>
                    <dt className="text-[var(--text-muted)]">Price range</dt>
                    <dd className="text-[var(--text-primary)]">
                      {quickFacts.priceRangeMin != null && quickFacts.priceRangeMax != null
                        ? `${formatPrice(quickFacts.priceRangeMin)} – ${formatPrice(quickFacts.priceRangeMax)}`
                        : quickFacts.priceRangeMin != null
                          ? formatPrice(quickFacts.priceRangeMin) + '+'
                          : quickFacts.priceRangeMax != null
                            ? formatPrice(quickFacts.priceRangeMax)
                            : '—'}
                    </dd>
                  </>
                )}
                {quickFacts.avgLotSize && (
                  <>
                    <dt className="text-[var(--text-muted)]">Avg lot size</dt>
                    <dd className="text-[var(--text-primary)]">{quickFacts.avgLotSize}</dd>
                  </>
                )}
                {quickFacts.nearestAirport && (
                  <>
                    <dt className="text-[var(--text-muted)]">Nearest airport</dt>
                    <dd className="text-[var(--text-primary)]">{quickFacts.nearestAirport}</dd>
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
