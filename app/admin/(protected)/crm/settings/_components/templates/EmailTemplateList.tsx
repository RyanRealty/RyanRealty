'use client'

/**
 * EmailTemplateList — the §13.1.2 SECOND level: the email template table for
 * one folder. Columns in the exact spec order:
 *
 *   [checkbox] | Template (name + subject, 2-line) | Folders | Automations
 *   (count + eye list) | Action Plans | Sent | Opens | Clicks | Replies |
 *   Unsubscribed | Bounces (? help) | Actions (pencil)
 *
 * Null pattern per spec: when Sent = 0 every engagement column renders the
 * em-dash data placeholder (allowed §0 unavailable marker), never 0.
 * "Automations" counts the crm_sequences steps referencing the template (the
 * eye lists them by name); "Action Plans" is the CRM legacy engine — the
 * in-house CRM runs everything through Automations, so it is honestly 0.
 *
 * Bulk selection powers ONE safe operation — Move to folder — via a
 * category-only update that never re-validates legacy bodies.
 *
 * P11 admin v2: the shadcn Table/AlertDialog/Alert/Badge/Button/Checkbox/
 * Input/Popover/Tooltip stack is gone. The table is the hand-rolled div/role
 * grid ConfigTableEditor established (av2-rgrid* + report-grid.css) with an
 * av2-cardlist phone fallback; delete is the v2 ConfirmDialog and the eye's
 * used-by list is a v2 Dialog (the language has no popover). Columns, metrics,
 * the null markers, the bulk-move wiring and every user-facing string are
 * unchanged.
 */
import { useMemo, useState, useTransition, type CSSProperties, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, HelpCircle, Pencil, Trash2 } from 'lucide-react'
import Link from 'next/link'
import {
  Button,
  ConfirmDialog,
  Dialog,
  IconButton,
  SearchField,
  SectionHead,
  ToolbarCheck,
  VerdictLine,
} from '@/components/admin/v2'
import '@/components/admin/v2/report-grid.css'
import { TemplatesToolbar, tplUrl } from './TemplatesToolbar'
import { EmailTemplateModal } from './EmailTemplateModal'
import type { TemplateRow, TemplatesShared } from './template-actions'

/** Engagement cell: '—' until the template has sends (spec null pattern). */
function metric(sent: number, value: number): string {
  return sent === 0 ? '—' : String(value)
}

/** The language's label chip — a bordered span, never a pill (pills filter). */
const OFF_CHIP: CSSProperties = {
  display: 'inline-block',
  verticalAlign: 'middle',
  marginLeft: 8,
  fontSize: 'var(--a-text-xs)',
  fontWeight: 400,
  textTransform: 'uppercase',
  color: 'var(--a-text-2)',
  border: '1px solid var(--a-border)',
  borderRadius: 'var(--a-r-sm)',
  padding: '1px 6px',
}

/** A template name is a door: a quiet Button drawn as inline accent text. */
const NAME_DOOR: CSSProperties = {
  display: 'block',
  background: 'none',
  border: 'none',
  padding: 0,
  minHeight: 'auto',
  color: 'var(--a-accent)',
  fontWeight: 500,
  fontSize: 'var(--a-text-sm)',
  maxWidth: '100%',
}

const SUBJECT: CSSProperties = {
  display: 'block',
  margin: 0,
  fontSize: 'var(--a-text-xs)',
  color: 'var(--a-text-2)',
}

const QUIET_NUM: CSSProperties = { color: 'var(--a-text-2)' }

