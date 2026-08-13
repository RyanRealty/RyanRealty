// @data-free — this route only 301s to /videos?view=feed. No listings, no pulse.
import type { Metadata } from 'next'
import { permanentRedirect } from 'next/navigation'

/**
 * /feed folds into /videos?view=feed (P3: keep /videos, fold /feed).
 * start= is preserved so a deep link into a specific tour still lands.
 * This file never renders UI. robots noindex + canonical at the survivor
 * match the motivated-sellers redirect-only contract.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: true },
  alternates: { canonical: '/videos?view=feed' },
}

export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<{ start?: string | string[] }>
}) {
  const raw = (await searchParams).start
  const start = typeof raw === 'string' && raw.trim() ? raw.trim() : null
  permanentRedirect(start ? `/videos?view=feed&start=${encodeURIComponent(start)}` : '/videos?view=feed')
}
