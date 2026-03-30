import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { getPublishedBlogPosts, getPopularBlogSlugs, getBlogCategories } from '@/app/actions/blog'
import { getSession } from '@/app/actions/auth'
import { getFubPersonIdFromCookie } from '@/app/actions/fub-identity-bridge'
import { trackPageViewIfPossible } from '@/lib/followupboss'
import { shouldNoIndexBlogIndex } from '@/lib/seo-routing'
import ShareButton from '@/components/ShareButton'
import { generateBreadcrumbSchema } from '@/lib/structured-data'

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
const defaultOgImage = `${siteUrl}/api/og?type=default`

type BlogSearchParams = { category?: string; page?: string }

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<BlogSearchParams>
}): Promise<Metadata> {
  const params = await searchParams
  const shouldNoIndex = shouldNoIndexBlogIndex(params)
  const title = 'Central Oregon Real Estate Blog | Market Insights and Guides | Ryan Realty'
  const description = 'Market reports, community guides, and tips for buying and selling in Central Oregon.'
  return {
    title,
    description,
    alternates: { canonical: `${siteUrl}/blog` },
    robots: shouldNoIndex ? { index: false, follow: true } : undefined,
    openGraph: {
      title: 'Central Oregon Real Estate Blog | Ryan Realty',
      description,
      url: `${siteUrl}/blog`,
      type: 'website',
      images: [{ url: defaultOgImage, width: 1200, height: 630, alt: 'Ryan Realty blog' }],
    },
    twitter: {
      card: 'summary_large_image',
      title: 'Central Oregon Real Estate Blog | Ryan Realty',
      description,
      images: [defaultOgImage],
    },
  }
}

function estimateReadTime(content: string | null): number {
  if (!content) return 2
  const words = content.trim().split(/\s+/).length
  return Math.max(1, Math.round(words / 200))
}

type PageProps = { searchParams: Promise<BlogSearchParams> }

export default async function BlogIndexPage({ searchParams }: PageProps) {
  const params = await searchParams
  const category = params.category ?? 'All'
  const page = Math.max(1, parseInt(params.page ?? '1', 10))
  const offset = (page - 1) * 12
  const [categories, { posts, total }, popularSlugs, session, fubPersonId] = await Promise.all([
    getBlogCategories(),
    getPublishedBlogPosts({ category: category === 'All' ? null : category, limit: 12, offset }),
    getPopularBlogSlugs(5),
    getSession(),
    getFubPersonIdFromCookie(),
  ])
  const pageUrl = `${siteUrl}/blog`
  const pageTitle = 'Blog | Ryan Realty'
  trackPageViewIfPossible({ sessionUser: session?.user ?? undefined, fubPersonId, pageUrl, pageTitle })
  const totalPages = Math.ceil(total / 12)
  const featured = posts[0]

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    name: 'Central Oregon Real Estate Blog | Ryan Realty',
    url: `${siteUrl}/blog`,
    description: 'Market insights and guides for Central Oregon real estate.',
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            generateBreadcrumbSchema([
              { name: 'Home', url: siteUrl },
              { name: 'Blog', url: `${siteUrl}/blog` },
            ])
          ),
        }}
      />
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-3xl font-bold text-foreground">Blog</h1>
        <ShareButton
          url={`${siteUrl}/blog`}
          title="Central Oregon real estate blog"
          text="Market reports, community guides, and buying or selling tips for Central Oregon."
          trackContext="blog_index"
          variant="compact"
        />
      </div>
      <p className="mt-2 text-muted-foreground">
        Market insights, community guides, and tips for buying and selling in Central Oregon.
      </p>

      <nav className="mt-6 flex flex-wrap gap-2" aria-label="Categories">
        {categories.map((cat) => (
          <Link
            key={cat}
            href={cat === 'All' ? '/blog' : `/blog?category=${encodeURIComponent(cat)}`}
            className={`rounded-full px-4 py-2 text-sm font-medium ${category === cat ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-border'}`}
          >
            {cat}
          </Link>
        ))}
      </nav>

      {featured && page === 1 && (
        <article className="mt-8">
          <Link href={`/blog/${featured.slug}`} className="block overflow-hidden rounded-xl border border-border bg-card shadow-sm transition hover:shadow-md">
            {featured.hero_image_url && (
              <div className="relative aspect-[2/1] w-full">
                <Image src={featured.hero_image_url} alt={featured.title || 'Featured blog post'} fill className="object-cover" sizes="(max-width: 768px) 100vw, 1024px" />
              </div>
            )}
            <div className="p-6">
              {featured.category && <span className="text-xs font-medium uppercase text-muted-foreground">{featured.category}</span>}
              <h2 className="mt-2 text-2xl font-bold text-foreground">{featured.title}</h2>
              {featured.excerpt && <p className="mt-2 line-clamp-2 text-muted-foreground">{featured.excerpt}</p>}
              <div className="mt-3 flex items-center gap-3 text-sm text-muted-foreground">
                {featured.author_name && <span>{featured.author_name}</span>}
                {featured.published_at && <time dateTime={featured.published_at}>{new Date(featured.published_at).toLocaleDateString('en-US')}</time>}
              </div>
            </div>
          </Link>
        </article>
      )}

      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {(page === 1 ? posts.slice(1) : posts).map((post) => (
          <article key={post.id}>
            <Link href={`/blog/${post.slug}`} className="block overflow-hidden rounded-lg border border-border bg-card shadow-sm transition hover:shadow-md">
              {post.hero_image_url && (
                <div className="relative aspect-[16/10] w-full">
                  <Image src={post.hero_image_url} alt={post.title || 'Blog post image'} fill className="object-cover" sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" />
                </div>
              )}
              <div className="p-4">
                {post.category && <span className="text-xs font-medium uppercase text-muted-foreground">{post.category}</span>}
                <h2 className="mt-1 text-lg font-semibold text-foreground line-clamp-2">{post.title}</h2>
                {post.excerpt && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{post.excerpt}</p>}
                <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                  {post.author_name && <span>{post.author_name}</span>}
                  {post.published_at && <time dateTime={post.published_at}>{new Date(post.published_at).toLocaleDateString('en-US')}</time>}
                  <span>{estimateReadTime(null)} min read</span>
                </div>
              </div>
            </Link>
          </article>
        ))}
      </div>

      {totalPages > 1 && (
        <nav className="mt-10 flex justify-center gap-2" aria-label="Pagination">
          {page > 1 && (
            <Link href={`/blog?page=${page - 1}${category !== 'All' ? `&category=${encodeURIComponent(category)}` : ''}`} className="rounded-lg border border-primary/20 px-4 py-2 text-sm font-medium hover:bg-muted">
              Previous
            </Link>
          )}
          <span className="flex items-center px-4 py-2 text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          {page < totalPages && (
            <Link href={`/blog?page=${page + 1}${category !== 'All' ? `&category=${encodeURIComponent(category)}` : ''}`} className="rounded-lg border border-primary/20 px-4 py-2 text-sm font-medium hover:bg-muted">
              Next
            </Link>
          )}
        </nav>
      )}

      <aside className="mt-12 border-t border-border pt-8">
        <h3 className="text-sm font-semibold text-foreground">Popular posts</h3>
        <ul className="mt-2 space-y-2">
          {popularSlugs.slice(0, 5).map((slug) => (
            <li key={slug}>
              <Link href={`/blog/${slug}`} className="text-sm text-primary hover:underline">
                {slug.replace(/-/g, ' ')}
              </Link>
            </li>
          ))}
        </ul>
      </aside>
    </main>
  )
}
