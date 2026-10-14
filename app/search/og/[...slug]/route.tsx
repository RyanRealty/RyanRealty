import { getPresetBySlug } from '@/lib/search-presets'
import { placeHomesForSaleHeading } from '@/lib/site/place-homes-heading'
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
  const citySlug = slug?.[0] ?? ''
  const second = slug?.[1] ?? ''
  const third = slug?.[2] ?? ''
  const preset = getPresetBySlug(third || second)
  const city = citySlug ? unslug(citySlug) : 'Central Oregon'
  const subdivision = citySlug && second && !getPresetBySlug(second) ? unslug(second) : null
  const place = subdivision ? `${subdivision}, ${city}` : city
  const title = preset ? `${preset.label} in ${place}` : placeHomesForSaleHeading(place)
  const photoKind = subdivision ? 'community' : 'city'
  const photoSlug = subdivision ? second : citySlug

  return renderShareCard({
    title,
    photoSrc: photoSlug ? resolvePlaceOgPhoto(photoKind, photoSlug) : null,
  })
}
