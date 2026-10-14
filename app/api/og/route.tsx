import { getBlogPostForOgBySlug, getBrokerForOgBySlug } from '@/lib/data/brokers/getBrokers'
import { getListingLookup } from '@/lib/data/listings/getListingDetail'
import { listingHasSharePhoto, listingShareCardLines } from '@/lib/og/listing-share'
import { renderShareCard } from '@/lib/og/share-card'
import { resolvePlaceOgPhoto } from '@/lib/og/resolve-photo'

export const runtime = 'nodejs'
export const revalidate = 86400

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type') ?? 'default'
  const id = (searchParams.get('id') ?? searchParams.get('slug') ?? '').trim()
  const slug = (searchParams.get('slug') ?? id).trim()
  const titleParam = searchParams.get('title') ?? ''

  if (type === 'listing' && id) {
    try {
      // ListNumber or ListingKey — the same resolver the listing page uses.
      // A miss, a Coming Soon, or an IDX opt-out falls through to default.
      const lookup = await getListingLookup(id)
      if (lookup.kind === 'ok' && listingHasSharePhoto(lookup.listing.photoUrl)) {
        const lines = listingShareCardLines(lookup.listing)
        return renderShareCard({
          title: lines.title,
          subtitle: lines.subtitle,
          photoSrc: lookup.listing.photoUrl,
        })
      }
    } catch (err) {
      console.error('[og:listing]', err)
    }
  }

  if (type === 'community') {
    const name = searchParams.get('name') ?? titleParam
    return renderShareCard({
      title: name || slug,
      photoSrc: resolvePlaceOgPhoto('community', slug),
    })
  }

  if (type === 'city') {
    return renderShareCard({
      title: titleParam || slug,
      photoSrc: resolvePlaceOgPhoto('city', slug),
    })
  }

  if (type === 'blog' && id) {
    try {
      const post = await getBlogPostForOgBySlug(id)
      if (post?.title) {
        return renderShareCard({
          title: post.title,
          photoSrc: post.hero_image_url,
        })
      }
    } catch (err) {
      console.error('[og:blog]', err)
    }
  }

  if (type === 'broker' && id) {
    try {
      const broker = await getBrokerForOgBySlug(id)
      if (broker?.display_name) {
        return renderShareCard({
          title: broker.display_name,
          photoSrc: broker.photo_url,
        })
      }
    } catch (err) {
      console.error('[og:broker]', err)
    }
  }

  return renderShareCard({
    title: titleParam || 'Bend · Central Oregon',
    photoSrc: null,
  })
}
