/**
 * /admin/visitors/[sessionId] - per-session event timeline.
 *
 * Shows the full browsing path for one visitor: every page view, listing
 * view, scroll-depth signal, identification event, in chronological order
 * with the score delta per event. Used to investigate a hot lead by
 * understanding exactly what they did before crossing the threshold.
 */
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { fetchSessionEvents, type SessionEvent } from '../_lib/queries'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) throw new Error('Supabase service role not configured')
  return createClient(url, key)
}

type SessionDetail = {
  session_id: string
  source_domain: string
  first_seen_at: string
  last_seen_at: string
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  utm_content: string | null
  utm_term: string | null
  referrer: string | null
  landing_page: string | null
  user_agent: string | null
  ip_country: string | null
  ip_region: string | null
  ip_city: string | null
  identified_at: string | null
  fub_person_id: number | null
  identified_email: string | null
  identified_via: string | null
  engagement_score: number
  peak_score: number
  intent_tags: string[]
  hot_lead_fired_at: string | null
  events_backfilled_count: number
}

async function fetchSession(sessionId: string): Promise<SessionDetail | null> {
  const supabase = getServiceSupabase()
  const { data, error } = await supabase
    .from('visitor_sessions')
    .select('*')
    .eq('session_id', sessionId)
    .maybeSingle()
  if (error || !data) return null
  return data as unknown as SessionDetail
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', { timeZone: 'America/Los_Angeles', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit' })
}

function fmtRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const s = Math.max(0, Math.floor(ms / 1000))
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

function eventBadgeVariant(type: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (type === 'listing_view') return 'default'
  if (type === 'identify' || type === 'signin') return 'destructive'
  if (type === 'cta_click') return 'secondary'
  return 'outline'
}

function shortenUrl(url: string): string {
  try { return new URL(url).pathname + new URL(url).search } catch { return url.slice(0, 80) }
}

function listingLabelFor(ev: SessionEvent): string | null {
  return ev.listing_mls
    ? `MLS ${ev.listing_mls}${ev.listing_city ? ` · ${ev.listing_city}` : ''}${ev.listing_price ? ` · $${ev.listing_price.toLocaleString()}` : ''}`
    : null
}

function EventCard({ ev }: { ev: SessionEvent }) {
  const listingLabel = listingLabelFor(ev)
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        <Badge variant={eventBadgeVariant(ev.event_type)} className="text-[10px]">{ev.event_type.replace(/_/g, ' ')}</Badge>
        <span className="tabular-nums text-sm font-semibold">
          {ev.score_delta > 0 ? `+${ev.score_delta}` : ev.score_delta}
        </span>
      </div>
      <p className="mt-2 break-all font-mono text-xs text-foreground">{shortenUrl(ev.page_url)}</p>
      {listingLabel && <p className="mt-0.5 text-[10px] text-muted-foreground">{listingLabel}</p>}
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        <span className="whitespace-nowrap">{fmtDateTime(ev.event_at)}</span>
        {ev.page_category && <span>{ev.page_category}</span>}
        {ev.scroll_depth_pct != null && <span className="tabular-nums">scroll {ev.scroll_depth_pct}%</span>}
        {ev.pushed_to_fub_at
          ? <Badge variant="default" className="text-[10px]">FUB synced</Badge>
          : <Badge variant="outline" className="text-[10px]">local</Badge>}
      </div>
    </div>
  )
}

function EventRow({ ev }: { ev: SessionEvent }) {
  const listingLabel = listingLabelFor(ev)
  return (
    <TableRow>
      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{fmtDateTime(ev.event_at)}</TableCell>
      <TableCell>
        <Badge variant={eventBadgeVariant(ev.event_type)} className="text-[10px]">{ev.event_type.replace(/_/g, ' ')}</Badge>
      </TableCell>
      <TableCell className="text-xs">{ev.page_category ?? '-'}</TableCell>
      <TableCell className="font-mono text-xs">
        {shortenUrl(ev.page_url)}
        {listingLabel && <div className="text-[10px] text-muted-foreground">{listingLabel}</div>}
      </TableCell>
      <TableCell className="text-right tabular-nums text-xs">
        {ev.scroll_depth_pct != null ? `${ev.scroll_depth_pct}%` : '-'}
      </TableCell>
      <TableCell className="text-right tabular-nums text-sm font-semibold">
        {ev.score_delta > 0 ? `+${ev.score_delta}` : ev.score_delta}
      </TableCell>
      <TableCell className="text-xs">
        {ev.pushed_to_fub_at
          ? <Badge variant="default" className="text-[10px]">FUB synced</Badge>
          : <Badge variant="outline" className="text-[10px]">local</Badge>}
      </TableCell>
    </TableRow>
  )
}

