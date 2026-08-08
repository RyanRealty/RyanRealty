'use client'

/**
 * TextTemplateList — the §13.2.2 text template table for one folder. Exactly
 * six columns (the prior-spec Folders/Automations/Emails/Clicks/Bounces
 * columns were an error — corrected in §13):
 *
 *   Template (name + body preview, 2-line) | Score | Replies | Opt Outs |
 *   Sent | Actions (pencil + trash)
 *
 * Score renders per §13.8 (Pending (–) until a scoring model produces real
 * data — none runs in-house yet, so Pending is the honest state). Replies and
 * Opt Outs render the '–' unscored marker: reply/opt-out attribution per
 * template is not recorded yet, and a fabricated rate would violate §0.
 * Sent renders "N (N)" = 30-day (all-time) from the sequence engine's
 * templateKey-stamped sms_out rows — real counts.
 *
 * P11 admin v2: the shadcn Table/AlertDialog/Alert/Badge/Button stack is gone.
 * The table is the hand-rolled div/role grid ConfigTableEditor established
 * (av2-rgrid* + report-grid.css) with an av2-cardlist phone fallback; delete
 * is the v2 ConfirmDialog. Columns, metrics, the null markers and every
 * user-facing string are unchanged.
 */
import { useMemo, useState, useTransition, type CSSProperties } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, Star, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { Button, ConfirmDialog, IconButton, SectionHead, VerdictLine } from '@/components/admin/v2'
import '@/components/admin/v2/report-grid.css'
import { TemplatesToolbar, tplUrl } from './TemplatesToolbar'
import { TemplatePerfScore } from './TemplatePerfScore'
import { TextTemplateModal } from './TextTemplateModal'
import type { TemplateRow, TemplatesShared } from './template-actions'

/** The language's label chip — a bordered span, never a pill (pills filter). */
const OFF_CHIP: CSSProperties = {
  flexShrink: 0,
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
  background: 'none',
  border: 'none',
  padding: 0,
  minHeight: 'auto',
  color: 'var(--a-accent)',
  fontWeight: 500,
  fontSize: 'var(--a-text-sm)',
  maxWidth: '100%',
}

const PREVIEW: CSSProperties = {
  margin: 0,
  fontSize: 'var(--a-text-xs)',
  color: 'var(--a-text-2)',
}

export function TextTemplateList({
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
  const [editRow, setEditRow] = useState<TemplateRow | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [deleteRow, setDeleteRow] = useState<TemplateRow | null>(null)

  const defaultFolder = folderId.startsWith('cat:') ? folderName : null
  const anyModal = createOpen || editRow !== null
  const modalKey = useMemo(() => (editRow ? `edit-${editRow.id}` : 'create'), [editRow])

  // Desktop column template — the custom properties report-grid.css reads at
  // >=720px. Below md this block is `hidden` and the card list takes over.
  const gridStyle = {
    '--rgrid-cols': 'minmax(220px,1fr) 120px 88px 92px 110px 88px',
    '--rgrid-min': '760px',
  } as CSSProperties

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

  const emptyText = `No text templates ${q ? 'match this search' : 'in this folder yet'}. Create the first one with + Text Template.`

  function nameDoor(row: TemplateRow) {
    return (
      <Button
        type="button"
        variant="quiet"
        className="flex items-center gap-1.5 truncate text-left"
        style={NAME_DOOR}
        title={row.name}
        disabled={pending}
        onClick={() => setEditRow(row)}
      >
        <span className="truncate">{row.name}</span>
        {row.featured ? <Star className="h-3 w-3 shrink-0 fill-current" aria-label="Featured" /> : null}
        {!row.isActive ? <span style={OFF_CHIP}>Off</span> : null}
      </Button>
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

  function sentCell(row: TemplateRow) {
    return row.textMetrics ? `${row.textMetrics.sent30d} (${row.textMetrics.sentTotal})` : '—'
  }

  return (
    <div className="space-y-4">
      <nav style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
        <Link href={tplUrl({ t: 'text' })} style={{ color: 'inherit', textDecoration: 'none' }}>
          Text Templates
        </Link>
        <span className="px-1.5">/</span>
        <span style={{ color: 'var(--a-text)' }}>{folderName}</span>
      </nav>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionHead>
          {rows.length} Text Template{rows.length === 1 ? '' : 's'}
          {q ? <span style={{ marginLeft: 8, textTransform: 'none' }}>matching &ldquo;{q}&rdquo;</span> : null}
        </SectionHead>
        <TemplatesToolbar kind="text" folder={folderId} q={q} onNewTemplate={() => setCreateOpen(true)} />
      </div>

      {note ? (
        <VerdictLine tone={note.tone === 'err' ? 'attention' : 'ok'}>{note.text}</VerdictLine>
      ) : null}

      {/* Desktop grid — hidden below md; the card list below takes over */}
      <div className="hidden md:block">
        <div className="av2-rgrid__scroll" role="group" tabIndex={0} aria-label="Text templates">
          <div className="av2-rgrid" role="table" aria-label="Text templates" style={gridStyle}>
            <div className="av2-rgrid__head" role="row">
              <span role="columnheader" className="av2-rgrid__h">
                Template
              </span>
              <span role="columnheader" className="av2-rgrid__h">
                Score
              </span>
              <span role="columnheader" className="av2-rgrid__h av2-rgrid__h--n">
                Replies
              </span>
              <span role="columnheader" className="av2-rgrid__h av2-rgrid__h--n">
                Opt Outs
              </span>
              <span role="columnheader" className="av2-rgrid__h av2-rgrid__h--n">
                Sent
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
              rows.map((row) => (
                <div key={row.id} role="row" className="av2-rgrid__row">
                  <span role="cell" data-label="Template" className="av2-rgrid__c">
                    {nameDoor(row)}
                    <span className="truncate" style={{ ...PREVIEW, display: 'block' }}>
                      {row.body.split('\n')[0]}
                    </span>
                  </span>
                  <span role="cell" data-label="Score" className="av2-rgrid__c">
                    <TemplatePerfScore score={null} needsReview={false} />
                  </span>
                  <span
                    role="cell"
                    data-label="Replies"
                    className="av2-rgrid__c av2-rgrid__c--n"
                    style={{ color: 'var(--a-text-2)' }}
                  >
                    –
                  </span>
                  <span
                    role="cell"
                    data-label="Opt Outs"
                    className="av2-rgrid__c av2-rgrid__c--n"
                    style={{ color: 'var(--a-text-2)' }}
                  >
                    –
                  </span>
                  <span role="cell" data-label="Sent" className="av2-rgrid__c av2-rgrid__c--n">
                    {sentCell(row)}
                  </span>
                  <span role="cell" data-label="Actions" className="av2-rgrid__c" style={{ textAlign: 'right' }}>
                    {rowActions(row)}
                  </span>
                </div>
              ))
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
          rows.map((row) => (
            <div key={row.id} className="av2-pane" style={{ gap: 6 }}>
              <div
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>{nameDoor(row)}</div>
                {rowActions(row)}
              </div>
              <p className="truncate" style={PREVIEW}>
                {row.body.split('\n')[0]}
              </p>
              <p style={{ ...PREVIEW, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                <span>Score</span>
                <TemplatePerfScore score={null} needsReview={false} />
                <span>· Replies –</span>
                <span>· Opt Outs –</span>
                <span>
                  · Sent <span className="a-num">{sentCell(row)}</span>
                </span>
              </p>
            </div>
          ))
        )}
      </div>

      {anyModal ? (
        <TextTemplateModal
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
