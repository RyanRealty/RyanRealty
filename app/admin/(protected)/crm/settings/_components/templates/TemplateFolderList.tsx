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
 */
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, Trash2 } from 'lucide-react'
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-foreground">
          {folders.length} {noun} Folder{folders.length === 1 ? '' : 's'}
        </h2>
        <TemplatesToolbar kind={t} folder={null} q={q} onNewTemplate={() => setCreateOpen(true)} />
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
              <TableHead>Name</TableHead>
              <TableHead className="text-right tabular-nums">{noun}s</TableHead>
              <TableHead className="w-24 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {folders.map((f) => (
              <TableRow key={f.id}>
                <TableCell>
                  <Link
                    href={tplUrl({ t, folder: f.id })}
                    className="font-medium text-primary hover:underline"
                  >
                    {f.name}
                  </Link>
                </TableCell>
                <TableCell className="text-right">
                  <Badge variant="secondary" className="tabular-nums">
                    {f.count}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  {!f.system ? (
                    <span className="inline-flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        aria-label={`Rename folder ${f.name}`}
                        disabled={pending}
                        onClick={() => {
                          setRenameFrom(f.name)
                          setRenameTo(f.name)
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                        aria-label={`Delete folder ${f.name}`}
                        disabled={pending}
                        onClick={() => setDeleteFolder(f.name)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </span>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
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
        onOpenChange={(o) => {
          if (!o && !pending) setRenameFrom(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename folder</DialogTitle>
            <DialogDescription>
              Every {channelName} template in &ldquo;{renameFrom}&rdquo; moves to the new name.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="folder-rename">New folder name</Label>
            <Input
              id="folder-rename"
              value={renameTo}
              onChange={(e) => setRenameTo(e.target.value)}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameFrom(null)} disabled={pending}>
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
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete folder */}
      <AlertDialog open={deleteFolder !== null} onOpenChange={(o) => !o && setDeleteFolder(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete folder {deleteFolder}</AlertDialogTitle>
            <AlertDialogDescription>
              The folder goes away. Its templates are kept and stay available in All {noun}s.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault()
                const name = deleteFolder
                if (!name) return
                run(() => shared.actions.renameCategory(name, '', channelName))
                setDeleteFolder(null)
              }}
            >
              Delete folder
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
