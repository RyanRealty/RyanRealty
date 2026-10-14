import { renderShareCard } from '@/lib/og/share-card'
import { resolvePlaceOgPhoto } from '@/lib/og/resolve-photo'

export const runtime = 'nodejs'
export const revalidate = 86400

export async function GET(_: Request, context: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await context.params
  const communitySlug = slug?.[1]?.trim() ?? ''
  const photoKind = communitySlug ? 'community' : 'city'
  const photoSlug = communitySlug || slug?.[0] || ''

  return renderShareCard({
    photoSrc: photoSlug ? resolvePlaceOgPhoto(photoKind, photoSlug) : null,
    fallback: photoKind,
  })
}
