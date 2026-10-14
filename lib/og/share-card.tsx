import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ImageResponse } from 'next/og'
import { siteOrigin } from '@/lib/site-origin'
import { OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH } from './share-image-url'
import {
  isLocalPublicPath,
  OG_LOGO_REL,
  resolveOgFallbackPhoto,
  type OgPhotoKind,
} from './resolve-photo'

const NAVY = '#102742'

const OG_CACHE =
  'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800'

let logoDataUrl: string | null = null

function fileToDataUrl(absPath: string, mime: string): string {
  const buf = readFileSync(absPath)
  return `data:${mime};base64,${buf.toString('base64')}`
}

export function ogLogoDataUrl(): string {
  if (logoDataUrl) return logoDataUrl
  logoDataUrl = fileToDataUrl(join(process.cwd(), OG_LOGO_REL), 'image/png')
  return logoDataUrl
}

function publicHttps(publicPath: string): string {
  const path = publicPath.startsWith('/') ? publicPath : `/${publicPath}`
  return `${siteOrigin()}${path}`
}

/**
 * Place photos are static files on the CDN. Reading them with readFileSync
 * 500s on Vercel (they are not in the serverless trace; a 1.6 MB JPEG data
 * URL also blows the function). Listing heroes already arrive as https URLs.
 */
export function resolveCardPhotoSrc(
  photoSrc: string | null | undefined,
  fallback: OgPhotoKind = 'default',
): string {
  const src = photoSrc?.trim()
  if (src && /^https:\/\//i.test(src)) return src
  if (src && isLocalPublicPath(src)) return publicHttps(src)
  return publicHttps(resolveOgFallbackPhoto(fallback))
}

export function ogLogoSrc(): string {
  try {
    return ogLogoDataUrl()
  } catch {
    return publicHttps('/brand/logo-horizontal-white.png')
  }
}

export function withOgCache(image: ImageResponse): ImageResponse {
  image.headers.set('Cache-Control', OG_CACHE)
  image.headers.set('Content-Type', 'image/png')
  return image
}

/**
 * 1200×630 share image: the photo, a subtle navy tint along the bottom
 * edge, and the real wordmark. No title or price overlay — iMessage and
 * Slack already print og:title under the image.
 */
export function renderShareCard(input: {
  photoSrc?: string | null
  fallback?: OgPhotoKind
}): ImageResponse {
  const photo = resolveCardPhotoSrc(input.photoSrc, input.fallback ?? 'default')
  const logo = ogLogoSrc()

  return withOgCache(
    new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            backgroundColor: NAVY,
          }}
        >
          <img
            src={photo}
            alt=""
            width={OG_IMAGE_WIDTH}
            height={OG_IMAGE_HEIGHT}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: OG_IMAGE_WIDTH,
              height: OG_IMAGE_HEIGHT,
              objectFit: 'cover',
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: 0,
              bottom: 0,
              width: OG_IMAGE_WIDTH,
              height: 180,
              display: 'flex',
              backgroundImage:
                'linear-gradient(180deg, rgba(16,39,66,0) 0%, rgba(16,39,66,0.42) 100%)',
            }}
          />
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              width: '100%',
              height: '100%',
              padding: '0 48px 36px',
            }}
          >
            <img src={logo} alt="" width={240} height={48} />
          </div>
        </div>
      ),
      { width: OG_IMAGE_WIDTH, height: OG_IMAGE_HEIGHT },
    ),
  )
}
