import type { Metadata } from 'next'
import { getCommunitiesForIndex } from '@/app/actions/communities'
import {
  getCommunityEngagementBatchCached,
  type CommunityEngagementCounts,
} from '@/app/actions/community-engagement'
import { RESORT_DISPLAY_NAMES } from '@/lib/communities'
import CommunityCard from '@/components/community/CommunityCard'
import CommunitiesFilter from '@/components/community/CommunitiesFilter'
import { Container } from '@/components/site/primitives'
import { BreadcrumbNav } from '@/components/site/BreadcrumbNav'
import ContentPageHero from '@/components/layout/ContentPageHero'

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Communities in Central Oregon | Bend, Redmond, Sisters | Ryan Realty',
  description:
    'Explore communities and neighborhoods in Central Oregon. Find homes in Bend, Redmond, Sisters, Sunriver, and surrounding areas.',
  alternates: { canonical: `${siteUrl}/communities` },
  openGraph: {
    title: 'Communities in Central Oregon | Ryan Realty',
    description: 'Explore communities and neighborhoods in Central Oregon.',
    url: `${siteUrl}/communities`,
    siteName: 'Ryan Realty',
    type: 'website',
    images: [{ url: `${siteUrl}/api/og?type=default`, width: 1200, height: 630, alt: 'Communities in Central Oregon' }],
  },
  twitter: {
    card: 'summary_large_image',
    images: [`${siteUrl}/api/og?type=default`],
  },
}

export default async function CommunitiesPage() {
  const allCommunities = await getCommunitiesForIndex()
  const entityKeys = allCommunities.map((c) => c.entityKey)
  const [savedKeys, likedKeys, engagementMap] = await Promise.all([
    Promise.resolve([] as string[]),
    Promise.resolve([] as string[]),
    entityKeys.length > 0
      ? getCommunityEngagementBatchCached(entityKeys)
      : Promise.resolve({} as Record<string, CommunityEngagementCounts>),
  ])
  const signedIn = false

  const resortSlugs = new Set(
    RESORT_DISPLAY_NAMES.flatMap((name) => {
      const match = allCommunities.find(
        (c) => c.subdivision.toLowerCase() === name.toLowerCase()
      )
      return match ? [match.slug] : []
    })
  )
  const resortCommunities = allCommunities.filter((c) => c.isResort || resortSlugs.has(c.slug))

  return (
    <main className="min-h-screen bg-background">
      <Container className="pt-3 pb-1">
        <BreadcrumbNav items={[{ label: 'Home', href: '/' }, { label: 'Communities' }]} />
      </Container>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'CollectionPage',
            name: 'Communities in Central Oregon',
            description: 'Explore communities and neighborhoods in Central Oregon.',
            url: `${siteUrl}/communities`,
            publisher: { '@type': 'Organization', name: 'Ryan Realty' },
          }),
        }}
      />

      <ContentPageHero
        title="Communities in Central Oregon"
        subtitle="Explore neighborhoods and find your next home."
        imageUrl="/images/lp/hero-deschutes-clean.jpg"
      />

      {resortCommunities.length > 0 && (
        <section
          className="bg-card px-4 py-12 sm:px-6 sm:py-16"
          aria-labelledby="resort-communities-heading"
        >
          <div className="mx-auto max-w-7xl">
            <h2
              id="resort-communities-heading"
              className="text-2xl font-bold tracking-tight text-primary"
            >
              Resort & Master-Planned Communities
            </h2>
            <div className="mt-6 grid gap-6 sm:grid-cols-2">
              {resortCommunities.map((c) => (
                <CommunityCard
                  key={c.slug}
                  slug={c.slug}
                  name={c.subdivision}
                  city={c.city}
                  activeCount={c.activeCount}
                  medianPrice={c.medianPrice}
                  heroImageUrl={c.heroImageUrl}
                  isResort
                  description={c.description ?? undefined}
                  size="large"
                  signedIn={signedIn}
                  saved={savedKeys.includes(c.entityKey)}
                  liked={likedKeys.includes(c.entityKey)}
                  engagement={engagementMap[c.entityKey] ?? null}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      <section
        className="bg-muted px-4 py-12 sm:px-6 sm:py-16"
        aria-labelledby="all-communities-heading"
      >
        <div className="mx-auto max-w-7xl">
          <h2
            id="all-communities-heading"
            className="text-2xl font-bold tracking-tight text-primary"
          >
            All Communities
          </h2>
          <CommunitiesFilter
            communities={allCommunities}
            signedIn={signedIn}
            savedKeys={savedKeys}
            likedKeys={likedKeys}
            engagementMap={engagementMap}
          />
        </div>
      </section>
    </main>
  )
}
