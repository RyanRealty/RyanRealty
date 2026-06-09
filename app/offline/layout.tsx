import type { Metadata } from 'next'

/**
 * The offline page is a PWA service-worker fallback — served by the browser
 * when the SW intercepts a navigation and the network is unavailable. It is
 * not in the sitemap and must never be indexed.
 */
export const metadata: Metadata = {
  title: 'Offline',
  description: 'You are currently offline. Return when you are back online.',
  robots: 'noindex, nofollow',
}

export default function OfflineLayout({ children }: { children: React.ReactNode }) {
  return children
}
