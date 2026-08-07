// @no-parity — internal admin surface, no public mockup contract
'use client'

/**
 * /admin/guides — P11D: migrated to the LOCKED admin v2 language
 * (design_system/admin/ADMIN_UI.md). Presentation only.
 *
 * Client component so we can do edit-in-place without a round-trip route.
 *
 * Carried over verbatim: EMPTY_FORM, openCreate/openEdit and every prefill, the
 * #guide-form-anchor scrollIntoView, the saveGuide payload field for field
 * (id · slug · title · metaDescription · contentHtml · category · city ·
 * status), the three status values the guides CHECK constraint allows, the
 * window.confirm delete guard and deleteGuide(guide.id), every reload after a
 * write, and every field label and placeholder string. No guide title, slug,
 * meta description or body was read, rewritten or re-cased by this migration,
 * and no status transition moved.
 *
 * Shape changed, data did not: three shadcn KPI cards became the family's
 * numbers strip, the bordered row list became the family's grid, the shadcn
 * form controls became the v2 Field primitives, the shadcn Badge became the v2
 * StateWord (text + color, never color alone), the <h1> title chrome is gone
 * (the nav names the page), and a thrown read now says so instead of rendering
 * as an empty library.
 *
 * The state words here are the `status` column verbatim — unlike /admin/blog,
 * this list reads the same column the site reads, so nothing is derived.
 * Measured 2026-08-07: `guides` holds 0 rows, so the empty state is the state
 * this page is in today.
 */

import { useEffect, useState, useTransition } from 'react'
import { getAdminGuides, saveGuide, deleteGuide } from '@/app/actions/guides'
import type { GuideRow } from '@/app/actions/guides'
import {
  Button,
  ReportError,
  ReportGrid,
  ReportNumbers,
  SectionHead,
  SelectField,
  StateWord,
  TextAreaField,
  TextField,
  VerdictLine,
  type AdminState,
  type ReportColumn,
} from '@/components/admin/v2'

const COLUMNS: ReportColumn[] = [
  { key: 'guide', label: 'Guide' },
  { key: 'city', label: 'City' },
  { key: 'status', label: 'Status' },
  { key: 'actions', label: 'Actions' },
]

