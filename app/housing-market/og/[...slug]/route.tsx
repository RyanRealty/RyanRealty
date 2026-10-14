import { renderShareCard } from '@/lib/og/share-card'
import { resolvePlaceOgPhoto } from '@/lib/og/resolve-photo'

export const runtime = 'nodejs'
export const revalidate = 86400

function unslug(value: string): string {
  return value
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export async function GET(_: Request, context: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await context.params
  const cityName = unslug(slug?.[0] ?? 'Central Oregon')
  const communityName = slug?.[1] ? unslug(slug[1]) : null
  const geoName = communityName ?? cityName
  const photoKind = communityName ? 'community' : 'city'
  const photoSlug = communityName ? slug[1] : slug?.[0] ?? ''

  return renderShareCard({
    title: geoName,
    photoSrc: photoSlug ? resolvePlaceOgPhoto(photoKind, photoSlug) : null,
  })
}
