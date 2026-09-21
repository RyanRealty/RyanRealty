import SearchAppFrameLoading from '@/components/search/SearchAppFrameLoading'

/**
 * Loading state for /search/[...slug] (publicly reached at
 * /homes-for-sale/*). Both branches of this route render the map/split
 * app-frame (renderMapSplitView, or MapSearchView's flagship view) — never
 * the hero + market-snapshot + 3-up + 9-up grid page this file used to model.
 * That stale ~1,900px skeleton was roughly 2x the real ~910px split-pane
 * frame (search-app-frame's min-height is calc(100dvh - 3.5rem)), so React
 * swapping it for real content shrank the document out from under a
 * mid-load scroll — SITE-158, one boundary deeper than the root fix.
 * Shared with app/search/loading.tsx so the two routes cannot drift apart
 * again.
 */
export default function SearchLoading() {
  return <SearchAppFrameLoading />
}
