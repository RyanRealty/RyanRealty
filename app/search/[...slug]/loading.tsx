import SearchAppFrameLoading from '@/components/search/SearchAppFrameLoading'

/**
 * Loading state for /search/[...slug] (publicly /homes-for-sale/*).
 * Both branches render the map/split app-frame — never the hero + grid
 * page this file used to model. That stale ~1,900px skeleton shrank the
 * document mid-load (SITE-158 / SITE-155). Shared with app/search/loading.tsx.
 */
export default function SearchLoading() {
  return <SearchAppFrameLoading />
}
