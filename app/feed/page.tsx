import type { Metadata } from 'next'
import { getFeedListings } from '../actions/feed'
import { getSession } from '../actions/auth'
import { getSavedListingKeys } from '../actions/saved-listings'
import { getLikedListingKeys } from '../actions/likes'
import FeedInfiniteList from '@/components/FeedInfiniteList'
import ShareButton from '@/components/ShareButton'
import { BreadcrumbNav } from '@/components/site/BreadcrumbNav'
import { Container } from '@/components/site/primitives'
import { listingsBrowsePath } from '@/lib/slug'

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
const defaultOgImage = `${siteUrl}/api/og?type=default`

export const metadata: Metadata = {
  title: 'Feed',
  description: 'Browse the latest Central Oregon homes for sale. Infinite scroll feed.',
  alternates: { canonical: `${siteUrl}/feed` },
  openGraph: {
    title: 'Feed | Ryan Realty',
    description: 'Browse the latest Central Oregon homes for sale.',
    url: `${siteUrl}/feed`,
    type: 'website',
    siteName: 'Ryan Realty',
    images: [{ url: defaultOgImage, width: 1200, height: 630, alt: 'Ryan Realty' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Feed | Ryan Realty',
    description: 'Browse the latest Central Oregon homes for sale.',
    images: [defaultOgImage],
  },
}

export default async function FeedPage() {
  const [{ listings: initialListings, nextOffset: initialNextOffset }, session] = await Promise.all([
    getFeedListings({ offset: 0 }),
    getSession(),
  ])

  const [savedKeys, likedKeys] =
    session?.user
      ? await Promise.all([getSavedListingKeys(), getLikedListingKeys()])
      : [[], [] as string[]]

  return (
    <main className="min-h-screen bg-background">
      <Container className="pt-3 pb-1">
        <BreadcrumbNav items={[{ label: 'Home', href: '/' }, { label: 'Feed' }]} />
      </Container>
      <section className="bg-primary px-4 py-12 sm:px-6 sm:py-16">
        <div className="mx-auto max-w-7xl text-center">
          <h1 className="text-3xl font-bold tracking-tight text-primary-foreground sm:text-4xl">
            Latest Listings
          </h1>
          <p className="mt-3 text-lg text-muted">
            Browse the newest homes for sale across Central Oregon. Scroll for more.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
            <a
              href={listingsBrowsePath()}
              className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-3 text-sm font-semibold text-primary shadow-md hover:bg-accent/90"
            >
              View All Listings
            </a>
            <a
              href="/homes-for-sale"
              className="inline-flex items-center gap-2 rounded-lg border-2 border-primary-foreground/40 bg-card/10 px-5 py-3 text-sm font-semibold text-primary-foreground backdrop-blur-sm hover:bg-card/20"
            >
              Search on Map
            </a>
          </div>
        </div>
      </section>
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <div className="mt-4 flex items-center justify-between gap-3">
        <h2 className="text-2xl font-semibold text-foreground">Newest first</h2>
        <ShareButton
          url={`${siteUrl}/feed`}
          title="Latest listings in Central Oregon"
          text="Browse the newest listings across Bend, Redmond, Sisters, Sunriver and nearby areas."
          trackContext="feed_page"
          variant="compact"
        />
      </div>
      <div className="mt-6">
        <FeedInfiniteList
          initialListings={initialListings}
          initialNextOffset={initialNextOffset}
          likedKeys={likedKeys}
          savedKeys={savedKeys}
          signedIn={!!session?.user}
          userEmail={session?.user?.email ?? null}
        />
      </div>
      </div>
    </main>
  )
}
