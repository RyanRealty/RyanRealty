import type { Metadata } from 'next'
import { getFeedListings } from '../actions/feed'
import { getSession } from '../actions/auth'
import { getSavedListingKeys } from '../actions/saved-listings'
import { getLikedListingKeys } from '../actions/likes'
import FeedInfiniteList from '@/components/FeedInfiniteList'
import Breadcrumb from '@/components/Breadcrumb'

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')

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
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <Breadcrumb
        items={[
          { label: 'Ryan Realty', href: siteUrl },
          { label: 'Feed' },
        ]}
      />
      <h1 className="mt-4 text-2xl font-semibold text-foreground">Latest listings</h1>
      <p className="mt-1 text-sm text-muted-foreground">Scroll for more. Newest first.</p>
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
    </main>
  )
}
