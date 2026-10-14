import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ImageResponse } from 'next/og'
import { OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH, shortOgTitle } from './share-image-url'
import { isLocalPublicPath, OG_FALLBACK_PHOTO, OG_LOGO_REL } from './resolve-photo'

const NAVY = '#102742'
const CREAM = '#faf8f4'

const OG_CACHE =
  'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800'

let logoDataUrl: string | null = null
const photoDataUrls = new Map<string, string>()

function fileToDataUrl(absPath: string, mime: string): string {
  const buf = readFileSync(absPath)
  return `data:${mime};base64,${buf.toString('base64')}`
}

export function ogLogoDataUrl(): string {
  if (logoDataUrl) return logoDataUrl
  logoDataUrl = fileToDataUrl(join(process.cwd(), OG_LOGO_REL), 'image/png')
  return logoDataUrl
}

export function localPhotoDataUrl(publicPath: string): string {
  const hit = photoDataUrls.get(publicPath)
  if (hit) return hit
  const rel = publicPath.replace(/^\//, '')
  const abs = join(process.cwd(), 'public', rel)
  const mime = rel.endsWith('.png') ? 'image/png' : 'image/jpeg'
  const url = fileToDataUrl(abs, mime)
  photoDataUrls.set(publicPath, url)
  return url
}

export function resolveCardPhotoSrc(photoSrc: string | null | undefined): string {
  const src = photoSrc?.trim()
  if (!src) return localPhotoDataUrl(OG_FALLBACK_PHOTO)
  if (isLocalPublicPath(src)) {
    try {
      return localPhotoDataUrl(src)
    } catch {
      return localPhotoDataUrl(OG_FALLBACK_PHOTO)
    }
  }
  if (/^https:\/\//i.test(src)) return src
  return localPhotoDataUrl(OG_FALLBACK_PHOTO)
}

export function withOgCache(image: ImageResponse): ImageResponse {
  image.headers.set('Cache-Control', OG_CACHE)
  image.headers.set('Content-Type', 'image/png')
  return image
}

export function renderShareCard(input: {
  title?: string | null
  photoSrc?: string | null
}): ImageResponse {
  const title = shortOgTitle(input.title ?? '')
  const photo = resolveCardPhotoSrc(input.photoSrc)
  const logo = ogLogoDataUrl()
  const titleSize = title.length > 26 ? 44 : 56

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
              top: 0,
              left: 0,
              width: OG_IMAGE_WIDTH,
              height: OG_IMAGE_HEIGHT,
              display: 'flex',
              backgroundImage:
                'linear-gradient(180deg, rgba(16,39,66,0.28) 0%, rgba(16,39,66,0.12) 42%, rgba(16,39,66,0.78) 100%)',
            }}
          />
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              width: '100%',
              height: '100%',
              padding: '40px 48px 44px',
            }}
          >
            <img src={logo} alt="" width={260} height={52} />
            {title ? (
              <div
                style={{
                  display: 'flex',
                  color: CREAM,
                  fontSize: titleSize,
                  fontWeight: 700,
                  lineHeight: 1.15,
                }}
              >
                {title}
              </div>
            ) : null}
          </div>
        </div>
      ),
      { width: OG_IMAGE_WIDTH, height: OG_IMAGE_HEIGHT },
    ),
  )
}
