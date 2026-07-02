'use client'

/**
 * EmailTemplateList — the §13.1.2 SECOND level: the email template table for
 * one folder. Columns in the exact spec order:
 *
 *   [checkbox] | Template (name + subject, 2-line) | Folders | Automations
 *   (count + eye popover) | Action Plans | Sent | Opens | Clicks | Replies |
 *   Unsubscribed | Bounces (? help) | Actions (pencil)
 *
 * Null pattern per spec: when Sent = 0 every engagement column renders the
 * em-dash data placeholder (allowed §0 unavailable marker), never 0.
 * "Automations" counts the crm_sequences steps referencing the template (the
 * eye lists them by name); "Action Plans" is the FUB legacy engine — the
 * in-house CRM runs everything through Automations, so it is honestly 0.
 *
 * Bulk selection powers ONE safe operation — Move to folder — via a
 * category-only update that never re-validates legacy bodies.
 */
import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, HelpCircle, Pencil } from 'lucide-react'
import Link from 'next/link'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { TemplatesToolbar, tplUrl } from './TemplatesToolbar'
import { EmailTemplateModal } from './EmailTemplateModal'
import type { TemplateRow, TemplatesShared } from './template-actions'

/** Engagement cell: '—' until the template has sends (spec null pattern). */
function metric(sent: number, value: number): string {
  return sent === 0 ? '—' : String(value)
}

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
  const [createOpen, setCreateOpen] = useState(false)

  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id))
  const defaultFolder = folderId.startsWith('cat:') ? folderName : null

  const anyModal = createOpen || editRow !== null
  const modalKey = useMemo(() => (editRow ? `edit-${editRow.id}` : 'create'), [editRow])

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

  return (
    <div className="space-y-4">
      <nav className="text-xs text-muted-foreground">
        <Link href={tplUrl({ t: 'email' })} className="hover:text-foreground">
          Email Templates
        </Link>
        <span className="px-1.5">/</span>
        <span className="text-foreground">{folderName}</span>
      </nav>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-foreground">
          {rows.length} Email Template{rows.length === 1 ? '' : 's'}
          {q ? <span className="ml-2 text-sm font-normal text-muted-foreground">matching &ldquo;{q}&rdquo;</span> : null}
        </h2>
        <TemplatesToolbar kind="email" folder={folderId} q={q} onNewTemplate={() => setCreateOpen(true)} />
      </div>

      {note ? (
        <Alert variant={note.tone === 'err' ? 'destructive' : 'default'}>
          <AlertDescription>{note.text}</AlertDescription>
        </Alert>
      ) : null}

      {selected.size > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2">
          <span className="text-sm font-medium text-foreground">
            {selected.size} selected
          </span>
          <Input
            value={moveTo}
            onChange={(e) => setMoveTo(e.target.value)}
            placeholder="Folder name (blank = unfoldered)"
            className="h-8 w-56"
            list="email-move-folder-options"
          />
          <datalist id="email-move-folder-options">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          <Button size="sm" className="h-8" onClick={applyMove} disabled={pending}>
            Move to folder
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8"
            onClick={() => setSelected(new Set())}
            disabled={pending}
          >
            Deselect all
          </Button>
        </div>
      ) : null}

      <div className="overflow-x-auto no-scrollbar rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={toggleAll}
                  aria-label="Select all templates"
                />
              </TableHead>
              <TableHead className="min-w-64">Template</TableHead>
              <TableHead>Folders</TableHead>
              <TableHead className="text-right">Automations</TableHead>
              <TableHead className="text-right">Action Plans</TableHead>
              <TableHead className="text-right tabular-nums">Sent</TableHead>
              <TableHead className="text-right tabular-nums">Opens</TableHead>
              <TableHead className="text-right tabular-nums">Clicks</TableHead>
              <TableHead className="text-right tabular-nums">Replies</TableHead>
              <TableHead className="text-right tabular-nums">Unsubscribed</TableHead>
              <TableHead className="text-right tabular-nums">
                <span className="inline-flex items-center gap-1">
                  Bounces
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-3 w-3 text-muted-foreground" aria-label="About bounces" />
                      </TooltipTrigger>
                      <TooltipContent>
                        Hard and soft bounces recorded for sends of this template.
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </span>
              </TableHead>
              <TableHead className="w-16 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={12} className="py-10 text-center text-sm text-muted-foreground">
                  No email templates {q ? 'match this search' : 'in this folder yet'}. Create the
                  first one with + Email Template.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => {
                const m = row.emailMetrics ?? {
                  sent: 0, opens: 0, clicks: 0, replies: 0, unsubscribed: 0, bounces: 0,
                }
                return (
                  <TableRow key={row.id} data-state={selected.has(row.id) ? 'selected' : undefined}>
                    <TableCell>
                      <Checkbox
                        checked={selected.has(row.id)}
                        onCheckedChange={() => toggleOne(row.id)}
                        aria-label={`Select ${row.name}`}
                      />
                    </TableCell>
                    <TableCell>
                      <button
                        type="button"
                        className="block max-w-xs truncate text-left font-medium text-primary hover:underline"
                        title={row.name}
                        disabled={pending}
                        onClick={() => setEditRow(row)}
                      >
                        {row.name}
                        {!row.isActive ? (
                          <Badge variant="outline" className="ml-2 align-middle text-xs uppercase">
                            Off
                          </Badge>
                        ) : null}
                      </button>
                      <p className="max-w-xs truncate text-xs text-muted-foreground">
                        {row.subject ?? row.previewText ?? ''}
                      </p>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {row.category ?? '—'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      <span className="inline-flex items-center justify-end gap-1">
                        {row.usage}
                        {row.usedBy.length > 0 ? (
                          <Popover>
                            <PopoverTrigger asChild>
                              <button
                                type="button"
                                className="text-muted-foreground hover:text-foreground"
                                aria-label={`Automations using ${row.name}`}
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </button>
                            </PopoverTrigger>
                            <PopoverContent align="end" className="w-64 p-2">
                              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                Used by
                              </p>
                              <ul className="space-y-1 text-sm text-foreground">
                                {row.usedBy.map((n) => (
                                  <li key={n} className="truncate">{n}</li>
                                ))}
                              </ul>
                            </PopoverContent>
                          </Popover>
                        ) : null}
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">0</TableCell>
                    <TableCell className="text-right tabular-nums">{m.sent}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {metric(m.sent, m.opens)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {metric(m.sent, m.clicks)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {metric(m.sent, m.replies)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {metric(m.sent, m.unsubscribed)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {metric(m.sent, m.bounces)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        aria-label={`Edit ${row.name}`}
                        disabled={pending}
                        onClick={() => setEditRow(row)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
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
    </div>
  )
}
