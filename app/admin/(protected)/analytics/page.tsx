/**
 * /admin/analytics — the comprehensive marketing analytics surface.
 *
 * Five tabs: Overview, Acquisition, Behavior, Funnel, Conversions.
 * Server-side data fetching via Promise.all. shadcn/ui everywhere. Tabular
 * numerals on every numeric surface. Brand voice compliant copy.
 *
 * Data trace:
 *   - Overview / Acquisition / Behavior  → GA4 Data API (getGA4Summary)
 *   - Funnel                              → GA4 + public.marketing_assignments + public.cmas
 *   - Conversions                         → GA4 + public.marketing_assignments + public.marketing_channel_daily
 *
 * Per-figure citation lives in ./citations.json.
 */
import { Suspense } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import {
  resolveDateRange,
  fetchOverview,
  fetchAcquisition,
  fetchBehavior,
  fetchFunnel,
  fetchConversions,
} from './_lib/queries'
import { formatInt, formatPct, formatUsd, formatDuration } from './_lib/formatters'
import { DateRangePicker } from './_components/DateRangePicker'
import { FunnelVariantFilter } from './_components/FunnelVariantFilter'
import { KpiCard } from './_components/KpiCard'
import { HorizontalBarChart, TimeSeriesChart, BrokerPieChart, StackedBarMix } from './_components/charts'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type SearchParams = Record<string, string | string[] | undefined>

function normalizeParams(sp: SearchParams): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {}
  for (const [k, v] of Object.entries(sp)) {
    if (Array.isArray(v)) out[k] = v[0]
    else out[k] = v
  }
  return out
}

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = normalizeParams(await searchParams)
  const range = resolveDateRange(sp)
  const tab = sp.tab || 'overview'
  const lpVariant = sp.lpVariant || ''
  const rangeChoice = sp.range || '30d'

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-foreground">Analytics</h1>
        <p className="text-sm text-muted-foreground">
          Acquisition, behavior, funnel, and conversions. Numbers trace to GA4 Data API and Supabase. Range: {range.startDate} to {range.endDate}.
        </p>
        <DateRangePicker current={rangeChoice} currentStart={sp.startDate} currentEnd={sp.endDate} />
      </header>

      <div className="rounded-lg border border-border bg-card p-3">
        <p className="text-xs font-medium text-muted-foreground mb-2">Specialised views</p>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <Link className="text-primary hover:underline" href="/admin/analytics/action-required">🚨 Action required (start here)</Link>
          <Link className="text-primary hover:underline" href="/admin/visitors/live">🟢 Live visitors</Link>
          <Link className="text-primary hover:underline" href="/admin/analytics/social">📣 Social channels</Link>
          <Link className="text-primary hover:underline" href="/admin/analytics/demographics">👥 Demographics (age, geo)</Link>
          <Link className="text-primary hover:underline" href="/admin/analytics/funnel-breakdown">🔻 Funnel breakdown + insights</Link>
          <Link className="text-primary hover:underline" href="/admin/analytics/lp-leaderboard">🏁 LP leaderboard</Link>
          <Link className="text-primary hover:underline" href="/admin/analytics/cost-per-lead">💸 Cost per lead</Link>
          <Link className="text-primary hover:underline" href="/admin/analytics/listing-performance">🏠 Listing performance</Link>
        </div>
      </div>

      <Tabs defaultValue={String(tab)}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="acquisition">Acquisition</TabsTrigger>
          <TabsTrigger value="behavior">Behavior</TabsTrigger>
          <TabsTrigger value="funnel">Funnel</TabsTrigger>
          <TabsTrigger value="conversions">Conversions</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Suspense fallback={<DashboardSkeleton />}>
            <OverviewTab range={range} />
          </Suspense>
        </TabsContent>

        <TabsContent value="acquisition" className="space-y-4">
          <Suspense fallback={<DashboardSkeleton />}>
            <AcquisitionTab range={range} />
          </Suspense>
        </TabsContent>

        <TabsContent value="behavior" className="space-y-4">
          <Suspense fallback={<DashboardSkeleton />}>
            <BehaviorTab range={range} />
          </Suspense>
        </TabsContent>

        <TabsContent value="funnel" className="space-y-4">
          <Suspense fallback={<DashboardSkeleton />}>
            <FunnelTab range={range} lpVariant={lpVariant} />
          </Suspense>
        </TabsContent>

        <TabsContent value="conversions" className="space-y-4">
          <Suspense fallback={<DashboardSkeleton />}>
            <ConversionsTab range={range} />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
      <Skeleton className="h-72 w-full lg:col-span-2" />
      <Skeleton className="h-72 w-full lg:col-span-2" />
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Overview
// ────────────────────────────────────────────────────────────────────────────

