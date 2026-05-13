import type { Metadata } from 'next'
import Link from 'next/link'
import { getPublishedGuides } from '@/app/actions/guides'
import { generateBreadcrumbSchema } from '@/lib/structured-data'
import ContentPageHero from '@/components/layout/ContentPageHero'
import { CONTENT_HERO_IMAGES } from '@/lib/content-page-hero-images'

// Render on demand to avoid the 180s static-generation timeout. The published
// guides query is slow enough at build time that the static export windows out.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Real Estate Guides',
  description: 'Local buying and selling guides for Bend and Central Oregon.',
  alternates: { canonical: '/guides' },
  openGraph: {
    title: 'Real Estate Guides',
    description: 'Local buying and selling guides for Bend and Central Oregon.',
    url: '/guides',
    type: 'website',
    images: ['/api/og?type=default'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Real Estate Guides',
    description: 'Local buying and selling guides for Bend and Central Oregon.',
    images: ['/api/og?type=default'],
  },
}

export default async function GuidesIndexPage() {
  const guides = await getPublishedGuides()
  const collectionJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Ryan Realty Guides',
    description: 'Local buying and selling guides for Bend and Central Oregon.',
    url: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com'}/guides`,
  }
  const grouped = new Map<string, typeof guides>()
  for (const guide of guides) {
    const key = guide.category?.trim() || 'General'
    grouped.set(key, [...(grouped.get(key) ?? []), guide])
  }

  return (
    <main className="min-h-screen bg-background">
      <ContentPageHero
        title="Real Estate Guides"
        subtitle="Local market explainers and step-by-step playbooks for buyers and sellers in Central Oregon."
        imageUrl={CONTENT_HERO_IMAGES.areaGuides}
        ctas={[
          { label: 'Browse Listings', href: '/homes-for-sale', primary: true },
          { label: 'Area Guides', href: '/area-guides', primary: false },
        ]}
      />
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            generateBreadcrumbSchema([
              { name: 'Home', url: process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com' },
              { name: 'Guides', url: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com'}/guides` },
            ])
          ),
        }}
      />
      <div className="mt-8 space-y-8">
        {[...grouped.entries()].map(([category, rows]) => (
          <section key={category}>
            <h2 className="text-xl font-semibold text-foreground">{category}</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {rows.map((guide) => (
                <Link key={guide.id} href={`/guides/${guide.slug}`} className="rounded-lg border border-border bg-card p-5 hover:shadow-sm">
                  <p className="font-medium text-foreground">{guide.title}</p>
                  <p className="mt-2 text-sm text-muted-foreground">{guide.meta_description || 'Read the full guide'}</p>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
      </div>
    </main>
  )
}
