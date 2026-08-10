// @no-parity — analytics explorer; no mockup kit directory
/**
 * /housing-market/history — constrained unique closed-sales search (CO).
 */
import type { Metadata } from 'next'
import Link from 'next/link'
import { pageMetadata } from '@/lib/site/page-metadata'
import { analyzeClosedSales } from '@/lib/data/analytics/analyzeClosedSales'
import { ANALYTICS_CO_CITIES_PROPER, ANALYTICS_METHODOLOGY_V1 } from '@/lib/data/analytics/co-cities'
import { labelPropertyType } from '@/lib/data/analytics/property-type-labels'
import { SmoothScrollProvider } from '@/components/site/kb/SmoothScrollProvider.client'
import { KbBreadcrumb } from '@/components/site/kb/KbBreadcrumb'
import { KbFooter } from '@/components/site/kb/KbFooter.client'
import { KbSectionTracker } from '@/components/site/kb/KbSectionTracker.client'
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

export default async function HousingMarketHistoryPage({ searchParams }: { searchParams: Sp }) {
  const sp = await searchParams
  const year = Math.min(2030, Math.max(1998, Number(one(sp.year)) || 2024))
  const city = one(sp.city)?.trim() || undefined
  const propertyType = one(sp.type)?.trim() as 'A' | 'B' | 'C' | 'D' | undefined
  const fireplace = one(sp.fireplace) === '1' || one(sp.fireplace) === 'true'
  const minPrice = one(sp.min) ? Number(one(sp.min)) : undefined
  const maxPrice = one(sp.max) ? Number(one(sp.max)) : undefined

  const result = await analyzeClosedSales({
    year,
    city: city || undefined,
    propertyType: propertyType && 'ABCD'.includes(propertyType) ? propertyType : undefined,
    fireplace: fireplace || undefined,
    minPrice: Number.isFinite(minPrice) ? minPrice : undefined,
    maxPrice: Number.isFinite(maxPrice) ? maxPrice : undefined,
  })

  const years = [2016, 2018, 2020, 2022, 2023, 2024, 2025]
  const types = ['A', 'B', 'C', 'D'] as const

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
        <section className="mx-auto max-w-7xl px-6 py-12 md:py-16">
          <p className="text-xs font-medium uppercase tracking-widest opacity-70">
            Unique search · aggregates only
          </p>
          <h1 className="mt-2 font-display text-4xl md:text-5xl">Closed sales explorer</h1>
          <p className="mt-4 max-w-2xl text-base opacity-90">
            Slice Central Oregon closed MLS sales by year, city, type, price band, and fireplace.
            Results are counts and dollar totals. Never individual sold addresses.
          </p>

          <form method="get" className="mt-10 grid gap-4 border border-current/20 p-6 sm:grid-cols-2 lg:grid-cols-3">
            <div className="block text-sm">
              <span className="opacity-70">Year</span>
              <input name="year" list="year-options" defaultValue={String(year)} className="mt-1 w-full border border-current/30 bg-transparent px-3 py-2" />
              <datalist id="year-options">
                {years.map((y) => (
                  <option key={y} value={y} />
                ))}
              </datalist>
            </div>
            <div className="block text-sm">
              <span className="opacity-70">City</span>
              <input name="city" list="city-options" defaultValue={city ?? ''} placeholder="All service-area cities" className="mt-1 w-full border border-current/30 bg-transparent px-3 py-2" />
              <datalist id="city-options">
                {ANALYTICS_CO_CITIES_PROPER.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
            <div className="block text-sm">
              <span className="opacity-70">Property type (A, B, C, or D)</span>
              <input name="type" list="type-options" defaultValue={propertyType ?? ''} placeholder="All types" className="mt-1 w-full border border-current/30 bg-transparent px-3 py-2" />
              <datalist id="type-options">
                {types.map((t) => (
                  <option key={t} value={t} label={labelPropertyType(t)} />
                ))}
              </datalist>
            </div>
            <div className="block text-sm">
              <span className="opacity-70">Min close price</span>
              <input name="min" type="number" defaultValue={minPrice ?? ''} placeholder="e.g. 400000" className="mt-1 w-full border border-current/30 bg-transparent px-3 py-2" />
            </div>
            <div className="block text-sm">
              <span className="opacity-70">Max close price</span>
              <input name="max" type="number" defaultValue={maxPrice ?? ''} placeholder="e.g. 900000" className="mt-1 w-full border border-current/30 bg-transparent px-3 py-2" />
            </div>
            <div className="flex items-end gap-2 text-sm pb-2">
              <input type="checkbox" name="fireplace" value="1" defaultChecked={fireplace} className="h-4 w-4" />
              <span>Fireplace only</span>
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <button type="submit" className="border-2 border-current px-6 py-2 text-sm font-medium">
                Run query
              </button>
            </div>
          </form>

          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            <div className="border border-current/20 p-5">
              <div className="text-xs uppercase opacity-70">Closes</div>
              <div className="mt-1 text-3xl font-semibold tabular-nums">
                {result.soldCount.toLocaleString('en-US')}
              </div>
            </div>
            <div className="border border-current/20 p-5">
              <div className="text-xs uppercase opacity-70">Volume</div>
              <div className="mt-1 text-3xl font-semibold tabular-nums">
                {money(result.totalVolume)}
              </div>
            </div>
            <div className="border border-current/20 p-5">
              <div className="text-xs uppercase opacity-70">Median close</div>
              <div className="mt-1 text-3xl font-semibold tabular-nums">
                {result.medianClose != null
                  ? `$${Math.round(result.medianClose).toLocaleString('en-US')}`
                  : '—'}
              </div>
            </div>
          </div>

          <p className="mt-8 text-xs opacity-70">
            {ANALYTICS_METHODOLOGY_V1}. Aggregates only. As of{' '}
            {new Date(result.computedAt).toISOString().slice(0, 10)}.{' '}
            <Link href="/housing-market" className="underline">
              Housing market hub
            </Link>
          </p>
        </section>
        <KbFooter />
      </SmoothScrollProvider>
    </main>
  )
}
