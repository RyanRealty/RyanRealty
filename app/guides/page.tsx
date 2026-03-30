import type { Metadata } from 'next'
import Link from 'next/link'
import { getPublishedGuides } from '@/app/actions/guides'
import { generateBreadcrumbSchema } from '@/lib/structured-data'

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
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
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
      <h1 className="text-3xl font-semibold text-foreground">Guides</h1>
      <p className="mt-2 text-muted-foreground">Local market explainers and step by step playbooks for buyers and sellers.</p>
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
    </main>
  )
}
