import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { getBlogPostBySlug } from '@/app/actions/blog'
import { getSession } from '@/app/actions/auth'
import { getFubPersonIdFromCookie } from '@/app/actions/fub-identity-bridge'
import { trackPageViewIfPossible } from '@/lib/followupboss'
import { generateBlogSchema, generateBreadcrumbSchema } from '@/lib/structured-data'

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')

type PageProps = { params: Promise<{ slug: string }> }

function stripHtml(value: string | null | undefined): string {
  if (!value) return ''
  return value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

function estimateReadTime(content: string | null | undefined): number {
  const text = stripHtml(content)
  if (!text) return 2
  return Math.max(1, Math.round(text.split(/\s+/).length / 220))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const post = await getBlogPostBySlug(slug)
  if (!post) return { title: 'Post Not Found | Ryan Realty', robots: { index: false, follow: true } }

  const title = post.seo_title?.trim() || `${post.title} | Ryan Realty Blog`
  const description = post.seo_description?.trim() || post.excerpt?.trim() || 'Central Oregon real estate insights from Ryan Realty.'
  const canonical = `${siteUrl}/blog/${encodeURIComponent(post.slug)}`
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      type: 'article',
      siteName: 'Ryan Realty',
      ...(post.hero_image_url ? { images: [{ url: post.hero_image_url, alt: post.title }] } : {}),
    },
    twitter: {
      card: post.hero_image_url ? 'summary_large_image' : 'summary',
      title,
      description,
      ...(post.hero_image_url ? { images: [post.hero_image_url] } : {}),
    },
  }
}

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params
  const [post, session, fubPersonId] = await Promise.all([
    getBlogPostBySlug(slug),
    getSession(),
    getFubPersonIdFromCookie(),
  ])
  if (!post) notFound()

  const pageUrl = `${siteUrl}/blog/${encodeURIComponent(post.slug)}`
  const pageTitle = `${post.title} | Ryan Realty Blog`
  trackPageViewIfPossible({ sessionUser: session?.user ?? undefined, fubPersonId, pageUrl, pageTitle })

  const readMinutes = estimateReadTime(post.content)
  const articleSchema = generateBlogSchema({
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt,
    published_at: post.published_at,
    author_name: post.author_name,
  })
  const articleBody = post.content?.trim() || post.excerpt?.trim() || ''

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            generateBreadcrumbSchema([
              { name: 'Home', url: siteUrl },
              { name: 'Blog', url: `${siteUrl}/blog` },
              { name: post.title, url: `${siteUrl}/blog/${encodeURIComponent(post.slug)}` },
            ])
          ),
        }}
      />
      <nav aria-label="Breadcrumb" className="mb-6 text-sm text-muted-foreground">
        <Link href="/" className="hover:text-foreground">Home</Link>
        <span className="px-2">/</span>
        <Link href="/blog" className="hover:text-foreground">Blog</Link>
        <span className="px-2">/</span>
        <span className="text-foreground">{post.title}</span>
      </nav>

      <article className="rounded-xl border border-border bg-card p-6 shadow-sm sm:p-8">
        {post.category ? (
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{post.category}</p>
        ) : null}
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">{post.title}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          {post.author_name ? <span>{post.author_name}</span> : null}
          {post.published_at ? (
            <time dateTime={post.published_at}>
              {new Date(post.published_at).toLocaleDateString('en-US')}
            </time>
          ) : null}
          <span>{readMinutes} min read</span>
        </div>

        {post.hero_image_url ? (
          <div className="relative mt-6 aspect-[16/9] w-full overflow-hidden rounded-lg">
            <Image
              src={post.hero_image_url}
              alt={post.title}
              fill
              className="object-cover"
              sizes="(max-width: 1024px) 100vw, 896px"
              priority
            />
          </div>
        ) : null}

        {articleBody ? (
          <div className="prose prose-neutral mt-8 max-w-none text-foreground">
            <div className="whitespace-pre-line">{articleBody}</div>
          </div>
        ) : (
          <p className="mt-8 text-muted-foreground">This article is being updated.</p>
        )}
      </article>
    </main>
  )
}
