'use client'

import { useState, useEffect } from 'react'
import { getPageContent, updatePageContent } from '@/app/actions/site-pages'
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"

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
      <div className="rounded-lg border border-border bg-card p-6">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-lg font-semibold text-foreground">Edit: {page.label}</h3>
        <div className="flex gap-2">
          <a
            href={page.path}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-success hover:underline"
          >
            View page â†’
          </a>
          <Button
            type="button"
            onClick={onClose}
            className="text-sm text-muted-foreground hover:text-muted-foreground"
          >
            Close
          </Button>
        </div>
      </div>
      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <div>
          <Label className="block text-sm font-medium text-muted-foreground">Title</Label>
          <Input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-primary/20 px-3 py-2 text-foreground"
          />
        </div>
        <div>
          <Label className="block text-sm font-medium text-muted-foreground">Body (HTML)</Label>
          <Textarea
            value={bodyHtml}
            onChange={(e) => setBodyHtml(e.target.value)}
            rows={14}
            className="mt-1 block w-full rounded-lg border border-primary/20 px-3 py-2 font-mono text-sm text-foreground"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Use HTML tags: &lt;p&gt;, &lt;h2&gt;, &lt;a href=&quot;...&quot;&gt;, &lt;ul&gt;&lt;li&gt;, etc.
          </p>
        </div>
        {message && (
          <p className={`text-sm ${message.type === 'ok' ? 'text-success' : 'text-destructive'}`}>
            {message.text}
          </p>
        )}
        <div className="flex gap-2">
          <Button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save'}
          </Button>
          <Button type="button" onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-muted">
            Cancel
          </Button>
        </div>
      </form>
    </div>
  )
}

export { EDITABLE_PAGES }
