// @no-parity — internal admin surface, gated by ci:crm-screen-parity instead
// (docs/fub-crm-spec/crm-screens.json → contacts-list-desktop).
//
// §05 People list — the three-region FUB structure
// (docs/fub-crm-spec/05-people-list-and-bulk-actions.md §2):
//   LEFT  — PeopleSidebar: All People + Collections hierarchy (§3)
//   MAIN  — PeopleListView: header (§4), toolbar (§5), table (§6/§13),
//           bulk bar (§14), Add Person (§16), Export (§15)
//   RIGHT — persistent filter panel (§9) / column chooser (§8), inside
//           PeopleListView so the toolbar controls the slot.
// The < md branch is the §24 mobile People root (mob-09/10) — untouched here.
import { redirect } from 'next/navigation'
import { getCrmAccess, getCrmOverview, listCrmPeople, listCrmSequences } from '@/app/actions/crm'
import { getCrmSavedViews } from '@/lib/data/crm/getCrmSavedViews'
import { getPeopleListSignals } from '@/lib/data/crm/getPeopleListSignals'
import { getCrmPonds } from '@/lib/data/crm/getCrmPonds'
import { scopeBroker } from '@/lib/crm/scope'
import { CRM_STAGES, CRM_BROKERS, CRM_BROKER_DISPLAY } from '@/lib/crm/constants'
import { getCrmStages } from '@/lib/data/crm/getCrmStages'
import { getCrmTags } from '@/lib/data/crm/getCrmTags'
import { getCrmReportAreas } from '@/lib/data/crm/getCrmReportAreas'
import { getCrmNeighborhoodOptions } from '@/lib/data/crm/getCrmNeighborhoodOptions'
import { getCrmTemplatesAdmin } from '@/lib/data/crm/getCrmTemplatesAdmin'
import ContactsSearch from '@/components/admin/crm/ContactsSearch'
import BrokerScopeSheet from '@/components/admin/crm/BrokerScopeSheet'
import MobileCrmHeader from '@/components/admin/crm/mobile/MobileCrmHeader'
import { MobilePeopleRoot } from '@/components/admin/crm/mobile/MobilePeopleRoot'
import PeopleSidebar from '@/components/admin/crm/people-list/PeopleSidebar'
import { getCrmStageCounts } from '@/lib/data/crm/getCrmStageCounts'
import PeopleListView, { type PeopleRow } from '@/components/admin/crm/people-list/PeopleListView'
import {
  groupSavedViews, groupSystemByCollection, type SavedViewItem,
} from '@/components/admin/crm/saved-view-grouping'
import {
  fmtFubDate, activityIconKind, LEAD_SOURCE_OPTIONS,
} from '@/components/admin/crm/people-list/people-list-utils'

export const metadata = { title: 'People | CRM | Admin' }
export const dynamic = 'force-dynamic'

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

type SearchParams = {
  q?: string; stage?: string; broker?: string; tag?: string; view?: string
  page?: string; ptab?: string; pond?: string; neighborhood?: string
}

