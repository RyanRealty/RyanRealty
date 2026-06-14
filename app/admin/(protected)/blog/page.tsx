import { revalidatePath } from 'next/cache'
import Link from 'next/link'
import { getAdminBlogPosts, saveBlogPost } from '@/app/actions/blog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import type { BlogPostWithAuthor } from '@/app/actions/blog'

export const dynamic = 'force-dynamic'

const PREVIEW_COUNT = 6

export default async function AdminBlogPage() {
  const posts = await getAdminBlogPosts()

  async function saveAction(formData: FormData) {
    'use server'
    const tagsRaw = String(formData.get('tags') ?? '').trim()
    const tags = tagsRaw ? tagsRaw.split(',').map((t) => t.trim()).filter(Boolean) : []

    const result = await saveBlogPost({
      id: String(formData.get('id') ?? '').trim() || undefined,
      slug: String(formData.get('slug') ?? ''),
      title: String(formData.get('title') ?? ''),
      content: String(formData.get('content') ?? ''),
      excerpt: String(formData.get('excerpt') ?? ''),
      category: String(formData.get('category') ?? ''),
      tags,
      heroImageUrl: String(formData.get('hero_image_url') ?? ''),
      seoTitle: String(formData.get('seo_title') ?? ''),
      seoDescription: String(formData.get('seo_description') ?? ''),
      status: (String(formData.get('status') ?? 'draft') as 'draft' | 'published'),
      publishedAt: String(formData.get('published_at') ?? '') || undefined,
    })
    if (!result.ok) throw new Error(result.error ?? 'Failed to save blog post')
    revalidatePath('/blog')
    revalidatePath('/admin/blog')
  }

  const publishedCount = posts.filter((p) => p.published_at).length
  const draftCount = posts.length - publishedCount
  const categories = [...new Set(posts.map((p) => p.category).filter(Boolean))]

  const previewPosts = posts.slice(0, PREVIEW_COUNT)
  const overflowPosts = posts.slice(PREVIEW_COUNT)

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

      {/* Create — deferred behind a tap so the list is the primary focus */}
      <details className="group rounded-xl bg-card ring-1 ring-foreground/10">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 p-4 text-base font-medium text-foreground [&::-webkit-details-marker]:hidden">
          <span>New blog post</span>
          <span className="text-sm text-muted-foreground transition-transform group-open:rotate-180" aria-hidden>
            ▾
          </span>
        </summary>
        <div className="border-t border-border p-4">
          <form action={saveAction} className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="title">Title</Label>
                <Input id="title" name="title" required placeholder="Central Oregon Housing Market Spring 2026 Update" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="slug">Slug</Label>
                <Input id="slug" name="slug" required placeholder="central-oregon-housing-market-spring-2026" />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="excerpt">Excerpt</Label>
              <Input id="excerpt" name="excerpt" placeholder="1-2 sentence summary for blog cards and social sharing" />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="grid gap-2">
                <Label htmlFor="category">Category</Label>
                <Input id="category" name="category" placeholder="Market Updates" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="tags">Tags (comma separated)</Label>
                <Input id="tags" name="tags" placeholder="market update, spring 2026, central oregon" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="status">Status</Label>
                <Input id="status" name="status" defaultValue="draft" placeholder="draft | published" />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="hero_image_url">Hero Image URL</Label>
                <Input id="hero_image_url" name="hero_image_url" placeholder="https://images.unsplash.com/..." />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="published_at">Published At (ISO date)</Label>
                <Input id="published_at" name="published_at" placeholder="2026-04-01T09:00:00Z" />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="seo_title">SEO Title (50-60 chars)</Label>
                <Input id="seo_title" name="seo_title" placeholder="Central Oregon Housing Market Spring 2026" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="seo_description">SEO Description (150-160 chars)</Label>
                <Input id="seo_description" name="seo_description" placeholder="Latest inventory, pricing, and rate data..." />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="content">Content (HTML)</Label>
              <Textarea id="content" name="content" required rows={14} className="font-mono text-sm" placeholder="<h2>Market Overview</h2><p>...</p>" />
            </div>
            <Button type="submit" className="w-full sm:w-auto">Save blog post</Button>
          </form>
        </div>
      </details>

      {/* Existing posts — capped, with the rest behind a tap */}
      <section className="space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-lg font-semibold text-foreground">Recent posts</h2>
          {posts.length > 0 && (
            <span className="text-sm text-muted-foreground tabular-nums">{posts.length} total</span>
          )}
        </div>

        {posts.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-2 px-6 py-12 text-center">
              <p className="text-base font-medium text-foreground">No blog posts yet</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                Open &ldquo;New blog post&rdquo; above to publish your first post, or run the seed script.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <ul className="space-y-2">
              {previewPosts.map((post) => (
                <PostRow key={post.id} post={post} />
              ))}
            </ul>

            {overflowPosts.length > 0 && (
              <details className="group space-y-2">
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-center gap-2 rounded-lg bg-card p-4 text-sm font-medium text-primary ring-1 ring-foreground/10 [&::-webkit-details-marker]:hidden">
                  <span className="group-open:hidden">Show all {posts.length} posts</span>
                  <span className="hidden group-open:inline">Show fewer</span>
                </summary>
                <ul className="mt-2 space-y-2">
                  {overflowPosts.map((post) => (
                    <PostRow key={post.id} post={post} />
                  ))}
                </ul>
              </details>
            )}
          </>
        )}
      </section>
    </div>
  )
}

function PostRow({ post }: { post: BlogPostWithAuthor }) {
  const isPublished = Boolean(post.published_at)
  return (
    <li>
      <Card>
        <CardContent className="flex items-center justify-between gap-3 p-4">
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
          <Link
            href={`/blog/${post.slug}`}
            className="flex h-11 shrink-0 items-center rounded-lg px-3 text-sm font-medium text-primary hover:underline"
          >
            View
          </Link>
        </CardContent>
      </Card>
    </li>
  )
}
