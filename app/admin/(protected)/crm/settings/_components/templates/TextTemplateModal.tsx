'use client'

/**
 * TextTemplateModal — the §13.2.3 Edit/Add Text Template modal.
 *
 * Two-column layout per spec: left (wider) = template name + plain-text body
 * with an Emoji + Merge Fields toolbar and the static hint "Remember to keep
 * text messages short"; right (narrower) = "Share this text template with
 * everyone" toggle, the circular Feature button (featured templates surface
 * prominently in the quick-text picker), and the red Delete button (with
 * confirmation). Footer: Cancel | Save.
 *
 * Preserved in-house extras: Active switch, folder assignment (our folders are
 * categories), and "Send test to myself" (compliance-gated — TCPA quiet hours
 * + A2P still apply; sends to the calling broker's own cell only).
 */
import { useRef, useState } from 'react'
import { Star } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { MergeFieldInserter, insertAtCursor } from '@/components/admin/crm/MergeFieldInserter'
import { cn } from '@/lib/utils'
import { EmojiPickerButton } from './EmojiPickerButton'
import type { TemplateRow, TemplatesShared } from './template-actions'

export function TextTemplateModal({
  open,
  row,
  defaultFolder,
  folders,
  shared,
  onClose,
}: {
  open: boolean
  /** null = Add Text Template (blank form). */
  row: TemplateRow | null
  defaultFolder: string | null
  folders: string[]
  shared: TemplatesShared
  onClose: () => void
}) {
  const { actions, customFields, isSuperuser } = shared
  const [name, setName] = useState(row?.name ?? '')
  const [body, setBody] = useState(row?.body ?? '')
  const [category, setCategory] = useState(row?.category ?? defaultFolder ?? '')
  const [isShared, setIsShared] = useState(row?.isShared ?? false)
  const [featured, setFeatured] = useState(row?.featured ?? false)
  const [isActive, setIsActive] = useState(row?.isActive ?? true)
  const [pending, setPending] = useState(false)
  const [testSending, setTestSending] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [note, setNote] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null)
  const bodyRef = useRef<HTMLTextAreaElement>(null)

  const isEdit = row !== null

  function insertToken(token: string) {
    const el = bodyRef.current
    if (!el) return setBody((b) => b + token)
    const next = insertAtCursor(el, token)
    setBody(next)
    const pos = (el.selectionStart ?? 0) + token.length
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(pos, pos)
    })
  }

  async function save() {
    const trimmedName = name.trim()
    if (!trimmedName) return setNote({ tone: 'err', text: 'A template name is required' })
    if (!body.trim()) return setNote({ tone: 'err', text: 'Template body is required' })
    setPending(true)
    setNote(null)
    const input = {
      channel: 'sms',
      name: trimmedName,
      body: body.trim(),
      category: category.trim() || null,
      isShared,
      featured,
      ownerBroker: row?.ownerBroker ?? null,
    }
    const r = row ? await actions.update(row.id, input) : await actions.create(input)
    if (r.ok && row && row.isActive !== isActive) {
      await actions.setActive(row.id, isActive)
    }
    setPending(false)
    if (r.ok) onClose()
    else setNote({ tone: 'err', text: r.error })
  }

  async function testSend() {
    if (!body.trim()) return setNote({ tone: 'err', text: 'Template body is empty. Nothing to send.' })
    setTestSending(true)
    setNote(null)
    const r = await actions.testSend({ channel: 'sms', body })
    setTestSending(false)
    setNote(r.ok ? { tone: 'ok', text: r.message ?? 'Test sent' } : { tone: 'err', text: r.error })
  }

  async function doDelete() {
    if (!row) return
    setPending(true)
    const r = await actions.remove(row.id)
    setPending(false)
    setConfirmDelete(false)
    if (r.ok) onClose()
    else setNote({ tone: 'err', text: r.error })
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !pending && !o && onClose()}>
      <DialogContent className="overflow-y-auto sm:max-w-2xl" style={{ maxHeight: '92vh' }}>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Text Template' : 'Add Text Template'}</DialogTitle>
          <DialogDescription>
            Plain text only — line breaks send as line breaks. Merge fields resolve at send time.
          </DialogDescription>
        </DialogHeader>

        {note ? (
          <Alert variant={note.tone === 'err' ? 'destructive' : 'default'}>
            <AlertDescription className="whitespace-pre-wrap">{note.text}</AlertDescription>
          </Alert>
        ) : null}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[65%_1fr]">
          {/* Left column — name + body + toolbar + hint */}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="ttpl-name">Template name</Label>
              <Input id="ttpl-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ttpl-body">Body</Label>
              <Textarea
                id="ttpl-body"
                ref={bodyRef}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={7}
                placeholder="Hey %contact_first_name%, it's %agent_first_name% with Ryan Realty..."
              />
              <div className="flex items-center gap-2 pt-0.5">
                <EmojiPickerButton onInsert={insertToken} />
                <MergeFieldInserter channel="sms" customFields={customFields} onInsert={insertToken} />
                <span className="ml-auto text-xs tabular-nums text-muted-foreground">
                  {body.length} characters
                </span>
              </div>
              <p className="text-sm text-muted-foreground">Remember to keep text messages short</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ttpl-folder">Folder</Label>
              <Input
                id="ttpl-folder"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g. Expired, FSBO..."
                list="ttpl-folder-options"
              />
              <datalist id="ttpl-folder-options">
                {folders.map((f) => (
                  <option key={f} value={f} />
                ))}
              </datalist>
            </div>
          </div>

          {/* Right column — share / feature / active / delete */}
          <div className="space-y-4 rounded-lg border border-border bg-muted/30 p-3">
            <div className="flex items-start gap-2">
              <Switch
                id="ttpl-shared"
                checked={isShared}
                onCheckedChange={setIsShared}
                className="mt-0.5"
              />
              <Label htmlFor="ttpl-shared" className="cursor-pointer text-sm leading-snug">
                Share this text template with everyone
              </Label>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-pressed={featured}
                aria-label="Feature this template"
                onClick={() => setFeatured((f) => !f)}
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full border transition-colors',
                  featured
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-card text-muted-foreground hover:border-primary hover:text-primary',
                )}
              >
                <Star className="h-4 w-4" fill={featured ? 'currentColor' : 'none'} />
              </button>
              <div>
                <p className="text-sm font-medium text-foreground">Feature</p>
                <p className="text-xs leading-snug text-muted-foreground">
                  Featured templates surface first in the quick-text picker.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch id="ttpl-active" checked={isActive} onCheckedChange={setIsActive} />
              <Label htmlFor="ttpl-active" className="cursor-pointer text-sm">
                Active
              </Label>
            </div>

            {isEdit && isSuperuser ? (
              <Button
                type="button"
                variant="ghost"
                className="w-full justify-start px-2 text-destructive hover:text-destructive"
                disabled={pending || (row?.usage ?? 0) > 0}
                title={(row?.usage ?? 0) > 0 ? 'Referenced by an automation. Detach it first.' : undefined}
                onClick={() => setConfirmDelete(true)}
              >
                Delete
              </Button>
            ) : null}
          </div>
        </div>

        <DialogFooter className="flex-wrap gap-2">
          <Button variant="outline" onClick={onClose} disabled={pending || testSending}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={testSend}
            disabled={pending || testSending || !body.trim()}
            title="Sends this draft to your own cell (TCPA quiet hours apply)"
          >
            {testSending ? 'Sending...' : 'Send test to myself'}
          </Button>
          <Button onClick={save} disabled={pending || testSending}>
            {pending ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>

        <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {row?.name}</AlertDialogTitle>
              <AlertDialogDescription>
                This cannot be undone. The template is removed for good.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault()
                  void doDelete()
                }}
                disabled={pending}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete template
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  )
}
