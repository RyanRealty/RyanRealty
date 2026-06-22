/**
 * /admin/people/[fubPersonId] — single-pane-of-glass per-person view.
 *
 * Joins everything Ryan Realty knows about one FUB person:
 *
 *   1. FUB profile      — live fetch from /v1/people/{id} (name, email, phone,
 *                          tags, source, customFields, assignedTo, lastActivity)
 *   2. Visitor sessions — every browser session this person has been on
 *   3. Visitor events   — chronological page-view / search / listing-view
 *                          timeline across all their sessions (last 100)
 *   4. Form submissions — listing_inquiries + valuation_requests + cmas
 *                          joined on email match
 *   5. Broker assignments — marketing_assignments rows for this fub_person_id
 *
 * Why this page exists:
 *   The action-required dashboard links to the FUB profile, but FUB only
 *   sees the events we pushed to it. The Supabase tables hold the richer
 *   granular data (every scroll, every page, every listing they viewed).
 *   This page is the one view that ties both worlds together so a broker
 *   has full context before a call.
 *
 * Auth: protected by app/admin/(protected)/layout.tsx — admin role required.
 */

import { Suspense } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { getFubApiKey } from '@/lib/crm/fub-env'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { listCmasForLeadEmail } from '@/lib/data/sync/syncWrites'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─── Helpers ──────────────────────────────────────────────────────────────

function formatInt(n: number): string {
  return new Intl.NumberFormat('en-US').format(n)
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

function formatRelative(iso: string | null | undefined): string {
  if (!iso) return '—'
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000))
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  if (s < 86400 * 30) return `${Math.floor(s / 86400)}d ago`
  return `${Math.floor(s / (86400 * 30))}mo ago`
}

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) throw new Error('Supabase service role not configured')
  return createClient(url, key)
}

// ─── Types ────────────────────────────────────────────────────────────────

type FubPersonFull = {
  id: number
  firstName?: string
  lastName?: string
  name?: string
  emails?: Array<{ value: string; type?: string; isPrimary?: number }>
  phones?: Array<{ value: string; type?: string; isPrimary?: number }>
  tags?: string[]
  source?: string
  sourceUrl?: string
  stage?: string
  assignedUserId?: number
  assignedTo?: string
  created?: string
  updated?: string
  lastActivity?: string
  lastCommunication?: string
  customFields?: Record<string, unknown>
}

type VisitorSession = {
  session_id: string
  source_domain: string
  first_seen_at: string
  last_seen_at: string
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  ip_city: string | null
  ip_region: string | null
  identified_at: string | null
  identified_via: string | null
  engagement_score: number
  peak_score: number
  intent_tags: string[] | null
  hot_lead_fired_at: string | null
  landing_page: string | null
}

type VisitorEvent = {
  id: number
  session_id: string
  event_at: string
  event_type: string
  page_url: string
  page_title: string | null
  page_category: string | null
  listing_mls: string | null
  listing_street: string | null
  listing_city: string | null
  listing_price: number | null
  scroll_depth_pct: number | null
  score_delta: number
}

type ListingInquiry = {
  id: string
  created_at: string
  type: string
  listing_address: string
  listing_url: string
  message: string | null
}

type ValuationRequest = {
  id: string
  created_at: string
  address_street: string | null
  address_city: string | null
  source_url: string | null
}

type CmaRow = {
  id: string
  created_at: string
  status: string | null
  slug?: string | null
  lead_email?: string | null
}

type AssignmentHistory = {
  id: string
  assigned_at: string
  audience: string
  broker: string
  source: string | null
  tier: string | null
}

// ─── FUB person fetch ─────────────────────────────────────────────────────

async function fetchFubPerson(personId: number): Promise<FubPersonFull | null> {
  const apiKey = (getFubApiKey() || '').trim()
  if (!apiKey) return null
  const fields = 'id,firstName,lastName,name,emails,phones,tags,source,sourceUrl,stage,assignedUserId,assignedTo,created,updated,lastActivity,lastCommunication,customFields'
  const url = `https://api.followupboss.com/v1/people/${personId}?fields=${encodeURIComponent(fields)}`
  const auth = Buffer.from(`${apiKey}:`).toString('base64')
  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    })
    if (!res.ok) {
      console.warn(`[admin/people] FUB fetch failed for ${personId}: HTTP ${res.status}`)
      return null
    }
    return (await res.json()) as FubPersonFull
  } catch (err) {
    console.warn(`[admin/people] FUB fetch error for ${personId}:`, err)
    return null
  }
}

