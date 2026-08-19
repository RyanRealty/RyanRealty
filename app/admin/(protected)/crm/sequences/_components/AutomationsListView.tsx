'use client'

/**
 * AutomationsListView — the §12.2 Automations list (CRM /2/automations/v2),
 * re-skinned to the LOCKED admin v2 language (design_system/admin/ADMIN_UI.md).
 *
 * 11F: migrated off shadcn (Table/Dialog/DropdownMenu/Select/Tooltip/Avatar/
 * Button/Input/Textarea/Switch/Label/Badge/Alert) onto components/admin/v2.
 * PRESENTATION ONLY — every prop, callback, computation, sort/filter default
 * and user-facing string carries over unchanged.
 *
 * Spec: docs/crm-spec/12-action-plans-and-automations.md §12.2 + the
 * pixel reference docs/crm-spec/screens/screen-34.md:
 *   - Header: "Automations" + search + Create Folder (quiet) +
 *     Create Automation (primary → name dialog → routes to the visual editor).
 *   - Folder section: "{N} Folder(s)" label + folder cards ("My Automations /
 *     N Automations"); clicking a card filters the table; user folders get
 *     rename/delete; the system folder has no controls (§12.5.3 pattern).
 *   - "{N} Automations" heading + the 10-column table: Name (link + hover
 *     tooltip), Linked Automations ("Using: N ▾" pill dropdown), Steps,
 *     Started, Engaged ⓘ ("N+ P%"), Completed, Created By (avatar + name),
 *     Status (optimistic toggle), Created On ↕ (sortable, default desc),
 *     Actions (Edit / Duplicate / Move to Folder / Archive / Delete).
 *
 * Working behaviors preserved from the previous list: plan-type badges on the
 * four auto-enroll masters, guarded delete (server refuses live enrollments /
 * masters), archive, the create dialog (name + description + stop-on-reply).
 *
 * Table markup is a hand-rolled div/role grid (ConfigTableEditor.tsx's
 * pattern, av2-rgrid* classes from report-grid.css) plus an av2-cardlist
 * phone fallback — never a raw <table>. The original had no phone layout at
 * all (just a horizontally-scrolling <table>); the fallback is new, added
 * because the v2 language bans <table> outright, not a behavior change.
 *
 * ci:admin-ui rule C (at most one primary-variant v2 <Button> per file):
 * this file's ONE primary is "+ Create Automation" — the page's entry point
 * for the whole surface. Every dialog submit that used to be a default/
 * primary shadcn Button (Create automation, Create/Rename folder, Move) is
 * `variant="quiet"` here instead. Cancel buttons were already quiet-
 * equivalent (outline); Delete stays `variant="danger"`, which rule C does
 * not count as primary.
 *
 * Design-system only: Button, IconButton, Menu, Dialog, ConfirmDialog,
 * TextField, TextAreaField, SelectField, SearchField, Switch, VerdictLine,
 * SectionHead + tokens. No raw HTML controls, no hex, no shadcn/ui imports.
 */

import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition, type CSSProperties } from 'react'
import {
  Button,
  ConfirmDialog,
  Dialog,
  SearchField,
  SectionHead,
  SelectField,
  Switch,
  TextAreaField,
  TextField,
  VerdictLine,
  type AdminMenuItem,
} from '@/components/admin/v2'
import '@/components/admin/v2/report-grid.css'
import { ArrowUpDown, Info, Search } from 'lucide-react'
import {
  AutomationCard,
  AutomationDesktopRow,
  AutomationFolderCard,
  engagedLabel,
  type AutomationFolderItem,
  type AutomationListRow,
  type WorkflowPlanType,
} from './automations-list-bits'

export type { WorkflowPlanType, AutomationFolderItem, AutomationListRow }
export { engagedLabel }

type ActionResult = { ok: true; id?: number } | { ok: false; error: string }

