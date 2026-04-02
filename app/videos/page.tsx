import type { Metadata } from 'next'
import { getListingsWithVideos } from '@/app/actions/videos'
import VideosClient from '@/components/videos/VideosClient'

const videosOgImage = `${(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')}/api/og?type=default`

export const metadata: Metadata = {
  title: 'Video Tours — Central Oregon Homes | Ryan Realty',
  description: 'Watch video tours of homes for sale in Bend, Redmond, Sisters and Central Oregon.',
  openGraph: {
    title: 'Video Tours — Central Oregon Homes | Ryan Realty',
    images: [{ url: videosOgImage, width: 1200, height: 630, alt: 'Video tours — Central Oregon homes | Ryan Realty' }],
  },
  twitter: {
    card: 'summary_large_image',
    images: [videosOgImage],
  },
}

export default async function VideosPage() {
  const listings = await getListingsWithVideos({})
  return <VideosClient initialListings={listings} />
}