// ─── Async data content ───────────────────────────────────────────────────

async function PersonContent({ fubPersonId }: { fubPersonId: number }) {
  const supabase = getServiceSupabase()

  // Parallel-fetch FUB profile + Supabase visitor_sessions + assignments.
  // (Email-keyed tables get fetched in a second pass once we have an email.)
  const [fubPerson, sessionsRes, assignmentsRes] = await Promise.all([
    fetchFubPerson(fubPersonId),
    supabase
      .from('visitor_sessions')
      .select('session_id, source_domain, first_seen_at, last_seen_at, utm_source, utm_medium, utm_campaign, ip_city, ip_region, identified_at, identified_via, engagement_score, peak_score, intent_tags, hot_lead_fired_at, landing_page')
      .eq('fub_person_id', fubPersonId)
      .order('last_seen_at', { ascending: false })
      .limit(50),
    supabase
      .from('marketing_assignments')
      .select('id, assigned_at, audience, broker, source, tier')
      .eq('fub_person_id', fubPersonId)
      .order('assigned_at', { ascending: false })
      .limit(50),
  ])

  // FUB miss is recoverable — we may still have Supabase data for the person id.
  // But if we have nothing at all we 404.
  const sessions = (sessionsRes.data ?? []) as VisitorSession[]
  const assignments = (assignmentsRes.data ?? []) as AssignmentHistory[]
  if (!fubPerson && sessions.length === 0 && assignments.length === 0) {
    notFound()
  }

  const primaryEmail =
    fubPerson?.emails?.find((e) => e.isPrimary)?.value?.toLowerCase().trim() ||
    fubPerson?.emails?.[0]?.value?.toLowerCase().trim() ||
    null
  const primaryPhone =
    fubPerson?.phones?.find((p) => p.isPrimary)?.value ||
    fubPerson?.phones?.[0]?.value ||
    null
  const displayName =
    fubPerson?.name ||
    [fubPerson?.firstName, fubPerson?.lastName].filter(Boolean).join(' ') ||
    primaryEmail ||
    `FUB #${fubPersonId}`

  // Fetch the email-keyed tables in parallel now that we have the email.
  const sessionIds = sessions.map((s) => s.session_id)
  const [eventsRes, inquiriesRes, valuationsRes, cmasRes] = await Promise.all([
    sessionIds.length > 0
      ? supabase
          .from('visitor_events')
          .select('id, session_id, event_at, event_type, page_url, page_title, page_category, listing_mls, listing_street, listing_city, listing_price, scroll_depth_pct, score_delta')
          .in('session_id', sessionIds)
          .order('event_at', { ascending: false })
          .limit(100)
      : Promise.resolve({ data: [] as VisitorEvent[], error: null }),
    primaryEmail
      ? supabase
          .from('listing_inquiries')
          .select('id, created_at, type, listing_address, listing_url, message')
          .eq('email', primaryEmail)
          .order('created_at', { ascending: false })
          .limit(20)
      : Promise.resolve({ data: [] as ListingInquiry[], error: null }),
    primaryEmail
      ? supabase
          .from('valuation_requests')
          .select('id, created_at, address_street, address_city, source_url')
          .eq('email', primaryEmail)
          .order('created_at', { ascending: false })
          .limit(20)
      : Promise.resolve({ data: [] as ValuationRequest[], error: null }),
    primaryEmail
      ? listCmasForLeadEmail({ email: primaryEmail, limit: 20 })
      : Promise.resolve([] as Array<Record<string, unknown>>),
  ])

  const events = (eventsRes.data ?? []) as VisitorEvent[]
  const inquiries = (inquiriesRes.data ?? []) as ListingInquiry[]
  const valuations = (valuationsRes.data ?? []) as ValuationRequest[]
  const cmas = cmasRes as unknown as CmaRow[]

  const totalEngagement = sessions.reduce((acc, s) => acc + (s.engagement_score ?? 0), 0)
  const peakEverScore = sessions.reduce((acc, s) => Math.max(acc, s.peak_score ?? 0), 0)
  const firstSeen = sessions.length ? sessions[sessions.length - 1].first_seen_at : null
  const lastSeen = sessions.length ? sessions[0].last_seen_at : null
  const everIdentified = sessions.some((s) => s.identified_at)
  const everHot = sessions.some((s) => s.hot_lead_fired_at)

  return (
    <div className="space-y-6">
      {/* 1. Identity header */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-xl">{displayName}</CardTitle>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                {primaryEmail && <span>{primaryEmail}</span>}
                {primaryEmail && primaryPhone && <span>·</span>}
                {primaryPhone && <span>{primaryPhone}</span>}
                {fubPerson?.stage && <Badge variant="secondary" className="ml-1">{fubPerson.stage}</Badge>}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <a
                href={`https://app.followupboss.com/2/people/view/${fubPersonId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-primary hover:bg-muted"
              >
                Open in FUB ↗
              </a>
              <Link
                href="/admin/analytics/action-required"
                className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
              >
                ← Action required
              </Link>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {fubPerson?.tags && fubPerson.tags.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-1">
              {fubPerson.tags.map((t) => (
                <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>
              ))}
            </div>
          )}
          <div className="grid gap-3 text-xs text-muted-foreground sm:grid-cols-2 md:grid-cols-4">
            <div>
              <div className="font-medium text-foreground">Source</div>
              <div>{fubPerson?.source || '—'}</div>
            </div>
            <div>
              <div className="font-medium text-foreground">Assigned</div>
              <div>{fubPerson?.assignedTo || '—'}</div>
            </div>
            <div>
              <div className="font-medium text-foreground">First seen</div>
              <div>{formatRelative(firstSeen ?? fubPerson?.created)} ({formatDateTime(firstSeen ?? fubPerson?.created)})</div>
            </div>
            <div>
              <div className="font-medium text-foreground">Last activity</div>
              <div>{formatRelative(lastSeen ?? fubPerson?.lastActivity)} ({formatDateTime(lastSeen ?? fubPerson?.lastActivity)})</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2. Engagement summary */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Sessions</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold tabular-nums text-foreground">{formatInt(sessions.length)}</p>
            <p className="mt-1 text-xs text-muted-foreground">browser sessions seen</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Peak score</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold tabular-nums text-foreground">{formatInt(peakEverScore)}</p>
            <p className="mt-1 text-xs text-muted-foreground">{everHot ? 'hot-lead threshold crossed' : 'below 100 = not hot yet'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Total engagement</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold tabular-nums text-foreground">{formatInt(totalEngagement)}</p>
            <p className="mt-1 text-xs text-muted-foreground">sum across all sessions</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Identified</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold tabular-nums text-foreground">{everIdentified ? 'Yes' : 'No'}</p>
            <p className="mt-1 text-xs text-muted-foreground">{everIdentified ? `via ${sessions.find((s) => s.identified_via)?.identified_via ?? 'unknown'}` : 'cookie or signed in'}</p>
          </CardContent>
        </Card>
      </div>

      {/* 3. Visitor sessions */}
      <Card>
        <CardHeader>
          <CardTitle>Browser sessions (latest {sessions.length})</CardTitle>
          <p className="text-xs text-muted-foreground">
            Every browser this person has used. Click into one to see the full event-by-event journey.
          </p>
        </CardHeader>
        <CardContent>
          {sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No browser sessions on file. This person may have arrived only via Meta Lead Ads webhook (server-to-server, no site session).</p>
          ) : (
            <>
              {/* Sessions — stacked cards on phones */}
              <div className="space-y-2 md:hidden">
                {sessions.map((s) => (
                  <Link
                    key={s.session_id}
                    href={`/admin/visitors/${encodeURIComponent(s.session_id)}`}
                    className="block rounded-lg border border-border bg-card p-3 transition-colors hover:bg-muted/50"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-medium text-foreground">{s.utm_source || s.source_domain || '—'}</span>
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{formatRelative(s.last_seen_at)}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span className="tabular-nums">Score {formatInt(s.engagement_score)}</span>
                      <span className="tabular-nums">Peak {formatInt(s.peak_score)}</span>
                      <span>{s.ip_city || s.ip_region || '—'}</span>
                    </div>
                    {(s.intent_tags ?? []).length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {(s.intent_tags ?? []).slice(0, 3).map((t) => (
                          <Badge key={t} variant="outline" className="text-[10px]">{t.replace(/_/g, ' ')}</Badge>
                        ))}
                      </div>
                    )}
                  </Link>
                ))}
              </div>
              {/* Sessions — table on desktop */}
              <div className="hidden overflow-hidden rounded-lg border border-border md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>First seen</TableHead>
                      <TableHead>Last activity</TableHead>
                      <TableHead className="text-right tabular-nums">Score</TableHead>
                      <TableHead className="text-right tabular-nums">Peak</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>City</TableHead>
                      <TableHead>Intent</TableHead>
                      <TableHead className="text-right">Journey</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sessions.map((s) => (
                      <TableRow key={s.session_id}>
                        <TableCell className="text-xs text-muted-foreground">{formatRelative(s.first_seen_at)}</TableCell>
                        <TableCell className="text-xs">{formatRelative(s.last_seen_at)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatInt(s.engagement_score)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatInt(s.peak_score)}</TableCell>
                        <TableCell className="text-xs">{s.utm_source || s.source_domain || '—'}</TableCell>
                        <TableCell className="text-xs">{s.ip_city || s.ip_region || '—'}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {(s.intent_tags ?? []).slice(0, 3).map((t) => (
                              <Badge key={t} variant="outline" className="text-[10px]">{t.replace(/_/g, ' ')}</Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Link href={`/admin/visitors/${encodeURIComponent(s.session_id)}`} className="text-xs text-primary hover:underline">journey →</Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* 4. Event timeline */}
      <Card>
        <CardHeader>
          <CardTitle>Activity timeline (latest {events.length} events)</CardTitle>
          <p className="text-xs text-muted-foreground">
            Every page view, listing view, search, scroll across every browser this person has used. Newest first.
          </p>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground">No tracked events yet. Visitor tracking writes events from the moment a session starts; if a person was created via Meta Lead Ad without ever visiting the site, this stays empty.</p>
          ) : (
            <>
              {/* Events — stacked cards on phones */}
              <div className="space-y-2 md:hidden">
                {events.map((e) => (
                  <div key={e.id} className="rounded-lg border border-border bg-card p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={e.event_type === 'listing_view' ? 'default' : e.event_type === 'cta_click' ? 'secondary' : 'outline'} className="text-[10px]">
                          {e.event_type.replace(/_/g, ' ')}
                        </Badge>
                        {e.page_category && (
                          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{e.page_category}</span>
                        )}
                      </div>
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{formatRelative(e.event_at)}</span>
                    </div>
                    <div className="mt-1 truncate text-xs">
                      {e.listing_mls ? (
                        <span>
                          <span className="font-medium">MLS {e.listing_mls}</span>
                          {e.listing_street && <span className="text-muted-foreground"> · {e.listing_street}{e.listing_city ? `, ${e.listing_city}` : ''}</span>}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">{e.page_title || e.page_url}</span>
                      )}
                    </div>
                    {e.score_delta > 0 && (
                      <div className="mt-1 text-xs tabular-nums text-muted-foreground">+{e.score_delta} score</div>
                    )}
                  </div>
                ))}
              </div>
              {/* Events — table on desktop */}
              <div className="hidden overflow-hidden rounded-lg border border-border md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-32">When</TableHead>
                      <TableHead>Event</TableHead>
                      <TableHead>Page / Listing</TableHead>
                      <TableHead className="text-right tabular-nums">+Score</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {events.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell className="text-xs text-muted-foreground">{formatRelative(e.event_at)}</TableCell>
                        <TableCell>
                          <Badge variant={e.event_type === 'listing_view' ? 'default' : e.event_type === 'cta_click' ? 'secondary' : 'outline'} className="text-[10px]">
                            {e.event_type.replace(/_/g, ' ')}
                          </Badge>
                          {e.page_category && (
                            <span className="ml-2 text-[10px] uppercase tracking-wider text-muted-foreground">{e.page_category}</span>
                          )}
                        </TableCell>
                        <TableCell className="max-w-md truncate text-xs">
                          {e.listing_mls ? (
                            <span>
                              <span className="font-medium">MLS {e.listing_mls}</span>
                              {e.listing_street && <span className="text-muted-foreground"> · {e.listing_street}{e.listing_city ? `, ${e.listing_city}` : ''}</span>}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">{e.page_title || e.page_url}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">{e.score_delta > 0 ? `+${e.score_delta}` : '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* 5. Form submissions */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Listing inquiries ({inquiries.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {inquiries.length === 0 ? (
              <p className="text-sm text-muted-foreground">No inquiries on file.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {inquiries.map((i) => (
                  <li key={i.id} className="rounded border border-border p-2">
                    <div className="font-medium">{i.type === 'showing' ? 'Schedule showing' : 'Ask a question'}</div>
                    <div className="text-xs text-muted-foreground">{i.listing_address}</div>
                    <div className="text-[10px] text-muted-foreground">{formatRelative(i.created_at)}</div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Valuation requests ({valuations.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {valuations.length === 0 ? (
              <p className="text-sm text-muted-foreground">No valuation requests.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {valuations.map((v) => (
                  <li key={v.id} className="rounded border border-border p-2">
                    <div className="font-medium">{v.address_street || '(no street)'}</div>
                    <div className="text-xs text-muted-foreground">{v.address_city ?? '—'}</div>
                    <div className="text-[10px] text-muted-foreground">{formatRelative(v.created_at)}</div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>CMAs ({cmas.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {cmas.length === 0 ? (
              <p className="text-sm text-muted-foreground">No CMAs created.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {cmas.map((c) => (
                  <li key={c.id} className="rounded border border-border p-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{c.slug || c.id.slice(0, 8)}</span>
                      <Badge variant="outline" className="text-[10px]">{c.status ?? 'draft'}</Badge>
                    </div>
                    <div className="text-[10px] text-muted-foreground">{formatRelative(c.created_at)}</div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 6. Assignment history */}
      <Card>
        <CardHeader>
          <CardTitle>Broker assignment history ({assignments.length})</CardTitle>
          <p className="text-xs text-muted-foreground">
            Every time a form submit or canonical-tagging call assigned this person to a broker. Source identifies which surface triggered the assignment.
          </p>
        </CardHeader>
        <CardContent>
          {assignments.length === 0 ? (
            <Alert>
              <AlertDescription className="text-sm">
                No marketing_assignments rows for this person yet. If they ARE in FUB but never appear here, the lead-creating path that wrote them probably predates the canonical-tagger wiring (commit 8d5e770 brought 7 surfaces up to standard — older paths or pre-2026-05-23 inserts may have skipped the ledger).
              </AlertDescription>
            </Alert>
          ) : (
            <>
              {/* Assignments — stacked cards on phones */}
              <div className="space-y-2 md:hidden">
                {assignments.map((a) => (
                  <div key={a.id} className="rounded-lg border border-border bg-card p-3">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-medium capitalize text-foreground">{a.broker}</span>
                      <Badge variant="secondary" className="shrink-0 capitalize">{a.audience}</Badge>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">{formatDateTime(a.assigned_at)}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span>Source: {a.source || '—'}</span>
                      <span>Tier: {a.tier || '—'}</span>
                    </div>
                  </div>
                ))}
              </div>
              {/* Assignments — table on desktop */}
              <div className="hidden overflow-hidden rounded-lg border border-border md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>When</TableHead>
                      <TableHead>Audience</TableHead>
                      <TableHead>Broker</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Tier</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {assignments.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell className="text-xs text-muted-foreground">{formatDateTime(a.assigned_at)}</TableCell>
                        <TableCell><Badge variant="secondary" className="capitalize">{a.audience}</Badge></TableCell>
                        <TableCell className="font-medium capitalize">{a.broker}</TableCell>
                        <TableCell className="text-xs">{a.source || '—'}</TableCell>
                        <TableCell className="text-xs">{a.tier || '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Separator />

      <div className="space-y-1 text-xs text-muted-foreground">
        <p>
          <strong className="text-foreground">FUB person id:</strong> <code className="rounded bg-muted px-1 tabular-nums">{fubPersonId}</code>
          {primaryEmail && <span> · <strong className="text-foreground">Email:</strong> <code className="rounded bg-muted px-1">{primaryEmail}</code></span>}
        </p>
        <p>
          Sources: FUB <code className="rounded bg-muted px-1">/v1/people/{fubPersonId}</code>, Supabase <code className="rounded bg-muted px-1">visitor_sessions</code> + <code className="rounded bg-muted px-1">visitor_events</code> + <code className="rounded bg-muted px-1">listing_inquiries</code> + <code className="rounded bg-muted px-1">valuation_requests</code> + <code className="rounded bg-muted px-1">cmas</code> + <code className="rounded bg-muted px-1">marketing_assignments</code>.
        </p>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────

export default async function PersonProfilePage({ params }: { params: Promise<{ fubPersonId: string }> }) {
  const { fubPersonId: rawId } = await params
  const fubPersonId = parseInt(rawId, 10)
  if (!Number.isFinite(fubPersonId) || fubPersonId <= 0) {
    notFound()
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-foreground">Person view</h1>
        <p className="text-sm text-muted-foreground">
          Everything Ryan Realty knows about FUB person #{fubPersonId}. Joins the FUB profile with our own visitor + form + assignment tables for full context before a call.
        </p>
      </header>

      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <PersonContent fubPersonId={fubPersonId} />
      </Suspense>
    </div>
  )
}
