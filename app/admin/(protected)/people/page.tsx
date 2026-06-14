/**
 * /admin/people — searchable index of every known FUB person who has
 * either been assigned to a broker (marketing_assignments) or seen on the
 * site as an identified visitor (visitor_sessions).
 *
 * Filters via URL search params (every filter is a single click in the
 * facets card):
 *   ?audience=seller|buyer
 *   ?broker=matt|rebecca|paul
 *   ?tier=hot|warm|nurture
 *   ?source=<canonical-source>
 *   ?activity=hot|active-30m|recent-24h|recent-7d
 *   ?q=<email substring>
 *
 * Each row links to /admin/people/[fubPersonId] for the full per-person
 * single-pane-of-glass view.
 *
 * Powered by a single Supabase query against marketing_assignments joined
 * with the most-recent visitor_session per fub_person_id (for activity +
 * display name). Designed to stay sub-1s on a fleet of ~10k assignments.
 */

import { Suspense } from 'react'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import { HugeiconsIcon } from '@hugeicons/react'
import { UserMultipleIcon, SearchRemoveIcon } from '@hugeicons/core-free-icons'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'

// How many people we show per page on the people index. The merge/sort/filter
// pipeline below stays untouched — this is a presentational cap so the screen
// never renders an unbounded wall of rows (admin design standard, Law 1).
const PAGE_SIZE = 25

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─── Helpers ──────────────────────────────────────────────────────────────

function formatInt(n: number): string {
  return new Intl.NumberFormat('en-US').format(n)
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

type SearchParams = Record<string, string | string[] | undefined>

type AssignmentRow = {
  id: string
  assigned_at: string
  audience: string
  broker: string
  source: string | null
  tier: string | null
  fub_person_id: number | null
}

type SessionRow = {
  fub_person_id: number
  identified_email: string | null
  last_seen_at: string
  engagement_score: number
  peak_score: number
  hot_lead_fired_at: string | null
  intent_tags: string[] | null
  ip_city: string | null
  utm_source: string | null
}

type PersonRow = {
  fubPersonId: number
  identifiedEmail: string | null
  audience: string | null
  broker: string | null
  source: string | null
  tier: string | null
  assignedAt: string | null
  lastSeenAt: string | null
  peakScore: number
  hotFiredAt: string | null
  intentTags: string[]
  city: string | null
  trafficSource: string | null
}

function normalizeParams(sp: SearchParams): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {}
  for (const [k, v] of Object.entries(sp)) {
    out[k] = Array.isArray(v) ? v[0] : v
  }
  return out
}

// Build the query string that toggles a single filter on/off. Changing any
// filter resets pagination back to page 1.
function toggleParam(current: Record<string, string | undefined>, key: string, value: string): string {
  const next = { ...current }
  if (next[key] === value) delete next[key]
  else next[key] = value
  delete next.page
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(next)) {
    if (v) params.set(k, v)
  }
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

// Build the query string for a pagination link — keeps every active filter,
// just swaps the page number.
function pageHref(current: Record<string, string | undefined>, page: number): string {
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(current)) {
    if (v && k !== 'page') params.set(k, v)
  }
  if (page > 1) params.set('page', String(page))
  const qs = params.toString()
  return `/admin/people${qs ? `?${qs}` : ''}`
}

// ─── Content ──────────────────────────────────────────────────────────────

