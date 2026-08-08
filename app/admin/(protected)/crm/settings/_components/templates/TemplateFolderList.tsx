'use client'

/**
 * TemplateFolderList — the §13.1.1/§13.2.1 TOP level of the two-level folder
 * architecture. Shows every folder for the active type with its template
 * count; clicking a folder navigates into its template list.
 *
 * System folders ("All …", "My …", "Used by Automations") are derived views —
 * no rename/delete. User folders map to crm_templates.category (channel-
 * scoped): the pencil renames the folder across its templates, the trash
 * removes the folder (templates stay, unfoldered). Both confirm first.
 *
 * P11 admin v2: the shadcn Table/AlertDialog/Dialog/Badge/Button/Input/Label
 * stack is gone. The table is the hand-rolled div/role grid that
 * ConfigTableEditor established (av2-rgrid* + report-grid.css) with an
 * av2-cardlist phone fallback; the overlays are v2 Dialog / ConfirmDialog.
 * Rename/delete wiring, folder semantics and every user-facing string are
 * unchanged — presentation moved, behaviour did not.
 */
import { useState, useTransition, type CSSProperties } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, Trash2 } from 'lucide-react'
import Link from 'next/link'
import {
  Button,
  ConfirmDialog,
  Dialog,
  IconButton,
  SectionHead,
  TextField,
  VerdictLine,
} from '@/components/admin/v2'
import '@/components/admin/v2/report-grid.css'
import { TemplatesToolbar, tplUrl } from './TemplatesToolbar'
import { EmailTemplateModal } from './EmailTemplateModal'
import { TextTemplateModal } from './TextTemplateModal'
import type { TemplatesShared } from './template-actions'

export type TemplateFolderSummary = {
  /** URL id — 'all' | 'my' | 'used' | 'cat:<name>' */
  id: string
  name: string
  count: number
  system: boolean
}

/** The language's label chip — a bordered span, never a pill (pills filter). */
const COUNT_CHIP: CSSProperties = {
  display: 'inline-block',
  fontSize: 'var(--a-text-xs)',
  color: 'var(--a-text-2)',
  border: '1px solid var(--a-border)',
  borderRadius: 'var(--a-r-sm)',
  padding: '1px 6px',
}

const FOLDER_LINK: CSSProperties = {
  color: 'var(--a-accent)',
  textDecoration: 'none',
  fontWeight: 500,
}

