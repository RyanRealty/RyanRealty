import SearchAppFrameLoading from '@/components/search/SearchAppFrameLoading'

/**
 * Split-shell loading state for the default search app-frame (view=split).
 * Matches MapSearchView: one filter row, token-width list pane, ledger rows.
 * Shared with app/search/[...slug]/loading.tsx (SITE-158) — see that
 * component for why this must stay one definition.
 */
export default function Loading() {
  return <SearchAppFrameLoading />
}
