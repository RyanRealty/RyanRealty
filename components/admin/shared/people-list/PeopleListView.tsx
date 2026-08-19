'use client'

/**
 * PeopleListView — the §05 People list main area + persistent right panel
 * (docs/crm-spec/05-people-list-and-bulk-actions.md).
 *
 * Owns everything to the right of the §3 sidebar:
 *   - §4 header: "All People" h1 + "Showing N people" + "+ New List" (All
 *     People) OR the smart-list header (name · collection badge · Edit ·
 *     description More/Less · "Update List ↻") — mutually exclusive slots.
 *   - §5 toolbar: "? How Smart Lists work" · Columns ▾ · Me ▾ · Filters (N),
 *     plus the always-visible bulk icon strip (email/import/tag/delete/export).
 *   - §6/§13 table: checkbox · Name(+avatar+source) · Lead Score · Agent ·
 *     Last Visit · Phone (permanent SMS+call icons) · Email · Last Activity
 *     (type icon + description + CRM date) · Tags — column set configurable
 *     per list via the §8 chooser.
 *   - §9 persistent right filter panel (column chooser swaps into the slot).
 *   - §14 multi-select bulk bar (BulkActions), §15 export modal, §16 Add
 *     Person modal, §11 Edit Smart List modal.
 *
 * All data arrives server-fetched (listCrmPeople + getPeopleListSignals under
 * the caller's frozen broker scope); this island only owns view state.
 *
 * 11F admin-v2: migrated to the LOCKED admin language
 * (design_system/admin/ADMIN_UI.md). Every legacy component-library import is
 * gone — Button/IconButton, Dialog, Menu, Switch,
 * TextField/TextAreaField/ToolbarCheck and CrmAvatar now carry the controls —
 * and every semantic colour class the legacy library shipped is replaced with
 * var(--a-*). Those classes resolved to the PUBLIC brand palette, which the
 * admin blacklists, so swapping only the imports would have left the highest
 * traffic admin table still wearing the marketing site's colors.
 *
 * Presentation only: no exported name, prop, string or ARIA name changed. One
 * overlay changed mechanism: the tag dropdown is now the v2 Menu (same
 * accessible name, same two items, and the wrapper carries the hover tooltip
 * the trigger used to own). The "How Smart Lists work" explainer stays a
 * NON-MODAL popover — routing it through the modal Dialog made the whole list
 * inert behind it and demanded Esc or Close before anything else could be
 * touched, which is not what a help link costs.
 */

import { useEffect, useMemo, useRef, useState, useTransition, type CSSProperties } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  HelpCircle, ChevronDown, Columns3, SlidersHorizontal, UserRoundPlus, Plus,
  RefreshCw, Loader2, Mail, Upload, Tag, Trash2, Download, Flame, House,
  MessageSquare, Phone as PhoneIcon, UserRound, Activity, Pencil,
} from 'lucide-react'
import {
  Button, IconButton, Dialog, Menu, Switch,
  StateWord, TextField, TextAreaField, ToolbarCheck,
} from '@/components/admin/v2'
import { CrmAvatar } from '@/components/admin/shared/mobile/CrmMobileKit'
import { cn } from '@/lib/utils'
import BulkActions, {
  type BulkPickerOption, type BulkTemplateOption, type BulkSequenceOption,
  type BulkActionsHandle,
} from '@/components/admin/crm/BulkActions'
import type { LegacyFilters } from '@/lib/crm/segment-ast'
import {
  saveCurrentFilterAsViewAction,
  updateSavedViewAction,
  updateSavedViewFilterAction,
  deleteSavedViewAction,
  setSavedViewSharedAction,
} from '@/app/actions/crm-saved-views'
import ScopeDropdown, { type ScopeBrokerOption, type ScopePondOption } from './ScopeDropdown'
import FilterPanel, { type FilterOption } from './FilterPanel'
import ColumnChooser from './ColumnChooser'
import AddPersonDialog from './AddPersonDialog'
import ExportPeopleDialog from './ExportPeopleDialog'
import {
  fmtPhoneDotted, columnStorageKey, parseStoredColumns,
  DEFAULT_PEOPLE_COLUMNS, type PeopleColumnKey, type ActivityIconKind,
} from './people-list-utils'

// ── Token styles (the semantic colour classes these replace resolved to the
//    PUBLIC brand palette; see the header note) ────────────────────────────────

/** Secondary ink — the quiet half of the two-step text scale. */
const MUTED: CSSProperties = { color: 'var(--a-text-2)' }
/** The honest "no value" em-dash — secondary ink, dimmed further. */
const DASH: CSSProperties = { color: 'var(--a-text-2)', opacity: 0.45 }
/** Compact toolbar button metric (32px tall, small type). */
const BAR_BTN: CSSProperties = { minHeight: 32, padding: '0 10px', fontSize: 'var(--a-text-sm)' }
/** Pagination button metric (28px tall, small type). */
const PAGE_BTN: CSSProperties = { minHeight: 28, padding: '0 10px', fontSize: 'var(--a-text-sm)' }
/** A stage is a broker-configured word, so it renders in the casing the broker
 *  typed. StateWord is not the control for it: `.av2-state` uppercases, and
 *  uppercasing a configured stage name prints a value nobody entered. */
