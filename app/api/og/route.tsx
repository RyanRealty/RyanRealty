import { getBlogPostForOgBySlug, getBrokerForOgBySlug } from '@/lib/data/brokers/getBrokers'
import { getListingTiles } from '@/lib/data/listings/getListingTiles'
import { renderShareCard } from '@/lib/og/share-card'
import { resolvePlaceOgPhoto } from '@/lib/og/resolve-photo'
import { shortOgTitle } from '@/lib/og/share-image-url'

export const runtime = 'nodejs'
export const revalidate = 86400

function listingCardTitle(tile: {
  streetNumber?: string | null
  streetName?: string | null
  streetSuffix?: string | null
  city?: string | null
}): string {
  const street = [tile.streetNumber, tile.streetName, tile.streetSuffix].filter(Boolean).join(' ')
  return shortOgTitle(street || tile.city || 'Home for sale')
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type') ?? 'default'
  const id = (searchParams.get('id') ?? searchParams.get('slug') ?? '').trim()
  const slug = (searchParams.get('slug') ?? id).trim()
  const titleParam = searchParams.get('title') ?? ''

  if (type === 'listing' && id) {
    try {
      const tiles = await getListingTiles({
        listingKeys: [id],
        status: 'all',
        limit: 1,
      })
      const tile = tiles[0]
      if (tile) {
        // Tile photoUrl is already null when media_suppressed. Do not fall
        // back to listing_photos — that table is not suppression-gated.
        return renderShareCard({
          title: listingCardTitle(tile),
          photoSrc: tile.photoUrl,
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
