// @no-parity — internal admin surface, no public mockup contract
'use client'

/**
 * /admin/blog — P11D: migrated to the LOCKED admin v2 language
 * (design_system/admin/ADMIN_UI.md). Presentation only.
 *
 * This page needs interactivity (edit-in-place, delete confirm) so it is a
 * client component. getAdminBlogPosts() is called from useEffect so the
 * service-role fetch still happens server-side (Next.js server action).
 * P0-3 note: all posts write to Supabase `blog_posts` and are served from
 * /blog (Next.js route). If AgentFire/WordPress is the real public blog,
 * a WP REST API integration would be needed in blog.ts. Based on the codebase,
 * /blog is the canonical public route — this is the correct architecture.
 *
 * Carried over verbatim: EMPTY_FORM, PREVIEW_COUNT, openCreate/openEdit and the
 * `post.published_at ? 'published' : 'draft'` prefill, the #blog-form-anchor
 * scrollIntoView, the comma-split tag parse, the saveBlogPost payload field for
 * field (id · slug · title · content · excerpt · category · tags ·
 * heroImageUrl · seoTitle · seoDescription · status · publishedAt), the
 * window.confirm delete guard and deleteBlogPost(post.id), every reload after a
 * write, the /blog/<slug> href, and every field label and placeholder string.
 * No post title, slug, excerpt, meta description or body was read, rewritten or
 * re-cased by this migration, and no status transition moved.
 *
 * Shape changed, data did not: four shadcn KPI cards became the family's
 * numbers strip, the card list became the family's grid, the shadcn form
 * controls became the v2 Field primitives, and a thrown read now says so
 * instead of rendering as an empty library.
 *
 * TWO LABELS CHANGED BECAUSE THEY WERE NOT TRUE. The page derives its state
 * from `published_at`, but the public blog serves a post only when
 * `status = 'published'` (app/actions/blog.ts getPublishedBlogPosts /
 * getBlogPostBySlug), and getAdminBlogPosts does not select `status`. Measured
 * 2026-08-07: 87 posts, all 87 with a publish date, so the old strip read
 * "Published 87 · Drafts 0" — while the status column holds published 55,
 * archived_stats_unverified 28, draft 3, pending_pilot_review 1. The figures
 * are now named for the column they actually sum, and the footnote says which
 * column the site reads.
 */

import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { getAdminBlogPosts, saveBlogPost, deleteBlogPost } from '@/app/actions/blog'
import type { BlogPostWithAuthor } from '@/app/actions/blog'
import {
  Button,
  ReportError,
  ReportGrid,
  ReportNumbers,
  SectionHead,
  SelectField,
  TextAreaField,
  TextField,
  VerdictLine,
  type ReportColumn,
} from '@/components/admin/v2'

const PREVIEW_COUNT = 6

const COLUMNS: ReportColumn[] = [
  { key: 'post', label: 'Post' },
  { key: 'category', label: 'Category' },
  { key: 'published', label: 'Publish date' },
  { key: 'actions', label: 'Actions' },
]

type FormState = {
  id?: string
  slug: string
  title: string
  content: string
  excerpt: string
  category: string
  tags: string
  heroImageUrl: string
  seoTitle: string
  seoDescription: string
  status: 'draft' | 'published'
  publishedAt: string
}

const EMPTY_FORM: FormState = {
  id: undefined,
  slug: '',
  title: '',
  content: '',
  excerpt: '',
  category: '',
  tags: '',
  heroImageUrl: '',
  seoTitle: '',
  seoDescription: '',
  status: 'draft',
  publishedAt: '',
}

