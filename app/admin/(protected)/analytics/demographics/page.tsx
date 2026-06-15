/**
 * /admin/analytics/demographics — who is visiting, how old, where from.
 *
 * Pulls demographics from GA4 Data API (Google Signals must be enabled,
 * which it is per the 2026-05-21 admin config). Returns:
 *   - Age bracket distribution (overall + cross-tabs by page & source)
 *   - Gender split
 *   - Top cities (US-wide + Bend metro drill-down)
 *   - Seller-LP visitor age + geo split (HNW elderly Bend targeting)
 *
 * Built specifically to answer: "which channel + age + geography
 * combination converts on the seller funnel, and where do we lose them?"
 */
import { Suspense } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import DashboardSummaryStrip from '@/components/admin/DashboardSummaryStrip'
import { TableWithMobileCards } from '@/components/admin/TableWithMobileCards'
import { getGA4DemographicsCached as getGA4Demographics } from '@/lib/ga4-cache'
import { resolveDateRange } from '../_lib/queries'
import { DateRangePicker } from '../_components/DateRangePicker'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type SearchParams = Record<string, string | string[] | undefined>

function normalizeParams(sp: SearchParams): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {}
  for (const [k, v] of Object.entries(sp)) {
    out[k] = Array.isArray(v) ? v[0] : v
  }
  return out
}

function formatInt(n: number): string {
  return new Intl.NumberFormat('en-US').format(n)
}

function formatPct(n: number, total: number): string {
  if (total === 0) return '0%'
  return `${((n / total) * 100).toFixed(1)}%`
}

// Order age buckets canonically. GA4 returns them in arbitrary order.
const AGE_ORDER = ['18-24', '25-34', '35-44', '45-54', '55-64', '65+', 'unknown']
function sortAgeBuckets<T extends { ageBracket: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const ai = AGE_ORDER.indexOf(a.ageBracket)
    const bi = AGE_ORDER.indexOf(b.ageBracket)
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
  })
}

// Color the 55+ buckets so Matt can spot HNW-elderly traffic at a glance.
function ageBracketBadgeVariant(b: string): 'default' | 'secondary' | 'outline' {
  if (b === '55-64' || b === '65+') return 'default'
  if (b === '45-54') return 'secondary'
  return 'outline'
}

