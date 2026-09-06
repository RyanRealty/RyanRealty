// @no-breadcrumb — leftover catch-all. Named leaves own their URLs.
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

/**
 * Catch-all only. Dedicated files own /sell/for-sale-by-owner,
 * /sell/expired-listings, and /sell/inherited-home (308 in next.config).
 * Unknown slugs 404. A /sell/:intent 308 would steal valuation, FSBO,
 * and expired, so this page never redirects.
 */

type Props = {
  params: Promise<{ intent: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  await params
  return { title: 'Page Not Found', robots: { index: false, follow: false } }
}

export default async function SellIntentFoldPage({ params }: Props) {
  await params
  notFound()
}
