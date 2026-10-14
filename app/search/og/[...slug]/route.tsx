import { getPresetBySlug } from '@/lib/search-presets'
import { renderShareCard } from '@/lib/og/share-card'
import { resolvePlaceOgPhoto } from '@/lib/og/resolve-photo'

export const runtime = 'nodejs'
export const revalidate = 86400

export async function GET(_: Request, context: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await context.params
  const citySlug = slug?.[0] ?? ''
  const second = slug?.[1] ?? ''
  const subdivision = citySlug && second && !getPresetBySlug(second) ? second : ''
  const photoKind = subdivision ? 'community' : 'city'
  const photoSlug = subdivision || citySlug

  return renderShareCard({
    photoSrc: photoSlug ? resolvePlaceOgPhoto(photoKind, photoSlug) : null,
    fallback: photoKind,
  })
}
