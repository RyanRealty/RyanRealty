'use client'

/**
 * /compare with nothing queued — the tool shown instead of described.
 *
 * WHERE IT CAME FROM (site queue SITE-50, 2026-09-09). The landing state was a
 * heading, one two-sentence paragraph and a text link. The 2026-09-08 taste
 * table scored the class 29 with the verdict "the compare tool's landing state
 * is an empty form label, not a product demo — it should show the comparison,
 * not describe it, and right now it does neither."
 *
 * WHAT THIS BINDS. V3Slots is presentational and takes no context. This file is
 * the thin client wrapper that joins it to the tray the rest of the site
 * already writes: `ComparisonContext`, localStorage key `ryan-realty-compare`,
 * the same list `ListingTile`'s compare checkbox and the floating
 * `ComparisonTray` use. The slots therefore show the visitor's OWN queue, and
 * an add from the worked example lands in the same place an add from a search
 * result does.
 *
 * IT WORKS BEFORE HYDRATION. Every add is a real `<a href="/compare?ids=…">`.
 * The click handler keeps the local tray in step; the navigation is the anchor's
 * own. With JavaScript off, the example still adds.
 *
 * WHY THE EXAMPLE IS NOT "RECENTLY VIEWED". Nothing on this site records which
 * listings a browser has seen in a form a page can read without a login: the
 * only recently-viewed list is `getRecentListingViews()`, a server action that
 * returns [] for a signed-out visitor. The honest substitute is what the page
 * can actually read — four homes that are for sale right now, read live and
 * labelled as an example, every one of them a real listing the reader can add
 * or open. Nothing here is a fabricated address or a fabricated price (§0).
 */

import { useComparison } from '@/contexts/ComparisonContext'
import { V3Slots, v3Text, type V3SlotsColumn } from '@/components/site/v3'

export type CompareEmptyProps = {
  /** The worked example's columns, read live by the page. */
  columns: readonly V3SlotsColumn[]
  /** The fields the example compares, in row order. */
  rows: readonly string[]
  /** The §0 trace for the example's figures. */
  source: string
  /** The caption under the SAMPLE mark, naming what was read and when. */
  caption: string
}

/** What /compare holds. The same ceiling ComparisonContext enforces. */
const SLOTS = 4

export function CompareEmpty({ columns, rows, source, caption }: CompareEmptyProps) {
  const { comparisonItems, addToComparison } = useComparison()

  // The visitor's own queue, drawn into the slots. On a truly empty queue this
  // is [] and all four slots render as the places a home goes; the moment one
  // is added the slot carries it, which is the "watch it fill" the evaluator
  // asked for and the page could not show.
  const filled = comparisonItems.map((key) => {
    const known = columns.find((c) => c.key === key)
    return { key, label: known?.title ?? 'Added home', href: known?.href }
  })

  return (
    <V3Slots
      id="compare-empty"
      eyebrow="Central Oregon"
      headline={v3Text('Compare homes')}
      headingLevel={1}
      claim="Four homes, side by side. The comparison below is a live sample — add any of them, or pick your own from a search."
      slots={SLOTS}
      filled={filled}
      emptyLabel="Add a home"
      emptyHref="/homes-for-sale?view=list"
      sample={{
        label: 'Sample',
        caption,
        rows,
        columns,
        addLabel: 'Add this home',
      }}
      source={source}
      onAdd={addToComparison}
    />
  )
}