export default async function CrmPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const access = await getCrmAccess()
  if (!access) redirect('/admin/access-denied')

  const sp = await searchParams
  const page = Math.max(1, Number(sp.page ?? '1') || 1)

  // Broker RBAC scope (GAP-1). Superuser (Matt) → null (may see all books);
  // restricted broker → their own slug. The ACTUAL enforcement lives in
  // listCrmPeople itself, which self-scopes — the page only shapes the UI.
  const scope = scopeBroker(access)
  const requestedBroker = sp.broker === 'all' ? undefined : sp.broker || undefined
  const effectiveBroker = scope ?? requestedBroker

  const [views, overview, result, stageRows, tagRows, areaRows, templateRows, sequenceRows, ponds, stageCounts, neighborhoodOptions] = await Promise.all([
    getCrmSavedViews(access),
    getCrmOverview(scope),
    listCrmPeople({ q: sp.q, stage: sp.stage, broker: effectiveBroker, tag: sp.tag, view: sp.view, page, pond: sp.pond, neighborhood: sp.neighborhood }),
    getCrmStages(),
    getCrmTags(),
    getCrmReportAreas(),
    getCrmTemplatesAdmin(),
    listCrmSequences(),
    getCrmPonds(),
    getCrmStageCounts(access),
    getCrmNeighborhoodOptions(),
  ])

  const { rows, total, pageSize, appliedView } = result
  const lastPage = Math.max(1, Math.ceil(total / pageSize))

  // §6 col 5 + 8 — per-row Last Visit + latest lead-initiated activity.
  const signals = await getPeopleListSignals(rows.map((r) => r.id))

  const baseParams = new URLSearchParams()
  for (const [k, v] of Object.entries({ q: sp.q, stage: sp.stage, broker: sp.broker, tag: sp.tag, view: sp.view, pond: sp.pond, neighborhood: sp.neighborhood })) {
    if (v) baseParams.set(k, v)
  }
  const pageHref = (p: number) => {
    const params = new URLSearchParams(baseParams)
    if (p > 1) params.set('page', String(p))
    const qs = params.toString()
    return qs ? `/admin/crm?${qs}` : '/admin/crm'
  }

  // ── Server-enriched table rows (§6/§13) ────────────────────────────────────
  const peopleRows: PeopleRow[] = rows.map((p) => {
    const sig = signals.get(p.id)
    const lastActivity = sig?.lastActivity
      ? {
          icon: activityIconKind(sig.lastActivity.kind),
          label: sig.lastActivity.title ?? '',
          dateLabel: fmtFubDate(sig.lastActivity.ts),
        }
      : p.last_activity_at
        ? { icon: 'other' as const, label: '', dateLabel: fmtFubDate(p.last_activity_at) }
        : null
    return {
      id: p.id,
      name: p.name,
      stage: p.stage,
      source: p.source,
      picture_url: p.picture_url,
      email: primaryContact(p.emails),
      phone: primaryContact(p.phones),
      tags: p.tags,
      assigned_broker: p.assigned_broker,
      agentLabel: p.assigned_broker ? (CRM_BROKER_DISPLAY[p.assigned_broker as keyof typeof CRM_BROKER_DISPLAY] ?? p.assigned_broker) : null,
      agentHeadshot: p.assigned_broker ? (BROKER_HEADSHOT[p.assigned_broker] ?? null) : null,
      lastVisitLabel: sig?.lastVisit ? fmtFubDate(sig.lastVisit) : '',
      lastActivity,
      createdLabel: fmtFubDate(p.fub_created_at),
      price: p.price,
      timeframe: p.timeframe,
    }
  })

  // ── Sidebar views + the active view's header info ──────────────────────────
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
  const activeViewId = sp.view ? Number(sp.view) || null : null
  const activeItem = activeViewId != null ? savedViewItems.find((v) => v.id === activeViewId) ?? null : null
  const { system } = groupSavedViews(savedViewItems)
  const neighborhoodIds = new Set(
    groupSystemByCollection(system).find((c) => c.label === 'Neighborhoods')?.views.map((v) => v.id) ?? [],
  )
  const appliedViewInfo = appliedView && activeItem
    ? {
        id: activeItem.id,
        name: activeItem.name,
        description: activeItem.description,
        isShared: activeItem.isShared,
        canEdit: activeItem.isOwn || access.role === 'superuser',
        collectionLabel: activeItem.isSystem
          ? (neighborhoodIds.has(activeItem.id) ? 'Neighborhoods' : 'Pipeline')
          : activeItem.isOwn ? 'My view' : 'Shared',
      }
    : null

  // ── Pickers ─────────────────────────────────────────────────────────────────
  const stagePicker = stageRows.filter((s) => s.isActive).map((s) => ({ key: s.key, label: s.label }))
  const stageOptions = stagePicker.length > 0 ? stagePicker : CRM_STAGES.map((s) => ({ key: s, label: s }))
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
  const brokerPicker = CRM_BROKERS.map((b) => ({ key: b, label: CRM_BROKER_DISPLAY[b] }))
  const scopeBrokers = CRM_BROKERS.map((slug) => ({
    slug, label: CRM_BROKER_DISPLAY[slug], headshot: BROKER_HEADSHOT[slug] ?? null,
  }))
  const pondOptions = ponds.map((p) => ({ id: p.id, name: p.name }))
  const sourceOptions = LEAD_SOURCE_OPTIONS.map((s) => ({ key: s, label: s }))

  const activeFilters = {
    q: sp.q || undefined,
    stage: sp.stage || undefined,
    broker: effectiveBroker || undefined,
    tagsAny: sp.tag ? [sp.tag] : undefined,
    neighborhood: sp.neighborhood || undefined,
  }
  const filterExportHref = (() => {
    const p = new URLSearchParams()
    if (sp.q) p.set('q', sp.q)
    if (sp.neighborhood) p.set('neighborhood', sp.neighborhood)
    if (sp.stage) p.set('stage', sp.stage)
    if (sp.tag) p.set('tag', sp.tag)
    if (effectiveBroker) p.set('broker', effectiveBroker)
    if (activeViewId) p.set('view', String(activeViewId))
    const qs = p.toString()
    return `/api/admin/crm/export${qs ? `?${qs}` : ''}`
  })()

  // §9: the panel filters — from the URL, or the applied view's saved bag.
  const panelFilters = {
    q: sp.q || undefined,
    stage: sp.stage || appliedView?.filter?.stage || undefined,
    tagsAny: sp.tag ? [sp.tag] : appliedView?.filter?.tagsAny ?? undefined,
    neighborhood: sp.neighborhood || undefined,
  }

  return (
    <main className="mx-auto max-w-[1600px] px-4 pb-8 pt-2 sm:px-6 sm:py-6">
      {/* ── MOBILE (< md): §24 People root — navy §1.3 header (avatar ·
             "Everyone ▾" scope · search) over All Lists / Stages / filtered
             list (mob-09 / mob-10). Full-bleed: cancels the ConsoleShell main
             padding (px-4 pt-5 / sm:px-6 sm:pt-7) + this page's own
             (px-4 pt-2 / sm:px-6 sm:py-6). Matt punch list #3 (2026-07-02):
             one CRM, one style — same navy header language as calendar/inbox. */}
      <div className="-mx-8 -mt-7 md:hidden sm:-mx-12 sm:-mt-13">
        <MobileCrmHeader
          brokerName={access.brokerSlug ? CRM_BROKER_DISPLAY[access.brokerSlug as keyof typeof CRM_BROKER_DISPLAY] ?? access.brokerSlug : 'Broker'}
          brokerHeadshot={access.brokerSlug ? BROKER_HEADSHOT[access.brokerSlug] ?? null : null}
          center={
            <BrokerScopeSheet
              variant="header"
              brokers={scopeBrokers}
              current={effectiveBroker ?? 'all'}
              myBrokerSlug={access.brokerSlug ?? null}
              carry={{ q: sp.q, stage: sp.stage, tag: sp.tag, view: sp.view }}
            />
          }
          searchSlot={<ContactsSearch initial={sp.q ?? ''} />}
          searchOpenInitially={Boolean(sp.q)}
        />
        {(() => {
          const mode: 'directory' | 'list' = sp.q || sp.stage || sp.tag || sp.view ? 'list' : 'directory'
          const listTitle =
            appliedView?.name ??
            (sp.stage ? sp.stage : sp.tag ? `#${sp.tag}` : sp.q ? `“${sp.q}”` : 'People')
          return (
            <MobilePeopleRoot
              mode={mode}
              ptab={sp.ptab === 'stages' ? 'stages' : 'lists'}
              views={savedViewItems.map((v) => ({ id: v.id, name: v.name, count: v.count }))}
              stages={stageOptions}
              rows={peopleRows.map((r) => ({ id: r.id, name: r.name ?? `Contact #${r.id}`, picture_url: r.picture_url, source: r.source, stage: r.stage }))}
              total={total}
              listTitle={listTitle}
              page={page}
              lastPage={lastPage}
              pageHrefPrev={page > 1 ? pageHref(page - 1) : null}
              pageHrefNext={page < lastPage ? pageHref(page + 1) : null}
              carryBroker={sp.broker || undefined}
            />
          )
        })()}
      </div>

      {/* ── DESKTOP (md+): §2 three-region layout ───────────────────────────── */}
      <div className="hidden gap-6 md:flex md:items-start">
        <PeopleSidebar
          views={savedViewItems}
          activeViewId={activeViewId}
          totalCount={overview.total}
          stages={stageCounts}
          activeStage={sp.stage || null}
          carry={{ broker: sp.broker, pond: sp.pond }}
        />
        <PeopleListView
          rows={peopleRows}
          total={total}
          page={page}
          pageSize={pageSize}
          lastPage={lastPage}
          pageHrefPrev={page > 1 ? pageHref(page - 1) : null}
          pageHrefNext={page < lastPage ? pageHref(page + 1) : null}
          appliedView={appliedViewInfo}
          activeViewId={activeViewId}
          filters={panelFilters}
          urlFilters={{ q: sp.q || undefined, stage: sp.stage || undefined, tag: sp.tag || undefined }}
          activeFilters={activeFilters}
          currentBroker={sp.broker || (scope ?? undefined)}
          currentPond={sp.pond}
          myBrokerSlug={access.brokerSlug ?? null}
          canAssignBroker={access.role === 'superuser'}
          brokers={scopeBrokers}
          ponds={pondOptions}
          stageOptions={stageOptions}
          tagOptions={tagOptions}
          neighborhoodOptions={neighborhoodOptions}
          sourceOptions={sourceOptions}
          reportAreas={areaOptions}
          emailTemplates={templateOptions}
          sequences={sequenceOptions}
          brokerPicker={brokerPicker}
          filterExportHref={filterExportHref}
        />
      </div>
    </main>
  )
}
