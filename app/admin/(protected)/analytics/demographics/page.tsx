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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { getGA4Demographics } from '@/app/actions/ga4-demographics'
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

  return (
    <div className="space-y-6">

      {/* Headline KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total users</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{formatInt(data.totalUsers)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Bend metro users</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{formatInt(bendMetroUsers)}</p>
            <p className="text-xs text-muted-foreground tabular-nums">{formatPct(bendMetroUsers, data.totalUsers)} of all</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Seller LP visitors</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{formatInt(sellerLpUsersTotal)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Age 55+ share</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {(() => {
                const fiftyFivePlus = ageBuckets.filter((b) => b.ageBracket === '55-64' || b.ageBracket === '65+').reduce((acc, r) => acc + r.users, 0)
                return formatPct(fiftyFivePlus, ageTotal)
              })()}
            </p>
            <p className="text-xs text-muted-foreground">of all identified users</p>
          </CardContent>
        </Card>
      </div>

      {/* 1. Age bracket distribution */}
      <Card>
        <CardHeader><CardTitle>Age brackets (all visitors)</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Age</TableHead>
                <TableHead className="text-right tabular-nums">Users</TableHead>
                <TableHead className="text-right tabular-nums">Sessions</TableHead>
                <TableHead className="text-right tabular-nums">Share</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ageBuckets.map((b) => (
                <TableRow key={b.ageBracket}>
                  <TableCell><Badge variant={ageBracketBadgeVariant(b.ageBracket)}>{b.ageBracket}</Badge></TableCell>
                  <TableCell className="text-right tabular-nums">{formatInt(b.users)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatInt(b.sessions)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatPct(b.users, ageTotal)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="mt-3 text-xs text-muted-foreground">
            Google Signals samples demographic data from signed-in Google users. Coverage is typically 30-60% of total traffic. Unknowns are excluded from percentage math, so percentages sum to 100% across known buckets only.
          </p>
        </CardContent>
      </Card>

      {/* 2. Seller LP age + geo — the HNW targeting report */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Seller LP visitors by age</CardTitle>
            <p className="text-xs text-muted-foreground">/lp/seller-home-value visitors only. Tells you whether your HNW elderly Bend targeting is reaching the right age bracket.</p>
          </CardHeader>
          <CardContent>
            {sellerLpByAge.length === 0 ? (
              <p className="text-sm text-muted-foreground">No /lp/seller-home-value visitors with demographic data in this window. May need more traffic before Google Signals samples enough.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Age</TableHead>
                    <TableHead className="text-right tabular-nums">Users</TableHead>
                    <TableHead className="text-right tabular-nums">Visits</TableHead>
                    <TableHead className="text-right tabular-nums">Share</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sellerLpByAge.map((b) => (
                    <TableRow key={b.ageBracket}>
                      <TableCell><Badge variant={ageBracketBadgeVariant(b.ageBracket)}>{b.ageBracket}</Badge></TableCell>
                      <TableCell className="text-right tabular-nums">{formatInt(b.users)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatInt(b.eventCount)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatPct(b.users, sellerLpUsersTotal)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Seller LP visitors by city</CardTitle>
            <p className="text-xs text-muted-foreground">Where are they physically. If FB ads are targeted to Bend metro and most seller-LP traffic is elsewhere, the targeting is wrong.</p>
          </CardHeader>
          <CardContent>
            {data.sellerLpByCity.length === 0 ? (
              <p className="text-sm text-muted-foreground">No /lp/seller-home-value visitors with geo data in this window.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>City</TableHead>
                    <TableHead>Region</TableHead>
                    <TableHead className="text-right tabular-nums">Users</TableHead>
                    <TableHead className="text-right tabular-nums">Visits</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.sellerLpByCity.map((c, i) => (
                    <TableRow key={`${c.city}-${i}`} className={BEND_METRO.has(c.city) ? 'bg-primary/5' : undefined}>
                      <TableCell>{c.city}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{c.region}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatInt(c.users)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatInt(c.eventCount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 3. Gender split */}
      <Card>
        <CardHeader><CardTitle>Gender split (all visitors)</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Gender</TableHead>
                <TableHead className="text-right tabular-nums">Users</TableHead>
                <TableHead className="text-right tabular-nums">Sessions</TableHead>
                <TableHead className="text-right tabular-nums">Share</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.genders.map((g) => (
                <TableRow key={g.gender}>
                  <TableCell>{g.gender}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatInt(g.users)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatInt(g.sessions)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatPct(g.users, genderTotal)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 4. Geography (top 25 cities) */}
      <Card>
        <CardHeader><CardTitle>Top 25 cities</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>City</TableHead>
                <TableHead>Region</TableHead>
                <TableHead>Country</TableHead>
                <TableHead className="text-right tabular-nums">Users</TableHead>
                <TableHead className="text-right tabular-nums">Sessions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.topCities.map((c, i) => (
                <TableRow key={`${c.city}-${i}`} className={BEND_METRO.has(c.city) ? 'bg-primary/5' : undefined}>
                  <TableCell>{c.city}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{c.region}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{c.country}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatInt(c.users)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatInt(c.sessions)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="mt-3 text-xs text-muted-foreground">Rows highlighted blue are Bend metro cities (Bend, Redmond, Sisters, Sunriver, Tumalo, La Pine, Madras, Prineville).</p>
        </CardContent>
      </Card>

      {/* 5. Age x Source — which channel drives which age */}
      <Card>
        <CardHeader>
          <CardTitle>Age × source / medium</CardTitle>
          <p className="text-xs text-muted-foreground">Top combinations by sessions. Use this to see if FB ads are actually pulling the elderly Bend audience or if they are pulling 18-34.</p>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Age</TableHead>
                <TableHead>Source / Medium</TableHead>
                <TableHead className="text-right tabular-nums">Users</TableHead>
                <TableHead className="text-right tabular-nums">Sessions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ageBySource.slice(0, 30).map((r, i) => (
                <TableRow key={`${r.ageBracket}-${r.sourceMedium}-${i}`}>
                  <TableCell><Badge variant={ageBracketBadgeVariant(r.ageBracket)}>{r.ageBracket}</Badge></TableCell>
                  <TableCell className="text-xs">{r.sourceMedium}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatInt(r.users)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatInt(r.sessions)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
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
