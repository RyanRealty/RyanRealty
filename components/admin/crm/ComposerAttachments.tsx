'use client'

/**
 * Shared composer attachment uploader (email + SMS composers).
 *
 * Files upload client-direct to the private crm-files bucket the moment they
 * are picked (signed upload URL from createCrmAttachmentUploadAction, then a
 * raw PUT) — form POSTs are capped at ~4.5MB on Vercel, so files can never
 * ride the send action itself. The form posts only an `attachments` JSON
 * field of storage paths; the send action re-validates ownership + caps.
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
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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

  return { items, addFiles, remove, clear, ready, uploading, enabled: Boolean(personId) }
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
          className={cn(
            'flex items-center gap-2 rounded-full border border-input bg-muted/40 px-3 py-1 text-xs',
            item.status === 'error' && 'border-destructive/50 text-destructive',
          )}
        >
          {item.status === 'uploading' ? (
            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" aria-hidden />
          ) : (
            <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
          )}
          <span className="max-w-40 truncate" title={item.error ?? item.name}>{item.name}</span>
          <span className="shrink-0 text-muted-foreground">
            {item.status === 'error' ? (item.error ?? 'failed') : `${Math.max(1, Math.round(item.sizeBytes / 1024))}KB`}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => props.onRemove(item.key)}
            aria-label={`Remove ${item.name}`}
            className="ml-1 h-4 w-4 shrink-0 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </Button>
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
  if (!attachments.enabled) return null
  return (
    <>
      <Input
        ref={fileInputRef}
        type="file"
        multiple
        accept={props.accept}
        onChange={(e) => {
          if (e.target.files?.length) void attachments.addFiles(e.target.files)
          e.target.value = ''
        }}
        className="hidden"
      />
      {/* Only fully-uploaded files post; the send action re-validates. */}
      <Input
        type="hidden"
        name="attachments"
        value={attachments.ready.length ? JSON.stringify(attachments.ready) : ''}
        readOnly
        className="hidden"
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => fileInputRef.current?.click()}
        aria-label={props.ariaLabel ?? 'Attach files'}
        aria-pressed={attachments.items.length > 0}
        className={cn(props.className, attachments.items.length > 0 && 'bg-muted text-foreground')}
      >
        <Paperclip className={props.iconClassName ?? 'h-4 w-4'} aria-hidden />
      </Button>
    </>
  )
}
