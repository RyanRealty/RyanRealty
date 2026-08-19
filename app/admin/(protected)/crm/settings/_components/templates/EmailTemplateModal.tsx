'use client'

/**
 * EmailTemplateModal — the §13.1.3 / §13.1.4 Add + Edit Email Template modal.
 *
 * Spec anatomy, top to bottom:
 *   header    "Edit Email Template" + "Created on <date> by <name>" metadata
 *             (renders only when created_at is known — CRM-seeded rows carry
 *             none and we never fabricate a date, §0)
 *   notice    "In use by N automations" when referenced (informational — saving
 *             updates every downstream reference)
 *   fields    Subject + Merge Fields ▾ · Preview text + Merge Fields ▾ ·
 *             rich-text Body (toolbar per §13.1.3) · signature note ·
 *             "Share this template with everyone" · Folder assignment
 *   footer    Cancel | Save
 *
 * Preserved in-house extras (kept deliberately, beyond CRM parity): the
 * Preview tab (renders the exact outbound HTML), the Active switch (pickers
 * filter on it), and "Send test to myself" (routed through the compliance-
 * gated send paths — sends to the calling broker only).
 *
 * Admin v2 (11F): shadcn Dialog/Alert/Tabs/Input/Label/Checkbox/Switch/Button
 * were replaced by the locked admin language. Two notes for a reviewer:
 *   - The Body/Preview tab pair is a FilterChip segmented control, which keeps
 *     the original's mount behaviour exactly — the inactive pane unmounts, as
 *     Radix Tabs also did.
 *   - TextField owns its <input>, so the caret-aware merge-token inserters
 *     reach the control through the field row's wrapper rather than a ref on
 *     the control itself. Same insertion, same cursor restore.
 */
import { useRef, useState } from 'react'
import Link from 'next/link'
import {
  Button,
  Dialog,
  FilterChip,
  Switch,
  TextField,
  ToolbarCheck,
  VerdictLine,
} from '@/components/admin/v2'
import { TemplatePreviewPane } from '../TemplatePreviewPane'
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
  const [tab, setTab] = useState<'edit' | 'preview'>('edit')

  const subjectRowRef = useRef<HTMLDivElement>(null)
  const previewRowRef = useRef<HTMLDivElement>(null)
  const bodyWrapRef = useRef<HTMLDivElement>(null)

  const isEdit = row !== null
  const createdBy = row?.ownerBroker ? brokerNames[row.ownerBroker] ?? row.ownerBroker : null

  function insertIntoInput(rowRef: React.RefObject<HTMLDivElement | null>, set: (v: string) => void) {
    return (token: string) => {
      const el = rowRef.current?.querySelector('input') ?? null
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
    <Dialog
      open={open}
      onClose={() => {
        if (!pending) onClose()
      }}
      title={isEdit ? 'Edit Email Template' : 'Add Email Template'}
      description={
        isEdit && row?.createdAt ? (
          <>Created on {fmtCreated(row.createdAt)}{createdBy ? ` by ${createdBy}` : ''}</>
        ) : (
          'Merge fields resolve to real contact + agent data at send time.'
        )
      }
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
            title="Sends this draft to your own inbox with sample contact data"
          >
            {testSending ? 'Sending...' : 'Send test to myself'}
          </Button>
          <Button onClick={save} disabled={pending || testSending}>
            {pending ? 'Saving...' : 'Save'}
          </Button>
        </>
      }
    >
      {isEdit && row && row.usage > 0 ? (
        <VerdictLine tone="attention">
          In use by {row.usage} automation step{row.usage === 1 ? '' : 's'}
          {row.usedBy.length > 0 ? ` (${row.usedBy.join(', ')})` : ''}. Saving updates every
          reference.
        </VerdictLine>
      ) : null}

      {note ? (
        <VerdictLine tone={note.tone === 'err' ? 'attention' : 'ok'}>
          <span className="whitespace-pre-wrap">{note.text}</span>
        </VerdictLine>
      ) : null}

      <div className="space-y-3">
        <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />

        <div className="av2-inline-form" ref={subjectRowRef}>
          <TextField label="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
          <MergeFieldInserter
            channel="email"
            customFields={customFields}
            onInsert={insertIntoInput(subjectRowRef, setSubject)}
          />
        </div>

        <div className="av2-inline-form" ref={previewRowRef}>
          <TextField
            label="Preview text"
            value={previewText}
            onChange={(e) => setPreviewText(e.target.value)}
            placeholder="Shown beneath the subject in the inbox preview (optional)"
          />
          <MergeFieldInserter
            channel="email"
            customFields={customFields}
            onInsert={insertIntoInput(previewRowRef, setPreviewText)}
          />
        </div>

        <div>
          <div
            className="flex w-fit gap-0.5 p-0.5"
            style={{ background: 'var(--a-inset)', borderRadius: 'var(--a-r-md)' }}
          >
            {([
              { key: 'edit' as const, label: 'Body' },
              { key: 'preview' as const, label: 'Preview' },
            ]).map((t) => (
              <FilterChip
                key={t.key}
                pressed={tab === t.key}
                onClick={() => setTab(t.key)}
                style={{
                  borderRadius: 'var(--a-r-sm)',
                  border: 'none',
                  padding: '4px 12px',
                  fontSize: 'var(--a-text-xs)',
                  fontWeight: 500,
                  background: tab === t.key ? 'var(--a-bg)' : 'transparent',
                  color: tab === t.key ? 'var(--a-text)' : 'var(--a-text-2)',
                }}
              >
                {t.label}
              </FilterChip>
            ))}
          </div>

          {tab === 'edit' ? (
            <div className="mt-2">
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
              <p
                className="mt-2"
                style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}
              >
                The sender&rsquo;s signature is added automatically at send time from{' '}
                <Link
                  href="/admin/crm/settings"
                  className="underline"
                  style={{ color: 'var(--a-accent)' }}
                >
                  My Settings
                </Link>
                . Inline styles only — style blocks and iframes are stripped.
              </p>
            </div>
          ) : (
            <div className="mt-2">
              <TemplatePreviewPane
                channel="email"
                subject={subject}
                body={body}
                signatureHtml={null}
                mergeContext={mergeContext}
              />
            </div>
          )}
        </div>

        <ToolbarCheck
          checked={isShared}
          onChange={(e) => setIsShared(e.target.checked)}
          label="Share this template with everyone"
        />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <TextField
              label="Folder"
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
            <Switch
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              label="Active (available in pickers)"
            />
          </div>
        </div>
      </div>
    </Dialog>
  )
}
