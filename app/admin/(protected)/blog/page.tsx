'use client'

import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { getAdminBlogPosts, saveBlogPost, deleteBlogPost } from '@/app/actions/blog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { BlogPostWithAuthor } from '@/app/actions/blog'

// This page needs interactivity (edit-in-place, delete confirm) so it is a
// client component. getAdminBlogPosts() is called from useEffect so the
// service-role fetch still happens server-side (Next.js server action).
// P0-3 note: all posts write to Supabase `blog_posts` and are served from
// /blog (Next.js route). If AgentFire/WordPress is the real public blog,
// a WP REST API integration would be needed in blog.ts. Based on the codebase,
// /blog is the canonical public route — this is the correct architecture.

const PREVIEW_COUNT = 6

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
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [formOpen, setFormOpen] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [formSuccess, setFormSuccess] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [showAll, setShowAll] = useState(false)

  async function loadPosts() {
    setLoading(true)
    const result = await getAdminBlogPosts()
    setPosts(result)
    setLoading(false)
  }

  useEffect(() => { loadPosts() }, [])

  function openCreate() {
    setForm(EMPTY_FORM)
    setFormError(null)
    setFormSuccess(null)
    setFormOpen(true)
  }

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

  const publishedCount = posts.filter((p) => p.published_at).length
  const draftCount = posts.length - publishedCount
  const categories = [...new Set(posts.map((p) => p.category).filter(Boolean))]
  const visiblePosts = showAll ? posts : posts.slice(0, PREVIEW_COUNT)

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-foreground">Blog posts</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Create, edit, and publish posts for the live blog.
        </p>
      </header>

      {/* Glanceable summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total posts</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{posts.length}</p>
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
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Categories</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{categories.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Create / Edit form */}
      <div id="blog-form-anchor" />
      <details open={formOpen} onToggle={(e) => setFormOpen((e.target as HTMLDetailsElement).open)} className="group rounded-xl bg-card ring-1 ring-foreground/10">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 p-4 text-base font-medium text-foreground [&::-webkit-details-marker]:hidden">
          <span>{form.id ? `Editing: ${form.title || 'post'}` : 'New blog post'}</span>
          <div className="flex items-center gap-3">
            {form.id && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={(e) => { e.preventDefault(); setForm(EMPTY_FORM); setFormOpen(true) }}
              >
                New post
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
                <Label htmlFor="blog-title">Title</Label>
                <Input
                  id="blog-title"
                  value={form.title}
                  onChange={(e) => handleField('title', e.target.value)}
                  required
                  placeholder="Central Oregon Housing Market Spring 2026 Update"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="blog-slug">Slug</Label>
                <Input
                  id="blog-slug"
                  value={form.slug}
                  onChange={(e) => handleField('slug', e.target.value)}
                  required
                  placeholder="central-oregon-housing-market-spring-2026"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="blog-excerpt">Excerpt</Label>
              <Input
                id="blog-excerpt"
                value={form.excerpt}
                onChange={(e) => handleField('excerpt', e.target.value)}
                placeholder="1-2 sentence summary for blog cards and social sharing"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="grid gap-2">
                <Label htmlFor="blog-category">Category</Label>
                <Input
                  id="blog-category"
                  value={form.category}
                  onChange={(e) => handleField('category', e.target.value)}
                  placeholder="Market Updates"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="blog-tags">Tags (comma separated)</Label>
                <Input
                  id="blog-tags"
                  value={form.tags}
                  onChange={(e) => handleField('tags', e.target.value)}
                  placeholder="market update, spring 2026, central oregon"
                />
              </div>
              {/* P2-8 fix: replace free-text Input with Select for status */}
              <div className="grid gap-2">
                <Label htmlFor="blog-status">Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) => handleField('status', v as 'draft' | 'published')}
                >
                  <SelectTrigger id="blog-status" className="h-10">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="published">Published</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="blog-hero">Hero Image URL</Label>
                <Input
                  id="blog-hero"
                  value={form.heroImageUrl}
                  onChange={(e) => handleField('heroImageUrl', e.target.value)}
                  placeholder="https://images.unsplash.com/..."
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="blog-published-at">Published At (ISO date)</Label>
                <Input
                  id="blog-published-at"
                  value={form.publishedAt}
                  onChange={(e) => handleField('publishedAt', e.target.value)}
                  placeholder="2026-04-01T09:00:00Z"
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="blog-seo-title">SEO Title (50-60 chars)</Label>
                <Input
                  id="blog-seo-title"
                  value={form.seoTitle}
                  onChange={(e) => handleField('seoTitle', e.target.value)}
                  placeholder="Central Oregon Housing Market Spring 2026"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="blog-seo-desc">SEO Description (150-160 chars)</Label>
                <Input
                  id="blog-seo-desc"
                  value={form.seoDescription}
                  onChange={(e) => handleField('seoDescription', e.target.value)}
                  placeholder="Latest inventory, pricing, and rate data..."
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="blog-content">Content (HTML)</Label>
              <Textarea
                id="blog-content"
                value={form.content}
                onChange={(e) => handleField('content', e.target.value)}
                required
                rows={14}
                className="font-mono text-sm"
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
                {isPending ? 'Saving…' : form.id ? 'Update post' : 'Save blog post'}
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

      {/* Existing posts */}
      <section className="space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-lg font-semibold text-foreground">Recent posts</h2>
          {posts.length > 0 && (
            <span className="text-sm text-muted-foreground tabular-nums">{posts.length} total</span>
          )}
        </div>

        {loading ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">Loading…</CardContent>
          </Card>
        ) : posts.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-2 px-6 py-12 text-center">
              <p className="text-base font-medium text-foreground">No blog posts yet</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                Open &ldquo;New blog post&rdquo; above to publish your first post.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <ul className="space-y-2">
              {visiblePosts.map((post) => (
                <PostRow
                  key={post.id}
                  post={post}
                  onEdit={() => openEdit(post)}
                  onDelete={() => handleDelete(post)}
                  isPending={isPending}
                />
              ))}
            </ul>
            {posts.length > PREVIEW_COUNT && (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => setShowAll((v) => !v)}
              >
                {showAll ? 'Show fewer' : `Show all ${posts.length} posts`}
              </Button>
            )}
          </>
        )}
      </section>

      {/* Redirect button to create new post (sticky below) */}
      <div className="flex justify-end">
        <Button type="button" onClick={openCreate}>
          New blog post
        </Button>
      </div>
    </div>
  )
}

