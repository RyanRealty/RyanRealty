'use client'

/**
 * RichTextBody — the §13.1.3 email-body editor.
 *
 * A contentEditable surface with the spec's toolbar: Bold, Italic, Underline,
 * unordered/ordered lists, Insert Link, Insert Image (URL — CRM does not host
 * assets either, §13.4.8), and a Merge Fields inserter slot. Emits HTML; the
 * send path already handles HTML bodies (looksLikeHtml → sent as-is with
 * inline styles). Plain-text legacy bodies are lifted to <br>-separated HTML
 * on load so editing never mangles them.
 *
 * Deliberately dependency-free (document.execCommand — deprecated but
 * universally supported and appropriate for an internal admin editor).
 *
 * Admin v2 (11F): color and type now come from the locked admin tokens and the
 * toolbar is built from IconButton. SHARED SURFACE — the calendar's
 * AppointmentModal mounts this too, so the props and the DOM contract are
 * unchanged: one root element, the [contenteditable] node insertTokenInto()
 * reaches by query, and the __insertToken property hung on it. `prose` stays:
 * Tailwind's preflight strips list markers, so the two list buttons render
 * nothing without it.
 */
import { useEffect, useRef } from 'react'
import { Bold, Italic, Underline, List, ListOrdered, Link2, Image as ImageIcon } from 'lucide-react'
import { IconButton } from '@/components/admin/v2'
import { looksLikeHtml } from '@/lib/crm/email-body'
import type { ReactNode } from 'react'

/** Lift a plain-text body to minimal HTML for the editor. */
export function toEditorHtml(body: string): string {
  if (!body.trim()) return ''
  if (looksLikeHtml(body)) return body
  return body
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>')
}

export function RichTextBody({
  value,
  onChange,
  toolbarExtras,
  minHeight = 220,
}: {
  /** HTML (or legacy plain text) body. */
  value: string
  onChange: (html: string) => void
  /** Right-aligned toolbar slot — the Merge Fields inserter. */
  toolbarExtras?: ReactNode
  minHeight?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  // Track the last html we emitted so external value changes (open a different
  // template) re-seed the editor without clobbering the caret while typing.
  const lastEmitted = useRef<string | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (value !== lastEmitted.current) {
      el.innerHTML = toEditorHtml(value)
      lastEmitted.current = value
    }
  }, [value])

  function emit() {
    const el = ref.current
    if (!el) return
    lastEmitted.current = el.innerHTML
    onChange(el.innerHTML)
  }

  function exec(command: string, arg?: string) {
    ref.current?.focus()
    document.execCommand(command, false, arg)
    emit()
  }

  /** Insert a merge token (or any text) at the caret. */
  function insertText(text: string) {
    ref.current?.focus()
    document.execCommand('insertText', false, text)
    emit()
  }

  // Expose insertText to the parent through a stable property on the DOM node
  // (the modal reaches it via the ref callback below).
  useEffect(() => {
    const el = ref.current as (HTMLDivElement & { __insertToken?: (t: string) => void }) | null
    if (el) el.__insertToken = insertText
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const tools: Array<{ icon: typeof Bold; label: string; run: () => void }> = [
    { icon: Bold, label: 'Bold', run: () => exec('bold') },
    { icon: Italic, label: 'Italic', run: () => exec('italic') },
    { icon: Underline, label: 'Underline', run: () => exec('underline') },
    { icon: List, label: 'Bulleted list', run: () => exec('insertUnorderedList') },
    { icon: ListOrdered, label: 'Numbered list', run: () => exec('insertOrderedList') },
    {
      icon: Link2,
      label: 'Insert link',
      run: () => {
        const url = window.prompt('Link URL')
        if (url) exec('createLink', url)
      },
    },
    {
      icon: ImageIcon,
      label: 'Insert image by URL',
      run: () => {
        const url = window.prompt('Image URL (images are hosted externally)')
        if (url) exec('insertImage', url)
      },
    },
  ]

  return (
    <div
      style={{
        border: '1px solid var(--a-border)',
        borderRadius: 'var(--a-r-lg)',
        background: 'var(--a-bg)',
      }}
    >
      <div
        className="flex flex-wrap items-center gap-0.5 px-2 py-1.5"
        style={{ borderBottom: '1px solid var(--a-border)' }}
      >
        {tools.map((t) => (
          <IconButton
            key={t.label}
            label={t.label}
            onMouseDown={(e) => {
              // Keep the editor selection alive — a button mousedown would blur it.
              e.preventDefault()
              t.run()
            }}
          >
            <t.icon className="h-3.5 w-3.5" />
          </IconButton>
        ))}
        <div
          aria-hidden="true"
          className="mx-1"
          style={{ height: 20, borderLeft: '1px solid var(--a-border)' }}
        />
        <div className="ml-auto">{toolbarExtras}</div>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label="Email body"
        className="prose prose-sm px-3 py-2.5 outline-none focus-visible:ring-0 [&_a]:underline [&_a]:text-[color:var(--a-accent)]"
        // maxWidth inline rather than max-w-none: it cancels the same `prose`
        // max-width, and ci:admin-ui rule D ratchets DISTINCT max-w-* tokens
        // under app/admin — this was the only new one in the family.
        style={{
          maxWidth: 'none',
          minHeight,
          fontFamily: 'var(--a-font)',
          fontSize: 'var(--a-text-md)',
          color: 'var(--a-text)',
        }}
        onInput={emit}
        onBlur={emit}
      />
    </div>
  )
}

/** Reach the editor's caret-aware token inserter from a parent component. */
export function insertTokenInto(editorRoot: HTMLElement | null, token: string): boolean {
  const el = editorRoot?.querySelector('[contenteditable]') as
    | (HTMLElement & { __insertToken?: (t: string) => void })
    | null
  if (el?.__insertToken) {
    el.__insertToken(token)
    return true
  }
  return false
}
