import { V3Loading } from '@/components/site/v3'

/**
 * Community detail fallback (SITE-155 / SITE-158). The previous 70vh KB
 * hero skeleton was taller than the first real paint, so swapping it
 * shrank the document under a mid-load scroll. Compact shell only.
 */
export default function CommunityDetailLoading() {
  return <V3Loading label="Loading this community" lines={4} />
}
