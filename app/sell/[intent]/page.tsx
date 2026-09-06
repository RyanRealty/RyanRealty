// @no-breadcrumb — leftover catch-all. Named leaves own their URLs.
import type { Metadata } from 'next'
import { notFound, permanentRedirect } from 'next/navigation'
import {
  EXPIRED_ROUTE,
  FSBO_ROUTE,
  ROUTE_PATH,
} from '../_v3/sell-constants'

/**
 * Catch-all only. Dedicated files own /sell/for-sale-by-owner,
 * /sell/expired-listings, and /sell/inherited-home (308 in next.config).
 * Unknown slugs 404. Not a redirect-only page — a /sell/:intent 308
 * would steal valuation, FSBO, and expired.
 */
const FOLD: Record<string, string> = {
  'for-sale-by-owner': FSBO_ROUTE,
  'expired-listings': EXPIRED_ROUTE,
  'inherited-home': ROUTE_PATH,
}

type Props = {
  params: Promise<{ intent: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { intent } = await params
  const dest = FOLD[intent]
  if (!dest) return { title: 'Page Not Found', robots: { index: false, follow: false } }
  return {
    robots: { index: false, follow: true },
    alternates: { canonical: dest },
  }
}

export default async function SellIntentFoldPage({ params }: Props) {
  const { intent } = await params
  const dest = FOLD[intent]
  if (dest) permanentRedirect(dest)
  notFound()
}
