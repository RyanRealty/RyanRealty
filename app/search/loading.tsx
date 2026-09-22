import SearchAppFrameLoading from '@/components/search/SearchAppFrameLoading'

/**
 * Split-shell loading state for the default search app-frame (view=split).
 * Matches MapSearchView. Shared with app/search/[...slug]/loading.tsx
 * (SITE-158 / SITE-155) so the two routes cannot drift apart.
 */
export default function Loading() {
  return <SearchAppFrameLoading />
}