async function OverviewTab({ range }: { range: { startDate: string; endDate: string } }) {
  const d = await fetchOverview(range)

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Sessions" value={formatInt(d.sessions)} />
        <KpiCard label="Total users" value={formatInt(d.totalUsers)} hint={`${formatInt(d.newUsers)} new`} />
        <KpiCard label="Leads (generate_lead)" value={formatInt(d.generateLeadCount)} hint={`${formatPct(d.leadConversionRate, 2)} of sessions`} />
        <KpiCard
          label="Paid spend"
          value={d.paidSpendUsd === null ? 'no data' : formatUsd(d.paidSpendUsd)}
          hint={d.paidSpendUsd === null ? 'Meta cron has not synced spend yet' : 'Meta ads spend in the range'}
        />
        <KpiCard label="Engagement rate" value={formatPct(d.engagementRate)} />
        <KpiCard label="Bounce rate" value={formatPct(d.bounceRate)} />
        <KpiCard label="Avg. session duration" value={formatDuration(d.averageSessionDurationSeconds)} />
        <KpiCard label="Top source" value={d.topSources[0]?.sourceMedium ?? 'no data'} hint={d.topSources[0] ? `${formatInt(d.topSources[0].sessions)} sessions` : null} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top 3 sources</CardTitle>
          </CardHeader>
          <CardContent>
            {d.topSources.length === 0 ? (
              <p className="text-sm text-muted-foreground">No source data in this range.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Source / Medium</TableHead>
                    <TableHead className="text-right">Sessions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {d.topSources.map((s) => (
                    <TableRow key={s.sourceMedium}>
                      <TableCell className="font-medium">{s.sourceMedium}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatInt(s.sessions)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top 3 landing pages</CardTitle>
          </CardHeader>
          <CardContent>
            {d.topLandingPages.length === 0 ? (
              <p className="text-sm text-muted-foreground">No page data in this range.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Page</TableHead>
                    <TableHead className="text-right">Views</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {d.topLandingPages.map((p) => (
                    <TableRow key={p.pagePath}>
                      <TableCell className="font-medium">{p.pagePath}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatInt(p.sessions)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Acquisition
// ────────────────────────────────────────────────────────────────────────────

async function AcquisitionTab({ range }: { range: { startDate: string; endDate: string } }) {
  const d = await fetchAcquisition(range)
  const totalAttributed = d.paidVsOrganic.paidSessions + d.paidVsOrganic.organicSessions + d.paidVsOrganic.otherSessions

  const chartSources = d.sources.slice(0, 10).map((s) => ({
    sourceMedium: s.sourceMedium,
    leads: s.leadEvents,
    sessions: s.sessions,
  }))

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard label="Paid sessions" value={formatInt(d.paidVsOrganic.paidSessions)} hint={totalAttributed > 0 ? formatPct(d.paidVsOrganic.paidSessions / totalAttributed) : null} />
        <KpiCard label="Organic sessions" value={formatInt(d.paidVsOrganic.organicSessions)} hint={totalAttributed > 0 ? formatPct(d.paidVsOrganic.organicSessions / totalAttributed) : null} />
        <KpiCard label="Direct / other" value={formatInt(d.paidVsOrganic.otherSessions)} hint={totalAttributed > 0 ? formatPct(d.paidVsOrganic.otherSessions / totalAttributed) : null} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Top sources by lead volume</CardTitle>
        </CardHeader>
        <CardContent>
          {chartSources.length === 0 ? (
            <p className="text-sm text-muted-foreground">No source attribution in this range.</p>
          ) : (
            <HorizontalBarChart data={chartSources} xKey="sourceMedium" yKey="leads" height={Math.max(280, chartSources.length * 28)} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All UTM combinations</CardTitle>
        </CardHeader>
        <CardContent>
          {d.sources.length === 0 ? (
            <p className="text-sm text-muted-foreground">No source data in this range.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Source / Medium</TableHead>
                  <TableHead className="text-right">Sessions</TableHead>
                  <TableHead className="text-right">Users</TableHead>
                  <TableHead className="text-right">Engaged sessions</TableHead>
                  <TableHead className="text-right">Leads</TableHead>
                  <TableHead className="text-right">Conversion rate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {d.sources.map((s) => (
                  <TableRow key={s.sourceMedium}>
                    <TableCell className="font-medium">{s.sourceMedium}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatInt(s.sessions)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatInt(s.users)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatInt(s.engagedSessions)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatInt(s.leadEvents)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatPct(s.conversionRate, 2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {d.channels.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Social channel sessions</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Channel</TableHead>
                  <TableHead className="text-right">Sessions</TableHead>
                  <TableHead className="text-right">Users</TableHead>
                  <TableHead className="text-right">Engagement rate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {d.channels.map((c) => (
                  <TableRow key={c.channel}>
                    <TableCell className="font-medium">{c.channel}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatInt(c.sessions)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatInt(c.users)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatPct(c.engagementRate)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Behavior
// ────────────────────────────────────────────────────────────────────────────

async function BehaviorTab({ range }: { range: { startDate: string; endDate: string } }) {
  const d = await fetchBehavior(range)

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Top 20 pages by sessions</CardTitle>
        </CardHeader>
        <CardContent>
          {d.pages.length === 0 ? (
            <p className="text-sm text-muted-foreground">No page data in this range.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Page</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead className="text-right">Views</TableHead>
                  <TableHead className="text-right">Users</TableHead>
                  <TableHead className="text-right">Avg. engagement</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {d.pages.map((p) => (
                  <TableRow key={`${p.pagePath}|${p.pageTitle}`}>
                    <TableCell className="font-medium text-foreground max-w-md truncate" title={p.pagePath}>{p.pagePath}</TableCell>
                    <TableCell className="text-muted-foreground max-w-md truncate" title={p.pageTitle}>{p.pageTitle}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatInt(p.views)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatInt(p.users)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatDuration(p.avgEngagementTimeSeconds)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Scroll-depth funnel (estimated)</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-xs text-muted-foreground">
            Distribution across milestones is estimated from the aggregate scroll_depth event count. A future iteration will pull the per-milestone breakdown directly via the GA4 percent_scrolled param.
          </p>
          {d.scrollDepths.every((s) => s.eventCount === 0) ? (
            <p className="text-sm text-muted-foreground">No scroll_depth events in this range.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Milestone</TableHead>
                  <TableHead className="text-right">Events (est.)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {d.scrollDepths.map((s) => (
                  <TableRow key={s.milestone}>
                    <TableCell className="font-medium">{s.milestone}%</TableCell>
                    <TableCell className="text-right tabular-nums">{formatInt(s.eventCount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Funnel
// ────────────────────────────────────────────────────────────────────────────

async function FunnelTab({ range, lpVariant }: { range: { startDate: string; endDate: string }; lpVariant: string }) {
  const d = await fetchFunnel(range, lpVariant || undefined)
  const max = Math.max(1, ...d.steps.map((s) => s.count))

  return (
    <div className="space-y-4">
      <FunnelVariantFilter variants={d.availableVariants} current={lpVariant} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Lead path
            {lpVariant ? <Badge className="ml-2" variant="secondary">lp_variant = {lpVariant}</Badge> : null}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {d.steps.map((step, i) => {
              const widthPct = (step.count / max) * 100
              return (
                <div key={step.label} className="grid grid-cols-12 gap-3 items-center">
                  <div className="col-span-4 text-sm font-medium text-foreground">{i + 1}. {step.label}</div>
                  <div className="col-span-6">
                    <div className="h-6 w-full overflow-hidden rounded-md bg-muted">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{ width: `${Math.max(2, widthPct)}%` }}
                      />
                    </div>
                  </div>
                  <div className="col-span-2 text-right text-sm">
                    <div className="font-semibold text-foreground tabular-nums">{formatInt(step.count)}</div>
                    {step.dropOffPct !== null ? (
                      <div className="text-xs text-muted-foreground tabular-nums">
                        {step.dropOffPct >= 0
                          ? `drop ${formatPct(step.dropOffPct, 1)}`
                          : `gain ${formatPct(-step.dropOffPct, 1)}`}
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground">start</div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Steps 1 through 5 from GA4. Step 6 from public.marketing_assignments. Step 7 from public.cmas where status is delivered, final, or sent.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Conversions
// ────────────────────────────────────────────────────────────────────────────

async function ConversionsTab({ range }: { range: { startDate: string; endDate: string } }) {
  const d = await fetchConversions(range)

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard label="Total leads (FUB)" value={formatInt(d.brokerSplit.reduce((sum, b) => sum + b.count, 0))} hint="From public.marketing_assignments" />
        <KpiCard
          label="Cost per lead"
          value={d.costPerLeadUsd === null ? 'no data' : formatUsd(d.costPerLeadUsd)}
          hint={d.costPerLeadUsd === null ? 'Meta spend not synced for this range' : 'Meta spend ÷ generate_lead events'}
        />
        <KpiCard
          label="Top broker"
          value={d.brokerSplit[0]?.broker ?? 'no data'}
          hint={d.brokerSplit[0] ? `${formatInt(d.brokerSplit[0].count)} leads` : null}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Leads by source</CardTitle>
          </CardHeader>
          <CardContent>
            {d.leadsBySource.length === 0 ? (
              <p className="text-sm text-muted-foreground">No attributed lead sources in this range.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Source / Medium</TableHead>
                    <TableHead className="text-right">Lead events</TableHead>
                    <TableHead className="text-right">Users</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {d.leadsBySource.map((s) => (
                    <TableRow key={s.sourceMedium}>
                      <TableCell className="font-medium">{s.sourceMedium}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatInt(s.leadEvents)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatInt(s.users)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Broker attribution</CardTitle>
          </CardHeader>
          <CardContent>
            {d.brokerSplit.length === 0 ? (
              <p className="text-sm text-muted-foreground">No broker assignments in this range.</p>
            ) : (
              <BrokerPieChart data={d.brokerSplit} />
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Classification mix</CardTitle>
        </CardHeader>
        <CardContent>
          {d.classificationMix.length === 0 ? (
            <p className="text-sm text-muted-foreground">No classification data in this range.</p>
          ) : (
            <StackedBarMix data={d.classificationMix} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sessions and leads over time</CardTitle>
        </CardHeader>
        <CardContent>
          {d.timeSeries.length === 0 ? (
            <p className="text-sm text-muted-foreground">No daily snapshots in this range. The GA4 cron writes one row per day to public.marketing_channel_daily.</p>
          ) : (
            <TimeSeriesChart
              data={d.timeSeries}
              series={[
                { key: 'sessions', label: 'Sessions' },
                { key: 'leads',    label: 'Leads' },
              ]}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