export function EmailTemplateList({
  folderId,
  folderName,
  rows,
  categories,
  q,
  shared,
}: {
  folderId: string
  folderName: string
  rows: TemplateRow[]
  categories: string[]
  q: string
  shared: TemplatesShared
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [note, setNote] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [moveTo, setMoveTo] = useState('')
  const [editRow, setEditRow] = useState<TemplateRow | null>(null)
  const [deleteRow, setDeleteRow] = useState<TemplateRow | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  // The "used by" list was a Popover; the v2 language has no popover, so the
  // eye opens the one sanctioned overlay instead. Same list, same trigger name.
  const [usedByRow, setUsedByRow] = useState<TemplateRow | null>(null)

  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id))
  const defaultFolder = folderId.startsWith('cat:') ? folderName : null

  const anyModal = createOpen || editRow !== null
  const modalKey = useMemo(() => (editRow ? `edit-${editRow.id}` : 'create'), [editRow])

  // Desktop column template — the custom properties report-grid.css reads at
  // >=720px. Below md this block is `hidden` and the card list takes over; the
  // sideways overflow lives in .av2-rgrid__scroll, never on the page.
  const gridStyle = {
    '--rgrid-cols':
      '40px minmax(220px,1fr) 110px 112px 108px 76px 76px 76px 80px 112px 96px 84px',
    '--rgrid-min': '1290px',
  } as CSSProperties

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)))
  }

  function toggleOne(id: number) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  /** §13 Actions column trash — confirm-gated, superuser-only (same pattern as
      TextTemplateList; the email list shipped without it, 2026-07-02 audit). */
  function doDelete() {
    const row = deleteRow
    if (!row) return
    setNote(null)
    startTransition(async () => {
      const r = await shared.actions.remove(row.id)
      setDeleteRow(null)
      if (r.ok) {
        setNote({ tone: 'ok', text: r.message ?? 'Template deleted' })
        router.refresh()
      } else {
        setNote({ tone: 'err', text: r.error })
      }
    })
  }

  function applyMove() {
    const ids = [...selected]
    if (ids.length === 0) return
    setNote(null)
    startTransition(async () => {
      const r = await shared.actions.moveToFolder(ids, moveTo.trim() || null)
      if (r.ok) {
        setNote({ tone: 'ok', text: r.message ?? 'Moved' })
        setSelected(new Set())
        setMoveTo('')
        router.refresh()
      } else {
        setNote({ tone: 'err', text: r.error })
      }
    })
  }

  const emptyText = `No email templates ${q ? 'match this search' : 'in this folder yet'}. Create the first one with + Email Template.`

  function nameDoor(row: TemplateRow) {
    return (
      <Button
        type="button"
        variant="quiet"
        className="truncate text-left"
        style={NAME_DOOR}
        title={row.name}
        disabled={pending}
        onClick={() => setEditRow(row)}
      >
        {row.name}
        {!row.isActive ? <span style={OFF_CHIP}>Off</span> : null}
      </Button>
    )
  }

  function usedByEye(row: TemplateRow) {
    if (row.usedBy.length === 0) return null
    return (
      <IconButton
        label={`Automations using ${row.name}`}
        tone="quiet"
        onClick={() => setUsedByRow(row)}
      >
        <Eye size={14} />
      </IconButton>
    )
  }

  function rowActions(row: TemplateRow) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
        <IconButton
          label={`Edit ${row.name}`}
          tone="quiet"
          disabled={pending}
          onClick={() => setEditRow(row)}
        >
          <Pencil size={14} />
        </IconButton>
        {shared.isSuperuser ? (
          <IconButton
            label={`Delete ${row.name}`}
            tone="danger"
            disabled={pending || row.usage > 0}
            title={row.usage > 0 ? 'Referenced by an automation. Detach it first.' : undefined}
            onClick={() => setDeleteRow(row)}
          >
            <Trash2 size={14} />
          </IconButton>
        ) : null}
      </span>
    )
  }

  /** Phone card meta pair — the same "Label value" the grid stacks below 720px. */
  function metaItem(label: string, value: ReactNode) {
    return (
      <span>
        · {label} <span className="a-num">{value}</span>
      </span>
    )
  }

  return (
    <div className="space-y-4">
      <nav style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
        <Link href={tplUrl({ t: 'email' })} style={{ color: 'inherit', textDecoration: 'none' }}>
          Email Templates
        </Link>
        <span className="px-1.5">/</span>
        <span style={{ color: 'var(--a-text)' }}>{folderName}</span>
      </nav>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionHead>
          {rows.length} Email Template{rows.length === 1 ? '' : 's'}
          {q ? <span style={{ marginLeft: 8, textTransform: 'none' }}>matching &ldquo;{q}&rdquo;</span> : null}
        </SectionHead>
        <TemplatesToolbar kind="email" folder={folderId} q={q} onNewTemplate={() => setCreateOpen(true)} />
      </div>

      {note ? (
        <VerdictLine tone={note.tone === 'err' ? 'attention' : 'ok'}>{note.text}</VerdictLine>
      ) : null}

      {selected.size > 0 ? (
        <div
          className="flex flex-wrap items-center gap-2"
          style={{
            border: '1px solid var(--a-border)',
            borderRadius: 'var(--a-r-md)',
            background: 'var(--a-inset)',
            padding: '8px 12px',
          }}
        >
          <span style={{ fontSize: 'var(--a-text-sm)', fontWeight: 500, color: 'var(--a-text)' }}>
            {selected.size} selected
          </span>
          <SearchField
            type="text"
            value={moveTo}
            onChange={(e) => setMoveTo(e.target.value)}
            placeholder="Folder name (blank = unfoldered)"
            aria-label="Folder name"
            style={{ width: 224 }}
            list="email-move-folder-options"
          />
          <datalist id="email-move-folder-options">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          <Button onClick={applyMove} disabled={pending}>
            Move to folder
          </Button>
          <Button variant="quiet" onClick={() => setSelected(new Set())} disabled={pending}>
            Deselect all
          </Button>
        </div>
      ) : null}

      {/* Desktop grid — hidden below md; the card list below takes over */}
      <div className="hidden md:block">
        <div className="av2-rgrid__scroll" role="group" tabIndex={0} aria-label="Email templates">
          <div className="av2-rgrid" role="table" aria-label="Email templates" style={gridStyle}>
            <div className="av2-rgrid__head" role="row">
              <span role="columnheader" className="av2-rgrid__h">
                <ToolbarCheck
                  label=""
                  aria-label="Select all templates"
                  checked={allSelected}
                  onChange={toggleAll}
                />
              </span>
              <span role="columnheader" className="av2-rgrid__h">
                Template
              </span>
              <span role="columnheader" className="av2-rgrid__h">
                Folders
              </span>
              <span role="columnheader" className="av2-rgrid__h av2-rgrid__h--n">
                Automations
              </span>
              <span role="columnheader" className="av2-rgrid__h av2-rgrid__h--n">
                Action Plans
              </span>
              <span role="columnheader" className="av2-rgrid__h av2-rgrid__h--n">
                Sent
              </span>
              <span role="columnheader" className="av2-rgrid__h av2-rgrid__h--n">
                Opens
              </span>
              <span role="columnheader" className="av2-rgrid__h av2-rgrid__h--n">
                Clicks
              </span>
              <span role="columnheader" className="av2-rgrid__h av2-rgrid__h--n">
                Replies
              </span>
              <span role="columnheader" className="av2-rgrid__h av2-rgrid__h--n">
                Unsubscribed
              </span>
              <span role="columnheader" className="av2-rgrid__h av2-rgrid__h--n">
                <span className="inline-flex items-center gap-1">
                  Bounces
                  <span title="Hard and soft bounces recorded for sends of this template.">
                    <HelpCircle
                      className="h-3 w-3"
                      style={{ color: 'var(--a-text-2)' }}
                      aria-label="About bounces"
                    />
                  </span>
                </span>
              </span>
              <span role="columnheader" className="av2-rgrid__h" style={{ textAlign: 'right' }}>
                Actions
              </span>
            </div>

            {rows.length === 0 ? (
              <div className="av2-rgrid__empty" role="row">
                <span role="cell">{emptyText}</span>
              </div>
            ) : (
              rows.map((row) => {
                const m = row.emailMetrics ?? {
                  sent: 0, opens: 0, clicks: 0, replies: 0, unsubscribed: 0, bounces: 0,
                }
                return (
                  <div
                    key={row.id}
                    role="row"
                    className="av2-rgrid__row"
                    style={{ background: selected.has(row.id) ? 'var(--a-accent-wash)' : undefined }}
                  >
                    <span role="cell" data-label="" className="av2-rgrid__c">
                      <ToolbarCheck
                        label=""
                        aria-label={`Select ${row.name}`}
                        checked={selected.has(row.id)}
                        onChange={() => toggleOne(row.id)}
                      />
                    </span>
                    <span role="cell" data-label="Template" className="av2-rgrid__c">
                      {nameDoor(row)}
                      <span className="truncate" style={SUBJECT}>
                        {row.subject ?? row.previewText ?? ''}
                      </span>
                    </span>
                    <span role="cell" data-label="Folders" className="av2-rgrid__c" style={QUIET_NUM}>
                      {row.category ?? '—'}
                    </span>
                    <span role="cell" data-label="Automations" className="av2-rgrid__c av2-rgrid__c--n">
                      <span className="inline-flex items-center justify-end gap-1">
                        {row.usage}
                        {usedByEye(row)}
                      </span>
                    </span>
                    <span
                      role="cell"
                      data-label="Action Plans"
                      className="av2-rgrid__c av2-rgrid__c--n"
                      style={QUIET_NUM}
                    >
                      0
                    </span>
                    <span role="cell" data-label="Sent" className="av2-rgrid__c av2-rgrid__c--n">
                      {m.sent}
                    </span>
                    <span role="cell" data-label="Opens" className="av2-rgrid__c av2-rgrid__c--n" style={QUIET_NUM}>
                      {metric(m.sent, m.opens)}
                    </span>
                    <span role="cell" data-label="Clicks" className="av2-rgrid__c av2-rgrid__c--n" style={QUIET_NUM}>
                      {metric(m.sent, m.clicks)}
                    </span>
                    <span role="cell" data-label="Replies" className="av2-rgrid__c av2-rgrid__c--n" style={QUIET_NUM}>
                      {metric(m.sent, m.replies)}
                    </span>
                    <span
                      role="cell"
                      data-label="Unsubscribed"
                      className="av2-rgrid__c av2-rgrid__c--n"
                      style={QUIET_NUM}
                    >
                      {metric(m.sent, m.unsubscribed)}
                    </span>
                    <span role="cell" data-label="Bounces" className="av2-rgrid__c av2-rgrid__c--n" style={QUIET_NUM}>
                      {metric(m.sent, m.bounces)}
                    </span>
                    <span role="cell" data-label="Actions" className="av2-rgrid__c" style={{ textAlign: 'right' }}>
                      {rowActions(row)}
                    </span>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>

      {/* Phone card list — the layout lives in av2-cardlist, never md:hidden
          plus an inline display (the inline style wins and both layouts show) */}
      <div className="av2-cardlist">
        {rows.length === 0 ? (
          <div className="av2-pane">
            <p style={{ margin: 0, fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>{emptyText}</p>
          </div>
        ) : (
          rows.map((row) => {
            const m = row.emailMetrics ?? {
              sent: 0, opens: 0, clicks: 0, replies: 0, unsubscribed: 0, bounces: 0,
            }
            return (
              <div
                key={row.id}
                className="av2-pane"
                style={{ gap: 6, background: selected.has(row.id) ? 'var(--a-accent-wash)' : undefined }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <ToolbarCheck
                    label=""
                    aria-label={`Select ${row.name}`}
                    checked={selected.has(row.id)}
                    onChange={() => toggleOne(row.id)}
                  />
                  <div style={{ minWidth: 0, flex: 1 }}>{nameDoor(row)}</div>
                  {rowActions(row)}
                </div>
                <span className="truncate" style={SUBJECT}>
                  {row.subject ?? row.previewText ?? ''}
                </span>
                <p style={{ ...SUBJECT, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  <span>Folders {row.category ?? '—'}</span>
                  <span>
                    · Automations <span className="a-num">{row.usage}</span>
                    {usedByEye(row)}
                  </span>
                  {metaItem('Action Plans', '0')}
                  {metaItem('Sent', m.sent)}
                  {metaItem('Opens', metric(m.sent, m.opens))}
                  {metaItem('Clicks', metric(m.sent, m.clicks))}
                  {metaItem('Replies', metric(m.sent, m.replies))}
                  {metaItem('Unsubscribed', metric(m.sent, m.unsubscribed))}
                  {metaItem('Bounces', metric(m.sent, m.bounces))}
                </p>
              </div>
            )
          })
        )}
      </div>

      {anyModal ? (
        <EmailTemplateModal
          key={modalKey}
          open
          row={editRow}
          defaultFolder={defaultFolder}
          folders={categories}
          shared={shared}
          onClose={() => {
            setEditRow(null)
            setCreateOpen(false)
            router.refresh()
          }}
        />
      ) : null}

      <Dialog open={usedByRow !== null} onClose={() => setUsedByRow(null)} title="Used by">
        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {(usedByRow?.usedBy ?? []).map((n) => (
            <li key={n} className="truncate" style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text)' }}>
              {n}
            </li>
          ))}
        </ul>
      </Dialog>

      <ConfirmDialog
        open={deleteRow !== null}
        onClose={() => {
          if (!pending) setDeleteRow(null)
        }}
        title={`Delete ${deleteRow?.name ?? ''}`}
        description="This cannot be undone. The template is removed for good."
        confirmLabel="Delete template"
        busy={pending}
        onConfirm={doDelete}
      />
    </div>
  )
}
