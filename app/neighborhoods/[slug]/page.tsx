// @no-parity — redirect-only alias; live report is /cities/bend/{slug}
/**
 * Bend-district alias. Live reports live at /cities/bend/{slug}.
 * Founding case: all 13 /neighborhoods/{slug} URLs 404ed (fleet
 * 869e578bf05ec02a89be62bb81403d1d).
 */
import type { Metadata } from 'next'
import { notFound, permanentRedirect } from 'next/navigation'
import { getBendNeighborhoodLedger } from '@/lib/data'
import {
  BEND_NEIGHBORHOOD_DISTRICTS,
  bendNeighborhoodCanonicalHref,
} from '@/lib/data/geo/getBendNeighborhoodLedger'

/**
 * Redirect stub, same shape as app/areas/[slug]/page.tsx: noindex so the alias
 * URL never competes with the live report, follow so link equity passes to it,
 * canonical pointing at the destination this slug 301s to. The destination is
 * per-slug, so this is generateMetadata rather than a static `metadata`.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const href = bendNeighborhoodCanonicalHref(slug)
  return {
    robots: { index: false, follow: true },
    ...(href ? { alternates: { canonical: href } } : {}),
  }
}

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
