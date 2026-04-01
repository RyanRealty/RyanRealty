import { revalidatePath } from 'next/cache'
import Link from 'next/link'
import { getAdminBlogPosts, saveBlogPost } from '@/app/actions/blog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'

export const dynamic = 'force-dynamic'

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

  const publishedCount = posts.filter((p) => p.seo_title !== undefined).length
  const categories = [...new Set(posts.map((p) => p.category).filter(Boolean))]

  return (
    <main className="space-y-8 p-6">
      <header>
        <h1 className="text-2xl font-semibold text-foreground">Blog Posts</h1>
        <p className="text-sm text-muted-foreground">
          Create, edit, and publish blog posts. {posts.length} total posts across {categories.length} categories.
        </p>
      </header>

      <section className="rounded-lg border border-border bg-card p-6">
        <h2 className="text-lg font-semibold text-foreground">New Blog Post</h2>
        <form action={saveAction} className="mt-4 grid gap-4">
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
            <Textarea id="content" name="content" required className="min-h-[300px] font-mono text-sm" placeholder="<h2>Market Overview</h2><p>...</p>" />
          </div>
          <Button type="submit" className="w-full sm:w-auto">Save Blog Post</Button>
        </form>
      </section>

      <section className="rounded-lg border border-border bg-card p-6">
        <h2 className="text-lg font-semibold text-foreground">Existing Posts ({posts.length})</h2>
        <div className="mt-4 space-y-3">
          {posts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No blog posts yet. Create one above or run the seed script.</p>
          ) : (
            posts.map((post) => (
              <div key={post.id} className="flex items-start justify-between gap-4 rounded-md border border-border p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-medium text-foreground">{post.title}</p>
                    <Badge variant={post.seo_title ? 'default' : 'secondary'} className="shrink-0">
                      {post.category || 'Uncategorized'}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    /blog/{post.slug}
                    {post.published_at ? ` · ${new Date(post.published_at).toLocaleDateString('en-US')}` : ' · Draft'}
                  </p>
                </div>
                <Link href={`/blog/${post.slug}`} className="text-sm text-primary hover:underline">
                  View
                </Link>
              </div>
            ))
          )}
        </div>
      </section>
    </main>
  )
}
