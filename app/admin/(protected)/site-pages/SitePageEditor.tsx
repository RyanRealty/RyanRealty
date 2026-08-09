'use client'

/**
 * Page-content editor island for /admin/site-pages.
 *
 * 11F: migrated to the LOCKED admin v2 language (design_system/admin/ADMIN_UI.md).
 * PRESENTATION ONLY — EDITABLE_PAGES, the props, both handlers, the effect and
 * its cancellation guard, the server actions, every conditional and every
 * visible string are byte-identical to the shadcn version.
 *
 * The swaps that are more than a colour rename:
 *  - Input + Label -> TextField, Textarea + Label -> TextAreaField. The two
 *    <Label> elements carried NO htmlFor and did not wrap their controls, so
 *    "Title" and "Body (HTML)" were floating text a screen reader never tied to
 *    anything. FieldShell owns the pair, so both fields gain an accessible name
 *    they never had; the visible strings are unchanged.
 *  - "Save" is the file's ONE primary action (ci:admin-ui rule C); "Close" and
 *    "Cancel" drop to variant="quiet". Both were previously default-variant
 *    shadcn Buttons wearing hand-written text colours over a solid primary fill,
 *    which read as three competing primaries on one card.
 *  - hover:opacity-90 / hover:bg-muted / disabled:opacity-60 go away because
 *    .av2-btn carries real hover, pressed and disabled states. hover:underline
 *    on the "View page →" link stays a class — it is the stylesheet's job, and
 *    the inline style here only sets colour.
 *  - the "View page →" link moves from text-success to var(--a-accent). §1 of
 *    the language reserves green/amber/red for STATUS; a link is an action, so
 *    it takes the one accent. The save/fail message keeps ok/danger, because
 *    that one IS a status.
 *  - the textarea keeps its monospace face via var(--a-font-mono) — editing raw
 *    HTML in a proportional face is the thing font-mono was there to prevent.
 */

import { useState, useEffect } from 'react'
import { getPageContent, updatePageContent } from '@/app/actions/site-pages'
import { Button, TextField, TextAreaField } from '@/components/admin/v2'

/** The section card: a hairline-held surface one step up from the page. */
const CARD_STYLE = { borderColor: 'var(--a-border)', background: 'var(--a-surface)' } as const

/** Pattern 6's single-column measure — the same 640px .av2-field itself caps at,
 *  applied to the body group so its helper line stays under its own control. */
const FIELD_MEASURE = { maxWidth: 640 } as const

type EditablePage = { key: string; label: string; path: string }

const EDITABLE_PAGES: EditablePage[] = [
  { key: 'about', label: 'About', path: '/about' },
  { key: 'sell', label: 'Sell', path: '/sell' },
  { key: 'contact', label: 'Contact', path: '/contact' },
]

type Props = {
  page: EditablePage
  onClose: () => void
}

export default function SitePageEditor({ page, onClose }: Props) {
  const [title, setTitle] = useState('')
  const [bodyHtml, setBodyHtml] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  useEffect(() => {
    let cancelled = false
    getPageContent(page.key).then((content) => {
      if (cancelled) return
      setTitle(content?.title ?? '')
      setBodyHtml(content?.body_html ?? '')
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [page.key])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMessage(null)
    setSaving(true)
    try {
      const result = await updatePageContent(page.key, { title, body_html: bodyHtml })
      if (result.ok) {
        setMessage({ type: 'ok', text: 'Saved. View the page to see changes.' })
      } else {
        setMessage({ type: 'err', text: result.error ?? 'Failed to save' })
      }
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="rounded-lg border p-6" style={CARD_STYLE}>
        <p style={{ color: 'var(--a-text-2)' }}>Loading…</p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border p-6" style={CARD_STYLE}>
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-lg font-semibold" style={{ color: 'var(--a-text)' }}>Edit: {page.label}</h3>
        <div className="flex gap-2">
          <a
            href={page.path}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm hover:underline"
            style={{ color: 'var(--a-accent)' }}
          >
            View page →
          </a>
          <Button type="button" onClick={onClose} variant="quiet">
            Close
          </Button>
        </div>
      </div>
      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <TextField
          label="Title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <div style={FIELD_MEASURE}>
          <TextAreaField
            label="Body (HTML)"
            value={bodyHtml}
            onChange={(e) => setBodyHtml(e.target.value)}
            rows={14}
            style={{ fontFamily: 'var(--a-font-mono)' }}
          />
          <p className="mt-1 text-xs" style={{ color: 'var(--a-text-2)' }}>
            Use HTML tags: &lt;p&gt;, &lt;h2&gt;, &lt;a href=&quot;...&quot;&gt;, &lt;ul&gt;&lt;li&gt;, etc.
          </p>
        </div>
        {message && (
          <p
            className="text-sm"
            style={{ color: message.type === 'ok' ? 'var(--a-ok)' : 'var(--a-danger)' }}
          >
            {message.text}
          </p>
        )}
        <div className="flex gap-2">
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
          <Button type="button" onClick={onClose} variant="quiet">
            Cancel
          </Button>
        </div>
      </form>
    </div>
  )
}

export { EDITABLE_PAGES }
