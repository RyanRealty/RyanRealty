import { V3Loading } from '@/components/site/v3'

/**
 * City detail fallback (SITE-155 / SITE-158). The previous min-h-screen
 * hero+tiles skeleton was taller than the first real paint of some city
 * pages, so swapping it shrank the document and clamped a mid-load scroll
 * to the top. V3Loading stays under every real /cities/[slug] page.
 */
export default function CityDetailLoading() {
  return <V3Loading label="Loading this city" lines={4} />
}