export default function AdminBlogPage() {
  const [posts, setPosts] = useState<BlogPostWithAuthor[]>([])
  const [loading, setLoading] = useState(true)
  const [readFailed, setReadFailed] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [formOpen, setFormOpen] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [formSuccess, setFormSuccess] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [showAll, setShowAll] = useState(false)

  async function loadPosts() {
    setLoading(true)
    try {
      const result = await getAdminBlogPosts()
      setPosts(result)
      setReadFailed(false)
    } catch {
      setPosts([])
      setReadFailed(true)
    }
    setLoading(false)
  }

  useEffect(() => { loadPosts() }, [])

  function openEdit(post: BlogPostWithAuthor) {
    setForm({
      id: post.id,
      slug: post.slug,
      title: post.title,
      content: post.content ?? '',
      excerpt: post.excerpt ?? '',
      category: post.category ?? '',
      tags: (post.tags ?? []).join(', '),
      heroImageUrl: post.hero_image_url ?? '',
      seoTitle: post.seo_title ?? '',
      seoDescription: post.seo_description ?? '',
      status: post.published_at ? 'published' : 'draft',
      publishedAt: post.published_at ?? '',
    })
    setFormError(null)
    setFormSuccess(null)
    setFormOpen(true)
    // Scroll to form
    setTimeout(() => document.getElementById('blog-form-anchor')?.scrollIntoView({ behavior: 'smooth' }), 50)
  }

  function handleField(key: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function handleSubmit() {
    setFormError(null)
    setFormSuccess(null)
    startTransition(async () => {
      const tags = form.tags ? form.tags.split(',').map((t) => t.trim()).filter(Boolean) : []
      const result = await saveBlogPost({
        id: form.id || undefined,
        slug: form.slug,
        title: form.title,
        content: form.content,
        excerpt: form.excerpt,
        category: form.category,
        tags,
        heroImageUrl: form.heroImageUrl,
        seoTitle: form.seoTitle,
        seoDescription: form.seoDescription,
        status: form.status,
        publishedAt: form.publishedAt || undefined,
      })
      if (!result.ok) {
        setFormError(result.error ?? 'Failed to save blog post.')
        return
      }
      setFormSuccess(form.id ? 'Post updated.' : 'Post created.')
      setFormOpen(false)
      setForm(EMPTY_FORM)
      await loadPosts()
    })
  }

  function handleDelete(post: BlogPostWithAuthor) {
    if (!window.confirm(`Delete "${post.title}"? This cannot be undone.`)) return
    startTransition(async () => {
      const result = await deleteBlogPost(post.id)
      if (!result.ok) {
        alert(result.error ?? 'Failed to delete post.')
        return
      }
      await loadPosts()
    })
  }

  const datedCount = posts.filter((p) => p.published_at).length
  const undatedCount = posts.length - datedCount
  const categories = [...new Set(posts.map((p) => p.category).filter(Boolean))]
  const visiblePosts = showAll ? posts : posts.slice(0, PREVIEW_COUNT)

  return (
    <div className="av2-scope" style={{ maxWidth: 1024, margin: '0 auto', padding: 16 }}>
      <div style={{ margin: '0 0 14px' }}>
        <VerdictLine tone={readFailed ? 'attention' : 'ok'}>
          {readFailed ? (
            <b>The post list could not be read. Nothing below is the library.</b>
          ) : loading ? (
            <b>Reading the posts…</b>
          ) : posts.length === 0 ? (
            <b>No post is in the library.</b>
          ) : (
            <>
              <b>
                {posts.length} {posts.length === 1 ? 'post' : 'posts'}, {datedCount} carrying a
                publish date.
              </b>{' '}
              Undated first, then newest publish date.
            </>
          )}
        </VerdictLine>
      </div>

      {readFailed ? <ReportError what="The post library" href="/admin/blog" /> : null}

      {!loading && !readFailed && posts.length > 0 && (
        <ReportNumbers
          items={[
            { key: 'total', label: 'Posts', value: String(posts.length) },
            { key: 'dated', label: 'With a publish date', value: String(datedCount) },
            { key: 'undated', label: 'No publish date', value: String(undatedCount) },
            { key: 'cats', label: 'Categories', value: String(categories.length) },
          ]}
        />
      )}

      <div id="blog-form-anchor" />
      <details
        className="av2-rcols"
        open={formOpen}
        onToggle={(e) => setFormOpen((e.target as HTMLDetailsElement).open)}
      >
        <summary>{form.id ? `Editing: ${form.title || 'post'}` : 'New blog post'}</summary>
        <div className="av2-rcols__body" style={{ display: 'grid', gap: 16 }}>
          <div className="av2-editgrid">
            <TextField
              label="Title"
              value={form.title}
              onChange={(e) => handleField('title', e.target.value)}
              required
              placeholder="Central Oregon Housing Market Spring 2026 Update"
            />
            <TextField
              label="Slug"
              value={form.slug}
              onChange={(e) => handleField('slug', e.target.value)}
              required
              placeholder="central-oregon-housing-market-spring-2026"
            />
          </div>

          <TextField
            label="Excerpt"
            value={form.excerpt}
            onChange={(e) => handleField('excerpt', e.target.value)}
            placeholder="1-2 sentence summary for blog cards and social sharing"
          />

          <div className="av2-editgrid">
            <TextField
              label="Category"
              value={form.category}
              onChange={(e) => handleField('category', e.target.value)}
              placeholder="Market Updates"
            />
            <TextField
              label="Tags (comma separated)"
              value={form.tags}
              onChange={(e) => handleField('tags', e.target.value)}
              placeholder="market update, spring 2026, central oregon"
            />
            {/* P2-8 fix: replace free-text Input with Select for status */}
            <SelectField
              label="Status"
              value={form.status}
              onChange={(e) => handleField('status', e.target.value as 'draft' | 'published')}
            >
              <option value="draft">Draft</option>
              <option value="published">Published</option>
            </SelectField>
          </div>

          <div className="av2-editgrid">
            <TextField
              label="Hero Image URL"
              value={form.heroImageUrl}
              onChange={(e) => handleField('heroImageUrl', e.target.value)}
              placeholder="https://images.unsplash.com/..."
            />
            <TextField
              label="Published At (ISO date)"
              value={form.publishedAt}
              onChange={(e) => handleField('publishedAt', e.target.value)}
              placeholder="2026-04-01T09:00:00Z"
            />
          </div>

          <div className="av2-editgrid">
            <TextField
              label="SEO Title (50-60 chars)"
              value={form.seoTitle}
              onChange={(e) => handleField('seoTitle', e.target.value)}
              placeholder="Central Oregon Housing Market Spring 2026"
            />
            <TextField
              label="SEO Description (150-160 chars)"
              value={form.seoDescription}
              onChange={(e) => handleField('seoDescription', e.target.value)}
              placeholder="Latest inventory, pricing, and rate data..."
            />
          </div>

          <TextAreaField
            label="Content (HTML)"
            value={form.content}
            onChange={(e) => handleField('content', e.target.value)}
            required
            rows={14}
            style={{ fontFamily: 'var(--a-font-mono)', maxWidth: '100%' }}
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
              {isPending ? 'Saving…' : form.id ? 'Update post' : 'Save blog post'}
            </Button>
            {form.id && (
              <Button
                type="button"
                variant="quiet"
                disabled={isPending}
                onClick={() => { setForm(EMPTY_FORM); setFormOpen(true) }}
              >
                New post
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

      <SectionHead>Recent posts</SectionHead>
      <ReportGrid
        label="Blog posts"
        columns={COLUMNS}
        template="minmax(200px, 2.2fr) minmax(110px, 1fr) minmax(110px, 1fr) auto"
        minWidth={680}
        rows={visiblePosts.map((post) => ({
          key: post.id,
          cells: [
            <Link key="t" href={`/blog/${post.slug}`} style={{ color: 'var(--a-accent)' }}>
              {post.title}
            </Link>,
            post.category || 'Uncategorized',
            <span key="d" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {/* timeZone pinned, format untouched. published_at is a
                  timestamptz, so the bare call printed the UTC day on the
                  server and the Pacific day in the browser — a real hydration
                  mismatch (ci:hydration-safety). Pinning Pacific makes the
                  server agree with what the reader already ends up seeing, so
                  no printed day moves. NOT formatDate: that renders
                  "Aug 7, 2026" and would change every row's format. */}
              {post.published_at
                ? new Date(post.published_at).toLocaleDateString('en-US', {
                    timeZone: 'America/Los_Angeles',
                  })
                : 'Not set'}
            </span>,
            <span key="a" className="av2-wordrow">
              <Button type="button" variant="quiet" onClick={() => openEdit(post)} disabled={isPending}>
                Edit
              </Button>
              <Button type="button" variant="danger" onClick={() => handleDelete(post)} disabled={isPending}>
                Delete
              </Button>
            </span>,
          ],
        }))}
        empty={
          loading
            ? 'Reading the posts…'
            : readFailed
              ? 'The read failed, so this list is not the library.'
              : 'No blog post yet. Open “New blog post” above to write the first one.'
        }
      />

      {posts.length > PREVIEW_COUNT && (
        <div style={{ marginTop: 12 }}>
          <Button type="button" variant="quiet" touch onClick={() => setShowAll((v) => !v)}>
            {showAll ? 'Show fewer' : `Show all ${posts.length} posts`}
          </Button>
        </div>
      )}

      <p style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)', marginTop: 20 }}>
        The date column is the post&rsquo;s <code>published_at</code> value. The public blog serves a
        post only when its <code>status</code> is <code>published</code>, and this list does not read
        that column — a date here is not proof the post is live.
      </p>
    </div>
  )
}
