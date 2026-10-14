import { describe, expect, it } from 'vitest'
import { communityMetadataInput } from '@/app/communities/[slug]/_v3/community-metadata'
import { pageMetadata } from '@/lib/site/page-metadata'
import {
  ogImageForPlace,
  shareOgImagePath,
  shortOgTitle,
} from '@/lib/og/share-image-url'
import { resolvePlaceOgPhoto } from '@/lib/og/resolve-photo'
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
    ogImage: shareOgImagePath({ type: 'default', title: 'Bend · Central Oregon' }),
  },
] as const

describe('shortOgTitle', () => {
  it('keeps a short place name and drops a brand tail', () => {
    expect(shortOgTitle('Sunriver Homes for Sale | Sunriver, OR')).toBe('Sunriver Homes for Sale')
    expect(shortOgTitle('Bend · Central Oregon')).toBe('Bend · Central Oregon')
  })

  it('refuses top-team copy and never invents a client name', () => {
    expect(shortOgTitle('Central Oregon top team')).toBe('')
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
    expect(community.ogImage).toBe(shareOgImagePath({ type: 'community', slug: 'sunriver', title: 'Sunriver' }))
    expect(community.ogImage).toContain('type=community')
    expect(community.ogImage).toContain('slug=sunriver')
    expect(ogImageForPlace({ placeKind: 'community', slug: 'sunriver', title: 'Sunriver second home' })).toContain(
      'slug=sunriver',
    )
    expect(resolvePlaceOgPhoto('community', 'sunriver')).toMatch(/sunriver/i)
    expect(resolvePlaceOgPhoto('city', 'bend')).toMatch(/bend/i)
  })
})

describe('/api/og share cards', () => {
  it('returns 200 image/png for the default card and a Sunriver community card', async () => {
    const cases = [
      'http://localhost/api/og?type=default&title=Bend%20%C2%B7%20Central%20Oregon',
      'http://localhost/api/og?type=community&slug=sunriver&title=Sunriver%20second%20home',
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
