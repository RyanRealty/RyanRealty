import type { Metadata } from 'next'
import { getListingsWithVideos } from '@/app/actions/videos'
import VideosClient from '@/components/videos/VideosClient'

export const metadata: Metadata = {
  title: 'Video Tours — Central Oregon Homes | Ryan Realty',
  description: 'Watch video tours of homes for sale in Bend, Redmond, Sisters and Central Oregon.',
  openGraph: {
    title: 'Video Tours — Central Oregon Homes | Ryan Realty',
  },
}

export default async function VideosPage() {
  const listings = await getListingsWithVideos({})
  return <VideosClient initialListings={listings} />
}
