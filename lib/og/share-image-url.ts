/**
 * Share-card URL helpers for Open Graph / Twitter images.
 *
 * Pages pass a short relative path; pageMetadata() turns it into an absolute
 * https URL with width/height/alt. The image itself is rendered by /api/og.
 * Titles stay in og:title metadata — they are not painted on the image.
 */

export const OG_IMAGE_WIDTH = 1200
export const OG_IMAGE_HEIGHT = 630
export const OG_IMAGE_TYPE = 'image/png'

export type ShareOgType = 'default' | 'listing' | 'community' | 'city' | 'blog' | 'guide' | 'page'

export type ShareOgInput = {
  type: ShareOgType
  slug?: string
  id?: string
  /** Ignored for the image. Kept so callers can pass a title without a type error. */
  title?: string
}

/** Root-relative OG image path. pageMetadata() absolutizes it. */
export function shareOgImagePath(input: ShareOgInput): string {
  const params = new URLSearchParams()
  params.set('type', input.type)
  const id = input.id?.trim()
  const slug = input.slug?.trim()
  if (id) params.set('id', id)
  if (slug) params.set('slug', slug)
  return `/api/og?${params.toString()}`
}

export function ogImageForPlace(input: {
  placeKind: 'community' | 'city' | 'neighborhood' | 'region'
  slug: string
  title?: string
  citySlug?: string
}): string {
  if (input.placeKind === 'community') {
    return shareOgImagePath({ type: 'community', slug: input.slug })
  }
  if (input.placeKind === 'neighborhood') {
    return shareOgImagePath({
      type: 'city',
      slug: input.citySlug?.trim() || 'bend',
    })
  }
  if (input.placeKind === 'region') {
    return shareOgImagePath({ type: 'default' })
  }
  return shareOgImagePath({ type: 'city', slug: input.slug })
}
