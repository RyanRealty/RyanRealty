'use client'

/**
 * PeopleListView — the §05 People list main area + persistent right panel
 * (docs/fub-crm-spec/05-people-list-and-bulk-actions.md).
 *
 * Owns everything to the right of the §3 sidebar:
 *   - §4 header: "All People" h1 + "Showing N people" + "+ New List" (All
 *     People) OR the smart-list header (name · collection badge · Edit ·
 *     description More/Less · "Update List ↻") — mutually exclusive slots.
 *   - §5 toolbar: "? How Smart Lists work" · Columns ▾ · Me ▾ · Filters (N),
 *     plus the always-visible bulk icon strip (email/import/tag/delete/export).
 *   - §6/§13 table: checkbox · Name(+avatar+source) · Lead Score · Agent ·
 *     Last Visit · Phone (permanent SMS+call icons) · Email · Last Activity
 *     (type icon + description + FUB date) · Tags — column set configurable
 *     per list via the §8 chooser.
 *   - §9 persistent right filter panel (column chooser swaps into the slot).
 *   - §14 multi-select bulk bar (BulkActions), §15 export modal, §16 Add
 *     Person modal, §11 Edit Smart List modal.
 *
 * All data arrives server-fetched (listCrmPeople + getPeopleListSignals under
 * the caller's frozen broker scope); this island only owns view state.
 */

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  HelpCircle, ChevronDown, Columns3, SlidersHorizontal, UserRoundPlus, Plus,
  RefreshCw, Loader2, Mail, Upload, Tag, Trash2, Download, Flame, House,
  MessageSquare, Phone as PhoneIcon, UserRound, Activity, Pencil,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
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
  /** §6 col 5 — formatted FUB date ('' when no visit data). */
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
}

