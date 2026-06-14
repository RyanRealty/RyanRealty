/**
 * /admin/visitors/live — real-time list of the 50 most recently active
 * visitor sessions across all source domains.
 *
 * Server component. Refetches on every navigation (revalidate=0). For
 * real-time auto-refresh the LiveTable child component polls every 15s.
 *
 * Data: visitor_sessions + visitor_events tables, populated by
 * /api/visitors/track and the WordPress snippet at
 * docs/wordpress-fub-identify-snippet.html.
 */
import { Suspense } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { fetchLiveVisitors, fetchLiveSummary, type LiveSessionRow } from '../_lib/queries'

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

function formatRelative(iso: string): string {
  const now = Date.now()
  const then = new Date(iso).getTime()
  const diffSec = Math.max(0, Math.floor((now - then) / 1000))
  if (diffSec < 60) return `${diffSec}s ago`
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`
  return `${Math.floor(diffSec / 86400)}d ago`
}

function scoreBadgeVariant(score: number): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (score >= 100) return 'destructive'  // hot
  if (score >= 50) return 'default'       // warm
  if (score >= 20) return 'secondary'     // engaged
  return 'outline'                        // cold
}

function scoreLabel(score: number): string {
  if (score >= 100) return 'hot'
  if (score >= 50) return 'warm'
  if (score >= 20) return 'engaged'
  return 'cold'
}

function formatSource(s: Pick<LiveSessionRow, 'utm_source' | 'utm_medium'>): string {
  if (!s.utm_source) return 'direct'
  if (s.utm_medium && s.utm_medium !== 'none') return `${s.utm_source} / ${s.utm_medium}`
  return s.utm_source
}

function formatGeo(s: Pick<LiveSessionRow, 'ip_city' | 'ip_region' | 'ip_country'>): string {
  const parts: string[] = []
  if (s.ip_city) parts.push(s.ip_city)
  if (s.ip_region && s.ip_region !== s.ip_city) parts.push(s.ip_region)
  if (s.ip_country && parts.length === 0) parts.push(s.ip_country)
  return parts.join(', ') || '—'
}

function shortSession(id: string): string {
  return id.slice(0, 8)
}

async function SummaryStrip() {
  const summary = await fetchLiveSummary()
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Active now (5m)</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{summary.totalActive}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Sessions today</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{summary.totalToday}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Identified today</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{summary.identifiedToday}</p>
          {summary.totalToday > 0 && (
            <p className="text-xs text-muted-foreground tabular-nums">
              {Math.round((summary.identifiedToday / summary.totalToday) * 100)}% of sessions
            </p>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Hot leads today</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{summary.hotLeadsToday}</p>
          {summary.topSource && (
            <p className="text-xs text-muted-foreground">
              Top source: {summary.topSource} ({summary.topSourceCount})
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

async function VisitorTable({ filter }: { filter: 'all' | 'anonymous' | 'identified' }) {
  const rows = await fetchLiveVisitors({ identifiedFilter: filter, limit: 50 })
  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-sm text-muted-foreground">
          No matching sessions yet. Once the WordPress snippet starts firing tracked events, sessions appear here in real time.
        </CardContent>
      </Card>
    )
  }
  return (
    <>
      {/* Session cards — phones (one thumb-tap per session) */}
      <div className="space-y-2 md:hidden">
        {rows.map((s) => (
          <Card key={s.session_id} className="transition-colors hover:bg-muted/50">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2">
                <Link
                  href={`/admin/visitors/${encodeURIComponent(s.session_id)}`}
                  className="min-w-0 flex-1 hover:underline"
                  title={s.session_id}
                >
                  <div className="font-mono text-xs text-foreground">{shortSession(s.session_id)}</div>
                  <div className="text-[10px] text-muted-foreground">{s.source_domain}</div>
                </Link>
                <Badge variant={scoreBadgeVariant(s.engagement_score)} className="shrink-0 tabular-nums">
                  {s.engagement_score} · {scoreLabel(s.engagement_score)}
                </Badge>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                <div className="min-w-0">
                  <span className="text-muted-foreground">Source </span>
                  <span className="text-foreground">{formatSource(s)}</span>
                  {s.utm_campaign && <div className="text-[10px] text-muted-foreground">{s.utm_campaign}</div>}
                </div>
                <div className="min-w-0">
                  <span className="text-muted-foreground">Geo </span>
                  <span className="text-foreground">{formatGeo(s)}</span>
                </div>
                <div className="tabular-nums">
                  <span className="text-muted-foreground">Events </span>
                  <span className="text-foreground">{s.event_count}</span>
                </div>
                <div className="whitespace-nowrap">
                  <span className="text-muted-foreground">Last seen </span>
                  <span className="text-foreground">{formatRelative(s.last_seen_at)}</span>
                </div>
              </div>
              {s.intent_tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {s.intent_tags.map((t) => (
                    <Badge key={t} variant="outline" className="text-[10px]">
                      {t.replace(/_/g, ' ')}
                    </Badge>
                  ))}
                </div>
              )}
              <div className="mt-2 text-xs">
                {s.fub_person_id ? (
                  <a
                    href={`https://app.followupboss.com/2/people/view/${s.fub_person_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    {s.identified_email ?? `FUB #${s.fub_person_id}`}
                  </a>
                ) : (
                  <span className="text-muted-foreground">anonymous</span>
                )}
                {s.identified_via && (
                  <span className="text-[10px] text-muted-foreground"> · via {s.identified_via}</span>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Session table — desktop */}
      <Card className="hidden md:block">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Session</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Geo</TableHead>
                <TableHead className="text-right tabular-nums">Score</TableHead>
                <TableHead>Intent</TableHead>
                <TableHead className="text-right tabular-nums">Events</TableHead>
                <TableHead>Identified</TableHead>
                <TableHead>Last seen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((s) => (
              <TableRow key={s.session_id}>
                <TableCell className="font-mono text-xs">
                  <Link
                    href={`/admin/visitors/${encodeURIComponent(s.session_id)}`}
                    className="hover:underline"
                    title={s.session_id}
                  >
                    {shortSession(s.session_id)}
                  </Link>
                  <div className="text-[10px] text-muted-foreground">{s.source_domain}</div>
                </TableCell>
                <TableCell className="text-xs">
                  <div>{formatSource(s)}</div>
                  {s.utm_campaign && <div className="text-[10px] text-muted-foreground">{s.utm_campaign}</div>}
                </TableCell>
                <TableCell className="text-xs">{formatGeo(s)}</TableCell>
                <TableCell className="text-right">
                  <Badge variant={scoreBadgeVariant(s.engagement_score)} className="tabular-nums">
                    {s.engagement_score} · {scoreLabel(s.engagement_score)}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {s.intent_tags.length === 0 ? (
                      <span className="text-xs text-muted-foreground">—</span>
                    ) : (
                      s.intent_tags.map((t) => (
                        <Badge key={t} variant="outline" className="text-[10px]">
                          {t.replace(/_/g, ' ')}
                        </Badge>
                      ))
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right text-sm tabular-nums">{s.event_count}</TableCell>
                <TableCell className="text-xs">
                  {s.fub_person_id ? (
                    <a
                      href={`https://app.followupboss.com/2/people/view/${s.fub_person_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      {s.identified_email ?? `FUB #${s.fub_person_id}`}
                    </a>
                  ) : (
                    <span className="text-muted-foreground">anonymous</span>
                  )}
                  {s.identified_via && (
                    <div className="text-[10px] text-muted-foreground">via {s.identified_via}</div>
                  )}
                </TableCell>
                <TableCell className="text-xs whitespace-nowrap">{formatRelative(s.last_seen_at)}</TableCell>
              </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  )
}

function TableSkeleton() {
  return (
    <Card>
      <CardContent className="space-y-2 p-4">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </CardContent>
    </Card>
  )
}

export default async function LiveVisitorsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const sp = normalizeParams(await searchParams)
  const filter = (sp.filter === 'anonymous' || sp.filter === 'identified') ? sp.filter : 'all'

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-foreground">Live visitors</h1>
        <p className="text-sm text-muted-foreground">
          The 50 most recently active sessions across ryan-realty.com and ryanrealty.vercel.app. Engagement score updates in real time as visitors browse. Click a session id for the full event timeline.
        </p>
      </header>

      <Suspense fallback={<Skeleton className="h-24 w-full" />}>
        <SummaryStrip />
      </Suspense>

      <Tabs value={filter}>
        <TabsList>
          <TabsTrigger value="all" asChild>
            <Link href="?filter=all" replace>All</Link>
          </TabsTrigger>
          <TabsTrigger value="anonymous" asChild>
            <Link href="?filter=anonymous" replace>Anonymous</Link>
          </TabsTrigger>
          <TabsTrigger value="identified" asChild>
            <Link href="?filter=identified" replace>Identified</Link>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <Suspense fallback={<TableSkeleton />}>
        <VisitorTable filter={filter} />
      </Suspense>

      <p className="text-xs text-muted-foreground">
        Page revalidates on every navigation. Reload to refresh. Score legend: cold &lt; 20, engaged 20–49, warm 50–99, hot ≥ 100. Hot scores fire a 5-minute FUB call task automatically (cron-driven).
      </p>
    </div>
  )
}
