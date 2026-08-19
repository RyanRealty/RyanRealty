'use client'

/**
 * Shared composer attachment uploader (email + SMS composers).
 *
 * Files upload client-direct to the private crm-files bucket the moment they
 * are picked (signed upload URL from createCrmAttachmentUploadAction, then a
 * raw PUT) — form POSTs are capped at ~4.5MB on Vercel, so files can never
 * ride the send action itself. The form posts only an `attachments` JSON
 * field of storage paths; the send action re-validates ownership + caps.
 *
 * ── Migrated to the LOCKED admin v2 language (design_system/admin/ADMIN_UI.md).
 * PRESENTATION ONLY. useComposerAttachments, its returned shape, every limit,
 * error string and upload step are untouched; this is mounted by both G50
 * compose chokepoints.
 *
 * Two notes on HOW, because each is a trap:
 *  - The file picker is a TextField whose whole FIELD is hidden, not a raw
 *    input element. The primitive is what forwards the ref the paperclip
 *    clicks (see Button.tsx on why a primitive that swallows refs pushes
 *    callers to document.getElementById), and hiding the field rather than the
 *    control keeps the primitive's own visible label off the screen.
 *  - The "has attachments" wash is an INLINE background and deliberately so:
 *    `.av2-iconbtn` declares `background:none` unlayered, so a Tailwind
 *    utility for it would be silently dead. Only `background` is set inline,
 *    so the iconbtn's hover — which also brightens the icon colour — still
 *    fires on a lit button.
 */
import { useRef, useState } from 'react'
import { Loader2, Paperclip, X } from 'lucide-react'
import { createCrmAttachmentUploadAction } from '@/app/actions/crm-attachments'
import {
  limitsFor,
  validateAttachmentFile,
  type CrmAttachmentChannel,
  type CrmAttachmentRef,
} from '@/lib/crm/attachment-limits'
import { IconButton, SearchField, TextField } from '@/components/admin/v2'
import { cn } from '@/lib/utils'

// Stable per-session chip keys without a clock read (hydration-safety gate —
// these only run in event handlers, but the static rule can't tell).
let chipKeyCounter = 0
function nextChipKey(): string {
  chipKeyCounter += 1
  return `att-${chipKeyCounter}`
}

type PendingItem = {
  key: string
  name: string
  sizeBytes: number
  contentType: string
  status: 'uploading' | 'done' | 'error'
  path?: string
  error?: string
}

export function useComposerAttachments(params: { personId?: number; channel: CrmAttachmentChannel }) {
  const { personId, channel } = params
  const [items, setItems] = useState<PendingItem[]>([])
  // itemsRef mirrors state so sequential awaits in addFiles see fresh totals.
  const itemsRef = useRef<PendingItem[]>([])
  function setItemsSynced(update: (prev: PendingItem[]) => PendingItem[]) {
    setItems((prev) => {
      const next = update(prev)
      itemsRef.current = next
      return next
    })
  }
  function pushError(file: File, error: string) {
    const key = nextChipKey()
    setItemsSynced((prev) => [
      ...prev,
      { key, name: file.name, sizeBytes: file.size, contentType: file.type || 'application/octet-stream', status: 'error', error },
    ])
  }

  async function addFiles(files: FileList | File[]) {
    if (!personId) return
    const limits = limitsFor(channel)
    const list = Array.from(files)
    for (const file of list) {
      const current = itemsRef.current
      if (current.filter((i) => i.status !== 'error').length >= limits.maxFiles) {
        pushError(file, `At most ${limits.maxFiles} attachments per send`)
        continue
      }
      const contentType = file.type || 'application/octet-stream'
      const check = validateAttachmentFile(channel, { name: file.name, sizeBytes: file.size, contentType })
      if (!check.ok) {
        pushError(file, check.error)
        continue
      }
      const total = current
        .filter((i) => i.status !== 'error')
        .reduce((sum, i) => sum + i.sizeBytes, 0)
      if (total + file.size > limits.maxTotalBytes) {
        pushError(file, `Over the ${Math.round(limits.maxTotalBytes / 1024 / 1024)}MB total limit per send`)
        continue
      }
      const key = nextChipKey()
      setItemsSynced((prev) => [...prev, { key, name: file.name, sizeBytes: file.size, contentType, status: 'uploading' }])
      try {
        const grant = await createCrmAttachmentUploadAction({
          personId, channel, filename: file.name, contentType, sizeBytes: file.size,
        })
        if (!grant.ok) throw new Error(grant.error)
        const put = await fetch(grant.signedUrl, {
          method: 'PUT',
          headers: { 'Content-Type': contentType, 'x-upsert': 'false' },
          body: file,
        })
        if (!put.ok) throw new Error(`Upload failed (${put.status})`)
        setItemsSynced((prev) => prev.map((i) => (i.key === key ? { ...i, status: 'done', path: grant.path } : i)))
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        setItemsSynced((prev) => prev.map((i) => (i.key === key ? { ...i, status: 'error', error: msg } : i)))
      }
    }
  }

  function addReady(ref: CrmAttachmentRef) {
    setItemsSynced((prev) => {
      if (prev.some((i) => i.path === ref.path)) return prev
      return [
        ...prev,
        {
          key: nextChipKey(),
          name: ref.name,
          sizeBytes: ref.sizeBytes,
          contentType: ref.contentType,
          status: 'done',
          path: ref.path,
        },
      ]
    })
  }
  const addRef = addReady

  function remove(key: string) {
    setItemsSynced((prev) => prev.filter((i) => i.key !== key))
  }
  function clear() {
    setItemsSynced(() => [])
  }

  const ready: CrmAttachmentRef[] = items
    .filter((i): i is PendingItem & { path: string } => i.status === 'done' && !!i.path)
    .map((i) => ({ path: i.path, name: i.name, sizeBytes: i.sizeBytes, contentType: i.contentType }))
  const uploading = items.some((i) => i.status === 'uploading')

  return { items, addFiles, addReady, addRef, remove, clear, ready, uploading, enabled: Boolean(personId) }
}

