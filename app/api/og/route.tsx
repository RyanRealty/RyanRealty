import { getBlogPostForOgBySlug, getBrokerForOgBySlug } from '@/lib/data/brokers/getBrokers'
import { getListingLookup } from '@/lib/data/listings/getListingDetail'
import { listingHasSharePhoto } from '@/lib/og/listing-share'
import { renderShareCard } from '@/lib/og/share-card'
import { resolvePlaceOgPhoto } from '@/lib/og/resolve-photo'

export const runtime = 'nodejs'
export const revalidate = 86400

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type') ?? 'default'
  const id = (searchParams.get('id') ?? searchParams.get('slug') ?? '').trim()
  const slug = (searchParams.get('slug') ?? id).trim()

  if (type === 'listing' && id) {
    try {
      // ListNumber or ListingKey — the same resolver the listing page uses.
      const lookup = await getListingLookup(id)
      if (lookup.kind === 'ok' && listingHasSharePhoto(lookup.listing.photoUrl)) {
        return renderShareCard({
          photoSrc: lookup.listing.photoUrl,
          fallback: 'listing',
        })
      }
    } catch (err) {
      console.error('[og:listing]', err)
    }
    // Missing listing, Coming Soon, IDX opt-out, or no MLS photo: landscape,
    // never a photo-less card.
    return renderShareCard({ fallback: 'listing' })
  }

  if (type === 'community') {
    return renderShareCard({
      photoSrc: resolvePlaceOgPhoto('community', slug),
      fallback: 'community',
    })
  }

  if (type === 'city') {
    return renderShareCard({
      photoSrc: resolvePlaceOgPhoto('city', slug),
      fallback: 'city',
    })
  }

  if (type === 'blog' || type === 'guide') {
    if (id) {
      try {
        const post = await getBlogPostForOgBySlug(id)
        if (post?.hero_image_url) {
          return renderShareCard({
            photoSrc: post.hero_image_url,
            fallback: 'blog',
          })
        }
      } catch (err) {
        console.error('[og:blog]', err)
      }
    }
    return renderShareCard({ fallback: 'blog' })
  }

  if (type === 'broker' && id) {
    try {
      const broker = await getBrokerForOgBySlug(id)
      if (broker?.photo_url) {
        return renderShareCard({
          photoSrc: broker.photo_url,
          fallback: 'default',
        })
      }
    } catch (err) {
      console.error('[og:broker]', err)
    }
  }

  return renderShareCard({ fallback: 'default' })
}
