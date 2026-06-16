// @no-parity — internal admin surface, no public mockup contract
import Link from 'next/link'
import { Users } from 'lucide-react'
import { listCrmPeople, getCrmAccess, getCrmStageCounts, getCrmSavedViewsWithCounts, type CrmPersonRow } from '@/app/actions/crm'
import { fetchLiveVisitors } from '../../(protected)/visitors/_lib/queries'
import { CRM_STAGES } from '@/lib/crm/constants'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { StagePill } from '@/components/console/StatusPill'
import { cn } from '@/lib/utils'

/** Live engagement for one lead, resolved from active visitor sessions. */
type LeadPulse = { score: number; intent: string | null; hot: boolean }

export const metadata = { title: 'Leads · Console' }
export const dynamic = 'force-dynamic'

function fmtAgo(iso: string | null): string {
  if (!iso) return '—'
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return '—'
  const mins = Math.round((Date.now() - t) / 60000)
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.round(hrs / 24)
  if (days < 30) return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/Los_Angeles' })
}

function primaryEmail(p: CrmPersonRow): string | null {
  return p.emails?.find((e) => e.isPrimary)?.value ?? p.emails?.[0]?.value ?? null
}

/** Compact pipeline count for a stage chip: 7523 -> "7.5k", 850 -> "850". */
function fmtCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`
  return String(n)
}

/** Live-engagement chip: a hot lead glows; a warm one shows its score; everyone
 *  else falls back to the quiet "last activity" timestamp. */
function ActivityCell({ pulse, lastActivity }: { pulse: LeadPulse | null; lastActivity: string }) {
  if (!pulse) return <span className="tabular-nums text-muted-foreground">{lastActivity}</span>
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={cn(
          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums',
          pulse.hot ? 'bg-destructive/10 text-destructive' : 'bg-accent text-accent-foreground',
        )}
      >
        {pulse.hot ? 'Hot' : 'Active'} · {pulse.score}
      </span>
      {pulse.intent ? <span className="hidden text-xs text-muted-foreground lg:inline">{pulse.intent}</span> : null}
    </span>
  )
}

export default async function ConsoleLeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; stage?: string; page?: string; view?: string; lists?: string }>
}) {
  const sp = await searchParams
  const access = await getCrmAccess()
  const page = Math.max(1, Number(sp.page) || 1)
  const result = await listCrmPeople({
    q: sp.q,
    stage: sp.stage,
    view: sp.view,
    broker: access?.brokerSlug ?? undefined,
    page,
  })
  const people = result.rows
  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize))
  // People segments: Stages (stage chips + counts) and All Lists (saved views +
  // counts). FUB-parity #3. listsMode shows the saved-view chips.
  const listsMode = Boolean(sp.lists || sp.view)
  const [stageCounts, savedViews] = await Promise.all([
    getCrmStageCounts(access?.brokerSlug),
    getCrmSavedViewsWithCounts(access?.brokerSlug),
  ])
  const activeViewId = sp.view ? Number(sp.view) : null

  // Live engagement: join active visitor sessions to the leads on this page by
  // fub_person_id (which holds crm_people.fub_legacy_id, NOT crm_people.id), so
  // a broker sees who is hot right now instead of a uniform "Last activity".
  const liveSessions = await fetchLiveVisitors({}).catch(() => [])
  const pulseByFubId = new Map<number, LeadPulse>()
  for (const s of liveSessions) {
    if (!s.fub_person_id) continue
    const prev = pulseByFubId.get(s.fub_person_id)
    if (prev && prev.score >= s.engagement_score) continue
    pulseByFubId.set(s.fub_person_id, {
      score: s.engagement_score,
      intent: s.intent_tags?.[0] ?? null,
      hot: Boolean(s.hot_lead_fired_at) || s.engagement_score >= 100,
    })
  }
  const pulseFor = (p: CrmPersonRow): LeadPulse | null =>
    p.fub_legacy_id != null ? pulseByFubId.get(p.fub_legacy_id) ?? null : null

  // Our edge over FUB: a live "recent online activity" list — identified people
  // with an active session right now. Links to the live-visitor surface.
  const onlineNow = new Set(liveSessions.filter((s) => s.fub_person_id).map((s) => s.fub_person_id)).size

  const qs = (over: Record<string, string | number | undefined>) => {
    const next = new URLSearchParams()
    const merged = { q: sp.q, stage: sp.stage, view: sp.view, lists: sp.lists, page, ...over }
    for (const [k, v] of Object.entries(merged)) {
      if (v !== undefined && v !== '' && !(k === 'page' && v === 1)) next.set(k, String(v))
    }
    const s = next.toString()
    return s ? `?${s}` : ''
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Leads</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            <span className="tabular-nums">{result.total.toLocaleString('en-US')}</span> {access?.brokerSlug ? 'in your book' : 'across all brokers'}
          </p>
        </div>
      </div>

      {/* Search + stage filter */}
      <Card>
        <CardContent className="space-y-3 p-3 sm:p-4">
          <form action="/admin/console/leads" method="GET" className="flex flex-col gap-2 sm:flex-row">
            {sp.stage ? <Input type="hidden" name="stage" value={sp.stage} readOnly /> : null}
            <Input name="q" defaultValue={sp.q ?? ''} placeholder="Name, email, or phone" className="h-10 flex-1 text-sm" aria-label="Search leads" />
            <Button type="submit" variant="outline" className="h-10 sm:w-28">Search</Button>
          </form>
          {/* Segment toggle: Stages / All lists */}
          <div className="flex gap-1.5">
            <Link href={qs({ lists: undefined, view: undefined, stage: undefined, page: 1 })} className={cn('rounded-full px-3 py-1 text-xs font-semibold', !listsMode ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}>
              Stages
            </Link>
            <Link href={qs({ lists: '1', view: undefined, stage: undefined, page: 1 })} className={cn('rounded-full px-3 py-1 text-xs font-semibold', listsMode ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}>
              All lists
            </Link>
          </div>

          {/* Chips: saved-view lists, or stage buckets, each with a live count */}
          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
            {listsMode ? (
              <>
                {/* Live edge: people active on the site right now */}
                <Link href="/admin/visitors/live" className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-success/30 bg-success/10 px-3 py-1.5 text-xs font-medium text-success hover:bg-success/15">
                  <span className="relative flex h-1.5 w-1.5">
                    {onlineNow > 0 ? <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" /> : null}
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
                  </span>
                  Online now
                  <span className="tabular-nums">{onlineNow}</span>
                </Link>
                {savedViews.map((v) => (
                <Link key={v.id} href={qs({ view: String(v.id), stage: undefined, lists: undefined, page: 1 })} className={cn('inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium', activeViewId === v.id ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-accent')}>
                  {v.name}
                  <span className={cn('tabular-nums', activeViewId === v.id ? 'text-primary-foreground/80' : 'text-muted-foreground')}>{fmtCount(v.count)}</span>
                </Link>
                ))}
              </>
            ) : (
              <>
                <Link href={qs({ stage: undefined, page: 1 })} className={cn('inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium', !sp.stage ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-accent')}>
                  All
                  <span className={cn('tabular-nums', !sp.stage ? 'text-primary-foreground/80' : 'text-muted-foreground')}>{fmtCount(result.total)}</span>
                </Link>
                {CRM_STAGES.map((s) => (
                  <Link key={s} href={qs({ stage: s, page: 1 })} className={cn('inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium', sp.stage === s ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-accent')}>
                    {s}
                    {stageCounts[s] ? <span className={cn('tabular-nums', sp.stage === s ? 'text-primary-foreground/80' : 'text-muted-foreground')}>{fmtCount(stageCounts[s])}</span> : null}
                  </Link>
                ))}
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {people.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 p-10 text-center">
            <Users className="h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm font-medium text-foreground">
              {sp.q ? 'No leads match your search.' : listsMode ? 'This list is empty.' : sp.stage ? `No leads in ${sp.stage}.` : 'No leads here yet.'}
            </p>
            <p className="text-sm text-muted-foreground">
              {sp.q ? 'Try a different name, email, or phone.' : listsMode ? 'Pick another list, or switch to Stages.' : 'Clear the filter to see your whole book.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Mobile: cards */}
          <div className="space-y-2 md:hidden">
            {people.map((p) => (
              <Link key={p.id} href={`/admin/console/leads/${p.id}`} className="block">
                <Card className="transition-colors hover:bg-accent/40">
                  <CardContent className="flex items-center justify-between gap-3 p-3.5">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-foreground">{p.name ?? `Contact #${p.id}`}</div>
                      <div className="mt-0.5 truncate text-xs text-muted-foreground">{primaryEmail(p) ?? p.source ?? 'No contact info'}</div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <StagePill stage={p.stage} />
                      <span className="text-[11px]"><ActivityCell pulse={pulseFor(p)} lastActivity={fmtAgo(p.last_activity_at)} /></span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>

          {/* Desktop: table */}
          <Card className="hidden overflow-hidden md:block">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Name</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Last activity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {people.map((p) => (
                  <TableRow key={p.id} className="hover:bg-accent/40">
                    <TableCell>
                      <Link href={`/admin/console/leads/${p.id}`} className="block">
                        <div className="font-medium text-foreground">{p.name ?? `Contact #${p.id}`}</div>
                        <div className="text-xs text-muted-foreground">{primaryEmail(p) ?? '—'}</div>
                      </Link>
                    </TableCell>
                    <TableCell><StagePill stage={p.stage} /></TableCell>
                    <TableCell className="text-muted-foreground">{p.source ?? '—'}</TableCell>
                    <TableCell><ActivityCell pulse={pulseFor(p)} lastActivity={fmtAgo(p.last_activity_at)} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          {totalPages > 1 ? (
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Page <span className="tabular-nums">{page}</span> of <span className="tabular-nums">{totalPages}</span></span>
              <div className="flex gap-2">
                {page > 1 ? <Button asChild variant="outline" size="sm"><Link href={qs({ page: page - 1 })}>Previous</Link></Button> : null}
                {page < totalPages ? <Button asChild variant="outline" size="sm"><Link href={qs({ page: page + 1 })}>Next</Link></Button> : null}
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}
