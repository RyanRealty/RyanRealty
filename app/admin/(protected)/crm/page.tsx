// @no-parity — internal admin surface, no public mockup contract
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCrmAccess, getCrmOverview, listBrokerLicenses, listCrmPeople, listCrmSavedViews } from '@/app/actions/crm'
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
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">CRM</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isMyLeads ? `Showing your leads (${CRM_BROKER_DISPLAY[access.brokerSlug!]})` : 'Ryan Realty contact database'}
            {' · synced with FUB during the parallel run'}
            {overview.lastDeltaSync ? ` · last sync ${fmtDate(overview.lastDeltaSync)}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/admin/crm/new"><Button size="sm">New contact</Button></Link>
          <Link href="/admin/crm/tasks"><Button variant="outline" size="sm">Tasks</Button></Link>
          <Link href="/admin/crm/inbox"><Button variant="outline" size="sm">Inbox</Button></Link>
          <Link href="/admin/crm/deals"><Button variant="outline" size="sm">Pipeline</Button></Link>
          <Link href="/admin/crm/sequences"><Button variant="outline" size="sm">Sequences</Button></Link>
          <Link href="/admin/crm/approvals"><Button variant="outline" size="sm">Approvals</Button></Link>
          <Link href="/admin/crm/workflows"><Button variant="outline" size="sm">Workflows</Button></Link>
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

      {/* Licenses & renewals — every broker always sees their license state */}
      {visibleLicenses.length > 0 ? (
        <div className="mt-6 grid gap-3 md:grid-cols-3">
          {visibleLicenses.map((l) => {
            const dl = daysLeft(l.license_expires_on)
            const urgency = dl === null ? 'secondary' : dl < 60 ? 'destructive' : dl < 180 ? 'default' : 'secondary'
            return (
              <Card key={l.slug}>
                <CardContent className="px-4 py-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-foreground">{l.display_name}</span>
                    <Badge variant={l.license_status === 'ACTIVE' ? 'secondary' : 'destructive'} className="text-xs">
                      {l.license_status ?? 'unknown'}
                    </Badge>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {l.license_type ?? 'License'} #{l.license_number ?? '?'}
                    {l.nrds_id ? <> · NRDS {l.nrds_id}</> : <> · NRDS pending</>}
                  </div>
                  <div className="mt-1.5 flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground">Renews by</span>
                    <Badge variant={urgency} className="tabular-nums text-xs">
                      {l.license_expires_on ?? '?'}{dl !== null ? ` · ${dl} days` : ''}
                    </Badge>
                    <a
                      href="https://orea.elicense.micropact.com"
                      target="_blank"
                      rel="noreferrer"
                      className="text-muted-foreground underline hover:text-foreground"
                    >
                      Renew at eLicense
                    </a>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    30 CE hours incl. LARRC, then renew in eLicense ($300). Renewal events are on your calendar.
                  </p>
                </CardContent>
              </Card>
            )
          })}
        </div>
      ) : null}

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
                      <Badge variant="secondary" className="shrink-0">{p.stage}</Badge>
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
                    <Button asChild size="sm" variant="outline" className="shrink-0">
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