export default function PeopleListView(props: PeopleListViewProps) {
  const {
    rows, total, page, pageSize, lastPage, pageHrefPrev, pageHrefNext,
    appliedView, activeViewId, filters, urlFilters, activeFilters,
    currentBroker, currentPond, myBrokerSlug, canAssignBroker,
    brokers, ponds, stageOptions, tagOptions, neighborhoodOptions, sourceOptions,
    reportAreas, emailTemplates, sequences, brokerPicker, filterExportHref,
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
                  <h1 className="truncate text-xl font-bold text-foreground">{appliedView.name}</h1>
                  <Badge className="uppercase tracking-wide">{appliedView.collectionLabel}</Badge>
                  {appliedView.canEdit ? (
                    <button
                      type="button"
                      onClick={openEdit}
                      className="inline-flex items-center gap-1 text-sm text-primary underline-offset-2 hover:underline"
                    >
                      <Pencil className="h-3 w-3" aria-hidden />
                      Edit
                    </button>
                  ) : null}
                </div>
                {appliedView.description ? (
                  <p className={cn('mt-1 max-w-2xl text-sm text-muted-foreground', descExpanded ? '' : 'line-clamp-1')}>
                    {appliedView.description}{' '}
                    <button
                      type="button"
                      className="text-primary underline-offset-2 hover:underline"
                      onClick={() => setDescExpanded((e) => !e)}
                    >
                      {descExpanded ? 'Less' : 'More'}
                    </button>
                  </p>
                ) : null}
                <p className="mt-1 text-sm text-muted-foreground tabular-nums">
                  Showing {total.toLocaleString('en-US')} {total === 1 ? 'person' : 'people'}
                </p>
              </>
            ) : (
              <>
                <h1 className="text-xl font-bold text-foreground">All People</h1>
                <p className="mt-1 text-sm text-muted-foreground tabular-nums">
                  Showing {total.toLocaleString('en-US')} {total === 1 ? 'person' : 'people'}
                </p>
              </>
            )}
          </div>

          {/* §4: "+ New List" (All People) XOR "Update List ↻" (smart list) */}
          <div className="flex shrink-0 items-center gap-2">
            <Button
              size="icon"
              variant="outline"
              className="h-8 w-8"
              aria-label="Add Person"
              title="Add Person"
              onClick={() => setAddOpen(true)}
            >
              <UserRoundPlus className="h-4 w-4" aria-hidden />
            </Button>
            {appliedView ? (
              appliedView.canEdit ? (
                <Button size="sm" className="h-8" onClick={runUpdateList} disabled={isPending}>
                  {isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden /> : <RefreshCw className="mr-1.5 h-3.5 w-3.5" aria-hidden />}
                  {updateDone ? 'List updated' : 'Update List'}
                </Button>
              ) : null
            ) : (
              <Button size="sm" className="h-8" onClick={openNewList}>
                <Plus className="mr-1 h-3.5 w-3.5" aria-hidden />
                New List
              </Button>
            )}
          </div>
        </div>

        {/* §5 toolbar row */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <button type="button" className="inline-flex items-center gap-1 text-xs text-primary underline-offset-2 hover:underline">
                <HelpCircle className="h-3.5 w-3.5" aria-hidden />
                How Smart Lists work
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="max-w-72 text-xs leading-relaxed">
              A smart list is a saved filter over your contacts. Dynamic lists re-evaluate every time
              you open them, so people flow in and out as their data changes. Edit a list&apos;s filters in
              the panel on the right, then press Update List to save them. Counts in the sidebar are
              live and scoped to what you can see.
            </PopoverContent>
          </Popover>

          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="outline" size="sm" className="h-8 gap-1 px-2.5 text-xs"
              onClick={() => { setPanel('columns'); setPanelOpen(true) }}
            >
              <Columns3 className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
              Columns
              <ChevronDown className="h-3 w-3 text-muted-foreground" aria-hidden />
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
              variant="outline" size="sm" className="h-8 gap-1 px-2.5 text-xs tabular-nums"
              onClick={() => {
                if (panel !== 'filters') { setPanel('filters'); setPanelOpen(true) }
                else setPanelOpen((o) => !o)
              }}
            >
              <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
              Filters{filterCount > 0 ? ` (${filterCount})` : ''}
            </Button>
          </div>
        </div>

        {/* §5 bulk icon strip — visible above the table even before selection */}
        <div className="mt-2 flex items-center justify-end gap-1">
          <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground" aria-label="Batch Email" title="Batch Email" onClick={() => bulkRef.current?.openAction('email_cohort')}>
            <Mail className="h-4 w-4" aria-hidden />
          </Button>
          <Link href="/admin/crm/import" className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground" aria-label="Import" title="Import">
            <Upload className="h-4 w-4" aria-hidden />
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground" aria-label="Tag actions" title="Tags">
                <Tag className="h-4 w-4" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onSelect={() => bulkRef.current?.openAction('add_tag')}>Add Tags</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => bulkRef.current?.openAction('remove_tag')}>Remove Tags</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {canAssignBroker ? (
            <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground" aria-label="Delete" title="Delete" onClick={() => bulkRef.current?.openAction('delete_contacts')}>
              <Trash2 className="h-4 w-4" aria-hidden />
            </Button>
          ) : null}
          <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground" aria-label="Export Selected People" title="Export Selected People" onClick={() => setExportOpen(true)}>
            <Download className="h-4 w-4" aria-hidden />
          </Button>
        </div>

        {/* §6/§13 table */}
        <div className="mt-2 overflow-x-auto no-scrollbar rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-border">
                <TableHead className="w-10 pl-3">
                  <Checkbox
                    checked={allOnPage ? true : someOnPage ? 'indeterminate' : false}
                    onCheckedChange={toggleAll}
                    aria-label="Select all on page"
                  />
                </TableHead>
                <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Name</TableHead>
                {columns.map((c) => (
                  <TableHead key={c} className="whitespace-nowrap text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {COLUMN_HEADER[c]}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                /* §12.3 empty state — column headers stay visible */
                <TableRow>
                  <TableCell colSpan={colSpan} className="py-14 text-center">
                    <UserRound className="mx-auto h-8 w-8 text-muted-foreground/40" aria-hidden />
                    <p className="mt-2 text-sm font-medium text-foreground">No people found</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">No people match filters, try another search</p>
                  </TableCell>
                </TableRow>
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
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
          <span className="tabular-nums">
            {total === 0 ? '0' : `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)}`} of {total.toLocaleString('en-US')}
          </span>
          <div className="flex gap-2">
            {pageHrefPrev ? (
              <Link href={pageHrefPrev}><Button variant="outline" size="sm" className="h-7 px-2.5">Previous</Button></Link>
            ) : null}
            {pageHrefNext && page < lastPage ? (
              <Link href={pageHrefNext}><Button variant="outline" size="sm" className="h-7 px-2.5">Next</Button></Link>
            ) : null}
          </div>
        </div>
      </div>

      {/* ── RIGHT: persistent filter panel / column chooser slot (§2/§9) ────── */}
      {panelOpen ? (
        <aside className="w-[290px] shrink-0 rounded-lg border border-border bg-card p-3" data-testid="people-right-panel">
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
      <AddPersonDialog open={addOpen} onOpenChange={setAddOpen} sources={sourceOptions} />

      {/* §15 Export Selected People */}
      <ExportPeopleDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        selectedIds={selectedIds}
        count={selectedIds.length > 0 ? selectedIds.length : total}
        filterExportHref={filterExportHref}
      />

      {/* §4 Save New Smart List */}
      <Dialog open={newListOpen} onOpenChange={setNewListOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Save New Smart List</DialogTitle>
            <DialogDescription>Saves the current filters as a named list in the sidebar.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="nl-name" className="mb-1.5 block text-xs text-muted-foreground">Name</Label>
              <Input id="nl-name" value={listName} onChange={(e) => setListName(e.target.value)} placeholder="Bend sellers, no recent activity" className="h-9" />
            </div>
            <div>
              <Label htmlFor="nl-desc" className="mb-1.5 block text-xs text-muted-foreground">Description (optional)</Label>
              <Textarea id="nl-desc" value={listDesc} onChange={(e) => setListDesc(e.target.value)} rows={3} maxLength={1000} />
              <p className="mt-1 text-right text-[11px] tabular-nums text-muted-foreground">{listDesc.length}/1000</p>
            </div>
            {listError ? <p className="text-xs text-destructive" role="alert">{listError}</p> : null}
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setNewListOpen(false)} disabled={isPending}>Cancel</Button>
            <Button size="sm" onClick={runNewList} disabled={isPending}>
              {isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden /> : null}
              Save List
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* §11 Edit Smart List */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Smart List</DialogTitle>
            <DialogDescription>
              Name, description and sharing. Filters are saved from the People view via Update List.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="el-name" className="mb-1.5 block text-xs text-muted-foreground">Name</Label>
              <Input id="el-name" value={listName} onChange={(e) => setListName(e.target.value)} className="h-9" />
            </div>
            <div>
              <Label htmlFor="el-desc" className="mb-1.5 block text-xs text-muted-foreground">Description</Label>
              <Textarea id="el-desc" value={listDesc} onChange={(e) => setListDesc(e.target.value)} rows={4} maxLength={1000} />
              <p className="mt-1 text-right text-[11px] tabular-nums text-muted-foreground">{listDesc.length}/1000</p>
            </div>
            <Label className="flex items-center justify-between gap-2 text-sm font-normal">
              Share smart list with the team
              <Switch checked={listShared} onCheckedChange={setListShared} aria-label="Share with the team" />
            </Label>
            <p className="text-xs text-muted-foreground">
              Sharing a list never shares contact access — each broker sees only the contacts they
              have permission to see.
            </p>
            {listError ? <p className="text-xs text-destructive" role="alert">{listError}</p> : null}
          </div>
          <DialogFooter className="sm:justify-between">
            <Button variant="destructive" size="sm" onClick={runEditDelete} disabled={isPending}>
              <Trash2 className="mr-1.5 h-3.5 w-3.5" aria-hidden />
              Delete
            </Button>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setEditOpen(false)} disabled={isPending}>Cancel</Button>
              <Button size="sm" onClick={runEditSave} disabled={isPending}>
                {isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden /> : null}
                Save List
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
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

const ACTIVITY_ICON: Record<ActivityIconKind, React.ComponentType<{ className?: string }>> = {
  view: Flame,
  inquiry: House,
  message: MessageSquare,
  call: PhoneIcon,
  lead: UserRound,
  other: Activity,
}

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('')
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
        return <span className="text-muted-foreground/40">—</span>
      case 'agent':
        return p.agentLabel ? (
          <span className="flex items-center gap-1.5">
            <Avatar className="h-5 w-5">
              {p.agentHeadshot ? <AvatarImage src={p.agentHeadshot} alt="" /> : null}
              <AvatarFallback className="text-[9px]">{initials(p.agentLabel)}</AvatarFallback>
            </Avatar>
            <span className="text-xs text-foreground">{p.agentLabel}</span>
          </span>
        ) : <span className="text-muted-foreground/40">—</span>
      case 'lastVisit':
        return p.lastVisitLabel
          ? <span className="text-xs tabular-nums text-muted-foreground">{p.lastVisitLabel}</span>
          : <span className="text-muted-foreground/40">—</span>
      case 'phone':
        return displayPhone ? (
          <span className="flex items-center gap-1.5">
            <span className="text-xs tabular-nums text-foreground">{displayPhone}</span>
            {/* §6: two icons PERMANENTLY visible — SMS + call */}
            <a
              href={`sms:${p.phone}`}
              aria-label={`Text ${name}`}
              title="Text"
              className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success text-success-foreground hover:opacity-80"
            >
              <MessageSquare className="h-2.5 w-2.5" aria-hidden />
            </a>
            <a
              href={`tel:${p.phone}`}
              aria-label={`Call ${name}`}
              title="Call"
              className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground hover:opacity-80"
            >
              <PhoneIcon className="h-2.5 w-2.5" aria-hidden />
            </a>
          </span>
        ) : <span className="text-muted-foreground/40 text-xs">—</span>
      case 'email':
        return p.email
          ? <a href={`mailto:${p.email}`} className="text-xs text-muted-foreground hover:underline">{p.email}</a>
          : <span className="text-muted-foreground/40 text-xs">—</span>
      case 'lastActivity': {
        if (!p.lastActivity) return <span className="text-muted-foreground/40 text-xs">—</span>
        const Icon = ACTIVITY_ICON[p.lastActivity.icon]
        return (
          <span className="flex items-center gap-1.5">
            <Icon className={cn('h-3.5 w-3.5 shrink-0', p.lastActivity.icon === 'view' ? 'text-warning' : p.lastActivity.icon === 'inquiry' ? 'text-success' : 'text-muted-foreground')} aria-hidden />
            <span className="max-w-44 truncate text-xs text-muted-foreground">{p.lastActivity.label}</span>
            <span className="whitespace-nowrap text-xs tabular-nums text-muted-foreground">{p.lastActivity.dateLabel}</span>
          </span>
        )
      }
      case 'tags': {
        if (p.tags.length === 0) return <span className="text-muted-foreground/40 text-xs">—</span>
        const shown = p.tags.slice(0, 2)
        const more = p.tags.length - shown.length
        return (
          <span className="flex items-center gap-1">
            {shown.map((t) => (
              <Badge key={t} variant="secondary" className="max-w-28 truncate px-1.5 py-0 text-[10px]">{t}</Badge>
            ))}
            {more > 0 ? (
              <span className="text-[10px] text-muted-foreground" title={p.tags.slice(2).join(', ')}>+{more} more</span>
            ) : null}
          </span>
        )
      }
      case 'created':
        return p.createdLabel
          ? <span className="text-xs tabular-nums text-muted-foreground">{p.createdLabel}</span>
          : <span className="text-muted-foreground/40">—</span>
      case 'stage':
        return <Badge variant="outline" className="px-1.5 py-0 text-[10px]">{p.stage}</Badge>
      case 'source':
        return p.source
          ? <span className="text-xs text-muted-foreground">{p.source}</span>
          : <span className="text-muted-foreground/40">—</span>
      case 'price':
        /* Brand rule: currency rounded to the nearest thousand. */
        return p.price != null
          ? <span className="text-xs tabular-nums text-foreground">${(Math.round(p.price / 1000) * 1000).toLocaleString('en-US')}</span>
          : <span className="text-muted-foreground/40">—</span>
      case 'timeframe':
        return p.timeframe
          ? <span className="text-xs text-muted-foreground">{p.timeframe}</span>
          : <span className="text-muted-foreground/40">—</span>
    }
  }

  return (
    <TableRow data-state={selected ? 'selected' : undefined} className="group/row">
      <TableCell className="pl-3">
        <Checkbox checked={selected} onCheckedChange={onToggle} aria-label={`Select ${name}`} />
      </TableCell>
      {/* Name + avatar + source sub-label (§13) */}
      <TableCell className="min-w-44">
        <Link href={`/admin/crm/${p.id}`} className="flex items-center gap-2.5 hover:underline">
          <Avatar className="h-8 w-8">
            {p.picture_url ? <AvatarImage src={p.picture_url} alt="" /> : null}
            <AvatarFallback className="text-[11px]">{initials(name)}</AvatarFallback>
          </Avatar>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-foreground">{name}</span>
            {p.source ? <span className="block truncate text-xs font-normal text-muted-foreground">{p.source}</span> : null}
          </span>
        </Link>
      </TableCell>
      {columns.filter((c) => visibleCols.has(c)).map((c) => (
        <TableCell key={c} className="whitespace-nowrap">{cell(c)}</TableCell>
      ))}
    </TableRow>
  )
}