const STATUS_STATE: Record<GuideRow['status'], AdminState> = {
  draft: 'waiting',
  published: 'ok',
  archived: 'accent',
}

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
  const [readFailed, setReadFailed] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [formOpen, setFormOpen] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [formSuccess, setFormSuccess] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  async function loadGuides() {
    setLoading(true)
    try {
      const result = await getAdminGuides()
      setGuides(result)
      setReadFailed(false)
    } catch {
      setGuides([])
      setReadFailed(true)
    }
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
  const archivedCount = guides.filter((g) => g.status === 'archived').length

  return (
    <div className="av2-scope" style={{ maxWidth: 1024, margin: '0 auto', padding: 16 }}>
      <div style={{ margin: '0 0 14px' }}>
        <VerdictLine tone={readFailed ? 'attention' : 'ok'}>
          {readFailed ? (
            <b>The guide list could not be read. Nothing below is the library.</b>
          ) : loading ? (
            <b>Reading the guides…</b>
          ) : guides.length === 0 ? (
            <>
              <b>No guide has been written.</b> The form below writes the first one.
            </>
          ) : (
            <>
              <b>
                {guides.length} {guides.length === 1 ? 'guide' : 'guides'} — {publishedCount}{' '}
                published, {draftCount} draft, {archivedCount} archived.
              </b>
            </>
          )}
        </VerdictLine>
      </div>

      {readFailed ? <ReportError what="The guide library" href="/admin/guides" /> : null}

      {!loading && !readFailed && guides.length > 0 && (
        <ReportNumbers
          items={[
            { key: 'total', label: 'Guides', value: String(guides.length) },
            { key: 'published', label: 'Published', value: String(publishedCount) },
            { key: 'draft', label: 'Draft', value: String(draftCount) },
            { key: 'archived', label: 'Archived', value: String(archivedCount) },
          ]}
        />
      )}

      <div id="guide-form-anchor" />
      <details
        className="av2-rcols"
        open={formOpen}
        onToggle={(e) => setFormOpen((e.target as HTMLDetailsElement).open)}
      >
        <summary>{form.id ? `Editing: ${form.title || 'guide'}` : 'New guide'}</summary>
        <div className="av2-rcols__body" style={{ display: 'grid', gap: 16 }}>
          <div className="av2-editgrid">
            <TextField
              label="Slug"
              value={form.slug}
              onChange={(e) => handleField('slug', e.target.value)}
              required
              placeholder="bend-first-time-homebuyers-guide"
            />
            <TextField
              label="Title"
              value={form.title}
              onChange={(e) => handleField('title', e.target.value)}
              required
              placeholder="First Time Homebuyers Guide for Bend"
            />
          </div>

          <TextField
            label="Meta description"
            value={form.metaDescription}
            onChange={(e) => handleField('metaDescription', e.target.value)}
            placeholder="What to know about buying in Bend right now"
          />

          <div className="av2-editgrid">
            <TextField
              label="Category"
              value={form.category}
              onChange={(e) => handleField('category', e.target.value)}
              placeholder="Buying, Selling, Neighborhoods"
            />
            <TextField
              label="City"
              value={form.city}
              onChange={(e) => handleField('city', e.target.value)}
              placeholder="Bend"
            />
            {/* P2-9 fix: replace free-text Input with Select — guides table has a CHECK constraint */}
            <SelectField
              label="Status"
              value={form.status}
              onChange={(e) =>
                handleField('status', e.target.value as 'draft' | 'published' | 'archived')
              }
            >
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </SelectField>
          </div>

          <TextAreaField
            label="Content HTML"
            value={form.contentHtml}
            onChange={(e) => handleField('contentHtml', e.target.value)}
            required
            style={{ minHeight: 260, fontFamily: 'var(--a-font-mono)', maxWidth: '100%' }}
            placeholder="<h2>Market Overview</h2><p>...</p>"
          />

          {formError && (
            <p role="alert" style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-danger)', margin: 0 }}>
              {formError}
            </p>
          )}
          {formSuccess && (
            <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-ok)', margin: 0 }}>{formSuccess}</p>
          )}

          <div className="av2-wordrow">
            <Button type="button" onClick={handleSubmit} disabled={isPending}>
              {isPending ? 'Saving…' : form.id ? 'Update guide' : 'Save guide'}
            </Button>
            {form.id && (
              <Button type="button" variant="quiet" disabled={isPending} onClick={openCreate}>
                New guide
              </Button>
            )}
            {form.id && (
              <Button
                type="button"
                variant="quiet"
                disabled={isPending}
                onClick={() => { setForm(EMPTY_FORM); setFormOpen(false) }}
              >
                Cancel
              </Button>
            )}
          </div>
        </div>
      </details>

      <SectionHead>Existing guides</SectionHead>
      <ReportGrid
        label="SEO guides"
        columns={COLUMNS}
        template="minmax(200px, 2.2fr) minmax(100px, 1fr) minmax(100px, 0.8fr) auto"
        minWidth={660}
        rows={guides.map((guide) => ({
          key: guide.id,
          cells: [
            <span key="t">
              <span style={{ fontWeight: 600 }}>{guide.title}</span>
              <span style={{ display: 'block', color: 'var(--a-text-2)', overflowWrap: 'anywhere' }}>
                /{guide.slug}
              </span>
            </span>,
            guide.city || '—',
            <StateWord key="s" state={STATUS_STATE[guide.status] ?? 'waiting'}>
              {guide.status}
            </StateWord>,
            <span key="a" className="av2-wordrow">
              <Button type="button" variant="quiet" onClick={() => openEdit(guide)} disabled={isPending}>
                Edit
              </Button>
              <Button type="button" variant="danger" onClick={() => handleDelete(guide)} disabled={isPending}>
                Delete
              </Button>
            </span>,
          ],
        }))}
        empty={
          loading
            ? 'Reading the guides…'
            : readFailed
              ? 'The read failed, so this list is not the library.'
              : 'No guide yet. Open “New guide” above to write the first one.'
        }
      />

      <p style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)', marginTop: 20 }}>
        The status word is the guide&rsquo;s <code>status</code> column, the same column the public
        city and neighborhood pages read.
      </p>
    </div>
  )
}
