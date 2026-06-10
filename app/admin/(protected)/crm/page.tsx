// @no-parity — internal admin surface, no public mockup contract
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCrmAccess, getCrmOverview, listCrmPeople, listCrmSavedViews } from '@/app/actions/crm'
import { CRM_STAGES, CRM_BROKERS, CRM_BROKER_DISPLAY } from '@/lib/crm/constants'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'

export const metadata = { title: 'CRM | Admin' }
export const dynamic = 'force-dynamic'

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function primaryContact(items: Array<{ value?: string; isPrimary?: number | boolean }>): string | null {
  if (!items?.length) return null
  const primary = items.find((i) => i.isPrimary)
  return (primary ?? items[0])?.value ?? null
}

type SearchParams = { q?: string; stage?: string; broker?: string; tag?: string; view?: string; page?: string }

export default async function CrmPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const access = await getCrmAccess()
  if (!access) redirect('/admin/access-denied')

  const sp = await searchParams
  const page = Math.max(1, Number(sp.page ?? '1') || 1)

  // Brokers land on THEIR leads by default; '?broker=all' (or the All brokers
  // option in the filter) opens the shared book. Matt (superuser) sees all.
  const defaultBroker = access.role === 'broker' ? access.brokerSlug ?? undefined : undefined
  const effectiveBroker = sp.broker === 'all' ? undefined : sp.broker || defaultBroker
  const isMyLeads = !!access.brokerSlug && effectiveBroker === access.brokerSlug

  const [views, overview, result] = await Promise.all([
    listCrmSavedViews(),
    getCrmOverview(),
    listCrmPeople({ q: sp.q, stage: sp.stage, broker: effectiveBroker, tag: sp.tag, view: sp.view, page }),
  ])

  const { rows, total, pageSize, appliedView } = result
  const lastPage = Math.max(1, Math.ceil(total / pageSize))
  const baseParams = new URLSearchParams()
  for (const [k, v] of Object.entries({ q: sp.q, stage: sp.stage, broker: sp.broker, tag: sp.tag, view: sp.view })) {
    if (v) baseParams.set(k, v)
  }
  const pageHref = (p: number) => {
    const params = new URLSearchParams(baseParams)
    if (p > 1) params.set('page', String(p))
    const qs = params.toString()
    return qs ? `/admin/crm?${qs}` : '/admin/crm'
  }

  const stats: Array<{ label: string; value: string }> = [
    { label: 'Contacts', value: overview.total.toLocaleString('en-US') },
    { label: 'Sellers', value: overview.sellers.toLocaleString('en-US') },
    { label: 'Buyers', value: overview.buyers.toLocaleString('en-US') },
    { label: 'Compliance blocked', value: overview.hardStops.toLocaleString('en-US') },
    { label: 'Open tasks', value: overview.openTasks.toLocaleString('en-US') },
  ]

  return (
    <main className="mx-auto max-w-[1600px] px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">CRM</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isMyLeads ? `Showing your leads (${CRM_BROKER_DISPLAY[access.brokerSlug!]})` : 'Ryan Realty contact database'}
            {' · synced with FUB during the parallel run'}
            {overview.lastDeltaSync ? ` · last sync ${fmtDate(overview.lastDeltaSync)}` : ''}
          </p>
        </div>
        <div className="flex gap-3">
          {stats.map((s) => (
            <Card key={s.label} className="min-w-[120px]">
              <CardContent className="px-4 py-3">
                <div className="text-lg font-semibold tabular-nums text-foreground">{s.value}</div>
                <div className="text-xs text-muted-foreground">{s.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Saved views */}
      <div className="mt-6 flex flex-wrap gap-2">
        {access.brokerSlug ? (
          <>
            <Link href="/admin/crm">
              <Badge variant={isMyLeads && !sp.view && !sp.stage && !sp.tag && !sp.q ? 'default' : 'outline'} className="cursor-pointer px-3 py-1">
                My leads
              </Badge>
            </Link>
            <Link href="/admin/crm?broker=all">
              <Badge variant={sp.broker === 'all' && !sp.view && !sp.stage && !sp.tag && !sp.q ? 'default' : 'outline'} className="cursor-pointer px-3 py-1">
                All contacts
              </Badge>
            </Link>
          </>
        ) : (
          <Link href="/admin/crm">
            <Badge variant={!sp.view && !sp.stage && !sp.tag && !sp.q ? 'default' : 'outline'} className="cursor-pointer px-3 py-1">
              All
            </Badge>
          </Link>
        )}
        {views.map((v) => (
          <Link key={v.id} href={`/admin/crm?view=${v.id}`}>
            <Badge variant={sp.view === String(v.id) ? 'default' : 'outline'} className="cursor-pointer px-3 py-1">
              {v.name}
            </Badge>
          </Link>
        ))}
      </div>

      {/* Filters */}
      <form method="GET" action="/admin/crm" className="mt-4 flex flex-wrap items-center gap-2">
        {sp.view ? <input type="hidden" name="view" value={sp.view} /> : null}
        <Input
          name="q"
          defaultValue={sp.q ?? ''}
          placeholder="Search name, email, or phone"
          className="w-72"
        />
        <select
          name="stage"
          defaultValue={sp.stage ?? ''}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"
        >
          <option value="">All stages</option>
          {CRM_STAGES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select
          name="broker"
          defaultValue={effectiveBroker ?? 'all'}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"
        >
          <option value="all">All brokers</option>
          {CRM_BROKERS.map((b) => (
            <option key={b} value={b}>{CRM_BROKER_DISPLAY[b]}</option>
          ))}
        </select>
        <Button type="submit" size="sm">Apply</Button>
        <Link href="/admin/crm" className="text-sm text-muted-foreground hover:text-foreground">Clear</Link>
        {appliedView ? (
          <span className="text-sm text-muted-foreground">
            View: <span className="font-medium text-foreground">{appliedView.name}</span>
          </span>
        ) : null}
      </form>

      {/* People table */}
      <div className="mt-4 overflow-hidden rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs font-medium uppercase text-muted-foreground">Name</TableHead>
              <TableHead className="text-xs font-medium uppercase text-muted-foreground">Stage</TableHead>
              <TableHead className="text-xs font-medium uppercase text-muted-foreground">Tags</TableHead>
              <TableHead className="text-xs font-medium uppercase text-muted-foreground">Broker</TableHead>
              <TableHead className="text-xs font-medium uppercase text-muted-foreground">Contact</TableHead>
              <TableHead className="text-xs font-medium uppercase text-muted-foreground">Source</TableHead>
              <TableHead className="text-xs font-medium uppercase text-muted-foreground">Last activity</TableHead>
              <TableHead className="text-xs font-medium uppercase text-muted-foreground">Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                  No contacts match this filter.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((p) => {
                const email = primaryContact(p.emails)
                const phone = primaryContact(p.phones)
                return (
                  <TableRow key={p.id}>
                    <TableCell className="text-sm font-medium text-foreground">
                      <Link href={`/admin/crm/${p.id}`} className="hover:underline">
                        {p.name ?? `Contact #${p.id}`}
                      </Link>
                    </TableCell>
                    <TableCell><Badge variant="secondary">{p.stage}</Badge></TableCell>
                    <TableCell className="max-w-[260px]">
                      <div className="flex flex-wrap gap-1">
                        {p.tags.slice(0, 3).map((t) => (
                          <Badge key={t} variant="outline" className="text-[11px]">{t}</Badge>
                        ))}
                        {p.tags.length > 3 ? (
                          <span className="text-xs text-muted-foreground">+{p.tags.length - 3}</span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{p.assigned_broker ?? '—'}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      <div>{email ?? '—'}</div>
                      <div>{phone ?? ''}</div>
                    </TableCell>
                    <TableCell className="max-w-[140px] truncate text-xs text-muted-foreground">{p.source ?? '—'}</TableCell>
                    <TableCell className="text-xs tabular-nums text-muted-foreground">{fmtDate(p.last_activity_at)}</TableCell>
                    <TableCell className="text-xs tabular-nums text-muted-foreground">{fmtDate(p.fub_created_at)}</TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
        <span className="tabular-nums">
          {total === 0 ? '0' : `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)}`} of {total.toLocaleString('en-US')}
        </span>
        <div className="flex gap-2">
          {page > 1 ? (
            <Link href={pageHref(page - 1)}><Button variant="outline" size="sm">Previous</Button></Link>
          ) : null}
          {page < lastPage ? (
            <Link href={pageHref(page + 1)}><Button variant="outline" size="sm">Next</Button></Link>
          ) : null}
        </div>
      </div>
    </main>
  )
}
