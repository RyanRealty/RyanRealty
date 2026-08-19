// @no-parity — internal admin surface, gated by ci:crm-screen-parity instead
// (docs/crm-spec/crm-screens.json → contacts-list-desktop).
//
// §05 People list — the three-region CRM structure
// (docs/crm-spec/05-people-list-and-bulk-actions.md §2):
//   LEFT  — PeopleSidebar: All People + Collections hierarchy (§3)
//   MAIN  — PeopleListView: header (§4), toolbar (§5), table (§6/§13),
//           bulk bar (§14), Add Person (§16), Export (§15)
//   RIGHT — persistent filter panel (§9) / column chooser (§8), inside
//           PeopleListView so the toolbar controls the slot.
// The < md branch is the §24 mobile People root (mob-09/10) — untouched here.
//
// 11C: migrated to the LOCKED admin v2 language (design_system/admin/ADMIN_UI.md).
// Presentation only — every island (PeopleSidebar, PeopleListView,
// MobilePeopleRoot, ContactsSearch) is mounted unchanged with the same props.
//
// Carried over verbatim: requireAdminPage('people.view'), the getCrmAccess
// guard + redirect, scopeBroker and the ?broker=all → undefined rule feeding
// effectiveBroker, the eleven parallel reads, the getPeopleListSignals second
// pass keyed on the rendered ids, primaryContact, BROKER_HEADSHOT, fmtFubDate
// on every date cell (see the note below), pageHref and its baseParams carry
// set, the saved-view grouping + appliedViewInfo derivation, every picker's
// filter rule, activeFilters, filterExportHref, panelFilters, and the ?ptab=
// / ?pond= / ?neighborhood= handling.
//
// Dates: fmtFubDate stays. It is a RELATIVE formatter ("today", "3 days ago",
// then "Aug 30th '26"); lib/format/date's formatDate is absolute and re-projects
// to America/Los_Angeles. Printed side by side on this session's samples they
// disagree on every row, and on a bare date-only string formatDate moves the
// printed day back one. Swapping would rewrite every Last Visit / Last Activity
// / Created cell, so nothing was swapped.
//
// Shape changed, data did not: the page's own <main> is GONE — ConsoleShell
// owns the single landmark and this page rendered a second one; the mobile
// full-bleed offsets now cancel only the shell padding, since the page no
// longer adds its own; max-w-[1600px] became an inline maxWidth of the same
// 1600px; and the desktop branch leads with one verdict line whose only claims
// are `total` (the count listCrmPeople returned for the rows it is drawing) and
// `effectiveBroker` (the slug that read was scoped to).
//
// MobileCrmHeader IS GONE (Matt 2026-08-08). It rendered a 56px navy
// bg-primary bar — the public brand as admin design input, which ADMIN_UI §5
// blacklists — and everything it carried is already on screen at this width:
// ConsoleShell's compact top bar renders TopBarScope whenever the path is
// exactly /admin/crm, plus the palette trigger that runs consoleSearchLeads,
// and the account menu already links to /admin/settings.
//
// ContactsSearch did NOT go with it. It lived in that bar's searchSlot, but it
// is the only control on any width that sets ?q= on the people list, and it
// filters on name, email OR phone where the palette matches a name and
// navigates away. It now mounts directly, migrated to the v2 SearchField, at
// ./_components/ContactsSearch.
import { Suspense } from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { requireAdminPage } from '@/lib/admin/require-admin'
import { getCrmAccess, listCrmPeople, listCrmSequences, type CrmAccess } from '@/app/actions/crm'
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
import { VerdictLine } from '@/components/admin/v2'
import '@/components/admin/v2/admin-v2.css'
import ContactsSearch from './_components/ContactsSearch'
import { MobilePeopleRoot } from '@/components/admin/shared/mobile/MobilePeopleRoot'
import PeopleSidebar from '@/components/admin/shared/people-list/PeopleSidebar'
import PeopleListView, { type PeopleRow } from '@/components/admin/shared/people-list/PeopleListView'
import {
  groupSavedViews, groupSystemByCollection, type SavedViewItem,
} from '@/components/admin/shared/people-list/saved-view-grouping'
import {
  fmtFubDate, activityIconKind, LEAD_SOURCE_OPTIONS,
} from '@/components/admin/shared/people-list/people-list-utils'

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

function CrmListFallback() {
  return (
    <div aria-busy style={{ padding: '8px 0' }}>
      <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>Loading recent people.</p>
    </div>
  )
}

