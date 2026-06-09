/* Blog post detail — HTML rendering, ShareButton, related posts, author bio */
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { getBlogPostBySlug, getRelatedBlogPosts } from '@/lib/data'
import { getSession } from '@/app/actions/auth'
import { getFubPersonIdFromCookie } from '@/app/actions/fub-identity-bridge'
import { trackPageViewIfPossible } from '@/lib/followupboss'
import { generateBlogSchema, generateBreadcrumbSchema } from '@/lib/structured-data'
import ShareButton from '@/components/ShareButton'
import { BreadcrumbNav } from '@/components/site/BreadcrumbNav'
import { Container, H1, H2 } from '@/components/site/primitives'

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
  const ogImageUrl = post.hero_image_url
    ? `${siteUrl}/api/og?type=blog&id=${encodeURIComponent(post.slug)}`
    : `${siteUrl}/api/og?type=default`
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
      images: [{ url: ogImageUrl, width: 1200, height: 630, alt: post.title }],
      ...(post.published_at ? { publishedTime: post.published_at } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImageUrl],
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

  const relatedPosts = await getRelatedBlogPosts(post.slug, post.category, 3)

  const pageUrl = `${siteUrl}/blog/${encodeURIComponent(post.slug)}`
  const pageTitle = `${post.title} | Ryan Realty Blog`
  trackPageViewIfPossible({ sessionUser: session?.user ?? undefined, fubPersonId, pageUrl, pageTitle })

  const readMinutes = estimateReadTime(post.content)
  const articleSchema = generateBlogSchema({
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt,
    published_at: post.published_at,
    updated_at: post.updated_at,
    image: post.hero_image_url
      ? `${siteUrl}/api/og?type=blog&id=${encodeURIComponent(post.slug)}`
      : undefined,
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
      <Container className="pt-3 pb-1">
        <BreadcrumbNav
          includeJsonLd={false}
          items={[
            { label: 'Home', href: '/' },
            { label: 'Blog', href: '/blog' },
            { label: post.title },
          ]}
        />
      </Container>

      <article className="rounded-xl border border-border bg-card p-6 shadow-sm sm:p-8">
        {post.category ? (
          <Link
            href={`/blog?category=${encodeURIComponent(post.category)}`}
            className="text-xs font-medium uppercase tracking-wide text-muted-foreground hover:text-foreground"
          >
            {post.category}
          </Link>
        ) : null}
        <H1 className="mt-2 text-3xl sm:text-4xl">{post.title}</H1>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          {post.author_name ? (
            post.author_slug ? (
              <Link href={`/team/${post.author_slug}`} className="hover:text-foreground">
                {post.author_name}
              </Link>
            ) : (
              <span>{post.author_name}</span>
            )
          ) : null}
          {post.published_at ? (
            <time dateTime={post.published_at}>
              {new Date(post.published_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </time>
          ) : null}
          <span>{readMinutes} min read</span>
          <ShareButton
            url={pageUrl}
            title={post.title}
            text={post.excerpt ?? undefined}
            trackContext="blog_post"
            variant="compact"
          />
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
          <div
            className="prose prose-neutral mt-8 max-w-none text-foreground prose-headings:text-foreground prose-a:text-primary prose-strong:text-foreground prose-li:text-foreground"
            dangerouslySetInnerHTML={{ __html: articleBody }}
          />
        ) : (
          <p className="mt-8 text-muted-foreground">This article is being updated.</p>
        )}

        {/* Tags */}
        {post.tags && post.tags.length > 0 ? (
          <div className="mt-8 flex flex-wrap gap-2 border-t border-border pt-6">
            {post.tags.map((tag) => (
              <span key={tag} className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                {tag}
              </span>
            ))}
          </div>
        ) : null}

        {/* Bottom share */}
        <div className="mt-8 flex items-center justify-between border-t border-border pt-6">
          <p className="text-sm text-muted-foreground">Found this helpful? Share it with someone who could use it.</p>
          <ShareButton
            url={pageUrl}
            title={post.title}
            text={post.excerpt ?? undefined}
            trackContext="blog_post_bottom"
            variant="default"
          />
        </div>
      </article>

      {/* Author bio */}
      {post.author_name ? (
        <section className="mt-8 rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-start gap-4">
            {post.author_photo_url ? (
              <Image
                src={post.author_photo_url}
                alt={post.author_name}
                width={64}
                height={64}
                className="rounded-full object-cover"
              />
            ) : (
              <div className="flex size-16 shrink-0 items-center justify-center rounded-full bg-primary text-xl font-bold text-primary-foreground">
                {post.author_name.charAt(0)}
              </div>
            )}
            <div>
              <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">About the author</p>
              {post.author_slug ? (
                <Link href={`/team/${post.author_slug}`} className="text-lg font-semibold text-foreground hover:text-primary">
                  {post.author_name}
                </Link>
              ) : (
                <p className="text-lg font-semibold text-foreground">{post.author_name}</p>
              )}
              <p className="mt-1 text-sm text-muted-foreground">
                Ryan Realty team member sharing local market insights and expertise for Central Oregon home buyers and sellers.
              </p>
            </div>
          </div>
        </section>
      ) : null}

      {/* Related posts */}
      {relatedPosts.length > 0 ? (
        <section className="mt-8">
          <H2 className="text-xl">Related Posts</H2>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            {relatedPosts.map((related) => (
              <Link
                key={related.id}
                href={`/blog/${related.slug}`}
                className="group overflow-hidden rounded-lg border border-border bg-card shadow-sm transition hover:shadow-md"
              >
                {related.hero_image_url ? (
                  <div className="relative aspect-[16/10] w-full">
                    <Image
                      src={related.hero_image_url}
                      alt={related.title || 'Related post'}
                      fill
                      className="object-cover transition group-hover:scale-105"
                      sizes="(max-width: 640px) 100vw, 33vw"
                    />
                  </div>
                ) : null}
                <div className="p-4">
                  <p className="text-sm font-semibold text-foreground line-clamp-2">{related.title}</p>
                  {related.published_at ? (
                    <time className="mt-1 block text-xs text-muted-foreground" dateTime={related.published_at}>
                      {new Date(related.published_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                    </time>
                  ) : null}
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  )
}