function PostRow({
  post,
  onEdit,
  onDelete,
  isPending,
}: {
  post: BlogPostWithAuthor
  onEdit: () => void
  onDelete: () => void
  isPending: boolean
}) {
  const isPublished = Boolean(post.published_at)
  return (
    <li>
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4 sm:flex-nowrap">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate font-medium text-foreground">{post.title}</p>
              <Badge variant={isPublished ? 'default' : 'secondary'} className="shrink-0">
                {isPublished ? 'Published' : 'Draft'}
              </Badge>
            </div>
            <p className="mt-1 truncate text-sm text-muted-foreground">
              {post.category || 'Uncategorized'}
              {' · '}
              <span className="tabular-nums">
                {post.published_at
                  ? new Date(post.published_at).toLocaleDateString('en-US')
                  : 'Not published'}
              </span>
            </p>
          </div>
          {/* P1-1: edit + delete buttons (previously only "View" link existed) */}
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onEdit}
              disabled={isPending}
            >
              Edit
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              onClick={onDelete}
              disabled={isPending}
            >
              Delete
            </Button>
            <Link
              href={`/blog/${post.slug}`}
              className="flex h-9 items-center rounded-lg px-3 text-sm font-medium text-primary hover:underline"
            >
              View
            </Link>
          </div>
        </CardContent>
      </Card>
    </li>
  )
}
