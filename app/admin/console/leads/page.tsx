// @no-parity — internal admin surface, no public mockup contract
import Link from 'next/link'
import { listCrmPeople, getCrmAccess, type CrmPersonRow } from '@/app/actions/crm'
import { CRM_STAGES } from '@/lib/crm/constants'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { StagePill } from '@/components/console/StatusPill'
import { cn } from '@/lib/utils'

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

export default async function ConsoleLeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; stage?: string; page?: string }>
}) {
  const sp = await searchParams
  const access = await getCrmAccess()
  const page = Math.max(1, Number(sp.page) || 1)
  const result = await listCrmPeople({
    q: sp.q,
    stage: sp.stage,
    broker: access?.brokerSlug ?? undefined,
    page,
  })
  const people = result.rows
  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize))

  const qs = (over: Record<string, string | number | undefined>) => {
    const next = new URLSearchParams()
    const merged = { q: sp.q, stage: sp.stage, page, ...over }
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
          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
            <Link href={qs({ stage: undefined, page: 1 })} className={cn('shrink-0 rounded-full px-3 py-1.5 text-xs font-medium', !sp.stage ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-accent')}>
              All
            </Link>
            {CRM_STAGES.map((s) => (
              <Link key={s} href={qs({ stage: s, page: 1 })} className={cn('shrink-0 rounded-full px-3 py-1.5 text-xs font-medium', sp.stage === s ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-accent')}>
                {s}
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      {people.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center">
            <p className="text-sm font-medium text-foreground">No leads match.</p>
            <p className="mt-1 text-sm text-muted-foreground">Try a different search or clear the stage filter.</p>
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
                      <span className="text-[11px] tabular-nums text-muted-foreground">{fmtAgo(p.last_activity_at)}</span>
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
                    <TableCell className="tabular-nums text-muted-foreground">{fmtAgo(p.last_activity_at)}</TableCell>
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
