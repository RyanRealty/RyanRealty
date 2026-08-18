// @no-parity — redirect-only alias; live report is /cities/bend/{slug}
// @no-breadcrumb — never renders UI; middleware 308s districts to /cities/bend/{slug}
/**
 * Bend-district alias. Live reports live at /cities/bend/{slug}.
 * Founding case: all 13 /neighborhoods/{slug} URLs 404ed (fleet
 * 869e578bf05ec02a89be62bb81403d1d).
 *
 * The hard 308 is in middleware (`resolveNeighborhoodAliasRedirect`).
 * Page-level permanentRedirect cannot emit a 3xx under Next 16 streaming
 * (verified 2026-08-18: this route returned 200 after generateStaticParams).
 */
import type { Metadata } from 'next'
import { notFound, permanentRedirect } from 'next/navigation'
import { getBendNeighborhoodLedger } from '@/lib/data'
import {
  BEND_NEIGHBORHOOD_DISTRICTS,
  bendNeighborhoodCanonicalHref,
} from '@/lib/data/geo/getBendNeighborhoodLedger'
import { pageMetadata } from '@/lib/site/page-metadata'

export function generateStaticParams() {
  void getBendNeighborhoodLedger
  return BEND_NEIGHBORHOOD_DISTRICTS.map((d) => ({ slug: d.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const href = bendNeighborhoodCanonicalHref(slug)
  return pageMetadata({
    title: 'Bend neighborhood',
    description: 'Bend neighborhood homes for sale and sold prices.',
    path: href ?? `/neighborhoods/${slug}`,
    noindex: true,
  })
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
