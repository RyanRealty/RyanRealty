'use client'

import { useEffect, useState, useTransition } from 'react'
import { getAdminGuides, saveGuide, deleteGuide } from '@/app/actions/guides'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { GuideRow } from '@/app/actions/guides'

// Client component so we can do edit-in-place without a round-trip route.

type FormState = {
  id?: string
  slug: string
  title: string
  metaDescription: string
  contentHtml: string
  category: string
  city: string
  status: 'draft' | 'published' | 'archived'
}

const EMPTY_FORM: FormState = {
  id: undefined,
  slug: '',
  title: '',
  metaDescription: '',
  contentHtml: '',
  category: '',
  city: '',
  status: 'draft',
}

export default function AdminGuidesPage() {
  const [guides, setGuides] = useState<GuideRow[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [formOpen, setFormOpen] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [formSuccess, setFormSuccess] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  async function loadGuides() {
    setLoading(true)
    const result = await getAdminGuides()
    setGuides(result)
    setLoading(false)
  }

  useEffect(() => { loadGuides() }, [])

  function openCreate() {
    setForm(EMPTY_FORM)
    setFormError(null)
    setFormSuccess(null)
    setFormOpen(true)
  }

  function openEdit(guide: GuideRow) {
    setForm({
      id: guide.id,
      slug: guide.slug,
      title: guide.title,
      metaDescription: guide.meta_description ?? '',
      contentHtml: guide.content_html,
      category: guide.category ?? '',
      city: guide.city ?? '',
      status: guide.status,
    })
    setFormError(null)
    setFormSuccess(null)
    setFormOpen(true)
    setTimeout(() => document.getElementById('guide-form-anchor')?.scrollIntoView({ behavior: 'smooth' }), 50)
  }

  function handleField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function handleSubmit() {
    setFormError(null)
    setFormSuccess(null)
    startTransition(async () => {
      const result = await saveGuide({
        id: form.id || undefined,
        slug: form.slug,
        title: form.title,
        metaDescription: form.metaDescription,
        contentHtml: form.contentHtml,
        category: form.category,
        city: form.city,
        status: form.status,
      })
      if (!result.ok) {
        setFormError(result.error ?? 'Failed to save guide.')
        return
      }
      setFormSuccess(form.id ? 'Guide updated.' : 'Guide created.')
      setFormOpen(false)
      setForm(EMPTY_FORM)
      await loadGuides()
    })
  }

  function handleDelete(guide: GuideRow) {
    if (!window.confirm(`Delete "${guide.title}"? This cannot be undone.`)) return
    startTransition(async () => {
      const result = await deleteGuide(guide.id)
      if (!result.ok) {
        alert(result.error ?? 'Failed to delete guide.')
        return
      }
      await loadGuides()
    })
  }

  const publishedCount = guides.filter((g) => g.status === 'published').length
  const draftCount = guides.filter((g) => g.status === 'draft').length

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-foreground">Guides</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Create and publish SEO guides for city and neighborhood intent pages.
        </p>
      </header>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{guides.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Published</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{publishedCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Drafts</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{draftCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Create / Edit form */}
      <div id="guide-form-anchor" />
      <details
        open={formOpen}
        onToggle={(e) => setFormOpen((e.target as HTMLDetailsElement).open)}
        className="group rounded-xl bg-card ring-1 ring-foreground/10"
      >
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 p-4 text-base font-medium text-foreground [&::-webkit-details-marker]:hidden">
          <span>{form.id ? `Editing: ${form.title || 'guide'}` : 'New guide'}</span>
          <div className="flex items-center gap-3">
            {form.id && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={(e) => { e.preventDefault(); openCreate() }}
              >
                New guide
              </Button>
            )}
            <span className="text-sm text-muted-foreground transition-transform group-open:rotate-180" aria-hidden>
              ▾
            </span>
          </div>
        </summary>
        <div className="border-t border-border p-4">
          <div className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="guide-slug">Slug</Label>
                <Input
                  id="guide-slug"
                  value={form.slug}
                  onChange={(e) => handleField('slug', e.target.value)}
                  required
                  placeholder="bend-first-time-homebuyers-guide"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="guide-title">Title</Label>
                <Input
                  id="guide-title"
                  value={form.title}
                  onChange={(e) => handleField('title', e.target.value)}
                  required
                  placeholder="First Time Homebuyers Guide for Bend"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="guide-meta">Meta description</Label>
              <Input
                id="guide-meta"
                value={form.metaDescription}
                onChange={(e) => handleField('metaDescription', e.target.value)}
                placeholder="What to know about buying in Bend right now"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="grid gap-2">
                <Label htmlFor="guide-category">Category</Label>
                <Input
                  id="guide-category"
                  value={form.category}
                  onChange={(e) => handleField('category', e.target.value)}
                  placeholder="Buying, Selling, Neighborhoods"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="guide-city">City</Label>
                <Input
                  id="guide-city"
                  value={form.city}
                  onChange={(e) => handleField('city', e.target.value)}
                  placeholder="Bend"
                />
              </div>
              {/* P2-9 fix: replace free-text Input with Select — guides table has a CHECK constraint */}
              <div className="grid gap-2">
                <Label htmlFor="guide-status">Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) => handleField('status', v as 'draft' | 'published' | 'archived')}
                >
                  <SelectTrigger id="guide-status" className="h-10">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="published">Published</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="guide-content">Content HTML</Label>
              <Textarea
                id="guide-content"
                value={form.contentHtml}
                onChange={(e) => handleField('contentHtml', e.target.value)}
                required
                className="min-h-[260px] font-mono text-sm"
                placeholder="<h2>Market Overview</h2><p>...</p>"
              />
            </div>
            {formError && (
              <p className="text-sm text-destructive" role="alert">{formError}</p>
            )}
            {formSuccess && (
              <p className="text-sm text-success">{formSuccess}</p>
            )}
            <div className="flex flex-wrap gap-3">
              <Button type="button" onClick={handleSubmit} disabled={isPending} className="sm:w-auto">
                {isPending ? 'Saving…' : form.id ? 'Update guide' : 'Save guide'}
              </Button>
              {form.id && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={isPending}
                  onClick={() => { setForm(EMPTY_FORM); setFormOpen(false) }}
                  className="sm:w-auto"
                >
                  Cancel
                </Button>
              )}
            </div>
          </div>
        </div>
      </details>

      {/* Existing guides */}
      <Card>
        <CardHeader>
          <CardTitle>Existing guides</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : guides.length === 0 ? (
            <p className="text-sm text-muted-foreground">No guides yet.</p>
          ) : (
            <div className="space-y-3">
              {guides.map((guide) => (
                <div
                  key={guide.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-4 sm:flex-nowrap"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-foreground">{guide.title}</p>
                    <p className="mt-0.5 truncate text-sm text-muted-foreground">
                      /{guide.slug}
                      {guide.city ? ` · ${guide.city}` : ''}
                    </p>
                  </div>
                  {/* P1-2: edit + delete buttons (previously read-only list) */}
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <Badge variant={guide.status === 'published' ? 'default' : guide.status === 'archived' ? 'outline' : 'secondary'}>
                      {guide.status}
                    </Badge>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => openEdit(guide)}
                      disabled={isPending}
                    >
                      Edit
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDelete(guide)}
                      disabled={isPending}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="button" onClick={openCreate}>
          New guide
        </Button>
      </div>
    </div>
  )
}
