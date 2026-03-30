import Link from 'next/link'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import AdUnit from '@/components/AdUnit'
import HomeValuationCta from '@/components/HomeValuationCta'
import { getGuideBySlug, getPublishedGuides } from '@/app/actions/guides'
import { generateBreadcrumbSchema } from '@/lib/structured-data'

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
  const related = (await getPublishedGuides())
    .filter((row) => row.slug !== guide.slug && (row.city === guide.city || row.category === guide.category))
    .slice(0, 4)

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: `What should I know before buying in ${guide.city || 'Central Oregon'}?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Review local inventory, pricing trends, and financing options so your offer strategy matches current market conditions.',
        },
      },
      {
        '@type': 'Question',
        name: 'How often is this guide updated?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Guides are refreshed regularly as listing and market data changes.',
        },
      },
    ],
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            generateBreadcrumbSchema([
              { name: 'Home', url: process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com' },
              { name: 'Guides', url: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com'}/guides` },
              { name: guide.title, url: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com'}/guides/${guide.slug}` },
            ])
          ),
        }}
      />
      <article className="rounded-lg border border-border bg-card p-6">
        <nav className="mb-4 text-sm text-muted-foreground" aria-label="Breadcrumb">
          <Link href="/guides" className="hover:text-foreground">Guides</Link> / <span>{guide.title}</span>
        </nav>
        <h1 className="text-3xl font-semibold text-foreground">{guide.title}</h1>
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
      {related.length > 0 && (
        <section className="mt-8 rounded-lg border border-border bg-card p-6">
          <h2 className="text-lg font-semibold text-foreground">More guides</h2>
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
    </main>
  )
}