export type AutomationsListActions = {
  create: (input: { name: string; description?: string | null; stopOnReply: boolean }) => Promise<ActionResult>
  duplicate: (id: number) => Promise<ActionResult>
  setStatus: (id: number, status: 'active' | 'paused') => Promise<ActionResult>
  archive: (id: number) => Promise<ActionResult>
  remove: (id: number) => Promise<ActionResult>
  createFolder: (name: string) => Promise<ActionResult>
  renameFolder: (id: number, name: string) => Promise<ActionResult>
  deleteFolder: (id: number) => Promise<ActionResult>
  moveToFolder: (sequenceId: number, folderId: number | null) => Promise<ActionResult>
}

export function AutomationsListView({
  rows,
  folders,
  analyticsUnreadable,
  actions,
}: {
  rows: AutomationListRow[]
  folders: AutomationFolderItem[]
  analyticsUnreadable: boolean
  actions: AutomationsListActions
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [note, setNote] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null)

  const [search, setSearch] = useState('')
  const [activeFolder, setActiveFolder] = useState<number | null>(null)
  const [sortDesc, setSortDesc] = useState(true)
  /** Optimistic status overrides (§12.2.3 col 8 — flip immediately, revert on error). */
  const [statusOverride, setStatusOverride] = useState<Record<number, string>>({})

  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState({ name: '', description: '', stopOnReply: true })
  const [folderDialog, setFolderDialog] = useState<{ mode: 'create' } | { mode: 'rename'; id: number } | null>(null)
  const [folderName, setFolderName] = useState('')
  const [moveRow, setMoveRow] = useState<AutomationListRow | null>(null)
  const [moveTarget, setMoveTarget] = useState<string>('none')
  const [deleteRow, setDeleteRow] = useState<AutomationListRow | null>(null)

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    const filtered = rows.filter((r) => {
      if (activeFolder != null && r.folderId !== activeFolder) return false
      if (q && !r.name.toLowerCase().includes(q)) return false
      return true
    })
    return [...filtered].sort((a, b) => (sortDesc ? b.createdAtMs - a.createdAtMs : a.createdAtMs - b.createdAtMs))
  }, [rows, search, activeFolder, sortDesc])

  function run(action: () => Promise<ActionResult>, okText: string, onOk?: (r: ActionResult) => void) {
    setNote(null)
    startTransition(async () => {
      const r = await action()
      if (r.ok) {
        setNote({ tone: 'ok', text: okText })
        onOk?.(r)
        router.refresh()
      } else {
        setNote({ tone: 'err', text: r.error })
      }
    })
  }

  function toggleStatus(row: AutomationListRow, next: boolean) {
    const target = next ? 'active' : 'paused'
    // Optimistic flip; revert on API error (§12.2.3 col 8).
    setStatusOverride((m) => ({ ...m, [row.id]: target }))
    setNote(null)
    startTransition(async () => {
      const r = await actions.setStatus(row.id, target)
      if (!r.ok) {
        setStatusOverride((m) => ({ ...m, [row.id]: row.status }))
        setNote({ tone: 'err', text: r.error })
      } else {
        router.refresh()
      }
    })
  }

  function submitCreate() {
    const name = form.name.trim()
    if (!name) {
      setNote({ tone: 'err', text: 'An automation name is required' })
      return
    }
    run(
      () => actions.create({ name, description: form.description.trim() || null, stopOnReply: form.stopOnReply }),
      'Automation created. Build its steps next.',
      (r) => {
        setCreateOpen(false)
        setForm({ name: '', description: '', stopOnReply: true })
        if (r.ok && r.id) router.push(`/admin/crm/sequences/${r.id}/edit`)
      },
    )
  }

  function submitFolder() {
    const name = folderName.trim()
    if (!name || !folderDialog) return
    if (folderDialog.mode === 'create') {
      run(() => actions.createFolder(name), 'Folder created', () => setFolderDialog(null))
    } else {
      run(() => actions.renameFolder(folderDialog.id, name), 'Folder renamed', () => setFolderDialog(null))
    }
  }

  function rowMenuItems(row: AutomationListRow, isArchived: boolean): AdminMenuItem[] {
    const items: AdminMenuItem[] = [
      { label: 'Edit', onSelect: () => router.push(`/admin/crm/sequences/${row.id}/edit`) },
      { label: 'Duplicate', onSelect: () => run(() => actions.duplicate(row.id), 'Automation duplicated') },
      {
        label: 'Move to Folder',
        onSelect: () => {
          setMoveRow(row)
          setMoveTarget(row.folderId != null ? String(row.folderId) : 'none')
        },
      },
    ]
    if (!isArchived) {
      items.push({ label: 'Archive', onSelect: () => run(() => actions.archive(row.id), 'Automation archived') })
    }
    items.push({
      label: 'Delete',
      danger: true,
      disabled: row.isAutoEnrollMaster,
      onSelect: () => {
        setDeleteRow(row)
        setNote(null)
      },
    })
    return items
  }

  function linkedMenuItems(row: AutomationListRow): AdminMenuItem[] {
    return row.usedBy.map((u) => ({ label: u.name, onSelect: () => router.push(`/admin/crm/sequences/${u.id}/edit`) }))
  }

  const emptyMessage = `No automations${search ? ' match this search' : activeFolder != null ? ' in this folder' : ' yet. Create the first one above'}.`

  // Desktop grid column template (report-grid.css reads this at >=720px; below
  // that the wrapping `hidden md:block` div is display:none and the
  // av2-cardlist phone fallback below takes over).
  const gridStyle = {
    '--rgrid-cols':
      'minmax(210px,1.6fr) minmax(150px,1fr) 60px 80px 90px 90px minmax(120px,1fr) 92px 100px 40px',
    '--rgrid-min': '1220px',
  } as CSSProperties

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--a-s5)' }}>
      {/* ── Header row (§12.2.1): title · search · Create Folder · Create Automation ── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--a-s3)' }}>
        <SectionHead>Automations</SectionHead>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--a-s2)' }}>
          <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
            <Search
              size={14}
              aria-hidden
              style={{ position: 'absolute', left: 10, color: 'var(--a-text-2)', pointerEvents: 'none' }}
            />
            <SearchField
              aria-label="Search automations"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              style={{ paddingLeft: 30, borderRadius: 999, width: 224 }}
            />
          </span>
          <Button
            variant="quiet"
            disabled={pending}
            onClick={() => {
              setFolderName('')
              setFolderDialog({ mode: 'create' })
            }}
          >
            Create Folder
          </Button>
          {/* This file's ONE primary (ci:admin-ui rule C) — the page's entry point. */}
          <Button
            disabled={pending}
            onClick={() => {
              setForm({ name: '', description: '', stopOnReply: true })
              setNote(null)
              setCreateOpen(true)
            }}
          >
            + Create Automation
          </Button>
        </div>
      </div>

      {note ? (
        <VerdictLine tone={note.tone === 'err' ? 'attention' : 'ok'}>
          <span style={{ whiteSpace: 'pre-wrap' }}>{note.text}</span>
        </VerdictLine>
      ) : null}

      {analyticsUnreadable ? (
        <VerdictLine tone="attention">
          Enrollment analytics could not be read right now. Started / Engaged / Completed may be inaccurate.
        </VerdictLine>
      ) : null}

      {/* ── Folder section (§12.2.2 / shot-34) ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--a-s2)' }}>
        <p className="a-num" style={{ margin: 0, fontSize: 'var(--a-text-xs)', fontWeight: 500, color: 'var(--a-text-2)' }}>
          {folders.length} {folders.length === 1 ? 'Folder' : 'Folders'}
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--a-s2)' }}>
          {folders.map((f) => {
            const active = activeFolder === f.id
            return (
              <AutomationFolderCard
                key={f.id}
                folder={f}
                active={active}
                onToggle={() => setActiveFolder(active ? null : f.id)}
                onRename={() => {
                  setFolderName(f.name)
                  setFolderDialog({ mode: 'rename', id: f.id })
                }}
                onDelete={() => run(() => actions.deleteFolder(f.id), 'Folder deleted', () => setActiveFolder(null))}
              />
            )
          })}
        </div>
      </div>

      {/* ── Automations list (§12.2.3) ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--a-s2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--a-s2)' }}>
          <p style={{ margin: 0, fontSize: 'var(--a-text-sm)', fontWeight: 500, color: 'var(--a-text-2)' }}>
            <span className="a-num">{visible.length}</span> {visible.length === 1 ? 'Automation' : 'Automations'}
          </p>
          {/* Sort control lives once, shared by the desktop grid AND the phone
              card list below it — the original table-header sort button had no
              phone equivalent at all. */}
          {/* Downgraded from primary: this file's one primary is the header
              "+ Create Automation" button (ci:admin-ui rule C). */}
          <Button
            variant="quiet"
            className="av2-automation-sortbtn"
            onClick={() => setSortDesc((v) => !v)}
            aria-label={`Sort by created on, currently ${sortDesc ? 'newest first' : 'oldest first'}`}
          >
            Created On
            <ArrowUpDown size={12} aria-hidden />
          </Button>
        </div>

        {/* Desktop grid — hidden below md; the phone card list below takes over */}
        <div className="hidden md:block">
          <div className="av2-rgrid__scroll" role="group" tabIndex={0} aria-label="Automations">
            <div className="av2-rgrid" role="table" aria-label="Automations" style={gridStyle}>
              <div className="av2-rgrid__head" role="row">
                <span role="columnheader" className="av2-rgrid__h">Name</span>
                <span role="columnheader" className="av2-rgrid__h">Linked Automations</span>
                <span role="columnheader" className="av2-rgrid__h av2-rgrid__h--n">Steps</span>
                <span role="columnheader" className="av2-rgrid__h av2-rgrid__h--n">Started</span>
                <span role="columnheader" className="av2-rgrid__h av2-rgrid__h--n">
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    Engaged
                    <span
                      title="Contacts who opened or replied to an email from this automation."
                      aria-label="What counts as engaged"
                      style={{ display: 'inline-flex', color: 'var(--a-text-2)', cursor: 'help' }}
                    >
                      <Info size={12} aria-hidden />
                    </span>
                  </span>
                </span>
                <span role="columnheader" className="av2-rgrid__h av2-rgrid__h--n">Completed</span>
                <span role="columnheader" className="av2-rgrid__h">Created By</span>
                <span role="columnheader" className="av2-rgrid__h">Status</span>
                <span role="columnheader" className="av2-rgrid__h">Created On</span>
                <span role="columnheader" className="av2-rgrid__h" style={{ textAlign: 'right' }}>Actions</span>
              </div>

              {visible.length === 0 ? (
                <div className="av2-rgrid__empty" role="row">
                  <span role="cell">{emptyMessage}</span>
                </div>
              ) : (
                visible.map((row) => {
                  const status = statusOverride[row.id] ?? row.status
                  const isActive = status === 'active'
                  const isArchived = status === 'archived'
                  return (
                    <AutomationDesktopRow
                      key={row.id}
                      row={row}
                      isActive={isActive}
                      isArchived={isArchived}
                      pending={pending}
                      onOpenEditor={() => router.push(`/admin/crm/sequences/${row.id}/edit`)}
                      onOpenWorkflows={() => router.push('/admin/crm/workflows')}
                      onToggleStatus={(checked) => toggleStatus(row, checked)}
                      rowMenuItems={rowMenuItems(row, isArchived)}
                      linkedMenuItems={linkedMenuItems(row)}
                    />
                  )
                })
              )}
            </div>
          </div>
        </div>

        {/* Phone card list — visible below md */}
        <div className="av2-cardlist">
          {visible.length === 0 ? (
            <p style={{ margin: 0, padding: '28px 2px', fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>
              {emptyMessage}
            </p>
          ) : (
            visible.map((row) => {
              const status = statusOverride[row.id] ?? row.status
              const isActive = status === 'active'
              const isArchived = status === 'archived'
              return (
                <AutomationCard
                  key={row.id}
                  row={row}
                  isActive={isActive}
                  isArchived={isArchived}
                  pending={pending}
                  onOpenEditor={() => router.push(`/admin/crm/sequences/${row.id}/edit`)}
                  onOpenWorkflows={() => router.push('/admin/crm/workflows')}
                  onToggleStatus={(checked) => toggleStatus(row, checked)}
                  rowMenuItems={rowMenuItems(row, isArchived)}
                  linkedMenuItems={linkedMenuItems(row)}
                />
              )
            })
          )}
        </div>
      </div>

      {/* Create automation dialog (name → route to the visual editor, §12.2.1) */}
      <Dialog
        open={createOpen}
        onClose={() => {
          if (!pending) setCreateOpen(false)
        }}
        title="New automation"
        description="An automation starts disabled. Build its steps in the visual editor, then enable it."
        footer={
          <>
            <Button variant="quiet" onClick={() => setCreateOpen(false)} disabled={pending}>
              Cancel
            </Button>
            {/* Downgraded from primary: this file's one primary is the header
                "+ Create Automation" button (ci:admin-ui rule C). */}
            <Button variant="quiet" onClick={submitCreate} disabled={pending}>
              Create automation
            </Button>
          </>
        }
      >
        <TextField
          label="Name"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          autoFocus
        />
        <TextAreaField
          label="Description (optional)"
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          rows={3}
        />
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            border: '1px solid var(--a-border)',
            borderRadius: 'var(--a-r-md)',
            padding: 12,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 'var(--a-text-sm)', fontWeight: 500, color: 'var(--a-text)' }}>
              Stop on reply
            </p>
            <p style={{ margin: 0, fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
              Pause a person the moment they reply.
            </p>
          </div>
          <Switch
            label="Stop on reply"
            labelHidden
            checked={form.stopOnReply}
            disabled={pending}
            onChange={(e) => setForm((f) => ({ ...f, stopOnReply: e.target.checked }))}
          />
        </div>
      </Dialog>

      {/* Create / rename folder dialog */}
      <Dialog
        open={!!folderDialog}
        onClose={() => {
          if (!pending) setFolderDialog(null)
        }}
        title={folderDialog?.mode === 'rename' ? 'Rename folder' : 'Create folder'}
        description="Folders group automations on this page."
        footer={
          <>
            <Button variant="quiet" onClick={() => setFolderDialog(null)} disabled={pending}>
              Cancel
            </Button>
            {/* Downgraded from primary — see the header button note above. */}
            <Button variant="quiet" onClick={submitFolder} disabled={pending || !folderName.trim()}>
              {folderDialog?.mode === 'rename' ? 'Rename' : 'Create folder'}
            </Button>
          </>
        }
      >
        <TextField label="Folder name" value={folderName} onChange={(e) => setFolderName(e.target.value)} autoFocus />
      </Dialog>

      {/* Move to Folder dialog (§12.2.3 row action) */}
      <Dialog
        open={!!moveRow}
        onClose={() => {
          if (!pending) setMoveRow(null)
        }}
        title={`Move ${moveRow?.name ?? ''}`}
        description="Pick the folder this automation lives in."
        footer={
          <>
            <Button variant="quiet" onClick={() => setMoveRow(null)} disabled={pending}>
              Cancel
            </Button>
            {/* Downgraded from primary — see the header button note above. */}
            <Button
              variant="quiet"
              disabled={pending}
              onClick={() => {
                if (!moveRow) return
                const folderId = moveTarget === 'none' ? null : Number(moveTarget)
                run(() => actions.moveToFolder(moveRow.id, folderId), 'Automation moved', () => setMoveRow(null))
              }}
            >
              Move
            </Button>
          </>
        }
      >
        <SelectField label="Folder" value={moveTarget} onChange={(e) => setMoveTarget(e.target.value)}>
          <option value="none">No folder</option>
          {folders.map((f) => (
            <option key={f.id} value={String(f.id)}>
              {f.name}
            </option>
          ))}
        </SelectField>
      </Dialog>

      {/* Delete dialog (guarded server-side: masters + live enrollments refuse) */}
      <ConfirmDialog
        open={!!deleteRow}
        onClose={() => {
          if (!pending) setDeleteRow(null)
        }}
        title={`Delete ${deleteRow?.name ?? ''}`}
        description="This removes the automation for good. It is refused if anyone is still enrolled. Archive instead to keep the history."
        confirmLabel="Delete automation"
        busy={pending}
        onConfirm={() => {
          if (!deleteRow) return
          run(() => actions.remove(deleteRow.id), 'Automation deleted', () => setDeleteRow(null))
        }}
      />
    </div>
  )
}