export function TemplateFolderList({
  kind,
  folders,
  categories,
  q,
  shared,
}: {
  kind: 'email' | 'sms'
  folders: TemplateFolderSummary[]
  /** Existing category names (for the create modal's folder datalist). */
  categories: string[]
  q: string
  shared: TemplatesShared
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [note, setNote] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [renameFrom, setRenameFrom] = useState<string | null>(null)
  const [renameTo, setRenameTo] = useState('')
  const [deleteFolder, setDeleteFolder] = useState<string | null>(null)

  const t = kind === 'email' ? 'email' : 'text'
  const noun = kind === 'email' ? 'Email Template' : 'Text Template'
  const channelName = kind === 'email' ? 'email' : 'sms'

  // Desktop column template — the custom properties report-grid.css reads at
  // >=720px. Below md this block is `hidden` and the card list takes over.
  const gridStyle = {
    '--rgrid-cols': 'minmax(200px,1fr) 140px 96px',
    '--rgrid-min': '460px',
  } as CSSProperties

  function run(action: () => Promise<{ ok: true; message?: string } | { ok: false; error: string }>) {
    setNote(null)
    startTransition(async () => {
      const r = await action()
      if (r.ok) {
        setNote({ tone: 'ok', text: r.message ?? 'Done' })
        router.refresh()
      } else {
        setNote({ tone: 'err', text: r.error })
      }
    })
  }

  function folderActions(f: TemplateFolderSummary) {
    if (f.system) return null
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
        <IconButton
          label={`Rename folder ${f.name}`}
          tone="quiet"
          disabled={pending}
          onClick={() => {
            setRenameFrom(f.name)
            setRenameTo(f.name)
          }}
        >
          <Pencil size={14} />
        </IconButton>
        <IconButton
          label={`Delete folder ${f.name}`}
          tone="danger"
          disabled={pending}
          onClick={() => setDeleteFolder(f.name)}
        >
          <Trash2 size={14} />
        </IconButton>
      </span>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionHead>
          {folders.length} {noun} Folder{folders.length === 1 ? '' : 's'}
        </SectionHead>
        <TemplatesToolbar kind={t} folder={null} q={q} onNewTemplate={() => setCreateOpen(true)} />
      </div>

      {note ? (
        <VerdictLine tone={note.tone === 'err' ? 'attention' : 'ok'}>{note.text}</VerdictLine>
      ) : null}

      {/* Desktop grid — hidden below md; the card list below takes over */}
      <div className="hidden md:block">
        <div className="av2-rgrid__scroll" role="group" tabIndex={0} aria-label={`${noun} folders`}>
          <div className="av2-rgrid" role="table" aria-label={`${noun} folders`} style={gridStyle}>
            <div className="av2-rgrid__head" role="row">
              <span role="columnheader" className="av2-rgrid__h">
                Name
              </span>
              <span role="columnheader" className="av2-rgrid__h av2-rgrid__h--n">
                {noun}s
              </span>
              <span role="columnheader" className="av2-rgrid__h" style={{ textAlign: 'right' }}>
                Actions
              </span>
            </div>

            {folders.map((f) => (
              <div key={f.id} role="row" className="av2-rgrid__row">
                <span role="cell" data-label="Name" className="av2-rgrid__c">
                  <Link href={tplUrl({ t, folder: f.id })} style={FOLDER_LINK}>
                    {f.name}
                  </Link>
                </span>
                <span role="cell" data-label={`${noun}s`} className="av2-rgrid__c av2-rgrid__c--n">
                  <span className="a-num" style={COUNT_CHIP}>
                    {f.count}
                  </span>
                </span>
                <span role="cell" data-label="Actions" className="av2-rgrid__c" style={{ textAlign: 'right' }}>
                  {folderActions(f)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Phone card list — the layout lives in av2-cardlist, never md:hidden
          plus an inline display (the inline style wins and both layouts show) */}
      <div className="av2-cardlist">
        {folders.map((f) => (
          <div
            key={f.id}
            className="av2-pane"
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}
          >
            <div style={{ minWidth: 0, flex: 1 }}>
              <Link href={tplUrl({ t, folder: f.id })} style={FOLDER_LINK}>
                {f.name}
              </Link>
              <p style={{ margin: 0, fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
                {noun}s <span className="a-num">{f.count}</span>
              </p>
            </div>
            {folderActions(f)}
          </div>
        ))}
      </div>

      {/* Create template from the folder level (lands in My templates unless a folder is typed) */}
      {createOpen && kind === 'email' ? (
        <EmailTemplateModal
          open
          row={null}
          defaultFolder={null}
          folders={categories}
          shared={shared}
          onClose={() => {
            setCreateOpen(false)
            router.refresh()
          }}
        />
      ) : null}
      {createOpen && kind === 'sms' ? (
        <TextTemplateModal
          open
          row={null}
          defaultFolder={null}
          folders={categories}
          shared={shared}
          onClose={() => {
            setCreateOpen(false)
            router.refresh()
          }}
        />
      ) : null}

      {/* Rename folder */}
      <Dialog
        open={renameFrom !== null}
        onClose={() => {
          if (!pending) setRenameFrom(null)
        }}
        title="Rename folder"
        description={
          <>
            Every {channelName} template in &ldquo;{renameFrom}&rdquo; moves to the new name.
          </>
        }
        footer={
          <>
            <Button variant="quiet" onClick={() => setRenameFrom(null)} disabled={pending}>
              Cancel
            </Button>
            <Button
              disabled={pending || !renameTo.trim()}
              onClick={() => {
                const from = renameFrom
                if (!from) return
                run(() => shared.actions.renameCategory(from, renameTo.trim(), channelName))
                setRenameFrom(null)
              }}
            >
              Rename
            </Button>
          </>
        }
      >
        <TextField
          label="New folder name"
          value={renameTo}
          onChange={(e) => setRenameTo(e.target.value)}
          autoFocus
        />
      </Dialog>

      {/* Delete folder */}
      <ConfirmDialog
        open={deleteFolder !== null}
        onClose={() => setDeleteFolder(null)}
        title={`Delete folder ${deleteFolder ?? ''}`}
        description={`The folder goes away. Its templates are kept and stay available in All ${noun}s.`}
        confirmLabel="Delete folder"
        busy={pending}
        onConfirm={() => {
          const name = deleteFolder
          if (!name) return
          run(() => shared.actions.renameCategory(name, '', channelName))
          setDeleteFolder(null)
        }}
      />
    </div>
  )
}
