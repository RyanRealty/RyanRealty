// @no-parity — internal admin surface, no public mockup contract
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCrmAccess, getCrmOverview, listBrokerLicenses, listCrmPeople, listCrmSequences } from '@/app/actions/crm'
import { getCrmSavedViews } from '@/lib/data/crm/getCrmSavedViews'
import { scopeBroker } from '@/lib/crm/scope'
import { CRM_STAGES, CRM_BROKERS, CRM_BROKER_DISPLAY } from '@/lib/crm/constants'
import { getCrmStages } from '@/lib/data/crm/getCrmStages'
import { getCrmTags } from '@/lib/data/crm/getCrmTags'
import { getCrmReportAreas } from '@/lib/data/crm/getCrmReportAreas'
import { getCrmTemplatesAdmin } from '@/lib/data/crm/getCrmTemplatesAdmin'
import { Badge } from '@/components/ui/badge'
import ContactsSearch from '@/components/admin/crm/ContactsSearch'
import BulkAssignWrapper, { type BulkAssignRow } from '@/components/admin/crm/BulkAssignWrapper'
import SavedViewSidebar, { type SavedViewItem } from '@/components/admin/crm/SavedViewSidebar'
import BrokerScopeSheet from '@/components/admin/crm/BrokerScopeSheet'
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

/** Broker slug → web headshot (transparent PNG mirror in public/images/brokers). */
const BROKER_HEADSHOT: Record<string, string> = {
  matt: '/images/brokers/ryan-matt.png',
  rebecca: '/images/brokers/peterson-rebecca.png',
  paul: '/images/brokers/stevenson-paul.png',
}

type SearchParams = { q?: string; stage?: string; broker?: string; tag?: string; view?: string; page?: string }