async function PeopleIndexContent({ params }: { params: Record<string, string | undefined> }) {
  const supabase = getServiceSupabase()

  // 90-day window — wide enough to catch everyone who's been through the
  // pipeline recently, narrow enough to stay snappy on a growing dataset.
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
  const limit = 200

  // 1. Pull recent assignments (filtered server-side).
  let assignmentsQ = supabase
    .from('marketing_assignments')
    .select('id, assigned_at, audience, broker, source, tier, fub_person_id')
    .gte('assigned_at', since)
    .not('fub_person_id', 'is', null)
    .order('assigned_at', { ascending: false })
    .limit(limit)
  if (params.audience) assignmentsQ = assignmentsQ.eq('audience', params.audience)
  if (params.broker) assignmentsQ = assignmentsQ.eq('broker', params.broker)
  if (params.tier) assignmentsQ = assignmentsQ.eq('tier', params.tier)
  if (params.source) assignmentsQ = assignmentsQ.eq('source', params.source)

  const { data: assignmentsData, error: assignmentsError } = await assignmentsQ
  const assignments = (assignmentsData ?? []) as AssignmentRow[]

  // 2. Pull recent visitor sessions for the assigned + identified set, and
  //    also pull any identified visitors who have NO assignment yet (so the
  //    "active right now" use case still surfaces them).
  const fubIdsFromAssignments = new Set<number>(
    assignments.map((a) => a.fub_person_id!).filter((id): id is number => typeof id === 'number'),
  )

  let sessionsQ = supabase
    .from('visitor_sessions')
    .select('fub_person_id, identified_email, last_seen_at, engagement_score, peak_score, hot_lead_fired_at, intent_tags, ip_city, utm_source')
    .gte('last_seen_at', since)
    .not('fub_person_id', 'is', null)
    .order('last_seen_at', { ascending: false })
    .limit(1000)
  // No server-side filter on activity — we apply that below across the merged set.
  if (params.q) {
    sessionsQ = sessionsQ.ilike('identified_email', `%${params.q.trim()}%`)
  }
  const { data: sessionsData } = await sessionsQ
  const sessions = (sessionsData ?? []) as SessionRow[]

  // Most-recent session per fub_person_id (sessions are already ordered DESC).
  const latestSessionByPerson = new Map<number, SessionRow>()
  for (const s of sessions) {
    const id = s.fub_person_id
    if (!latestSessionByPerson.has(id)) latestSessionByPerson.set(id, s)
  }

  // 3. Merge: every assignment + any identified session for a person who has
  //    no assignment in the window.
  const merged = new Map<number, PersonRow>()
  for (const a of assignments) {
    if (!a.fub_person_id) continue
    const sess = latestSessionByPerson.get(a.fub_person_id)
    merged.set(a.fub_person_id, {
      fubPersonId: a.fub_person_id,
      identifiedEmail: sess?.identified_email ?? null,
      audience: a.audience,
      broker: a.broker,
      source: a.source,
      tier: a.tier,
      assignedAt: a.assigned_at,
      lastSeenAt: sess?.last_seen_at ?? null,
      peakScore: sess?.peak_score ?? 0,
      hotFiredAt: sess?.hot_lead_fired_at ?? null,
      intentTags: sess?.intent_tags ?? [],
      city: sess?.ip_city ?? null,
      trafficSource: sess?.utm_source ?? null,
    })
  }
  // Add visitor-only people (identified but never assigned in window).
  for (const s of latestSessionByPerson.values()) {
    if (merged.has(s.fub_person_id)) continue
    if (fubIdsFromAssignments.has(s.fub_person_id)) continue
    merged.set(s.fub_person_id, {
      fubPersonId: s.fub_person_id,
      identifiedEmail: s.identified_email,
      audience: null,
      broker: null,
      source: null,
      tier: null,
      assignedAt: null,
      lastSeenAt: s.last_seen_at,
      peakScore: s.peak_score,
      hotFiredAt: s.hot_lead_fired_at,
      intentTags: s.intent_tags ?? [],
      city: s.ip_city,
      trafficSource: s.utm_source,
    })
  }

  // 4. Activity filter (applied client-side across merged set).
  let people = Array.from(merged.values())
  if (params.activity) {
    const now = Date.now()
    if (params.activity === 'hot') {
      people = people.filter((p) => p.hotFiredAt)
    } else if (params.activity === 'active-30m') {
      people = people.filter((p) => p.lastSeenAt && now - new Date(p.lastSeenAt).getTime() <= 30 * 60 * 1000)
    } else if (params.activity === 'recent-24h') {
      people = people.filter((p) => p.lastSeenAt && now - new Date(p.lastSeenAt).getTime() <= 24 * 60 * 60 * 1000)
    } else if (params.activity === 'recent-7d') {
      people = people.filter((p) => p.lastSeenAt && now - new Date(p.lastSeenAt).getTime() <= 7 * 24 * 60 * 60 * 1000)
    }
  }

  // 5. Sort: hot first, then most recent activity, then most recent assignment.
  people.sort((a, b) => {
    if (a.hotFiredAt && !b.hotFiredAt) return -1
    if (!a.hotFiredAt && b.hotFiredAt) return 1
    const aActivity = Math.max(
      a.lastSeenAt ? new Date(a.lastSeenAt).getTime() : 0,
      a.assignedAt ? new Date(a.assignedAt).getTime() : 0,
    )
    const bActivity = Math.max(
      b.lastSeenAt ? new Date(b.lastSeenAt).getTime() : 0,
      b.assignedAt ? new Date(b.assignedAt).getTime() : 0,
    )
    return bActivity - aActivity
  })

  // 6. Summary counts for the facets card.
  const totalPeople = merged.size
  const totalHot = people.filter((p) => p.hotFiredAt).length
  const totalActiveNow = Array.from(merged.values()).filter((p) => p.lastSeenAt && Date.now() - new Date(p.lastSeenAt).getTime() <= 30 * 60 * 1000).length

  // 7. Paginate the (already filtered + sorted) set so the screen never renders
  //    an unbounded wall of rows. Pure presentational slicing — the data
  //    pipeline above is unchanged.
  const matchCount = people.length
  const totalPages = Math.max(1, Math.ceil(matchCount / PAGE_SIZE))
  const currentPage = Math.min(Math.max(1, parseInt(params.page ?? '1', 10) || 1), totalPages)
  const pageStart = (currentPage - 1) * PAGE_SIZE
  const pagePeople = people.slice(pageStart, pageStart + PAGE_SIZE)
  const filtersActive = Boolean(
    params.q || params.audience || params.broker || params.tier || params.source || params.activity,
  )

  const errorBanner = assignmentsError ? (
    <Card>
      <CardContent className="p-4 text-sm text-destructive">Failed to load assignments: {assignmentsError.message}</CardContent>
    </Card>
  ) : null

  return (
    <div className="space-y-6">
      {errorBanner}

      {/* Quick stats */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">People (90d)</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-semibold tabular-nums text-foreground">{formatInt(totalPeople)}</p><p className="mt-1 text-xs text-muted-foreground">unique FUB persons</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Hot (fired)</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-semibold tabular-nums text-destructive">{formatInt(totalHot)}</p><p className="mt-1 text-xs text-muted-foreground">crossed score 100</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Active now</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-semibold tabular-nums text-foreground">{formatInt(totalActiveNow)}</p><p className="mt-1 text-xs text-muted-foreground">seen in last 30 min</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Shown</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-semibold tabular-nums text-foreground">{formatInt(people.length)}</p><p className="mt-1 text-xs text-muted-foreground">after filters</p></CardContent>
        </Card>
      </div>

      {/* Search + filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form className="flex flex-wrap items-end gap-2" method="get">
            {/* Preserve every active filter when submitting the search form,
                but reset pagination (a new search starts on page 1). */}
            {Object.entries(params)
              .filter(([k]) => k !== 'q' && k !== 'page')
              .filter(([, v]) => Boolean(v))
              .map(([k, v]) => (
                <Input key={k} type="hidden" name={k} value={v!} readOnly />
              ))}
            <div className="flex-1 min-w-[200px]">
              <Label htmlFor="q" className="text-xs font-medium text-muted-foreground">Email contains</Label>
              <Input id="q" name="q" defaultValue={params.q ?? ''} placeholder="sarah@example.com" />
            </div>
            <Button type="submit">Search</Button>
            {(params.q || params.audience || params.broker || params.tier || params.source || params.activity) && (
              <Button asChild variant="outline">
                <Link href="/admin/people">Clear all</Link>
              </Button>
            )}
          </form>

          <FacetRow label="Audience" current={params.audience} options={['seller', 'buyer']} paramKey="audience" allParams={params} />
          <FacetRow label="Broker" current={params.broker} options={['matt', 'rebecca', 'paul']} paramKey="broker" allParams={params} />
          <FacetRow label="Tier" current={params.tier} options={['hot', 'warm', 'nurture']} paramKey="tier" allParams={params} />
          <FacetRow label="Source" current={params.source} options={['seller-lp', 'buyer-lp', 'expired-lp', 'contact-form', 'cma-request', 'showings-request', 'fb-ads-seller', 'fb-ads-buyer']} paramKey="source" allParams={params} />
          <FacetRow label="Activity" current={params.activity} options={['hot', 'active-30m', 'recent-24h', 'recent-7d']} paramKey="activity" allParams={params} />
        </CardContent>
      </Card>

      {/* People table */}
      <Card>
        <CardHeader>
          <CardTitle>People ({formatInt(matchCount)})</CardTitle>
          <p className="text-xs text-muted-foreground">
            {matchCount === 0
              ? 'Hot leads first, then most-recent activity. Tap any person for the full profile.'
              : `Showing ${formatInt(pageStart + 1)}–${formatInt(pageStart + pagePeople.length)}. Hot leads first, then most-recent activity. Tap any person for the full profile.`}
          </p>
        </CardHeader>
        <CardContent>
          {matchCount === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <HugeiconsIcon icon={filtersActive ? SearchRemoveIcon : UserMultipleIcon} size={24} strokeWidth={1.5} />
              </span>
              <div className="space-y-1">
                <p className="text-base font-medium text-foreground">
                  {filtersActive ? 'No people match these filters' : 'No people yet'}
                </p>
                <p className="mx-auto max-w-xs text-sm text-muted-foreground">
                  {filtersActive
                    ? 'Try a broader search or clear a filter to widen the results.'
                    : 'People appear here once they are assigned to a broker or identified on the site in the last 90 days.'}
                </p>
              </div>
              {filtersActive ? (
                <Button asChild variant="outline" className="min-h-11">
                  <Link href="/admin/people">Clear all filters</Link>
                </Button>
              ) : null}
            </div>
          ) : (
            <>
              {/* People cards — phones (one thumb-tap per person) */}
              <div className="space-y-2 md:hidden">
                {pagePeople.map((p) => (
                  <Link
                    key={p.fubPersonId}
                    href={`/admin/people/${p.fubPersonId}`}
                    className="block min-h-11 rounded-lg border border-border bg-card p-3 transition-colors hover:bg-muted/50"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        {p.hotFiredAt && <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-destructive" title="Hot lead — score crossed 100" />}
                        <span className="truncate text-sm font-medium text-primary">
                          {p.identifiedEmail ?? `FUB #${p.fubPersonId}`}
                        </span>
                      </div>
                      <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">{formatInt(p.peakScore)}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {p.audience ? <Badge variant="secondary" className="capitalize">{p.audience}</Badge> : null}
                      {p.tier ? <Badge variant={p.tier === 'hot' ? 'destructive' : p.tier === 'warm' ? 'default' : 'outline'} className="capitalize">{p.tier}</Badge> : null}
                      {p.broker ? <span className="text-xs capitalize text-muted-foreground">{p.broker}</span> : null}
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span className="truncate">{p.city ?? '—'}</span>
                      <span className="shrink-0 tabular-nums">{formatRelative(p.lastSeenAt)}</span>
                    </div>
                  </Link>
                ))}
              </div>

              {/* People table — desktop */}
              <div className="hidden overflow-hidden rounded-lg border border-border md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Person</TableHead>
                      <TableHead>Audience</TableHead>
                      <TableHead>Broker</TableHead>
                      <TableHead>Tier</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead className="text-right tabular-nums">Score</TableHead>
                      <TableHead>City</TableHead>
                      <TableHead>Last seen</TableHead>
                      <TableHead>Assigned</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagePeople.map((p) => (
                      <TableRow key={p.fubPersonId}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {p.hotFiredAt && <span className="inline-block h-2 w-2 rounded-full bg-destructive" title="Hot lead — score crossed 100" />}
                            <Link href={`/admin/people/${p.fubPersonId}`} className="font-medium text-primary hover:underline">
                              {p.identifiedEmail ?? `FUB #${p.fubPersonId}`}
                            </Link>
                          </div>
                        </TableCell>
                        <TableCell>
                          {p.audience ? <Badge variant="secondary" className="capitalize">{p.audience}</Badge> : <span className="text-xs text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="text-xs capitalize">{p.broker ?? '—'}</TableCell>
                        <TableCell>
                          {p.tier ? <Badge variant={p.tier === 'hot' ? 'destructive' : p.tier === 'warm' ? 'default' : 'outline'} className="capitalize">{p.tier}</Badge> : <span className="text-xs text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="text-xs">{p.source ?? '—'}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatInt(p.peakScore)}</TableCell>
                        <TableCell className="text-xs">{p.city ?? '—'}</TableCell>
                        <TableCell className="text-xs">{formatRelative(p.lastSeenAt)}</TableCell>
                        <TableCell className="text-xs">{formatRelative(p.assignedAt)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {totalPages > 1 ? (
                <div className="mt-4 flex flex-col items-center gap-2 sm:flex-row sm:justify-between">
                  <p className="text-xs text-muted-foreground tabular-nums">
                    Page {currentPage} of {totalPages}
                  </p>
                  <Pagination className="mx-0 w-auto">
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          href={pageHref(params, Math.max(1, currentPage - 1))}
                          aria-disabled={currentPage <= 1}
                          className={currentPage <= 1 ? 'pointer-events-none opacity-50' : undefined}
                        />
                      </PaginationItem>
                      {pageWindow(currentPage, totalPages).map((p) => (
                        <PaginationItem key={p} className="hidden sm:list-item">
                          <PaginationLink href={pageHref(params, p)} isActive={p === currentPage}>
                            {p}
                          </PaginationLink>
                        </PaginationItem>
                      ))}
                      <PaginationItem>
                        <PaginationNext
                          href={pageHref(params, Math.min(totalPages, currentPage + 1))}
                          aria-disabled={currentPage >= totalPages}
                          className={currentPage >= totalPages ? 'pointer-events-none opacity-50' : undefined}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// A compact window of page numbers around the current page (max 5), so the
// pagination control stays inside 390px without wrapping.
function pageWindow(current: number, total: number): number[] {
  const span = 5
  let start = Math.max(1, current - Math.floor(span / 2))
  const end = Math.min(total, start + span - 1)
  start = Math.max(1, end - span + 1)
  const out: number[] = []
  for (let p = start; p <= end; p++) out.push(p)
  return out
}

function FacetRow({
  label,
  current,
  options,
  paramKey,
  allParams,
}: {
  label: string
  current: string | undefined
  options: string[]
  paramKey: string
  allParams: Record<string, string | undefined>
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-20 shrink-0 text-xs font-medium text-muted-foreground">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => {
          const active = current === opt
          const href = `/admin/people${toggleParam(allParams, paramKey, opt)}`
          return (
            <Button
              key={opt}
              asChild
              size="sm"
              variant={active ? 'default' : 'outline'}
              className="h-8 rounded-full px-3 text-xs"
            >
              <Link href={href} aria-pressed={active}>
                {opt}
              </Link>
            </Button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────

export default async function PeopleIndexPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams
  const params = normalizeParams(sp)

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-foreground">People</h1>
        <p className="text-sm text-muted-foreground">
          Every known FUB person who has been assigned to a broker or identified on the site in the last 90 days. Hot leads bubble to the top. Click any row for the full per-person profile.
        </p>
      </header>

      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <PeopleIndexContent params={params} />
      </Suspense>
    </div>
  )
}
