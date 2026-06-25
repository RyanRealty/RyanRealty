// @no-parity — internal admin surface, no public mockup contract
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCrmAccess, getCrmOverview, listBrokerLicenses, listCrmPeople, listCrmSavedViews, listCrmSequences } from '@/app/actions/crm'
import { scopeBroker } from '@/lib/crm/scope'
import { CRM_STAGES, CRM_BROKERS, CRM_BROKER_DISPLAY } from '@/lib/crm/constants'
import { getCrmStages } from '@/lib/data/crm/getCrmStages'
import { getCrmTags } from '@/lib/data/crm/getCrmTags'
import { getCrmReportAreas } from '@/lib/data/crm/getCrmReportAreas'
import { getCrmTemplatesAdmin } from '@/lib/data/crm/getCrmTemplatesAdmin'
import { Badge } from '@/components/ui/badge'
import ContactsSearch from '@/components/admin/crm/ContactsSearch'
import BulkAssignWrapper, { type BulkAssignRow } from '@/components/admin/crm/BulkAssignWrapper'
import { Button } from '@/components/ui/button'
import { KpiStrip } from '@/components/console/KpiStrip'
import { formatDate } from '@/lib/format/date'

export const metadata = { title: 'Contacts | Admin' }
export const dynamic = 'force-dynamic'

function fmtDate(iso: string | null): string {
  return formatDate(iso)
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

  // GAP-1: the broker-RBAC scope (Option A). A superuser (Matt) → null = sees all
  // brokers; a restricted broker (Rebecca, Paul) → their own slug. This clamps the
  // '?broker=all' override server-side: only a superuser may drop the filter.
  const scope = scopeBroker(access)

  // Brokers land on THEIR leads by default; '?broker=all' (or the All brokers
  // option in the filter) opens the shared book — but ONLY for a superuser. A
  // restricted broker passing ?broker=all (or any other slug) falls back to their
  // own scope and can never widen past it.
  const requestedBroker = sp.broker === 'all' ? undefined : sp.broker || undefined
  const effectiveBroker = scope ?? requestedBroker
  const isMyLeads = !!access.brokerSlug && effectiveBroker === access.brokerSlug

  const [views, overview, result, licenses, stageRows, tagRows, areaRows, templateRows, sequenceRows] = await Promise.all([
    listCrmSavedViews(),
    getCrmOverview(scope),
    listCrmPeople({ q: sp.q, stage: sp.stage, broker: effectiveBroker, tag: sp.tag, view: sp.view, page }),
    listBrokerLicenses(),
    getCrmStages(),
    getCrmTags(),
    getCrmReportAreas(),
    getCrmTemplatesAdmin(),
    listCrmSequences(),
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

  // Flatten the fetched rows for the selectable client list (selection state
  // lives in BulkAssignWrapper). Date/contact formatting stays on the server.
  const bulkRows: BulkAssignRow[] = rows.map((p) => ({
    id: p.id,
    name: p.name,
    stage: p.stage,
    source: p.source,
    picture_url: p.picture_url,
    email: primaryContact(p.emails),
    phone: primaryContact(p.phones),
    tags: p.tags,
    assigned_broker: p.assigned_broker,
    last_activity_label: fmtDate(p.last_activity_at),
    created_label: fmtDate(p.fub_created_at),
  }))

  // Bulk-action props. The active list filter (carried to "select all matching"
  // so the bulk job resolves the whole filtered book server-side, not just the
  // 50-row page). matchingTotal is the server count already computed above.
  const activeFilters = {
    q: sp.q || undefined,
    stage: sp.stage || undefined,
    broker: effectiveBroker || undefined,
    tagsAny: sp.tag ? [sp.tag] : undefined,
  }
  const matchingTotal = total
  // Reassign is an owner op (mirrors assignCrmBrokerAction) — superuser only.
  const canAssignBroker = access.role === 'superuser'

  // Pickers — active rows only; fall back to the stage const if the config table
  // is empty so the stage picker is never blank.
  const stagePicker = stageRows.filter((s) => s.isActive).map((s) => ({ key: s.key, label: s.label }))
  const stageOptions = stagePicker.length > 0 ? stagePicker : CRM_STAGES.map((s) => ({ key: s, label: s }))
  // Bulk tag-add/remove never offers protected (compliance / broker) tags.
  const tagOptions = tagRows
    .filter((t) => t.isActive && !t.isProtected)
    .map((t) => ({ key: t.key, label: t.label }))
  const areaOptions = areaRows.filter((a) => a.isActive).map((a) => ({ key: a.key, label: a.label }))
  const templateOptions = templateRows
    .filter((t) => t.isActive)
    .map((t) => ({ id: t.id, name: t.name, channel: t.channel }))
  const sequenceOptions = sequenceRows
    .filter((s) => s.status === 'active')
    .map((s) => ({ id: s.id, name: s.name }))
  const brokerOptions = CRM_BROKERS.map((b) => ({ key: b, label: CRM_BROKER_DISPLAY[b] }))

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

      {/* Stat / KPI strip */}
      <div className="mt-4">
        <KpiStrip items={stats} />
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

      {/* Selectable contacts list + sticky bulk-action bar (client island) */}
      <BulkAssignWrapper
        rows={bulkRows}
        activeFilters={activeFilters}
        matchingTotal={matchingTotal}
        canAssignBroker={canAssignBroker}
        brokers={brokerOptions}
        stages={stageOptions}
        tags={tagOptions}
        reportAreas={areaOptions}
        emailTemplates={templateOptions}
        sequences={sequenceOptions}
      />

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
