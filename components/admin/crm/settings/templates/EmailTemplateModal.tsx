'use client'

/**
 * EmailTemplateModal — the §13.1.3 / §13.1.4 Add + Edit Email Template modal.
 *
 * Spec anatomy, top to bottom:
 *   header    ✉ "Edit Email Template" + "Created on <date> by <name>" metadata
 *             (renders only when created_at is known — FUB-seeded rows carry
 *             none and we never fabricate a date, §0)
 *   notice    "In use by N automations" when referenced (informational — saving
 *             updates every downstream reference)
 *   fields    Subject + Merge Fields ▾ · Preview text + Merge Fields ▾ ·
 *             rich-text Body (toolbar per §13.1.3) · signature note ·
 *             "Share this template with everyone" · Folder assignment
 *   footer    Cancel | Save
 *
 * Preserved in-house extras (kept deliberately, beyond FUB parity): the
 * Preview tab (renders the exact outbound HTML), the Active switch (pickers
 * filter on it), and "Send test to myself" (routed through the compliance-
 * gated send paths — sends to the calling broker only).
 */
import { useRef, useState } from 'react'
import { Mail } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TemplatePreviewPane } from '@/components/admin/crm/settings/TemplatePreviewPane'
import { MergeFieldInserter, insertAtCursor } from '@/components/admin/crm/MergeFieldInserter'
import { RichTextBody, insertTokenInto } from './RichTextBody'
import type { TemplateRow, TemplatesShared } from './template-actions'

function fmtCreated(iso: string): string {
  const d = new Date(iso)
  const day = d.getDate()
  const ord = day % 10 === 1 && day !== 11 ? 'st' : day % 10 === 2 && day !== 12 ? 'nd' : day % 10 === 3 && day !== 13 ? 'rd' : 'th'
  const month = d.toLocaleString('en-US', { month: 'long', timeZone: 'America/Los_Angeles' })
  const time = d
    .toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/Los_Angeles' })
    .toLowerCase()
    .replace(' ', '')
  return `${month} ${day}${ord}, ${d.getFullYear()} at ${time}`
}

