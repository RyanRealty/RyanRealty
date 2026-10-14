import { describe, expect, it } from 'vitest'
import { communityMetadataInput } from '@/app/communities/[slug]/_v3/community-metadata'
import { pageMetadata } from '@/lib/site/page-metadata'
import {
  ogImageForPlace,
  shareOgImagePath,
} from '@/lib/og/share-image-url'
import {
  OG_PHOTO_AERIAL,
  OG_PHOTO_DOWNTOWN,
  OG_PHOTO_LANDSCAPE,
  resolveOgFallbackPhoto,
  resolvePlaceOgPhoto,
} from '@/lib/og/resolve-photo'
import { resolveCardPhotoSrc } from '@/lib/og/share-card'
import { GET } from '@/app/api/og/route'

const KEY_ROUTES = [
  {
    path: '/communities/sunriver/second-home',
    ogImage: ogImageForPlace({
      placeKind: 'community',
      slug: 'sunriver',
      title: 'Buying a second home in Sunriver',
    }),
  },
  {
    path: '/cities/bend/living',
    ogImage: ogImageForPlace({
      placeKind: 'city',
      slug: 'bend',
      title: 'Bend housing market',
    }),
  },
  {
    path: '/homes-for-sale/listing/220190868',
    ogImage: shareOgImagePath({ type: 'listing', id: '220190868' }),
  },
  {
    path: '/',
    ogImage: shareOgImagePath({ type: 'default' }),
  },
] as const

describe('resolveOgFallbackPhoto', () => {
  it('picks an aerial for community and neighborhood, downtown for blog, landscape otherwise', () => {
    expect(resolveOgFallbackPhoto('community')).toBe(OG_PHOTO_AERIAL)
    expect(resolveOgFallbackPhoto('neighborhood')).toBe(OG_PHOTO_AERIAL)
    expect(resolveOgFallbackPhoto('city')).toBe(OG_PHOTO_AERIAL)
    expect(resolveOgFallbackPhoto('blog')).toBe(OG_PHOTO_DOWNTOWN)
    expect(resolveOgFallbackPhoto('guide')).toBe(OG_PHOTO_DOWNTOWN)
    expect(resolveOgFallbackPhoto('default')).toBe(OG_PHOTO_LANDSCAPE)
    expect(resolveOgFallbackPhoto('listing')).toBe(OG_PHOTO_LANDSCAPE)
  })
})

describe('resolveCardPhotoSrc', () => {
  it('turns a local public path into an absolute ryan-realty.com URL', () => {
    expect(resolveCardPhotoSrc('/images/kb/sunriver-deschutes-river.jpg')).toBe(
      'https://ryan-realty.com/images/kb/sunriver-deschutes-river.jpg',
    )
    expect(resolveCardPhotoSrc(null, 'default')).toBe(
      `https://ryan-realty.com${OG_PHOTO_LANDSCAPE}`,
    )
    expect(resolveCardPhotoSrc(null, 'blog')).toBe(`https://ryan-realty.com${OG_PHOTO_DOWNTOWN}`)
    expect(resolveCardPhotoSrc(null, 'community')).toBe(`https://ryan-realty.com${OG_PHOTO_AERIAL}`)
  })
})

describe('share-card metadata', () => {
  it('pageMetadata emits an absolute https og:image with width, height, alt, and a large Twitter card', () => {
    for (const route of KEY_ROUTES) {
      const meta = pageMetadata({
        title: 'Share card',
        description: 'Central Oregon homes for sale from the regional MLS.',
        path: route.path,
        ogImage: route.ogImage,
      })
      const image = Array.isArray(meta.openGraph?.images) ? meta.openGraph.images[0] : null
      expect(image && typeof image === 'object' && 'url' in image ? String(image.url) : '').toMatch(
        /^https:\/\/ryan-realty\.com\/api\/og\?/,
      )
      expect(image && typeof image === 'object' && 'width' in image ? image.width : 0).toBe(1200)
      expect(image && typeof image === 'object' && 'height' in image ? image.height : 0).toBe(630)
      expect(image && typeof image === 'object' && 'alt' in image ? image.alt : '').toBeTruthy()
      const twitterCard =
        meta.twitter && typeof meta.twitter === 'object' && 'card' in meta.twitter
          ? meta.twitter.card
          : null
      expect(twitterCard).toBe('summary_large_image')
      const twitter = Array.isArray(meta.twitter?.images) ? meta.twitter.images[0] : null
      const twitterUrl =
        typeof twitter === 'string'
          ? twitter
          : twitter && typeof twitter === 'object' && 'url' in twitter
            ? String(twitter.url)
            : ''
      expect(twitterUrl).toMatch(/^https:\/\/ryan-realty\.com\/api\/og\?/)
    }
  })

  it('community and buyer-answer cards use the place slug, not a generic navy fallback', () => {
    const community = communityMetadataInput({
      slug: 'sunriver',
      name: 'Sunriver',
      city: 'Sunriver',
    })
    expect(community.ogImage).toBe(shareOgImagePath({ type: 'community', slug: 'sunriver' }))
    expect(community.ogImage).toContain('type=community')
    expect(community.ogImage).toContain('slug=sunriver')
    expect(ogImageForPlace({ placeKind: 'community', slug: 'sunriver', title: 'Sunriver second home' })).toContain(
      'slug=sunriver',
    )
    expect(resolvePlaceOgPhoto('community', 'sunriver')).toMatch(/sunriver/i)
    expect(resolvePlaceOgPhoto('city', 'bend')).toMatch(/bend/i)
  })

  it('default pageMetadata uses the landscape card with no title query', () => {
    const meta = pageMetadata({
      title: 'Bend Oregon Real Estate',
      description: 'Homes for sale in Bend and Central Oregon.',
      path: '/',
    })
    const image = Array.isArray(meta.openGraph?.images) ? meta.openGraph.images[0] : null
    const url = image && typeof image === 'object' && 'url' in image ? String(image.url) : ''
    expect(url).toBe('https://ryan-realty.com/api/og?type=default')
  })
})

describe('/api/og share cards', () => {
  it('place and default cards never pass a chip or title into the renderer', async () => {
    const { readFileSync } = await import('node:fs')
    const route = readFileSync('app/api/og/route.tsx', 'utf8')
    const housing = readFileSync('app/housing-market/og/[...slug]/route.tsx', 'utf8')
    const search = readFileSync('app/search/og/[...slug]/route.tsx', 'utf8')
    expect(route).toMatch(/type === 'community'/)
    expect(route).not.toMatch(/type === 'community'[\s\S]*chip:/)
    expect(housing).toContain('renderShareCard')
    expect(housing).not.toMatch(/chip:/)
    expect(search).not.toMatch(/chip:/)
    expect(housing).not.toMatch(/title:/)
    expect(search).not.toMatch(/title:/)
  })

  it('returns 200 image/png for default, community, and blog fallback cards', async () => {
    const cases = [
      'http://localhost/api/og?type=default',
      'http://localhost/api/og?type=community&slug=sunriver',
      'http://localhost/api/og?type=blog',
    ]
    for (const href of cases) {
      const res = await GET(new Request(href))
      expect(res.status).toBe(200)
      expect(res.headers.get('content-type')).toMatch(/image\/png/)
      const buf = Buffer.from(await res.arrayBuffer())
      expect(buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe(true)
    }
  }, 20_000)
})
