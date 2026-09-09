import { V3Instrument, V3Quiet, v3Text } from '@/components/site/v3'
import { valuationHref } from '@/lib/site/valuation-href'
import type { ListingOffMarketFacts as Facts } from '@/lib/listing/publish-listing-offmarket'

/**
 * SITE-21 — what the page says instead of the market instrument when the home
 * is not for sale.
 *
 * The instrument this replaces asked how the ASK compares to the median ask in
 * this city. That question has no answer for a home that already sold: it is a
 * comparison between a price nobody can pay and a market the house has left.
 * The claim that IS available is the sale itself, and it is the single most
 * useful fact on the page for the reader who arrived here — a neighbour
 * checking what the street is doing, or a buyer who wants the next one.
 *
 * TWO SHAPES, BECAUSE THE RECORD HAS TWO SHAPES.
 *  - A Closed row with a close price is an ANSWER with figures under it, so it
 *    is an Instrument: one sentence, the operands beside it, and the §0 trace
 *    behind the source disclosure.
 *  - An Expired, Canceled or Withdrawn row has no sale. There is nothing to put
 *    figures on and no honest date to print, so it is a Quiet block: the plain
 *    statement plus the doors that go somewhere. Inventing a figure to keep the
 *    shape consistent is exactly what §0.7 forbids.
 *
 * Every string here comes from publishListingOffMarketFacts. This file chooses
 * the form; it never computes, formats, or rounds a figure.
 */
export function ListingOffMarketFacts({
  facts,
  browseHref,
  browseLabel,
}: {
  facts: Facts
  /**
   * The city's live inventory — a PAGE, not the anchor of the rail 50px below
   * this block. Used only on the no-figures shape, where the doors are the
   * section's whole content. When the Instrument renders it carries no door at
   * all: the rail is the next thing on the page and the price strip's primary
   * button already says the same words, so a third identical door between them
   * is noise (looked at 1440 and 375, 2026-09-09).
   */
  browseHref: string
  browseLabel: string
}) {
  const [first, ...rest] = facts.figures
  if (!first) {
    return (
      <V3Quiet
        id="sold"
        eyebrow={facts.eyebrow}
        heading={facts.headline}
        items={[
          {
            kind: 'prose',
            body:
              'The listing ended without a recorded sale, so there is no sale price and no closing date to show. Everything below is the last the MLS recorded about the house itself.',
          },
          { label: browseLabel, href: browseHref },
          { label: 'What is my home worth?', href: valuationHref('/listing') },
        ]}
        note={facts.source}
      />
    )
  }

  const head = { value: v3Text(first.value), label: v3Text(first.label) }
  const tail = rest.map((figure) => ({
    value: v3Text(figure.value),
    label: v3Text(figure.label),
  }))

  return (
    <V3Instrument
      id="sold"
      level={2}
      eyebrow={v3Text(facts.eyebrow)}
      headline={v3Text(facts.headline)}
      figures={[head, ...tail]}
      source={v3Text(facts.source)}
    />
  )
}