export default async function CrmPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireAdminPage('people.view')
  const access = await getCrmAccess()
  if (!access) redirect('/admin/access-denied')
  const sp = await searchParams
  return (
    <div className="av2-scope" style={{ maxWidth: 1600, margin: '0 auto' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <Link
          href="/admin/people#add-person"
          className="av2-btn"
          data-tour="crm-add-person"
          style={{ textDecoration: 'none' }}
        >
          New contact
        </Link>
      </div>
      <Suspense fallback={<CrmListFallback />}>
        <CrmPeopleBody access={access} sp={sp} />
      </Suspense>
    </div>
  )
}

async function CrmPeopleBody({ access, sp }: { access: CrmAccess; sp: SearchParams }) {
  const page = Math.max(1, Number(sp.page ?? '1') || 1)

  // Broker RBAC scope (GAP-1). Superuser (Matt) → null (may see all books);
  // restricted broker → their own slug. The ACTUAL enforcement lives in
  // listCrmPeople itself, which self-scopes — the page only shapes the UI.
  const scope = scopeBroker(access)
  const requestedBroker = sp.broker === 'all' ? undefined : sp.broker || undefined
  const effectiveBroker = scope ?? requestedBroker

  const [views, result, stageRows, tagRows, areaRows, templateRows, sequenceRows, ponds, neighborhoodOptions] = await Promise.all([
    getCrmSavedViews(access, { includeCounts: false }),
    listCrmPeople({ q: sp.q, stage: sp.stage, broker: effectiveBroker, tag: sp.tag, view: sp.view, page, pond: sp.pond, neighborhood: sp.neighborhood }),
    getCrmStages(),
    getCrmTags(),
    getCrmReportAreas(),
    getCrmTemplatesAdmin(),
    listCrmSequences(),
    getCrmPonds(),
    getCrmNeighborhoodOptions(),
  ])

  const { rows, total, pageSize, appliedView, totalExact } = result
  const lastPage = totalExact
    ? Math.max(1, Math.ceil(total / pageSize))
    : (rows.length === pageSize ? page + 1 : page)
  const stageCounts = stageRows.filter((s) => s.isActive).map((s) => ({ key: s.key, label: s.label, count: 0 }))

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

  // The verdict's scope clause names the slug the read was actually scoped to.
  // listCrmPeople self-scopes with `scope ?? filters.broker`, which is exactly
  // effectiveBroker, so this cannot describe a different filter than the rows.
  const scopeLabel = effectiveBroker
    ? CRM_BROKER_DISPLAY[effectiveBroker as keyof typeof CRM_BROKER_DISPLAY] ?? effectiveBroker
    : null

  return (
    <div className="av2-scope" style={{ maxWidth: 1600, margin: '0 auto' }}>
      {/* ── MOBILE (< md): §24 People root — All Lists / Stages / filtered list
             (mob-09 / mob-10). Full-bleed: cancels the ConsoleShell main
             padding (px-4 pt-5 / sm:px-6 sm:pt-7).

             The navy §1.3 header above this was deleted in 11F (Matt
             2026-08-08). Both controls it carried are already on screen at this
             width from ConsoleShell's compact top bar: TopBarScope renders the
             "Everyone ▾" scope switcher whenever the path is exactly /admin/crm,
             and the palette trigger next to it runs consoleSearchLeads, so a
             contact is still findable by name on a phone. What the bar added
             beyond those was an avatar link to /admin/settings — which the
             account menu already offers — and a public-brand navy bar inside an
             admin whose §5 amnesia blacklists that palette. */}
      <div className="-mx-4 -mt-5 md:hidden sm:-mx-6 sm:-mt-7">
        <div style={{ padding: '10px 16px 0' }}>
          <ContactsSearch initial={sp.q ?? ''} />
        </div>
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

      {/* ── DESKTOP (md+): §2 three-region layout ─────────────────────────────
             Phone is excluded on purpose: MobilePeopleRoot carries its own
             count bar and mounts full-bleed under a negative top margin, so a
             line above it would be overlapped. */}
      <div className="mb-3 hidden md:block">
        <VerdictLine tone={rows.length > 0 || total > 0 ? 'ok' : 'attention'}>
          {totalExact && total > 0 ? (
            <>
              <b>
                {total.toLocaleString('en-US')} {total === 1 ? 'person' : 'people'}
              </b>{' '}
              in this list{scopeLabel ? <> · {scopeLabel} only</> : null}.
            </>
          ) : rows.length > 0 ? (
            <>
              <b>Recently updated.</b> Add a person or search.
              {scopeLabel ? <> · {scopeLabel} only</> : null}
            </>
          ) : (
            <>
              <b>This list came back empty.</b>
              {scopeLabel ? <> {scopeLabel} only.</> : null}
            </>
          )}
        </VerdictLine>
      </div>

      <div className="hidden gap-6 md:flex md:items-start">
        <PeopleSidebar
          views={savedViewItems}
          activeViewId={activeViewId}
          totalCount={0}
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
          totalExact={totalExact}
        />
      </div>
    </div>
  )
}
