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
 *
 * Admin v2 (11F): shadcn Dialog/AlertDialog/Alert/Input/Label/Switch/Textarea/
 * Button were replaced by the locked admin language — the delete confirmation
 * is ConfirmDialog, which carries the verb on its button the way the hand-rolled
 * AlertDialog already did. TextAreaField owns its <textarea>, so the emoji and
 * merge-token inserters reach it through the field's wrapper rather than a ref
 * on the control; same insertion at the same caret, same cursor restore.
 */
import { useRef, useState } from 'react'
import { Star } from 'lucide-react'
import {
  Button,
  ConfirmDialog,
  Dialog,
  IconButton,
  Switch,
  TextAreaField,
  TextField,
  VerdictLine,
} from '@/components/admin/v2'
import { MergeFieldInserter, insertAtCursor } from '@/components/admin/crm/MergeFieldInserter'
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
  const bodyFieldRef = useRef<HTMLDivElement>(null)

  const isEdit = row !== null

  function insertToken(token: string) {
    const el = bodyFieldRef.current?.querySelector('textarea') ?? null
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
    <Dialog
      open={open}
      onClose={() => {
        if (!pending) onClose()
      }}
      title={isEdit ? 'Edit Text Template' : 'Add Text Template'}
      description="Plain text only — line breaks send as line breaks. Merge fields resolve at send time."
      footer={
        <>
          <Button variant="quiet" onClick={onClose} disabled={pending || testSending}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="quiet"
            onClick={testSend}
            disabled={pending || testSending || !body.trim()}
            title="Sends this draft to your own cell (TCPA quiet hours apply)"
          >
            {testSending ? 'Sending...' : 'Send test to myself'}
          </Button>
          <Button onClick={save} disabled={pending || testSending}>
            {pending ? 'Saving...' : 'Save'}
          </Button>
        </>
      }
    >
      {note ? (
        <VerdictLine tone={note.tone === 'err' ? 'attention' : 'ok'}>
          <span className="whitespace-pre-wrap">{note.text}</span>
        </VerdictLine>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[65%_1fr]">
        {/* Left column — name + body + toolbar + hint */}
        <div className="space-y-3">
          <TextField
            label="Template name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
          <div className="space-y-1.5">
            <div ref={bodyFieldRef}>
              <TextAreaField
                label="Body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={7}
                placeholder="Hey %contact_first_name%, it's %agent_first_name% with Ryan Realty..."
              />
            </div>
            <div className="flex items-center gap-2 pt-0.5">
              <EmojiPickerButton onInsert={insertToken} />
              <MergeFieldInserter channel="sms" customFields={customFields} onInsert={insertToken} />
              <span
                className="a-num ml-auto"
                style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}
              >
                {body.length} characters
              </span>
            </div>
            <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>
              Remember to keep text messages short
            </p>
          </div>
          <div>
            <TextField
              label="Folder"
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
        <div
          className="space-y-4 p-3"
          style={{
            border: '1px solid var(--a-border)',
            borderRadius: 'var(--a-r-lg)',
            background: 'var(--a-inset)',
          }}
        >
          <Switch
            checked={isShared}
            onChange={(e) => setIsShared(e.target.checked)}
            label="Share this text template with everyone"
          />

          <div className="flex items-center gap-2">
            <IconButton
              label="Feature this template"
              aria-pressed={featured}
              onClick={() => setFeatured((f) => !f)}
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                border: `1px solid ${featured ? 'var(--a-accent)' : 'var(--a-border)'}`,
                background: featured ? 'var(--a-btn-bg)' : 'var(--a-bg)',
                color: featured ? 'var(--a-btn-fg)' : 'var(--a-text-2)',
              }}
            >
              <Star className="h-4 w-4" fill={featured ? 'currentColor' : 'none'} />
            </IconButton>
            <div>
              <p style={{ fontSize: 'var(--a-text-sm)', fontWeight: 500, color: 'var(--a-text)' }}>
                Feature
              </p>
              <p
                className="leading-snug"
                style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}
              >
                Featured templates surface first in the quick-text picker.
              </p>
            </div>
          </div>

          <Switch checked={isActive} onChange={(e) => setIsActive(e.target.checked)} label="Active" />

          {isEdit && isSuperuser ? (
            <Button
              type="button"
              variant="quiet"
              className="w-full"
              style={{
                justifyContent: 'flex-start',
                padding: '0 8px',
                background: 'none',
                border: 'none',
                color: 'var(--a-danger)',
              }}
              disabled={pending || (row?.usage ?? 0) > 0}
              title={(row?.usage ?? 0) > 0 ? 'Referenced by an automation. Detach it first.' : undefined}
              onClick={() => setConfirmDelete(true)}
            >
              Delete
            </Button>
          ) : null}
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={`Delete ${row?.name ?? ''}`}
        description="This cannot be undone. The template is removed for good."
        confirmLabel="Delete template"
        busy={pending}
        onConfirm={() => {
          void doDelete()
        }}
      />
    </Dialog>
  )
}
