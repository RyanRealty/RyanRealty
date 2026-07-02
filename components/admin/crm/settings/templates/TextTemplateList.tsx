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
 */
import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, Star, Trash2 } from 'lucide-react'
import Link from 'next/link'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { TemplatesToolbar, tplUrl } from './TemplatesToolbar'
import { TemplatePerfScore } from './TemplatePerfScore'
import { TextTemplateModal } from './TextTemplateModal'
import type { TemplateRow, TemplatesShared } from './template-actions'

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

  return (
    <div className="space-y-4">
      <nav className="text-xs text-muted-foreground">
        <Link href={tplUrl({ t: 'text' })} className="hover:text-foreground">
          Text Templates
        </Link>
        <span className="px-1.5">/</span>
        <span className="text-foreground">{folderName}</span>
      </nav>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-foreground">
          {rows.length} Text Template{rows.length === 1 ? '' : 's'}
          {q ? <span className="ml-2 text-sm font-normal text-muted-foreground">matching &ldquo;{q}&rdquo;</span> : null}
        </h2>
        <TemplatesToolbar kind="text" folder={folderId} q={q} onNewTemplate={() => setCreateOpen(true)} />
      </div>

      {note ? (
        <Alert variant={note.tone === 'err' ? 'destructive' : 'default'}>
          <AlertDescription>{note.text}</AlertDescription>
        </Alert>
      ) : null}

      <div className="overflow-x-auto no-scrollbar rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-72">Template</TableHead>
              <TableHead>Score</TableHead>
              <TableHead className="text-right">Replies</TableHead>
              <TableHead className="text-right">Opt Outs</TableHead>
              <TableHead className="text-right tabular-nums">Sent</TableHead>
              <TableHead className="w-20 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                  No text templates {q ? 'match this search' : 'in this folder yet'}. Create the
                  first one with + Text Template.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <button
                      type="button"
                      className="flex max-w-sm items-center gap-1.5 truncate text-left font-medium text-primary hover:underline"
                      title={row.name}
                      disabled={pending}
                      onClick={() => setEditRow(row)}
                    >
                      <span className="truncate">{row.name}</span>
                      {row.featured ? (
                        <Star className="h-3 w-3 shrink-0 fill-current text-primary" aria-label="Featured" />
                      ) : null}
                      {!row.isActive ? (
                        <Badge variant="outline" className="shrink-0 text-xs uppercase">
                          Off
                        </Badge>
                      ) : null}
                    </button>
                    <p className="max-w-sm truncate text-xs text-muted-foreground">
                      {row.body.split('\n')[0]}
                    </p>
                  </TableCell>
                  <TableCell>
                    <TemplatePerfScore score={null} needsReview={false} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">–</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">–</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.textMetrics ? `${row.textMetrics.sent30d} (${row.textMetrics.sentTotal})` : '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="inline-flex items-center gap-1">
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
                      {shared.isSuperuser ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                          aria-label={`Delete ${row.name}`}
                          disabled={pending || row.usage > 0}
                          title={row.usage > 0 ? 'Referenced by an automation. Detach it first.' : undefined}
                          onClick={() => setDeleteRow(row)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      ) : null}
                    </span>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
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

      <AlertDialog open={deleteRow !== null} onOpenChange={(o) => !o && !pending && setDeleteRow(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteRow?.name}</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone. The template is removed for good.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault()
                doDelete()
              }}
            >
              Delete template
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