const STAGE_WORD: CSSProperties = {
  display: 'inline-block',
  whiteSpace: 'nowrap',
  border: '1px solid var(--a-border)',
  borderRadius: 'var(--a-r-sm)',
  color: 'var(--a-text)',
  padding: '0 6px',
}
/** A tag is user-authored text, so it gets a quiet bordered word rather than a
 *  StateWord — the state vocabulary is uppercased, and uppercasing a broker's
 *  own tag renders their data as something they did not type. */
const TAG_WORD: CSSProperties = {
  display: 'inline-block',
  maxWidth: '7rem',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  border: '1px solid var(--a-border)',
  borderRadius: 'var(--a-r-sm)',
  background: 'var(--a-inset)',
  color: 'var(--a-text-2)',
  padding: '0 6px',
}

// ── Row shape (server-enriched) ──────────────────────────────────────────────

export type PeopleRow = {
  id: number
  name: string | null
  stage: string
  source: string | null
  picture_url: string | null
  email: string | null
  phone: string | null
  tags: string[]
  assigned_broker: string | null
  agentLabel: string | null
  agentHeadshot: string | null
  /** §6 col 5 — formatted CRM date ('' when no visit data). */
  lastVisitLabel: string
  /** §6 col 8 — latest lead-initiated event. */
  lastActivity: { icon: ActivityIconKind; label: string; dateLabel: string } | null
  createdLabel: string
  price: number | null
  timeframe: string | null
}

export type AppliedViewInfo = {
  id: number
  name: string
  description: string | null
  isShared: boolean
  canEdit: boolean
  collectionLabel: string
}

export type PeopleListViewProps = {
  rows: PeopleRow[]
  total: number
  page: number
  pageSize: number
  lastPage: number
  pageHrefPrev: string | null
  pageHrefNext: string | null
  /** Active smart list, or null (= All People). */
  appliedView: AppliedViewInfo | null
  activeViewId: number | null
  /** Panel filter state (URL params merged with the applied view's saved bag). */
  filters: { q?: string; stage?: string; tagsAny?: string[]; neighborhood?: string }
  /** The RAW URL filter params (?q/?stage/?tag only) — carried on scope changes
   *  so a view's saved filters are never materialized into the URL. */
  urlFilters: { q?: string; stage?: string; tag?: string; neighborhood?: string }
  /** The full legacy bag for bulk "all matching" + save-view. */
  activeFilters: LegacyFilters
  /** Scope overlay state (§7). */
  currentBroker: string | undefined
  currentPond: string | undefined
  myBrokerSlug: string | null
  canAssignBroker: boolean
  brokers: ScopeBrokerOption[]
  ponds: ScopePondOption[]
  stageOptions: FilterOption[]
  tagOptions: FilterOption[]
  neighborhoodOptions: FilterOption[]
  sourceOptions: FilterOption[]
  reportAreas: BulkPickerOption[]
  emailTemplates: BulkTemplateOption[]
  sequences: BulkSequenceOption[]
  brokerPicker: BulkPickerOption[]
  filterExportHref: string
  /** False when the default list skipped the book-wide exact count. */
  totalExact?: boolean
}

