// @no-parity — analytics explorer; no mockup kit directory
/**
 * /housing-market/history — constrained unique closed-sales search (CO).
 * Data: analyzeClosedSales (result_cache → mart → SQL aggregate RPC). No listings paging.
 *
 * Visual thesis (E6): research terminal. Brutalist query plate + hard KPI results,
 * not a soft dashboard of equal cards.
 */
import type { Metadata } from 'next'
import Link from 'next/link'
import { pageMetadata } from '@/lib/site/page-metadata'
import { analyzeClosedSales } from '@/lib/data/analytics/analyzeClosedSales'
import {
  getCoFeatureAnnual,
  CO_FEATURE_LABELS,
  type CoFeatureKey,
} from '@/lib/data/analytics/getCoFeatureAnnual'
import { ANALYTICS_CO_CITIES_PROPER, ANALYTICS_METHODOLOGY_V1 } from '@/lib/data/analytics/co-cities'
import { labelPropertyType } from '@/lib/data/analytics/property-type-labels'
import { SmoothScrollProvider } from '@/components/site/kb/SmoothScrollProvider.client'
import { KbBreadcrumb } from '@/components/site/kb/KbBreadcrumb'
import { KbFooter } from '@/components/site/kb/KbFooter.client'
import { KbSectionTracker } from '@/components/site/kb/KbSectionTracker.client'
import { H2 } from '@/components/site/primitives'
import '@/components/site/kb/kb.css'

export const revalidate = 3600

export const metadata: Metadata = pageMetadata({
  title: 'Central Oregon Closed Sales Explorer',
  description:
    'Query closed Central Oregon MLS sales by year, city, property type, and fireplace. Aggregate statistics only.',
  path: '/housing-market/history',
})

type Sp = Promise<Record<string, string | string[] | undefined>>

function one(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v
}

