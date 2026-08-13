// @data-free — E-CUT: this route only 308s to /housing-market/reports/[slug]. No listings.
// @no-static-params — redirect stub, never renders.
// @no-breadcrumb — redirect stub, never renders.
import type { Metadata } from 'next'
import { permanentRedirect } from 'next/navigation'

/**
 * /reports/[slug] folds into /housing-market/reports/[slug] (cut-list: dual URL
 * space). next.config already 308s this path. This file never renders UI.
 * Canonical lives on the survivor.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  return {
    robots: { index: false, follow: true },
    alternates: { canonical: `/housing-market/reports/${slug}` },
  }
}

export default async function WeeklyReportRedirect({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  permanentRedirect(`/housing-market/reports/${slug}`)
}