export function AttachmentChips(props: {
  items: PendingItem[]
  onRemove: (key: string) => void
}) {
  if (props.items.length === 0) return null
  return (
    <div className="flex flex-wrap gap-1.5">
      {props.items.map((item) => (
        <div
          key={item.key}
          className="flex items-center gap-2 rounded-full px-3 py-1 text-xs"
          style={
            item.status === 'error'
              ? { border: '1px solid var(--a-danger)', background: 'var(--a-danger-wash)', color: 'var(--a-danger)' }
              : { border: '1px solid var(--a-border)', background: 'var(--a-inset)', color: 'var(--a-text)' }
          }
        >
          {item.status === 'uploading' ? (
            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" style={{ color: 'var(--a-text-2)' }} aria-hidden />
          ) : (
            <Paperclip className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--a-text-2)' }} aria-hidden />
          )}
          <span className="max-w-40 truncate" title={item.error ?? item.name}>{item.name}</span>
          <span
            className="shrink-0"
            style={{ color: item.status === 'error' ? 'var(--a-danger)' : 'var(--a-text-2)' }}
          >
            {item.status === 'error' ? (item.error ?? 'failed') : `${Math.max(1, Math.round(item.sizeBytes / 1024))}KB`}
          </span>
          {/* 16px keeps the chip's metric; nothing here paints colour, so the
              iconbtn hover (full-strength text + inset wash) still fires. */}
          <IconButton
            label={`Remove ${item.name}`}
            onClick={() => props.onRemove(item.key)}
            className="ml-1 shrink-0"
            style={{ width: 16, height: 16 }}
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </IconButton>
        </div>
      ))}
    </div>
  )
}

/** Paperclip trigger + hidden multi-file input + hidden JSON field, one drop-in. */
export function AttachmentControl(props: {
  attachments: ReturnType<typeof useComposerAttachments>
  accept?: string
  ariaLabel?: string
  className?: string
  iconClassName?: string
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { attachments } = props
  const lit = attachments.items.length > 0
  if (!attachments.enabled) return null
  return (
    <>
      {/* The whole field is hidden, label included — the paperclip below opens
          it through the ref the primitive forwards. */}
      <div className="hidden">
        <TextField
          ref={fileInputRef}
          label="Attachment files"
          type="file"
          multiple
          accept={props.accept}
          onChange={(e) => {
            if (e.target.files?.length) void attachments.addFiles(e.target.files)
            e.target.value = ''
          }}
        />
      </div>
      {/* Only fully-uploaded files post; the send action re-validates. */}
      <SearchField
        type="hidden"
        aria-label="Attachment payload"
        name="attachments"
        value={attachments.ready.length ? JSON.stringify(attachments.ready) : ''}
        readOnly
      />
      <IconButton
        label={props.ariaLabel ?? 'Attach files'}
        aria-pressed={lit}
        onClick={() => fileInputRef.current?.click()}
        className={cn('shrink-0', props.className)}
        // The 36px circle is the composer bar's own metric — it sits beside the
        // 36px round merge-field button. Only `background` is conditional, so
        // the iconbtn hover still brightens a lit button (see the header note).
        style={{ width: 36, height: 36, borderRadius: '50%', background: lit ? 'var(--a-inset)' : undefined }}
      >
        <Paperclip className={props.iconClassName ?? 'h-4 w-4'} aria-hidden />
      </IconButton>
    </>
  )
}
