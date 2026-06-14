// @no-parity — internal admin surface, no public mockup contract
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCrmAccess, getCrmOverview, listBrokerLicenses, listCrmPeople, listCrmSavedViews } from '@/app/actions/crm'
import { CRM_STAGES, CRM_BROKERS, CRM_BROKER_DISPLAY } from '@/lib/crm/constants'
import { Badge } from '@/components/ui/badge'
import ContactsSearch from '@/components/admin/crm/ContactsSearch'
import StageBadge from '@/components/admin/crm/StageBadge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'

export const metadata = { title: 'Contacts | Admin' }
export const dynamic = 'force-dynamic'

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtPhone(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(-10)
  if (d.length !== 10) return raw
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`
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

  const [views, overview, result, licenses] = await Promise.all([
    listCrmSavedViews(),
    getCrmOverview(),
    listCrmPeople({ q: sp.q, stage: sp.stage, broker: effectiveBroker, tag: sp.tag, view: sp.view, page }),
    listBrokerLicenses(),
  ])

  // broker sees their own license; Matt (superuser) sees the whole roster
  const SLUG_MAP: Record<string, string> = { 'matthew-ryan': 'matt', 'rebecca-peterson': 'rebecca', 'paul-stevenson': 'paul' }
  const visibleLicenses = access.role === 'superuser'
    ? licenses
    : licenses.filter((l) => SLUG_MAP[l.slug] === access.brokerSlug)
  const daysLeft = (iso: string | null) => iso ? Math.ceil((new Date(iso).getTime() - Date.now()) / 86400e3) : null

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
      {/* Title + primary action — primary action stays prominent on phones */}
      <div className="flex flex-wrap items-start justify-between gap-3 md:items-end">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-foreground">Contacts</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isMyLeads ? `Showing your leads (${CRM_BROKER_DISPLAY[access.brokerSlug!]})` : 'Ryan Realty contact database'}
            {' · synced with FUB during the parallel run'}
            {overview.lastDeltaSync ? ` · last sync ${fmtDate(overview.lastDeltaSync)}` : ''}
          </p>
        </div>
        <Link href="/admin/crm/new" className="shrink-0">
          <Button size="sm" className="h-10 md:h-7">New contact</Button>
        </Link>
      </div>

      {/* Secondary nav — single horizontal-scroll strip on phones (no ragged wrap) */}
      <nav className="mt-4 -mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:flex-wrap sm:px-0">
        <Link href="/admin/crm/tasks" className="shrink-0"><Button variant="outline" size="sm" className="h-10 md:h-7">Tasks</Button></Link>
        <Link href="/admin/crm/inbox" className="shrink-0"><Button variant="outline" size="sm" className="h-10 md:h-7">Inbox</Button></Link>
        <Link href="/admin/crm/deals" className="shrink-0"><Button variant="outline" size="sm" className="h-10 md:h-7">Pipeline</Button></Link>
        <Link href="/admin/crm/sequences" className="shrink-0"><Button variant="outline" size="sm" className="h-10 md:h-7">Sequences</Button></Link>
        <Link href="/admin/crm/approvals" className="shrink-0"><Button variant="outline" size="sm" className="h-10 md:h-7">Approvals</Button></Link>
        <Link href="/admin/crm/workflows" className="shrink-0"><Button variant="outline" size="sm" className="h-10 md:h-7">Workflows</Button></Link>
      </nav>

      {/* Stat / KPI cards — their own responsive grid, not mixed into the nav row */}
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="px-4 py-3">
              <div className="text-lg font-semibold tabular-nums text-foreground">{s.value}</div>
              <div className="text-xs text-muted-foreground">{s.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>


      {/* Saved views — horizontal-scroll strip on phones, wraps on desktop */}
      <div className="mt-6 -mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:flex-wrap sm:px-0">
        {access.brokerSlug ? (
          <>
            <Link href="/admin/crm" className="shrink-0">
              <Badge variant={isMyLeads && !sp.view && !sp.stage && !sp.tag && !sp.q ? 'default' : 'outline'} className="cursor-pointer px-3 py-1.5">
                My leads
              </Badge>
            </Link>
            <Link href="/admin/crm?broker=all" className="shrink-0">
              <Badge variant={sp.broker === 'all' && !sp.view && !sp.stage && !sp.tag && !sp.q ? 'default' : 'outline'} className="cursor-pointer px-3 py-1.5">
                All contacts
              </Badge>
            </Link>
          </>
        ) : (
          <Link href="/admin/crm" className="shrink-0">
            <Badge variant={!sp.view && !sp.stage && !sp.tag && !sp.q ? 'default' : 'outline'} className="cursor-pointer px-3 py-1.5">
              All
            </Badge>
          </Link>
        )}
        {views.map((v) => (
          <Link key={v.id} href={`/admin/crm?view=${v.id}`} className="shrink-0">
            <Badge variant={sp.view === String(v.id) ? 'default' : 'outline'} className="cursor-pointer px-3 py-1.5">
              {v.name}
            </Badge>
          </Link>
        ))}
      </div>

      {/* Search — filters live as you type */}
      <div className="mt-4">
        <ContactsSearch initial={sp.q ?? ''} />
      </div>

      {/* Filters — full-width selects stack on phones, inline on desktop */}
      <form method="GET" action="/admin/crm" className="mt-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        {sp.view ? <input type="hidden" name="view" value={sp.view} /> : null}
        {sp.q ? <input type="hidden" name="q" value={sp.q} /> : null}
        <select
          name="stage"
          defaultValue={sp.stage ?? ''}
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground sm:h-9 sm:w-auto"
        >
          <option value="">All stages</option>
          {CRM_STAGES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select
          name="broker"
          defaultValue={effectiveBroker ?? 'all'}
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground sm:h-9 sm:w-auto"
        >
          <option value="all">All brokers</option>
          {CRM_BROKERS.map((b) => (
            <option key={b} value={b}>{CRM_BROKER_DISPLAY[b]}</option>
          ))}
        </select>
        <div className="flex items-center gap-3">
          <Button type="submit" size="sm" className="h-10 sm:h-7">Apply</Button>
          <Link href="/admin/crm" className="flex h-10 items-center text-sm text-muted-foreground hover:text-foreground sm:h-7">Clear</Link>
          {appliedView ? (
            <span className="text-sm text-muted-foreground">
              View: <span className="font-medium text-foreground">{appliedView.name}</span>
            </span>
          ) : null}
        </div>
      </form>

      {/* People cards — phones (one thumb-tap per contact) */}
      <div className="mt-4 space-y-2 md:hidden">
        {rows.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">No contacts match this filter.</CardContent>
          </Card>
        ) : (
          rows.map((p) => {
            const email = primaryContact(p.emails)
            const phone = primaryContact(p.phones)
            return (
              <Card key={p.id} className="transition-colors hover:bg-muted/50">
                <CardContent className="flex items-center gap-3 p-4">
                  {p.picture_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.picture_url} alt="" className="h-10 w-10 shrink-0 rounded-full border border-border object-cover" referrerPolicy="no-referrer" loading="lazy" />
                  ) : (
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold text-muted-foreground">
                      {(p.name ?? '?').charAt(0).toUpperCase()}
                    </span>
                  )}
                  <Link href={`/admin/crm/${p.id}`} className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold text-foreground">{p.name ?? `Contact #${p.id}`}</span>
                      <StageBadge stage={p.stage} className="shrink-0" />
                    </div>
                    <div className="mt-1 truncate text-xs text-muted-foreground">
                      {[email, phone ? fmtPhone(phone) : null].filter(Boolean).join(' · ') || 'No contact info'}
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span className="truncate">{p.source ?? ''}</span>
                      <span className="shrink-0 tabular-nums">{fmtDate(p.last_activity_at)}</span>
                    </div>
                  </Link>
                  {phone ? (
                    <Button asChild size="sm" variant="outline" className="h-10 shrink-0 px-4">
                      <a href={`tel:+1${phone.replace(/\D/g, '').slice(-10)}`} aria-label={`Call ${p.name ?? 'contact'}`}>Call</a>
                    </Button>
                  ) : null}
                </CardContent>
              </Card>
            )
          })
        )}
      </div>

      {/* People table — desktop */}
      <div className="mt-4 hidden overflow-hidden rounded-lg border border-border bg-card md:block">
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
                      <Link href={`/admin/crm/${p.id}`} className="flex items-center gap-2.5 hover:underline">
                        {p.picture_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.picture_url} alt="" className="h-8 w-8 shrink-0 rounded-full border border-border object-cover" referrerPolicy="no-referrer" loading="lazy" />
                        ) : (
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                            {(p.name ?? '?').charAt(0).toUpperCase()}
                          </span>
                        )}
                        {p.name ?? `Contact #${p.id}`}
                      </Link>
                    </TableCell>
                    <TableCell><StageBadge stage={p.stage} /></TableCell>
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
            <Link href={pageHref(page - 1)}><Button variant="outline" size="sm" className="h-10 px-4 md:h-7 md:px-2.5">Previous</Button></Link>
          ) : null}
          {page < lastPage ? (
            <Link href={pageHref(page + 1)}><Button variant="outline" size="sm" className="h-10 px-4 md:h-7 md:px-2.5">Next</Button></Link>
          ) : null}
        </div>
      </div>
    </main>
  )
}