async function DemographicsContent({ startDate, endDate }: { startDate: string; endDate: string }) {
  const data = await getGA4Demographics(startDate, endDate)
  if (!data.ok) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-sm text-muted-foreground">
          <p>Demographics report unavailable: {data.error}.</p>
          <p className="mt-2">If GA4_NOT_CONFIGURED: set GOOGLE_GA4_PROPERTY_ID + service-account env vars. If a runtime error: Google Signals may not have synced demographic data for this range yet (24-48h delay after first install).</p>
        </CardContent>
      </Card>
    )
  }

  const ageBuckets = sortAgeBuckets(data.ageBuckets)
  const ageBySource = data.ageBySource
  const sellerLpByAge = sortAgeBuckets(data.sellerLpByAge)
  const sellerLpUsersTotal = sellerLpByAge.reduce((acc, r) => acc + r.users, 0)
  const ageTotal = ageBuckets.reduce((acc, r) => acc + r.users, 0)
  const genderTotal = data.genders.reduce((acc, r) => acc + r.users, 0)

  // Bend metro split: Bend + Redmond + Sisters + Sunriver + Tumalo + La Pine + Madras + Prineville
  const BEND_METRO = new Set(['Bend', 'Redmond', 'Sisters', 'Sunriver', 'Tumalo', 'La Pine', 'Madras', 'Prineville'])
  const bendMetroCities = data.topCities.filter((c) => BEND_METRO.has(c.city))
  const bendMetroUsers = bendMetroCities.reduce((acc, c) => acc + c.users, 0)

  const fiftyFivePlus = ageBuckets.filter((b) => b.ageBracket === '55-64' || b.ageBracket === '65+').reduce((acc, r) => acc + r.users, 0)

  return (
    <div className="space-y-6">

      {/* Headline KPIs */}
      <DashboardSummaryStrip
        stats={[
          { label: 'Total users', value: formatInt(data.totalUsers) },
          { label: 'Bend metro users', value: formatInt(bendMetroUsers), caption: `${formatPct(bendMetroUsers, data.totalUsers)} of all` },
          { label: 'Seller LP visitors', value: formatInt(sellerLpUsersTotal) },
          { label: 'Age 55+ share', value: formatPct(fiftyFivePlus, ageTotal), caption: 'of identified users' },
        ]}
      />

      {/* 1. Age bracket distribution */}
      <section className="space-y-2">
        <h2 className="text-base font-semibold text-foreground">Age brackets (all visitors)</h2>
        <TableWithMobileCards
          rows={ageBuckets}
          cap={8}
          getRowKey={(b) => b.ageBracket}
          columns={[
            { key: 'age', header: 'Age', cell: (b) => <Badge variant={ageBracketBadgeVariant(b.ageBracket)}>{b.ageBracket}</Badge> },
            { key: 'users', header: 'Users', className: 'text-right tabular-nums', cell: (b) => formatInt(b.users) },
            { key: 'sessions', header: 'Sessions', className: 'text-right tabular-nums', cell: (b) => formatInt(b.sessions) },
            { key: 'share', header: 'Share', className: 'text-right tabular-nums', cell: (b) => formatPct(b.users, ageTotal) },
          ]}
          renderCard={(b) => (
            <Card>
              <CardContent className="flex items-center justify-between gap-2">
                <Badge variant={ageBracketBadgeVariant(b.ageBracket)}>{b.ageBracket}</Badge>
                <span className="text-xs text-muted-foreground tabular-nums">{formatInt(b.users)} users · {formatInt(b.sessions)} sess · {formatPct(b.users, ageTotal)}</span>
              </CardContent>
            </Card>
          )}
          empty={<>No age-bracket data in this window. Google Signals needs more signed-in-user traffic before it samples demographics.</>}
        />
        <p className="text-xs text-muted-foreground">
          Google Signals samples demographic data from signed-in Google users. Coverage is typically 30-60% of total traffic. Unknowns are excluded from percentage math, so percentages sum to 100% across known buckets only.
        </p>
      </section>

      {/* 2. Seller LP age + geo — the HNW targeting report */}
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="space-y-2">
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-foreground">Seller LP visitors by age</h2>
            <p className="text-xs text-muted-foreground">/lp/seller-home-value visitors only. Tells you whether your HNW elderly Bend targeting is reaching the right age bracket.</p>
          </div>
          <TableWithMobileCards
            rows={sellerLpByAge}
            cap={8}
            getRowKey={(b) => b.ageBracket}
            columns={[
              { key: 'age', header: 'Age', cell: (b) => <Badge variant={ageBracketBadgeVariant(b.ageBracket)}>{b.ageBracket}</Badge> },
              { key: 'users', header: 'Users', className: 'text-right tabular-nums', cell: (b) => formatInt(b.users) },
              { key: 'visits', header: 'Visits', className: 'text-right tabular-nums', cell: (b) => formatInt(b.eventCount) },
              { key: 'share', header: 'Share', className: 'text-right tabular-nums', cell: (b) => formatPct(b.users, sellerLpUsersTotal) },
            ]}
            renderCard={(b) => (
              <Card>
                <CardContent className="flex items-center justify-between gap-2">
                  <Badge variant={ageBracketBadgeVariant(b.ageBracket)}>{b.ageBracket}</Badge>
                  <span className="text-xs text-muted-foreground tabular-nums">{formatInt(b.users)} users · {formatInt(b.eventCount)} visits · {formatPct(b.users, sellerLpUsersTotal)}</span>
                </CardContent>
              </Card>
            )}
            empty={<>No /lp/seller-home-value visitors with demographic data in this window. May need more traffic before Google Signals samples enough.</>}
          />
        </section>

        <section className="space-y-2">
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-foreground">Seller LP visitors by city</h2>
            <p className="text-xs text-muted-foreground">Where are they physically. If FB ads are targeted to Bend metro and most seller-LP traffic is elsewhere, the targeting is wrong.</p>
          </div>
          <TableWithMobileCards
            rows={data.sellerLpByCity}
            cap={8}
            getRowKey={(c, i) => `${c.city}-${i}`}
            columns={[
              { key: 'city', header: 'City', cell: (c) => <span className={BEND_METRO.has(c.city) ? 'font-medium text-primary' : undefined}>{c.city}</span> },
              { key: 'region', header: 'Region', className: 'text-xs text-muted-foreground', cell: (c) => c.region },
              { key: 'users', header: 'Users', className: 'text-right tabular-nums', cell: (c) => formatInt(c.users) },
              { key: 'visits', header: 'Visits', className: 'text-right tabular-nums', cell: (c) => formatInt(c.eventCount) },
            ]}
            renderCard={(c) => (
              <Card>
                <CardContent className="flex items-center justify-between gap-2">
                  <span className="text-sm">
                    <span className={BEND_METRO.has(c.city) ? 'font-medium text-primary' : 'font-medium'}>{c.city}</span>
                    <span className="text-xs text-muted-foreground"> · {c.region}</span>
                  </span>
                  <span className="text-xs text-muted-foreground tabular-nums">{formatInt(c.users)} users · {formatInt(c.eventCount)} visits</span>
                </CardContent>
              </Card>
            )}
            empty={<>No /lp/seller-home-value visitors with geo data in this window.</>}
          />
        </section>
      </div>

      {/* 3. Gender split */}
      <section className="space-y-2">
        <h2 className="text-base font-semibold text-foreground">Gender split (all visitors)</h2>
        <TableWithMobileCards
          rows={data.genders}
          cap={8}
          getRowKey={(g) => g.gender}
          columns={[
            { key: 'gender', header: 'Gender', cell: (g) => g.gender },
            { key: 'users', header: 'Users', className: 'text-right tabular-nums', cell: (g) => formatInt(g.users) },
            { key: 'sessions', header: 'Sessions', className: 'text-right tabular-nums', cell: (g) => formatInt(g.sessions) },
            { key: 'share', header: 'Share', className: 'text-right tabular-nums', cell: (g) => formatPct(g.users, genderTotal) },
          ]}
          renderCard={(g) => (
            <Card>
              <CardContent className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">{g.gender}</span>
                <span className="text-xs text-muted-foreground tabular-nums">{formatInt(g.users)} users · {formatPct(g.users, genderTotal)}</span>
              </CardContent>
            </Card>
          )}
          empty={<>No gender data sampled in this window.</>}
        />
      </section>

      {/* 4. Geography (top cities) */}
      <section className="space-y-2">
        <h2 className="text-base font-semibold text-foreground">Top cities</h2>
        <TableWithMobileCards
          rows={data.topCities}
          cap={10}
          getRowKey={(c, i) => `${c.city}-${i}`}
          columns={[
            { key: 'city', header: 'City', cell: (c) => <span className={BEND_METRO.has(c.city) ? 'font-medium text-primary' : undefined}>{c.city}</span> },
            { key: 'region', header: 'Region', className: 'text-xs text-muted-foreground', cell: (c) => c.region },
            { key: 'country', header: 'Country', className: 'text-xs text-muted-foreground', cell: (c) => c.country },
            { key: 'users', header: 'Users', className: 'text-right tabular-nums', cell: (c) => formatInt(c.users) },
            { key: 'sessions', header: 'Sessions', className: 'text-right tabular-nums', cell: (c) => formatInt(c.sessions) },
          ]}
          renderCard={(c) => (
            <Card>
              <CardContent className="flex items-center justify-between gap-2">
                <span className="text-sm">
                  <span className={BEND_METRO.has(c.city) ? 'font-medium text-primary' : 'font-medium'}>{c.city}</span>
                  <span className="text-xs text-muted-foreground"> · {c.region}, {c.country}</span>
                </span>
                <span className="text-xs text-muted-foreground tabular-nums">{formatInt(c.users)} users · {formatInt(c.sessions)} sess</span>
              </CardContent>
            </Card>
          )}
          empty={<>No city-level geo data in this window.</>}
        />
        <p className="text-xs text-muted-foreground">Bend metro cities (Bend, Redmond, Sisters, Sunriver, Tumalo, La Pine, Madras, Prineville) are highlighted.</p>
      </section>

      {/* 5. Age x Source — which channel drives which age */}
      <section className="space-y-2">
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-foreground">Age × source / medium</h2>
          <p className="text-xs text-muted-foreground">Top combinations by sessions. Use this to see if FB ads are actually pulling the elderly Bend audience or if they are pulling 18-34.</p>
        </div>
        <TableWithMobileCards
          rows={ageBySource}
          cap={10}
          getRowKey={(r, i) => `${r.ageBracket}-${r.sourceMedium}-${i}`}
          columns={[
            { key: 'age', header: 'Age', cell: (r) => <Badge variant={ageBracketBadgeVariant(r.ageBracket)}>{r.ageBracket}</Badge> },
            { key: 'source', header: 'Source / Medium', className: 'text-xs', cell: (r) => r.sourceMedium },
            { key: 'users', header: 'Users', className: 'text-right tabular-nums', cell: (r) => formatInt(r.users) },
            { key: 'sessions', header: 'Sessions', className: 'text-right tabular-nums', cell: (r) => formatInt(r.sessions) },
          ]}
          renderCard={(r) => (
            <Card>
              <CardContent className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <Badge variant={ageBracketBadgeVariant(r.ageBracket)}>{r.ageBracket}</Badge>
                  <span className="text-sm font-semibold tabular-nums">{formatInt(r.sessions)} <span className="text-xs font-normal text-muted-foreground">sess</span></span>
                </div>
                <p className="text-xs text-muted-foreground">{r.sourceMedium} · {formatInt(r.users)} users</p>
              </CardContent>
            </Card>
          )}
          empty={<>No age × source combinations sampled in this window.</>}
        />
      </section>
    </div>
  )
}

export default async function DemographicsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const sp = normalizeParams(await searchParams)
  const range = resolveDateRange(sp)

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-foreground">Demographics</h1>
        <p className="text-sm text-muted-foreground">
          Who is visiting, what age, from where, on which channel. Powered by GA4 Data API with Google Signals enabled. Demographic coverage is typically 30 to 60 percent of total traffic. Range: {range.startDate} to {range.endDate}.
        </p>
        <DateRangePicker current={sp.range ?? '30d'} currentStart={sp.startDate} currentEnd={sp.endDate} />
      </header>

      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <DemographicsContent startDate={range.startDate} endDate={range.endDate} />
      </Suspense>
    </div>
  )
}
