import { V3Loading } from '@/components/site/v3'

/** Cities index fallback — compact, so the document only grows (SITE-155). */
export default function CitiesLoading() {
  return <V3Loading label="Loading cities" lines={4} />
}