export default function PeopleListView(props: PeopleListViewProps) {
  const {
    rows, total, page, pageSize, lastPage, pageHrefPrev, pageHrefNext,
    appliedView, activeViewId, filters, urlFilters, activeFilters,
    currentBroker, currentPond, myBrokerSlug, canAssignBroker,
    brokers, ponds, stageOptions, tagOptions, neighborhoodOptions, sourceOptions,
    reportAreas, emailTemplates, sequences, brokerPicker, filterExportHref,
    totalExact = true,
  } = props

  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const bulkRef = useRef<BulkActionsHandle>(null)

  // ── Right panel slot: filters (persistent) or the column chooser (§2) ──────
  const [panel, setPanel] = useState<'filters' | 'columns'>('filters')
  const [panelOpen, setPanelOpen] = useState(true)

  // ── Selection ───────────────────────────────────────────────────────────────
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const toggle = (id: number) => setSelected((prev) => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })
  const allOnPage = rows.length > 0 && rows.every((r) => selected.has(r.id))
  const someOnPage = rows.some((r) => selected.has(r.id))
  const toggleAll = () => setSelected((prev) => {
    const next = new Set(prev)
    if (allOnPage) rows.forEach((r) => next.delete(r.id))
    else rows.forEach((r) => next.add(r.id))
    return next
  })
  const selectedIds = useMemo(() => Array.from(selected), [selected])

  // ── §8 per-list column configuration (localStorage) ────────────────────────
  const [columns, setColumns] = useState<PeopleColumnKey[]>([...DEFAULT_PEOPLE_COLUMNS])
  useEffect(() => {
    const stored = parseStoredColumns(
      typeof window !== 'undefined' ? window.localStorage.getItem(columnStorageKey(activeViewId)) : null,
    )
    setColumns(stored ?? [...DEFAULT_PEOPLE_COLUMNS])
  }, [activeViewId])
  const persistColumns = (next: PeopleColumnKey[]) => {
    setColumns(next)
    try { window.localStorage.setItem(columnStorageKey(activeViewId), JSON.stringify(next)) } catch { /* private mode */ }
  }
  const toggleColumn = (key: PeopleColumnKey) => {
    persistColumns(columns.includes(key) ? columns.filter((c) => c !== key) : [...columns, key])
  }
  const resetColumns = () => {
    try { window.localStorage.removeItem(columnStorageKey(activeViewId)) } catch { /* noop */ }
    setColumns([...DEFAULT_PEOPLE_COLUMNS])
  }

  // ── Dialogs ─────────────────────────────────────────────────────────────────
  const [addOpen, setAddOpen] = useState(false)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    if (params.get('add') === '1' || window.location.hash === '#add-person') {
      setAddOpen(true)
    }
  }, [])
  const [exportOpen, setExportOpen] = useState(false)
  const [newListOpen, setNewListOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [listName, setListName] = useState('')
  const [listDesc, setListDesc] = useState('')
  const [listShared, setListShared] = useState(false)
  const [listError, setListError] = useState<string | null>(null)
  const [descExpanded, setDescExpanded] = useState(false)
  const [updateDone, setUpdateDone] = useState(false)

  const filterCount = [filters.q, filters.stage, filters.tagsAny?.length ? 't' : ''].filter(Boolean).length

  const carry: Record<string, string | undefined> = {
    broker: currentBroker,
    pond: currentPond,
    view: activeViewId != null ? String(activeViewId) : undefined,
  }

  const openNewList = () => {
    setListName(''); setListDesc(''); setListError(null); setNewListOpen(true)
  }
  const runNewList = () => {
    const name = listName.trim()
    if (!name) { setListError('Name the list'); return }
    startTransition(async () => {
      const res = await saveCurrentFilterAsViewAction({
        name, description: listDesc.trim() || undefined, filters: activeFilters,
      })
      if (!res.ok) { setListError(res.error); return }
      setNewListOpen(false)
      router.push(res.id ? `/admin/crm?view=${res.id}` : '/admin/crm')
    })
  }

  const openEdit = () => {
    if (!appliedView) return
    setListName(appliedView.name)
    setListDesc(appliedView.description ?? '')
    setListShared(appliedView.isShared)
    setListError(null)
    setEditOpen(true)
  }
  const runEditSave = () => {
    if (!appliedView) return
    const name = listName.trim()
    if (!name) { setListError('Name is required'); return }
    startTransition(async () => {
      const res = await updateSavedViewAction({ id: appliedView.id, name, description: listDesc.trim() || null })
      if (!res.ok) { setListError(res.error); return }
      if (listShared !== appliedView.isShared) {
        const share = await setSavedViewSharedAction({ id: appliedView.id, shared: listShared })
        if (!share.ok) { setListError(share.error); return }
      }
      setEditOpen(false)
      startTransition(() => router.refresh())
    })
  }
  const runEditDelete = () => {
    if (!appliedView) return
    startTransition(async () => {
      const res = await deleteSavedViewAction({ id: appliedView.id })
      if (!res.ok) { setListError(res.error); return }
      setEditOpen(false)
      router.push('/admin/crm')
    })
  }

  /** §9.8 Update List: commit the current filter bag as the list's definition. */
  const runUpdateList = () => {
    if (!appliedView) return
    startTransition(async () => {
      const res = await updateSavedViewFilterAction({
        id: appliedView.id,
        filters: { q: filters.q, stage: filters.stage, tagsAny: filters.tagsAny },
      })
      if (!res.ok) { setListError(res.error); return }
      setUpdateDone(true)
      setTimeout(() => setUpdateDone(false), 2500)
      startTransition(() => router.refresh())
    })
  }

  const visibleCols = new Set(columns)
  const colSpan = 2 + columns.length

  return (
    <div className="flex min-w-0 flex-1 items-start gap-6">
      {/* ── CENTRE: header + toolbar + table + pagination ─────────────────── */}
      <div className="min-w-0 flex-1">

        {/* §4 header */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {appliedView ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="truncate text-xl font-bold" style={{ color: 'var(--a-text)' }}>{appliedView.name}</h1>
                  <StateWord state="accent">{appliedView.collectionLabel}</StateWord>
                  {appliedView.canEdit ? (
                    <Button
                      className="av2-textlink"
                      style={{ fontSize: 'var(--a-text-sm)' }}
                      onClick={openEdit}
                    >
                      <Pencil className="h-3 w-3" aria-hidden />
                      Edit
                    </Button>
                  ) : null}
                </div>
                {appliedView.description ? (
                  <p className={cn('mt-1 max-w-2xl text-sm', descExpanded ? '' : 'line-clamp-1')} style={MUTED}>
                    {appliedView.description}{' '}
                    <Button
                      className="av2-textlink"
                      style={{ fontSize: 'inherit' }}
                      onClick={() => setDescExpanded((e) => !e)}
                    >
                      {descExpanded ? 'Less' : 'More'}
                    </Button>
                  </p>
                ) : null}
                <p className="mt-1 text-sm tabular-nums" style={MUTED}>
                  Showing {total.toLocaleString('en-US')} {total === 1 ? 'person' : 'people'}
                </p>
              </>
            ) : (
              <>
                <h1 className="text-xl font-bold" style={{ color: 'var(--a-text)' }}>Recently updated</h1>
                <p className="mt-1 text-sm tabular-nums" style={MUTED}>
                  {totalExact
                    ? `Showing ${total.toLocaleString('en-US')} ${total === 1 ? 'person' : 'people'}`
                    : 'Newest activity first'}
                </p>
              </>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Button
              data-tour="crm-add-person"
              onClick={() => setAddOpen(true)}
              style={BAR_BTN}
            >
              <UserRoundPlus className="h-4 w-4" aria-hidden />
              New contact
            </Button>
            {appliedView ? (
              appliedView.canEdit ? (
                <Button variant="quiet" style={BAR_BTN} onClick={runUpdateList} disabled={isPending}>
                  {isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden /> : <RefreshCw className="mr-1.5 h-3.5 w-3.5" aria-hidden />}
                  {updateDone ? 'List updated' : 'Update List'}
                </Button>
              ) : null
            ) : (
              <Button variant="quiet" style={BAR_BTN} onClick={openNewList}>
                <Plus className="mr-1 h-3.5 w-3.5" aria-hidden />
                New List
              </Button>
            )}
          </div>
        </div>

        {/* §5 toolbar row */}
        <div data-tour="crm-toolbar" className="mt-3 flex flex-wrap items-center gap-2">
          <SmartListHelp />

          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="quiet" className="gap-1" style={BAR_BTN}
              onClick={() => { setPanel('columns'); setPanelOpen(true) }}
            >
              <Columns3 className="h-3.5 w-3.5" style={MUTED} aria-hidden />
              Columns
              <ChevronDown className="h-3 w-3" style={MUTED} aria-hidden />
            </Button>
            <ScopeDropdown
              brokers={brokers}
              ponds={ponds}
              myBrokerSlug={myBrokerSlug}
              currentBroker={currentBroker}
              currentPond={currentPond}
              carry={{ q: urlFilters.q, stage: urlFilters.stage, tag: urlFilters.tag, view: carry.view }}
            />
            <Button
              variant="quiet" className="gap-1 tabular-nums" style={BAR_BTN}
              onClick={() => {
                if (panel !== 'filters') { setPanel('filters'); setPanelOpen(true) }
                else setPanelOpen((o) => !o)
              }}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" style={MUTED} aria-hidden />
              Filters{filterCount > 0 ? ` (${filterCount})` : ''}
            </Button>
          </div>
        </div>

        {/* §5 bulk icon strip — visible above the table even before selection */}
        <div className="mt-2 flex items-center justify-end gap-1">
          <IconButton label="Batch Email" onClick={() => bulkRef.current?.openAction('email_cohort')}>
            <Mail className="h-4 w-4" aria-hidden />
          </IconButton>
          <Link href="/admin/crm/import" className="av2-iconbtn" aria-label="Import" title="Import">
            <Upload className="h-4 w-4" aria-hidden />
          </Link>
          {/* title on the WRAPPER: every other control in this strip shows a
              hover tooltip (IconButton mirrors its label into title, the import
              Link carries its own), and Menu owns its trigger button, so the
              tooltip is attached to the ancestor the browser walks up to. The
              accessible name stays the trigger's aria-label. */}
          <span title="Tags" className="inline-flex">
            <Menu
              label="Tag actions"
              align="end"
              trigger={<Tag className="h-4 w-4" aria-hidden />}
              items={[
                { label: 'Add Tags', onSelect: () => bulkRef.current?.openAction('add_tag') },
                { label: 'Remove Tags', onSelect: () => bulkRef.current?.openAction('remove_tag') },
              ]}
            />
          </span>
          {canAssignBroker ? (
            <IconButton label="Delete" onClick={() => bulkRef.current?.openAction('delete_contacts')}>
              <Trash2 className="h-4 w-4" aria-hidden />
            </IconButton>
          ) : null}
          <IconButton label="Export Selected People" onClick={() => setExportOpen(true)}>
            <Download className="h-4 w-4" aria-hidden />
          </IconButton>
        </div>

        {/* §6/§13 table */}
        <div
          data-tour="crm-table"
          className="mt-2 overflow-x-auto no-scrollbar rounded-lg"
          style={{ border: '1px solid var(--a-border)', background: 'var(--a-surface)' }}
        >
          <table className="w-full" style={{ fontSize: 'var(--a-text-md)', color: 'var(--a-text)' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--a-border)' }}>
                <th className="h-10 w-10 pl-3 text-left align-middle font-medium">
                  <SelectAllCheck allOnPage={allOnPage} someOnPage={someOnPage} onToggle={toggleAll} />
                </th>
                <th className="h-10 px-2 text-left align-middle whitespace-nowrap text-xs font-medium uppercase tracking-wide" style={MUTED}>Name</th>
                {columns.map((c) => (
                  <th key={c} className="h-10 px-2 text-left align-middle whitespace-nowrap text-xs font-medium uppercase tracking-wide" style={MUTED}>
                    {COLUMN_HEADER[c]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                /* §12.3 empty state — column headers stay visible */
                <tr>
                  <td colSpan={colSpan} className="p-2 py-14 text-center align-middle">
                    <UserRound className="mx-auto h-8 w-8" style={DASH} aria-hidden />
                    <p className="mt-2 text-sm font-medium" style={{ color: 'var(--a-text)' }}>No people found</p>
                    <p className="mt-0.5 text-xs" style={MUTED}>No people match filters, try another search</p>
                  </td>
                </tr>
              ) : (
                rows.map((p) => (
                  <PeopleTableRow
                    key={p.id}
                    row={p}
                    selected={selected.has(p.id)}
                    onToggle={() => toggle(p.id)}
                    visibleCols={visibleCols}
                    columns={columns}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="mt-4 flex items-center justify-between text-sm" style={MUTED}>
          <span className="tabular-nums">
            {total === 0 ? '0' : `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)}`} of {total.toLocaleString('en-US')}
          </span>
          <div className="flex gap-2">
            {pageHrefPrev ? (
              <Link href={pageHrefPrev}><Button variant="quiet" style={PAGE_BTN}>Previous</Button></Link>
            ) : null}
            {pageHrefNext && page < lastPage ? (
              <Link href={pageHrefNext}><Button variant="quiet" style={PAGE_BTN}>Next</Button></Link>
            ) : null}
          </div>
        </div>
      </div>

      {/* ── RIGHT: persistent filter panel / column chooser slot (§2/§9) ────── */}
      {panelOpen ? (
        <aside
          className="w-[290px] shrink-0 rounded-lg p-3"
          style={{ border: '1px solid var(--a-border)', background: 'var(--a-surface)' }}
          data-testid="people-right-panel"
        >
          {panel === 'columns' ? (
            <ColumnChooser
              visible={columns}
              onToggle={toggleColumn}
              onReset={resetColumns}
              onClose={() => setPanel('filters')}
            />
          ) : (
            <FilterPanel
              filters={filters}
              stageOptions={stageOptions}
              tagOptions={tagOptions}
              neighborhoodOptions={neighborhoodOptions}
              carry={carry}
            />
          )}
        </aside>
      ) : null}

      {/* §14 bulk bar */}
      <BulkActions
        ref={bulkRef}
        selectedIds={selectedIds}
        onClear={() => setSelected(new Set())}
        barClassName="bottom-16 lg:bottom-0 max-md:hidden"
        activeFilters={activeFilters}
        activeViewId={activeViewId}
        matchingTotal={total}
        canAssignBroker={canAssignBroker}
        brokers={brokerPicker}
        stages={stageOptions}
        tags={tagOptions}
        reportAreas={reportAreas}
        emailTemplates={emailTemplates}
        sequences={sequences}
        ponds={ponds.map((p) => ({ key: String(p.id), label: p.name }))}
        sources={sourceOptions}
        selectedRows={rows.map((r) => ({ id: r.id, name: r.name }))}
        onExport={() => setExportOpen(true)}
      />

      {/* §16 Add Person */}
      <AddPersonDialog
        open={addOpen}
        onOpenChange={setAddOpen}
      />

      {/* §15 Export Selected People */}
      <ExportPeopleDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        selectedIds={selectedIds}
        count={selectedIds.length > 0 ? selectedIds.length : total}
        filterExportHref={filterExportHref}
      />

      {/* §4 Save New Smart List */}
      <Dialog
        open={newListOpen}
        onClose={() => setNewListOpen(false)}
        title="Save New Smart List"
        description="Saves the current filters as a named list in the sidebar."
        footer={
          <>
            <Button variant="quiet" style={BAR_BTN} onClick={() => setNewListOpen(false)} disabled={isPending}>Cancel</Button>
            <Button style={BAR_BTN} onClick={runNewList} disabled={isPending}>
              {isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden /> : null}
              Save List
            </Button>
          </>
        }
      >
        <TextField
          label="Name"
          value={listName}
          onChange={(e) => setListName(e.target.value)}
          placeholder="Bend sellers, no recent activity"
        />
        <div>
          <TextAreaField
            label="Description (optional)"
            value={listDesc}
            onChange={(e) => setListDesc(e.target.value)}
            rows={3}
            maxLength={1000}
          />
          <p className="mt-1 text-right text-[11px] tabular-nums" style={MUTED}>{listDesc.length}/1000</p>
        </div>
        {listError ? <p className="text-xs" style={{ color: 'var(--a-danger)' }} role="alert">{listError}</p> : null}
      </Dialog>

      {/* §11 Edit Smart List */}
      <Dialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit Smart List"
        description="Name, description and sharing. Filters are saved from the People view via Update List."
        footer={
          <div className="flex w-full items-center justify-between gap-2">
            <Button variant="danger" style={BAR_BTN} onClick={runEditDelete} disabled={isPending}>
              <Trash2 className="mr-1.5 h-3.5 w-3.5" aria-hidden />
              Delete
            </Button>
            <div className="flex gap-2">
              <Button variant="quiet" style={BAR_BTN} onClick={() => setEditOpen(false)} disabled={isPending}>Cancel</Button>
              <Button style={BAR_BTN} onClick={runEditSave} disabled={isPending}>
                {isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden /> : null}
                Save List
              </Button>
            </div>
          </div>
        }
      >
        <TextField label="Name" value={listName} onChange={(e) => setListName(e.target.value)} />
        <div>
          <TextAreaField
            label="Description"
            value={listDesc}
            onChange={(e) => setListDesc(e.target.value)}
            rows={4}
            maxLength={1000}
          />
          <p className="mt-1 text-right text-[11px] tabular-nums" style={MUTED}>{listDesc.length}/1000</p>
        </div>
        {/* The caption is a real <label for> again. It was a plain <div>, so
            clicking the words did nothing — the whole row used to be one label
            wrapping the control. It cannot wrap this one (Switch already IS a
            <label>), so the association runs through `for`/`id` instead; a
            control may carry more than one label, and the switch's own
            aria-label still supplies the accessible name. */}
        <div className="flex items-center justify-between gap-2 text-sm" style={{ color: 'var(--a-text)' }}>
          <label htmlFor="el-share" className="cursor-pointer">Share smart list with the team</label>
          <Switch
            id="el-share"
            label="Share with the team"
            labelHidden
            checked={listShared}
            onChange={(e) => setListShared(e.target.checked)}
          />
        </div>
        <p className="text-xs" style={MUTED}>
          Sharing a list never shares contact access — each broker sees only the contacts they
          have permission to see.
        </p>
        {listError ? <p className="text-xs" style={{ color: 'var(--a-danger)' }} role="alert">{listError}</p> : null}
      </Dialog>
    </div>
  )
}

// ── §5 explainer ─────────────────────────────────────────────────────────────

/**
 * SmartListHelp — "How Smart Lists work", as a NON-MODAL popover.
 *
 * A help link may not take the page hostage. The modal Dialog this briefly
 * became made every row, filter and toolbar control behind it inert and
 * required Esc or the Close button before the broker could touch anything
 * again — for one paragraph of explanation. So the panel is anchored to its
 * trigger, dismisses on outside click or Escape (returning focus to the
 * trigger), and leaves the list underneath fully live. Copy verbatim.
 */
function SmartListHelp() {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const onDocDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOpen(false); triggerRef.current?.focus() }
    }
    document.addEventListener('mousedown', onDocDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={wrapRef} className="relative">
      <Button
        ref={triggerRef}
        className="av2-textlink"
        style={{ fontSize: 'var(--a-text-xs)' }}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <HelpCircle className="h-3.5 w-3.5" aria-hidden />
        How Smart Lists work
      </Button>
      {open ? (
        <div
          className="absolute left-0 top-full z-30 mt-1 w-72 rounded-lg p-3"
          style={{
            background: 'var(--a-bg)',
            border: '1px solid var(--a-border)',
            boxShadow: 'var(--a-shadow-overlay)',
            color: 'var(--a-text)',
            fontSize: 'var(--a-text-sm)',
            lineHeight: 'var(--a-leading)',
          }}
        >
          A smart list is a saved filter over your contacts. Dynamic lists re-evaluate every time
          you open them, so people flow in and out as their data changes. Edit a list&apos;s filters in
          the panel on the right, then press Update List to save them. Counts in the sidebar are
          live and scoped to what you can see.
        </div>
      ) : null}
    </div>
  )
}

// ── §6 select-all ────────────────────────────────────────────────────────────

/**
 * SelectAllCheck — the header checkbox, including its MIXED state.
 *
 * `indeterminate` is a DOM property with no HTML attribute behind it, so it has
 * to be written onto the input; the ref sits on the wrapper because ToolbarCheck
 * owns the input element. Without it a partly-selected page rendered as a plain
 * empty box and a broker could not tell "none selected" from "some selected" —
 * one click away from clearing a selection they meant to extend.
 */
function SelectAllCheck({
  allOnPage, someOnPage, onToggle,
}: {
  allOnPage: boolean
  someOnPage: boolean
  onToggle: () => void
}) {
  const wrapRef = useRef<HTMLSpanElement>(null)
  const mixed = !allOnPage && someOnPage

  useEffect(() => {
    const input = wrapRef.current?.querySelector('input')
    if (input) input.indeterminate = mixed
  }, [mixed])

  return (
    <span ref={wrapRef} className="inline-flex">
      <ToolbarCheck
        label=""
        checked={allOnPage}
        aria-checked={mixed ? 'mixed' : undefined}
        onChange={onToggle}
        aria-label="Select all on page"
      />
    </span>
  )
}

// ── Table row (§13 anatomy) ──────────────────────────────────────────────────

const COLUMN_HEADER: Record<PeopleColumnKey, string> = {
  leadScore: 'Lead Score',
  agent: 'Agent',
  lastVisit: 'Last Visit',
  phone: 'Phone',
  email: 'Email',
  lastActivity: 'Last Activity',
  tags: 'Tags',
  created: 'Created',
  stage: 'Stage',
  source: 'Source',
  price: 'Price',
  timeframe: 'Timeframe',
}

const ACTIVITY_ICON: Record<
  ActivityIconKind,
  React.ComponentType<{ className?: string; style?: CSSProperties; 'aria-hidden'?: boolean }>
> = {
  view: Flame,
  inquiry: House,
  message: MessageSquare,
  call: PhoneIcon,
  lead: UserRound,
  other: Activity,
}

/**
 * Initials for the avatar fallback: the first letter of the first TWO words.
 *
 * NOT the shared crmInitials, which takes first + LAST word — that renames
 * people the moment a middle name or a two-part surname is in the field ("Ana
 * Maria Lopez" reads AM here and AL there) and returns '?' for an empty string
 * where this returns nothing. Two avatar helpers disagreeing about the same
 * contact across two screens is worse than one extra function.
 */
function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('')
}

/**
 * PeopleAvatar — CrmAvatar owns the photo case (identical markup, identical
 * crop); only the no-photo fallback is local, because that is the one branch
 * where the initials algorithm above is visible.
 */
function PeopleAvatar({ name, src, size }: { name: string; src: string | null; size: number }) {
  // A broken photo URL must fall back to initials. The Radix <Avatar> this
  // replaced rendered <AvatarFallback> whenever the image was not 'loaded' —
  // during load AND on a 404 — so a stale Google/Gravatar picture_url still
  // showed initials. A bare <img> shows an empty gap instead, in the Name and
  // Agent columns of the busiest table in the admin. `failed` restores that.
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [src])

  // Floor the glyph at the smallest type token: at size 20 (the agent cell)
  // 0.36 computes to 7px, under --a-text-xs (11px).
  const glyph = Math.max(11, Math.round(size * 0.36))

  if (src && !failed) {
    return (
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        onError={() => setFailed(true)}
        // object-top, per G49: the 2:3 broker headshots centre-crop to the
        // torso in a circle and lose the head. CrmAvatar carries the same rule.
        className="shrink-0 rounded-full object-cover object-top"
        style={{ width: size, height: size, background: 'var(--a-inset)' }}
      />
    )
  }
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full font-semibold"
      style={{
        width: size, height: size,
        background: 'var(--a-inset)', color: 'var(--a-text)',
        fontSize: glyph,
      }}
    >
      {initials(name)}
    </span>
  )
}

function PeopleTableRow({
  row: p, selected, onToggle, visibleCols, columns,
}: {
  row: PeopleRow
  selected: boolean
  onToggle: () => void
  visibleCols: Set<PeopleColumnKey>
  columns: PeopleColumnKey[]
}) {
  const name = p.name ?? `Contact #${p.id}`
  const displayPhone = p.phone ? fmtPhoneDotted(p.phone) : null

  const cell = (key: PeopleColumnKey): React.ReactNode => {
    switch (key) {
      case 'leadScore':
        /* No lead-score model yet — honest em-dash placeholder (§0). */
        return <span style={DASH}>—</span>
      case 'agent':
        return p.agentLabel ? (
          <span className="flex items-center gap-1.5">
            <PeopleAvatar name={p.agentLabel} src={p.agentHeadshot} size={20} />
            <span className="text-xs" style={{ color: 'var(--a-text)' }}>{p.agentLabel}</span>
          </span>
        ) : <span style={DASH}>—</span>
      case 'lastVisit':
        return p.lastVisitLabel
          ? <span className="text-xs tabular-nums" style={MUTED}>{p.lastVisitLabel}</span>
          : <span style={DASH}>—</span>
      case 'phone':
        return displayPhone ? (
          <span className="flex items-center gap-1.5">
            <span className="text-xs tabular-nums" style={{ color: 'var(--a-text)' }}>{displayPhone}</span>
            {/* §6: two icons PERMANENTLY visible — SMS + call */}
            <a
              href={`sms:${p.phone}`}
              aria-label={`Text ${name}`}
              title="Text"
              className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full hover:opacity-80"
              style={{ background: 'var(--a-ok)', color: 'var(--a-bg)' }}
            >
              <MessageSquare className="h-2.5 w-2.5" aria-hidden />
            </a>
            <a
              href={`tel:${p.phone}`}
              aria-label={`Call ${name}`}
              title="Call"
              className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full hover:opacity-80"
              style={{ background: 'var(--a-btn-bg)', color: 'var(--a-btn-fg)' }}
            >
              <PhoneIcon className="h-2.5 w-2.5" aria-hidden />
            </a>
          </span>
        ) : <span className="text-xs" style={DASH}>—</span>
      case 'email':
        return p.email
          ? <a href={`mailto:${p.email}`} className="text-xs hover:underline" style={MUTED}>{p.email}</a>
          : <span className="text-xs" style={DASH}>—</span>
      case 'lastActivity': {
        if (!p.lastActivity) return <span className="text-xs" style={DASH}>—</span>
        const Icon = ACTIVITY_ICON[p.lastActivity.icon]
        return (
          <span className="flex items-center gap-1.5">
            <Icon
              className="h-3.5 w-3.5 shrink-0"
              style={{ color: p.lastActivity.icon === 'view' ? 'var(--a-warn)' : p.lastActivity.icon === 'inquiry' ? 'var(--a-ok)' : 'var(--a-text-2)' }}
              aria-hidden
            />
            <span className="max-w-44 truncate text-xs" style={MUTED}>{p.lastActivity.label}</span>
            <span className="whitespace-nowrap text-xs tabular-nums" style={MUTED}>{p.lastActivity.dateLabel}</span>
          </span>
        )
      }
      case 'tags': {
        if (p.tags.length === 0) return <span className="text-xs" style={DASH}>—</span>
        const shown = p.tags.slice(0, 2)
        const more = p.tags.length - shown.length
        return (
          <span className="flex items-center gap-1">
            {shown.map((t) => (
              <span key={t} className="text-[10px]" style={TAG_WORD}>{t}</span>
            ))}
            {more > 0 ? (
              <span className="text-[10px]" style={MUTED} title={p.tags.slice(2).join(', ')}>+{more} more</span>
            ) : null}
          </span>
        )
      }
      case 'created':
        return p.createdLabel
          ? <span className="text-xs tabular-nums" style={MUTED}>{p.createdLabel}</span>
          : <span style={DASH}>—</span>
      case 'stage':
        return <span className="text-[10px] font-semibold" style={STAGE_WORD}>{p.stage}</span>
      case 'source':
        return p.source
          ? <span className="text-xs" style={MUTED}>{p.source}</span>
          : <span style={DASH}>—</span>
      case 'price':
        /* Brand rule: currency rounded to the nearest thousand. */
        return p.price != null
          ? <span className="text-xs tabular-nums" style={{ color: 'var(--a-text)' }}>${(Math.round(p.price / 1000) * 1000).toLocaleString('en-US')}</span>
          : <span style={DASH}>—</span>
      case 'timeframe':
        return p.timeframe
          ? <span className="text-xs" style={MUTED}>{p.timeframe}</span>
          : <span style={DASH}>—</span>
    }
  }

  return (
    <tr
      data-state={selected ? 'selected' : undefined}
      /* The selected wash is a CLASS, not an inline style. Inline wins over
         every stylesheet rule, so `background: selected ? …` silently killed
         the hover tint on exactly the rows a broker is working through — the
         row under the cursor stopped responding once it was ticked. As classes
         the hover variant outranks the base by specificity, both survive. */
      className={cn('group/row hover:bg-[var(--a-inset)]', selected && 'bg-[var(--a-accent-wash)]')}
      style={{ borderBottom: '1px solid var(--a-border)' }}
    >
      <td className="p-2 pl-3 align-middle">
        <ToolbarCheck label="" checked={selected} onChange={onToggle} aria-label={`Select ${name}`} />
      </td>
      {/* Name + avatar + source sub-label (§13) */}
      <td className="min-w-44 p-2 align-middle">
        <Link href={`/admin/people/${p.id}`} className="flex items-center gap-2.5 hover:underline">
          <PeopleAvatar name={name} src={p.picture_url} size={32} />
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold" style={{ color: 'var(--a-text)' }}>{name}</span>
            {p.source ? <span className="block truncate text-xs font-normal" style={MUTED}>{p.source}</span> : null}
          </span>
        </Link>
      </td>
      {columns.filter((c) => visibleCols.has(c)).map((c) => (
        <td key={c} className="p-2 align-middle whitespace-nowrap">{cell(c)}</td>
      ))}
    </tr>
  )
}