export default async function VisitorSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>
}) {
  const { sessionId } = await params
  const session = await fetchSession(sessionId)
  if (!session) notFound()
  const events = await fetchSessionEvents(sessionId, 500)

  // Roll-forward the score per event so we can show the trajectory
  let runningScore = 0
  const eventsWithRunning = events.map((e) => {
    runningScore += e.score_delta
    return { ...e, running: runningScore }
  })

  const minutesActive = Math.max(1, Math.round((new Date(session.last_seen_at).getTime() - new Date(session.first_seen_at).getTime()) / 60000))

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <Link href="/admin/visitors/live" className="text-sm text-muted-foreground hover:underline">&larr; Back to live visitors</Link>
        <h1 className="text-2xl font-semibold text-foreground">Visitor session</h1>
        <p className="font-mono text-xs text-muted-foreground">{session.session_id}</p>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Engagement score</p><p className="mt-1 text-2xl font-semibold tabular-nums">{session.engagement_score}</p><p className="text-xs text-muted-foreground tabular-nums">peak {session.peak_score}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Active for</p><p className="mt-1 text-2xl font-semibold tabular-nums">{minutesActive}m</p><p className="text-xs text-muted-foreground">last seen {fmtRelative(session.last_seen_at)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Events</p><p className="mt-1 text-2xl font-semibold tabular-nums">{events.length}</p><p className="text-xs text-muted-foreground">backfilled {session.events_backfilled_count}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Status</p><p className="mt-1 text-sm font-semibold">{session.identified_at ? 'Identified' : 'Anonymous'}</p>{session.hot_lead_fired_at && <Badge variant="destructive" className="mt-1 text-[10px]">Hot lead fired</Badge>}</CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Identity & attribution</CardTitle></CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2 text-sm">
            <div><dt className="text-xs text-muted-foreground">Source</dt><dd>{session.utm_source || 'direct'}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Medium</dt><dd>{session.utm_medium || '-'}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Campaign</dt><dd>{session.utm_campaign || '-'}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Content</dt><dd>{session.utm_content || '-'}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Landing page</dt><dd className="font-mono text-xs break-all">{session.landing_page || '-'}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Referrer</dt><dd className="font-mono text-xs break-all">{session.referrer || '-'}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Geo</dt><dd>{[session.ip_city, session.ip_region, session.ip_country].filter(Boolean).join(', ') || '-'}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Source domain</dt><dd>{session.source_domain}</dd></div>
            <div><dt className="text-xs text-muted-foreground">First seen</dt><dd>{fmtDateTime(session.first_seen_at)}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Last seen</dt><dd>{fmtDateTime(session.last_seen_at)}</dd></div>
            {session.identified_at && (<>
              <div><dt className="text-xs text-muted-foreground">Identified at</dt><dd>{fmtDateTime(session.identified_at)}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Identified via</dt><dd>{session.identified_via || '-'}</dd></div>
              <div><dt className="text-xs text-muted-foreground">FUB person</dt><dd>{session.fub_person_id ? (
                <a href={`https://app.followupboss.com/2/people/view/${session.fub_person_id}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{session.identified_email ?? `FUB #${session.fub_person_id}`}</a>
              ) : '-'}</dd></div>
            </>)}
          </dl>
          {session.intent_tags.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-xs text-muted-foreground">Intent tags</p>
              <div className="flex flex-wrap gap-1">
                {session.intent_tags.map((t) => <Badge key={t} variant="secondary">{t.replace(/_/g, ' ')}</Badge>)}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Event timeline ({events.length})</CardTitle></CardHeader>
        <CardContent className="p-0">
          {events.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">No events recorded for this session.</p>
          ) : (
            <>
              {/* Event cards — phones (one stacked card per event) */}
              <div className="space-y-2 p-3 md:hidden">
                {eventsWithRunning.map((ev) => <EventCard key={ev.id} ev={ev} />)}
              </div>

              {/* Event table — desktop */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Time (PT)</TableHead>
                      <TableHead>Event</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Page</TableHead>
                      <TableHead className="text-right">Scroll</TableHead>
                      <TableHead className="text-right">Score &Delta;</TableHead>
                      <TableHead>FUB</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {eventsWithRunning.map((ev) => <EventRow key={ev.id} ev={ev} />)}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
