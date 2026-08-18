// @no-parity — redirect-only alias; live report is /cities/bend/{slug}
/**
 * Bend-district alias. Live reports live at /cities/bend/{slug}.
 * Founding case: all 13 /neighborhoods/{slug} URLs 404ed (fleet
 * 869e578bf05ec02a89be62bb81403d1d).
 */
import { notFound, permanentRedirect } from 'next/navigation'
import { getBendNeighborhoodLedger } from '@/lib/data'
import {
  BEND_NEIGHBORHOOD_DISTRICTS,
  bendNeighborhoodCanonicalHref,
} from '@/lib/data/geo/getBendNeighborhoodLedger'

export function generateStaticParams() {
  void getBendNeighborhoodLedger
  return BEND_NEIGHBORHOOD_DISTRICTS.map((d) => ({ slug: d.slug }))
}

export default async function NeighborhoodAliasPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const href = bendNeighborhoodCanonicalHref(slug)
  if (!href) notFound()
  permanentRedirect(href)
}