export default async function CrmPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const access = await getCrmAccess()
  if (!access) redirect('/admin/access-denied')

  const sp = await searchParams
  const page = Math.max(1, Number(sp.page ?? '1') || 1)

  // GAP-1: the broker-RBAC scope (Option A). A superuser (Matt) → null = sees all
  // brokers; a restricted broker (Rebecca, Paul) → their own slug. Used here to
  // shape the UI (which broker the filter defaults to, the My-leads label). The
  // ACTUAL enforcement lives in listCrmPeople itself, which self-scopes — so a
  // restricted broker is constrained regardless of what this page passes.
  const scope = scopeBroker(access)

  // Brokers land on THEIR leads by default; '?broker=all' (or the All brokers
  // option in the filter) opens the shared book — but ONLY for a superuser. A
  // restricted broker passing ?broker=all (or any other slug) falls back to their
  // own scope and can never widen past it.
  const requestedBroker = sp.broker === 'all' ? undefined : sp.broker || undefined
  const effectiveBroker = scope ?? requestedBroker
  const isMyLeads = !!access.brokerSlug && effectiveBroker === access.brokerSlug

  const [views, overview, result, licenses, stageRows, tagRows, areaRows, templateRows, sequenceRows] = await Promise.all([
    getCrmSavedViews(access),
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

  // The active saved view (from ?view=). When set, the bulk bar's "whole view"
  // scope targets it as an audience via the audience bus ({ mode: 'view', viewId }).
  const activeViewId = sp.view ? Number(sp.view) || null : null
  // The views the caller may see (system / own / shared), each with a live scoped
  // count, handed to the sidebar. Strip the server-only annotations down to what
  // the client island needs.
  const savedViewItems: SavedViewItem[] = views.map((v) => ({
    id: v.id,
    name: v.name,
    description: v.description,
    ast: v.ast,
    isShared: v.isShared,
    isProtected: v.isProtected,
    isSystem: v.isSystem,
    isOwn: v.isOwn,
    count: v.count,
  }))
  // "Save current filter" is only meaningful when a filter is actually applied.
  const hasActiveFilter = Boolean(activeFilters.q || activeFilters.stage || activeFilters.broker || (activeFilters.tagsAny?.length))

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
    <main className="mx-auto max-w-[1600px] px-4 pb-8 pt-2 sm:px-6 sm:py-8">
      {/* Title + primary action. On phones FUB keeps this minimal — a compact title,
          no console description, no New-contact button (the global "+" FAB covers it). */}
      <div className="flex flex-wrap items-start justify-between gap-3 md:items-end">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-foreground md:text-2xl">Contacts</h1>
          <p className="mt-1 hidden text-sm text-muted-foreground md:block">
            {isMyLeads ? `Showing your leads (${CRM_BROKER_DISPLAY[access.brokerSlug!]})` : 'Ryan Realty contact database'}
            {' · synced with FUB during the parallel run'}
            {overview.lastDeltaSync ? ` · last sync ${fmtDate(overview.lastDeltaSync)}` : ''}
          </p>
        </div>
        <Link href="/admin/crm/new" className="hidden shrink-0 md:block">
          <Button size="sm" className="h-10 md:h-7">New contact</Button>
        </Link>
      </div>

      {/* Secondary nav — fully retired: the top nav (CRM/Deals dropdowns) + the
          mobile bottom tab bar cover every destination now (FUB-faithful). */}
      <nav className="hidden">
        <Link href="/admin/crm/tasks" className="shrink-0"><Button variant="outline" size="sm" className="h-10 md:h-7">Tasks</Button></Link>
        <Link href="/admin/crm/inbox" className="shrink-0"><Button variant="outline" size="sm" className="h-10 md:h-7">Inbox</Button></Link>
        <Link href="/admin/crm/deals" className="shrink-0"><Button variant="outline" size="sm" className="h-10 md:h-7">Pipeline</Button></Link>
        <Link href="/admin/crm/sequences" className="shrink-0"><Button variant="outline" size="sm" className="h-10 md:h-7">Sequences</Button></Link>
        <Link href="/admin/crm/approvals" className="shrink-0"><Button variant="outline" size="sm" className="h-10 md:h-7">Approvals</Button></Link>
        <Link href="/admin/crm/workflows" className="shrink-0"><Button variant="outline" size="sm" className="h-10 md:h-7">Workflows</Button></Link>
      </nav>

      {/* KPI tiles retired from People — FUB's People list leads with the list, not
          tiles (the metrics live on the Dashboard). */}
      <div className="hidden">
        <KpiStrip items={stats} />
      </div>


      {/* Quick scope chips — My leads / All contacts (the broker book toggle). The
          named smart lists moved into the sidebar below. */}
      <div className="mt-4 -mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:mt-6 sm:flex-wrap sm:px-0">
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
      </div>

      {/* ── DESKTOP: 3-column layout (sidebar | table+toolbar | filter panel) ──
          ── MOBILE:  single column (sidebar above table, no right panel) ────── */}
      <div className="mt-6 flex flex-col gap-6 md:flex-row md:items-start">

        {/* LEFT: smart-list sidebar */}
        <SavedViewSidebar
          views={savedViewItems}
          activeViewId={activeViewId}
          activeFilters={activeFilters}
          hasActiveFilter={hasActiveFilter}
          canManageSystem={access.role === 'superuser'}
        />

        {/* CENTRE: search bar + toolbar row + table + pagination */}
        <div className="min-w-0 flex-1">
          {/* Search (both breakpoints) */}
          <ContactsSearch initial={sp.q ?? ''} />

          {/* Mobile-only filters. Agent scope uses the FUB full-screen picker
              (Everyone / Me / Team + avatars); stage stays an inline select with
              Apply. */}
          <div className="mt-2 flex flex-col gap-2 md:hidden">
            <BrokerScopeSheet
              brokers={CRM_BROKERS.map((slug) => ({ slug, label: CRM_BROKER_DISPLAY[slug], headshot: BROKER_HEADSHOT[slug] ?? null }))}
              current={effectiveBroker ?? 'all'}
              myBrokerSlug={access.brokerSlug ?? null}
              carry={{ q: sp.q, stage: sp.stage, tag: sp.tag, view: sp.view }}
            />
            <form method="GET" action="/admin/crm" className="flex flex-col gap-2">
              {sp.view ? <input type="hidden" name="view" value={sp.view} /> : null}
              {sp.q ? <input type="hidden" name="q" value={sp.q} /> : null}
              {effectiveBroker ? <input type="hidden" name="broker" value={effectiveBroker} /> : null}
              <select
                name="stage"
                defaultValue={sp.stage ?? ''}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
              >
                <option value="">All stages</option>
                {stageOptions.map((s) => (
                  <option key={s.key} value={s.key}>{s.label}</option>
                ))}
              </select>
              <div className="flex items-center gap-3">
                <Button type="submit" size="sm" className="h-10">Apply</Button>
                <Link href="/admin/crm" className="flex h-10 items-center text-sm text-muted-foreground hover:text-foreground">Clear</Link>
              </div>
            </form>
          </div>

          {/* Desktop toolbar row: "Showing N people" count (icon toolbar lives in BulkAssignWrapper) */}
          <div className="mt-2 hidden items-center gap-3 md:flex">
            <span className="text-sm text-muted-foreground tabular-nums">
              Showing <span className="font-medium text-foreground">{total.toLocaleString('en-US')}</span> people
              {appliedView ? (
                <> · view: <span className="font-medium text-foreground">{appliedView.name}</span></>
              ) : null}
            </span>
          </div>

          {/* Selectable contacts list + sticky bulk-action bar (client island) */}
          <BulkAssignWrapper
            rows={bulkRows}
            activeFilters={activeFilters}
            activeViewId={activeViewId}
            matchingTotal={matchingTotal}
            canAssignBroker={canAssignBroker}
            brokers={brokerOptions}
            stages={stageOptions}
            tags={tagOptions}
            reportAreas={areaOptions}
            emailTemplates={templateOptions}
            sequences={sequenceOptions}
            exportHref={(() => {
              const p = new URLSearchParams()
              if (sp.q) p.set('q', sp.q)
              if (sp.stage) p.set('stage', sp.stage)
              if (sp.tag) p.set('tag', sp.tag)
              if (effectiveBroker) p.set('broker', effectiveBroker)
              const qs = p.toString()
              return `/api/admin/crm/export${qs ? `?${qs}` : ''}`
            })()}
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
        </div>

        {/* RIGHT: filter panel — desktop only (FUB "Filters" rail) */}
        <aside className="hidden w-52 shrink-0 md:block">
          <div className="rounded-lg border border-border bg-card p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Filters</p>
            <form method="GET" action="/admin/crm" className="mt-3 flex flex-col gap-3">
              {sp.view ? <input type="hidden" name="view" value={sp.view} /> : null}
              {sp.q ? <input type="hidden" name="q" value={sp.q} /> : null}

              {/* Add a filter label — mirrors FUB's empty-state phrasing */}
              {!sp.stage && !sp.broker ? (
                <p className="text-xs text-muted-foreground">No filters added yet.</p>
              ) : null}

              <div className="flex flex-col gap-1">
                <label htmlFor="desk-stage" className="text-xs font-medium text-muted-foreground">Stage</label>
                <select
                  id="desk-stage"
                  name="stage"
                  defaultValue={sp.stage ?? ''}
                  className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm text-foreground"
                >
                  <option value="">All stages</option>
                  {stageOptions.map((s) => (
                    <option key={s.key} value={s.key}>{s.label}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label htmlFor="desk-broker" className="text-xs font-medium text-muted-foreground">Agent</label>
                <select
                  id="desk-broker"
                  name="broker"
                  defaultValue={effectiveBroker ?? 'all'}
                  className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm text-foreground"
                >
                  <option value="all">All agents</option>
                  {CRM_BROKERS.map((b) => (
                    <option key={b} value={b}>{CRM_BROKER_DISPLAY[b]}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2 pt-1">
                <Button type="submit" size="sm" className="h-8 flex-1">Apply</Button>
                <Link href="/admin/crm">
                  <Button type="button" variant="outline" size="sm" className="h-8">Clear</Button>
                </Link>
              </div>
            </form>
          </div>
        </aside>

      </div>
    </main>
  )
}
