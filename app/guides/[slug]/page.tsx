import Link from 'next/link'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { PageBreadcrumb } from '@/components/site/PageBreadcrumb'
import { H1, H3 } from '@/components/site/primitives'
import AdUnit from '@/components/AdUnit'
import HomeValuationCta from '@/components/HomeValuationCta'
import CityClusterNav from '@/components/CityClusterNav'
import { getGuideBySlug, getPublishedGuides } from '@/lib/data'
import { generateBreadcrumbSchema, generateBlogSchema } from '@/lib/structured-data'
import { cityEntityKey } from '@/lib/slug'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const guide = await getGuideBySlug(slug)
  if (!guide) return {}
  return {
    title: guide.title,
    description: guide.meta_description ?? undefined,
    alternates: { canonical: `/guides/${guide.slug}` },
    openGraph: {
      title: guide.title,
      description: guide.meta_description ?? undefined,
      url: `/guides/${guide.slug}`,
      type: 'article',
      images: ['/api/og?type=default'],
    },
    twitter: {
      card: 'summary_large_image',
      title: guide.title,
      description: guide.meta_description ?? undefined,
      images: ['/api/og?type=default'],
    },
  }
}

export default async function GuideDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const guide = await getGuideBySlug(slug)
  if (!guide) notFound()
  const related = (await getPublishedGuides(200))
    .filter((row) => row.slug !== guide.slug && (row.city === guide.city || row.category === guide.category))
    .slice(0, 4)

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')

  // Article JSON-LD built from live guide data — no fabricated fields.
  // generateBlogSchema emits BlogPosting which is a sub-type of Article; the
  // same function is used by app/blog/[slug]/page.tsx and already carries
  // dateModified for the AI/Google recency signal.
  const articleSchema = generateBlogSchema({
    title: guide.title,
    slug: `guides/${guide.slug}`,
    excerpt: guide.meta_description ?? null,
    published_at: (guide as Record<string, unknown>).published_at as string | null ?? null,
    updated_at: (guide as Record<string, unknown>).updated_at as string | null ?? null,
  })

  return (
    <main className="min-h-screen bg-background">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            generateBreadcrumbSchema([
              { name: 'Home', url: siteUrl },
              { name: 'Guides', url: `${siteUrl}/guides` },
              { name: guide.title, url: `${siteUrl}/guides/${guide.slug}` },
            ])
          ),
        }}
      />
      <PageBreadcrumb trail={[{ label: 'Guides', href: '/guides' }, { label: guide.title }]} includeJsonLd={false} />
      <div className="mx-auto max-w-4xl px-4 pb-10 pt-4 sm:px-6">
      <article className="rounded-lg border border-border bg-card p-6">
        <H1 className="text-3xl">{guide.title}</H1>
        {guide.meta_description && <p className="mt-3 text-muted-foreground">{guide.meta_description}</p>}
        <div className="mt-6">
          <AdUnit slot="4004001001" format="horizontal" />
        </div>
        <div
          className="prose prose-sm mt-6 max-w-none text-foreground"
          dangerouslySetInnerHTML={{ __html: guide.content_html }}
        />
        <div className="mt-6">
          <AdUnit slot="4004001002" format="horizontal" />
        </div>
      </article>
      {guide.city && (
        <div className="mt-8">
          <CityClusterNav
            cityName={guide.city}
            citySlug={cityEntityKey(guide.city)}
            activePage="guide"
            guideSlug={guide.slug}
          />
        </div>
      )}
      {related.length > 0 && (
        <section className="mt-8 rounded-lg border border-border bg-card p-6">
          <H3 className="text-lg font-semibold">More guides</H3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {related.map((row) => (
              <Link key={row.slug} href={`/guides/${row.slug}`} className="rounded-md border border-border bg-muted px-4 py-3 text-sm font-medium text-foreground hover:bg-background">
                {row.title}
              </Link>
            ))}
          </div>
        </section>
      )}
      <section className="mt-8">
        <HomeValuationCta />
      </section>
      </div>
    </main>
  )
}
