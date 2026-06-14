import type { Metadata } from 'next'
import { getCentralOregonVideosHubListings } from '../actions/videos'
import { VideoFeedClient, type VideoFeedItem } from '@/components/site/VideoFeedClient'
import { listingDetailPath } from '@/lib/slug'
import { normalizeEmbed } from '@/lib/video-embed'

/** Drop MLS placeholder tokens (N/A) and collapse whitespace in an address. */
function cleanAddress(raw: string | null): string {
  const cleaned = (raw ?? '')
    .replace(/\bN\/A\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s+,/g, ',')
    .trim()
  return cleaned || 'View this home'
}

/** Empty out an MLS field that is just a placeholder ("N/A", "-", blank). */
function cleanToken(raw: string | null): string {
  const t = (raw ?? '').trim()
  if (!t || /^n\/?a$/i.test(t) || t === '-') return ''
  return t
}

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
const defaultOgImage = `${siteUrl}/api/og?type=default`

export const metadata: Metadata = {
  title: 'Video feed',
  description: 'Watch video tours of Central Oregon homes for sale. One after another.',
  alternates: { canonical: `${siteUrl}/feed` },
  openGraph: {
    title: 'Video feed | Ryan Realty',
    description: 'Watch video tours of Central Oregon homes for sale.',
    url: `${siteUrl}/feed`,
    type: 'website',
    siteName: 'Ryan Realty',
    images: [{ url: defaultOgImage, width: 1200, height: 630, alt: 'Ryan Realty' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Video feed | Ryan Realty',
    description: 'Watch video tours of Central Oregon homes for sale.',
    images: [defaultOgImage],
  },
}

type SearchParams = { [key: string]: string | string[] | undefined }

export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const startRaw = (await searchParams).start
  const startKey = typeof startRaw === 'string' ? startRaw : null

  const rows = await getCentralOregonVideosHubListings()

  const items: VideoFeedItem[] = (rows ?? [])
    .filter((r) => r.listing_key && (r.video_url ?? '').trim())
    // Only keep videos that actually embed + play in the feed — a non-embeddable
    // (frame-blocked) link would render a dead poster, defeating "just watch videos."
    .filter((r) => {
      const norm = normalizeEmbed(r.video_url)
      return norm != null && norm.embedType !== 'link'
    })
    .map((r) => ({
      listingKey: r.listing_key,
      videoUrl: r.video_url,
      posterUrl: r.photo_url ?? null,
      price: r.list_price ?? null,
      addressLine: cleanAddress(r.unparsed_address),
      cityLine: [cleanToken(r.subdivision_name), cleanToken(r.city)].filter(Boolean).join(' · '),
      detailHref: listingDetailPath(
        r.listing_key,
        null,
        { city: r.city, subdivision: r.subdivision_name },
        { mlsNumber: r.list_number }
      ),
      beds: r.beds_total ?? null,
      baths: r.baths_full ?? null,
      sqft: r.living_area ?? null,
    }))

  if (items.length === 0) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-primary px-6 text-center text-primary-foreground">
        <div>
          <h1 className="font-display text-3xl">No video tours yet</h1>
          <p className="mt-3 text-primary-foreground/80">
            New walkthroughs land here as homes come to market across Central Oregon.
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="bg-primary">
      <VideoFeedClient items={items} startKey={startKey} />
    </main>
  )
}