function money(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`
  return `$${Math.round(n).toLocaleString('en-US')}`
}

const fieldClass =
  'mt-1.5 w-full border border-current/30 bg-transparent px-3 py-2.5 text-sm outline-none transition focus:border-current focus:ring-2 focus:ring-current/15'

export default async function HousingMarketHistoryPage({ searchParams }: { searchParams: Sp }) {
  const sp = await searchParams
  const year = Math.min(2030, Math.max(1998, Number(one(sp.year)) || 2024))
  const city = one(sp.city)?.trim() || undefined
  const propertyType = one(sp.type)?.trim() as 'A' | 'B' | 'C' | 'D' | undefined
  const fireplace = one(sp.fireplace) === '1' || one(sp.fireplace) === 'true'
  const minPrice = one(sp.min) ? Number(one(sp.min)) : undefined
  const maxPrice = one(sp.max) ? Number(one(sp.max)) : undefined

  const [result, featureCube] = await Promise.all([
    analyzeClosedSales({
      year,
      city: city || undefined,
      propertyType: propertyType && 'ABCD'.includes(propertyType) ? propertyType : undefined,
      fireplace: fireplace || undefined,
      minPrice: Number.isFinite(minPrice) ? minPrice : undefined,
      maxPrice: Number.isFinite(maxPrice) ? maxPrice : undefined,
    }),
    // H6: precomputed amenity strip for the selected year (region, all types)
    getCoFeatureAnnual({ year }).catch(() => null),
  ])

  const years = [2016, 2018, 2020, 2022, 2023, 2024, 2025]
  const types = ['A', 'B', 'C', 'D'] as const

  const filterBits = [
    String(year),
    city || 'All cities',
    propertyType ? labelPropertyType(propertyType) : 'All types',
    fireplace ? 'Fireplace only' : null,
    minPrice != null && Number.isFinite(minPrice) ? `min $${Math.round(minPrice).toLocaleString('en-US')}` : null,
    maxPrice != null && Number.isFinite(maxPrice) ? `max $${Math.round(maxPrice).toLocaleString('en-US')}` : null,
  ].filter(Boolean)

  return (
    <main className="kb-root">
      <KbSectionTracker pageType="market-report" />
      <KbBreadcrumb
        trail={[
          { label: 'Home', href: '/' },
          { label: 'Housing market', href: '/housing-market' },
          { label: 'Closed sales explorer' },
        ]}
      />
      <SmoothScrollProvider>
        {/* Hero intro — asymmetric editorial head */}
        <section className="border-b border-current/15">
          <div className="mx-auto grid max-w-7xl gap-8 px-6 py-12 md:grid-cols-12 md:gap-10 md:py-16">
            <div className="md:col-span-7">
              <p className="text-xs font-medium uppercase tracking-widest opacity-70">
                Unique search · aggregates only
              </p>
              <h1 className="mt-2 font-display text-4xl leading-none tracking-tight md:text-5xl lg:text-6xl">
                Closed sales explorer
              </h1>
              <p className="mt-5 max-w-xl text-base leading-relaxed opacity-90">
                Slice Central Oregon closed MLS sales by year, city, type, price band, and fireplace.
                Results are counts and dollar totals. Never individual sold addresses.
              </p>
            </div>
            <div className="flex flex-col justify-end md:col-span-5">
              <div className="border border-current/20 bg-background/20 p-5">
                <p className="text-xs font-semibold uppercase tracking-widest opacity-70">
                  Active query
                </p>
                <p className="mt-2 text-sm leading-relaxed opacity-90">{filterBits.join(' · ')}</p>
                <p className="mt-3 text-xs opacity-60">
                  Aggregates only. No sold addresses on this page.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-6 py-10 md:py-14">
          {/* Query plate */}
          <form
            method="get"
            className="border-2 border-current p-5 sm:p-6 md:p-8"
            aria-label="Closed sales query"
          >
            <div className="flex flex-wrap items-end justify-between gap-3 border-b border-current/15 pb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest opacity-70">Query</p>
                <p className="mt-1 text-sm opacity-80">Set filters, then run. Defaults to {year}.</p>
              </div>
              <button
                type="submit"
                className="min-h-11 border-2 border-current bg-current px-6 py-2.5 text-sm font-semibold uppercase tracking-widest text-background transition hover:opacity-90"
              >
                Run query
              </button>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <label className="block text-sm">
                <span className="font-medium opacity-70">Year</span>
                <input
                  name="year"
                  list="year-options"
                  defaultValue={String(year)}
                  className={fieldClass}
                />
                <datalist id="year-options">
                  {years.map((y) => (
                    <option key={y} value={y} />
                  ))}
                </datalist>
              </label>
              <label className="block text-sm">
                <span className="font-medium opacity-70">City</span>
                <input
                  name="city"
                  list="city-options"
                  defaultValue={city ?? ''}
                  placeholder="All service-area cities"
                  className={fieldClass}
                />
                <datalist id="city-options">
                  {ANALYTICS_CO_CITIES_PROPER.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </label>
              <label className="block text-sm">
                <span className="font-medium opacity-70">Property type (A, B, C, or D)</span>
                <input
                  name="type"
                  list="type-options"
                  defaultValue={propertyType ?? ''}
                  placeholder="All types"
                  className={fieldClass}
                />
                <datalist id="type-options">
                  {types.map((t) => (
                    <option key={t} value={t} label={labelPropertyType(t)} />
                  ))}
                </datalist>
              </label>
              <label className="block text-sm">
                <span className="font-medium opacity-70">Min close price</span>
                <input
                  name="min"
                  type="number"
                  defaultValue={minPrice ?? ''}
                  placeholder="e.g. 400000"
                  className={fieldClass}
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium opacity-70">Max close price</span>
                <input
                  name="max"
                  type="number"
                  defaultValue={maxPrice ?? ''}
                  placeholder="e.g. 900000"
                  className={fieldClass}
                />
              </label>
              <label className="flex min-h-11 cursor-pointer items-end gap-2.5 pb-2.5 text-sm">
                <input
                  type="checkbox"
                  name="fireplace"
                  value="1"
                  defaultChecked={fireplace}
                  className="h-4 w-4 shrink-0"
                />
                <span className="font-medium">Fireplace only</span>
              </label>
            </div>
          </form>

          {/* Results — hard KPI plate (gap hairlines) */}
          <div className="mt-10">
            <p className="text-xs font-semibold uppercase tracking-widest opacity-70">Results</p>
            <div className="mt-3 grid gap-px border border-current/30 bg-current/30 sm:grid-cols-3">
              <div className="bg-background p-5 sm:p-6">
                <div className="text-xs uppercase tracking-widest opacity-70">Closes</div>
                <div className="mt-2 font-display text-4xl font-semibold tabular-nums leading-none md:text-5xl">
                  {result.soldCount.toLocaleString('en-US')}
                </div>
              </div>
              <div className="bg-background p-5 sm:p-6">
                <div className="text-xs uppercase tracking-widest opacity-70">Volume</div>
                <div className="mt-2 font-display text-4xl font-semibold tabular-nums leading-none md:text-5xl">
                  {money(result.totalVolume)}
                </div>
              </div>
              <div className="bg-background p-5 sm:p-6">
                <div className="text-xs uppercase tracking-widest opacity-70">Median close</div>
                <div className="mt-2 font-display text-4xl font-semibold tabular-nums leading-none md:text-5xl">
                  {result.medianClose != null
                    ? `$${Math.round(result.medianClose).toLocaleString('en-US')}`
                    : '—'}
                </div>
              </div>
            </div>
          </div>

          {featureCube && featureCube.rows.length > 0 ? (
            <div className="mt-14">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <H2 className="font-display text-2xl md:text-3xl">
                    Amenity share for CO {year}
                  </H2>
                  <p className="mt-2 max-w-2xl text-sm opacity-80">
                    Precomputed feature cubes (typed columns only). Region, all property types.
                    Not filtered by the form above.
                  </p>
                </div>
              </div>
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                {featureCube.rows.map((row) => (
                  <div key={row.featureKey} className="border border-current/20 p-5">
                    <div className="text-xs uppercase tracking-widest opacity-70">
                      {CO_FEATURE_LABELS[row.featureKey as CoFeatureKey] ?? row.featureKey}
                    </div>
                    <div className="mt-2 font-display text-3xl font-semibold tabular-nums leading-none">
                      {row.soldCount.toLocaleString('en-US')}
                    </div>
                    <div className="mt-2 text-sm opacity-80 tabular-nums">
                      {money(row.totalVolume)}
                      {row.medianClose != null
                        ? ` · med $${Math.round(row.medianClose).toLocaleString('en-US')}`
                        : ''}
                    </div>
                    {row.unitSharePct != null ? (
                      <div className="mt-2 text-xs opacity-70 tabular-nums">
                        {row.unitSharePct.toFixed(1)}% of CO closes
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs opacity-60">
                Source {featureCube.source}. Fireplace uses fireplace_yn or fireplaces_total greater
                than zero. Garage uses garage_yn. Association uses association_yn (HOA).
              </p>
            </div>
          ) : null}

          <p className="mt-10 border-t border-current/15 pt-6 text-xs leading-relaxed opacity-70">
            {ANALYTICS_METHODOLOGY_V1}. Aggregates only. As of{' '}
            {new Date(result.computedAt).toISOString().slice(0, 10)}.{' '}
            <Link href="/housing-market" className="underline underline-offset-2 hover:opacity-100">
              Housing market hub
            </Link>
            {' · '}
            <Link
              href="/housing-market/central-oregon"
              className="underline underline-offset-2 hover:opacity-100"
            >
              Region report
            </Link>
          </p>
        </section>
        <KbFooter towns={[]} />
      </SmoothScrollProvider>
    </main>
  )
}