export function EmailTemplateModal({
  open,
  row,
  defaultFolder,
  folders,
  shared,
  onClose,
}: {
  open: boolean
  /** null = Add Email Template (blank form, §13.1.4). */
  row: TemplateRow | null
  /** Folder pre-assignment when creating from inside a folder. */
  defaultFolder: string | null
  /** Existing folder names for the assignment datalist. */
  folders: string[]
  shared: TemplatesShared
  onClose: () => void
}) {
  const { actions, customFields, mergeContext, brokerNames } = shared
  const [name, setName] = useState(row?.name ?? '')
  const [subject, setSubject] = useState(row?.subject ?? '')
  const [previewText, setPreviewText] = useState(row?.previewText ?? '')
  const [body, setBody] = useState(row?.body ?? '')
  const [category, setCategory] = useState(row?.category ?? defaultFolder ?? '')
  const [isShared, setIsShared] = useState(row?.isShared ?? false)
  const [isActive, setIsActive] = useState(row?.isActive ?? true)
  const [pending, setPending] = useState(false)
  const [testSending, setTestSending] = useState(false)
  const [note, setNote] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null)

  const subjectRef = useRef<HTMLInputElement>(null)
  const previewRef = useRef<HTMLInputElement>(null)
  const bodyWrapRef = useRef<HTMLDivElement>(null)

  const isEdit = row !== null
  const createdBy = row?.ownerBroker ? brokerNames[row.ownerBroker] ?? row.ownerBroker : null

  function insertIntoInput(ref: React.RefObject<HTMLInputElement | null>, set: (v: string) => void) {
    return (token: string) => {
      const el = ref.current
      if (!el) {
        set(token)
        return
      }
      const next = insertAtCursor(el as unknown as HTMLTextAreaElement, token)
      set(next)
      const pos = (el.selectionStart ?? 0) + token.length
      requestAnimationFrame(() => {
        el.focus()
        el.setSelectionRange(pos, pos)
      })
    }
  }

  async function save() {
    const trimmedName = name.trim()
    if (!trimmedName) return setNote({ tone: 'err', text: 'A template name is required' })
    if (!subject.trim()) return setNote({ tone: 'err', text: 'An email template needs a subject line' })
    if (!body.trim()) return setNote({ tone: 'err', text: 'Template body is required' })
    setPending(true)
    setNote(null)
    const input = {
      channel: 'email',
      name: trimmedName,
      subject: subject.trim(),
      previewText: previewText.trim() || null,
      body,
      category: category.trim() || null,
      isShared,
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
    if (!body.trim() || !subject.trim()) {
      return setNote({ tone: 'err', text: 'Subject and body are required for a test send.' })
    }
    setTestSending(true)
    setNote(null)
    const r = await actions.testSend({ channel: 'email', subject, body })
    setTestSending(false)
    setNote(r.ok ? { tone: 'ok', text: r.message ?? 'Test sent' } : { tone: 'err', text: r.error })
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !pending && !o && onClose()}>
      <DialogContent className="overflow-y-auto sm:max-w-3xl" style={{ maxHeight: '92vh' }}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-primary" />
            {isEdit ? 'Edit Email Template' : 'Add Email Template'}
          </DialogTitle>
          <DialogDescription>
            {isEdit && row?.createdAt ? (
              <>Created on {fmtCreated(row.createdAt)}{createdBy ? ` by ${createdBy}` : ''}</>
            ) : (
              'Merge fields resolve to real contact + agent data at send time.'
            )}
          </DialogDescription>
        </DialogHeader>

        {isEdit && row && row.usage > 0 ? (
          <Alert>
            <AlertDescription>
              In use by {row.usage} automation step{row.usage === 1 ? '' : 's'}
              {row.usedBy.length > 0 ? ` (${row.usedBy.join(', ')})` : ''}. Saving updates every
              reference.
            </AlertDescription>
          </Alert>
        ) : null}

        {note ? (
          <Alert variant={note.tone === 'err' ? 'destructive' : 'default'}>
            <AlertDescription className="whitespace-pre-wrap">{note.text}</AlertDescription>
          </Alert>
        ) : null}

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="etpl-name">Name</Label>
            <Input id="etpl-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="etpl-subject">Subject</Label>
            <div className="flex items-center gap-2">
              <Input
                id="etpl-subject"
                ref={subjectRef}
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="flex-1"
              />
              <MergeFieldInserter
                channel="email"
                customFields={customFields}
                onInsert={insertIntoInput(subjectRef, setSubject)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="etpl-preview">Preview text</Label>
            <div className="flex items-center gap-2">
              <Input
                id="etpl-preview"
                ref={previewRef}
                value={previewText}
                onChange={(e) => setPreviewText(e.target.value)}
                placeholder="Shown beneath the subject in the inbox preview (optional)"
                className="flex-1"
              />
              <MergeFieldInserter
                channel="email"
                customFields={customFields}
                onInsert={insertIntoInput(previewRef, setPreviewText)}
              />
            </div>
          </div>

          <Tabs defaultValue="edit">
            <TabsList className="h-8">
              <TabsTrigger value="edit" className="text-xs">
                Body
              </TabsTrigger>
              <TabsTrigger value="preview" className="text-xs">
                Preview
              </TabsTrigger>
            </TabsList>
            <TabsContent value="edit" className="mt-2">
              <div ref={bodyWrapRef}>
                <RichTextBody
                  value={row?.body ?? ''}
                  onChange={setBody}
                  toolbarExtras={
                    <MergeFieldInserter
                      channel="email"
                      customFields={customFields}
                      onInsert={(t) => {
                        if (!insertTokenInto(bodyWrapRef.current, t)) setBody((b) => b + t)
                      }}
                    />
                  }
                />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                The sender&rsquo;s signature is added automatically at send time from{' '}
                <a href="/admin/crm/settings" className="text-primary underline">
                  My Settings
                </a>
                . Inline styles only — style blocks and iframes are stripped.
              </p>
            </TabsContent>
            <TabsContent value="preview" className="mt-2">
              <TemplatePreviewPane
                channel="email"
                subject={subject}
                body={body}
                signatureHtml={null}
                mergeContext={mergeContext}
              />
            </TabsContent>
          </Tabs>

          <div className="flex items-center gap-2">
            <Checkbox
              id="etpl-shared"
              checked={isShared}
              onCheckedChange={(v) => setIsShared(v === true)}
            />
            <Label htmlFor="etpl-shared" className="cursor-pointer text-sm">
              Share this template with everyone
            </Label>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="etpl-folder">Folder</Label>
              <Input
                id="etpl-folder"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g. Buyer, Seller, Drip..."
                list="etpl-folder-options"
              />
              <datalist id="etpl-folder-options">
                {folders.map((f) => (
                  <option key={f} value={f} />
                ))}
              </datalist>
            </div>
            <div className="flex items-end pb-1">
              <span className="inline-flex items-center gap-2">
                <Switch id="etpl-active" checked={isActive} onCheckedChange={setIsActive} />
                <Label htmlFor="etpl-active" className="cursor-pointer text-sm">
                  Active (available in pickers)
                </Label>
              </span>
            </div>
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
            title="Sends this draft to your own inbox with sample contact data"
          >
            {testSending ? 'Sending...' : 'Send test to myself'}
          </Button>
          <Button onClick={save} disabled={pending || testSending}>
            {pending ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
