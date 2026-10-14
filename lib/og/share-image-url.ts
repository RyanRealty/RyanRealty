/**
 * Share-card URL + title helpers for Open Graph / Twitter images.
 *
 * Pages pass a short relative path; pageMetadata() turns it into an absolute
 * https URL with width/height/alt. The image itself is rendered by /api/og.
 */

export const OG_IMAGE_WIDTH = 1200
export const OG_IMAGE_HEIGHT = 630
export const OG_IMAGE_TYPE = 'image/png'

export type ShareOgType = 'default' | 'listing' | 'community' | 'city' | 'blog' | 'page'

export type ShareOgInput = {
  type: ShareOgType
  slug?: string
  id?: string
  title?: string
}

/** Cap a card title so it stays legible at iMessage / Slack thumbnail size. */
export function shortOgTitle(raw: string, max = 36): string {
  const cleaned = raw
    .replace(/\s*\|.*$/, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!cleaned) return ''
  if (/top team/i.test(cleaned)) return ''
  if (cleaned.length <= max) return cleaned
  const cut = cleaned.slice(0, max).replace(/\s+\S*$/, '').trim()
  return cut || cleaned.slice(0, max).trim()
}

/** Root-relative OG image path. pageMetadata() absolutizes it. */
export function shareOgImagePath(input: ShareOgInput): string {
  const params = new URLSearchParams()
  params.set('type', input.type)
  const id = input.id?.trim()
  const slug = input.slug?.trim()
  const title = input.title ? shortOgTitle(input.title) : ''
  if (id) params.set('id', id)
  if (slug) params.set('slug', slug)
  if (title) params.set('title', title)
  return `/api/og?${params.toString()}`
}

export function ogImageForPlace(input: {
  placeKind: 'community' | 'city' | 'neighborhood' | 'region'
  slug: string
  title: string
  citySlug?: string
}): string {
  const title = shortOgTitle(input.title)
  if (input.placeKind === 'community') {
    return shareOgImagePath({ type: 'community', slug: input.slug, title })
  }
  if (input.placeKind === 'neighborhood') {
    return shareOgImagePath({
      type: 'city',
      slug: input.citySlug?.trim() || 'bend',
      title,
    })
  }
  if (input.placeKind === 'region') {
    return shareOgImagePath({ type: 'default', title })
  }
  return shareOgImagePath({ type: 'city', slug: input.slug, title })
}
