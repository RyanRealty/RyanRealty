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
 * WHAT THIS BINDS. V3Slots is the PATTERN (headline, claim, the visible SAMPLE
 * label, the tray, the §0 trace) and CompareSheet is the worked EXAMPLE (the
 * installed shadcn Table and shadcn Carousel, painted navy on cream). Neither
 * takes context, so this file is the thin client wrapper that joins them to the
 * tray the rest of the site already writes: `ComparisonContext`, localStorage
 * key `ryan-realty-compare`, the same list `ListingTile`'s compare checkbox and
 * the floating `ComparisonTray` use. The slots therefore show the visitor's OWN
 * queue, and an add from the worked example lands in the same place an add from
 * a search result does.
 *
 * IT WORKS BEFORE HYDRATION. Every add is a real `<a href="/compare?ids=…">`.
 * The click handler keeps the local tray in step; the navigation is the
 * anchor's own. With JavaScript off, the example still adds.
 *
 * WHY THE EXAMPLE IS NOT "RECENTLY VIEWED". Nothing on this site records which
 * listings a browser has seen in a form a page can read without a login: the
 * only recently-viewed list is `getRecentListingViews()`, a server action that
 * returns [] for a signed-out visitor. The honest substitute is what the page
 * can actually read — homes that are for sale right now, read live and labelled
 * as an example, every one of them a real listing the reader can add or open.
 * Nothing here is a fabricated address or a fabricated price (§0).
 */

import { useComparison } from '@/contexts/ComparisonContext'
import { V3Slots, v3Text } from '@/components/site/v3'
import {
  CompareSheet,
  type CompareSheetHome,
  type CompareSheetRow,
} from './CompareSheet.client'

export type CompareEmptyProps = {
  /** The worked example's homes, read live by the page. */
  homes: readonly CompareSheetHome[]
  /** The fields the example compares, with each field's spread sentence. */
  rows: readonly CompareSheetRow[]
  /** The §0 trace for the example's figures. */
  source: string
  /** The caption beside the SAMPLE mark, naming what was read and when. */
  caption: string
  /** The as-of line under the sheet: publisher, table, read time. */
  sheetCaption: string
  /** The one-sentence claim, carrying the spread the sheet is about. */
  claim: string
}

/** What /compare holds. The same ceiling ComparisonContext enforces. */
const SLOTS = 4

export function CompareEmpty({
  homes,
  rows,
  source,
  caption,
  sheetCaption,
  claim,
}: CompareEmptyProps) {
  const { comparisonItems, addToComparison } = useComparison()

  // The visitor's own queue, drawn into the slots. On a truly empty queue this
  // is [] and the sample is the opening; the moment one is added the tray
  // carries it, which is the "watch it fill" the evaluator asked for.
  const filled = comparisonItems.map((key) => {
    const known = homes.find((h) => h.key === key)
    return { key, label: known?.title ?? 'Added home', href: known?.href }
  })

  return (
    <V3Slots
      id="compare-empty"
      eyebrow="Central Oregon"
      headline={v3Text('Compare homes')}
      headingLevel={1}
      claim={claim}
      // The door out of the landing state. The tray that used to carry it is
      // withheld while the sample is the opening (SITE-65), so the claim keeps
      // one real anchor to the place a visitor picks their own homes.
      claimAction={{ label: 'Start from your own search.', href: '/homes-for-sale?view=list' }}
      slots={SLOTS}
      filled={filled}
      emptyLabel="Add a home"
      emptyHref="/homes-for-sale?view=list"
      sample={{ label: 'Sample', caption }}
      example={
        <CompareSheet
          homes={homes}
          rows={rows}
          caption={sheetCaption}
          addLabel="Add"
          onAdd={addToComparison}
        />
      }
      source={source}
    />
  )
}
